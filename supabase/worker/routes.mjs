// Worker de rotas a pé. Roda no SERVIDOR (cron, Edge Function ou processo
// próprio), nunca no app: usa a chave service_role e a chave do provedor.
// Lê a fila (worker_route_pending), pede o percurso a pé ao provedor e grava
// (worker_route_store). Sem custo por padrão: OSRM com perfil "foot" próprio, ou
// openrouteservice (plano gratuito, com chave). Qual provedor usar em produção é
// decisão pendente (quotas, termos de cache e teto monetário).
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ROUTE_PROVIDER=osrm \
//   ROUTE_BASE_URL=http://localhost:5000 node supabase/worker/routes.mjs
//
// Variáveis: ROUTE_PROVIDER (osrm | ors), ROUTE_BASE_URL, ROUTE_API_KEY (ors),
// ROUTE_INTERVAL_MS (pausa entre consultas, padrão 1500), ROUTE_BATCH (padrão 20).

const R = 6371000;
const rad = (x) => (x * Math.PI) / 180;
export function haversine([lon1, lat1], [lon2, lat2]) {
  const h =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Ponto do percurso (lista de [lon, lat]) na metade da distância percorrida. */
export function midpoint(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const legs = [];
  let total = 0;
  for (let i = 1; i < coordinates.length; i++) {
    const length = haversine(coordinates[i - 1], coordinates[i]);
    legs.push(length);
    total += length;
  }
  if (total === 0) return { lat: coordinates[0][1], lon: coordinates[0][0] };
  let left = total / 2;
  for (let i = 0; i < legs.length; i++) {
    if (left <= legs[i] || i === legs.length - 1) {
      const t = legs[i] === 0 ? 0 : Math.min(1, left / legs[i]);
      const [lon1, lat1] = coordinates[i];
      const [lon2, lat2] = coordinates[i + 1];
      return { lat: lat1 + (lat2 - lat1) * t, lon: lon1 + (lon2 - lon1) * t };
    }
    left -= legs[i];
  }
  return null;
}

const finite = (n) => typeof n === "number" && Number.isFinite(n);

// Cada adaptador devolve { meters, coordinates } ou lança erro (sem rota, cota...).
export const providers = {
  osrm: ({ baseUrl, fetcher }) => async (a, b) => {
    const url = `${baseUrl}/route/v1/foot/${a.lon},${a.lat};${b.lon},${b.lat}?overview=full&geometries=geojson`;
    const response = await fetcher(url);
    if (!response.ok) throw new Error(`OSRM HTTP ${response.status}`);
    const data = await response.json();
    const route = data?.routes?.[0];
    if (data?.code !== "Ok" || !route || !finite(route.distance)) throw new Error("OSRM sem rota");
    return { meters: route.distance, coordinates: route.geometry?.coordinates };
  },
  ors: ({ baseUrl, apiKey, fetcher }) => async (a, b) => {
    const response = await fetcher(`${baseUrl}/v2/directions/foot-walking/geojson`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: apiKey },
      body: JSON.stringify({ coordinates: [[a.lon, a.lat], [b.lon, b.lat]] }),
    });
    if (!response.ok) throw new Error(`ORS HTTP ${response.status}`);
    const data = await response.json();
    const feature = data?.features?.[0];
    const meters = feature?.properties?.summary?.distance;
    if (!feature || !finite(meters)) throw new Error("ORS sem rota");
    return { meters, coordinates: feature.geometry?.coordinates };
  },
};

/** Esvazia uma leva da fila. `rpc(nome, corpo)` chama worker_* com a service_role. */
export async function processBatch({
  rpc,
  route,
  batch = 20,
  intervalMs = 0,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  const pending = await rpc("worker_route_pending", { limit: batch });
  const result = { stored: 0, failed: 0 };
  for (const [index, pair] of pending.entries()) {
    if (index > 0 && intervalMs) await sleep(intervalMs);
    try {
      const found = await route(pair.a, pair.b);
      const mid = midpoint(found.coordinates);
      if (!mid) throw new Error("percurso sem geometria");
      await rpc("worker_route_store", { ...pair, meters: Math.round(found.meters), mid, provider: "worker" });
      result.stored++;
    } catch (error) {
      await rpc("worker_route_fail", { ...pair, error: String(error?.message ?? error) });
      result.failed++;
    }
  }
  return result;
}

export function createRpc({ url, serviceKey, fetcher = fetch }) {
  return async (name, body) => {
    const response = await fetcher(`${url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    return response.json();
  };
}

if (process.argv[1]?.endsWith("routes.mjs")) {
  const env = process.env;
  const need = (key) => env[key] || (console.error(`Falta ${key}`), process.exit(1));
  const provider = providers[env.ROUTE_PROVIDER ?? "osrm"];
  if (!provider) (console.error("ROUTE_PROVIDER deve ser osrm ou ors"), process.exit(1));
  const rpc = createRpc({ url: need("SUPABASE_URL"), serviceKey: need("SUPABASE_SERVICE_ROLE_KEY") });
  const route = provider({ baseUrl: need("ROUTE_BASE_URL"), apiKey: env.ROUTE_API_KEY, fetcher: fetch });
  const result = await processBatch({
    rpc,
    route,
    batch: Number(env.ROUTE_BATCH ?? 20),
    intervalMs: Number(env.ROUTE_INTERVAL_MS ?? 1500),
  });
  console.log(`rotas gravadas: ${result.stored}, falhas: ${result.failed}`);
}

import { isPoint, type Point } from "./model.ts";

export type Place = {
  id: string;
  title: string;
  detail: string;
  label: string;
  point: Point;
  street: string;
  area: string;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 200) : "";
}
function unique(parts: string[]) {
  return [...new Set(parts.filter(Boolean))].join(" · ");
}
export function readPlaces(value: unknown): Place[] {
  if (
    !value ||
    typeof value !== "object" ||
    !("features" in value) ||
    !Array.isArray(value.features)
  )
    return [];
  const result: Place[] = [];
  for (const feature of value.features.slice(0, 10)) {
    const raw = feature?.geometry?.coordinates;
    const p = feature?.properties;
    if (!Array.isArray(raw) || !p || typeof p !== "object") continue;
    const point = { latitude: raw[1], longitude: raw[0] };
    if (!isPoint(point)) continue;
    const street = [text(p.street), text(p.housenumber)]
      .filter(Boolean)
      .join(", ");
    const title = text(p.name) || street || text(p.district) || text(p.city);
    if (!title) continue;
    const area = unique([text(p.district), text(p.city), text(p.state)]);
    const detail = unique([street !== title ? street : "", area]);
    const label = unique([title, detail]);
    if (result.some((place) => place.label === label)) continue;
    result.push({
      id: `${text(p.osm_type)}${p.osm_id ?? result.length}:${point.latitude}:${point.longitude}`,
      title,
      detail,
      label,
      point,
      street: street || (p.osm_key === "highway" ? title : ""),
      area,
    });
  }
  return result.slice(0, 5);
}

// Resposta do geocoder do backend próprio (GEOCODER_PROVIDER=api):
// { "places": [{ "title", "detail"?, "street"?, "area"?, "latitude", "longitude", "id"? }] }.
// O servidor pode ser proxy de qualquer fornecedor (inclusive faturável), com
// chave e cota guardadas lá; o app só vê este formato.
export function readApiPlaces(value: unknown): Place[] {
  if (
    !value ||
    typeof value !== "object" ||
    !("places" in value) ||
    !Array.isArray(value.places)
  )
    return [];
  const result: Place[] = [];
  for (const item of value.places.slice(0, 10)) {
    if (!item || typeof item !== "object") continue;
    const point = { latitude: item.latitude, longitude: item.longitude };
    if (!isPoint(point)) continue;
    const title = text(item.title);
    if (!title) continue;
    const detail = text(item.detail);
    const label = unique([title, detail]);
    if (result.some((place) => place.label === label)) continue;
    result.push({
      id:
        text(item.id) ||
        `api${result.length}:${point.latitude}:${point.longitude}`,
      title,
      detail,
      label,
      point,
      street: text(item.street),
      area: text(item.area),
    });
  }
  return result.slice(0, 5);
}

// Reverse results describe nearby OSM features. Keep the user's exact point and
// never present a nearby POI as if it were the exact pickup address.
export function pointLabel(place: Place | undefined, fallback: string) {
  return place ? unique([place.street || fallback, place.area]) : fallback;
}

function cancelled() {
  const error = new Error("Consulta cancelada.");
  error.name = "AbortError";
  return error;
}
function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(cancelled());
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      reject(cancelled());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", abort, { once: true });
  });
}

export type GeocoderOptions = {
  fetcher?: typeof fetch;
  /** Base do Photon; deriva `${endpoint}/api/` e `${endpoint}/reverse/`. */
  endpoint?: string;
  /** URLs completas (backend próprio); têm prioridade sobre `endpoint`. */
  searchUrl?: string;
  reverseUrl?: string;
  /** Converte o JSON da resposta; o padrão lê o GeoJSON do Photon. */
  parse?: (json: unknown) => Place[];
  /** O Photon público só aceita lang=default; o backend próprio pode zerar. */
  fixedParams?: Record<string, string>;
  /** Cabeçalhos de autenticação, só para o backend próprio (evita preflight CORS no Photon). */
  headers?: () => Record<string, string>;
  intervalMs?: number;
  timeoutMs?: number;
};

export function createGeocoder({
  fetcher = fetch,
  endpoint = "https://photon.komoot.io",
  searchUrl = `${endpoint.replace(/\/$/, "")}/api/`,
  reverseUrl = `${endpoint.replace(/\/$/, "")}/reverse/`,
  parse = readPlaces,
  fixedParams = { lang: "default" }, // The hosted demo does not support lang=pt.
  headers,
  intervalMs = 1200,
  timeoutMs = 8000,
}: GeocoderOptions = {}) {
  let queue: Promise<unknown> = Promise.resolve();
  let nextAllowed = 0;
  const cache = new Map<string, { at: number; places: Place[] }>();
  const request = (
    base: string,
    params: URLSearchParams,
    signal?: AbortSignal,
  ): Promise<Place[]> => {
    for (const [key, value] of Object.entries(fixedParams))
      params.set(key, value);
    const url = `${base}${base.includes("?") ? "&" : "?"}${params}`;
    const job = async () => {
      if (signal?.aborted) throw cancelled();
      const hit = cache.get(url);
      if (hit && Date.now() - hit.at < 15 * 60_000) return hit.places;
      await delay(Math.max(0, nextAllowed - Date.now()), signal);
      if (signal?.aborted) throw cancelled();
      nextAllowed = Date.now() + intervalMs;
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal?.addEventListener("abort", abort, { once: true });
      const timer = setTimeout(abort, timeoutMs);
      try {
        const response = await fetcher(url, {
          signal: controller.signal,
          ...(headers ? { headers: headers() } : {}),
        }).catch((reason: unknown) => {
          if (controller.signal.aborted) throw reason;
          throw new Error(
            "Sem conexão com a busca de endereços. Tente novamente ou escolha no mapa.",
          );
        });
        if (!response.ok)
          throw new Error(
            response.status === 429
              ? "Busca ocupada. Aguarde um pouco e tente novamente."
              : "Não foi possível buscar endereços. Tente novamente ou escolha no mapa.",
          );
        const places = parse(await response.json());
        if (signal?.aborted) throw cancelled();
        cache.set(url, { at: Date.now(), places });
        if (cache.size > 64) cache.delete(cache.keys().next().value as string);
        return places;
      } catch (error) {
        if (signal?.aborted) throw cancelled();
        if (controller.signal.aborted)
          throw new Error(
            "A busca demorou a responder. Tente novamente ou escolha no mapa.",
          );
        throw error;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
      }
    };
    const result = queue.then(job);
    queue = result.catch(() => undefined);
    return result;
  };
  return {
    search(query: string, signal?: AbortSignal) {
      const q = query.trim().slice(0, 160);
      if (q.length < 3) return Promise.resolve([]);
      return request(searchUrl, new URLSearchParams({ q, limit: "5" }), signal);
    },
    reverse(point: Point, signal?: AbortSignal) {
      if (!isPoint(point)) return Promise.resolve([]);
      return request(
        reverseUrl,
        new URLSearchParams({
          lat: String(point.latitude),
          lon: String(point.longitude),
          limit: "1",
        }),
        signal,
      );
    },
  };
}

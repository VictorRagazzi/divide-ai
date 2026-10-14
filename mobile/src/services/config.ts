import { type RawEnv, readEnv } from "./env.ts";

// Configuração do app lida das variáveis EXPO_PUBLIC_* (ver .env.example e
// documentos/Integracao_backend.md). Valor ausente ou inválido nunca derruba o
// app: cai no padrão seguro (demonstração, OpenStreetMap/Photon públicos) e
// registra um aviso em `warnings`.

export type DataSource = "demo" | "api";
export type AuthProviderKind = "demo" | "supabase";
export type GeocoderProviderKind = "photon" | "api";
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type EndpointSpec = { method: HttpMethod; url: string };

// Cada nome corresponde à variável EXPO_PUBLIC_API_<NOME>.
export const readEndpointNames = [
  "STATE_GET",
  "CANDIDATES_GET",
  "MESSAGES_GET",
  "HISTORY_GET",
] as const;
export const writeEndpointNames = [
  "PROFILE_SAVE",
  "INTENT_SAVE",
  "INTENT_CANCEL",
  "REQUEST_SEND",
  "REQUEST_CANCEL",
  "REQUEST_DECLINE",
  "PROPOSAL_PICK",
  "MESSAGE_SEND",
  "NEGOTIATION_END",
  "TRIP_OUTCOME",
  "REVIEW_SEND",
  "TRIP_CLOSE",
  "REPORT_SEND",
  "BLOCK_ADD",
  "BLOCK_REMOVE",
] as const;
export const endpointNames = [
  ...readEndpointNames,
  ...writeEndpointNames,
] as const;
export type EndpointName = (typeof endpointNames)[number];

export const DEFAULT_GEOCODER_URL = "https://photon.komoot.io";
export const DEFAULT_TILE_URL =
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const DEFAULT_ATTRIBUTION_TEXT = "© OpenStreetMap contributors";
export const DEFAULT_ATTRIBUTION_URL =
  "https://www.openstreetmap.org/copyright";

export type AppConfig = {
  /** Dados fictícios em memória: selos "DEMO", ações de simulação e fixtures. */
  demo: boolean;
  data: {
    source: DataSource;
    baseUrl: string | null;
    apiKey: string | null;
    timeoutMs: number;
    /** 0 desliga a atualização periódica do estado. */
    pollMs: number;
    endpoints: Partial<Record<EndpointName, EndpointSpec>>;
  };
  auth: {
    provider: AuthProviderKind;
    baseUrl: string | null;
    apiKey: string | null;
  };
  geocoder: {
    provider: GeocoderProviderKind;
    baseUrl: string;
    search: EndpointSpec | null;
    reverse: EndpointSpec | null;
    intervalMs: number;
    /** Só o backend próprio recebe a sessão e a chave pública. */
    authenticated: boolean;
  };
  map: {
    tileUrl: string;
    maxZoom: number;
    attributionText: string;
    attributionUrl: string;
  };
  warnings: string[];
};

const LOCAL_HOST =
  /^(localhost|127\.\d+\.\d+\.\d+|10\.0\.2\.2|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|[^.]+\.local)$/i;

// https sempre; http só para desenvolvimento local (emulador, rede da casa).
function parseUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.username || url.password) return null;
    if (url.protocol === "https:") return url;
    if (url.protocol === "http:" && LOCAL_HOST.test(url.hostname)) return url;
  } catch {
    // valor inválido tratado pelo chamador
  }
  return null;
}

function parseBase(value: string | undefined) {
  const text = value?.trim();
  if (!text) return { value: null, invalid: false };
  const url = parseUrl(text);
  if (!url) return { value: null, invalid: true };
  return {
    value: `${url.origin}${url.pathname}`.replace(/\/+$/, ""),
    invalid: false,
  };
}

function parseNumber(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  const text = value?.trim();
  if (!text) return fallback;
  const number = Number(text);
  return Number.isInteger(number) && number >= min && number <= max
    ? number
    : fallback;
}

function pick<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  fallback: T,
  warnings: string[],
  name: string,
): T {
  const text = value?.trim().toLowerCase();
  if (!text) return fallback;
  if ((allowed as readonly string[]).includes(text)) return text as T;
  warnings.push(`${name}="${value}" não é válido; usando "${fallback}".`);
  return fallback;
}

// "POST /rest/v1/rpc/fn", "/caminho" (método padrão) ou URL absoluta.
export function parseEndpoint(
  value: string | undefined,
  base: string | null,
  defaultMethod: HttpMethod,
): EndpointSpec | null | "invalid" {
  const text = value?.trim();
  if (!text) return null;
  const match = /^(GET|POST|PUT|PATCH|DELETE)\s+(\S.*)$/i.exec(text);
  const method = (match?.[1]?.toUpperCase() as HttpMethod) ?? defaultMethod;
  const target = (match?.[2] ?? text).trim();
  if (target.startsWith("/")) {
    if (!base || target.startsWith("//")) return "invalid";
    return { method, url: `${base}${target}` };
  }
  const url = parseUrl(target);
  return url ? { method, url: url.toString() } : "invalid";
}

// Modelo de tile do Leaflet: precisa de {z}/{x}/{y}; {s} e {r} são opcionais.
export function isTileTemplate(value: string) {
  if (value.length > 300 || /[\s"'<>\\`]/.test(value)) return false;
  if (!/\{z\}/.test(value) || !/\{x\}/.test(value) || !/\{y\}/.test(value))
    return false;
  const probe = value.replace(/\{s\}/g, "a").replace(/\{[zxyr]\}/g, "1");
  return probe.startsWith("https://") && parseUrl(probe) !== null;
}

export function parseConfig(env: RawEnv): AppConfig {
  const warnings: string[] = [];
  const get = (key: string) => env[key]?.trim() || undefined;

  const apiBase = parseBase(get("EXPO_PUBLIC_API_BASE_URL"));
  if (apiBase.invalid)
    warnings.push(
      "EXPO_PUBLIC_API_BASE_URL inválida (use https; http só em localhost/rede local).",
    );
  const apiKey = get("EXPO_PUBLIC_API_KEY") ?? null;

  let source = pick(
    get("EXPO_PUBLIC_DATA_SOURCE"),
    ["demo", "api"] as const,
    "demo",
    warnings,
    "EXPO_PUBLIC_DATA_SOURCE",
  );
  if (source === "api" && !apiBase.value) {
    warnings.push(
      "EXPO_PUBLIC_DATA_SOURCE=api exige EXPO_PUBLIC_API_BASE_URL válida; mantendo a demonstração.",
    );
    source = "demo";
  }

  const endpoints: Partial<Record<EndpointName, EndpointSpec>> = {};
  for (const name of endpointNames) {
    const key = `EXPO_PUBLIC_API_${name}`;
    const spec = parseEndpoint(
      get(key),
      apiBase.value,
      name.endsWith("_GET") ? "GET" : "POST",
    );
    if (spec === "invalid")
      warnings.push(`${key} inválido; esperado "[MÉTODO] /caminho" ou URL.`);
    else if (spec) endpoints[name] = spec;
  }
  if (source === "api") {
    const missing = endpointNames.filter((name) => !endpoints[name]);
    if (missing.length)
      warnings.push(`Endpoints sem configuração: ${missing.join(", ")}.`);
  }

  const authBase = parseBase(get("EXPO_PUBLIC_AUTH_BASE_URL"));
  if (authBase.invalid)
    warnings.push("EXPO_PUBLIC_AUTH_BASE_URL inválida; ignorada.");
  const authBaseUrl = authBase.value ?? apiBase.value;
  let authProvider = pick(
    get("EXPO_PUBLIC_AUTH_PROVIDER"),
    ["demo", "supabase"] as const,
    "demo",
    warnings,
    "EXPO_PUBLIC_AUTH_PROVIDER",
  );
  if (authProvider === "supabase" && (!authBaseUrl || !apiKey)) {
    warnings.push(
      "EXPO_PUBLIC_AUTH_PROVIDER=supabase exige URL (AUTH_BASE_URL ou API_BASE_URL) e EXPO_PUBLIC_API_KEY; mantendo o login de demonstração.",
    );
    authProvider = "demo";
  }

  const geoUrl = parseBase(get("EXPO_PUBLIC_GEOCODER_URL"));
  if (geoUrl.invalid)
    warnings.push("EXPO_PUBLIC_GEOCODER_URL inválida; ignorada.");
  let geoProvider = pick(
    get("EXPO_PUBLIC_GEOCODER_PROVIDER"),
    ["photon", "api"] as const,
    "photon",
    warnings,
    "EXPO_PUBLIC_GEOCODER_PROVIDER",
  );
  const geoBase =
    geoUrl.value ?? (geoProvider === "api" ? apiBase.value : null);
  let search: EndpointSpec | null = null;
  let reverse: EndpointSpec | null = null;
  if (geoProvider === "api") {
    const s = parseEndpoint(get("EXPO_PUBLIC_GEOCODER_SEARCH"), geoBase, "GET");
    const r = parseEndpoint(
      get("EXPO_PUBLIC_GEOCODER_REVERSE"),
      geoBase,
      "GET",
    );
    if (s && s !== "invalid" && r && r !== "invalid") {
      search = s;
      reverse = r;
    } else {
      warnings.push(
        "EXPO_PUBLIC_GEOCODER_PROVIDER=api exige GEOCODER_SEARCH e GEOCODER_REVERSE válidos; usando o Photon público.",
      );
      geoProvider = "photon";
    }
  }
  const photonUrl =
    geoProvider === "photon" ? (geoUrl.value ?? DEFAULT_GEOCODER_URL) : "";

  const tile = get("EXPO_PUBLIC_MAP_TILE_URL");
  let tileUrl = DEFAULT_TILE_URL;
  if (tile) {
    if (isTileTemplate(tile)) tileUrl = tile;
    else
      warnings.push(
        "EXPO_PUBLIC_MAP_TILE_URL inválida (https com {z}/{x}/{y}); usando OpenStreetMap.",
      );
  }
  const attributionUrl = get("EXPO_PUBLIC_MAP_ATTRIBUTION_URL");
  const safeAttributionUrl =
    attributionUrl && parseUrl(attributionUrl)?.protocol === "https:"
      ? attributionUrl
      : DEFAULT_ATTRIBUTION_URL;
  if (attributionUrl && safeAttributionUrl !== attributionUrl)
    warnings.push("EXPO_PUBLIC_MAP_ATTRIBUTION_URL inválida; usando a padrão.");

  return {
    demo: source === "demo",
    data: {
      source,
      baseUrl: apiBase.value,
      apiKey,
      timeoutMs: parseNumber(
        get("EXPO_PUBLIC_API_TIMEOUT_MS"),
        15_000,
        1_000,
        120_000,
      ),
      pollMs: parseNumber(get("EXPO_PUBLIC_API_POLL_MS"), 5_000, 0, 600_000),
      endpoints,
    },
    auth: { provider: authProvider, baseUrl: authBaseUrl, apiKey },
    geocoder: {
      provider: geoProvider,
      baseUrl: geoProvider === "api" ? (geoBase ?? "") : photonUrl,
      search,
      reverse,
      intervalMs: parseNumber(
        get("EXPO_PUBLIC_GEOCODER_INTERVAL_MS"),
        geoProvider === "photon" ? 1_200 : 0,
        0,
        10_000,
      ),
      authenticated: geoProvider === "api",
    },
    map: {
      tileUrl,
      maxZoom: parseNumber(get("EXPO_PUBLIC_MAP_TILE_MAX_ZOOM"), 19, 1, 22),
      attributionText:
        get("EXPO_PUBLIC_MAP_ATTRIBUTION_TEXT")?.slice(0, 120) ??
        DEFAULT_ATTRIBUTION_TEXT,
      attributionUrl: safeAttributionUrl,
    },
    warnings,
  };
}

export const config = parseConfig(readEnv());

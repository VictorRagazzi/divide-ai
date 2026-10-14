import {
  createGeocoder,
  type GeocoderOptions,
  readApiPlaces,
} from "../features/maps/geocoder.ts";
import {
  type AuthAdapter,
  createAuth,
  createSessionManager,
  type SessionManager,
  type SessionStore,
} from "./auth.ts";
import { type AppConfig, config } from "./config.ts";
import { createGateway, type Gateway } from "./gateway.ts";
import { createHttpClient } from "./http.ts";

// Ponto único de montagem: lê a configuração e entrega os adaptadores prontos.
// Trocar de demonstração para backend é só editar o .env (sem mexer em telas).
export type Services = {
  config: AppConfig;
  auth: AuthAdapter;
  session: SessionManager;
  /** null no modo demonstração: os dados ficam no reducer local. */
  gateway: Gateway | null;
  geocoder: ReturnType<typeof createGeocoder>;
};

export function createServices(
  settings: AppConfig,
  options: { fetcher?: typeof fetch; store?: SessionStore } = {},
): Services {
  const fetcher = options.fetcher ?? ((...args) => fetch(...args));
  const auth = createAuth(settings, fetcher);
  const session = createSessionManager(auth, options.store);
  const http = createHttpClient({
    fetcher,
    timeoutMs: settings.data.timeoutMs,
    apiKey: settings.data.apiKey,
    getToken: session.getAccessToken,
    onUnauthorized: session.refresh,
  });
  const gateway =
    settings.data.source === "api"
      ? createGateway({ http, endpoints: settings.data.endpoints })
      : null;

  const geo = settings.geocoder;
  const geocoderOptions: GeocoderOptions =
    geo.provider === "api" && geo.search && geo.reverse
      ? {
          fetcher,
          searchUrl: geo.search.url,
          reverseUrl: geo.reverse.url,
          parse: readApiPlaces,
          fixedParams: {},
          intervalMs: geo.intervalMs,
          headers: () => {
            const headers: Record<string, string> = {};
            if (settings.data.apiKey) headers.apikey = settings.data.apiKey;
            const token = session.getAccessToken();
            if (token) headers.Authorization = `Bearer ${token}`;
            return headers;
          },
        }
      : { fetcher, endpoint: geo.baseUrl, intervalMs: geo.intervalMs };
  return {
    config: settings,
    auth,
    session,
    gateway,
    geocoder: createGeocoder(geocoderOptions),
  };
}

export const services = createServices(config);

if (typeof __DEV__ !== "undefined" && __DEV__ && config.warnings.length)
  console.warn(`[divide-ai] configuração:\n- ${config.warnings.join("\n- ")}`);

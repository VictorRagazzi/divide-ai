import type { EndpointSpec } from "./config.ts";

// Cliente HTTP mínimo (sem dependência): JSON, timeout, cabeçalhos de
// autenticação, chave de idempotência e erros já em português para a tela.

export class ApiError extends Error {
  status: number;
  /** Detalhe técnico para log; nunca exibido ao usuário. */
  detail: string;
  constructor(status: number, message: string, detail = "") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export function messageForStatus(status: number) {
  if (status === 401) return "Sua sessão expirou. Entre novamente.";
  if (status === 403) return "Você não tem permissão para esta ação.";
  if (status === 404) return "Não encontramos este item. Atualize a tela.";
  if (status === 409)
    return "Algo mudou enquanto você decidia. Atualizamos a tela, confira e tente de novo.";
  if (status === 429)
    return "Muitas tentativas. Aguarde um pouco e tente novamente.";
  if (status === 400 || status === 422)
    return "Não foi possível concluir. Confira os dados e tente novamente.";
  if (status >= 500)
    return "O servidor está indisponível. Tente novamente em instantes.";
  return "Não foi possível concluir. Tente novamente.";
}

export const NETWORK_MESSAGE =
  "Sem conexão com o servidor. Verifique a internet e tente novamente.";
export const TIMEOUT_MESSAGE =
  "O servidor demorou a responder. Tente novamente.";

export type HttpRequest = {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  /** Repetir a mesma chave após falha de rede devolve o mesmo resultado. */
  idempotencyKey?: string;
  signal?: AbortSignal;
};

export type HttpClientOptions = {
  fetcher?: typeof fetch;
  timeoutMs: number;
  /** Chave PÚBLICA (ex.: anon do Supabase) enviada no cabeçalho `apikey`. */
  apiKey?: string | null;
  getToken?: () => string | null;
  /** Tenta renovar a sessão; true repete a chamada uma vez. */
  onUnauthorized?: () => Promise<boolean>;
};

export function newIdempotencyKey() {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  const part = () => Math.random().toString(16).slice(2, 10);
  return `${Date.now().toString(16)}-${part()}-${part()}`;
}

function abortError() {
  const error = new Error("Consulta cancelada.");
  error.name = "AbortError";
  return error;
}

export function createHttpClient(options: HttpClientOptions) {
  const fetcher = options.fetcher ?? fetch;
  const attempt = async (
    spec: EndpointSpec,
    request: HttpRequest,
  ): Promise<Response> => {
    const url = new URL(spec.url);
    for (const [key, value] of Object.entries(request.query ?? {}))
      if (value !== undefined) url.searchParams.set(key, String(value));
    const headers: Record<string, string> = { Accept: "application/json" };
    if (request.body !== undefined)
      headers["Content-Type"] = "application/json";
    if (options.apiKey) headers.apikey = options.apiKey;
    const token = options.getToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (request.idempotencyKey)
      headers["Idempotency-Key"] = request.idempotencyKey;
    const controller = new AbortController();
    const abort = () => controller.abort();
    request.signal?.addEventListener("abort", abort, { once: true });
    if (request.signal?.aborted) controller.abort();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, options.timeoutMs);
    try {
      return await fetcher(url.toString(), {
        method: spec.method,
        headers,
        body:
          request.body === undefined ? undefined : JSON.stringify(request.body),
        signal: controller.signal,
      });
    } catch {
      if (request.signal?.aborted) throw abortError();
      throw new ApiError(
        0,
        timedOut ? TIMEOUT_MESSAGE : NETWORK_MESSAGE,
        timedOut ? "timeout" : "network",
      );
    } finally {
      clearTimeout(timer);
      request.signal?.removeEventListener("abort", abort);
    }
  };

  const request = async (
    spec: EndpointSpec,
    init: HttpRequest = {},
  ): Promise<unknown> => {
    // Leituras e escritas com chave podem ser repetidas sem efeito duplo.
    const repeatable = spec.method === "GET" || Boolean(init.idempotencyKey);
    let response: Response;
    try {
      response = await attempt(spec, init);
    } catch (error) {
      if (!(error instanceof ApiError) || !repeatable) throw error;
      response = await attempt(spec, init);
    }
    if (response.status === 401 && options.onUnauthorized) {
      if (await options.onUnauthorized()) response = await attempt(spec, init);
    }
    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        detail = (await response.text()).slice(0, 300) || detail;
      } catch {
        // corpo ilegível: mantém o status
      }
      throw new ApiError(
        response.status,
        messageForStatus(response.status),
        detail,
      );
    }
    if (response.status === 204) return {};
    const text = await response.text().catch(() => "");
    if (!text.trim()) return {};
    try {
      return JSON.parse(text);
    } catch {
      throw new ApiError(
        502,
        "Resposta inesperada do servidor. Tente novamente.",
        "json",
      );
    }
  };
  return { request };
}

export type HttpClient = ReturnType<typeof createHttpClient>;

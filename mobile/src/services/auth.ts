import { DEMO_OTP } from "../features/demo/domain.ts";
import type { AppConfig } from "./config.ts";
import {
  ApiError,
  messageForStatus,
  NETWORK_MESSAGE,
  TIMEOUT_MESSAGE,
} from "./http.ts";

// Entrada sem senha: e-mail → código de 6 números. QUEM ENVIA O E-MAIL é o
// servidor (Supabase Auth + SMTP do Resend, ver documentos/Contratos_tecnicos.md).
// O app só pede o envio e confere o código; a chave do Resend nunca chega aqui.

export type Session = {
  email: string;
  accessToken: string;
  refreshToken?: string;
  /** Instante (ms) em que o token expira; ausente = desconhecido. */
  expiresAt?: number;
};

export interface AuthAdapter {
  readonly kind: "demo" | "supabase";
  /** Pede ao servidor o envio do código por e-mail. */
  requestCode(email: string, signal?: AbortSignal): Promise<void>;
  verifyCode(
    email: string,
    code: string,
    signal?: AbortSignal,
  ): Promise<Session>;
  refresh(session: Session): Promise<Session>;
  signOut(session: Session): Promise<void>;
}

export const WRONG_CODE_MESSAGE =
  "Código incorreto ou expirado. Confira ou peça um novo código.";

export function createDemoAuth(): AuthAdapter {
  return {
    kind: "demo",
    async requestCode() {},
    async verifyCode(email, code) {
      if (code.replace(/\D/g, "") !== DEMO_OTP)
        throw new ApiError(400, WRONG_CODE_MESSAGE, "demo");
      return { email: email.trim().toLowerCase(), accessToken: "demo" };
    },
    async refresh(session) {
      return session;
    },
    async signOut() {},
  };
}

// Supabase Auth (GoTrue) pela API REST: sem o SDK, sem dependência nova.
// Requer o modelo de e-mail com {{ .Token }} e OTP de 6 dígitos no painel.
export function createSupabaseAuth(
  baseUrl: string,
  apiKey: string,
  fetcher: typeof fetch = fetch,
  timeoutMs = 15_000,
): AuthAdapter {
  const call = async (
    path: string,
    body: unknown,
    token?: string,
    signal?: AbortSignal,
  ) => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    try {
      const response = await fetcher(`${baseUrl}/auth/v1${path}`, {
        method: "POST",
        headers: {
          apikey: apiKey,
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await response.text().catch(() => "");
      let json: unknown = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        // resposta sem JSON: segue só com o status
      }
      return { status: response.status, ok: response.ok, json };
    } catch {
      if (signal?.aborted) {
        const error = new Error("Consulta cancelada.");
        error.name = "AbortError";
        throw error;
      }
      throw new ApiError(
        0,
        timedOut ? TIMEOUT_MESSAGE : NETWORK_MESSAGE,
        timedOut ? "timeout" : "network",
      );
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  };
  const fail = (status: number, json: unknown, wrongCode = false): never => {
    const detail =
      json && typeof json === "object"
        ? JSON.stringify(json).slice(0, 300)
        : `HTTP ${status}`;
    const code = wrongCode && [400, 401, 403, 422].includes(status);
    throw new ApiError(
      status,
      code ? WRONG_CODE_MESSAGE : messageForStatus(status),
      detail,
    );
  };
  const readSession = (json: unknown, fallbackEmail: string): Session => {
    const value = (json ?? {}) as Record<string, unknown>;
    const user = (value.user ?? {}) as Record<string, unknown>;
    if (typeof value.access_token !== "string" || !value.access_token)
      throw new ApiError(502, "Resposta inesperada do servidor.", "session");
    const email =
      typeof user.email === "string" && user.email ? user.email : fallbackEmail;
    const expiresIn =
      typeof value.expires_in === "number" && value.expires_in > 0
        ? value.expires_in
        : undefined;
    return {
      email: email.trim().toLowerCase(),
      accessToken: value.access_token,
      refreshToken:
        typeof value.refresh_token === "string"
          ? value.refresh_token
          : undefined,
      expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : undefined,
    };
  };
  return {
    kind: "supabase",
    async requestCode(email, signal) {
      const result = await call(
        "/otp",
        { email: email.trim().toLowerCase(), create_user: true },
        undefined,
        signal,
      );
      if (!result.ok) fail(result.status, result.json);
    },
    async verifyCode(email, code, signal) {
      const address = email.trim().toLowerCase();
      const result = await call(
        "/verify",
        { type: "email", email: address, token: code.replace(/\D/g, "") },
        undefined,
        signal,
      );
      if (!result.ok) fail(result.status, result.json, true);
      return readSession(result.json, address);
    },
    async refresh(session) {
      if (!session.refreshToken)
        throw new ApiError(401, messageForStatus(401), "no-refresh-token");
      const result = await call("/token?grant_type=refresh_token", {
        refresh_token: session.refreshToken,
      });
      if (!result.ok) fail(result.status, result.json);
      return readSession(result.json, session.email);
    },
    async signOut(session) {
      // Melhor esforço: a sessão local é descartada de qualquer forma.
      await call("/logout", {}, session.accessToken).catch(() => undefined);
    },
  };
}

// Onde a sessão fica guardada. Em memória ela some ao recarregar. Para manter
// o login no aparelho, implemente esta interface com expo-secure-store
// (`npx expo install expo-secure-store`) e passe em createSessionManager.
export interface SessionStore {
  load(): Promise<Session | null>;
  save(session: Session): Promise<void>;
  clear(): Promise<void>;
}

export function createMemoryStore(): SessionStore {
  let value: Session | null = null;
  return {
    async load() {
      return value;
    },
    async save(session) {
      value = session;
    },
    async clear() {
      value = null;
    },
  };
}

const REFRESH_MARGIN_MS = 60_000;

export function createSessionManager(
  auth: AuthAdapter,
  store: SessionStore = createMemoryStore(),
  now: () => number = Date.now,
) {
  let current: Session | null = null;
  let refreshing: Promise<boolean> | null = null;
  const expiring = (session: Session) =>
    session.expiresAt !== undefined &&
    session.expiresAt - REFRESH_MARGIN_MS <= now();
  const drop = async () => {
    current = null;
    await store.clear().catch(() => undefined);
  };
  const manager = {
    get: () => current,
    getAccessToken: () => current?.accessToken ?? null,
    async signIn(email: string, code: string, signal?: AbortSignal) {
      const session = await auth.verifyCode(email, code, signal);
      current = session;
      await store.save(session).catch(() => undefined);
      return session;
    },
    /** Recupera a sessão guardada; renova se estiver perto de vencer. */
    async restore() {
      const saved = await store.load().catch(() => null);
      if (!saved) return null;
      current = saved;
      if (expiring(saved) && !(await manager.refresh())) return null;
      return current;
    },
    /** Renova o token (chamadas simultâneas compartilham a mesma tentativa). */
    refresh(): Promise<boolean> {
      const session = current;
      if (!session) return Promise.resolve(false);
      refreshing ??= (async () => {
        try {
          const next = await auth.refresh(session);
          current = next;
          await store.save(next).catch(() => undefined);
          return true;
        } catch {
          await drop();
          return false;
        } finally {
          refreshing = null;
        }
      })();
      return refreshing;
    },
    async signOut() {
      const session = current;
      await drop();
      if (session) await auth.signOut(session).catch(() => undefined);
    },
  };
  return manager;
}

export type SessionManager = ReturnType<typeof createSessionManager>;

export function createAuth(
  config: AppConfig,
  fetcher: typeof fetch = fetch,
): AuthAdapter {
  if (
    config.auth.provider === "supabase" &&
    config.auth.baseUrl &&
    config.auth.apiKey
  )
    return createSupabaseAuth(
      config.auth.baseUrl,
      config.auth.apiKey,
      fetcher,
      config.data.timeoutMs,
    );
  return createDemoAuth();
}

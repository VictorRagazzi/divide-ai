import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { services } from "../../services";
import {
  applySnapshot,
  commandRoute,
  type ReadResource,
  type Snapshot,
} from "../../services/gateway";
import { ApiError } from "../../services/http";
import {
  type Command,
  type DemoState,
  initialState,
  transition,
} from "./domain";

type Refresh = (
  resource?: ReadResource,
  options?: { negotiation?: number; silent?: boolean },
) => Promise<Snapshot | null>;

const DemoContext = createContext<{
  state: DemoState;
  now: number;
  /**
   * Envia um comando. `then` roda quando o comando foi aplicado: na demo, na
   * hora; com backend, só depois de o servidor confirmar (falha → `error`).
   */
  send: (command: Command, then?: () => void) => void;
  /** Há comando aguardando o servidor (sempre false na demo). */
  busy: boolean;
  /** Última falha do servidor, já em português; some sozinha ou por clearError. */
  error: string | null;
  clearError: () => void;
  /** Relê o estado no servidor (na demo não faz nada e devolve null). */
  refresh: Refresh;
} | null>(null);

const ERROR_VISIBLE_MS = 8000;

const { gateway, session } = services;

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialState);
  const [now, setNow] = useState(Date.now);
  const [pendingCommands, setPendingCommands] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const inFlight = useRef(0);
  const polling = useRef(false);

  const applyLocal = useCallback((command: Command) => {
    const instant = Date.now();
    setNow(instant);
    setState((current) => transition(current, command, instant));
  }, []);

  // Sessão recusada pelo servidor (e sem renovação possível): volta ao login.
  const fail = useCallback(
    (reason: unknown, silent = false) => {
      if (reason instanceof Error && reason.name === "AbortError") return;
      if (reason instanceof ApiError && reason.status === 401) {
        void session.signOut();
        applyLocal({ type: "sign-out" });
      }
      if (!silent)
        setError(
          reason instanceof ApiError
            ? reason.message
            : "Não foi possível concluir. Tente novamente.",
        );
    },
    [applyLocal],
  );

  const refresh = useCallback<Refresh>(
    async (resource = "state", options = {}) => {
      if (!gateway || !session.get()) return null;
      try {
        const snapshot = await gateway.read(resource, {
          negotiation: options.negotiation,
        });
        setNow(Date.now());
        setState((current) => applySnapshot(current, snapshot));
        return snapshot;
      } catch (reason) {
        fail(reason, options.silent);
        return null;
      }
    },
    [fail],
  );

  const send = (command: Command, then?: () => void) => {
    const route = commandRoute(command);
    if (command.type === "sign-out") void session.signOut();
    if (!gateway || route === "local") {
      applyLocal(command);
      then?.();
      return;
    }
    // Com backend, ações que só existem na demonstração não fazem nada.
    if (route === "demo-only") return;
    setError(null);
    setPendingCommands((count) => count + 1);
    inFlight.current += 1;
    // Fila: os comandos chegam ao servidor na ordem em que foram dados.
    queue.current = queue.current.then(async () => {
      try {
        const snapshot = await gateway.execute(command);
        setNow(Date.now());
        setState((current) => applySnapshot(current, snapshot));
        then?.();
      } catch (reason) {
        fail(reason);
        // Conflito: o estado do aparelho está velho; recarrega o do servidor.
        if (reason instanceof ApiError && reason.status === 409)
          await refresh("state", { silent: true });
      } finally {
        inFlight.current -= 1;
        setPendingCommands((count) => count - 1);
      }
    });
  };

  useEffect(() => {
    const tick = () => {
      const instant = Date.now();
      setNow(instant);
      setState((current) => transition(current, { type: "tick" }, instant));
    };
    const timer = setInterval(tick, 1000);
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active") tick();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);

  // Recupera o login guardado (só existe com um SessionStore persistente).
  useEffect(() => {
    let active = true;
    void session.restore().then((saved) => {
      if (active && saved)
        applyLocal({ type: "verify-email", email: saved.email });
    });
    return () => {
      active = false;
    };
  }, [applyLocal]);

  // Com backend: carrega o estado ao entrar e o atualiza periodicamente
  // (substituto simples do tempo real, enquanto não houver Realtime/push).
  const signedIn = state.session !== null;
  useEffect(() => {
    if (!gateway || !signedIn) return;
    void refresh("state");
    const every = services.config.data.pollMs;
    if (!every) return;
    const timer = setInterval(() => {
      if (polling.current || inFlight.current > 0) return;
      polling.current = true;
      void refresh("state", { silent: true }).finally(() => {
        polling.current = false;
      });
    }, every);
    return () => clearInterval(timer);
  }, [signedIn, refresh]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), ERROR_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [error]);

  return (
    <DemoContext.Provider
      value={{
        state,
        now,
        send,
        busy: pendingCommands > 0,
        error,
        clearError: () => setError(null),
        refresh,
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) throw new Error("DemoProvider ausente");
  return context;
}

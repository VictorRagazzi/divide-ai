import {
  type Candidate,
  type ChatMessage,
  type Command,
  type DemoState,
  type Intent,
  notHappenedReasons,
  type PostTrip,
  type Profile,
  type Proposal,
  type ProposalChoice,
  type ProposalPick,
  type Report,
  type Review,
  reportReasons,
  type TripRecord,
} from "../features/demo/domain.ts";
import { isPoint, type MapPoints } from "../features/maps/model.ts";
import type { EndpointName, EndpointSpec } from "./config.ts";
import { ApiError, type HttpClient, newIdempotencyKey } from "./http.ts";

// Ponte entre os comandos do app e o backend. Contrato completo (rotas, corpos
// e respostas) em documentos/Integracao_backend.md. Regras:
//  - o servidor decide; toda escrita devolve o estado atualizado (snapshot,
//    completo ou parcial) e o app só mostra confirmação depois dela;
//  - instantes trafegam em ISO-8601 UTC (aceita-se também milissegundos);
//  - nenhuma resposta é confiada: o snapshot passa por validação estrita.

// ---------------------------------------------------------------- roteamento

export type CommandRoute = "local" | "remote" | "demo-only";

// local: só interface/sessão, nunca vai ao servidor. demo-only: simula a outra
// pessoa ou o relógio; no modo api não existe (o servidor produz esses eventos).
export function commandRoute(command: Command): CommandRoute {
  switch (command.type) {
    case "tick":
    case "skip":
    case "review":
    case "reset":
    case "verify-email":
    case "sign-out":
      return "local";
    case "simulate-match":
    case "unavailable":
    case "simulate-their-review":
    case "end-trip":
      return "demo-only";
    case "pick":
      return command.who === "mine" ? "remote" : "demo-only";
    case "chat":
      return command.sender === "mine" ? "remote" : "demo-only";
    default:
      return "remote";
  }
}

const iso = (instant: number) => new Date(instant).toISOString();

export function intentToWire(intent: Intent) {
  return {
    departure: iso(intent.departure),
    timeZone: intent.timeZone,
    fixed: intent.fixed,
    passengers: intent.passengers,
    walkingLimit: intent.walkingLimit,
    origin: intent.origin,
    destination: intent.destination,
    ...(intent.points ? { points: intent.points } : {}),
  };
}

export type RemoteRequest = { endpoint: EndpointName; body: unknown };

// Comando → rota e corpo. null para comandos que não vão ao servidor.
export function toRequest(command: Command): RemoteRequest | null {
  if (commandRoute(command) !== "remote") return null;
  switch (command.type) {
    case "start":
      return {
        endpoint: "INTENT_SAVE",
        body: { intent: intentToWire(command.intent) },
      };
    case "cancel-search":
      return { endpoint: "INTENT_CANCEL", body: {} };
    case "save-profile":
      return { endpoint: "PROFILE_SAVE", body: { profile: command.profile } };
    case "request":
      return {
        endpoint: "REQUEST_SEND",
        body: {
          candidateId: command.id,
          expectedRevision: command.expectedRevision,
          ...(command.declineIncoming ? { declineIncoming: true } : {}),
        },
      };
    case "decline":
      return { endpoint: "REQUEST_DECLINE", body: { candidateId: command.id } };
    case "cancel":
      return { endpoint: "REQUEST_CANCEL", body: {} };
    case "pick":
      return {
        endpoint: "PROPOSAL_PICK",
        body: {
          negotiation: command.negotiation,
          expectedVersion: command.expectedVersion,
          choice: command.choice,
          ...(command.stop === undefined ? {} : { stop: command.stop }),
        },
      };
    case "chat":
      return {
        endpoint: "MESSAGE_SEND",
        body: { negotiation: command.negotiation, text: command.text },
      };
    case "cancel-negotiation":
      return {
        endpoint: "NEGOTIATION_END",
        body: { negotiation: command.negotiation },
      };
    case "trip-happened":
      return {
        endpoint: "TRIP_OUTCOME",
        body: {
          negotiation: command.negotiation,
          happened: command.happened,
          ...(command.reason ? { reason: command.reason } : {}),
        },
      };
    case "rate":
      return {
        endpoint: "REVIEW_SEND",
        body: {
          negotiation: command.negotiation,
          stars: command.stars,
          comment: command.comment.trim(),
        },
      };
    case "close-trip":
      return {
        endpoint: "TRIP_CLOSE",
        body: { negotiation: command.negotiation },
      };
    case "report":
      return {
        endpoint: "REPORT_SEND",
        body: {
          companionId: command.companion,
          reason: command.reason,
          details: command.details.trim(),
        },
      };
    case "block":
      return {
        endpoint: "BLOCK_ADD",
        body: { companionId: command.companion },
      };
    case "unblock":
      return {
        endpoint: "BLOCK_REMOVE",
        body: { companionId: command.companion },
      };
    default:
      return null;
  }
}

// ------------------------------------------------------------------ snapshot

// Parte do estado que o servidor controla. `session` fica sempre no aparelho.
export type Snapshot = Partial<Omit<DemoState, "session">>;

class SchemaError extends Error {}
const bad = (path: string): never => {
  throw new SchemaError(path);
};
type Obj = Record<string, unknown>;
const obj = (value: unknown, path: string): Obj =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Obj)
    : bad(path);
const str = (value: unknown, path: string, max = 500) =>
  typeof value === "string" && value.length <= max ? value : bad(path);
const num = (value: unknown, path: string) =>
  typeof value === "number" && Number.isFinite(value) ? value : bad(path);
const int = (value: unknown, path: string) =>
  typeof value === "number" && Number.isSafeInteger(value) ? value : bad(path);
const bool = (value: unknown, path: string) =>
  typeof value === "boolean" ? value : bad(path);
const instant = (value: unknown, path: string) => {
  const ms =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Date.parse(value)
        : Number.NaN;
  return Number.isFinite(ms) ? ms : bad(path);
};
const list = <T>(
  value: unknown,
  path: string,
  item: (entry: unknown, at: string) => T,
  max = 500,
): T[] =>
  Array.isArray(value) && value.length <= max
    ? value.map((entry, index) => item(entry, `${path}[${index}]`))
    : bad(path);
const nullable = <T>(
  value: unknown,
  path: string,
  read: (entry: unknown, at: string) => T,
): T | null =>
  value === null || value === undefined ? null : read(value, path);
const oneOf = <T extends string>(
  value: unknown,
  path: string,
  allowed: readonly T[],
): T =>
  typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : bad(path);

const readProfile = (value: unknown, path: string): Profile => {
  const o = obj(value, path);
  return {
    email: str(o.email, `${path}.email`, 254),
    name: str(o.name, `${path}.name`, 200),
    phone: str(o.phone ?? "", `${path}.phone`, 40),
    birth: str(o.birth, `${path}.birth`, 20),
    photo: bool(o.photo ?? false, `${path}.photo`),
  };
};
const readPoints = (value: unknown, path: string): MapPoints => {
  const o = obj(value, path);
  if (!isPoint(o.origin) || !isPoint(o.destination)) return bad(path);
  return { origin: o.origin, destination: o.destination };
};
const readIntent = (value: unknown, path: string): Intent => {
  const o = obj(value, path);
  return {
    departure: instant(o.departure, `${path}.departure`),
    timeZone: str(o.timeZone, `${path}.timeZone`, 64),
    fixed: bool(o.fixed, `${path}.fixed`),
    passengers: int(o.passengers, `${path}.passengers`),
    walkingLimit: num(o.walkingLimit, `${path}.walkingLimit`),
    origin: str(o.origin, `${path}.origin`),
    destination: str(o.destination, `${path}.destination`),
    ...(o.points ? { points: readPoints(o.points, `${path}.points`) } : {}),
  };
};
const readCandidate = (value: unknown, path: string): Candidate => {
  const o = obj(value, path);
  return {
    id: str(o.id, `${path}.id`, 100),
    name: str(o.name, `${path}.name`, 200),
    departure: instant(o.departure, `${path}.departure`),
    fixed: bool(o.fixed, `${path}.fixed`),
    passengers: int(o.passengers, `${path}.passengers`),
    walkingLimit: num(o.walkingLimit, `${path}.walkingLimit`),
    pickup: num(o.pickup, `${path}.pickup`),
    dropoff: num(o.dropoff, `${path}.dropoff`),
    companionPickup: num(o.companionPickup, `${path}.companionPickup`),
    companionDropoff: num(o.companionDropoff, `${path}.companionDropoff`),
    rating: str(o.rating, `${path}.rating`, 10),
    trips: int(o.trips, `${path}.trips`),
  };
};
const choices: readonly ProposalChoice[] = [
  "suggestion",
  "mine",
  "theirs",
  "stop",
];
const readPick = (value: unknown, path: string): ProposalPick => {
  const o = obj(value, path);
  return {
    choice: oneOf(o.choice, `${path}.choice`, choices),
    ...(o.stop === undefined ? {} : { stop: str(o.stop, `${path}.stop`) }),
  };
};
const readProposal = (value: unknown, path: string): Proposal => {
  const o = obj(value, path);
  const picks = obj(o.picks, `${path}.picks`);
  const walks = list(o.walks, `${path}.walks`, num, 4);
  if (walks.length !== 4) bad(`${path}.walks`);
  return {
    negotiation: int(o.negotiation, `${path}.negotiation`),
    version: int(o.version, `${path}.version`),
    picks: {
      mine: nullable(picks.mine, `${path}.picks.mine`, readPick),
      theirs: nullable(picks.theirs, `${path}.picks.theirs`, readPick),
    },
    pickup: str(o.pickup, `${path}.pickup`),
    dropoff: str(o.dropoff, `${path}.dropoff`),
    departure: instant(o.departure, `${path}.departure`),
    stops: list(o.stops, `${path}.stops`, (s, at) => str(s, at), 20),
    walks: walks as Proposal["walks"],
  };
};
const readMessage = (value: unknown, path: string): ChatMessage => {
  const o = obj(value, path);
  return {
    id: int(o.id, `${path}.id`),
    sender: oneOf(o.sender, `${path}.sender`, ["mine", "theirs"] as const),
    text: str(o.text, `${path}.text`, 2000),
    at: instant(o.at, `${path}.at`),
  };
};
const readReview = (value: unknown, path: string): Review => {
  const o = obj(value, path);
  return {
    stars: int(o.stars, `${path}.stars`),
    comment: str(o.comment ?? "", `${path}.comment`, 1000),
  };
};
const reasonIds = notHappenedReasons.map((item) => item.id);
const readPostTrip = (value: unknown, path: string): PostTrip => {
  const o = obj(value, path);
  return {
    negotiation: int(o.negotiation, `${path}.negotiation`),
    companion: str(o.companion, `${path}.companion`, 100),
    endedAt: instant(o.endedAt, `${path}.endedAt`),
    happened: nullable(o.happened, `${path}.happened`, bool),
    ...(o.reason
      ? { reason: oneOf(o.reason, `${path}.reason`, reasonIds) }
      : {}),
    mine: nullable(o.mine, `${path}.mine`, readReview),
    theirs: nullable(o.theirs, `${path}.theirs`, readReview),
  };
};
const readTrip = (value: unknown, path: string): TripRecord => {
  const o = obj(value, path);
  return {
    negotiation: int(o.negotiation, `${path}.negotiation`),
    companion: str(o.companion, `${path}.companion`, 100),
    name: str(o.name, `${path}.name`, 200),
    endedAt: instant(o.endedAt, `${path}.endedAt`),
    route: str(o.route, `${path}.route`),
    happened: bool(o.happened, `${path}.happened`),
    ...(o.reason
      ? { reason: oneOf(o.reason, `${path}.reason`, reasonIds) }
      : {}),
    mine: nullable(o.mine, `${path}.mine`, readReview),
    theirs: nullable(o.theirs, `${path}.theirs`, readReview),
  };
};
const reportReasonIds = reportReasons.map((item) => item.id);
const readReport = (value: unknown, path: string): Report => {
  const o = obj(value, path);
  return {
    companion: str(o.companion, `${path}.companion`, 100),
    reason: oneOf(o.reason, `${path}.reason`, reportReasonIds),
    details: str(o.details ?? "", `${path}.details`, 1000),
    at: instant(o.at, `${path}.at`),
  };
};
const readId = (value: unknown, path: string) => str(value, path, 100);

// Só as chaves presentes entram; chaves desconhecidas são ignoradas.
export function readSnapshot(raw: unknown): Snapshot {
  try {
    const o = obj(raw, "$");
    const snapshot: Snapshot = {};
    if ("profile" in o)
      snapshot.profile = nullable(o.profile, "profile", readProfile);
    if ("intent" in o)
      snapshot.intent = nullable(o.intent, "intent", readIntent);
    if ("candidates" in o)
      snapshot.candidates = list(o.candidates, "candidates", readCandidate);
    if ("skipped" in o) snapshot.skipped = list(o.skipped, "skipped", readId);
    if ("pending" in o)
      snapshot.pending = nullable(o.pending, "pending", readId);
    if ("incoming" in o)
      snapshot.incoming = nullable(o.incoming, "incoming", readId);
    if ("matched" in o)
      snapshot.matched = nullable(o.matched, "matched", readId);
    if ("revision" in o) snapshot.revision = int(o.revision, "revision");
    if ("message" in o) snapshot.message = str(o.message ?? "", "message", 300);
    if ("proposal" in o)
      snapshot.proposal = nullable(o.proposal, "proposal", readProposal);
    if ("messages" in o)
      snapshot.messages = list(o.messages, "messages", readMessage);
    if ("postTrip" in o)
      snapshot.postTrip = nullable(o.postTrip, "postTrip", readPostTrip);
    if ("history" in o) snapshot.history = list(o.history, "history", readTrip);
    if ("blocked" in o) snapshot.blocked = list(o.blocked, "blocked", readId);
    if ("reports" in o)
      snapshot.reports = list(o.reports, "reports", readReport);
    return snapshot;
  } catch (error) {
    if (error instanceof SchemaError)
      throw new ApiError(
        502,
        "Resposta inesperada do servidor. Tente novamente.",
        `snapshot: ${error.message}`,
      );
    throw error;
  }
}

export function applySnapshot(state: DemoState, snapshot: Snapshot): DemoState {
  return { ...state, ...snapshot, session: state.session };
}

// ------------------------------------------------------------------- gateway

export type ReadResource = "state" | "candidates" | "messages" | "history";
const readEndpoint: Record<ReadResource, EndpointName> = {
  state: "STATE_GET",
  candidates: "CANDIDATES_GET",
  messages: "MESSAGES_GET",
  history: "HISTORY_GET",
};

export const NOT_CONFIGURED_MESSAGE =
  "Este recurso ainda não está configurado no servidor.";

export function createGateway({
  http,
  endpoints,
  newKey = newIdempotencyKey,
}: {
  http: HttpClient;
  endpoints: Partial<Record<EndpointName, EndpointSpec>>;
  newKey?: () => string;
}) {
  const spec = (name: EndpointName) =>
    endpoints[name] ??
    (() => {
      throw new ApiError(501, NOT_CONFIGURED_MESSAGE, `sem endpoint ${name}`);
    })();
  return {
    /** Lê o estado. Sem o endpoint específico, cai no estado completo. */
    async read(
      resource: ReadResource = "state",
      params: { negotiation?: number } = {},
      signal?: AbortSignal,
    ): Promise<Snapshot> {
      const name = endpoints[readEndpoint[resource]]
        ? readEndpoint[resource]
        : "STATE_GET";
      const target = spec(name);
      const query = { negotiation: params.negotiation };
      const raw = await http.request(
        target,
        target.method === "GET"
          ? { query, signal }
          : { body: { resource, ...query }, signal },
      );
      return readSnapshot(raw);
    },
    /** Envia um comando remoto; devolve o estado que o servidor confirmou. */
    async execute(command: Command, key: string = newKey()): Promise<Snapshot> {
      const request = toRequest(command);
      if (!request)
        throw new ApiError(
          400,
          "Esta ação não é enviada ao servidor.",
          command.type,
        );
      const raw = await http.request(spec(request.endpoint), {
        body: request.body,
        idempotencyKey: key,
      });
      return readSnapshot(raw);
    },
  };
}

export type Gateway = ReturnType<typeof createGateway>;

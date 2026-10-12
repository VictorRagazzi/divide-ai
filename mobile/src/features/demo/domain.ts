import { isPoint, type MapPoints } from "../maps/model.ts";

export type Intent = {
  departure: number;
  timeZone: string;
  fixed: boolean;
  passengers: number;
  walkingLimit: number;
  origin: string;
  destination: string;
  points?: MapPoints;
};

// Discovery projection deliberately contains no private address, photo or coordinates.
export type Candidate = {
  id: string;
  name: string;
  departure: number;
  fixed: boolean;
  passengers: number;
  walkingLimit: number;
  pickup: number;
  dropoff: number;
  companionPickup: number;
  companionDropoff: number;
  rating: string;
  trips: number;
};

export type ProposalChoice = "suggestion" | "mine" | "theirs" | "stop";
export type Proposal = {
  negotiation: number;
  version: number;
  choice: ProposalChoice;
  pickup: string;
  dropoff: string;
  departure: number;
  stops: string[];
  walks: [number, number, number, number];
  mine: boolean;
  theirs: boolean;
};
export type ChatMessage = {
  id: number;
  sender: "mine" | "theirs";
  text: string;
  at: number;
};

export type DemoState = {
  intent: Intent | null;
  candidates: Candidate[];
  skipped: string[];
  pending: string | null;
  matched: string | null;
  revision: number;
  message: string;
  proposal: Proposal | null;
  messages: ChatMessage[];
};

export const initialState: DemoState = {
  intent: null,
  candidates: [],
  skipped: [],
  pending: null,
  matched: null,
  revision: 0,
  message: "",
  proposal: null,
  messages: [],
};

export function commonWindow(
  a: Pick<Intent, "departure" | "fixed">,
  b: Pick<Intent, "departure" | "fixed">,
) {
  const marginA = a.fixed ? 0 : 15 * 60_000;
  const marginB = b.fixed ? 0 : 15 * 60_000;
  const start = Math.max(a.departure - marginA, b.departure - marginB);
  const end = Math.min(a.departure + marginA, b.departure + marginB);
  return start <= end ? { start, end } : null;
}

export function eligible(intent: Intent, candidate: Candidate, now: number) {
  return (
    now < Math.min(intent.departure, candidate.departure) &&
    intent.passengers + candidate.passengers <= 3 &&
    candidate.pickup <= intent.walkingLimit &&
    candidate.dropoff <= intent.walkingLimit &&
    candidate.companionPickup <= candidate.walkingLimit &&
    candidate.companionDropoff <= candidate.walkingLimit &&
    commonWindow(intent, candidate) !== null
  );
}

export function expire(state: DemoState, now: number): DemoState {
  if (!state.intent || state.matched) return state;
  const pending = state.candidates.find((c) => c.id === state.pending);
  if (now >= state.intent.departure || (pending && now >= pending.departure)) {
    if (!state.pending) return state;
    return {
      ...state,
      pending: null,
      revision: state.revision + 1,
      message:
        "A solicitação demo venceu no horário original. Nenhuma viagem foi confirmada.",
    };
  }
  return state;
}

export type Command =
  | { type: "start"; intent: Intent; candidates: Candidate[] }
  | { type: "tick" }
  | { type: "skip"; id: string }
  | { type: "review" }
  | { type: "request"; id: string; expectedRevision: number }
  | { type: "cancel" }
  | { type: "simulate-match" }
  | { type: "unavailable"; id: string }
  | { type: "reset" }
  | {
      type: "choose-proposal";
      choice: ProposalChoice;
      negotiation: number;
      expectedVersion: number;
    }
  | {
      type: "confirm-proposal";
      who: "mine" | "theirs";
      negotiation: number;
      expectedVersion: number;
    }
  | {
      type: "chat";
      text: string;
      sender: "mine" | "theirs";
      negotiation: number;
    }
  | { type: "cancel-negotiation"; negotiation: number };

export function transition(
  previous: DemoState,
  command: Command,
  now: number,
): DemoState {
  const state = expire(previous, now);
  if (command.type === "reset")
    return { ...initialState, revision: state.revision + 1 };
  if (command.type === "start" && state.matched) return state;
  if (command.type === "start")
    return {
      ...initialState,
      intent: command.intent,
      candidates: command.candidates,
      revision: previous.revision + 1,
    };
  if (command.type === "tick") return state;
  if (command.type === "cancel-negotiation") {
    if (!state.proposal || command.negotiation !== state.proposal.negotiation)
      return state;
    return {
      ...initialState,
      revision: state.revision + 1,
      message:
        "Sua participação foi cancelada na demonstração. Nenhum aviso real foi enviado.",
    };
  }
  if (command.type === "chat") {
    if (
      !state.matched ||
      !state.proposal ||
      command.negotiation !== state.proposal.negotiation ||
      !command.text.trim() ||
      command.text.trim().length > 1000
    )
      return state;
    return {
      ...state,
      messages: [
        ...state.messages,
        {
          id: state.messages.length + 1,
          sender: command.sender,
          text: command.text.trim(),
          at: now,
        },
      ],
    };
  }
  if (
    command.type === "choose-proposal" ||
    command.type === "confirm-proposal"
  ) {
    const proposal = state.proposal;
    const companion = state.candidates.find((c) => c.id === state.matched);
    if (
      !state.intent ||
      !companion ||
      !proposal ||
      command.negotiation !== proposal.negotiation ||
      command.expectedVersion !== proposal.version
    )
      return {
        ...state,
        message: "A proposta mudou. Confira a versão atual antes de continuar.",
      };
    if (command.type === "choose-proposal") {
      if (proposal.choice === command.choice) return state;
      const next = makeProposal(
        state.intent,
        companion,
        command.choice,
        proposal.negotiation,
        proposal.version + 1,
      );
      if (!validProposal(next, state.intent, companion))
        return {
          ...state,
          message:
            "Esta opção ultrapassa um limite de caminhada. Escolha outro trajeto.",
        };
      return {
        ...state,
        proposal: next,
        message:
          "Os detalhes mudaram. Vocês dois precisam confirmar esta nova versão.",
      };
    }
    if (!validProposal(proposal, state.intent, companion)) return state;
    return {
      ...state,
      proposal: { ...proposal, [command.who]: true },
      message: "",
    };
  }
  if (command.type === "unavailable") {
    if (state.matched) return state;
    const affected = state.pending === command.id;
    return {
      ...state,
      candidates: state.candidates.filter((c) => c.id !== command.id),
      pending: affected ? null : state.pending,
      revision: affected ? state.revision + 1 : state.revision,
      message: affected
        ? "A companhia demo ficou indisponível. Continue vendo sugestões."
        : state.message,
    };
  }
  if (command.type === "review") return { ...state, skipped: [] };
  if (state.matched)
    return {
      ...state,
      message:
        "O aceite mútuo demo já ocorreu. A negociação é exclusiva; a troca não foi realizada.",
    };
  if (command.type === "skip")
    return { ...state, skipped: [...state.skipped, command.id] };
  if (command.type === "cancel")
    return {
      ...state,
      pending: null,
      revision: state.revision + 1,
      message: "Solicitação demo cancelada. Você pode continuar buscando.",
    };
  if (command.type === "simulate-match") {
    const candidate = state.candidates.find((c) => c.id === state.pending);
    if (!state.intent || !candidate || !eligible(state.intent, candidate, now))
      return state;
    return {
      ...state,
      matched: state.pending,
      pending: null,
      revision: state.revision + 1,
      message: "Aceite mútuo simulado. A viagem ainda não está combinada.",
      proposal: makeProposal(
        state.intent,
        candidate,
        "suggestion",
        state.revision + 1,
        1,
      ),
      messages: [
        {
          id: 1,
          sender: "theirs",
          text: "Oi! Podemos combinar o ponto de encontro por aqui?",
          at: now,
        },
      ],
    };
  }
  if (command.type !== "request") return state;
  const candidate = state.candidates.find((c) => c.id === command.id);
  if (
    command.expectedRevision !== state.revision ||
    !state.intent ||
    !candidate ||
    !eligible(state.intent, candidate, now)
  ) {
    return {
      ...state,
      message:
        "Não foi possível aceitar esta companhia demo. A solicitação anterior foi preservada se ainda válida. Reveja as sugestões.",
    };
  }
  const old = state.candidates.find((c) => c.id === state.pending);
  return {
    ...state,
    pending: candidate.id,
    revision: state.revision + 1,
    message:
      old && old.id !== candidate.id
        ? `A solicitação demo com ${old.name} foi substituída pela de ${candidate.name}. A viagem não está confirmada.`
        : `Aguardando ${candidate.name} na demonstração. A viagem não está confirmada.`,
  };
}

export type SearchFields = {
  origin: string;
  destination: string;
  date: string;
  time: string;
  passengers: string;
  walkingLimit: string;
  fixed: boolean;
};

export function parseSearch(
  fields: SearchFields,
  now: number,
  points?: MapPoints,
): { intent?: Intent; errors: Partial<Record<keyof SearchFields, string>> } {
  const errors: Partial<Record<keyof SearchFields, string>> = {};
  if (!fields.origin.trim()) errors.origin = "Escolha uma origem.";
  if (!fields.destination.trim()) errors.destination = "Escolha um destino.";
  if (points && (!isPoint(points.origin) || !isPoint(points.destination)))
    errors.destination = "Escolha dois locais válidos no mapa.";
  if (
    points
      ? points.origin.latitude === points.destination.latitude &&
        points.origin.longitude === points.destination.longitude
      : fields.origin === fields.destination
  )
    errors.destination = "Escolha um destino diferente da origem.";
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fields.date);
  const time = /^(\d{2}):(\d{2})$/.exec(fields.time);
  const year = Number(date?.[1]);
  const month = Number(date?.[2]);
  const day = Number(date?.[3]);
  const hour = Number(time?.[1]);
  const minute = Number(time?.[2]);
  const instant = new Date(year, month - 1, day, hour, minute);
  if (
    !date ||
    year < 2000 ||
    instant.getFullYear() !== year ||
    instant.getMonth() !== month - 1 ||
    instant.getDate() !== day
  )
    errors.date = "Use uma data válida no formato AAAA-MM-DD.";
  if (
    !time ||
    hour > 23 ||
    minute > 59 ||
    instant.getHours() !== hour ||
    instant.getMinutes() !== minute
  )
    errors.time = "Use um horário válido no formato HH:MM.";
  if (!errors.date && !errors.time && instant.getTime() <= now)
    errors.time = "Escolha um horário futuro. A busca vence nesse horário.";
  const passengers = Number(fields.passengers);
  const walkingLimit = Number(fields.walkingLimit);
  if (!Number.isInteger(passengers) || passengers < 1 || passengers > 2)
    errors.passengers =
      "Escolha 1 ou 2 pessoas, incluindo você. A dupla comporta até 3.";
  if (
    !fields.walkingLimit.trim() ||
    !Number.isInteger(walkingLimit) ||
    walkingLimit < 0
  )
    errors.walkingLimit =
      "Informe um limite inteiro em metros, a partir de zero.";
  if (Object.keys(errors).length) return { errors };
  return {
    errors,
    intent: {
      origin: fields.origin,
      destination: fields.destination,
      ...(points ? { points } : {}),
      departure: instant.getTime(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      fixed: fields.fixed,
      passengers,
      walkingLimit,
    },
  };
}

export function demoCandidates(intent: Intent): Candidate[] {
  return [
    {
      id: "evandro",
      name: "Evandro",
      departure: intent.departure,
      fixed: false,
      passengers: 1,
      walkingLimit: 400,
      pickup: 300,
      dropoff: 200,
      companionPickup: 250,
      companionDropoff: 300,
      rating: "4,8",
      trips: 20,
    },
    {
      id: "bruno",
      name: "Bruno",
      departure: intent.departure + 15 * 60_000,
      fixed: true,
      passengers: 1,
      walkingLimit: 400,
      pickup: 200,
      dropoff: 350,
      companionPickup: 200,
      companionDropoff: 200,
      rating: "4,9",
      trips: 8,
    },
    {
      id: "camila",
      name: "Camila",
      departure: intent.departure + 30 * 60_000,
      fixed: false,
      passengers: 2,
      walkingLimit: 400,
      pickup: 150,
      dropoff: 250,
      companionPickup: 300,
      companionDropoff: 250,
      rating: "4,7",
      trips: 16,
    },
  ];
}

export function formatInstant(instant: number, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone,
  }).format(instant);
}

// Simulated companions travel "near" the places the user actually chose, so
// fixture labels are derived from the intent instead of unrelated fixed names.
const GENERIC_PLACE = /escolhid[ao] no mapa|^minha localização/i;

export function placeLead(label: string) {
  return label.split(" · ")[0]?.trim() || label.trim();
}

// Points picked on the map or by GPS have generic labels; refer to them by role.
function placeName(label: string, role: "origin" | "destination") {
  if (GENERIC_PLACE.test(label))
    return role === "origin" ? "sua partida" : "seu destino";
  return placeLead(label);
}

const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function nearPlace(label: string, role: "origin" | "destination") {
  if (GENERIC_PLACE.test(label))
    return role === "origin" ? "da sua partida" : "do seu destino";
  return `de ${placeLead(label)}`;
}

export function companionPoints(intent: Intent) {
  return {
    pickup: `Perto ${nearPlace(intent.origin, "origin")} · ponto da companhia`,
    dropoff: `Perto ${nearPlace(intent.destination, "destination")} · ponto da companhia`,
  };
}

// Every option is a known local fixture, with its own four walking distances.
// Choosing a route changes the points; the shared departure remains compatible.
export function makeProposal(
  intent: Intent,
  companion: Candidate,
  choice: ProposalChoice,
  negotiation: number,
  version: number,
): Proposal {
  const window = commonWindow(intent, companion);
  const walks: Proposal["walks"] =
    choice === "mine"
      ? [0, 0, 380, 360]
      : choice === "theirs"
        ? [380, 360, 0, 0]
        : choice === "stop"
          ? [100, 200, 100, 300]
          : [
              companion.pickup,
              companion.dropoff,
              companion.companionPickup,
              companion.companionDropoff,
            ];
  return {
    negotiation,
    version,
    choice,
    pickup:
      choice === "mine"
        ? intent.origin
        : choice === "theirs"
          ? companionPoints(intent).pickup
          : `${cap(placeName(intent.origin, "origin"))} · ponto de encontro sugerido`,
    dropoff:
      choice === "mine"
        ? intent.destination
        : choice === "theirs"
          ? companionPoints(intent).dropoff
          : `${cap(placeName(intent.destination, "destination"))} · desembarque sugerido`,
    departure: window
      ? Math.max(window.start, Math.min(intent.departure, window.end))
      : intent.departure,
    stops:
      choice === "stop"
        ? [`Embarque da companhia · ${companionPoints(intent).pickup}`]
        : [],
    walks,
    mine: false,
    theirs: false,
  };
}

export function validProposal(
  proposal: Proposal,
  intent: Intent,
  companion: Candidate,
) {
  const window = commonWindow(intent, companion);
  const limits = [
    intent.walkingLimit,
    intent.walkingLimit,
    companion.walkingLimit,
    companion.walkingLimit,
  ];
  return Boolean(
    window &&
      Number.isFinite(proposal.departure) &&
      proposal.departure >= window.start &&
      proposal.departure <= window.end &&
      intent.passengers + companion.passengers <= 3 &&
      proposal.pickup.trim() &&
      proposal.dropoff.trim() &&
      proposal.walks.length === 4 &&
      proposal.walks.every(
        (distance, i) =>
          Number.isFinite(distance) && distance >= 0 && distance <= limits[i],
      ),
  );
}

export function clockTime(instant: number, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(instant);
}

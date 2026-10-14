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
// Escolha de uma pessoa. Para "stop", `stop` é a parada: só há acordo se for a mesma.
export type ProposalPick = { choice: ProposalChoice; stop?: string };
export type Proposal = {
  negotiation: number;
  version: number;
  // Escolha de cada lado; o acordo é derivado (ver isAgreed), nunca guardado.
  picks: { mine: ProposalPick | null; theirs: ProposalPick | null };
  // Conteúdo da escolha de "mine" (ou a sugestão do app enquanto não escolheu).
  pickup: string;
  dropoff: string;
  departure: number;
  stops: string[];
  walks: [number, number, number, number];
};
export type ChatMessage = {
  id: number;
  sender: "mine" | "theirs";
  text: string;
  at: number;
};

// Avaliação de uma pessoa: estrelas de 1 a 5; texto obrigatório abaixo de 3.
export type Review = { stars: number; comment: string };

export type NotHappenedReason =
  | "no-show"
  | "could-not-go"
  | "agreed-cancel"
  | "no-car"
  | "other";
export const notHappenedReasons: { id: NotHappenedReason; label: string }[] = [
  { id: "no-show", label: "A outra pessoa não apareceu" },
  { id: "could-not-go", label: "Eu não pude ir" },
  { id: "agreed-cancel", label: "Combinamos cancelar" },
  { id: "no-car", label: "Ninguém pediu o carro" },
  { id: "other", label: "Outro motivo" },
];

export type ReportReason = "behavior" | "unsafe" | "fake" | "payment" | "other";
export const reportReasons: { id: ReportReason; label: string }[] = [
  { id: "behavior", label: "Comportamento inadequado" },
  { id: "unsafe", label: "Me senti inseguro(a)" },
  { id: "fake", label: "Perfil falso ou dados enganosos" },
  { id: "payment", label: "Pressão por pagamento ou dados pessoais" },
  { id: "other", label: "Outro motivo" },
];

// Depois da viagem combinada: a viagem "acabou" (demo), a pessoa conta se
// aconteceu e, se aconteceu, avalia. `theirs` é a avaliação simulada da outra.
export type PostTrip = {
  negotiation: number;
  companion: string;
  endedAt: number;
  happened: boolean | null;
  reason?: NotHappenedReason;
  mine: Review | null;
  theirs: Review | null;
};

export type TripRecord = {
  negotiation: number;
  companion: string;
  name: string;
  endedAt: number;
  route: string;
  happened: boolean;
  reason?: NotHappenedReason;
  mine: Review | null;
  theirs: Review | null;
};

export type Report = {
  companion: string;
  reason: ReportReason;
  details: string;
  at: number;
};

export type Profile = {
  email: string;
  name: string;
  phone: string;
  birth: string;
  photo: boolean;
};

export type DemoState = {
  session: string | null;
  profile: Profile | null;
  intent: Intent | null;
  candidates: Candidate[];
  skipped: string[];
  pending: string | null;
  /** Quem pediu para viajar comigo e ainda espera resposta. */
  incoming: string | null;
  matched: string | null;
  revision: number;
  message: string;
  proposal: Proposal | null;
  messages: ChatMessage[];
  postTrip: PostTrip | null;
  history: TripRecord[];
  blocked: string[];
  reports: Report[];
};

export const initialState: DemoState = {
  session: null,
  profile: null,
  intent: null,
  candidates: [],
  skipped: [],
  pending: null,
  incoming: null,
  matched: null,
  revision: 0,
  message: "",
  proposal: null,
  messages: [],
  postTrip: null,
  history: [],
  blocked: [],
  reports: [],
};

// O que sobrevive ao fim de uma busca/negociação: conta, histórico e bloqueios.
const persist = (state: DemoState) => ({
  session: state.session,
  profile: state.profile,
  history: state.history,
  blocked: state.blocked,
  reports: state.reports,
});

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
  | {
      type: "request";
      id: string;
      expectedRevision: number;
      /** Recusa antes quem pediu a mim (escolhido no aviso de troca). */
      declineIncoming?: boolean;
    }
  | { type: "decline"; id: string }
  | { type: "cancel" }
  | { type: "cancel-search" }
  | { type: "simulate-match" }
  | { type: "unavailable"; id: string }
  | { type: "reset" }
  | {
      type: "pick";
      who: "mine" | "theirs";
      choice: ProposalChoice;
      stop?: string;
      negotiation: number;
      expectedVersion: number;
    }
  | {
      type: "chat";
      text: string;
      sender: "mine" | "theirs";
      negotiation: number;
    }
  | { type: "cancel-negotiation"; negotiation: number }
  | { type: "verify-email"; email: string }
  | { type: "save-profile"; profile: Profile }
  | { type: "sign-out" }
  | { type: "end-trip"; negotiation: number }
  | {
      type: "trip-happened";
      negotiation: number;
      happened: boolean;
      reason?: NotHappenedReason;
    }
  | {
      type: "rate";
      negotiation: number;
      stars: number;
      comment: string;
    }
  | { type: "simulate-their-review"; negotiation: number }
  | { type: "close-trip"; negotiation: number }
  | {
      type: "report";
      companion: string;
      reason: ReportReason;
      details: string;
    }
  | { type: "block"; companion: string }
  | { type: "unblock"; companion: string };

export const MAX_REVIEW_TEXT = 500;
export const MAX_REPORT_TEXT = 1000;

// Mensagem de erro ou null. Abaixo de 3 estrelas o texto é obrigatório.
export function reviewError(stars: number, comment: string) {
  if (!Number.isInteger(stars) || stars < 1 || stars > 5)
    return "Escolha de 1 a 5 estrelas.";
  const text = comment.trim();
  if (text.length > MAX_REVIEW_TEXT)
    return `Use até ${MAX_REVIEW_TEXT} caracteres.`;
  if (stars < 3 && !text)
    return "Conte o que aconteceu: o texto é obrigatório para notas abaixo de 3.";
  return null;
}

export function reportError(reason: ReportReason | null, details: string) {
  if (!reason || !reportReasons.some((item) => item.id === reason))
    return "Escolha um motivo.";
  const text = details.trim();
  if (text.length > MAX_REPORT_TEXT)
    return `Use até ${MAX_REPORT_TEXT} caracteres.`;
  if (reason === "other" && !text) return "Descreva o que aconteceu.";
  return null;
}

// Reciprocidade: a avaliação recebida só aparece depois de a pessoa avaliar.
export function receivedState(trip: {
  mine: Review | null;
  theirs: Review | null;
}) {
  if (!trip.mine) return trip.theirs ? ("locked" as const) : ("none" as const);
  return trip.theirs ? ("visible" as const) : ("waiting" as const);
}

// Média das avaliações já liberadas; sem nenhuma, a pessoa aparece sem nota.
export function ownRating(history: TripRecord[]) {
  const visible = history.filter(
    (trip) => trip.happened && receivedState(trip) === "visible",
  );
  if (!visible.length) return null;
  const total = visible.reduce(
    (sum, trip) => sum + (trip.theirs?.stars ?? 0),
    0,
  );
  return { average: total / visible.length, count: visible.length };
}

// Para onde "retomar" leva, conforme o ponto em que o fluxo está.
export function stageHref(state: DemoState) {
  const post = state.postTrip;
  if (post) {
    if (post.happened === null) return "/lembrete" as const;
    if (post.happened === false) return "/nao-realizada" as const;
    return post.mine ? ("/avaliacao-enviada" as const) : ("/avaliar" as const);
  }
  if (isAgreed(state.proposal)) return "/viagem" as const;
  if (state.matched) return "/proposta" as const;
  if (state.pending) return "/espera" as const;
  return "/busca" as const;
}

export function transition(
  previous: DemoState,
  command: Command,
  now: number,
): DemoState {
  const state = expire(previous, now);
  if (command.type === "reset")
    return {
      ...initialState,
      session: state.session,
      profile: state.profile,
      revision: state.revision + 1,
    };
  if (command.type === "sign-out")
    return { ...initialState, revision: state.revision + 1 };
  if (command.type === "verify-email") {
    if (emailError(command.email)) return state;
    return { ...state, session: command.email.trim().toLowerCase() };
  }
  if (command.type === "save-profile") {
    if (!state.session || command.profile.email !== state.session) return state;
    return { ...state, profile: command.profile };
  }
  if (command.type === "start" && state.matched) return state;
  if (command.type === "start")
    return {
      ...initialState,
      ...persist(state),
      intent: command.intent,
      candidates: command.candidates.filter(
        (c) => !state.blocked.includes(c.id),
      ),
      revision: previous.revision + 1,
    };
  // Cancelar a busca: sem negociação em andamento, volta ao início mantendo
  // conta, histórico e bloqueios (o servidor faz o mesmo e confirma).
  if (command.type === "cancel-search")
    return state.matched
      ? state
      : {
          ...initialState,
          ...persist(state),
          revision: previous.revision + 1,
        };
  if (command.type === "tick") return state;
  if (command.type === "end-trip") {
    const proposal = state.proposal;
    if (
      state.postTrip ||
      !state.matched ||
      !proposal ||
      !isAgreed(proposal) ||
      command.negotiation !== proposal.negotiation
    )
      return state;
    return {
      ...state,
      postTrip: {
        negotiation: proposal.negotiation,
        companion: state.matched,
        endedAt: now,
        happened: null,
        mine: null,
        theirs: null,
      },
      message: "",
    };
  }
  if (
    command.type === "trip-happened" ||
    command.type === "rate" ||
    command.type === "simulate-their-review" ||
    command.type === "close-trip"
  ) {
    const post = state.postTrip;
    if (!post || command.negotiation !== post.negotiation) return state;
    if (command.type === "trip-happened") {
      if (post.happened !== null) return state;
      if (
        !command.happened &&
        !notHappenedReasons.some((item) => item.id === command.reason)
      )
        return state;
      return {
        ...state,
        postTrip: {
          ...post,
          happened: command.happened,
          ...(command.happened ? {} : { reason: command.reason }),
        },
      };
    }
    if (command.type === "rate") {
      if (post.happened !== true || post.mine) return state;
      if (reviewError(command.stars, command.comment))
        return {
          ...state,
          message: reviewError(command.stars, command.comment) ?? "",
        };
      return {
        ...state,
        message: "",
        postTrip: {
          ...post,
          mine: { stars: command.stars, comment: command.comment.trim() },
        },
      };
    }
    if (command.type === "simulate-their-review") {
      if (post.happened !== true || post.theirs) return state;
      return {
        ...state,
        postTrip: { ...post, theirs: { stars: 4, comment: "" } },
      };
    }
    // close-trip: só depois de responder se a viagem aconteceu.
    if (post.happened === null) return state;
    const companion = state.candidates.find((c) => c.id === post.companion);
    const proposal = state.proposal;
    const record: TripRecord = {
      negotiation: post.negotiation,
      companion: post.companion,
      name: companion?.name ?? "Companhia",
      endedAt: post.endedAt,
      route: proposal
        ? `${placeLead(proposal.pickup)} → ${placeLead(proposal.dropoff)}`
        : "",
      happened: post.happened,
      ...(post.reason ? { reason: post.reason } : {}),
      mine: post.mine,
      theirs: post.theirs,
    };
    return {
      ...initialState,
      ...persist(state),
      history: [record, ...state.history],
      revision: state.revision + 1,
    };
  }
  if (command.type === "report") {
    if (!command.companion || reportError(command.reason, command.details))
      return state;
    return {
      ...state,
      reports: [
        ...state.reports,
        {
          companion: command.companion,
          reason: command.reason,
          details: command.details.trim(),
          at: now,
        },
      ],
    };
  }
  if (command.type === "block") {
    if (!command.companion || state.blocked.includes(command.companion))
      return state;
    const blocked = [...state.blocked, command.companion];
    const negotiating = state.matched === command.companion && !state.postTrip;
    if (negotiating)
      return {
        ...initialState,
        ...persist(state),
        blocked,
        revision: state.revision + 1,
        message:
          "Pessoa bloqueada. Sua participação nessa viagem foi encerrada na demonstração.",
      };
    const affected = state.pending === command.companion;
    return {
      ...state,
      blocked,
      candidates: state.postTrip
        ? state.candidates
        : state.candidates.filter((c) => c.id !== command.companion),
      skipped: state.skipped.filter((id) => id !== command.companion),
      pending: affected ? null : state.pending,
      revision: affected ? state.revision + 1 : state.revision,
    };
  }
  if (command.type === "unblock") {
    if (!state.blocked.includes(command.companion)) return state;
    return {
      ...state,
      blocked: state.blocked.filter((id) => id !== command.companion),
    };
  }
  if (command.type === "cancel-negotiation") {
    if (
      state.postTrip ||
      !state.proposal ||
      command.negotiation !== state.proposal.negotiation
    )
      return state;
    return {
      ...initialState,
      ...persist(state),
      revision: state.revision + 1,
      message:
        "Sua participação foi cancelada na demonstração. Nenhum aviso real foi enviado.",
    };
  }
  if (command.type === "chat") {
    if (
      state.postTrip ||
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
  if (command.type === "pick") {
    const proposal = state.proposal;
    const companion = state.candidates.find((c) => c.id === state.matched);
    if (state.postTrip) return state;
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
    const pick: ProposalPick = { choice: command.choice };
    if (command.choice === "stop")
      pick.stop = command.stop ?? stopOptions(state.intent)[0];
    const content = makeProposal(
      state.intent,
      companion,
      pick.choice,
      proposal.negotiation,
      proposal.version + 1,
      pick.stop,
    );
    if (!validProposal(content, state.intent, companion))
      return {
        ...state,
        message:
          "Esta opção ultrapassa um limite de caminhada. Escolha outro trajeto.",
      };
    if (samePick(proposal.picks[command.who], pick)) return state;
    const picks = { ...proposal.picks, [command.who]: pick };
    const other = picks[command.who === "mine" ? "theirs" : "mine"];
    const next: Proposal =
      command.who === "mine"
        ? { ...content, picks }
        : { ...proposal, version: content.version, picks };
    return {
      ...state,
      proposal: next,
      message: samePick(picks.mine, picks.theirs)
        ? "Vocês escolheram a mesma opção. Viagem combinada."
        : other
          ? "Vocês escolheram opções diferentes. Combinem no chat ou escolham a mesma."
          : "",
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
  if (command.type === "decline")
    return state.incoming === command.id
      ? {
          ...state,
          incoming: null,
          revision: state.revision + 1,
          message: "Solicitação recusada.",
        }
      : state;
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
    incoming: command.declineIncoming ? null : state.incoming,
    revision: state.revision + 1,
    message:
      old && old.id !== candidate.id
        ? `A solicitação demo com ${old.name} foi substituída pela de ${candidate.name}. A viagem não está confirmada.`
        : `Aguardando ${candidate.name} na demonstração. A viagem não está confirmada.`,
  };
}

// Entrada por e-mail (OTP). Na demo nenhum e-mail é enviado: o código aparece
// na própria tela. Validade e reenvio seguem as decisões confirmadas.
export const OTP_LENGTH = 6;
export const OTP_VALID_MS = 10 * 60_000;
export const OTP_RESEND_MS = 60_000;
export const DEMO_OTP = "123456";

export function emailError(value: string) {
  const email = value.trim();
  if (!email) return "Informe seu e-mail.";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return "Use um e-mail válido, como nome@exemplo.com.";
  return null;
}

export function otpStatus(sentAt: number, now: number) {
  return {
    expired: now - sentAt >= OTP_VALID_MS,
    resendIn: Math.min(
      OTP_RESEND_MS / 1000,
      Math.max(0, Math.ceil((sentAt + OTP_RESEND_MS - now) / 1000)),
    ),
  };
}

// Conferência feita no aparelho antes de perguntar ao servidor: tamanho e prazo.
export function otpFormatError(code: string, sentAt: number, now: number) {
  if (otpStatus(sentAt, now).expired)
    return "O código expirou. Peça um novo código.";
  if (code.replace(/\D/g, "").length !== OTP_LENGTH)
    return `Digite os ${OTP_LENGTH} números do código.`;
  return null;
}

// Demonstração: além do formato, o código tem de ser DEMO_OTP.
export function otpError(code: string, sentAt: number, now: number) {
  const format = otpFormatError(code, sentAt, now);
  if (format) return format;
  if (code.replace(/\D/g, "") !== DEMO_OTP)
    return "Código incorreto. Confira e tente de novo.";
  return null;
}

export type ProfileFields = {
  name: string;
  phone: string;
  day: string;
  month: string;
  year: string;
};

// Telefone e foto são opcionais: a necessidade deles ainda é decisão pendente.
// Sem idade mínima por enquanto (também pendente): só data real e não futura.
export function parseProfile(
  fields: ProfileFields & { email: string; photo: boolean },
  now: number,
): {
  profile?: Profile;
  errors: Partial<Record<"name" | "phone" | "birth", string>>;
} {
  const errors: Partial<Record<"name" | "phone" | "birth", string>> = {};
  const name = fields.name.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 60)
    errors.name = "Informe como você quer ser chamado (2 a 60 letras).";
  const phone = fields.phone.replace(/\D/g, "");
  if (phone && (![10, 11].includes(phone.length) || phone.startsWith("0")))
    errors.phone = "Informe DDD e número, só com dígitos.";
  const day = Number(fields.day);
  const month = Number(fields.month);
  const year = Number(fields.year);
  const date = new Date(year, month - 1, day);
  if (
    !fields.day ||
    !fields.month ||
    fields.year.length !== 4 ||
    year < 1900 ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  )
    errors.birth = "Informe uma data de nascimento válida.";
  else if (date.getTime() > now)
    errors.birth = "A data de nascimento não pode ser futura.";
  if (Object.keys(errors).length) return { errors };
  const two = (value: number) => String(value).padStart(2, "0");
  return {
    errors,
    profile: {
      email: fields.email,
      name,
      phone,
      birth: `${year}-${two(month)}-${two(day)}`,
      photo: fields.photo,
    },
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

// Mesmo formato de whenLabel ("Hoje · 18:46"), para a data não mudar de estilo
// entre as telas.
export function formatInstant(instant: number, timeZone: string) {
  return whenLabel(instant, timeZone, Date.now());
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
// Paradas conhecidas da demo, sempre depois do embarque principal.
export const stopOptions = (intent: Intent) => [
  `Embarque da companhia · ${companionPoints(intent).pickup}`,
  "Posto de combustível · avenida principal (ilustrativo)",
];

export const samePick = (a: ProposalPick | null, b: ProposalPick | null) =>
  Boolean(a && b && a.choice === b.choice && a.stop === b.stop);

// O acordo é derivado das escolhas: os dois escolheram o mesmo conteúdo.
export const isAgreed = (proposal: Proposal | null | undefined) =>
  Boolean(proposal && samePick(proposal.picks.mine, proposal.picks.theirs));

export function makeProposal(
  intent: Intent,
  companion: Candidate,
  choice: ProposalChoice,
  negotiation: number,
  version: number,
  stop?: string,
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
    picks: { mine: null, theirs: null },
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
    stops: choice === "stop" ? [stop ?? stopOptions(intent)[0]] : [],
    walks,
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

// "Hoje · 18:00", "Amanhã · 18:00" ou "13/10 · 18:00", sempre no fuso da busca.
export function whenLabel(instant: number, timeZone: string, now: number) {
  const day = (value: number) =>
    new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      timeZone,
    }).format(value);
  const date = day(instant);
  const prefix =
    date === day(now)
      ? "Hoje"
      : date === day(now + 24 * 60 * 60_000)
        ? "Amanhã"
        : date;
  return `${prefix} · ${clockTime(instant, timeZone)}`;
}

import { XStack, YStack } from "tamagui";
import { AppText } from "../../ui/components";
import {
  type Candidate,
  clockTime,
  commonWindow,
  type Intent,
  whenLabel,
} from "./domain";
import { Avatar, Chip } from "./Kit";

function departureLabel(candidate: Candidate, timeZone: string) {
  return whenLabel(candidate.departure, timeZone, Date.now());
}

function leaving(candidate: Candidate, timeZone: string) {
  const label = departureLabel(candidate, timeZone).replace(" · ", " às ");
  return `Sai ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
}

function windowLabel(candidate: Candidate, intent: Intent) {
  const window = commonWindow(intent, candidate);
  if (!window) return "Indisponível";
  const start = clockTime(window.start, intent.timeZone);
  return window.start === window.end
    ? start
    : `${start}–${clockTime(window.end, intent.timeZone)}`;
}

function Identity({
  candidate,
  size,
}: {
  candidate: Candidate;
  size: "large" | "small";
}) {
  const detail = [
    `${candidate.trips} viagens`,
    `${candidate.passengers} ${candidate.passengers === 1 ? "passageiro" : "passageiros"}`,
    candidate.fixed ? "horário fixo" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <XStack gap={12} alignItems="center">
      <Avatar name={candidate.name} size={size === "large" ? 56 : 44} />
      <YStack flex={1}>
        <XStack alignItems="baseline" gap={8}>
          <AppText
            fontSize={size === "large" ? 26 : 20}
            lineHeight={size === "large" ? 31 : 25}
            fontWeight="700"
            letterSpacing={-0.6}
            flexShrink={1}
          >
            {candidate.name}
          </AppText>
          <AppText fontSize={14} lineHeight={20} fontWeight="600">
            ★ {candidate.rating}
          </AppText>
        </XStack>
        <AppText fontSize={12} lineHeight={17} color="$muted">
          {detail}
        </AppText>
      </YStack>
    </XStack>
  );
}

// Sugestão completa (tela de escolha): quem, quando e o quanto cada um caminha.
export function PersonCard({
  candidate,
  intent,
}: {
  candidate: Candidate;
  intent: Intent;
}) {
  const total = intent.passengers + candidate.passengers;
  return (
    <YStack
      backgroundColor="$surface"
      borderWidth={1}
      borderColor="$border"
      borderRadius={22}
      padding={18}
      gap={16}
    >
      <Identity candidate={candidate} size="large" />
      <YStack gap={8}>
        <AppText fontSize={17} lineHeight={23} fontWeight="700">
          {leaving(candidate, intent.timeZone)}
        </AppText>
        <XStack>
          <Chip
            icon="clock"
            tone="success"
            label={`Encaixa ${windowLabel(candidate, intent)}`}
          />
        </XStack>
      </YStack>
      <XStack>
        <Walk meters={candidate.pickup} caption="a pé até o embarque" />
        <Walk
          meters={candidate.dropoff}
          caption="a pé até seu destino"
          divider
        />
      </XStack>
      {total !== 2 ? (
        <AppText fontSize={12} lineHeight={17} color="$muted">
          Divisão por pessoa: você {intent.passengers}/{total} ·{" "}
          {candidate.name} {candidate.passengers}/{total}
        </AppText>
      ) : null}
    </YStack>
  );
}

function Walk({
  meters,
  caption,
  divider = false,
}: {
  meters: number;
  caption: string;
  divider?: boolean;
}) {
  return (
    <YStack
      flex={1}
      gap={2}
      paddingLeft={divider ? 16 : 0}
      borderLeftWidth={divider ? 1 : 0}
      borderColor="$border"
    >
      <AppText fontSize={26} lineHeight={30} fontWeight="700">
        {meters}{" "}
        <AppText fontSize={13} color="$muted">
          m
        </AppText>
      </AppText>
      <AppText fontSize={12} lineHeight={17} color="$muted">
        {caption}
      </AppText>
    </YStack>
  );
}

// Versão de uma linha para quando a pessoa já foi escolhida (tela de espera).
export function PersonRow({
  candidate,
  intent,
  heading,
}: {
  candidate: Candidate;
  intent: Intent;
  /** Frase curta dentro do cartão, acima de quem é (ex.: "Quer viajar com você"). */
  heading?: string;
}) {
  return (
    <YStack
      backgroundColor="$surface"
      borderWidth={1}
      borderColor="$border"
      borderRadius={18}
      padding={14}
      gap={10}
      aria-live={heading ? "polite" : undefined}
    >
      {heading ? (
        <AppText
          fontSize={13}
          lineHeight={18}
          fontWeight="700"
          color="$successText"
        >
          {heading}
        </AppText>
      ) : null}
      <Identity candidate={candidate} size="small" />
      <XStack gap={8} flexWrap="wrap">
        <Chip
          icon="clock"
          tone="success"
          label={`${departureLabel(candidate, intent.timeZone)} · ${windowLabel(candidate, intent)}`}
        />
        <Chip
          icon="person"
          label={`${candidate.pickup} m + ${candidate.dropoff} m a pé`}
        />
      </XStack>
    </YStack>
  );
}

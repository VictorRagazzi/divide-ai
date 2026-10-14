import { router } from "expo-router";
import { Pressable } from "react-native";
import { XStack, YStack } from "tamagui";
import { services } from "../../services";
import { AppButton, AppText, Feedback, Surface } from "../../ui/components";
import { DemoPage } from "./DemoPage";
import {
  formatInstant,
  isAgreed,
  receivedState,
  stageHref,
  type TripRecord,
} from "./domain";
import { Quiet, RouteLines } from "./JourneyUi";
import { Avatar } from "./Kit";
import { useDemo } from "./provider";

// Duas linhas curtas: o que aconteceu e as notas (a recebida só depois de liberada).
function recordLines(trip: TripRecord) {
  if (!trip.happened) return ["Não realizada"];
  if (!trip.mine) return ["Concluída", "Sem avaliação"];
  const stars = (count: number) => "★".repeat(count);
  const theirs =
    receivedState(trip) === "visible" && trip.theirs
      ? `${trip.name} ${stars(trip.theirs.stars)}`
      : `aguardando ${trip.name}`;
  return ["Concluída", `Você ${stars(trip.mine.stars)} · ${theirs}`];
}

export default function TripsScreen() {
  const { state, now } = useDemo();
  const agreed = isAgreed(state.proposal);
  const post = state.postTrip;
  const active =
    state.intent && (state.matched || now < state.intent.departure);
  const companion = state.candidates.find((c) => c.id === state.matched);
  const lastMessage = state.messages.at(-1);
  const status = post
    ? post.happened === null
      ? "Viagem encerrada · conte como foi"
      : post.happened === false
        ? "Viagem não realizada"
        : post.mine
          ? "Avaliação enviada"
          : "Viagem concluída · avalie"
    : agreed
      ? "✓ Viagem combinada"
      : state.matched
        ? "Em negociação"
        : state.pending
          ? "Aguardando companhia"
          : "Busca ativa";
  const action = post
    ? post.happened === null
      ? "Responder"
      : post.happened === false
        ? "Concluir registro"
        : post.mine
          ? "Ver avaliação"
          : "Avaliar"
    : "Ver detalhes";
  return (
    <DemoPage
      tab="viagens"
      title="Suas viagens"
      eyebrow="SEU CAMINHO"
      subtitle="Encontre sua busca ou conversa em andamento."
      footer={
        <AppButton onPress={() => router.replace("/")}>
          {active ? "Voltar à busca" : "Buscar companhia"}
        </AppButton>
      }
    >
      {active && state.intent ? (
        <Surface>
          <AppText fontSize={14} fontWeight="700">
            {status}
          </AppText>
          <RouteLines
            origin={state.proposal?.pickup ?? state.intent.origin}
            destination={state.proposal?.dropoff ?? state.intent.destination}
          />
          <Quiet>
            {formatInstant(
              state.proposal?.departure ?? state.intent.departure,
              state.intent.timeZone,
            )}
          </Quiet>
          <AppButton onPress={() => router.push(stageHref(state))}>
            {action}
          </AppButton>
        </Surface>
      ) : (
        <Feedback
          kind="empty"
          title={
            state.message
              ? "Participação encerrada"
              : "Seu próximo caminho começa aqui"
          }
          description={
            state.message ||
            `Você ainda não tem uma viagem combinada${services.config.demo ? " nesta demonstração" : ""}.`
          }
        />
      )}
      {active && state.proposal && companion && !post ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Abrir conversa com ${companion.name}`}
          onPress={() => router.push("/chat")}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Surface>
            <XStack gap={12} alignItems="center">
              <Avatar name={companion.name} size={44} />
              <YStack flex={1} minWidth={0} gap={2}>
                <AppText fontSize={14} fontWeight="700" textAlign="left">
                  Conversa com {companion.name}
                </AppText>
                <AppText
                  textAlign="left"
                  fontSize={12}
                  lineHeight={17}
                  color="$muted"
                  numberOfLines={1}
                >
                  {lastMessage
                    ? `${lastMessage.sender === "mine" ? "Você: " : ""}${lastMessage.text}`
                    : "Combine o encontro por aqui."}
                </AppText>
              </YStack>
              <AppText fontSize={18} color="$muted" aria-hidden>
                ›
              </AppText>
            </XStack>
          </Surface>
        </Pressable>
      ) : null}
      {state.history.length ? (
        <YStack gap={8}>
          <AppText fontSize={14} fontWeight="700" role="heading">
            Viagens anteriores
          </AppText>
          {state.history.map((trip) => (
            <Surface key={trip.negotiation}>
              <XStack gap={12} alignItems="center">
                <Avatar name={trip.name} size={40} />
                <YStack flex={1} minWidth={0} gap={2}>
                  <AppText fontSize={14} fontWeight="700">
                    {trip.name}
                  </AppText>
                  {recordLines(trip).map((line) => (
                    <Quiet key={line}>{line}</Quiet>
                  ))}
                  {trip.route ? <Quiet>{trip.route}</Quiet> : null}
                </YStack>
              </XStack>
            </Surface>
          ))}
        </YStack>
      ) : null}
      {services.config.demo ? (
        <Quiet>
          Os dados ficam em memória. Recarregar o app reinicia esta
          demonstração.
        </Quiet>
      ) : null}
    </DemoPage>
  );
}

import { router } from "expo-router";
import { Pressable } from "react-native";
import { XStack, YStack } from "tamagui";
import { AppButton, AppText, Feedback, Surface } from "../../ui/components";
import { DemoPage } from "./DemoPage";
import { formatInstant } from "./domain";
import { Quiet, RouteLines } from "./JourneyUi";
import { useDemo } from "./provider";

export default function TripsScreen() {
  const { state, now } = useDemo();
  const agreed = state.proposal?.mine && state.proposal?.theirs;
  const active =
    state.intent && (state.matched || now < state.intent.departure);
  const companion = state.candidates.find((c) => c.id === state.matched);
  const lastMessage = state.messages.at(-1);
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
            {agreed
              ? "✓ Viagem combinada"
              : state.matched
                ? "Em negociação"
                : state.pending
                  ? "Aguardando companhia"
                  : "Busca ativa"}
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
          <AppButton
            onPress={() =>
              router.push(
                agreed
                  ? "/viagem"
                  : state.matched
                    ? "/proposta"
                    : state.pending
                      ? "/espera"
                      : "/busca",
              )
            }
          >
            Ver detalhes
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
            "Você ainda não tem uma viagem combinada nesta demonstração."
          }
        />
      )}
      {active && state.proposal && companion ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Abrir conversa com ${companion.name}`}
          onPress={() => router.push("/chat")}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Surface>
            <XStack gap={12} alignItems="center">
              <YStack
                width={44}
                height={44}
                borderRadius={22}
                backgroundColor="$primary"
                alignItems="center"
                justifyContent="center"
                aria-hidden
              >
                <AppText fontSize={18} fontWeight="700" color="$onPrimary">
                  {companion.name.slice(0, 1)}
                </AppText>
              </YStack>
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
      <Quiet>
        Os dados ficam em memória. Recarregar o app reinicia esta demonstração.
      </Quiet>
    </DemoPage>
  );
}

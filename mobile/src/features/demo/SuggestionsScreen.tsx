import { Redirect, router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { XStack, YStack } from "tamagui";
import { AppButton, Feedback, Notice } from "../../ui/components";
import { IncomingConfirmation, SwapConfirmation } from "../../ui/product";
import { DemoPage } from "./DemoPage";
import { eligible } from "./domain";
import { Quiet } from "./JourneyUi";
import { Chip } from "./Kit";
import { PersonCard } from "./PersonCard";
import { useDemo } from "./provider";

export default function SuggestionsScreen() {
  const { state, now, send } = useDemo();
  const [incomingSwap, setIncomingSwap] = useState<{
    id: string;
    name: string;
    revision: number;
  } | null>(null);
  const [swap, setSwap] = useState<{
    id: string;
    name: string;
    currentName: string;
    revision: number;
  } | null>(null);
  if (!state.intent) return <Redirect href="/" />;
  if (state.matched) return <Redirect href="/proposta" />;
  const intent = state.intent;
  const expired = now >= intent.departure;
  const pending = state.candidates.find((c) => c.id === state.pending);
  const incoming = state.candidates.find((c) => c.id === state.incoming);
  const candidates = state.candidates.filter(
    (c) =>
      c.id !== state.pending &&
      c.id !== state.incoming &&
      !state.skipped.includes(c.id) &&
      eligible(intent, c, now),
  );
  const candidate = candidates[0];
  const skip = () => {
    if (candidate) send({ type: "skip", id: candidate.id });
  };
  const accept = () => {
    if (!candidate) return;
    if (incoming)
      setIncomingSwap({
        id: candidate.id,
        name: candidate.name,
        revision: state.revision,
      });
    else if (pending)
      setSwap({
        id: candidate.id,
        name: candidate.name,
        currentName: pending.name,
        revision: state.revision,
      });
    else {
      send(
        {
          type: "request",
          id: candidate.id,
          expectedRevision: state.revision,
        },
        () => router.push("/espera"),
      );
    }
  };
  const pan = Gesture.Pan()
    .activeOffsetX([-30, 30])
    .failOffsetY([-15, 15])
    .runOnJS(true)
    .onEnd((event) => {
      if (event.translationX >= 80) accept();
      else if (event.translationX <= -80) skip();
    });
  return (
    <DemoPage
      compact
      demoNote="badge"
      title="Quem vai com você?"
      back="/busca"
      footer={
        <>
          {candidate ? (
            <XStack gap={10}>
              <YStack flex={1}>
                <AppButton variant="secondary" onPress={skip}>
                  ← Pular
                </AppButton>
              </YStack>
              <YStack flex={1}>
                <AppButton onPress={accept}>✓ Aceitar</AppButton>
              </YStack>
            </XStack>
          ) : (
            <AppButton
              variant="secondary"
              onPress={() =>
                expired ? router.replace("/") : send({ type: "review" })
              }
            >
              {expired ? "Escolher outro horário" : "Rever sugestões puladas"}
            </AppButton>
          )}
          <Quiet>Aceitar ainda não confirma a viagem.</Quiet>
        </>
      }
    >
      {incoming ? (
        <Chip
          fullWidth
          tone="success"
          icon="person"
          label={`${incoming.name} quer viajar com você · ver`}
          accessibilityLabel={`${incoming.name} quer viajar com você. Ver solicitação`}
          onPress={() => router.push("/busca")}
        />
      ) : null}
      {pending ? (
        <Chip
          fullWidth
          tone="success"
          icon="clock"
          label={`Aguardando ${pending.name} · ver`}
          accessibilityLabel={`Aguardando ${pending.name}. Ver solicitação`}
          onPress={() => router.push("/espera")}
        />
      ) : null}
      {candidate ? (
        <GestureDetector gesture={pan}>
          <View collapsable={false}>
            <PersonCard candidate={candidate} intent={intent} />
          </View>
        </GestureDetector>
      ) : (
        <Feedback
          kind="empty"
          title={expired ? "Busca encerrada" : "Você viu todas as sugestões"}
          description={
            expired
              ? "A flexibilidade não prolonga a busca."
              : "A busca segue aberta até o horário escolhido. Você pode rever as que pulou."
          }
        />
      )}
      {swap && state.message ? (
        <Notice title="Solicitação" live>
          {state.message}
        </Notice>
      ) : null}
      <IncomingConfirmation
        open={Boolean(incomingSwap)}
        incomingName={incoming?.name ?? ""}
        nextName={incomingSwap?.name ?? ""}
        onClose={() => setIncomingSwap(null)}
        onConfirm={() => {
          if (!incomingSwap) return;
          send(
            {
              type: "request",
              id: incomingSwap.id,
              expectedRevision: incomingSwap.revision,
              declineIncoming: true,
            },
            () => router.push("/espera"),
          );
          setIncomingSwap(null);
        }}
      />
      <SwapConfirmation
        open={Boolean(swap)}
        currentName={swap?.currentName ?? ""}
        nextName={swap?.name ?? ""}
        onClose={() => setSwap(null)}
        onConfirm={() => {
          if (!swap) return;
          send(
            {
              type: "request",
              id: swap.id,
              expectedRevision: swap.revision,
            },
            () => router.push("/espera"),
          );
          setSwap(null);
        }}
      />
    </DemoPage>
  );
}

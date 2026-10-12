import { Redirect, router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { XStack, YStack } from "tamagui";
import { AppButton, Feedback, Notice } from "../../ui/components";
import { SwapConfirmation } from "../../ui/product";
import { DemoPage } from "./DemoPage";
import { eligible } from "./domain";
import { PersonCard, Quiet, TextAction } from "./JourneyUi";
import { useDemo } from "./provider";

export default function SuggestionsScreen() {
  const { state, now, send } = useDemo();
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
  const candidates = state.candidates.filter(
    (c) =>
      c.id !== state.pending &&
      !state.skipped.includes(c.id) &&
      eligible(intent, c, now),
  );
  const candidate = candidates[0];
  const skip = () => {
    if (candidate) send({ type: "skip", id: candidate.id });
  };
  const accept = () => {
    if (!candidate) return;
    if (pending)
      setSwap({
        id: candidate.id,
        name: candidate.name,
        currentName: pending.name,
        revision: state.revision,
      });
    else {
      send({
        type: "request",
        id: candidate.id,
        expectedRevision: state.revision,
      });
      router.push("/espera");
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
      eyebrow="ENCONTRAR COMPANHIA"
      title="Quem vai com você?"
      subtitle="Passe para explorar. Aceite para demonstrar interesse."
      step="1 de 2"
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
          <Quiet>Aceitar companhia ainda não confirma a viagem.</Quiet>
        </>
      }
    >
      {pending ? (
        <YStack
          backgroundColor="$success"
          borderRadius={12}
          paddingHorizontal={12}
        >
          <TextAction
            label={`Aguardando ${pending.name} · ver solicitação`}
            onPress={() => router.push("/espera")}
          />
        </YStack>
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
              : "A busca continua até o horário escolhido. Você pode rever as pessoas que pulou."
          }
        />
      )}
      <Quiet>Pulou? A sugestão pode reaparecer ao abrir o app novamente.</Quiet>
      {swap && state.message ? (
        <Notice title="Solicitação" live>
          {state.message}
        </Notice>
      ) : null}
      <SwapConfirmation
        open={Boolean(swap)}
        currentName={swap?.currentName ?? ""}
        nextName={swap?.name ?? ""}
        onClose={() => setSwap(null)}
        onConfirm={() => {
          if (!swap) return;
          send({
            type: "request",
            id: swap.id,
            expectedRevision: swap.revision,
          });
          setSwap(null);
          router.push("/espera");
        }}
      />
    </DemoPage>
  );
}

import { Redirect, router } from "expo-router";
import { YStack } from "tamagui";
import { AppButton, AppText, Feedback, Notice } from "../../ui/components";
import { DemoPage } from "./DemoPage";
import { clockTime } from "./domain";
import { PersonCard, Quiet, TextAction } from "./JourneyUi";
import { useDemo } from "./provider";

export default function WaitingScreen() {
  const { state, now, send } = useDemo();
  if (!state.intent) return <Redirect href="/" />;
  if (state.matched) return <Redirect href="/proposta" />;
  const companion = state.candidates.find((c) => c.id === state.pending);
  const expired = now >= state.intent.departure;
  return (
    <DemoPage
      eyebrow="SOLICITAÇÃO ENVIADA"
      title={
        companion ? `Falta ${companion.name}\naceitar.` : "Nenhuma solicitação"
      }
      subtitle={
        companion
          ? "Seu interesse já foi enviado. A próxima etapa abre quando os dois aceitarem."
          : "Continue vendo sugestões ou escolha outro horário."
      }
      step="1 de 2"
      back="/sugestoes"
      footer={
        <>
          <AppButton onPress={() => router.push(expired ? "/" : "/sugestoes")}>
            {expired ? "Escolher outro horário" : "Continuar vendo sugestões"}
          </AppButton>
          {companion ? (
            <TextAction
              label="Cancelar solicitação e buscar outra"
              onPress={() => {
                send({ type: "cancel" });
                router.replace("/sugestoes");
              }}
            />
          ) : null}
        </>
      }
    >
      {companion ? (
        <>
          {state.message.includes("substituída") ||
          state.message.includes("Não foi possível") ? (
            <Notice title="Solicitação atualizada" live>
              {state.message}
            </Notice>
          ) : null}
          <PersonCard waiting candidate={companion} intent={state.intent} />
          <YStack gap={6}>
            <AppText fontSize={15} fontWeight="700">
              Você pode continuar explorando
            </AppText>
            <Quiet>
              Esta solicitação fica aberta. Se quiser aceitar outra pessoa,
              vamos pedir sua confirmação para trocar.
            </Quiet>
          </YStack>
          <Quiet>
            Ainda não é uma viagem confirmada. O chat abre quando os dois
            aceitarem.
          </Quiet>
          <Quiet>
            Solicitação válida até{" "}
            {clockTime(
              Math.min(state.intent.departure, companion.departure),
              state.intent.timeZone,
            )}
            , seu horário escolhido.
          </Quiet>
          <YStack borderTopWidth={1} borderColor="$border" paddingTop={4}>
            <TextAction
              label="Demo: simular aceite da companhia"
              onPress={() => send({ type: "simulate-match" })}
            />
          </YStack>
        </>
      ) : (
        <Feedback
          kind="empty"
          title={expired ? "Busca encerrada" : "Solicitação encerrada"}
          description={state.message || "Nenhuma viagem foi confirmada."}
        />
      )}
    </DemoPage>
  );
}

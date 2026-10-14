import { Redirect, router } from "expo-router";
import { Pressable } from "react-native";
import { services } from "../../services";
import { AppButton, AppText, Feedback, Notice } from "../../ui/components";
import { DemoPage } from "./DemoPage";
import { clockTime } from "./domain";
import { TextAction } from "./JourneyUi";
import { StatusSteps } from "./Kit";
import { PersonRow } from "./PersonCard";
import { useDemo } from "./provider";

export default function WaitingScreen() {
  const { state, now, send } = useDemo();
  if (!state.intent) return <Redirect href="/" />;
  if (state.matched) return <Redirect href="/proposta" />;
  const companion = state.candidates.find((c) => c.id === state.pending);
  const expired = now >= state.intent.departure;
  return (
    <DemoPage
      compact
      demoNote="badge"
      title={companion ? `Aguardando ${companion.name}` : "Nenhuma solicitação"}
      back="/sugestoes"
      footer={
        <>
          <AppButton onPress={() => router.push(expired ? "/" : "/sugestoes")}>
            {expired ? "Escolher outro horário" : "Continuar vendo sugestões"}
          </AppButton>
          {companion ? (
            <TextAction
              label="Cancelar solicitação"
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
          <StatusSteps
            steps={[
              { label: "Você aceitou", state: "done" },
              { label: `${companion.name} responde`, state: "current" },
              { label: "Chat abre", state: "todo" },
            ]}
          />
          <PersonRow candidate={companion} intent={state.intent} />
          <AppText fontSize={13} lineHeight={19} color="$muted">
            Válida até{" "}
            {clockTime(
              Math.min(state.intent.departure, companion.departure),
              state.intent.timeZone,
            )}
            . Pode continuar explorando; trocar de pessoa pede sua confirmação.
          </AppText>
          {services.config.demo ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Demo: simular aceite da companhia"
              onPress={() => send({ type: "simulate-match" })}
              style={({ pressed }) => ({
                alignSelf: "flex-start",
                minHeight: 48,
                justifyContent: "center",
                paddingHorizontal: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderStyle: "dashed",
                borderColor: "#82907E",
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <AppText fontSize={12} lineHeight={17} color="$muted">
                Demo · simular aceite de {companion.name}
              </AppText>
            </Pressable>
          ) : null}
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

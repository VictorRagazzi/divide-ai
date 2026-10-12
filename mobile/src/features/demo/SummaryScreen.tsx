import { Redirect, router } from "expo-router";
import { YStack } from "tamagui";
import { AppButton, AppText, Notice, Surface } from "../../ui/components";
import { AgreementDetails } from "./AgreementUi";
import { DemoPage } from "./DemoPage";
import { Quiet, TextAction } from "./JourneyUi";
import { useDemo } from "./provider";

export default function SummaryScreen() {
  const { state, send } = useDemo();
  if (!state.matched || !state.proposal || !state.intent)
    return <Redirect href="/" />;
  const proposal = state.proposal;
  if (proposal.mine && proposal.theirs) return <Redirect href="/viagem" />;
  const name =
    state.candidates.find((c) => c.id === state.matched)?.name ?? "Companhia";
  return (
    <DemoPage
      eyebrow={
        proposal.version > 1
          ? "CONFIRMAÇÕES REINICIADAS"
          : "ETAPA 2 DE 2 · DETALHES"
      }
      title={
        proposal.version > 1 ? "Os detalhes mudaram" : "Confira a proposta"
      }
      subtitle={`Proposta ${proposal.version} · você e ${name}`}
      step="2 de 2"
      back="/proposta"
      footer={
        <>
          <AppButton
            disabled={proposal.mine}
            onPress={() =>
              send({
                type: "confirm-proposal",
                who: "mine",
                negotiation: proposal.negotiation,
                expectedVersion: proposal.version,
              })
            }
          >
            {proposal.mine
              ? `Aguardando ${name} confirmar`
              : "Confirmar esta proposta"}
          </AppButton>
          <TextAction
            label="Editar proposta"
            onPress={() => router.push("/proposta")}
          />
        </>
      }
    >
      {proposal.version > 1 ? (
        <Notice title="Confiram novamente">
          As confirmações anteriores não valem para esta versão. Vocês dois
          precisam confirmar os detalhes atuais.
        </Notice>
      ) : null}
      <AgreementDetails />
      <Surface>
        <AppText fontSize={14} fontWeight="700">
          Confirmações da proposta {proposal.version}
        </AppText>
        <YStack gap={6}>
          <Quiet>
            Você:{" "}
            {proposal.mine ? "✓ confirmou esta versão" : "ainda não confirmou"}
          </Quiet>
          <Quiet>
            {name}:{" "}
            {proposal.theirs
              ? "✓ confirmou esta versão"
              : "ainda não confirmou"}
          </Quiet>
        </YStack>
      </Surface>
      <TextAction
        label="Conversar sobre os detalhes"
        onPress={() => router.push("/chat")}
      />
      <TextAction
        label={
          proposal.theirs
            ? "Companhia já confirmou esta versão (demo)"
            : `Demo: simular confirmação de ${name}`
        }
        onPress={() =>
          send({
            type: "confirm-proposal",
            who: "theirs",
            negotiation: proposal.negotiation,
            expectedVersion: proposal.version,
          })
        }
      />
    </DemoPage>
  );
}

import { Redirect, router } from "expo-router";
import { XStack, YStack } from "tamagui";
import { AppButton, AppText, Notice, Surface } from "../../ui/components";
import { AgreementTabs, EndNegotiation } from "./AgreementUi";
import { DemoPage } from "./DemoPage";
import {
  companionPoints,
  formatInstant,
  makeProposal,
  type ProposalChoice,
  validProposal,
} from "./domain";
import { Quiet } from "./JourneyUi";
import { useDemo } from "./provider";

export default function ProposalScreen() {
  const { state, send } = useDemo();
  if (!state.matched || !state.proposal || !state.intent)
    return <Redirect href={state.pending ? "/espera" : "/"} />;
  const proposal = state.proposal;
  const intent = state.intent;
  const companion = state.candidates.find((c) => c.id === state.matched);
  if (!companion) return <Redirect href="/" />;
  const options: { choice: ProposalChoice; title: string; caption: string }[] =
    [
      {
        choice: "suggestion",
        title: "Sugestão do app",
        caption: "Um ponto de encontro em comum",
      },
      {
        choice: "mine",
        title: "Meu trajeto",
        caption: "A companhia caminha até os seus pontos",
      },
      {
        choice: "theirs",
        title: `Trajeto de ${companion.name}`,
        caption: "Você caminha até os pontos da companhia",
      },
      {
        choice: "stop",
        title: "Adicionar parada",
        caption: "Embarque da companhia antes do destino",
      },
    ];
  const agreed = proposal.mine && proposal.theirs;
  return (
    <DemoPage
      eyebrow="ETAPA 2 DE 2 · DETALHES"
      title="Vamos combinar?"
      subtitle={`Você + ${companion.name} · proposta ${proposal.version}`}
      step="2 de 2"
      back="/viagens"
      footer={
        <>
          <AppButton
            onPress={() => router.push(agreed ? "/viagem" : "/resumo")}
          >
            {agreed ? "Ver viagem combinada" : "Conferir resumo"}
          </AppButton>
          <EndNegotiation />
        </>
      }
    >
      <AgreementTabs active="proposta" />
      {state.message && proposal.version > 1 ? (
        <Notice title="Confira as alterações" live>
          {state.message}
        </Notice>
      ) : null}
      <Surface>
        <AppText fontSize={14} fontWeight="700">
          Compare os pontos de partida
        </AppText>
        <Quiet>
          Você: {intent.origin} → {intent.destination}
        </Quiet>
        <Quiet>
          {companion.name}: {companionPoints(intent).pickup} →{" "}
          {companionPoints(intent).dropoff}
        </Quiet>
        <Quiet>
          Horário em comum: {formatInstant(proposal.departure, intent.timeZone)}
          . Os atalhos mudam os pontos e mantêm este horário.
        </Quiet>
      </Surface>
      <YStack gap={10}>
        {options.map((option) => {
          const next = makeProposal(
            intent,
            companion,
            option.choice,
            proposal.negotiation,
            proposal.version + 1,
          );
          const available = validProposal(next, intent, companion);
          return (
            <YStack key={option.choice} gap={5}>
              <AppButton
                selected={proposal.choice === option.choice}
                variant={
                  proposal.choice === option.choice ? "primary" : "secondary"
                }
                disabled={!available}
                onPress={() =>
                  send({
                    type: "choose-proposal",
                    choice: option.choice,
                    negotiation: proposal.negotiation,
                    expectedVersion: proposal.version,
                  })
                }
              >{`${proposal.choice === option.choice ? "✓ " : ""}${option.title}`}</AppButton>
              <Quiet>
                {available
                  ? option.caption
                  : "Ultrapassa o limite de caminhada de um participante."}
              </Quiet>
            </YStack>
          );
        })}
      </YStack>
      <Surface>
        <AppText fontSize={14} fontWeight="700">
          Proposta atual
        </AppText>
        <Quiet>Embarque: {proposal.pickup}</Quiet>
        <Quiet>Desembarque: {proposal.dropoff}</Quiet>
        <Quiet>{proposal.stops.join("\n") || "Sem paradas adicionais"}</Quiet>
        <XStack gap={8}>
          <AppText fontSize={12} color="$primary">
            Você: {proposal.mine ? "confirmou" : "pendente"}
          </AppText>
          <AppText fontSize={12} color="$primary">
            {companion.name}: {proposal.theirs ? "confirmou" : "pendente"}
          </AppText>
        </XStack>
      </Surface>
      <Quiet>
        Escolher uma opção não confirma a viagem. Os dois precisam aceitar a
        mesma versão do resumo.
      </Quiet>
    </DemoPage>
  );
}

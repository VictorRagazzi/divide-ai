import { Redirect, router } from "expo-router";
import { XStack } from "tamagui";
import { Surface } from "../../ui/components";
import { AgreementHeader, EndNegotiation } from "./AgreementUi";
import { DemoPage } from "./DemoPage";
import { formatInstant, isAgreed, stageHref } from "./domain";
import { DemoAction } from "./FormKit";
import { Quiet, RouteLines, TextAction } from "./JourneyUi";
import { Chip, StatusSteps } from "./Kit";
import { useDemo } from "./provider";

export default function TripScreen() {
  const { state, send } = useDemo();
  const { proposal, intent } = state;
  const companion = state.candidates.find((c) => c.id === state.matched);
  if (state.postTrip) return <Redirect href={stageHref(state)} />;
  if (!state.matched || !proposal || !intent || !companion)
    return <Redirect href="/viagens" />;
  if (!isAgreed(proposal)) return <Redirect href="/proposta" />;
  const total = intent.passengers + companion.passengers;
  const split =
    total === 2
      ? "metade para cada"
      : `${intent.passengers}/${total} você · ${companion.passengers}/${total} ${companion.name}`;
  return (
    <DemoPage
      header={<AgreementHeader active="viagem" />}
      footer={
        <>
          <DemoAction
            label="Demo · simular fim da viagem"
            onPress={() => {
              send({ type: "end-trip", negotiation: proposal.negotiation });
              router.replace("/lembrete");
            }}
          />
          <TextAction
            label="Mudar a escolha"
            onPress={() => router.push("/proposta")}
          />
          <EndNegotiation />
        </>
      }
    >
      <StatusSteps
        steps={[
          { label: "Você escolheu", state: "done" },
          { label: `${companion.name} escolheu`, state: "done" },
          { label: "Pedir o carro", state: "current" },
        ]}
      />
      <Surface>
        <RouteLines origin={proposal.pickup} destination={proposal.dropoff} />
        {proposal.stops.length ? (
          <Quiet>Parada: {proposal.stops.join(" · ")}</Quiet>
        ) : null}
        <XStack gap={8} flexWrap="wrap">
          <Chip
            icon="clock"
            tone="success"
            label={formatInstant(proposal.departure, intent.timeZone)}
          />
          <Chip icon="person" label={`${total} passageiros · ${split}`} />
        </XStack>
        <Quiet>
          A pé (embarque / desembarque): você {proposal.walks[0]} /{" "}
          {proposal.walks[1]} m · {companion.name} {proposal.walks[2]} /{" "}
          {proposal.walks[3]} m.
        </Quiet>
      </Surface>
      <Quiet>
        Combinem no chat quem pede o carro no Uber/99 e o repasse. O valor é
        acertado por fora; ninguém paga pelo Divide aí, e o acordo não significa
        que um carro foi solicitado.
      </Quiet>
    </DemoPage>
  );
}

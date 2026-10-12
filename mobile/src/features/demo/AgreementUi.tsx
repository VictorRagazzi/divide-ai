import { router } from "expo-router";
import { useState } from "react";
import { XStack, YStack } from "tamagui";
import { AppButton, AppModal, AppText, Surface } from "../../ui/components";
import { formatInstant } from "./domain";
import { Quiet, RouteLines, TextAction } from "./JourneyUi";
import { useDemo } from "./provider";

export function AgreementTabs({ active }: { active: "proposta" | "chat" }) {
  return (
    <XStack borderBottomWidth={1} borderColor="$border" gap={24}>
      {(["proposta", "chat"] as const).map((tab) => (
        <YStack
          key={tab}
          flex={1}
          borderBottomWidth={active === tab ? 3 : 0}
          borderColor="$primary"
        >
          <TextAction
            label={tab === "proposta" ? "Proposta" : "Chat"}
            onPress={() =>
              router.replace(tab === "chat" ? "/chat" : "/proposta")
            }
          />
        </YStack>
      ))}
    </XStack>
  );
}
export function AgreementDetails() {
  const { state } = useDemo();
  const { proposal, intent } = state;
  const companion = state.candidates.find((c) => c.id === state.matched);
  if (!proposal || !intent || !companion) return null;
  const total = intent.passengers + companion.passengers;
  return (
    <>
      <Surface>
        <Quiet>
          EMBARQUE · {formatInstant(proposal.departure, intent.timeZone)}
        </Quiet>
        <RouteLines origin={proposal.pickup} destination={proposal.dropoff} />
      </Surface>
      <Surface>
        <AppText fontSize={14} fontWeight="700">
          Paradas
        </AppText>
        <Quiet>
          {proposal.stops.length
            ? proposal.stops.map((stop, i) => `${i + 1}. ${stop}`).join("\n")
            : "Sem paradas adicionais"}
        </Quiet>
      </Surface>
      <Surface>
        <AppText fontSize={14} fontWeight="700">
          {total} passageiros · divisão igual por pessoa
        </AppText>
        <Quiet>
          {total === 2
            ? `Você: metade · ${companion.name}: metade`
            : `Você${intent.passengers === 2 ? " e acompanhante" : ""}: ${intent.passengers}/${total} · ${companion.name}: ${companion.passengers}/${total}`}
        </Quiet>
        <Quiet>
          Valor real e repasse combinados por fora. Ninguém paga pelo Divide aí.
        </Quiet>
      </Surface>
      <Quiet>
        Caminhadas ilustrativas (embarque / desembarque): você{" "}
        {proposal.walks[0]} / {proposal.walks[1]} m · {companion.name}{" "}
        {proposal.walks[2]} / {proposal.walks[3]} m.
      </Quiet>
    </>
  );
}
export function EndNegotiation() {
  const { state, send } = useDemo();
  const [open, setOpen] = useState(false);
  const companion = state.candidates.find((c) => c.id === state.matched);
  return (
    <>
      <TextAction
        danger
        label="Cancelar minha participação"
        onPress={() => setOpen(true)}
      />
      <AppModal
        open={open}
        title="Quer desistir?"
        description={`Sua negociação com ${companion?.name ?? "a companhia"} será encerrada na demonstração. Nenhum aviso real será enviado.`}
        onClose={() => setOpen(false)}
      >
        <AppButton
          variant="danger"
          onPress={() => {
            if (!state.proposal) return;
            send({
              type: "cancel-negotiation",
              negotiation: state.proposal.negotiation,
            });
            setOpen(false);
            router.replace("/viagens");
          }}
        >
          Cancelar minha participação
        </AppButton>
        <AppButton onPress={() => setOpen(false)}>
          Continuar na viagem
        </AppButton>
      </AppModal>
    </>
  );
}

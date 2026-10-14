import { router } from "expo-router";
import { useState } from "react";
import { XStack, YStack } from "tamagui";
import { services } from "../../services";
import { AppButton, AppModal, AppText, Surface } from "../../ui/components";
import { formatInstant, isAgreed, type Proposal, placeLead } from "./domain";
import { LineIcon, Quiet, RouteLines, TextAction } from "./JourneyUi";
import { Avatar, RoundButton } from "./Kit";
import { useDemo } from "./provider";

type AgreementTab = "proposta" | "viagem" | "chat";

// Primeira aba: "Proposta" enquanto negociam; "Detalhes" (viagem) depois do acordo.
export function AgreementTabs({ active }: { active: AgreementTab }) {
  const { state } = useDemo();
  const details =
    active === "viagem" || (active === "chat" && isAgreed(state.proposal));
  const tabs = [
    {
      key: "first",
      label: details ? "Detalhes" : "Proposta",
      href: details ? "/viagem" : "/proposta",
      current: active !== "chat",
    },
    { key: "chat", label: "Chat", href: "/chat", current: active === "chat" },
  ] as const;
  return (
    <XStack borderBottomWidth={1} borderColor="$border" gap={24}>
      {tabs.map((tab) => (
        <YStack
          key={tab.key}
          flex={1}
          borderBottomWidth={tab.current ? 3 : 0}
          borderColor="$primary"
        >
          <TextAction
            label={tab.label}
            onPress={() => router.replace(tab.href)}
          />
        </YStack>
      ))}
    </XStack>
  );
}

// Cabeçalho fixo de Proposta/Detalhes e Chat: só o miolo muda ao trocar de aba.
export function AgreementHeader({ active }: { active: AgreementTab }) {
  const { state } = useDemo();
  const [safety, setSafety] = useState(false);
  const { proposal, intent } = state;
  const companion = state.candidates.find((c) => c.id === state.matched);
  if (!proposal || !intent || !companion) return null;
  const agreed = isAgreed(proposal);
  return (
    <YStack gap={8} paddingBottom={4}>
      <XStack paddingHorizontal={12} paddingTop={4} alignItems="center" gap={4}>
        <RoundButton label="Voltar" onPress={() => router.replace("/viagens")}>
          <LineIcon kind="back" color="#121512" />
        </RoundButton>
        <Avatar name={companion.name} size={44} />
        <YStack flex={1} minWidth={0} paddingLeft={6}>
          <AppText
            role="heading"
            fontSize={17}
            lineHeight={22}
            fontWeight="700"
          >
            {companion.name}
          </AppText>
          <AppText fontSize={11} lineHeight={15} color="$muted">
            ★ {companion.rating} · {companion.trips} viagens
            {services.config.demo ? " · perfil fictício" : ""}
          </AppText>
        </YStack>
        <TextAction label="Segurança" onPress={() => setSafety(true)} />
      </XStack>
      <YStack paddingHorizontal={22} gap={8}>
        <YStack
          borderWidth={1}
          borderColor="$border"
          borderRadius={14}
          paddingVertical={10}
          paddingHorizontal={12}
          gap={2}
          backgroundColor="$surface"
        >
          <XStack justifyContent="space-between" gap={8}>
            <AppText fontSize={12} fontWeight="700">
              {formatInstant(proposal.departure, intent.timeZone)} · proposta{" "}
              {proposal.version}
            </AppText>
            <AppText fontSize={11} color="$primary">
              {agreed ? "Viagem combinada" : "Não combinada"}
            </AppText>
          </XStack>
          <AppText fontSize={12} lineHeight={17} color="$muted">
            {placeLead(proposal.pickup)} → {placeLead(proposal.dropoff)}
          </AppText>
        </YStack>
        <AgreementTabs active={active} />
      </YStack>
      <AppModal
        open={safety}
        title="Viaje com cuidado"
        description="Combine o encontro em um ponto público e confira os detalhes antes de sair."
        onClose={() => setSafety(false)}
      >
        <Quiet>
          Não compartilhe códigos de acesso nem dados de pagamento na conversa.
          {services.config.demo
            ? " Este chat é uma demonstração local; denúncias e bloqueios ficam só neste aparelho."
            : ""}
        </Quiet>
        <AppButton
          variant="secondary"
          onPress={() => {
            setSafety(false);
            router.push("/seguranca");
          }}
        >
          {`Denunciar ou bloquear ${companion.name}`}
        </AppButton>
      </AppModal>
    </YStack>
  );
}
export function AgreementDetails({
  preview,
}: {
  /** Conteúdo de uma opção ainda não escolhida; sem ele mostra a proposta atual. */
  preview?: Proposal;
}) {
  const { state } = useDemo();
  const { intent } = state;
  const proposal = preview ?? state.proposal;
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
        {proposal.walks[0]} / {proposal.walks[1]} m · {companion.name}{" "}
        {proposal.walks[2]} / {proposal.walks[3]} m.
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
        description={`Sua negociação com ${companion?.name ?? "a companhia"} será encerrada${services.config.demo ? " na demonstração. Nenhum aviso real será enviado" : ""}.`}
        onClose={() => setOpen(false)}
      >
        <AppButton
          variant="danger"
          onPress={() => {
            if (!state.proposal) return;
            send(
              {
                type: "cancel-negotiation",
                negotiation: state.proposal.negotiation,
              },
              () => router.replace("/viagens"),
            );
            setOpen(false);
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

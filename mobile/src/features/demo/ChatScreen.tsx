import { Redirect, router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView } from "react-native";
import { Input, XStack, YStack } from "tamagui";
import { AppButton, AppModal, AppText } from "../../ui/components";
import { AgreementTabs } from "./AgreementUi";
import { DemoPage } from "./DemoPage";
import { clockTime, formatInstant, placeLead } from "./domain";
import { Quiet, TextAction } from "./JourneyUi";
import { useDemo } from "./provider";

const SHORTCUTS = [
  "Podemos nos encontrar na entrada?",
  "Quem vai pedir o carro?",
  "Estou chegando!",
];

function Chip({
  label,
  onPress,
  dashed = false,
}: {
  label: string;
  onPress: () => void;
  dashed?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        justifyContent: "center",
        paddingHorizontal: 14,
        borderRadius: 20,
        borderWidth: 1,
        borderStyle: dashed ? "dashed" : "solid",
        borderColor: dashed ? "#9AA39A" : "#CBD2C8",
        backgroundColor: dashed ? "transparent" : "#FFFFFF",
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <AppText
        fontSize={13}
        lineHeight={18}
        color={dashed ? "$muted" : "$color"}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

export default function ChatScreen() {
  const { state, send } = useDemo();
  const [draft, setDraft] = useState("");
  const [safety, setSafety] = useState(false);
  if (!state.matched || !state.proposal || !state.intent)
    return <Redirect href="/" />;
  const proposal = state.proposal;
  const intent = state.intent;
  const companion = state.candidates.find((c) => c.id === state.matched);
  if (!companion) return <Redirect href="/" />;
  const agreed = proposal.mine && proposal.theirs;
  const post = (text: string) => {
    if (!text.trim()) return;
    send({
      type: "chat",
      text,
      sender: "mine",
      negotiation: proposal.negotiation,
    });
    setDraft("");
  };
  return (
    <DemoPage
      autoScroll
      back="/proposta"
      header={
        <YStack gap={8} paddingBottom={4}>
          <XStack
            paddingHorizontal={12}
            paddingTop={4}
            alignItems="center"
            gap={4}
          >
            <TextAction
              label="←"
              accessibilityLabel="Voltar"
              onPress={() => router.replace("/proposta")}
            />
            <YStack
              width={40}
              height={40}
              borderRadius={20}
              backgroundColor="$primary"
              alignItems="center"
              justifyContent="center"
              aria-hidden
            >
              <AppText fontSize={17} fontWeight="700" color="$onPrimary">
                {companion.name.slice(0, 1)}
              </AppText>
            </YStack>
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
                ★ {companion.rating} · {companion.trips} viagens · perfil
                fictício
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
                  {formatInstant(proposal.departure, intent.timeZone)} ·
                  proposta {proposal.version}
                </AppText>
                <AppText fontSize={11} color="$primary">
                  {agreed ? "Viagem combinada" : "Não confirmada"}
                </AppText>
              </XStack>
              <AppText fontSize={12} lineHeight={17} color="$muted">
                {placeLead(proposal.pickup)} → {placeLead(proposal.dropoff)}
              </AppText>
            </YStack>
            <AgreementTabs active="chat" />
          </YStack>
        </YStack>
      }
      footer={
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 8 }}
          >
            {SHORTCUTS.map((text) => (
              <Chip key={text} label={text} onPress={() => post(text)} />
            ))}
            <Chip
              dashed
              label="Demo: simular resposta da companhia"
              onPress={() =>
                send({
                  type: "chat",
                  sender: "theirs",
                  text: "Por mim tudo bem! Vamos conferir o resumo antes de confirmar. Eu posso pedir o carro e combinamos o repasse aqui.",
                  negotiation: proposal.negotiation,
                })
              }
            />
          </ScrollView>
          <XStack gap={8} alignItems="center">
            <Input
              flex={1}
              minWidth={0}
              minHeight={48}
              borderRadius={24}
              backgroundColor="$surface"
              borderColor="$border"
              fontSize={14}
              color="$color"
              placeholder="Escreva uma mensagem…"
              aria-label="Mensagem"
              maxLength={1000}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={() => post(draft)}
              returnKeyType="send"
            />
            <AppButton disabled={!draft.trim()} onPress={() => post(draft)}>
              Enviar
            </AppButton>
          </XStack>
          <TextAction
            label={agreed ? "Ver viagem combinada" : "Ver resumo da proposta"}
            onPress={() => router.push(agreed ? "/viagem" : "/resumo")}
          />
        </>
      }
    >
      <Quiet>
        Combine o encontro e quem vai pedir o carro. Depois, atualize o resumo e
        confirme a proposta.
      </Quiet>
      <YStack gap={12} role="log" aria-live="polite">
        {state.messages.map((message) => (
          <YStack
            key={message.id}
            maxWidth="85%"
            alignSelf={message.sender === "mine" ? "flex-end" : "flex-start"}
            gap={4}
          >
            <YStack
              borderRadius={18}
              borderBottomRightRadius={message.sender === "mine" ? 4 : 18}
              borderBottomLeftRadius={message.sender === "theirs" ? 4 : 18}
              padding={13}
              backgroundColor={
                message.sender === "mine" ? "$primary" : "$surface"
              }
              borderWidth={message.sender === "theirs" ? 1 : 0}
              borderColor="$border"
            >
              <AppText
                fontSize={14}
                lineHeight={21}
                color={message.sender === "mine" ? "$onPrimary" : "$color"}
              >
                {message.text}
              </AppText>
            </YStack>
            <AppText
              fontSize={10}
              lineHeight={15}
              color="$muted"
              textAlign={message.sender === "mine" ? "right" : "left"}
            >
              {message.sender === "mine"
                ? "Você"
                : `${companion.name} · simulado`}{" "}
              ·{" "}
              {clockTime(
                message.at,
                state.intent?.timeZone ?? "America/Sao_Paulo",
              )}
            </AppText>
          </YStack>
        ))}
      </YStack>
      <AppModal
        open={safety}
        title="Viaje com cuidado"
        description="Combine o encontro em um ponto público e confira os detalhes antes de sair."
        onClose={() => setSafety(false)}
      >
        <Quiet>
          Não compartilhe códigos de acesso nem dados de pagamento na conversa.
          Este chat é uma demonstração local; não há equipe de moderação ou
          envio de denúncias conectado.
        </Quiet>
      </AppModal>
    </DemoPage>
  );
}

import { Redirect, router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView } from "react-native";
import { Input, XStack, YStack } from "tamagui";
import { services } from "../../services";
import { AppButton, AppText } from "../../ui/components";
import { AgreementHeader } from "./AgreementUi";
import { DemoPage } from "./DemoPage";
import { clockTime, isAgreed, stageHref } from "./domain";
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
  if (state.postTrip) return <Redirect href={stageHref(state)} />;
  if (!state.matched || !state.proposal || !state.intent)
    return <Redirect href="/" />;
  const proposal = state.proposal;
  const companion = state.candidates.find((c) => c.id === state.matched);
  if (!companion) return <Redirect href="/" />;
  const agreed = isAgreed(proposal);
  const post = (text: string) => {
    if (!text.trim()) return;
    send(
      {
        type: "chat",
        text,
        sender: "mine",
        negotiation: proposal.negotiation,
      },
      () => setDraft(""),
    );
  };
  return (
    <DemoPage
      autoScroll
      header={<AgreementHeader active="chat" />}
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
            {services.config.demo ? (
              <Chip
                dashed
                label="Demo: simular resposta da companhia"
                onPress={() =>
                  send({
                    type: "chat",
                    sender: "theirs",
                    text: "Por mim tudo bem! Vamos escolher a mesma opção na proposta. Eu posso pedir o carro e combinamos o repasse aqui.",
                    negotiation: proposal.negotiation,
                  })
                }
              />
            ) : null}
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
            label={agreed ? "Ver viagem combinada" : "Ver proposta"}
            onPress={() => router.push(agreed ? "/viagem" : "/proposta")}
          />
        </>
      }
    >
      <Quiet>
        Combine o encontro e quem vai pedir o carro. Depois, escolham a mesma
        opção na aba Proposta.
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
                : `${companion.name}${services.config.demo ? " · simulado" : ""}`}{" "}
              ·{" "}
              {clockTime(
                message.at,
                state.intent?.timeZone ?? "America/Sao_Paulo",
              )}
            </AppText>
          </YStack>
        ))}
      </YStack>
    </DemoPage>
  );
}

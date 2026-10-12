import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { XStack, YStack } from "tamagui";
import { AppText } from "../../ui/components";
import { type Candidate, clockTime, commonWindow, type Intent } from "./domain";

export function TextAction({
  label,
  onPress,
  accessibilityLabel,
  danger = false,
  icon,
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  danger?: boolean;
  icon?: "person" | "search" | "calendar" | "clock";
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        minWidth: 48,
        justifyContent: "center",
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <XStack gap={6} alignItems="center" justifyContent="center">
        {icon ? <LineIcon kind={icon} /> : null}
        <AppText
          fontSize={13}
          lineHeight={19}
          textAlign="center"
          color={danger ? "$errorText" : "$muted"}
        >
          {label}
        </AppText>
      </XStack>
    </Pressable>
  );
}
export function LineIcon({
  kind,
}: {
  kind: "person" | "search" | "calendar" | "clock";
}) {
  const color = "#5F685C";
  return (
    <View
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: 18, height: 18 }}
    >
      {kind === "person" ? (
        <>
          <View
            style={{
              position: "absolute",
              left: 6,
              top: 1,
              width: 6,
              height: 6,
              borderWidth: 1.3,
              borderColor: color,
              borderRadius: 5,
            }}
          />
          <View
            style={{
              position: "absolute",
              left: 3,
              top: 9,
              width: 12,
              height: 8,
              borderWidth: 1.3,
              borderBottomWidth: 0,
              borderColor: color,
              borderTopLeftRadius: 8,
              borderTopRightRadius: 8,
            }}
          />
        </>
      ) : kind === "search" ? (
        <>
          <View
            style={{
              position: "absolute",
              left: 1,
              top: 1,
              width: 11,
              height: 11,
              borderWidth: 1.3,
              borderColor: color,
              borderRadius: 9,
            }}
          />
          <View
            style={{
              position: "absolute",
              left: 11,
              top: 10,
              width: 1.3,
              height: 7,
              backgroundColor: color,
              transform: [{ rotate: "-45deg" }],
            }}
          />
        </>
      ) : kind === "calendar" ? (
        <>
          <View
            style={{
              position: "absolute",
              left: 2,
              top: 4,
              width: 14,
              height: 12,
              borderWidth: 1.3,
              borderColor: color,
              borderRadius: 3,
            }}
          />
          <View
            style={{
              position: "absolute",
              left: 3,
              top: 8,
              width: 12,
              height: 1,
              backgroundColor: color,
            }}
          />
          {[6, 12].map((left) => (
            <View
              key={left}
              style={{
                position: "absolute",
                left,
                top: 1,
                width: 1.3,
                height: 5,
                backgroundColor: color,
              }}
            />
          ))}
        </>
      ) : (
        <>
          <View
            style={{
              position: "absolute",
              left: 1,
              top: 1,
              width: 16,
              height: 16,
              borderWidth: 1.3,
              borderColor: color,
              borderRadius: 10,
            }}
          />
          <View
            style={{
              position: "absolute",
              left: 8,
              top: 4,
              width: 1.3,
              height: 5,
              backgroundColor: color,
            }}
          />
          <View
            style={{
              position: "absolute",
              left: 8,
              top: 8,
              width: 4,
              height: 1.3,
              backgroundColor: color,
            }}
          />
        </>
      )}
    </View>
  );
}
export function Quiet({ children }: { children: ReactNode }) {
  return (
    <AppText fontSize={12} lineHeight={18} color="$muted">
      {children}
    </AppText>
  );
}
export function RouteLines({
  origin,
  destination,
}: {
  origin: string;
  destination: string;
}) {
  return (
    <XStack gap={12} alignItems="center">
      <YStack alignItems="center">
        <YStack
          width={10}
          height={10}
          borderWidth={2}
          borderColor="$color"
          borderRadius={8}
        />
        <YStack height={26} width={1} backgroundColor="$border" />
        <YStack width={10} height={10} backgroundColor="$color" />
      </YStack>
      <YStack flex={1} gap={12}>
        <AppText fontSize={13} lineHeight={19}>
          {origin}
        </AppText>
        <AppText fontSize={13} lineHeight={19}>
          {destination}
        </AppText>
      </YStack>
    </XStack>
  );
}
export function PersonCard({
  candidate,
  intent,
  waiting = false,
}: {
  candidate: Candidate;
  intent: Intent;
  waiting?: boolean;
}) {
  const window = commonWindow(intent, candidate);
  const total = intent.passengers + candidate.passengers;
  return (
    <YStack
      backgroundColor="$surface"
      borderWidth={1}
      borderColor="$border"
      borderRadius={22}
      padding={18}
      gap={12}
    >
      <AppText
        fontSize={10}
        lineHeight={15}
        letterSpacing={waiting ? 0 : 1.1}
        color="$muted"
        fontWeight="600"
      >
        {waiting ? "●  Aguardando resposta" : "NO SEU CAMINHO"}
      </AppText>
      <AppText
        fontSize={waiting ? 30 : 36}
        lineHeight={waiting ? 34 : 40}
        fontWeight="700"
        letterSpacing={-1.2}
      >
        {candidate.name}
      </AppText>
      <AppText fontSize={12} lineHeight={18}>
        ★ {candidate.rating}{" "}
        <AppText fontSize={11} color="$muted">
          {" "}
          · {candidate.trips} viagens · {candidate.passengers}{" "}
          {candidate.passengers === 1 ? "passageiro" : "passageiros"}
        </AppText>
      </AppText>
      {!waiting ? (
        <YStack borderTopWidth={1} borderColor="$border" paddingTop={12}>
          <AppText fontSize={13} fontWeight="600">
            ◷{" "}
            {new Intl.DateTimeFormat("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              timeZone: intent.timeZone,
            }).format(candidate.departure)}{" "}
            · {clockTime(candidate.departure, intent.timeZone)}
          </AppText>
        </YStack>
      ) : null}
      {candidate.fixed ? <Quiet>Precisa sair nesse horário</Quiet> : null}
      <XStack
        backgroundColor="$success"
        borderRadius={10}
        padding={10}
        gap={6}
        flexWrap="wrap"
        justifyContent="space-between"
        alignItems="center"
      >
        <AppText fontSize={10} lineHeight={16} color="$muted">
          {waiting ? "Horário compatível" : "Horário que funciona para vocês"}
        </AppText>
        <AppText
          fontSize={14}
          lineHeight={20}
          color="$primary"
          fontWeight="700"
        >
          {window
            ? `${clockTime(window.start, intent.timeZone)}${window.start === window.end ? "" : `–${clockTime(window.end, intent.timeZone)}`}`
            : "Indisponível"}
        </AppText>
      </XStack>
      <XStack>
        <YStack flex={1} gap={4} paddingRight={10}>
          <AppText fontSize={24} lineHeight={28} fontWeight="700">
            {candidate.pickup}{" "}
            <AppText fontSize={11} color="$muted">
              m a pé
            </AppText>
          </AppText>
          <Quiet>Da sua origem{"\n"}até o embarque</Quiet>
        </YStack>
        <YStack
          flex={1}
          gap={4}
          paddingLeft={16}
          borderLeftWidth={1}
          borderColor="$border"
        >
          <AppText fontSize={24} lineHeight={28} fontWeight="700">
            {candidate.dropoff}{" "}
            <AppText fontSize={11} color="$muted">
              m a pé
            </AppText>
          </AppText>
          <Quiet>Do desembarque{"\n"}até seu destino</Quiet>
        </YStack>
      </XStack>
      <YStack backgroundColor="$background" borderRadius={8} padding={9}>
        <AppText
          fontSize={10}
          lineHeight={16}
          textAlign="center"
          color="$primary"
        >
          {total === 2
            ? "Divisão igual: metade para cada pessoa"
            : `Divisão por pessoa: você ${intent.passengers}/${total} · ${candidate.name} ${candidate.passengers}/${total}`}
        </AppText>
      </YStack>
    </YStack>
  );
}

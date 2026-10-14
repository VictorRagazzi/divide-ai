import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { XStack, YStack } from "tamagui";
import { AppText } from "../../ui/components";

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
  icon?: IconKind;
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
export type IconKind =
  | "person"
  | "search"
  | "calendar"
  | "clock"
  | "locate"
  | "pin"
  | "back";
export function LineIcon({
  kind,
  color = "#5F685C",
}: {
  kind: IconKind;
  color?: string;
}) {
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
      ) : kind === "locate" ? (
        <>
          <View
            style={{
              position: "absolute",
              left: 3,
              top: 3,
              width: 12,
              height: 12,
              borderWidth: 1.5,
              borderColor: color,
              borderRadius: 7,
            }}
          />
          <View
            style={{
              position: "absolute",
              left: 7,
              top: 7,
              width: 4,
              height: 4,
              borderRadius: 2,
              backgroundColor: color,
            }}
          />
          {[
            { left: 8.5, top: 0, width: 1.5, height: 3 },
            { left: 8.5, top: 15, width: 1.5, height: 3 },
            { left: 0, top: 8.5, width: 3, height: 1.5 },
            { left: 15, top: 8.5, width: 3, height: 1.5 },
          ].map((tick) => (
            <View
              key={`${tick.left}-${tick.top}`}
              style={{ position: "absolute", backgroundColor: color, ...tick }}
            />
          ))}
        </>
      ) : kind === "pin" ? (
        <>
          <View
            style={{
              position: "absolute",
              left: 3,
              top: 1,
              width: 12,
              height: 12,
              borderWidth: 1.5,
              borderColor: color,
              borderRadius: 7,
            }}
          />
          <View
            style={{
              position: "absolute",
              left: 7,
              top: 5,
              width: 4,
              height: 4,
              borderRadius: 2,
              backgroundColor: color,
            }}
          />
          <View
            style={{
              position: "absolute",
              left: 8.2,
              top: 12,
              width: 1.5,
              height: 5,
              backgroundColor: color,
            }}
          />
        </>
      ) : kind === "back" ? (
        <>
          <View
            style={{
              position: "absolute",
              left: 5,
              top: 5,
              width: 9,
              height: 9,
              borderLeftWidth: 1.8,
              borderBottomWidth: 1.8,
              borderColor: color,
              transform: [{ rotate: "45deg" }],
            }}
          />
          <View
            style={{
              position: "absolute",
              left: 3,
              top: 8.2,
              width: 13,
              height: 1.8,
              backgroundColor: color,
            }}
          />
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

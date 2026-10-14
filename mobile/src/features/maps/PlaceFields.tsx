import type { RefObject } from "react";
import { Pressable } from "react-native";
import { Input, type TamaguiElement, XStack, YStack } from "tamagui";
import { AppText } from "../../ui/components";
import type { Endpoint } from "./model";

export function PlaceFields({
  values,
  selected,
  disabled = false,
  onFocus,
  onChange,
  onSubmit,
  refs,
  autofocus = false,
}: {
  values: Record<Endpoint, string>;
  selected: Endpoint;
  disabled?: boolean;
  onFocus: (endpoint: Endpoint) => void;
  onChange: (endpoint: Endpoint, text: string) => void;
  onSubmit?: (endpoint: Endpoint) => void;
  refs?: Record<Endpoint, RefObject<TamaguiElement | null>>;
  autofocus?: boolean;
}) {
  return (
    <YStack
      position="relative"
      gap={4}
      backgroundColor="$background"
      padding={8}
      borderRadius={12}
    >
      <YStack
        position="absolute"
        left={17.5}
        top={37}
        height={42}
        width={1}
        backgroundColor="$border"
        aria-hidden
      />
      {(["origin", "destination"] as const).map((endpoint) => (
        <XStack key={endpoint} alignItems="center" gap={8}>
          <YStack width={20} alignItems="center" aria-hidden>
            <YStack
              width={endpoint === "origin" ? 9 : 10}
              height={endpoint === "origin" ? 9 : 10}
              borderRadius={endpoint === "origin" ? 8 : 1}
              borderWidth={2}
              borderColor="$color"
            />
          </YStack>
          <Input
            ref={refs?.[endpoint]}
            aria-label={
              endpoint === "origin" ? "Local de partida" : "Para onde?"
            }
            placeholder={
              endpoint === "origin" ? "Local de partida" : "Para onde?"
            }
            value={values[endpoint]}
            disabled={disabled}
            aria-disabled={disabled}
            onFocus={() => onFocus(endpoint)}
            onChangeText={(value) => onChange(endpoint, value)}
            onSubmitEditing={() => onSubmit?.(endpoint)}
            returnKeyType="search"
            autoCorrect={false}
            autoFocus={autofocus && selected === endpoint}
            autoCapitalize="words"
            maxLength={160}
            flex={1}
            minWidth={0}
            height={48}
            fontSize={14}
            textOverflow="ellipsis"
            borderWidth={1}
            borderColor={
              selected === endpoint && !disabled ? "$primary" : "transparent"
            }
            backgroundColor="$surface"
            color="$color"
            borderRadius={8}
          />
          {!disabled && values[endpoint] ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Limpar ${endpoint === "origin" ? "origem" : "destino"}`}
              onPress={() => {
                onChange(endpoint, "");
                refs?.[endpoint].current?.focus();
              }}
              style={{
                minWidth: 44,
                minHeight: 48,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AppText fontSize={18}>×</AppText>
            </Pressable>
          ) : null}
        </XStack>
      ))}
    </YStack>
  );
}

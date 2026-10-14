import { useRef } from "react";
import { Pressable } from "react-native";
import { type TamaguiElement, XStack, YStack } from "tamagui";
import { services } from "../../services";
import { AppText } from "../../ui/components";
import { digits, PartInput } from "./Kit";

// Ação só da demonstração (simula algo que, no app real, vem de outra pessoa
// ou do sistema). Tracejada, para não ser confundida com uma ação do produto.
export function DemoAction({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  // Com backend a outra pessoa e o relógio são reais: não há o que simular.
  if (!services.config.demo) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 14,
        borderRadius: 20,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: "#9AA39A",
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <AppText fontSize={13} lineHeight={18} color="$muted" textAlign="center">
        {label}
      </AppText>
    </Pressable>
  );
}

export const STAR_WORDS = ["Ruim", "Fraca", "Regular", "Boa", "Ótima"];

// Nota de 1 a 5 estrelas. Cada estrela é um botão de 52 dp; o grupo é um radiogroup.
export function StarRating({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (stars: number) => void;
  label: string;
}) {
  return (
    <YStack gap={6}>
      <XStack role="radiogroup" aria-label={label} gap={4}>
        {[1, 2, 3, 4, 5].map((stars) => (
          <Pressable
            key={stars}
            accessibilityRole="radio"
            accessibilityLabel={`${stars} ${stars === 1 ? "estrela" : "estrelas"}, ${STAR_WORDS[stars - 1]}`}
            accessibilityState={{ checked: value === stars }}
            onPress={() => onChange(stars)}
            style={({ pressed }) => ({
              width: 52,
              height: 52,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <AppText
              fontSize={36}
              lineHeight={42}
              color={stars <= value ? "$primary" : "$border"}
              aria-hidden
            >
              ★
            </AppText>
          </Pressable>
        ))}
      </XStack>
      <AppText
        fontSize={14}
        lineHeight={20}
        fontWeight="600"
        color={value ? "$color" : "$muted"}
        aria-live="polite"
      >
        {value
          ? `${value} de 5 · ${STAR_WORDS[value - 1]}`
          : "Toque numa estrela"}
      </AppText>
    </YStack>
  );
}

// Estrelas só para leitura ("★★★★☆ 4 de 5").
export function StarsText({ stars }: { stars: number }) {
  return (
    <AppText
      fontSize={16}
      lineHeight={22}
      fontWeight="700"
      accessibilityLabel={`${stars} de 5 estrelas`}
    >
      {"★".repeat(stars)}
      {"☆".repeat(5 - stars)}{" "}
      <AppText fontSize={13} color="$muted">
        {stars} de 5
      </AppText>
    </AppText>
  );
}

// Uma opção entre várias (radio). Linhas de 52 dp, a escolhida com borda e ✓.
export function ChoiceList<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T | null;
  onChange: (id: T) => void;
}) {
  return (
    <YStack role="radiogroup" aria-label={label} gap={8}>
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(option.id)}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <XStack
              gap={12}
              alignItems="center"
              minHeight={52}
              paddingHorizontal={14}
              paddingVertical={8}
              borderRadius={14}
              borderWidth={selected ? 2 : 1}
              borderColor={selected ? "$primary" : "$border"}
              backgroundColor="$surface"
            >
              <YStack
                width={22}
                height={22}
                borderRadius={11}
                borderWidth={2}
                borderColor={selected ? "$primary" : "$border"}
                backgroundColor={selected ? "$primary" : "$surface"}
                alignItems="center"
                justifyContent="center"
              >
                {selected ? (
                  <AppText fontSize={12} lineHeight={14} color="$onPrimary">
                    ✓
                  </AppText>
                ) : null}
              </YStack>
              <AppText
                flex={1}
                fontSize={15}
                lineHeight={21}
                fontWeight={selected ? "700" : "500"}
              >
                {option.label}
              </AppText>
            </XStack>
          </Pressable>
        );
      })}
    </YStack>
  );
}

// Data de nascimento em três partes (dia / mês / ano), só dígitos.
export function BirthField({
  day,
  month,
  year,
  error,
  onChange,
}: {
  day: string;
  month: string;
  year: string;
  error?: string;
  onChange: (parts: { day: string; month: string; year: string }) => void;
}) {
  const monthRef = useRef<TamaguiElement>(null);
  const yearRef = useRef<TamaguiElement>(null);
  return (
    <YStack gap={6}>
      <AppText fontWeight="600">Data de nascimento</AppText>
      <XStack alignItems="center" gap={6}>
        <PartInput
          boxed
          invalid={Boolean(error)}
          label="Dia de nascimento"
          value={day}
          onChange={(value) => {
            const next = digits(value, 2);
            onChange({ day: next, month, year });
            if (next.length === 2) monthRef.current?.focus();
          }}
        />
        <AppText fontSize={22} fontWeight="700">
          /
        </AppText>
        <PartInput
          boxed
          invalid={Boolean(error)}
          label="Mês de nascimento"
          inputRef={monthRef}
          value={month}
          onChange={(value) => {
            const next = digits(value, 2);
            onChange({ day, month: next, year });
            if (next.length === 2) yearRef.current?.focus();
          }}
        />
        <AppText fontSize={22} fontWeight="700">
          /
        </AppText>
        <PartInput
          boxed
          invalid={Boolean(error)}
          label="Ano de nascimento"
          inputRef={yearRef}
          width={76}
          value={year}
          onChange={(value) => onChange({ day, month, year: digits(value, 4) })}
        />
      </XStack>
      {error ? (
        <AppText fontSize={13} lineHeight={18} color="$errorText" role="alert">
          {error}
        </AppText>
      ) : null}
    </YStack>
  );
}

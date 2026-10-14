import {
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Pressable,
} from "react-native";
import { Input, type TamaguiElement, XStack, YStack } from "tamagui";
import { AppText } from "../../ui/components";
import { whenLabel } from "./domain";
import { LineIcon } from "./JourneyUi";

type IconKind = Parameters<typeof LineIcon>[0]["kind"];

// Selo discreto que substitui a faixa de rodapé "MVP demo" em cada tela.
export function DemoBadge() {
  return (
    <YStack
      paddingHorizontal={8}
      paddingVertical={3}
      borderRadius={8}
      borderWidth={1}
      borderColor="$border"
      backgroundColor="$surface"
      accessible
      accessibilityLabel="Demonstração: companhias simuladas, sem cobranças"
    >
      <AppText
        fontSize={10}
        lineHeight={14}
        letterSpacing={0.8}
        fontWeight="700"
        color="$muted"
      >
        DEMO
      </AppText>
    </YStack>
  );
}

// Informação curta (ícone + texto). Com onPress vira botão de 48 dp.
export function Chip({
  icon,
  label,
  onPress,
  tone = "neutral",
  accessibilityLabel,
  fullWidth = false,
}: {
  icon?: IconKind;
  label: string;
  onPress?: () => void;
  tone?: "neutral" | "success";
  accessibilityLabel?: string;
  fullWidth?: boolean;
}) {
  const body = (
    <XStack
      gap={8}
      alignItems="center"
      justifyContent="center"
      paddingHorizontal={12}
      minHeight={onPress ? 48 : 32}
      borderRadius={onPress ? 14 : 16}
      borderWidth={fullWidth ? 1.5 : 0}
      borderColor="$primary"
      backgroundColor={tone === "success" ? "$success" : "$background"}
    >
      {icon ? <LineIcon kind={icon} /> : null}
      <AppText
        fontSize={fullWidth ? 14 : 13}
        lineHeight={fullWidth ? 20 : 18}
        fontWeight={fullWidth ? "700" : "600"}
        color={tone === "success" ? "$successText" : "$color"}
        flexShrink={1}
      >
        {label}
      </AppText>
    </XStack>
  );
  if (!onPress) return body;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: pressed ? 0.6 : 1,
        ...(fullWidth ? { alignSelf: "stretch" as const } : null),
      })}
    >
      {body}
    </Pressable>
  );
}

export function Avatar({ name, size = 48 }: { name: string; size?: number }) {
  return (
    <YStack
      width={size}
      height={size}
      borderRadius={size / 2}
      backgroundColor="$success"
      alignItems="center"
      justifyContent="center"
      aria-hidden
    >
      <AppText
        fontSize={size * 0.42}
        lineHeight={size * 0.5}
        fontWeight="700"
        color="$primary"
      >
        {name.charAt(0).toUpperCase()}
      </AppText>
    </YStack>
  );
}

// Botão redondo (voltar, GPS). 48 dp.
export function RoundButton({
  label,
  onPress,
  children,
  busy = false,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
  busy?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy }}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#DFE3DB",
        opacity: pressed || busy ? 0.6 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}

// Ponto que pulsa enquanto algo está acontecendo; parado se o sistema pede menos movimento.
export function PulseDot({ size = 10 }: { size?: number }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const [still, setStill] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => mounted && setStill(value))
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    if (still) {
      opacity.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.25,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== "web",
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [still, opacity]);
  return (
    <Animated.View
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#172E25",
        opacity,
      }}
    />
  );
}

export type Step = { label: string; state: "done" | "current" | "todo" };

// Progresso do pedido em poucas etapas, no lugar de parágrafos explicativos.
export function StatusSteps({ steps }: { steps: Step[] }) {
  return (
    <XStack
      accessible
      accessibilityLabel={steps
        .map(
          (step) =>
            `${step.label}: ${step.state === "done" ? "concluído" : step.state === "current" ? "agora" : "depois"}`,
        )
        .join(". ")}
    >
      {steps.map((step, index) => (
        <YStack key={step.label} flex={1} gap={6} alignItems="center">
          <XStack alignItems="center" width="100%">
            <YStack
              flex={1}
              height={2}
              backgroundColor={
                index === 0
                  ? "transparent"
                  : steps[index - 1]?.state === "done"
                    ? "$primary"
                    : "$border"
              }
            />
            <YStack
              width={22}
              height={22}
              borderRadius={11}
              alignItems="center"
              justifyContent="center"
              backgroundColor={step.state === "done" ? "$primary" : "$surface"}
              borderWidth={2}
              borderColor={step.state === "todo" ? "$border" : "$primary"}
            >
              {step.state === "done" ? (
                <AppText fontSize={12} lineHeight={14} color="$onPrimary">
                  ✓
                </AppText>
              ) : step.state === "current" ? (
                <PulseDot size={8} />
              ) : null}
            </YStack>
            <YStack
              flex={1}
              height={2}
              backgroundColor={
                index === steps.length - 1
                  ? "transparent"
                  : step.state === "done"
                    ? "$primary"
                    : "$border"
              }
            />
          </XStack>
          <AppText
            fontSize={12}
            lineHeight={16}
            textAlign="center"
            fontWeight={step.state === "current" ? "700" : "500"}
            color={step.state === "todo" ? "$muted" : "$color"}
          >
            {step.label}
          </AppText>
        </YStack>
      ))}
    </XStack>
  );
}

export const digits = (value: string, max: number) =>
  value.replace(/\D/g, "").slice(0, max);

export function PartInput({
  label,
  value,
  onChange,
  inputRef,
  width = 52,
  autoFocus = false,
  boxed = false,
  invalid = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputRef?: RefObject<TamaguiElement | null>;
  width?: number;
  autoFocus?: boolean;
  /** Com borda e fundo de cartão, para uso direto sobre o fundo da página. */
  boxed?: boolean;
  /** Borda de erro, no mesmo padrão dos demais campos. */
  invalid?: boolean;
}) {
  return (
    <Input
      ref={inputRef}
      autoFocus={autoFocus}
      aria-label={label}
      value={value}
      onChangeText={onChange}
      keyboardType="number-pad"
      inputMode="numeric"
      maxLength={width > 60 ? 4 : 2}
      selectTextOnFocus
      width={width}
      height={48}
      padding={0}
      textAlign="center"
      fontSize={22}
      fontWeight="700"
      aria-invalid={invalid}
      borderWidth={invalid ? 2 : boxed ? 1 : 0}
      borderColor={invalid ? "$errorText" : "$controlBorder"}
      borderRadius={10}
      backgroundColor={boxed ? "$surface" : "$background"}
      color="$color"
      focusStyle={{ outlineWidth: 2, outlineColor: "$primary" }}
    />
  );
}

// Um único campo de data e hora: hora e minuto primeiro (foco inicial), dia e
// mês depois, só para quem quiser trocar. O ano acompanha a data atual.
export function DateTimeField({
  date,
  time,
  now,
  error,
  onChange,
}: {
  date: string;
  time: string;
  now: number;
  error?: string;
  onChange: (date: string, time: string) => void;
}) {
  const [year = "", month = "", day = ""] = date.split("-");
  const [hour = "", minute = ""] = time.split(":");
  const [parts, setParts] = useState({
    hh: hour,
    mi: minute,
    dd: day,
    mo: month,
  });
  const minuteRef = useRef<TamaguiElement>(null);
  const update = (next: typeof parts) => {
    setParts(next);
    const two = (value: string) => (value ? value.padStart(2, "0") : "");
    onChange(
      next.dd && next.mo ? `${year}-${two(next.mo)}-${two(next.dd)}` : "",
      next.hh && next.mi ? `${two(next.hh)}:${two(next.mi)}` : "",
    );
  };
  const when = new Date(`${date}T${time}:00`);
  const caption = Number.isNaN(when.getTime())
    ? ""
    : whenLabel(
        when.getTime(),
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        now,
      ).split(" · ")[0];
  return (
    <YStack gap={6}>
      <AppText fontSize={13} lineHeight={18} fontWeight="600" color="$muted">
        Saída
      </AppText>
      <XStack alignItems="center" gap={6} flexWrap="wrap">
        <PartInput
          autoFocus
          label="Hora"
          value={parts.hh}
          onChange={(value) => {
            const hh = digits(value, 2);
            update({ ...parts, hh });
            if (hh.length === 2) minuteRef.current?.focus();
          }}
        />
        <AppText fontSize={22} fontWeight="700">
          :
        </AppText>
        <PartInput
          label="Minutos"
          inputRef={minuteRef}
          value={parts.mi}
          onChange={(value) => update({ ...parts, mi: digits(value, 2) })}
        />
        <AppText fontSize={14} color="$muted" marginHorizontal={6}>
          em
        </AppText>
        <PartInput
          label="Dia"
          value={parts.dd}
          onChange={(value) => update({ ...parts, dd: digits(value, 2) })}
        />
        <AppText fontSize={22} fontWeight="700">
          /
        </AppText>
        <PartInput
          label="Mês"
          value={parts.mo}
          onChange={(value) => update({ ...parts, mo: digits(value, 2) })}
        />
      </XStack>
      {error ? (
        <AppText fontSize={13} lineHeight={18} color="$errorText" role="alert">
          {error}
        </AppText>
      ) : caption ? (
        <AppText
          fontSize={13}
          lineHeight={18}
          color="$muted"
          aria-live="polite"
        >
          {caption}
        </AppText>
      ) : null}
    </YStack>
  );
}

// Número digitável com setas para rolar entre valores (de `step` em `step`).
export function NumberField({
  label,
  value,
  step,
  min,
  max,
  error,
  onChange,
}: {
  label: string;
  value: string;
  step: number;
  min: number;
  max: number;
  error?: string;
  onChange: (value: string) => void;
}) {
  const current = Number(value);
  const move = (direction: 1 | -1) => {
    const base = Number.isFinite(current) && value !== "" ? current : min;
    const next = Math.round(base / step) * step + direction * step;
    onChange(String(Math.min(max, Math.max(min, next))));
  };
  return (
    <YStack gap={6}>
      <AppText fontSize={13} lineHeight={18} fontWeight="600" color="$muted">
        {label}
      </AppText>
      <XStack alignItems="center" gap={10}>
        <RoundButton label="Diminuir caminhada" onPress={() => move(-1)}>
          <AppText fontSize={22} lineHeight={26}>
            −
          </AppText>
        </RoundButton>
        <Input
          aria-label={label}
          value={value}
          onChangeText={(text) => onChange(digits(text, 4))}
          keyboardType="number-pad"
          inputMode="numeric"
          selectTextOnFocus
          flex={1}
          height={48}
          textAlign="center"
          fontSize={22}
          fontWeight="700"
          borderWidth={0}
          borderRadius={10}
          backgroundColor="$background"
          color="$color"
          focusStyle={{ outlineWidth: 2, outlineColor: "$primary" }}
        />
        <RoundButton label="Aumentar caminhada" onPress={() => move(1)}>
          <AppText fontSize={22} lineHeight={26}>
            +
          </AppText>
        </RoundButton>
      </XStack>
      {error ? (
        <AppText fontSize={13} lineHeight={18} color="$errorText" role="alert">
          {error}
        </AppText>
      ) : null}
    </YStack>
  );
}

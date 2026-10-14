import { type ReactNode, useId } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { InputProps, TextProps } from "tamagui";
import {
  Button,
  Input,
  Text,
  TextArea,
  useTheme,
  XStack,
  YStack,
} from "tamagui";
import { metrics, typography } from "./foundation";
import { useUi } from "./provider";

export function AppText({
  fontSize = "$4",
  lineHeight = "$4",
  ...props
}: TextProps) {
  const { textScale } = useUi();
  const resolve = (value: typeof fontSize, scale: Record<string, number>) => {
    if (typeof value === "number") return value * textScale;
    if (typeof value === "string" && value.startsWith("$"))
      return (scale[value.slice(1)] ?? 16) * textScale;
    return value;
  };
  return (
    <Text
      fontFamily="$body"
      fontSize={resolve(fontSize, typography.size)}
      lineHeight={resolve(lineHeight, typography.lineHeight)}
      color="$color"
      {...props}
    />
  );
}

export function Heading({ children }: { children: ReactNode }) {
  return (
    <AppText role="heading" fontSize="$7" lineHeight="$7" fontWeight="700">
      {children}
    </AppText>
  );
}

type ActionProps = {
  children: string;
  onPress?: () => void;
  disabled?: boolean;
  busy?: boolean;
  selected?: boolean;
  variant?: "primary" | "secondary" | "danger" | "ink";
};

export function AppButton({
  children,
  onPress,
  disabled = false,
  busy = false,
  selected,
  variant = "primary",
}: ActionProps) {
  const theme = useTheme();
  const inactive = disabled || busy;
  const secondary = variant === "secondary";
  const foreground = inactive
    ? "$muted"
    : secondary
      ? "$color"
      : variant === "danger"
        ? "$errorText"
        : "$onPrimary";
  return (
    <Button
      unstyled
      role="button"
      aria-label={busy ? `${children}, em andamento` : children}
      aria-busy={busy}
      aria-pressed={selected}
      disabled={inactive}
      onPress={onPress}
      minHeight={52}
      minWidth="$touch"
      height="auto"
      paddingHorizontal="$md"
      paddingVertical="$sm"
      borderRadius="$control"
      borderWidth={1}
      borderColor={secondary ? "$controlBorder" : "transparent"}
      backgroundColor={
        inactive
          ? "$disabled"
          : secondary
            ? "$surface"
            : variant === "ink"
              ? "#111111"
              : variant === "danger"
                ? "$error"
                : "$primary"
      }
      pressStyle={{ opacity: 0.78 }}
      focusStyle={{ outlineWidth: 2, outlineColor: "$color", outlineOffset: 3 }}
      flexDirection="row"
      gap="$xs"
      alignItems="center"
      justifyContent="center"
    >
      {busy ? <ActivityIndicator color={theme.muted.val} /> : null}
      <AppText
        color={foreground}
        fontWeight="600"
        textAlign="center"
        flexShrink={1}
      >
        {busy ? `${children}…` : children}
      </AppText>
    </Button>
  );
}

type FieldProps = InputProps & { label: string; error?: string; hint?: string };
export function Field({
  label,
  error,
  hint,
  disabled = false,
  ...props
}: FieldProps) {
  const { textScale } = useUi();
  const messageId = useId();
  // Na web, várias linhas exigem <textarea>; o Input do Tamagui é sempre <input>.
  const Control = (props.multiline ? TextArea : Input) as typeof Input;
  return (
    <YStack gap="$xs">
      <AppText fontWeight="600">{label}</AppText>
      <Control
        fontFamily="$body"
        fontSize={typography.size[4] * textScale}
        height="auto"
        minHeight="$touch"
        padding="$sm"
        borderRadius="$control"
        backgroundColor={disabled ? "$disabled" : "$surface"}
        color={disabled ? "$muted" : "$color"}
        placeholderTextColor="$muted"
        borderWidth={error ? 2 : 1}
        borderColor={error ? "$errorText" : "$controlBorder"}
        focusStyle={{
          borderColor: error ? "$errorText" : "$primary",
          borderWidth: 2,
        }}
        hoverStyle={{ borderColor: error ? "$errorText" : "$primary" }}
        disabled={disabled}
        aria-disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error || hint ? messageId : undefined}
        accessibilityHint={error ?? hint}
        aria-label={error ? `${label}. Erro: ${error}` : label}
        {...props}
      />
      {error || hint ? (
        <AppText
          id={messageId}
          color={error ? "$errorText" : "$muted"}
          role={error ? "alert" : undefined}
        >
          {error ?? hint}
        </AppText>
      ) : null}
    </YStack>
  );
}

export function CheckField({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => ({
        minHeight: metrics.touch,
        justifyContent: "center",
        opacity: disabled ? 0.6 : pressed ? 0.78 : 1,
      })}
    >
      <XStack gap="$sm" alignItems="center">
        <YStack
          width="$icon"
          height="$icon"
          borderRadius={4}
          borderWidth={2}
          borderColor="$primary"
          backgroundColor={checked ? "$primary" : "$surface"}
          alignItems="center"
          justifyContent="center"
        >
          {checked ? (
            <Text
              color="$onPrimary"
              fontSize={14}
              lineHeight={18}
              allowFontScaling={false}
              aria-hidden
            >
              ✓
            </Text>
          ) : null}
        </YStack>
        <AppText flexShrink={1}>{label}</AppText>
      </XStack>
    </Pressable>
  );
}

export function Surface({
  children,
  tone = "normal",
}: {
  children: ReactNode;
  tone?: "normal" | "selected" | "error";
}) {
  return (
    <YStack
      padding="$md"
      gap="$sm"
      borderRadius="$card"
      backgroundColor="$surface"
      borderWidth={tone === "normal" ? 1 : 2}
      borderColor={
        tone === "error"
          ? "$errorText"
          : tone === "selected"
            ? "$primary"
            : "$border"
      }
      boxShadow={metrics.shadow}
    >
      {tone !== "normal" ? (
        <Badge tone={tone === "error" ? "error" : "success"}>
          {tone === "error" ? "Revisar" : "Selecionado"}
        </Badge>
      ) : null}
      {children}
    </YStack>
  );
}

type Tone = "neutral" | "success" | "warning" | "error";
const tones = {
  neutral: { background: "$disabled", text: "$color" },
  success: { background: "$success", text: "$successText" },
  warning: { background: "$warning", text: "$warningText" },
  error: { background: "$error", text: "$errorText" },
} as const;

export function Badge({
  children,
  tone = "neutral",
}: {
  children: string;
  tone?: Tone;
}) {
  return (
    <YStack
      alignSelf="flex-start"
      paddingHorizontal="$sm"
      paddingVertical={4}
      borderRadius="$control"
      backgroundColor={tones[tone].background}
    >
      <AppText
        color={tones[tone].text}
        fontSize="$2"
        lineHeight="$2"
        fontWeight="600"
      >
        {children}
      </AppText>
    </YStack>
  );
}

export function Notice({
  title,
  children,
  tone = "neutral",
  live = false,
}: {
  title: string;
  children: string;
  tone?: Tone;
  live?: boolean;
}) {
  return (
    <YStack
      gap="$xs"
      padding="$md"
      borderRadius="$control"
      backgroundColor={tones[tone].background}
      role={tone === "error" ? "alert" : undefined}
      aria-live={live ? "polite" : undefined}
    >
      <AppText fontWeight="700" color={tones[tone].text}>
        {title}
      </AppText>
      <AppText color={tones[tone].text}>{children}</AppText>
    </YStack>
  );
}

export function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <YStack gap="$xs">
      <AppText color="$muted" fontWeight="600">
        DIVIDE AÍ / LAB
      </AppText>
      <Heading>{title}</Heading>
      <AppText color="$muted">{subtitle}</AppText>
    </YStack>
  );
}

export function Feedback({
  kind,
  title,
  description,
  onRetry,
}: {
  kind: "empty" | "error" | "loading";
  title: string;
  description: string;
  onRetry?: () => void;
}) {
  const theme = useTheme();
  return (
    <Surface>
      <YStack gap="$sm" role={kind === "error" ? "alert" : undefined}>
        {kind === "loading" ? (
          <ActivityIndicator
            color={theme.primary.val}
            accessibilityLabel="Carregando"
          />
        ) : null}
        <AppText fontWeight="700">{title}</AppText>
        <AppText color="$muted">{description}</AppText>
        {kind === "error" && onRetry ? (
          <AppButton variant="secondary" onPress={onRetry}>
            Tentar novamente
          </AppButton>
        ) : null}
      </YStack>
    </Surface>
  );
}

export function AppModal({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Modal
      visible={open}
      transparent
      animationType="none"
      onRequestClose={onClose}
      aria-label={title}
    >
      <YStack
        flex={1}
        backgroundColor="rgba(0,0,0,0.6)"
        justifyContent="center"
      >
        <SafeAreaView style={{ flex: 1, justifyContent: "center" }}>
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: "center",
              padding: metrics.space.md,
            }}
            keyboardShouldPersistTaps="handled"
          >
            <YStack
              aria-modal={Platform.OS === "web" ? undefined : true}
              role={Platform.OS === "web" ? undefined : "dialog"}
              aria-label={Platform.OS === "web" ? undefined : title}
              gap="$md"
              padding="$lg"
              borderRadius="$card"
              backgroundColor="$surface"
              width="100%"
              maxWidth={560}
              alignSelf="center"
            >
              <XStack alignItems="flex-start" gap="$sm">
                <YStack flex={1}>
                  <Heading>{title}</Heading>
                </YStack>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Fechar"
                  onPress={onClose}
                  hitSlop={8}
                  style={({ pressed }) => ({
                    width: 48,
                    height: 48,
                    marginTop: -8,
                    marginRight: -8,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <AppText fontSize={22} lineHeight={26} aria-hidden>
                    ✕
                  </AppText>
                </Pressable>
              </XStack>
              {description ? (
                <AppText color="$muted">{description}</AppText>
              ) : null}
              {children}
            </YStack>
          </ScrollView>
        </SafeAreaView>
      </YStack>
    </Modal>
  );
}

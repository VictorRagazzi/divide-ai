import { type Href, router } from "expo-router";
import { type ReactNode, useRef } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Theme, XStack, YStack } from "tamagui";
import { services } from "../../services";
import { AppText, Notice } from "../../ui/components";
import { BottomNavigation, type MainTab } from "./BottomNavigation";
import { LineIcon } from "./JourneyUi";
import { DemoBadge, RoundButton } from "./Kit";
import { useDemo } from "./provider";

export function DemoPage({
  title,
  eyebrow,
  subtitle,
  step,
  children,
  footer,
  back = "/",
  onBack,
  noBack = false,
  header,
  flush = false,
  autoScroll = false,
  tab,
  scrollable = true,
  compact = false,
  demoNote = "footer",
}: {
  title?: string;
  eyebrow?: string;
  subtitle?: string;
  step?: string;
  children: ReactNode;
  footer?: ReactNode;
  back?: Href;
  /** Substitui o "voltar" padrão (que leva a `back`). */
  onBack?: () => void;
  /** Sem botão de voltar (primeira tela, sem para onde voltar). */
  noBack?: boolean;
  header?: ReactNode;
  flush?: boolean;
  autoScroll?: boolean;
  tab?: MainTab;
  scrollable?: boolean;
  /** Título menor e sem eyebrow/subtítulo (telas de decisão rápida). */
  compact?: boolean;
  /** "badge": selo DEMO no cabeçalho; "footer": faixa de rodapé tradicional. */
  demoNote?: "badge" | "footer";
}) {
  const scroll = useRef<ScrollView>(null);
  const { error, clearError } = useDemo();
  const showDemo = services.config.demo;
  return (
    <Theme name="light">
      <YStack flex={1} backgroundColor="#ECEEEA" alignItems="center">
        <SafeAreaView
          style={{
            flex: 1,
            width: "100%",
            maxWidth: 430,
            backgroundColor: "#F7F8F5",
          }}
        >
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            {header ?? (
              <XStack
                paddingHorizontal={20}
                paddingVertical={4}
                alignItems="center"
                justifyContent="space-between"
              >
                {tab || noBack ? (
                  <YStack width={48} minHeight={48} />
                ) : (
                  <RoundButton
                    label="Voltar"
                    onPress={onBack ?? (() => router.replace(back))}
                  >
                    <LineIcon kind="back" color="#121512" />
                  </RoundButton>
                )}
                <AppText
                  fontSize={20}
                  lineHeight={26}
                  fontWeight="800"
                  letterSpacing={-0.8}
                >
                  divide aí
                </AppText>
                {step ? (
                  <AppText
                    width={48}
                    fontSize={11}
                    color="$muted"
                    textAlign="right"
                  >
                    {step}
                  </AppText>
                ) : demoNote === "badge" && showDemo ? (
                  <YStack width={48} alignItems="flex-end">
                    <DemoBadge />
                  </YStack>
                ) : (
                  <YStack width={48} />
                )}
              </XStack>
            )}
            {error ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fechar aviso"
                onPress={clearError}
                style={{ paddingHorizontal: 22, paddingTop: 8 }}
              >
                <Notice tone="error" title="Não foi possível concluir" live>
                  {error}
                </Notice>
              </Pressable>
            ) : null}
            <ScrollView
              scrollEnabled={scrollable}
              ref={scroll}
              onContentSizeChange={
                autoScroll
                  ? () => scroll.current?.scrollToEnd({ animated: false })
                  : undefined
              }
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                flexGrow: 1,
                flex: scrollable ? undefined : 1,
                padding: flush ? 0 : 22,
                paddingTop: flush ? 0 : 18,
              }}
            >
              <YStack flex={1} gap={16}>
                {title ? (
                  <YStack gap={10}>
                    {eyebrow && !compact ? (
                      <AppText
                        fontSize={10}
                        lineHeight={16}
                        letterSpacing={1.6}
                        fontWeight="700"
                        color="$muted"
                      >
                        {eyebrow}
                      </AppText>
                    ) : null}
                    <AppText
                      role="heading"
                      fontSize={compact ? 26 : 30}
                      lineHeight={compact ? 31 : 34}
                      fontWeight="700"
                      letterSpacing={compact ? -0.8 : -1.1}
                    >
                      {title}
                    </AppText>
                    {subtitle && !compact ? (
                      <AppText fontSize={14} lineHeight={21} color="$muted">
                        {subtitle}
                      </AppText>
                    ) : null}
                  </YStack>
                ) : null}
                {children}
              </YStack>
            </ScrollView>
            {footer || tab ? (
              <YStack
                paddingHorizontal={22}
                paddingTop={12}
                paddingBottom={demoNote === "footer" ? 10 : 18}
                gap={8}
                backgroundColor={flush ? "$surface" : "$background"}
                borderTopLeftRadius={flush ? 22 : 0}
                borderTopRightRadius={flush ? 22 : 0}
              >
                {footer}
                {tab ? <BottomNavigation active={tab} /> : null}
              </YStack>
            ) : null}
            {demoNote === "footer" && showDemo ? (
              <AppText
                fontSize={10}
                lineHeight={16}
                color="$muted"
                textAlign="center"
                paddingBottom={6}
              >
                MVP demo · companhias simuladas · sem cobranças
              </AppText>
            ) : null}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </YStack>
    </Theme>
  );
}

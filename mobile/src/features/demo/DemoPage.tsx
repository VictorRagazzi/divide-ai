import { type Href, router } from "expo-router";
import { type ReactNode, useRef } from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Theme, XStack, YStack } from "tamagui";
import { AppText } from "../../ui/components";
import { BottomNavigation, type MainTab } from "./BottomNavigation";
import { TextAction } from "./JourneyUi";

export function DemoPage({
  title,
  eyebrow,
  subtitle,
  step,
  children,
  footer,
  back = "/",
  header,
  flush = false,
  autoScroll = false,
  tab,
  scrollable = true,
}: {
  title?: string;
  eyebrow?: string;
  subtitle?: string;
  step?: string;
  children: ReactNode;
  footer?: ReactNode;
  back?: Href;
  header?: ReactNode;
  flush?: boolean;
  autoScroll?: boolean;
  tab?: MainTab;
  scrollable?: boolean;
}) {
  const scroll = useRef<ScrollView>(null);
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
                {tab ? (
                  <YStack width={48} minHeight={48} />
                ) : (
                  <TextAction
                    label="←"
                    accessibilityLabel="Voltar"
                    onPress={() => router.replace(back)}
                  />
                )}
                <AppText
                  fontSize={20}
                  lineHeight={26}
                  fontWeight="800"
                  letterSpacing={-0.8}
                >
                  divide aí
                </AppText>
                <AppText
                  width={48}
                  fontSize={11}
                  color="$muted"
                  textAlign="right"
                >
                  {step ?? ""}
                </AppText>
              </XStack>
            )}
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
                    {eyebrow ? (
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
                      fontSize={30}
                      lineHeight={34}
                      fontWeight="700"
                      letterSpacing={-1.1}
                    >
                      {title}
                    </AppText>
                    {subtitle ? (
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
                paddingBottom={10}
                gap={8}
                backgroundColor={flush ? "$surface" : "$background"}
                borderTopLeftRadius={flush ? 22 : 0}
                borderTopRightRadius={flush ? 22 : 0}
              >
                {footer}
                {tab ? <BottomNavigation active={tab} /> : null}
              </YStack>
            ) : null}
            <AppText
              fontSize={10}
              lineHeight={16}
              color="$muted"
              textAlign="center"
              paddingBottom={6}
            >
              MVP demo · companhias simuladas · sem cobranças
            </AppText>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </YStack>
    </Theme>
  );
}

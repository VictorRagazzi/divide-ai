import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { YStack } from "tamagui";
import { AppButton, Heading } from "../ui/components";

export default function NotFound() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <YStack
        flex={1}
        padding="$lg"
        gap="$md"
        backgroundColor="$background"
        justifyContent="center"
      >
        <Heading>Página não encontrada</Heading>
        <AppButton onPress={() => router.replace("/catalogo")}>
          Voltar ao catálogo
        </AppButton>
      </YStack>
    </SafeAreaView>
  );
}

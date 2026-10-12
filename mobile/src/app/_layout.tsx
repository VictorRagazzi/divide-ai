import { Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { DemoProvider } from "../features/demo/provider";
import { UiProvider, useUi } from "../ui/provider";

function Routes() {
  const { dark } = useUi();
  const path = usePathname();
  return (
    <>
      <StatusBar style={dark && path === "/catalogo" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <UiProvider>
          <DemoProvider>
            <Routes />
          </DemoProvider>
        </UiProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

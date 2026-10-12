import { createContext, type ReactNode, useContext, useState } from "react";
import { useColorScheme } from "react-native";
import { TamaguiProvider } from "tamagui";
import config from "../../tamagui.config";

const UiContext = createContext({
  dark: false,
  toggleTheme: () => {},
  textScale: 1,
  toggleTextScale: () => {},
});

export function UiProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [override, setOverride] = useState<boolean>();
  const [textScale, setTextScale] = useState(1);
  const dark = override ?? system === "dark";
  return (
    <UiContext.Provider
      value={{
        dark,
        toggleTheme: () => setOverride(!dark),
        textScale,
        toggleTextScale: () => setTextScale(textScale === 1 ? 1.5 : 1),
      }}
    >
      <TamaguiProvider config={config} defaultTheme={dark ? "dark" : "light"}>
        {children}
      </TamaguiProvider>
    </UiContext.Provider>
  );
}

export const useUi = () => useContext(UiContext);

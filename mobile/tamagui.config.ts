import { defaultConfig } from "@tamagui/config/v5";
import { Platform } from "react-native";
import { createFont, createTamagui } from "tamagui";
import { metrics, palette, typography } from "./src/ui/foundation";

// System fonts avoid remote assets and font loading during this foundation stage.
const body = createFont({
  family: Platform.select({
    web: "system-ui",
    android: "sans-serif",
    default: "System",
  }),
  ...typography,
  weight: { 4: "400", 6: "600", 7: "700" },
});

export const config = createTamagui({
  ...defaultConfig,
  settings: {
    ...defaultConfig.settings,
    onlyAllowShorthands: false,
    fastSchemeChange: false,
    shouldAddPrefersColorThemes: false,
  },
  fonts: { body, heading: body },
  tokens: {
    ...defaultConfig.tokens,
    space: { ...defaultConfig.tokens.space, ...metrics.space },
    size: {
      ...defaultConfig.tokens.size,
      touch: metrics.touch,
      icon: metrics.icon.medium,
    },
    radius: { ...defaultConfig.tokens.radius, ...metrics.radius },
  },
  themes: {
    light: { ...defaultConfig.themes.light, ...palette.light },
    dark: { ...defaultConfig.themes.dark, ...palette.dark },
  },
});

type AppConfig = typeof config;
declare module "tamagui" {
  interface TamaguiCustomConfig extends AppConfig {}
}
export default config;

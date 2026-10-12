import { router } from "expo-router";
import { Pressable } from "react-native";
import { XStack } from "tamagui";
import { AppText } from "../../ui/components";
import { LineIcon } from "./JourneyUi";

const tabs = [
  { id: "buscar", label: "Buscar", icon: "search", href: "/" },
  { id: "viagens", label: "Viagens", icon: "calendar", href: "/viagens" },
  { id: "perfil", label: "Perfil", icon: "person", href: "/perfil" },
] as const;

export type MainTab = (typeof tabs)[number]["id"];

export function BottomNavigation({ active }: { active: MainTab }) {
  return (
    <XStack role="tablist" aria-label="Navegação principal">
      {tabs.map((tab) => (
        <Pressable
          key={tab.id}
          accessibilityRole="tab"
          accessibilityLabel={tab.label}
          accessibilityState={{ selected: active === tab.id }}
          aria-selected={active === tab.id}
          onPress={() => {
            if (active !== tab.id) router.replace(tab.href);
          }}
          style={({ pressed }) => ({
            flex: 1,
            minHeight: 48,
            justifyContent: "center",
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <XStack gap={6} alignItems="center" justifyContent="center">
            <LineIcon kind={tab.icon} />
            <AppText
              fontSize={13}
              lineHeight={19}
              color={active === tab.id ? "$color" : "$muted"}
              fontWeight={active === tab.id ? "700" : "400"}
            >
              {tab.label}
            </AppText>
          </XStack>
        </Pressable>
      ))}
    </XStack>
  );
}

import { Linking, Pressable } from "react-native";
import { AppText } from "../../ui/components";

export function Attribution() {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="Créditos e licença do OpenStreetMap"
      onPress={() =>
        void Linking.openURL("https://www.openstreetmap.org/copyright")
      }
      style={{ backgroundColor: "#FFFFFF", padding: 12, minHeight: 44 }}
    >
      <AppText fontSize={11} lineHeight={20} textAlign="right">
        © OpenStreetMap contributors
      </AppText>
    </Pressable>
  );
}

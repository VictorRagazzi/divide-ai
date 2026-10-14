import { Linking, Pressable } from "react-native";
import { config } from "../../services/config";
import { AppText } from "../../ui/components";

export function Attribution() {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Créditos do mapa: ${config.map.attributionText}`}
      onPress={() => void Linking.openURL(config.map.attributionUrl)}
      style={{ backgroundColor: "#FFFFFF", padding: 12, minHeight: 44 }}
    >
      <AppText fontSize={11} lineHeight={20} textAlign="right">
        {config.map.attributionText}
      </AppText>
    </Pressable>
  );
}

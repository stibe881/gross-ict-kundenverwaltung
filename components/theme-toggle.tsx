import { TouchableOpacity, Text } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";

export function ThemeToggle() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const toggleTheme = () => {
    // Expo's useColorScheme ist read-only, daher funktioniert die Umschaltung
    // nur durch Änderung der System-Einstellungen oder durch einen globalen State
    // Für eine funktionierende Implementierung wäre ein Context Provider nötig
    
    // Temporäre Lösung: Zeige Info-Meldung
    if (typeof alert !== "undefined") {
      alert(
        "Theme-Umschaltung:\n\n" +
        "Die Theme-Einstellung folgt aktuell den Systemeinstellungen Ihres Geräts.\n\n" +
        "Um das Theme zu ändern:\n" +
        "• iOS: Einstellungen → Anzeige & Helligkeit\n" +
        "• Android: Einstellungen → Display → Dunkles Design\n" +
        "• Web: Browser-Einstellungen oder System-Theme"
      );
    }
  };

  return (
    <TouchableOpacity
      onPress={toggleTheme}
      className="flex-row items-center gap-2 bg-surface px-4 py-2 rounded-full border border-border"
      activeOpacity={0.7}
    >
      <IconSymbol
        name={isDark ? "sun.max.fill" : "moon.fill"}
        size={20}
        color={colors.foreground}
      />
      <Text className="text-sm font-medium text-foreground">
        {isDark ? "Hell" : "Dunkel"}
      </Text>
    </TouchableOpacity>
  );
}

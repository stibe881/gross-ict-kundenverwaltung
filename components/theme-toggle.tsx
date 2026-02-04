import { TouchableOpacity, Text, View } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import AsyncStorage from "@react-native-async-storage/async-storage";

export function ThemeToggle() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const toggleTheme = async () => {
    const newScheme = isDark ? "light" : "dark";
    try {
      await AsyncStorage.setItem("theme", newScheme);
      // Theme wird beim nächsten App-Start geladen
      // Für sofortige Änderung müsste man einen globalen State verwenden
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    } catch (error) {
      console.error("Failed to save theme:", error);
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

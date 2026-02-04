import { TouchableOpacity, Text, View } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { setColorScheme } from "@/lib/theme-provider";

export function ThemeToggle() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const toggleTheme = () => {
    setColorScheme(isDark ? "light" : "dark");
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

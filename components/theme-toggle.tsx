import { View, Text, TouchableOpacity, Modal } from "react-native";
import { useState } from "react";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useTheme } from "@/lib/theme-context";

export function ThemeToggle() {
  const colors = useColors();
  const { themeMode, setThemeMode } = useTheme();
  const [showModal, setShowModal] = useState(false);

  const options: Array<{ key: "light" | "dark" | "system"; label: string; icon: any }> = [
    { key: "light", label: "Hell", icon: "sun.max.fill" },
    { key: "dark", label: "Dunkel", icon: "moon.fill" },
    { key: "system", label: "System", icon: "gear" },
  ];

  const currentOption = options.find((opt) => opt.key === themeMode) || options[2];

  return (
    <>
      <TouchableOpacity
        onPress={() => setShowModal(true)}
        className="flex-row items-center gap-2 bg-surface px-4 py-2 rounded-full border border-border"
        activeOpacity={0.7}
      >
        <IconSymbol
          name={currentOption.icon}
          size={20}
          color={colors.foreground}
        />
        <Text className="text-sm font-medium text-foreground">
          {currentOption.label}
        </Text>
      </TouchableOpacity>

      <Modal
        visible={showModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowModal(false)}
      >
        <TouchableOpacity
          className="flex-1 bg-black/50 justify-center items-center"
          activeOpacity={1}
          onPress={() => setShowModal(false)}
        >
          <TouchableOpacity
            className="bg-background rounded-2xl p-6 mx-6 w-80 border border-border"
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="text-xl font-bold text-foreground mb-4">
              Design wählen
            </Text>

            <View className="gap-3">
              {options.map((option) => (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => {
                    setThemeMode(option.key === "system" ? "dark" : option.key);
                    setShowModal(false);
                  }}
                  className={`flex-row items-center gap-3 p-4 rounded-lg border ${
                    themeMode === option.key
                      ? "bg-primary/10 border-primary"
                      : "bg-surface border-border"
                  }`}
                  activeOpacity={0.7}
                >
                  <IconSymbol
                    name={option.icon}
                    size={24}
                    color={
                      themeMode === option.key ? colors.primary : colors.foreground
                    }
                  />
                  <Text
                    className={`text-base font-semibold flex-1 ${
                      themeMode === option.key
                        ? "text-primary"
                        : "text-foreground"
                    }`}
                  >
                    {option.label}
                  </Text>
                  {themeMode === option.key && (
                    <View className="w-6 h-6 rounded-full bg-primary items-center justify-center">
                      <Text className="text-background font-bold">✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={() => setShowModal(false)}
              className="mt-4 bg-surface border border-border py-3 rounded-lg"
              activeOpacity={0.7}
            >
              <Text className="text-foreground font-semibold text-center">
                Abbrechen
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

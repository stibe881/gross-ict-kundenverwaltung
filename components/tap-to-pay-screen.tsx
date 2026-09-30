import { Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

// Web-Fallback: Tap to Pay funktioniert nur in der nativen App (iPhone/Android)
export default function TapToPayScreen() {
  const colors = useColors();
  const router = useRouter();

  return (
    <ScreenContainer>
      <View className="flex-1 items-center justify-center gap-4 p-8">
        <IconSymbol name="wave.3.right" size={48} color={colors.muted} />
        <Text className="text-xl font-bold text-foreground text-center">Tap to Pay</Text>
        <Text className="text-sm text-muted text-center">
          Kontaktlose Zahlungen sind nur in der iPhone-App verfügbar.
          Öffne die Gross ICT App auf deinem iPhone, um zu kassieren.
        </Text>
        <TouchableOpacity
          className="bg-surface border border-border px-6 py-3 rounded-xl mt-2"
          activeOpacity={0.8}
          onPress={() => router.back()}
        >
          <Text className="text-foreground font-semibold">Zurück</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

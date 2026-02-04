import { ScrollView, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";

export default function LeadsScreen() {
  return (
    <ScreenContainer>
      <ScrollView className="flex-1 p-4">
        <Text className="text-3xl font-bold text-foreground mb-4">Akquise</Text>
        <View className="bg-surface rounded-2xl p-6 border border-border">
          <Text className="text-base text-muted">
            Akquise-Modul wird implementiert...
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

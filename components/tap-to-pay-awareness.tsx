import { useEffect, useState } from "react";
import { Modal, Platform, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import * as Data from "@/lib/data";
import { supabase } from "@/lib/supabase";

const AWARENESS_KEY = "ttp_awareness_shown";

// Einmaliger Vollbild-Hinweis, dass Tap to Pay auf dem iPhone verfügbar ist
// (Apple-Review-Anforderungen 3.1–3.3: In-App-Awareness-Moment für alle
// berechtigten Benutzer, als Full-Screen-Modal)
export function TapToPayAwareness() {
  const colors = useColors();
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  const { data: session } = useQuery({
    queryKey: ["currentSession"],
    queryFn: async () => (await supabase.auth.getSession()).data.session,
  });
  const { data: profile } = useQuery({
    queryKey: ["userProfile", session?.user?.id],
    queryFn: () => Data.getUserProfile(session?.user?.id as string),
    enabled: !!session?.user?.id,
  });
  const eligible = !!profile?.roles?.some((r: string) => r === "admin" || r === "finanzen");

  useEffect(() => {
    if (Platform.OS !== "ios" || !eligible) return;
    AsyncStorage.getItem(AWARENESS_KEY)
      .then((shown) => { if (!shown) setVisible(true); })
      .catch(() => {});
  }, [eligible]);

  const dismiss = (openScreen: boolean) => {
    setVisible(false);
    AsyncStorage.setItem(AWARENESS_KEY, "1").catch(() => {});
    if (openScreen) router.push("/tap-to-pay");
  };

  if (!visible) return null;

  return (
    <Modal visible animationType="fade" onRequestClose={() => dismiss(false)}>
      <View className="flex-1 bg-background items-center justify-center p-8">
        <View className="items-center gap-6 max-w-md">
          <View
            className="w-28 h-28 rounded-full items-center justify-center"
            style={{ backgroundColor: colors.primary + "15" }}
          >
            {/* Apple-Vorgabe: Kontaktlos-Symbol nur im Bezahl-Screen – hier neutrales Icon */}
            <IconSymbol name="iphone" size={64} color={colors.primary} />
          </View>
          <View className="items-center gap-2">
            <Text className="text-3xl font-bold text-foreground text-center">
              Tap to Pay auf dem iPhone
            </Text>
            <Text className="text-base text-muted text-center">
              Neu kannst du kontaktlose Zahlungen direkt mit deinem iPhone annehmen —
              Karten, Apple Pay und andere Wallets. Ohne zusätzliches Terminal.
            </Text>
          </View>
          <View className="gap-3 w-full mt-4">
            <TouchableOpacity
              className="bg-primary py-4 rounded-xl"
              activeOpacity={0.8}
              onPress={() => dismiss(true)}
            >
              <Text className="text-background font-bold text-center text-base">Jetzt einrichten</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="py-3"
              activeOpacity={0.7}
              onPress={() => dismiss(false)}
            >
              <Text className="text-muted text-center">Später</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

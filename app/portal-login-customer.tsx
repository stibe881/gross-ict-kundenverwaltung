import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";

export default function PortalLoginScreen() {
  const colors = useColors();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Fehler", "Bitte E-Mail und Passwort eingeben");
      return;
    }

    setLoading(true);

    try {
      // Direct Supabase auth for customer portal
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        await AsyncStorage.setItem('customer_portal_user', JSON.stringify({
          id: data.user.id,
          email: data.user.email,
        }));

        router.replace("/portal-tickets-customer");
      } else {
        Alert.alert("Fehler", "Login fehlgeschlagen. Bitte überprüfen Sie Ihre Zugangsdaten.");
      }
    } catch (error) {
      Alert.alert("Fehler", "Login fehlgeschlagen. Bitte überprüfen Sie Ihre Zugangsdaten.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer className="p-6">
      <View className="flex-1 justify-center max-w-md self-center w-full">
        {/* Logo und Titel */}
        <View className="items-center mb-8">
          <Text className="text-3xl font-bold text-foreground mb-2">
            Kunden-Portal
          </Text>
          <Text className="text-base text-muted text-center">
            Melden Sie sich an, um Ihre Tickets einzusehen
          </Text>
        </View>

        {/* Login-Formular */}
        <View className="gap-4">
          <View>
            <Text className="text-sm font-semibold text-foreground mb-2">
              E-Mail
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="ihre.email@firma.ch"
              placeholderTextColor={colors.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              style={{
                backgroundColor: colors.surface,
                color: colors.foreground,
                borderColor: colors.border,
              }}
              className="p-4 rounded-lg border text-base"
            />
          </View>

          <View>
            <Text className="text-sm font-semibold text-foreground mb-2">
              Passwort
            </Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.muted}
              secureTextEntry
              autoComplete="password"
              style={{
                backgroundColor: colors.surface,
                color: colors.foreground,
                borderColor: colors.border,
              }}
              className="p-4 rounded-lg border text-base"
            />
          </View>

          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            style={{ backgroundColor: colors.primary }}
            className="p-4 rounded-lg mt-4"
          >
            {loading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text className="text-background font-semibold text-center text-base">
                Anmelden
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Info-Text */}
        <View
          style={{
            backgroundColor: colors.primary + "10",
            borderColor: colors.primary + "30",
          }}
          className="p-4 rounded-lg border mt-8"
        >
          <Text className="text-sm text-foreground text-center">
            Sie haben noch keinen Zugang?{"\n"}
            Bitte kontaktieren Sie Ihren Ansprechpartner.
          </Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

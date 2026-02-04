import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

// Einfache lokale Authentifizierung (ohne OAuth/Datenbank)
// Test-Credentials:
// - stefan.gross@gross-ict.ch / !LeliBist.1561!
// - joel.hediger@gross-ict.ch / Lümmel.620!

const VALID_USERS = [
  { email: "stefan.gross@gross-ict.ch", password: "!LeliBist.1561!", name: "Stefan Gross" },
  { email: "joel.hediger@gross-ict.ch", password: "Lümmel.620!", name: "Joel Hediger" },
];

export default function LoginScreen() {
  const colors = useColors();
  const router = useRouter();
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
      // Prüfe Credentials
      const user = VALID_USERS.find(
        (u) => u.email === email && u.password === password
      );

      if (user) {
        // Speichere Login-Status
        await AsyncStorage.setItem("isLoggedIn", "true");
        await AsyncStorage.setItem("userEmail", user.email);
        await AsyncStorage.setItem("userName", user.name);

        // Navigiere zum Dashboard
        router.replace("/(tabs)");
      } else {
        Alert.alert("Fehler", "Ungültige E-Mail oder Passwort");
      }
    } catch (error) {
      Alert.alert("Fehler", "Login fehlgeschlagen");
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
            Gross ICT
          </Text>
          <Text className="text-base text-muted text-center">
            Kundenverwaltung
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
              placeholder="ihre.email@gross-ict.ch"
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
              autoCapitalize="none"
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
            style={{
              backgroundColor: colors.primary,
              opacity: loading ? 0.7 : 1,
            }}
            className="p-4 rounded-lg items-center mt-4"
          >
            {loading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text className="text-background font-semibold text-base">
                Anmelden
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Test-Credentials Hinweis */}
        <View className="mt-8 p-4 rounded-lg" style={{ backgroundColor: colors.surface }}>
          <Text className="text-sm text-muted text-center">
            Test-Benutzer:{"\n"}
            stefan.gross@gross-ict.ch{"\n"}
            joel.hediger@gross-ict.ch
          </Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

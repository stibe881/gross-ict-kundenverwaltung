import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { Image } from "expo-image";
import { PasswordResetModal } from "@/components/password-reset-modal";
import { showAlert } from "@/lib/alert";
import { IconSymbol } from "@/components/ui/icon-symbol";
import Svg, { Rect as SvgRect, Path as SvgPath } from "react-native-svg";
import * as Auth from "@/lib/auth";
import * as Biometrics from "@/lib/biometrics";

export default function LoginScreen() {
  const colors = useColors();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showResetModal, setShowResetModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [biometricType, setBiometricType] = useState("");
  const [showBiometric, setShowBiometric] = useState(false);

  // Check if biometric login is available on mount
  useEffect(() => {
    checkBiometrics();
  }, []);

  const checkBiometrics = async () => {
    const available = await Biometrics.isBiometricsAvailable();
    const enabled = await Biometrics.isBiometricsEnabled();
    const credentials = await Biometrics.getStoredCredentials();

    if (available && enabled && credentials) {
      setShowBiometric(true);
      const type = await Biometrics.getBiometricType();
      setBiometricType(type);
      // Auto-trigger biometric on launch
      handleBiometricLogin();
    } else if (available) {
      const type = await Biometrics.getBiometricType();
      setBiometricType(type);
    }
  };

  // Normal email/password login
  const handleLogin = async () => {
    if (!email || !password) {
      showAlert("Fehler", "Bitte E-Mail und Passwort eingeben");
      return;
    }

    setLoading(true);
    try {
      const { user } = await Auth.signInWithPassword(email, password);

      // Offer to enable biometrics after successful login
      const available = await Biometrics.isBiometricsAvailable();
      const enabled = await Biometrics.isBiometricsEnabled();
      if (available && !enabled) {
        const type = await Biometrics.getBiometricType();
        await Biometrics.saveCredentials(email, password);
        await Biometrics.setBiometricsEnabled(true);
        // Silently enable — user can disable in settings
      } else if (available && enabled) {
        // Update stored credentials
        await Biometrics.saveCredentials(email, password);
      }

      if (user?.user_metadata?.customer_id) {
        router.replace("/portal-tickets-customer");
      } else {
        router.replace("/(tabs)");
      }
    } catch (error: any) {
      showAlert("Fehler", error.message || "Ungültige E-Mail oder Passwort");
    } finally {
      setLoading(false);
    }
  };

  // Microsoft SSO login
  const handleMicrosoftLogin = async () => {
    setSsoLoading(true);
    try {
      await Auth.signInWithMicrosoft();
      // On native: the callback handles navigation
      // On web: page redirects
      if (Platform.OS !== "web") {
        router.replace("/(tabs)");
      }
    } catch (error: any) {
      showAlert("Fehler", error.message || "Microsoft-Anmeldung fehlgeschlagen");
    } finally {
      setSsoLoading(false);
    }
  };

  // Face ID / Touch ID login
  const handleBiometricLogin = async () => {
    try {
      const success = await Biometrics.authenticateWithBiometrics();
      if (!success) return;

      const credentials = await Biometrics.getStoredCredentials();
      if (!credentials) {
        showAlert("Fehler", "Keine gespeicherten Zugangsdaten gefunden. Bitte melden Sie sich manuell an.");
        await Biometrics.setBiometricsEnabled(false);
        setShowBiometric(false);
        return;
      }

      setLoading(true);
      const { user } = await Auth.signInWithPassword(credentials.email, credentials.password);

      if (user?.user_metadata?.customer_id) {
        router.replace("/portal-tickets-customer");
      } else {
        router.replace("/(tabs)");
      }
    } catch (error: any) {
      showAlert("Fehler", "Automatische Anmeldung fehlgeschlagen. Bitte melden Sie sich manuell an.");
    } finally {
      setLoading(false);
    }
  };

  // Apple Sign In (iOS only)
  const handleAppleLogin = async () => {
    setSsoLoading(true);
    try {
      await Auth.signInWithApple();
      router.replace("/(tabs)");
    } catch (error: any) {
      // User cancelled — don't show error
      if (error.code === "ERR_REQUEST_CANCELED") return;
      showAlert("Fehler", error.message || "Apple-Anmeldung fehlgeschlagen");
    } finally {
      setSsoLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView 
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className="max-w-md self-center w-full py-4">
          {/* Logo und Titel */}
        <View className="items-center mb-8">
          <Image
            source={require("@/assets/images/android-icon-foreground.png")}
            style={{ width: 400, height: 400, marginBottom: 20 }}
            contentFit="contain"
          />
          <Text className="text-lg text-muted text-center font-semibold">
            Kundenportal
          </Text>
        </View>

        {/* Face ID Button (wenn verfügbar) */}
        {showBiometric && (
          <TouchableOpacity
            onPress={handleBiometricLogin}
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }}
            className="p-4 rounded-xl items-center mb-6 border flex-row justify-center"
            activeOpacity={0.7}
          >
            <IconSymbol name="faceid" size={28} color={colors.primary} />
            <Text className="text-foreground font-semibold text-base ml-3">
              Mit {biometricType} anmelden
            </Text>
          </TouchableOpacity>
        )}

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

          {/* Login Button */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            style={{
              backgroundColor: colors.primary,
              opacity: loading ? 0.7 : 1,
            }}
            className="p-4 rounded-lg items-center mt-2"
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text className="text-background font-semibold text-base">
                Anmelden
              </Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View className="flex-row items-center my-2">
            <View className="flex-1 h-[1px]" style={{ backgroundColor: colors.border }} />
            <Text className="text-muted text-sm mx-4">oder</Text>
            <View className="flex-1 h-[1px]" style={{ backgroundColor: colors.border }} />
          </View>

          {/* Microsoft SSO Button */}
          <TouchableOpacity
            onPress={handleMicrosoftLogin}
            disabled={ssoLoading}
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: ssoLoading ? 0.7 : 1,
            }}
            className="p-4 rounded-lg items-center border flex-row justify-center"
            activeOpacity={0.7}
          >
            {ssoLoading ? (
              <ActivityIndicator color={colors.foreground} />
            ) : (
              <>
                <Svg width={20} height={20} viewBox="0 0 21 21">
                  <SvgRect x="1" y="1" width="9" height="9" fill="#F25022" />
                  <SvgRect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                  <SvgRect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                  <SvgRect x="11" y="11" width="9" height="9" fill="#FFB900" />
                </Svg>
                <Text className="text-foreground font-semibold text-base ml-3">
                  Mit Microsoft anmelden
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Apple Sign In Button */}
          <TouchableOpacity
            onPress={handleAppleLogin}
            disabled={ssoLoading}
            style={{
              backgroundColor: "#000",
              opacity: ssoLoading ? 0.7 : 1,
            }}
            className="p-4 rounded-lg items-center flex-row justify-center"
            activeOpacity={0.7}
          >
            {ssoLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="#fff">
                  <SvgPath d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </Svg>
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600", marginLeft: 8 }}>
                  Mit Apple anmelden
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Passwort vergessen */}
          <TouchableOpacity
            onPress={() => setShowResetModal(true)}
            className="mt-2"
            activeOpacity={0.7}
          >
            <Text className="text-sm text-muted text-center">
              Passwort vergessen?
            </Text>
          </TouchableOpacity>
        </View>

        {/* Passwort-Zurücksetzen-Modal */}
        <PasswordResetModal
          visible={showResetModal}
          onClose={() => setShowResetModal(false)}
        />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

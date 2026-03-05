import { TouchableOpacity, Text } from "react-native";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/use-colors";
import { showConfirm, showAlert } from "@/lib/alert";
import * as Auth from "@/lib/auth";
import * as BiometricsLib from "@/lib/biometrics";

export function LogoutButton() {
  const colors = useColors();
  const router = useRouter();

  const handleLogout = () => {
    showConfirm(
      "Abmelden",
      "Möchten Sie sich wirklich abmelden?",
      async () => {
        try {
          await Auth.signOut();
          await BiometricsLib.clearCredentials();
          await BiometricsLib.setBiometricsEnabled(false);
          router.replace("/login");
        } catch (error) {
          showAlert("Fehler", "Abmeldung fehlgeschlagen");
        }
      },
      "Abmelden"
    );
  };

  return (
    <TouchableOpacity
      onPress={handleLogout}
      style={{
        backgroundColor: colors.error,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
      }}
    >
      <Text style={{ color: colors.background, fontWeight: "600" }}>
        Abmelden
      </Text>
    </TouchableOpacity>
  );
}

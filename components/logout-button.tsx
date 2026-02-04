import { TouchableOpacity, Text, Alert } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/use-colors";

export function LogoutButton() {
  const colors = useColors();
  const router = useRouter();

  const handleLogout = async () => {
    Alert.alert(
      "Abmelden",
      "Möchten Sie sich wirklich abmelden?",
      [
        {
          text: "Abbrechen",
          style: "cancel",
        },
        {
          text: "Abmelden",
          style: "destructive",
          onPress: async () => {
            try {
              // Lösche Login-Status
              await AsyncStorage.removeItem("isLoggedIn");
              await AsyncStorage.removeItem("userEmail");
              await AsyncStorage.removeItem("userName");

              // Navigiere zur Login-Seite
              router.replace("/login");
            } catch (error) {
              Alert.alert("Fehler", "Abmeldung fehlgeschlagen");
            }
          },
        },
      ]
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

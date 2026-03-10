import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

interface PasswordResetModalProps {
  visible: boolean;
  onClose: () => void;
}

export function PasswordResetModal({
  visible,
  onClose,
}: PasswordResetModalProps) {
  const colors = useColors();
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "success">("email");
  const [tempPassword, setTempPassword] = useState("");

  const generateTempPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleResetPassword = () => {
    if (!email) {
      Alert.alert("Fehler", "Bitte geben Sie Ihre E-Mail-Adresse ein");
      return;
    }

    // Generiere temporäres Passwort
    const newPassword = generateTempPassword();
    setTempPassword(newPassword);

    // In einer echten App würde hier eine E-Mail versendet werden
    // Für diese Demo zeigen wir das Passwort direkt an
    setStep("success");
  };

  const handleClose = () => {
    setEmail("");
    setStep("email");
    setTempPassword("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View
        className="flex-1 justify-center items-center"
        style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      >
        <View
          className="w-11/12 max-w-md rounded-2xl p-6"
          style={{ backgroundColor: colors.background }}
        >
          {/* Header */}
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-xl font-bold text-foreground">
              {step === "email" ? "Passwort zurücksetzen" : "Neues Passwort"}
            </Text>
            <TouchableOpacity onPress={handleClose} activeOpacity={0.7}>
              <IconSymbol name="xmark" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {step === "email" ? (
            <>
              {/* E-Mail-Eingabe */}
              <Text className="text-sm text-muted mb-4">
                Geben Sie Ihre E-Mail-Adresse ein. Sie erhalten ein temporäres Passwort.
              </Text>

              <View className="mb-6">
                <Text className="text-sm text-muted mb-2">E-Mail</Text>
                <TextInput
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="ihre.email@beispiel.ch"
                  placeholderTextColor={colors.muted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Buttons */}
              <View className="flex-row gap-3">
                <TouchableOpacity
                  className="flex-1 bg-surface border border-border py-3 rounded-lg"
                  onPress={handleClose}
                  activeOpacity={0.8}
                >
                  <Text className="text-foreground font-semibold text-center">
                    Abbrechen
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-primary py-3 rounded-lg"
                  onPress={handleResetPassword}
                  activeOpacity={0.8}
                >
                  <Text className="text-background font-semibold text-center">
                    Zurücksetzen
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              {/* Erfolgs-Meldung */}
              <View className="items-center mb-6">
                <View
                  className="w-16 h-16 rounded-full items-center justify-center mb-4"
                  style={{ backgroundColor: colors.success + "20" }}
                >
                  <IconSymbol
                    name="checkmark"
                    size={32}
                    color={colors.success}
                  />
                </View>
                <Text className="text-base text-muted text-center mb-4">
                  Ihr temporäres Passwort wurde generiert. Bitte notieren Sie es und ändern Sie es nach dem Login.
                </Text>
              </View>

              {/* Temporäres Passwort */}
              <View
                className="p-4 rounded-lg mb-6"
                style={{ backgroundColor: colors.surface }}
              >
                <Text className="text-sm text-muted mb-2">
                  Temporäres Passwort:
                </Text>
                <Text
                  className="text-lg font-mono font-bold text-center"
                  style={{ color: colors.primary }}
                  selectable={true}
                >
                  {tempPassword}
                </Text>
              </View>

              <Text className="text-xs text-muted text-center mb-6">
                Tipp: Kopieren Sie das Passwort oder machen Sie einen Screenshot
              </Text>

              {/* Schließen-Button */}
              <TouchableOpacity
                className="bg-primary py-3 rounded-lg"
                onPress={handleClose}
                activeOpacity={0.8}
              >
                <Text className="text-background font-semibold text-center">
                  Verstanden
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

import { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

interface NewsletterFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: NewsletterFormData) => void;
}

export interface NewsletterFormData {
  subject: string;
  content: string;
  recipientType: "all" | "active" | "custom";
}

export function NewsletterFormModal({
  visible,
  onClose,
  onSubmit,
}: NewsletterFormModalProps) {
  const colors = useColors();
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [recipientType, setRecipientType] = useState<"all" | "active" | "custom">("all");

  const handleSubmit = () => {
    if (!subject.trim()) {
      Alert.alert("Fehler", "Bitte geben Sie einen Betreff ein.");
      return;
    }
    if (!content.trim()) {
      Alert.alert("Fehler", "Bitte geben Sie einen Inhalt ein.");
      return;
    }

    onSubmit({
      subject: subject.trim(),
      content: content.trim(),
      recipientType,
    });

    // Reset form
    setSubject("");
    setContent("");
    setRecipientType("all");
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 bg-black/50 justify-end">
        <View
          className="bg-background rounded-t-3xl"
          style={{ maxHeight: "90%", minHeight: "60%" }}
        >
          <ScrollView className="flex-1">
            <View className="p-6">
              {/* Header */}
              <View className="flex-row items-center justify-between mb-6">
                <Text className="text-2xl font-bold text-foreground">
                  Neue Kampagne
                </Text>
                <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
                  <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
                </TouchableOpacity>
              </View>

              {/* Betreff */}
              <View className="mb-4">
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Betreff *
                </Text>
                <TextInput
                  className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                  placeholder="z.B. Monatlicher Newsletter Januar 2026"
                  placeholderTextColor={colors.muted}
                  value={subject}
                  onChangeText={setSubject}
                />
              </View>

              {/* Empfänger */}
              <View className="mb-4">
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Empfänger *
                </Text>
                <View className="flex-row gap-2">
                  {[
                    { key: "all", label: "Alle Kunden" },
                    { key: "active", label: "Nur Aktive" },
                    { key: "custom", label: "Benutzerdefiniert" },
                  ].map((option) => (
                    <TouchableOpacity
                      key={option.key}
                      className={`flex-1 px-4 py-3 rounded-xl border ${
                        recipientType === option.key
                          ? "bg-primary border-primary"
                          : "bg-surface border-border"
                      }`}
                      onPress={() => setRecipientType(option.key as any)}
                    >
                      <Text
                        className={`text-sm font-semibold text-center ${
                          recipientType === option.key ? "text-background" : "text-foreground"
                        }`}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Inhalt */}
              <View className="mb-4">
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Inhalt *
                </Text>
                <TextInput
                  className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                  placeholder="Geben Sie den Newsletter-Inhalt ein..."
                  placeholderTextColor={colors.muted}
                  value={content}
                  onChangeText={setContent}
                  multiline
                  numberOfLines={8}
                  textAlignVertical="top"
                  style={{ minHeight: 150 }}
                />
              </View>

              {/* Info */}
              <View className="bg-surface rounded-xl p-4 mb-6">
                <Text className="text-sm text-muted">
                  💡 Die Kampagne wird als Entwurf gespeichert. Sie können sie später planen
                  oder sofort versenden.
                </Text>
              </View>

              {/* Buttons */}
              <View className="flex-row gap-3">
                <TouchableOpacity
                  className="flex-1 bg-surface border border-border rounded-xl py-4"
                  onPress={onClose}
                  activeOpacity={0.7}
                >
                  <Text className="text-center font-semibold text-foreground">
                    Abbrechen
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-primary rounded-xl py-4"
                  onPress={handleSubmit}
                  activeOpacity={0.8}
                >
                  <Text className="text-center font-semibold text-background">
                    Erstellen
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

interface LeadFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function LeadFormModal({
  visible,
  onClose,
  onSuccess,
}: LeadFormModalProps) {
  const colors = useColors();
  const [formData, setFormData] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    value: "",
    notes: "",
  });

  const handleSubmit = () => {
    if (!formData.name || !formData.company) {
      alert("Bitte füllen Sie mindestens Name und Firma aus");
      return;
    }

    // TODO: API-Call implementieren
    console.log("Lead erstellen:", formData);
    onSuccess?.();
    onClose();
    
    // Reset form
    setFormData({
      name: "",
      company: "",
      email: "",
      phone: "",
      value: "",
      notes: "",
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 justify-end">
        <View
          className="bg-background rounded-t-3xl"
          style={{ maxHeight: "90%" }}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between p-4 border-b border-border">
            <Text className="text-2xl font-bold text-foreground">
              Neuer Lead
            </Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Form */}
          <ScrollView className="p-4" showsVerticalScrollIndicator={false}>
            <View className="gap-4">
              {/* Name */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Kontaktperson *
                </Text>
                <TextInput
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="Max Mustermann"
                  placeholderTextColor={colors.muted}
                  value={formData.name}
                  onChangeText={(text) =>
                    setFormData({ ...formData, name: text })
                  }
                />
              </View>

              {/* Firma */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Firma *
                </Text>
                <TextInput
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="Musterfirma GmbH"
                  placeholderTextColor={colors.muted}
                  value={formData.company}
                  onChangeText={(text) =>
                    setFormData({ ...formData, company: text })
                  }
                />
              </View>

              {/* E-Mail */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  E-Mail
                </Text>
                <TextInput
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="max@musterfirma.ch"
                  placeholderTextColor={colors.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={formData.email}
                  onChangeText={(text) =>
                    setFormData({ ...formData, email: text })
                  }
                />
              </View>

              {/* Telefon */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Telefon
                </Text>
                <TextInput
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="+41 44 123 45 67"
                  placeholderTextColor={colors.muted}
                  keyboardType="phone-pad"
                  value={formData.phone}
                  onChangeText={(text) =>
                    setFormData({ ...formData, phone: text })
                  }
                />
              </View>

              {/* Potenzial */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Potenzial (CHF)
                </Text>
                <TextInput
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="10'000"
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                  value={formData.value}
                  onChangeText={(text) =>
                    setFormData({ ...formData, value: text })
                  }
                />
              </View>

              {/* Notizen */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Notizen
                </Text>
                <TextInput
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="Zusätzliche Informationen..."
                  placeholderTextColor={colors.muted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  value={formData.notes}
                  onChangeText={(text) =>
                    setFormData({ ...formData, notes: text })
                  }
                />
              </View>
            </View>
          </ScrollView>

          {/* Footer Buttons */}
          <View className="p-4 border-t border-border flex-row gap-3">
            <TouchableOpacity
              className="flex-1 bg-surface border border-border py-3 rounded-lg"
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text className="text-foreground font-semibold text-center">
                Abbrechen
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 bg-primary py-3 rounded-lg"
              onPress={handleSubmit}
              activeOpacity={0.8}
            >
              <Text className="text-background font-semibold text-center">
                Speichern
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

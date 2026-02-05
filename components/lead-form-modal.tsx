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
import { trpc } from "@/lib/trpc";

interface LeadFormModalProps {
  visible: boolean;
  lead?: any;
  onClose: () => void;
  onSuccess?: () => void;
}

export function LeadFormModal({
  visible,
  lead,
  onClose,
  onSuccess,
}: LeadFormModalProps) {
  const colors = useColors();
  const [formData, setFormData] = useState({
    name: lead?.name || "",
    company: lead?.company || "",
    email: lead?.email || "",
    phone: lead?.phone || "",
    value: lead?.value?.toString() || "",
    status: lead?.status || "new",
    notes: lead?.notes || "",
  });

  // Formular aktualisieren wenn lead sich ändert
  useState(() => {
    if (lead) {
      setFormData({
        name: lead.name || "",
        company: lead.company || "",
        email: lead.email || "",
        phone: lead.phone || "",
        value: lead.value?.toString() || "",
        status: lead.status || "new",
        notes: lead.notes || "",
      });
    }
  });

  const createLead = trpc.leads.create.useMutation({
    onSuccess: () => {
      onSuccess?.();
      onClose();
      resetForm();
    },
    onError: (error) => {
      alert("Fehler beim Erstellen: " + error.message);
    }
  });

  const updateLead = trpc.leads.update.useMutation({
    onSuccess: () => {
      onSuccess?.();
      onClose();
      resetForm();
    },
    onError: (error) => {
      alert("Fehler beim Aktualisieren: " + error.message);
    }
  });

  const resetForm = () => {
    setFormData({
      name: "",
      company: "",
      email: "",
      phone: "",
      value: "",
      status: "new",
      notes: "",
    });
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.company) {
      alert("Bitte füllen Sie mindestens Name und Firma aus");
      return;
    }

    const payload = {
      name: formData.name,
      company: formData.company,
      email: formData.email,
      phone: formData.phone,
      value: parseFloat(formData.value) || 0,
      status: formData.status as any, // Cast to enum
      notes: formData.notes,
    };

    if (lead) {
      updateLead.mutate({
        id: lead.id,
        ...payload
      });
    } else {
      createLead.mutate(payload);
    }
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
              {lead ? "Lead bearbeiten" : "Neuer Lead"}
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

              {/* Status */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Status *
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {[
                    { key: "new", label: "Neu" },
                    { key: "contacted", label: "Kontaktiert" },
                    { key: "qualified", label: "Qualifiziert" },
                    { key: "proposal", label: "Angebot" },
                    { key: "won", label: "Gewonnen" },
                    { key: "lost", label: "Verloren" },
                  ].map((statusOption) => (
                    <TouchableOpacity
                      key={statusOption.key}
                      className={`px-4 py-2 rounded-lg border ${formData.status === statusOption.key
                        ? "bg-primary border-primary"
                        : "bg-surface border-border"
                        }`}
                      onPress={() =>
                        setFormData({ ...formData, status: statusOption.key })
                      }
                    >
                      <Text
                        className={`text-sm font-semibold ${formData.status === statusOption.key
                          ? "text-background"
                          : "text-foreground"
                          }`}
                      >
                        {statusOption.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
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
                {lead ? "Aktualisieren" : "Speichern"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

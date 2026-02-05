import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";

interface CustomerFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editCustomer?: any; // Kunde zum Bearbeiten
}

export function CustomerFormModal({
  visible,
  onClose,
  onSuccess,
  editCustomer,
}: CustomerFormModalProps) {
  const colors = useColors();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    companyName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    postalCode: "",
    country: "Schweiz",
  });

  // Formular zurücksetzen oder mit bestehenden Daten füllen
  useEffect(() => {
    if (visible) {
      if (editCustomer) {
        setFormData({
          firstName: editCustomer.firstName || "",
          lastName: editCustomer.lastName || "",
          companyName: editCustomer.companyName || "",
          email: editCustomer.email || "",
          phone: editCustomer.phone || "",
          address: editCustomer.address || "",
          city: editCustomer.city || "",
          postalCode: editCustomer.postalCode || "",
          country: editCustomer.country || "Schweiz",
        });
      } else {
        setFormData({
          firstName: "",
          lastName: "",
          companyName: "",
          email: "",
          phone: "",
          address: "",
          city: "",
          postalCode: "",
          country: "Schweiz",
        });
      }
    }
  }, [visible, editCustomer]);

  const createCustomer = trpc.customers.create.useMutation({
    onSuccess: (data) => {
      Alert.alert("Erfolg", "Kunde wurde erfolgreich erstellt");
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      Alert.alert("Fehler", `Kunde konnte nicht erstellt werden: ${error.message}`);
    },
  });

  const updateCustomer = trpc.customers.update.useMutation({
    onSuccess: (data) => {
      Alert.alert("Erfolg", "Kunde wurde erfolgreich aktualisiert");
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      Alert.alert("Fehler", `Kunde konnte nicht aktualisiert werden: ${error.message}`);
    },
  });

  const handleSubmit = () => {
    if (!formData.email || (!formData.firstName && !formData.companyName)) {
      Alert.alert("Fehler", "Bitte füllen Sie mindestens E-Mail und Name/Firma aus");
      return;
    }

<<<<<<< Updated upstream
    if (editCustomer) {
      updateCustomer.mutate({
        id: editCustomer.id,
        ...formData,
        country: formData.country || undefined, // Optional machen falls leer
      });
    } else {
      createCustomer.mutate(formData);
    }
=======
    console.log("Submitting customer:", formData);
    createCustomer.mutate(formData);
>>>>>>> Stashed changes
  };

  const isSubmitting = createCustomer.isPending || updateCustomer.isPending;

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
              {editCustomer ? "Kunde bearbeiten" : "Neuer Kunde"}
            </Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Form */}
          <ScrollView className="p-4" showsVerticalScrollIndicator={false}>
            <View className="gap-4">
              {/* Firmenname */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Firmenname
                </Text>
                <TextInput
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="z.B. Musterfirma GmbH"
                  placeholderTextColor={colors.muted}
                  value={formData.companyName}
                  onChangeText={(text) =>
                    setFormData({ ...formData, companyName: text })
                  }
                />
              </View>

              {/* Vorname & Nachname */}
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground mb-2">
                    Vorname
                  </Text>
                  <TextInput
                    className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                    placeholder="Max"
                    placeholderTextColor={colors.muted}
                    value={formData.firstName}
                    onChangeText={(text) =>
                      setFormData({ ...formData, firstName: text })
                    }
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground mb-2">
                    Nachname
                  </Text>
                  <TextInput
                    className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                    placeholder="Mustermann"
                    placeholderTextColor={colors.muted}
                    value={formData.lastName}
                    onChangeText={(text) =>
                      setFormData({ ...formData, lastName: text })
                    }
                  />
                </View>
              </View>

              {/* E-Mail */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  E-Mail *
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

              {/* Adresse */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Adresse
                </Text>
                <TextInput
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="Musterstrasse 123"
                  placeholderTextColor={colors.muted}
                  value={formData.address}
                  onChangeText={(text) =>
                    setFormData({ ...formData, address: text })
                  }
                />
              </View>

              {/* PLZ & Ort */}
              <View className="flex-row gap-3">
                <View style={{ width: 100 }}>
                  <Text className="text-sm font-semibold text-foreground mb-2">
                    PLZ
                  </Text>
                  <TextInput
                    className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                    placeholder="8000"
                    placeholderTextColor={colors.muted}
                    keyboardType="number-pad"
                    value={formData.postalCode}
                    onChangeText={(text) =>
                      setFormData({ ...formData, postalCode: text })
                    }
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground mb-2">
                    Ort
                  </Text>
                  <TextInput
                    className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                    placeholder="Zürich"
                    placeholderTextColor={colors.muted}
                    value={formData.city}
                    onChangeText={(text) =>
                      setFormData({ ...formData, city: text })
                    }
                  />
                </View>
              </View>

              {/* Land */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Land
                </Text>
                <TextInput
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="Schweiz"
                  placeholderTextColor={colors.muted}
                  value={formData.country}
                  onChangeText={(text) =>
                    setFormData({ ...formData, country: text })
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
              disabled={createCustomer.isPending}
              activeOpacity={0.8}
            >
              {createCustomer.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-background font-semibold text-center">
                  Speichern
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

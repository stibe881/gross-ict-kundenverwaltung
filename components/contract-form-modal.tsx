import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/format";

interface ContractFormModalProps {
  visible: boolean;
  contract?: any;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ContractFormModal({
  visible,
  contract,
  onClose,
  onSuccess,
}: ContractFormModalProps) {
  const colors = useColors();
  const [formData, setFormData] = useState({
    title: contract?.title || "",
    description: contract?.description || "",
    customerId: contract?.customerId || null,
    amount: contract?.amount?.toString() || "",
    startDate: contract?.startDate || "",
    durationMonths: contract?.durationMonths?.toString() || "12",
    noticePeriodMonths: contract?.noticePeriodMonths?.toString() || "3",
  });
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);

  // Kunden laden
  const { data: customers } = trpc.customers.list.useQuery();

  const selectedCustomer = customers?.find((c) => c.id === formData.customerId);

  // Enddatum automatisch berechnen
  const calculateEndDate = () => {
    if (!formData.startDate || !formData.durationMonths) return "";
    const start = new Date(formData.startDate);
    if (isNaN(start.getTime())) return ""; // Datum ist ungültig

    const end = new Date(start);
    end.setMonth(end.getMonth() + parseInt(formData.durationMonths));
    return end.toISOString().split("T")[0];
  };

  /*
   * API Mutation
   */
  const createContract = trpc.contracts.create.useMutation({
    onSuccess: () => {
      Alert.alert("Erfolg", "Vertrag erfolgreich erstellt");
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      console.error(error);
      Alert.alert("Fehler", "Vertrag konnte nicht erstellt werden: " + error.message);
    },
  });

  const handleSubmit = () => {
    if (!formData.title || !formData.customerId || !formData.amount || !formData.startDate) {
      Alert.alert("Fehler", "Bitte füllen Sie alle Pflichtfelder aus");
      return;
    }

    const calculatedEndDate = calculateEndDate();
    if (!calculatedEndDate) {
      Alert.alert("Fehler", "Ungültiges Datum oder Laufzeit");
      return;
    }

    createContract.mutate({
      customerId: formData.customerId,
      title: formData.title,
      description: formData.description,
      startDate: formData.startDate,
      endDate: calculatedEndDate,
      annualAmount: parseFloat(formData.amount),
      noticePeriodMonths: parseInt(formData.noticePeriodMonths) || 3,
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
              {contract ? "Vertrag bearbeiten" : "Neuer Vertrag"}
            </Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Form */}
          <ScrollView className="p-4" showsVerticalScrollIndicator={false}>
            <View className="gap-4">
              {/* Kunde auswählen */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Kunde *
                </Text>
                <TouchableOpacity
                  className="bg-surface border border-border rounded-lg px-4 py-3"
                  onPress={() => setShowCustomerPicker(true)}
                  activeOpacity={0.7}
                >
                  <Text className={selectedCustomer ? "text-foreground" : "text-muted"}>
                    {selectedCustomer
                      ? selectedCustomer.companyName ||
                      `${selectedCustomer.firstName} ${selectedCustomer.lastName}`
                      : "Kunde auswählen..."}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Titel */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Vertragstitel *
                </Text>
                <TextInput
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="z.B. Wartungsvertrag Standard"
                  placeholderTextColor={colors.muted}
                  value={formData.title}
                  onChangeText={(text) =>
                    setFormData({ ...formData, title: text })
                  }
                />
              </View>

              {/* Beschreibung */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Beschreibung
                </Text>
                <TextInput
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="Optionale Beschreibung"
                  placeholderTextColor={colors.muted}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  value={formData.description}
                  onChangeText={(text) =>
                    setFormData({ ...formData, description: text })
                  }
                />
              </View>

              {/* Betrag */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Jahresbetrag (CHF) *
                </Text>
                <TextInput
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="0.00"
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                  value={formData.amount}
                  onChangeText={(text) =>
                    setFormData({ ...formData, amount: text })
                  }
                />
              </View>

              {/* Startdatum */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Startdatum *
                </Text>
                <TextInput
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.muted}
                  value={formData.startDate}
                  onChangeText={(text) =>
                    setFormData({ ...formData, startDate: text })
                  }
                />
                <Text className="text-xs text-muted mt-1">
                  Format: JJJJ-MM-TT (z.B. 2026-01-15)
                </Text>
              </View>

              {/* Laufzeit */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Laufzeit (Monate)
                </Text>
                <TextInput
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="12"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  value={formData.durationMonths}
                  onChangeText={(text) =>
                    setFormData({ ...formData, durationMonths: text })
                  }
                />
              </View>

              {/* Kündigungsfrist */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Kündigungsfrist (Monate)
                </Text>
                <TextInput
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="3"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  value={formData.noticePeriodMonths}
                  onChangeText={(text) =>
                    setFormData({ ...formData, noticePeriodMonths: text })
                  }
                />
              </View>

              {/* Berechnetes Enddatum */}
              {formData.startDate && formData.durationMonths && (
                <View className="bg-primary/10 rounded-lg p-3">
                  <Text className="text-sm text-muted mb-1">Berechnetes Enddatum</Text>
                  <Text className="text-base font-semibold text-primary">
                    {formatDate(calculateEndDate())}
                  </Text>
                </View>
              )}
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
                {contract ? "Aktualisieren" : "Erstellen"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Kunden-Picker Modal */}
      <Modal
        visible={showCustomerPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCustomerPicker(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-background rounded-t-3xl" style={{ maxHeight: "70%" }}>
            <View className="flex-row items-center justify-between p-4 border-b border-border">
              <Text className="text-xl font-bold text-foreground">
                Kunde auswählen
              </Text>
              <TouchableOpacity
                onPress={() => setShowCustomerPicker(false)}
                activeOpacity={0.7}
              >
                <IconSymbol name="xmark.circle.fill" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView className="p-4">
              {customers && customers.length > 0 ? (
                customers.map((customer) => (
                  <TouchableOpacity
                    key={customer.id}
                    className="py-3 border-b border-border"
                    onPress={() => {
                      setFormData({ ...formData, customerId: customer.id });
                      setShowCustomerPicker(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text className="text-base font-semibold text-foreground">
                      {customer.companyName ||
                        `${customer.firstName} ${customer.lastName}`}
                    </Text>
                    {customer.email && (
                      <Text className="text-sm text-muted">{customer.email}</Text>
                    )}
                  </TouchableOpacity>
                ))
              ) : (
                <Text className="text-center text-muted py-4">
                  Keine Kunden vorhanden
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

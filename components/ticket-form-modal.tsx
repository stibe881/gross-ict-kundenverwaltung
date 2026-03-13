import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { sendTicketNotification } from "@/lib/push-notifications";

interface TicketFormModalProps {
  visible: boolean;
  ticket?: any;
  onClose: () => void;
  onSuccess?: () => void;
}

export function TicketFormModal({
  visible,
  ticket,
  onClose,
  onSuccess,
}: TicketFormModalProps) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    title: ticket?.title || "",
    description: ticket?.description || "",
    priority: ticket?.priority || "medium",
    customerId: ticket?.customer_id || ticket?.customerId || null,
  });
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);

  // Kunden laden
  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: Data.getCustomersWithCounts,
  });

  const selectedCustomer = customers?.find((c: any) => c.id === formData.customerId);

  const getCustomerName = (c: any) => c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email || 'Unbekannt';

  const handleSubmit = async () => {
    if (!formData.title || !formData.description) {
      alert("Bitte füllen Sie Titel und Beschreibung aus");
      return;
    }

    try {
      const ticketData = {
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        customer_id: formData.customerId || undefined,
        status: "open",
      };

      if (ticket?.id) {
        await Data.updateTicket(ticket.id, ticketData);
      } else {
        await Data.createTicket(ticketData);
      }

      // Invalidate queries to refresh
      queryClient.invalidateQueries({ queryKey: ["tickets"] });

      // Sende Push-Benachrichtigung für neues Ticket
      if (!ticket && selectedCustomer) {
        sendTicketNotification(
          formData.title,
          getCustomerName(selectedCustomer)
        ).catch(console.error);
      }

      onSuccess?.();
      onClose();
    } catch (error: any) {
      alert("Fehler: " + error.message);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 bg-black/50 justify-end">
        <View
          className="bg-background rounded-t-3xl"
          style={{ maxHeight: "90%" }}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between p-4 border-b border-border">
            <Text className="text-2xl font-bold text-foreground">
              {ticket ? "Ticket bearbeiten" : "Neues Ticket"}
            </Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Form */}
          <ScrollView className="p-4" showsVerticalScrollIndicator={false}>
            <View className="gap-4">
              {/* Titel */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Titel *
                </Text>
                <TextInput
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="z.B. Problem mit Login"
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
                  Beschreibung *
                </Text>
                <TextInput
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="Detaillierte Beschreibung des Problems"
                  placeholderTextColor={colors.muted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  value={formData.description}
                  onChangeText={(text) =>
                    setFormData({ ...formData, description: text })
                  }
                />
              </View>

              {/* Priorität */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Priorität
                </Text>
                <TouchableOpacity
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: 1, borderColor: colors.border,
                    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
                    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                  }}
                  onPress={() => setShowPriorityPicker(!showPriorityPicker)}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{
                      width: 10, height: 10, borderRadius: 5,
                      backgroundColor: formData.priority === "low" ? colors.success : formData.priority === "high" ? colors.error : colors.warning,
                    }} />
                    <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>
                      {formData.priority === "low" ? "Niedrig" : formData.priority === "high" ? "Hoch" : "Mittel"}
                    </Text>
                  </View>
                  <IconSymbol name="chevron.down" size={14} color={colors.muted} />
                </TouchableOpacity>
                {showPriorityPicker && (
                  <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, marginTop: 4, overflow: "hidden" }}>
                    {[
                      { label: "Niedrig", value: "low", color: colors.success },
                      { label: "Mittel", value: "medium", color: colors.warning },
                      { label: "Hoch", value: "high", color: colors.error },
                    ].map((priority) => (
                      <TouchableOpacity
                        key={priority.value}
                        style={{
                          paddingHorizontal: 14, paddingVertical: 12,
                          borderBottomWidth: 1, borderBottomColor: colors.border,
                          flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                          backgroundColor: formData.priority === priority.value ? priority.color + "10" : "transparent",
                        }}
                        onPress={() => {
                          setFormData({ ...formData, priority: priority.value });
                          setShowPriorityPicker(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: priority.color }} />
                          <Text style={{ fontSize: 14, color: colors.foreground, fontWeight: formData.priority === priority.value ? "700" : "400" }}>
                            {priority.label}
                          </Text>
                        </View>
                        {formData.priority === priority.value && (
                          <IconSymbol name="checkmark" size={14} color={priority.color} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Kunde auswählen */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Kunde (optional)
                </Text>
                <TouchableOpacity
                  className="bg-surface border border-border rounded-lg px-4 py-3"
                  onPress={() => setShowCustomerPicker(true)}
                  activeOpacity={0.7}
                >
                  <Text className={selectedCustomer ? "text-foreground" : "text-muted"}>
                    {selectedCustomer
                      ? getCustomerName(selectedCustomer)
                      : "Kunde auswählen..."}
                  </Text>
                </TouchableOpacity>
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
                {ticket ? "Aktualisieren" : "Erstellen"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Kunden-Picker Modal */}
      <Modal
        visible={showCustomerPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCustomerPicker(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 bg-black/50 justify-end">
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
              <TouchableOpacity
                className="py-3 border-b border-border"
                onPress={() => {
                  setFormData({ ...formData, customerId: null });
                  setShowCustomerPicker(false);
                }}
                activeOpacity={0.7}
              >
                <Text className="text-base text-muted">Kein Kunde</Text>
              </TouchableOpacity>
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
                      {getCustomerName(customer)}
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
        </KeyboardAvoidingView>
      </Modal>
    </Modal>
  );
}

import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useQuery } from "@tanstack/react-query";
import * as Data from "@/lib/data";

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
  // DB speichert YYYY-MM-DD, Anzeige als DD.MM.YYYY
  const toDisplay = (d: string) => {
    if (!d) return "";
    const parts = d.split("-");
    return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : d;
  };
  const toDb = (d: string) => {
    if (!d) return "";
    const parts = d.split(".");
    return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : d;
  };

  const [formData, setFormData] = useState({
    title: contract?.title || "",
    description: contract?.description || "",
    customerId: contract?.customer_id || contract?.customerId || null,
    amount: (contract?.annual_amount || contract?.amount)?.toString() || "",
    startDate: toDisplay(contract?.start_date || contract?.startDate || ""),
    durationMonths: (contract?.duration_months || contract?.durationMonths)?.toString() || "12",
    noticePeriodMonths: (contract?.notice_period_months || contract?.noticePeriodMonths)?.toString() || "3",
  });
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [customerSearch, setCustomerSearch] = useState("");

  // Kunden laden
  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: Data.getCustomersWithCounts,
  });

  // Vorlagen laden
  const { data: templates } = useQuery({
    queryKey: ["contract_templates"],
    queryFn: Data.getContractTemplates,
  });

  const selectedCustomer = customers?.find((c: any) => c.id === formData.customerId);

  const getCustomerName = (c: any) => c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email || 'Unbekannt';

  const filteredCustomers = customers?.filter((c: any) => {
    if (!customerSearch.trim()) return true;
    const search = customerSearch.toLowerCase();
    return (
      (c.company_name || '').toLowerCase().includes(search) ||
      (c.first_name || '').toLowerCase().includes(search) ||
      (c.last_name || '').toLowerCase().includes(search) ||
      (c.email || '').toLowerCase().includes(search)
    );
  });

  const applyTemplate = (template: any) => {
    setSelectedTemplate(template);
    setFormData({
      ...formData,
      title: template.name || formData.title,
      amount: template.default_amount?.toString() || formData.amount,
      durationMonths: template.default_duration_months?.toString() || formData.durationMonths,
      noticePeriodMonths: template.default_notice_period_months?.toString() || formData.noticePeriodMonths,
      description: template.description || formData.description,
    });
    setShowTemplatePicker(false);
  };

  // Enddatum automatisch berechnen (Input ist DD.MM.YYYY)
  const calculateEndDate = () => {
    try {
      if (!formData.startDate || !formData.durationMonths) return "";
      const dbDate = toDb(formData.startDate);
      const start = new Date(dbDate);
      if (isNaN(start.getTime())) return "";
      const end = new Date(start);
      end.setMonth(end.getMonth() + parseInt(formData.durationMonths));
      if (isNaN(end.getTime())) return "";
      return end.toISOString().split("T")[0];
    } catch {
      return "";
    }
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.customerId || !formData.amount || !formData.startDate) {
      alert("Bitte füllen Sie alle Pflichtfelder aus");
      return;
    }

    try {
      const endDate = calculateEndDate();
      const contractData = {
        customer_id: formData.customerId,
        title: formData.title,
        description: formData.description || undefined,
        amount: parseFloat(formData.amount),
        start_date: toDb(formData.startDate),
        end_date: endDate || undefined,
        duration_months: parseInt(formData.durationMonths) || 12,
        notice_period_months: parseInt(formData.noticePeriodMonths) || 3,
        template_id: selectedTemplate?.id || undefined,
      };

      if (contract?.id) {
        await Data.updateContract(contract.id, contractData);
      } else {
        await Data.createContract(contractData);
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
              {/* Vorlage auswählen */}
              {!contract && templates && templates.length > 0 && (
                <View>
                  <Text className="text-sm font-semibold text-foreground mb-2">
                    Vorlage verwenden
                  </Text>
                  <TouchableOpacity
                    className="bg-surface border border-border rounded-lg px-4 py-3 flex-row items-center justify-between"
                    onPress={() => setShowTemplatePicker(true)}
                    activeOpacity={0.7}
                  >
                    <Text className={selectedTemplate ? "text-foreground" : "text-muted"}>
                      {selectedTemplate ? selectedTemplate.name : "Vorlage auswählen (optional)..."}
                    </Text>
                    <IconSymbol name="doc.on.doc.fill" size={18} color={selectedTemplate ? colors.primary : colors.muted} />
                  </TouchableOpacity>
                  {selectedTemplate && (
                    <TouchableOpacity
                      className="mt-1"
                      onPress={() => {
                        setSelectedTemplate(null);
                        setFormData({
                          ...formData,
                          title: "",
                          description: "",
                          amount: "",
                          durationMonths: "12",
                          noticePeriodMonths: "3",
                        });
                      }}
                    >
                      <Text className="text-sm text-primary">Vorlage entfernen</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Kunde auswählen */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Kunde *
                </Text>
                <TouchableOpacity
                  className="bg-surface border border-border rounded-lg px-4 py-3"
                  onPress={() => { setCustomerSearch(''); setShowCustomerPicker(true); }}
                  activeOpacity={0.7}
                >
                  <Text className={selectedCustomer ? "text-foreground" : "text-muted"}>
                    {selectedCustomer
                      ? getCustomerName(selectedCustomer)
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
                  placeholder="DD.MM.YYYY"
                  placeholderTextColor={colors.muted}
                  value={formData.startDate}
                  onChangeText={(text) =>
                    setFormData({ ...formData, startDate: text })
                  }
                />
                <Text className="text-xs text-muted mt-1">
                  Format: TT.MM.JJJJ (z.B. 15.01.2026)
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
                    {(() => { const d = new Date(calculateEndDate()); return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`; })()}
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
            {/* Suchfeld */}
            <View className="px-4 pt-3">
              <TextInput
                className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                placeholder="Kunde suchen..."
                placeholderTextColor={colors.muted}
                value={customerSearch}
                onChangeText={setCustomerSearch}
                autoFocus
              />
            </View>
            <ScrollView className="p-4">
              {filteredCustomers && filteredCustomers.length > 0 ? (
                filteredCustomers.map((customer: any) => (
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
                  {customerSearch ? "Kein Kunde gefunden" : "Keine Kunden vorhanden"}
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Vorlagen-Picker Modal */}
      <Modal
        visible={showTemplatePicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTemplatePicker(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-background rounded-t-3xl" style={{ maxHeight: "70%" }}>
            <View className="flex-row items-center justify-between p-4 border-b border-border">
              <Text className="text-xl font-bold text-foreground">
                Vorlage auswählen
              </Text>
              <TouchableOpacity
                onPress={() => setShowTemplatePicker(false)}
                activeOpacity={0.7}
              >
                <IconSymbol name="xmark.circle.fill" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView className="p-4">
              {templates && templates.length > 0 ? (
                templates.map((template: any) => (
                  <TouchableOpacity
                    key={template.id}
                    className="py-3 border-b border-border"
                    onPress={() => applyTemplate(template)}
                    activeOpacity={0.7}
                  >
                    <Text className="text-base font-semibold text-foreground">
                      {template.name}
                    </Text>
                    {template.description && (
                      <Text className="text-sm text-muted">{template.description}</Text>
                    )}
                    <View className="flex-row gap-4 mt-1">
                      {template.default_amount && (
                        <Text className="text-xs text-muted">
                          CHF {template.default_amount}/Jahr
                        </Text>
                      )}
                      <Text className="text-xs text-muted">
                        {template.default_duration_months} Monate
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <Text className="text-center text-muted py-4">
                  Keine Vorlagen vorhanden
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

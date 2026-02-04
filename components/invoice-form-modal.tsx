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
import { formatCurrency, VAT_RATES, calculateVAT, calculateGross } from "@/lib/format";

interface InvoiceItem {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  vatRate: number;
}

interface InvoiceFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function InvoiceFormModal({
  visible,
  onClose,
  onSuccess,
}: InvoiceFormModalProps) {
  const colors = useColors();
  const [customerName, setCustomerName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: "1", description: "", quantity: "1", unitPrice: "", vatRate: VAT_RATES.normal },
  ]);

  const addItem = () => {
    setItems([
      ...items,
      {
        id: Date.now().toString(),
        description: "",
        quantity: "1",
        unitPrice: "",
        vatRate: VAT_RATES.normal,
      },
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter((item) => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: string | number) => {
    setItems(
      items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const calculateItemTotal = (item: InvoiceItem) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unitPrice) || 0;
    const net = qty * price;
    const vat = calculateVAT(net, item.vatRate);
    return { net, vat, gross: net + vat };
  };

  const calculateTotals = () => {
    let totalNet = 0;
    let totalVAT = 0;
    let totalGross = 0;

    items.forEach((item) => {
      const { net, vat, gross } = calculateItemTotal(item);
      totalNet += net;
      totalVAT += vat;
      totalGross += gross;
    });

    return { totalNet, totalVAT, totalGross };
  };

  const { totalNet, totalVAT, totalGross } = calculateTotals();

  const handleSubmit = () => {
    if (!customerName || !invoiceNumber) {
      alert("Bitte füllen Sie Kunde und Rechnungsnummer aus");
      return;
    }

    if (items.some((item) => !item.description || !item.unitPrice)) {
      alert("Bitte füllen Sie alle Positionen vollständig aus");
      return;
    }

    // TODO: API-Call implementieren
    console.log("Rechnung erstellen:", {
      customerName,
      invoiceNumber,
      items,
      totalNet,
      totalVAT,
      totalGross,
    });

    onSuccess?.();
    onClose();
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
          style={{ maxHeight: "95%" }}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between p-4 border-b border-border">
            <Text className="text-2xl font-bold text-foreground">
              Neue Rechnung
            </Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Form */}
          <ScrollView className="p-4" showsVerticalScrollIndicator={false}>
            <View className="gap-4">
              {/* Rechnungsnummer */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Rechnungsnummer *
                </Text>
                <TextInput
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="RE-2026-001"
                  placeholderTextColor={colors.muted}
                  value={invoiceNumber}
                  onChangeText={setInvoiceNumber}
                />
              </View>

              {/* Kunde */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Kunde *
                </Text>
                <TextInput
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="Musterfirma GmbH"
                  placeholderTextColor={colors.muted}
                  value={customerName}
                  onChangeText={setCustomerName}
                />
              </View>

              {/* Positionen */}
              <View>
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-sm font-semibold text-foreground">
                    Positionen
                  </Text>
                  <TouchableOpacity
                    className="bg-primary px-3 py-1 rounded-lg"
                    onPress={addItem}
                    activeOpacity={0.8}
                  >
                    <Text className="text-background text-xs font-semibold">
                      + Position
                    </Text>
                  </TouchableOpacity>
                </View>

                {items.map((item, index) => (
                  <View
                    key={item.id}
                    className="bg-surface rounded-lg p-3 mb-3 border border-border"
                  >
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-sm font-semibold text-foreground">
                        Position {index + 1}
                      </Text>
                      {items.length > 1 && (
                        <TouchableOpacity
                          onPress={() => removeItem(item.id)}
                          activeOpacity={0.7}
                        >
                          <IconSymbol
                            name="trash.fill"
                            size={18}
                            color={colors.error}
                          />
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Beschreibung */}
                    <TextInput
                      className="bg-background border border-border rounded-lg px-3 py-2 text-foreground mb-2"
                      placeholder="Beschreibung"
                      placeholderTextColor={colors.muted}
                      value={item.description}
                      onChangeText={(text) =>
                        updateItem(item.id, "description", text)
                      }
                    />

                    {/* Menge & Preis */}
                    <View className="flex-row gap-2 mb-2">
                      <View className="flex-1">
                        <Text className="text-xs text-muted mb-1">Menge</Text>
                        <TextInput
                          className="bg-background border border-border rounded-lg px-3 py-2 text-foreground"
                          placeholder="1"
                          placeholderTextColor={colors.muted}
                          keyboardType="decimal-pad"
                          value={item.quantity}
                          onChangeText={(text) =>
                            updateItem(item.id, "quantity", text)
                          }
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-xs text-muted mb-1">
                          Preis (CHF)
                        </Text>
                        <TextInput
                          className="bg-background border border-border rounded-lg px-3 py-2 text-foreground"
                          placeholder="100.00"
                          placeholderTextColor={colors.muted}
                          keyboardType="decimal-pad"
                          value={item.unitPrice}
                          onChangeText={(text) =>
                            updateItem(item.id, "unitPrice", text)
                          }
                        />
                      </View>
                    </View>

                    {/* MwSt-Satz */}
                    <View>
                      <Text className="text-xs text-muted mb-1">MwSt-Satz</Text>
                      <View className="flex-row gap-2">
                        {[
                          { label: "8.1%", value: VAT_RATES.normal },
                          { label: "2.6%", value: VAT_RATES.reduced },
                          { label: "0%", value: VAT_RATES.none },
                        ].map((rate) => (
                          <TouchableOpacity
                            key={rate.value}
                            className={`flex-1 py-2 rounded-lg ${
                              item.vatRate === rate.value
                                ? "bg-primary"
                                : "bg-background border border-border"
                            }`}
                            onPress={() =>
                              updateItem(item.id, "vatRate", rate.value)
                            }
                            activeOpacity={0.7}
                          >
                            <Text
                              className={`text-center text-xs font-semibold ${
                                item.vatRate === rate.value
                                  ? "text-background"
                                  : "text-foreground"
                              }`}
                            >
                              {rate.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    {/* Zwischensumme */}
                    {item.unitPrice && (
                      <View className="mt-2 pt-2 border-t border-border">
                        <Text className="text-xs text-muted text-right">
                          Total: {formatCurrency(calculateItemTotal(item).gross)}
                        </Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>

              {/* Gesamtsumme */}
              <View className="bg-surface rounded-lg p-4 border border-border">
                <Text className="text-lg font-bold text-foreground mb-3">
                  Zusammenfassung
                </Text>
                <View className="gap-2">
                  <View className="flex-row justify-between">
                    <Text className="text-sm text-muted">Netto</Text>
                    <Text className="text-sm font-semibold text-foreground">
                      {formatCurrency(totalNet)}
                    </Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-sm text-muted">MwSt</Text>
                    <Text className="text-sm font-semibold text-foreground">
                      {formatCurrency(totalVAT)}
                    </Text>
                  </View>
                  <View className="flex-row justify-between pt-2 border-t border-border">
                    <Text className="text-base font-bold text-foreground">
                      Brutto
                    </Text>
                    <Text className="text-base font-bold text-primary">
                      {formatCurrency(totalGross)}
                    </Text>
                  </View>
                </View>
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
                Erstellen
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

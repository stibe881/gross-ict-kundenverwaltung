import { useState, useEffect } from "react";
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
import { formatCurrency, VAT_RATES, calculateVAT } from "@/lib/format";
import { trpc } from "@/lib/trpc";

interface InvoiceItem {
  id: string;
  productId?: number;
  name: string;
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
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Nächste Rechnungsnummer laden
  const { data: nextNumber } = trpc.invoices.nextNumber.useQuery(undefined, {
    enabled: visible,
  });

  // Rechnungsnummer automatisch setzen wenn Modal geöffnet wird
  useEffect(() => {
    if (visible && nextNumber && !invoiceNumber) {
      setInvoiceNumber(nextNumber);
    }
  }, [visible, nextNumber]);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: "1", name: "", description: "", quantity: "1", unitPrice: "", vatRate: VAT_RATES.normal },
  ]);
  const [showProductPicker, setShowProductPicker] = useState<string | null>(null);
  const [showNewProductForm, setShowNewProductForm] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");

  // Kunden laden
  const { data: customers } = trpc.customers.list.useQuery();

  // Produkte laden
  const { data: products } = trpc.products.list.useQuery();

  const selectedCustomer = customers?.find((c: any) => c.id === selectedCustomerId);

  const addItem = () => {
    setItems([
      ...items,
      {
        id: Date.now().toString(),
        name: "",
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

  const selectProduct = (itemId: string, productId: number) => {
    const product = products?.find((p: any) => p.id === productId);
    if (product) {
      setItems(
        items.map((item) =>
          item.id === itemId
            ? {
              ...item,
              productId: product.id,
              name: product.name,
              description: product.description || "",
              unitPrice: product.unitPrice,
              vatRate: parseFloat(product.vatRate),
            }
            : item
        )
      );
    }
    setShowProductPicker(null);
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
    if (!selectedCustomerId || !invoiceNumber) {
      alert("Bitte wählen Sie einen Kunden und geben Sie eine Rechnungsnummer ein");
      return;
    }

    if (items.some((item) => !item.name || !item.unitPrice)) {
      alert("Bitte füllen Sie alle Positionen vollständig aus (Name und Preis)");
      return;
    }

    // TODO: API-Call implementieren
    console.log("Rechnung erstellen:", {
      customerId: selectedCustomerId,
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
                      ? selectedCustomer.company_name ||
                      `${selectedCustomer.first_name || ""} ${selectedCustomer.last_name || ""}`.trim() ||
                      "Unbenannt"
                      : "Kunde auswählen..."}
                  </Text>
                </TouchableOpacity>
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
                      <View className="flex-row gap-2">
                        <TouchableOpacity
                          className="bg-primary px-3 py-1 rounded-lg"
                          onPress={() => setShowProductPicker(item.id)}
                          activeOpacity={0.7}
                        >
                          <Text className="text-background text-xs font-semibold">
                            Aus Katalog
                          </Text>
                        </TouchableOpacity>
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
                    </View>

                    {/* Name */}
                    <View className="mb-2">
                      <Text className="text-xs text-muted mb-1">Name *</Text>
                      <TextInput
                        className="bg-background border border-border rounded-lg px-3 py-2 text-foreground"
                        placeholder="z.B. Microsoft 365 Business"
                        placeholderTextColor={colors.muted}
                        value={item.name}
                        onChangeText={(text) =>
                          updateItem(item.id, "name", text)
                        }
                      />
                    </View>

                    {/* Beschreibung */}
                    <View className="mb-2">
                      <Text className="text-xs text-muted mb-1">Beschreibung</Text>
                      <TextInput
                        className="bg-background border border-border rounded-lg px-3 py-2 text-foreground"
                        placeholder="Optionale Beschreibung"
                        placeholderTextColor={colors.muted}
                        value={item.description}
                        onChangeText={(text) =>
                          updateItem(item.id, "description", text)
                        }
                        multiline
                      />
                    </View>

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
                            className={`flex-1 py-2 rounded-lg ${item.vatRate === rate.value
                              ? "bg-primary"
                              : "bg-background border border-border"
                              }`}
                            onPress={() =>
                              updateItem(item.id, "vatRate", rate.value)
                            }
                            activeOpacity={0.7}
                          >
                            <Text
                              className={`text-center text-xs font-semibold ${item.vatRate === rate.value
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

                    {/* Produkt-Picker für diese Position */}
                    {showProductPicker === item.id && (
                      <View className="mt-2 p-2 bg-background rounded-lg border border-border max-h-40">
                        <ScrollView>
                          {products && products.length > 0 ? (
                            products.map((product) => (
                              <TouchableOpacity
                                key={product.id}
                                className="py-2 border-b border-border"
                                onPress={() => selectProduct(item.id, product.id)}
                                activeOpacity={0.7}
                              >
                                <Text className="text-sm font-semibold text-foreground">
                                  {product.name}
                                </Text>
                                <Text className="text-xs text-muted">
                                  {formatCurrency(parseFloat(product.unitPrice))} | MwSt: {product.vatRate}%
                                </Text>
                              </TouchableOpacity>
                            ))
                          ) : (
                            <Text className="text-sm text-muted text-center py-2">
                              Keine Produkte vorhanden
                            </Text>
                          )}
                          <TouchableOpacity
                            className="bg-primary py-2 rounded-lg mt-2"
                            onPress={() => {
                              setShowProductPicker(null);
                              setShowNewProductForm(true);
                            }}
                            activeOpacity={0.8}
                          >
                            <Text className="text-background text-xs font-semibold text-center">
                              + Neues Produkt erstellen
                            </Text>
                          </TouchableOpacity>
                        </ScrollView>
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
            <View className="px-4 pt-3 pb-1">
              <View className="bg-surface rounded-xl p-3 flex-row items-center border border-border">
                <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
                <TextInput
                  className="flex-1 ml-2 text-base text-foreground"
                  placeholder="Kunde suchen..."
                  placeholderTextColor={colors.muted}
                  value={customerSearch}
                  onChangeText={setCustomerSearch}
                  autoFocus
                />
              </View>
            </View>
            <ScrollView className="p-4">
              {(() => {
                const query = customerSearch.toLowerCase();
                const filtered = customers?.filter((c: any) => {
                  if (!query) return true;
                  return (
                    c.company_name?.toLowerCase().includes(query) ||
                    c.first_name?.toLowerCase().includes(query) ||
                    c.last_name?.toLowerCase().includes(query) ||
                    c.email?.toLowerCase().includes(query)
                  );
                }) || [];
                return filtered.length > 0 ? (
                  filtered.map((customer: any) => (
                    <TouchableOpacity
                      key={customer.id}
                      className="py-3 border-b border-border"
                      onPress={() => {
                        setSelectedCustomerId(customer.id);
                        setShowCustomerPicker(false);
                        setCustomerSearch("");
                      }}
                      activeOpacity={0.7}
                    >
                      <Text className="text-base font-semibold text-foreground">
                        {customer.company_name ||
                          `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
                          "Unbenannt"}
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
                );
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

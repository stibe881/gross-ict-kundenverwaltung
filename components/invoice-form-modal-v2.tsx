import { useState, useEffect } from "react";
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
import { formatCurrency, VAT_RATES, calculateVAT } from "@/lib/format";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { showAlert } from "@/lib/alert";

interface InvoiceItem {
  id: string;
  productId?: number;
  name: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  discountPercentage: string;
  vatRate: number;
}

interface InvoiceFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editInvoice?: any;
}

export function InvoiceFormModal({
  visible,
  onClose,
  onSuccess,
  editInvoice,
}: InvoiceFormModalProps) {
  const colors = useColors();
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Nächste Rechnungsnummer laden
  const { data: nextNumber } = useQuery({
    queryKey: ["invoices", "nextNumber"],
    queryFn: Data.getNextInvoiceNumber,
    enabled: visible && !editInvoice,
  });

  const isEditMode = !!editInvoice;

  // Formular mit Daten füllen (Edit oder Neu)
  useEffect(() => {
    if (visible && editInvoice) {
      // Edit-Modus: Daten aus bestehender Rechnung laden
      setInvoiceNumber(editInvoice.invoice_number || "");
      setSelectedCustomerId(editInvoice.customer_id || null);
      if (editInvoice.items && editInvoice.items.length > 0) {
        setItems(
          editInvoice.items.map((item: any, index: number) => ({
            id: item.id || String(index + 1),
            productId: item.product_id,
            name: item.description?.split("\n")[0] || "",
            description: item.description?.split("\n").slice(1).join("\n") || "",
            quantity: String(item.quantity || 1),
            unit: item.unit || "Stk.",
            unitPrice: String(item.unit_price || ""),
            discountPercentage: String(item.discount_percentage || "0"),
            vatRate: item.vat_rate || VAT_RATES.normal,
          }))
        );
      }
    } else if (visible && nextNumber && !invoiceNumber) {
      setInvoiceNumber(nextNumber);
    }
  }, [visible, editInvoice, nextNumber]);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: "1", name: "", description: "", quantity: "1", unit: "Stk.", unitPrice: "", discountPercentage: "0", vatRate: VAT_RATES.normal },
  ]);
  const [showProductPicker, setShowProductPicker] = useState<string | null>(null);
  const [showNewProductForm, setShowNewProductForm] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [dismissedAutocomplete, setDismissedAutocomplete] = useState<Set<string>>(new Set());
  const [newProductName, setNewProductName] = useState("");
  const [newProductDesc, setNewProductDesc] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("");
  const [newProductVat, setNewProductVat] = useState<number>(VAT_RATES.normal);
  const [newProductForItem, setNewProductForItem] = useState<string | null>(null);
  const [paymentTermsDays, setPaymentTermsDays] = useState(30);

  // Kunden laden
  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: Data.getCustomersWithCounts,
  });

  // Produkte laden
  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: Data.getAllProducts,
  });

  const selectedCustomer = customers?.find((c: any) => c.id === selectedCustomerId);

  const addItem = () => {
    setItems([
      ...items,
      {
        id: Date.now().toString(),
        name: "",
        description: "",
        quantity: "1",
        unit: "Stk.",
        unitPrice: "",
        discountPercentage: "0",
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
    // Wenn der Benutzer den Namen ändert, Autocomplete wieder einblenden
    if (field === "name") {
      setDismissedAutocomplete((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
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
              unit: product.unit || "Stk.",
              unitPrice: String(product.price),
              discountPercentage: "0",
              vatRate: product.vat_rate != null ? parseFloat(String(product.vat_rate)) : VAT_RATES.normal,
            }
            : item
        )
      );
    }
    setShowProductPicker(null);
    setProductSearch("");
    // Autocomplete für dieses Item unterdrücken
    setDismissedAutocomplete((prev) => new Set(prev).add(itemId));
  };

  const calculateItemTotal = (item: InvoiceItem) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unitPrice) || 0;
    const discount = parseFloat(item.discountPercentage) || 0;
    const rawNet = qty * price;
    const net = rawNet * (1 - discount / 100);
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

  // Rechnung speichern
  const queryClient = useQueryClient();
  const createInvoiceMut = useMutation({
    mutationFn: (payload: any) => {
      const { items: payloadItems, ...invoiceData } = payload;
      return Data.createInvoice({
        customer_id: invoiceData.customerId,
        invoice_number: invoiceData.invoiceNumber,
        invoice_date: invoiceData.invoiceDate,
        due_date: invoiceData.dueDate,
        subtotal: 0,
        vat_amount: 0,
        total: payloadItems.reduce((s: number, i: any) => s + i.total, 0),
        status: "open",
      }, payloadItems.map((i: any) => ({
        description: i.description,
        quantity: i.quantity,
        unit: i.unit || "Stk.",
        unit_price: i.unitPrice,
        discount_percentage: parseFloat(i.discountPercentage) || 0,
        vat_rate: i.vatRate,
        total: i.total,
        product_id: i.productId || null,
      })));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      showAlert("Erfolg", "Rechnung wurde erfolgreich erstellt");
      resetForm();
      onSuccess?.();
      onClose();
    },
    onError: (error: any) => {
      showAlert("Fehler", `Rechnung konnte nicht erstellt werden: ${error.message}`);
    },
  });

  const updateInvoiceMut = useMutation({
    mutationFn: (payload: any) => {
      const { id, items: payloadItems, ...invoiceData } = payload;
      return Data.updateInvoice(id, {
        customer_id: invoiceData.customerId,
        invoice_number: invoiceData.invoiceNumber,
        invoice_date: invoiceData.invoiceDate,
        due_date: invoiceData.dueDate,
        subtotal: 0,
        vat_amount: 0,
        total: payloadItems.reduce((s: number, i: any) => s + i.total, 0),
      }, payloadItems.map((i: any) => ({
        description: i.description,
        quantity: i.quantity,
        unit: i.unit || "Stk.",
        unit_price: i.unitPrice,
        discount_percentage: parseFloat(i.discountPercentage) || 0,
        vat_rate: i.vatRate,
        total: i.total,
        product_id: i.productId || null,
      })));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      showAlert("Erfolg", "Rechnung wurde aktualisiert");
      onSuccess?.();
      onClose();
    },
    onError: (error: any) => {
      showAlert("Fehler", `Rechnung konnte nicht aktualisiert werden: ${error.message}`);
    },
  });

  const resetForm = () => {
    setInvoiceNumber("");
    setSelectedCustomerId(null);
    setItems([{ id: "1", name: "", description: "", quantity: "1", unit: "Stk.", unitPrice: "", discountPercentage: "0", vatRate: VAT_RATES.normal }]);
  };

  // Produkt erstellen
  const createProduct = useMutation({
    mutationFn: (data: any) => Data.createProduct({
      name: data.name,
      description: data.description,
      price: data.price,
      vat_rate: data.vatRate,
      type: "product",
    }),
    onSuccess: (newProduct: any) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      if (newProductForItem) {
        setItems(
          items.map((item) =>
            item.id === newProductForItem
              ? {
                ...item,
                productId: newProduct.id,
                name: newProduct.name,
                description: newProduct.description || "",
                unitPrice: String(newProduct.price || newProduct.unit_price || ""),
                vatRate: parseFloat(newProduct.vat_rate || newProduct.vatRate || "8.1"),
              }
              : item
          )
        );
      }
      setShowNewProductForm(false);
      resetNewProductForm();
      showAlert("Erfolg", "Produkt wurde erstellt und eingefügt");
    },
    onError: (error: any) => {
      showAlert("Fehler", `Produkt konnte nicht erstellt werden: ${error.message}`);
    },
  });

  const resetNewProductForm = () => {
    setNewProductName("");
    setNewProductDesc("");
    setNewProductPrice("");
    setNewProductVat(VAT_RATES.normal);
    setNewProductForItem(null);
  };

  const handleSubmit = () => {
    if (!selectedCustomerId || !invoiceNumber) {
      showAlert("Fehler", "Bitte wählen Sie einen Kunden und geben Sie eine Rechnungsnummer ein");
      return;
    }

    if (items.some((item) => !item.name || !item.unitPrice)) {
      showAlert("Fehler", "Bitte füllen Sie alle Positionen vollständig aus (Produkt und Preis)");
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    const dueDate = new Date(Date.now() + paymentTermsDays * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const invoicePayload = {
      customerId: selectedCustomerId,
      invoiceNumber,
      invoiceDate: today,
      dueDate,
      items: items.map((item) => ({
        productId: item.productId ? String(item.productId) : undefined,
        description: item.name + (item.description ? `\n${item.description}` : ""),
        quantity: parseFloat(item.quantity) || 1,
        unit: item.unit || "Stk.",
        unitPrice: parseFloat(item.unitPrice) || 0,
        discountPercentage: item.discountPercentage,
        vatRate: item.vatRate,
        total: calculateItemTotal(item).net, // Total should be net for items, or gross? Actually, total here matches calculateItemTotal.net usually. Wait, previously it was qty * unitPrice, which is net.
      })),
    };

    if (isEditMode) {
      updateInvoiceMut.mutate({ id: editInvoice.id, ...invoicePayload });
    } else {
      createInvoiceMut.mutate(invoicePayload);
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
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="bg-background rounded-t-3xl"
          style={{ maxHeight: "95%" }}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between p-4 border-b border-border">
            <Text className="text-2xl font-bold text-foreground">
              {isEditMode ? "Rechnung bearbeiten" : "Neue Rechnung"}
            </Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Form */}
          <ScrollView className="p-4" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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

              {/* Zahlungsbedingungen */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Zahlungsbedingungen
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {Data.PAYMENT_TERMS_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.key}
                      onPress={() => setPaymentTermsDays(opt.days)}
                      activeOpacity={0.7}
                      style={{
                        flex: 1, paddingVertical: 10, borderRadius: 8,
                        backgroundColor: paymentTermsDays === opt.days ? colors.primary : colors.surface,
                        borderWidth: 1,
                        borderColor: paymentTermsDays === opt.days ? colors.primary : colors.border,
                        alignItems: "center",
                      }}
                    >
                      <Text style={{
                        fontSize: 13, fontWeight: "600",
                        color: paymentTermsDays === opt.days ? "#fff" : colors.foreground,
                      }}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Positionen */}
              <View>
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-sm font-semibold text-foreground">
                    Positionen
                  </Text>
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

                    {/* Produkt */}
                    <View className="mb-2">
                      <Text className="text-xs text-muted mb-1">Produkt *</Text>
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

                    {/* Autocomplete Vorschläge */}
                    {item.name && item.name.length >= 2 && showProductPicker !== item.id && !dismissedAutocomplete.has(item.id) && (() => {
                      const q = item.name.toLowerCase();
                      const suggestions = products?.filter((p: any) =>
                        p.name?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q)
                      ).slice(0, 5) || [];
                      if (suggestions.length === 0) return null;
                      return (
                        <View className="bg-background border border-border rounded-b-lg -mt-2 mb-2 overflow-hidden">
                          {suggestions.map((product: any) => (
                            <TouchableOpacity
                              key={product.id}
                              className="px-3 py-2 border-b border-border"
                              onPress={() => selectProduct(item.id, product.id)}
                              activeOpacity={0.7}
                            >
                              <Text className="text-sm text-foreground">{product.name}</Text>
                              <Text className="text-xs text-muted">
                                {formatCurrency(parseFloat(product.price))} | MwSt: {product.vat_rate}%
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      );
                    })()}

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

                    {/* Menge, Preis, Rabatt */}
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
                      <View className="flex-[1.2]">
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
                      <View className="flex-1">
                        <Text className="text-xs text-muted mb-1">Rabatt (%)</Text>
                        <TextInput
                          className="bg-background border border-border rounded-lg px-3 py-2 text-foreground"
                          placeholder="0"
                          placeholderTextColor={colors.muted}
                          keyboardType="decimal-pad"
                          value={item.discountPercentage}
                          onChangeText={(text) =>
                            updateItem(item.id, "discountPercentage", text)
                          }
                        />
                      </View>
                    </View>

                    {/* MwSt-Satz und Positionstotal */}
                    <View className="flex-row items-end gap-3 mb-2">
                      <View className="flex-1">
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
                      {item.unitPrice ? (
                        <View className="flex-1 justify-center rounded-lg py-2 border border-transparent">
                          <Text className="text-sm font-semibold text-foreground text-right">
                            Total: {formatCurrency(calculateItemTotal(item).gross)}
                          </Text>
                        </View>
                      ) : (
                        <View className="flex-1" />
                      )}
                    </View>

                    {/* Produkt-Picker für diese Position */}
                    {showProductPicker === item.id && (
                      <View className="mt-2 p-2 bg-background rounded-lg border border-border" style={{ maxHeight: 200 }}>
                        <TextInput
                          className="bg-surface border border-border rounded-lg px-3 py-2 text-foreground text-sm mb-2"
                          placeholder="Produkt suchen..."
                          placeholderTextColor={colors.muted}
                          value={productSearch}
                          onChangeText={setProductSearch}
                          autoFocus
                        />
                        <ScrollView>
                          {products && products.length > 0 ? (
                            products
                              .filter((product) => {
                                if (!productSearch.trim()) return true;
                                const q = productSearch.toLowerCase();
                                return product.name?.toLowerCase().includes(q) || product.category?.toLowerCase().includes(q);
                              })
                              .map((product) => (
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
                                    {formatCurrency(parseFloat(product.price))} | MwSt: {product.vat_rate}%
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
                              setNewProductForItem(item.id);
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
                <TouchableOpacity
                  className="bg-primary px-4 py-2 rounded-lg self-start"
                  onPress={addItem}
                  activeOpacity={0.8}
                >
                  <Text className="text-background text-sm font-semibold">
                    + Position
                  </Text>
                </TouchableOpacity>
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
                {isEditMode ? "Speichern" : "Erstellen"}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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

      {/* Neues Produkt erstellen Modal */}
      <Modal
        visible={showNewProductForm}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowNewProductForm(false);
          resetNewProductForm();
        }}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-background rounded-t-3xl" style={{ maxHeight: "70%" }}>
            <View className="flex-row items-center justify-between p-4 border-b border-border">
              <Text className="text-xl font-bold text-foreground">
                Neues Produkt erstellen
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowNewProductForm(false);
                  resetNewProductForm();
                }}
                activeOpacity={0.7}
              >
                <IconSymbol name="xmark.circle.fill" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView className="p-4">
              <View className="gap-4">
                <View>
                  <Text className="text-sm font-semibold text-foreground mb-2">Name *</Text>
                  <TextInput
                    className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                    placeholder="z.B. Microsoft 365 Business"
                    placeholderTextColor={colors.muted}
                    value={newProductName}
                    onChangeText={setNewProductName}
                    autoFocus
                  />
                </View>
                <View>
                  <Text className="text-sm font-semibold text-foreground mb-2">Beschreibung</Text>
                  <TextInput
                    className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                    placeholder="Optionale Beschreibung"
                    placeholderTextColor={colors.muted}
                    value={newProductDesc}
                    onChangeText={setNewProductDesc}
                    multiline
                  />
                </View>
                <View>
                  <Text className="text-sm font-semibold text-foreground mb-2">Preis (CHF) *</Text>
                  <TextInput
                    className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                    placeholder="100.00"
                    placeholderTextColor={colors.muted}
                    keyboardType="decimal-pad"
                    value={newProductPrice}
                    onChangeText={setNewProductPrice}
                  />
                </View>
                <View>
                  <Text className="text-sm font-semibold text-foreground mb-2">MwSt-Satz</Text>
                  <View className="flex-row gap-2">
                    {[
                      { label: "8.1%", value: VAT_RATES.normal },
                      { label: "2.6%", value: VAT_RATES.reduced },
                      { label: "0%", value: VAT_RATES.none },
                    ].map((rate) => (
                      <TouchableOpacity
                        key={rate.value}
                        className={`flex-1 py-2 rounded-lg ${newProductVat === rate.value
                          ? "bg-primary"
                          : "bg-surface border border-border"
                          }`}
                        onPress={() => setNewProductVat(rate.value)}
                        activeOpacity={0.7}
                      >
                        <Text
                          className={`text-center text-sm font-semibold ${newProductVat === rate.value
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
              </View>
            </ScrollView>
            <View className="p-4 border-t border-border flex-row gap-3">
              <TouchableOpacity
                className="flex-1 bg-surface border border-border py-3 rounded-lg"
                onPress={() => {
                  setShowNewProductForm(false);
                  resetNewProductForm();
                }}
                activeOpacity={0.7}
              >
                <Text className="text-foreground font-semibold text-center">
                  Abbrechen
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-primary py-3 rounded-lg"
                onPress={() => {
                  if (!newProductName || !newProductPrice) {
                    showAlert("Fehler", "Bitte geben Sie Name und Preis ein");
                    return;
                  }
                  createProduct.mutate({
                    name: newProductName,
                    description: newProductDesc || undefined,
                    price: parseFloat(newProductPrice) || 0,
                    vatRate: newProductVat,
                  });
                }}
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
    </Modal >
  );
}

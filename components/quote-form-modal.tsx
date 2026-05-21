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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { showAlert } from "@/lib/alert";
import { formatCurrency } from "@/lib/format";

interface QuoteFormModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
    editQuote?: any;
    initialCustomerId?: string;
}

interface LineItem {
    id: string;
    name: string;
    description: string;
    quantity: string;
    unit: string;
    unitPrice: string;
    vatRate: string;
    optional: boolean;
}

export function QuoteFormModal({ visible, onClose, onSuccess, editQuote, initialCustomerId }: QuoteFormModalProps) {
    const colors = useColors();
    const queryClient = useQueryClient();

    const [customerId, setCustomerId] = useState(initialCustomerId || "");
    const [validUntil, setValidUntil] = useState("");
    const [previewUrl, setPreviewUrl] = useState("");
    const [notes, setNotes] = useState("");
    const [items, setItems] = useState<LineItem[]>([
        { id: "1", name: "", description: "", quantity: "1", unit: "Stk.", unitPrice: "", vatRate: "8.1", optional: false },
    ]);
    const [loading, setLoading] = useState(false);
    const [showProductPicker, setShowProductPicker] = useState<string | null>(null);
    const [productSearch, setProductSearch] = useState("");
    const [showCustomerPicker, setShowCustomerPicker] = useState(false);
    const [customerSearch, setCustomerSearch] = useState("");
    const [dismissedAutocomplete, setDismissedAutocomplete] = useState<Set<string>>(new Set());

    const { data: quoteNumber } = useQuery({
        queryKey: ["nextQuoteNumber"],
        queryFn: Data.getNextQuoteNumber,
        enabled: visible && !editQuote,
    });

    const { data: customers } = useQuery({
        queryKey: ["customers"],
        queryFn: Data.getCustomersWithCounts,
        enabled: visible,
    });

    const { data: products } = useQuery({
        queryKey: ["products"],
        queryFn: Data.getAllProducts,
        enabled: visible,
    });

    const selectedCustomer = customers?.find((c: any) => c.id === customerId);

    useEffect(() => {
        if (editQuote) {
            setCustomerId(editQuote.customer_id || "");
            // DB speichert YYYY-MM-DD, Anzeige als DD.MM.YYYY
            if (editQuote.valid_until) {
                const parts = editQuote.valid_until.split("-");
                setValidUntil(parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : editQuote.valid_until);
            } else {
                setValidUntil("");
            }
            setNotes(editQuote.notes || "");
            setPreviewUrl(editQuote.preview_url || "");
            setItems(
                (editQuote.items || []).map((item: any, idx: number) => ({
                    id: String(idx + 1),
                    name: item.description?.split("\n")[0] || "",
                    description: item.description?.split("\n").slice(1).join("\n") || "",
                    quantity: String(item.quantity || 1),
                    unit: item.unit || "Stk.",
                    unitPrice: String(item.unit_price || ""),
                    vatRate: String(item.vat_rate ?? 8.1),
                    optional: item.optional || false,
                }))
            );
        } else {
            resetForm();
            if (initialCustomerId) setCustomerId(initialCustomerId);
        }
    }, [editQuote, visible]);

    const resetForm = () => {
        setCustomerId(initialCustomerId || "");
        setValidUntil("");
        setPreviewUrl("");
        setNotes("");
        setItems([
            { id: "1", name: "", description: "", quantity: "1", unit: "Stk.", unitPrice: "", vatRate: "8.1", optional: false },
        ]);
        setShowProductPicker(null);
        setProductSearch("");
    };

    const addItem = () => {
        setItems((prev) => [
            ...prev,
            {
                id: String(Date.now()),
                name: "",
                description: "",
                quantity: "1",
                unit: "Stk.",
                unitPrice: "",
                vatRate: "8.1",
                optional: false,
            },
        ]);
    };

    const removeItem = (id: string) => {
        if (items.length <= 1) return;
        setItems((prev) => prev.filter((i) => i.id !== id));
    };

    const updateItem = (id: string, field: keyof LineItem, value: string | boolean) => {
        setItems((prev) =>
            prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
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

    const selectProduct = (itemId: string, productId: string) => {
        const product = products?.find((p: any) => p.id === productId);
        if (product) {
            setItems((prev) =>
                prev.map((item) =>
                    item.id === itemId
                        ? {
                            ...item,
                            name: product.name,
                            description: product.description || "",
                            unit: product.unit || "Stk.",
                            unitPrice: String(product.price),
                            vatRate: String(product.vat_rate ?? 8.1),
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

    // Autocomplete: Produkte filtern basierend auf dem eingegebenen Namen
    const getAutocompleteSuggestions = (itemName: string) => {
        if (!itemName || itemName.length < 2 || !products) return [];
        const q = itemName.toLowerCase();
        return products.filter((p: any) =>
            p.name?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q)
        ).slice(0, 5);
    };

    const calculateSubtotal = () =>
        items.reduce((sum, item) => {
            if (item.optional) return sum;
            const qty = parseFloat(item.quantity) || 0;
            const price = parseFloat(item.unitPrice) || 0;
            return sum + qty * price;
        }, 0);

    const calculateTax = () =>
        items.reduce((sum, item) => {
            if (item.optional) return sum;
            const qty = parseFloat(item.quantity) || 0;
            const price = parseFloat(item.unitPrice) || 0;
            const vat = parseFloat(item.vatRate) || 0;
            return sum + qty * price * (vat / 100);
        }, 0);

    const handleSubmit = async () => {
        if (!customerId) {
            showAlert("Fehler", "Bitte einen Kunden auswählen.");
            return;
        }
        if (items.every((i) => !i.name || !i.unitPrice)) {
            showAlert("Fehler", "Bitte mindestens eine Position hinzufügen (Produkt und Preis).");
            return;
        }

        setLoading(true);
        try {
            const subtotal = calculateSubtotal();
            const tax = calculateTax();
            const total = subtotal + tax;
            const today = new Date().toISOString().split("T")[0];

            const quoteData = {
                customer_id: customerId,
                quote_number: editQuote?.quote_number || quoteNumber || "",
                quote_date: editQuote?.quote_date || today,
                // DD.MM.YYYY → YYYY-MM-DD für DB
                valid_until: (() => {
                    if (!validUntil) return null;
                    const parts = validUntil.split(".");
                    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
                    return validUntil;
                })(),
                status: editQuote?.status || "draft",
                subtotal,
                tax,
                total,
                notes: notes || null,
                preview_url: previewUrl || null,
            };

            const quoteItems = items
                .filter((i) => i.name && i.unitPrice)
                .map((item) => {
                    const qty = parseFloat(item.quantity) || 1;
                    const unitPrice = parseFloat(item.unitPrice) || 0;
                    const parsed = parseFloat(item.vatRate);
                    const vatRate = isNaN(parsed) ? 8.1 : parsed;
                    return {
                        description: item.name + (item.description ? `\n${item.description}` : ""),
                        quantity: qty,
                        unit: item.unit || "Stk.",
                        unit_price: unitPrice,
                        vat_rate: vatRate,
                        total: qty * unitPrice * (1 + vatRate / 100),
                        optional: item.optional || false,
                    };
                });

            if (editQuote) {
                await Data.updateQuote(editQuote.id, quoteData, quoteItems);
            } else {
                await Data.createQuote(quoteData, quoteItems);
            }

            queryClient.invalidateQueries({ queryKey: ["quotes"] });
            queryClient.invalidateQueries({ queryKey: ["nextQuoteNumber"] });
            onSuccess();
            onClose();
            resetForm();
            showAlert("Erfolg", editQuote ? "Angebot aktualisiert" : "Angebot erstellt");
        } catch (error: any) {
            showAlert("Fehler", error.message || "Angebot konnte nicht gespeichert werden.");
        } finally {
            setLoading(false);
        }
    };

    const subtotal = calculateSubtotal();
    const tax = calculateTax();
    const total = subtotal + tax;

    const filteredProducts = products?.filter((product: any) => {
        if (!productSearch.trim()) return true;
        const q = productSearch.toLowerCase();
        return product.name?.toLowerCase().includes(q) || product.category?.toLowerCase().includes(q);
    });

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View className="flex-1 bg-black/50 justify-end">
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                    className="bg-background rounded-t-3xl"
                    style={{ maxHeight: "95%" }}
                >
                    {/* Header */}
                    <View className="flex-row items-center justify-between p-4 border-b border-border">
                        <Text className="text-2xl font-bold text-foreground">
                            {editQuote ? "Angebot bearbeiten" : "Neues Angebot"}
                        </Text>
                        <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
                            <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
                        </TouchableOpacity>
                    </View>

                    {/* Form */}
                    <ScrollView className="p-4" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        <View className="gap-4">
                            {/* Angebotsnummer */}
                            <View>
                                <Text className="text-sm font-semibold text-foreground mb-2">Angebotsnummer</Text>
                                <Text className="text-base text-muted">
                                    {editQuote?.quote_number || quoteNumber || "Wird generiert..."}
                                </Text>
                            </View>

                            {/* Kunde */}
                            <View>
                                <Text className="text-sm font-semibold text-foreground mb-2">Kunde *</Text>
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

                            {/* Gültig bis */}
                            <View>
                                <Text className="text-sm font-semibold text-foreground mb-2">Gültig bis</Text>
                                <TextInput
                                    value={validUntil}
                                    onChangeText={setValidUntil}
                                    placeholder="DD.MM.YYYY"
                                    placeholderTextColor={colors.muted}
                                    className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                                />
                            </View>

                            {/* Webseiten-Vorschau Link */}
                            <View>
                                <Text className="text-sm font-semibold text-foreground mb-2">Webseiten-Vorschau (optional)</Text>
                                <TextInput
                                    value={previewUrl}
                                    onChangeText={setPreviewUrl}
                                    placeholder="https://vorschau.gross-ict.ch/kunde"
                                    placeholderTextColor={colors.muted}
                                    className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                                    autoCapitalize="none"
                                    keyboardType="url"
                                />
                            </View>

                            {/* Positionen */}
                            <View>
                                <View className="flex-row items-center justify-between mb-2">
                                    <Text className="text-sm font-semibold text-foreground">Positionen</Text>
                                </View>

                                {items.map((item, index) => {
                                    const suggestions = getAutocompleteSuggestions(item.name);
                                    const showSuggestions = suggestions.length > 0 && showProductPicker !== item.id && !dismissedAutocomplete.has(item.id);

                                    return (
                                        <View
                                            key={item.id}
                                            className={`bg-surface rounded-lg p-3 mb-3 border ${item.optional ? "border-dashed" : ""}`}
                                            style={{
                                                borderColor: item.optional ? colors.warning : colors.border,
                                                backgroundColor: item.optional ? `${colors.warning}08` : colors.surface,
                                            }}
                                        >
                                            {/* Position Header */}
                                            <View className="flex-row items-center justify-between mb-2">
                                                <View className="flex-row items-center gap-2">
                                                    <Text className="text-sm font-semibold text-foreground">
                                                        Position {index + 1}
                                                    </Text>
                                                    {item.optional ? (
                                                        <View className="bg-warning/20 px-2 py-0.5 rounded">
                                                            <Text className="text-xs font-medium text-warning">Optional</Text>
                                                        </View>
                                                    ) : null}
                                                </View>
                                                <View className="flex-row gap-2">
                                                    <TouchableOpacity
                                                        className="bg-primary px-3 py-1 rounded-lg"
                                                        onPress={() => {
                                                            setShowProductPicker(showProductPicker === item.id ? null : item.id);
                                                            setProductSearch("");
                                                        }}
                                                        activeOpacity={0.7}
                                                    >
                                                        <Text className="text-background text-xs font-semibold">Aus Katalog</Text>
                                                    </TouchableOpacity>
                                                    {items.length > 1 ? (
                                                        <TouchableOpacity onPress={() => removeItem(item.id)} activeOpacity={0.7}>
                                                            <IconSymbol name="trash.fill" size={18} color={colors.error} />
                                                        </TouchableOpacity>
                                                    ) : null}
                                                </View>
                                            </View>

                                            {/* Product Picker Dropdown */}
                                            {showProductPicker === item.id ? (
                                                <View className="mb-2 p-2 bg-background rounded-lg border border-border" style={{ maxHeight: 200 }}>
                                                    <TextInput
                                                        className="bg-surface border border-border rounded-lg px-3 py-2 text-foreground text-sm mb-2"
                                                        placeholder="Produkt suchen..."
                                                        placeholderTextColor={colors.muted}
                                                        value={productSearch}
                                                        onChangeText={setProductSearch}
                                                        autoFocus
                                                    />
                                                    <ScrollView keyboardShouldPersistTaps="handled">
                                                        {filteredProducts && filteredProducts.length > 0 ? (
                                                            filteredProducts.map((product: any) => (
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
                                                            <Text className="text-sm text-muted py-2">Keine Produkte gefunden</Text>
                                                        )}
                                                    </ScrollView>
                                                </View>
                                            ) : null}

                                            {/* Produkt */}
                                            <View className="mb-2">
                                                <Text className="text-xs text-muted mb-1">Produkt *</Text>
                                                <TextInput
                                                    value={item.name}
                                                    onChangeText={(v) => updateItem(item.id, "name", v)}
                                                    placeholder="z.B. Microsoft 365 Business"
                                                    placeholderTextColor={colors.muted}
                                                    className="bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                                                />
                                                {/* Autocomplete Vorschläge */}
                                                {showSuggestions ? (
                                                    <View className="bg-background border border-border rounded-b-lg -mt-1 overflow-hidden">
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
                                                ) : null}
                                            </View>

                                            {/* Beschreibung */}
                                            <View className="mb-2">
                                                <Text className="text-xs text-muted mb-1">Beschreibung</Text>
                                                <TextInput
                                                    value={item.description}
                                                    onChangeText={(v) => updateItem(item.id, "description", v)}
                                                    placeholder="Optionale Beschreibung"
                                                    placeholderTextColor={colors.muted}
                                                    className="bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                                                    multiline
                                                />
                                            </View>

                                            {/* Menge, Einheit & Preis */}
                                            <View className="flex-row gap-2 mb-2">
                                                <View className="flex-[0.8]">
                                                    <Text className="text-xs text-muted mb-1">Menge</Text>
                                                    <TextInput
                                                        value={item.quantity}
                                                        onChangeText={(v) => updateItem(item.id, "quantity", v)}
                                                        keyboardType="decimal-pad"
                                                        placeholder="1"
                                                        placeholderTextColor={colors.muted}
                                                        className="bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                                                    />
                                                </View>
                                                <View className="flex-[0.8]">
                                                    <Text className="text-xs text-muted mb-1">Einheit</Text>
                                                    <TextInput
                                                        value={item.unit}
                                                        onChangeText={(v) => updateItem(item.id, "unit", v)}
                                                        placeholder="Stk."
                                                        placeholderTextColor={colors.muted}
                                                        className="bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                                                    />
                                                </View>
                                                <View className="flex-1">
                                                    <Text className="text-xs text-muted mb-1">Preis (CHF)</Text>
                                                    <TextInput
                                                        value={item.unitPrice}
                                                        onChangeText={(v) => updateItem(item.id, "unitPrice", v)}
                                                        keyboardType="decimal-pad"
                                                        placeholder="100.00"
                                                        placeholderTextColor={colors.muted}
                                                        className="bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                                                    />
                                                </View>
                                            </View>

                                            {/* MwSt-Satz */}
                                            <View className="mb-2">
                                                <Text className="text-xs text-muted mb-1">MwSt-Satz</Text>
                                                <View className="flex-row gap-2">
                                                    {[
                                                        { label: "8.1%", value: "8.1" },
                                                        { label: "2.6%", value: "2.6" },
                                                        { label: "0%", value: "0" },
                                                    ].map((rate) => (
                                                        <TouchableOpacity
                                                            key={rate.value}
                                                            className={`flex-1 py-2 rounded-lg ${item.vatRate === rate.value
                                                                ? "bg-primary"
                                                                : "bg-background border border-border"
                                                                }`}
                                                            onPress={() => updateItem(item.id, "vatRate", rate.value)}
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

                                            {/* Optional Toggle */}
                                            <TouchableOpacity
                                                className="flex-row items-center gap-2 pt-1"
                                                onPress={() => updateItem(item.id, "optional", !item.optional)}
                                                activeOpacity={0.7}
                                            >
                                                <View
                                                    className={`w-5 h-5 rounded border-2 items-center justify-center ${item.optional
                                                        ? "bg-warning border-warning"
                                                        : "border-border"
                                                        }`}
                                                >
                                                    {item.optional ? (
                                                        <Text className="text-background text-xs font-bold">✓</Text>
                                                    ) : null}
                                                </View>
                                                <Text className="text-sm text-foreground">Optional (nicht im Total)</Text>
                                            </TouchableOpacity>

                                            {/* Item Total */}
                                            {item.unitPrice ? (
                                                <View className="mt-2 pt-2 border-t border-border">
                                                    <Text className={`text-xs text-right ${item.optional ? "text-warning" : "text-muted"}`}>
                                                        {item.optional ? "Optional: " : "Total: "}
                                                        {formatCurrency(
                                                            (parseFloat(item.quantity) || 0) *
                                                            (parseFloat(item.unitPrice) || 0) *
                                                            (1 + (parseFloat(item.vatRate) || 0) / 100)
                                                        )}
                                                    </Text>
                                                </View>
                                            ) : null}
                                        </View>
                                    );
                                })}
                                <TouchableOpacity
                                    className="bg-primary px-4 py-2 rounded-lg self-start"
                                    onPress={addItem}
                                    activeOpacity={0.8}
                                >
                                    <Text className="text-background text-sm font-semibold">+ Position</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Notizen */}
                            <View>
                                <Text className="text-sm font-semibold text-foreground mb-2">Notizen</Text>
                                <TextInput
                                    value={notes}
                                    onChangeText={setNotes}
                                    placeholder="Optionale Anmerkungen..."
                                    placeholderTextColor={colors.muted}
                                    multiline
                                    numberOfLines={3}
                                    className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                                />
                            </View>

                            {/* Zusammenfassung */}
                            <View className="bg-surface rounded-lg p-4 border border-border">
                                <View className="flex-row justify-between mb-2">
                                    <Text className="text-sm text-muted">Zwischensumme</Text>
                                    <Text className="text-sm text-foreground">CHF {subtotal.toFixed(2)}</Text>
                                </View>
                                <View className="flex-row justify-between mb-2">
                                    <Text className="text-sm text-muted">MwSt</Text>
                                    <Text className="text-sm text-foreground">CHF {tax.toFixed(2)}</Text>
                                </View>
                                <View className="flex-row justify-between pt-2 border-t border-border">
                                    <Text className="text-base font-bold text-foreground">Total</Text>
                                    <Text className="text-base font-bold text-primary">
                                        CHF {total.toFixed(2)}
                                    </Text>
                                </View>
                                {items.some((i) => i.optional && i.unitPrice) ? (
                                    <View className="mt-2 pt-2 border-t border-border">
                                        <Text className="text-xs text-warning">
                                            Optionale Positionen (nicht im Total): CHF{" "}
                                            {items
                                                .filter((i) => i.optional && i.unitPrice)
                                                .reduce((sum, i) => {
                                                    const qty = parseFloat(i.quantity) || 0;
                                                    const price = parseFloat(i.unitPrice) || 0;
                                                    const vat = parseFloat(i.vatRate) || 0;
                                                    return sum + qty * price * (1 + vat / 100);
                                                }, 0)
                                                .toFixed(2)}
                                        </Text>
                                    </View>
                                ) : null}
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
                            <Text className="text-foreground font-semibold text-center">Abbrechen</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            className="flex-1 bg-primary py-3 rounded-lg"
                            onPress={handleSubmit}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text className="text-background font-semibold text-center">
                                    {editQuote ? "Speichern" : "Erstellen"}
                                </Text>
                            )}
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
                            <Text className="text-xl font-bold text-foreground">Kunde auswählen</Text>
                            <TouchableOpacity
                                onPress={() => setShowCustomerPicker(false)}
                                activeOpacity={0.7}
                            >
                                <IconSymbol name="xmark.circle.fill" size={24} color={colors.muted} />
                            </TouchableOpacity>
                        </View>
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
                        <ScrollView className="p-4" keyboardShouldPersistTaps="handled">
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
                                });
                                return filtered && filtered.length > 0 ? (
                                    filtered.map((c: any) => (
                                        <TouchableOpacity
                                            key={c.id}
                                            className={`p-3 rounded-lg mb-2 border ${customerId === c.id
                                                ? "bg-primary/10 border-primary"
                                                : "bg-surface border-border"
                                                }`}
                                            onPress={() => {
                                                setCustomerId(c.id);
                                                setShowCustomerPicker(false);
                                                setCustomerSearch("");
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            <Text className="text-sm font-semibold text-foreground">
                                                {c.company_name || `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Unbenannt"}
                                            </Text>
                                            {c.email ? (
                                                <Text className="text-xs text-muted">{c.email}</Text>
                                            ) : null}
                                        </TouchableOpacity>
                                    ))
                                ) : (
                                    <Text className="text-sm text-muted text-center py-4">
                                        Keine Kunden gefunden
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

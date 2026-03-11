import { useState, useEffect } from "react";
import {
    Modal,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Switch,
    Alert,
    Platform,
} from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import * as Data from "@/lib/data";

interface ExpenseFormModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
    expense?: any; // Für Bearbeitung
}

export function ExpenseFormModal({ visible, onClose, onSuccess, expense }: ExpenseFormModalProps) {
    const colors = useColors();
    const [loading, setLoading] = useState(false);
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const [showPaymentPicker, setShowPaymentPicker] = useState(false);

    const [form, setForm] = useState({
        date: new Date().toISOString().slice(0, 10),
        amount: "",
        description: "",
        category: "other",
        supplier: "",
        payment_method: "bank",
        tax_rate: "0",
        is_deductible: true,
        notes: "",
    });

    useEffect(() => {
        if (expense) {
            setForm({
                date: expense.date || new Date().toISOString().slice(0, 10),
                amount: expense.amount?.toString() || "",
                description: expense.description || "",
                category: expense.category || "other",
                supplier: expense.supplier || "",
                payment_method: expense.payment_method || "bank",
                tax_rate: expense.tax_rate?.toString() || "0",
                is_deductible: expense.is_deductible ?? true,
                notes: expense.notes || "",
            });
        } else {
            setForm({
                date: new Date().toISOString().slice(0, 10),
                amount: "",
                description: "",
                category: "other",
                supplier: "",
                payment_method: "bank",
                tax_rate: "0",
                is_deductible: true,
                notes: "",
            });
        }
    }, [expense, visible]);

    const getCategoryLabel = (value: string) =>
        Data.EXPENSE_CATEGORIES.find((c) => c.value === value)?.label || value;

    const getPaymentLabel = (value: string) =>
        Data.PAYMENT_METHODS.find((p) => p.value === value)?.label || value;

    const handleSave = async () => {
        if (!form.description.trim()) {
            Alert.alert("Fehler", "Bitte Beschreibung eingeben");
            return;
        }
        if (!form.amount || parseFloat(form.amount) <= 0) {
            Alert.alert("Fehler", "Bitte gültigen Betrag eingeben");
            return;
        }

        setLoading(true);
        try {
            const payload = {
                date: form.date,
                amount: parseFloat(form.amount),
                description: form.description.trim(),
                category: form.category,
                supplier: form.supplier.trim() || null,
                payment_method: form.payment_method,
                tax_rate: parseFloat(form.tax_rate) || 0,
                is_deductible: form.is_deductible,
                notes: form.notes.trim() || null,
            };

            if (expense) {
                await Data.updateExpense(expense.id, payload);
            } else {
                await Data.createExpense(payload);
            }
            onSuccess();
            onClose();
        } catch (err: any) {
            Alert.alert("Fehler", err.message);
        } finally {
            setLoading(false);
        }
    };

    const taxAmount = (parseFloat(form.amount) || 0) * (parseFloat(form.tax_rate) || 0) / 100;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <View style={{ flex: 1, backgroundColor: colors.background }}>
                {/* Header */}
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: 16,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                    }}
                >
                    <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
                        <Text style={{ color: colors.primary, fontSize: 16 }}>Abbrechen</Text>
                    </TouchableOpacity>
                    <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "700" }}>
                        {expense ? "Ausgabe bearbeiten" : "Neue Ausgabe"}
                    </Text>
                    <TouchableOpacity onPress={handleSave} disabled={loading} activeOpacity={0.7}>
                        <Text style={{ color: loading ? colors.muted : colors.primary, fontSize: 16, fontWeight: "600" }}>
                            {loading ? "..." : "Speichern"}
                        </Text>
                    </TouchableOpacity>
                </View>

                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16 }}>
                    {/* Betrag */}
                    <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: colors.border, alignItems: "center" }}>
                        <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Betrag (CHF)</Text>
                        <TextInput
                            style={{ fontSize: 36, fontWeight: "800", color: colors.foreground, textAlign: "center", width: "100%" }}
                            value={form.amount}
                            onChangeText={(v) => setForm({ ...form, amount: v.replace(/[^0-9.]/g, "") })}
                            placeholder="0.00"
                            placeholderTextColor={colors.muted}
                            keyboardType="decimal-pad"
                        />
                        {taxAmount > 0 && (
                            <Text style={{ fontSize: 13, color: colors.muted, marginTop: 4 }}>
                                inkl. CHF {taxAmount.toFixed(2)} MwSt ({form.tax_rate}%)
                            </Text>
                        )}
                    </View>

                    {/* Beschreibung */}
                    <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border }}>
                        <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 6, fontWeight: "600" }}>Beschreibung *</Text>
                        <TextInput
                            style={{ fontSize: 16, color: colors.foreground, padding: 0 }}
                            value={form.description}
                            onChangeText={(v) => setForm({ ...form, description: v })}
                            placeholder="z.B. Adobe Creative Cloud"
                            placeholderTextColor={colors.muted}
                        />
                    </View>

                    {/* Datum & Lieferant */}
                    <View style={{ flexDirection: "row", gap: 12 }}>
                        <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border }}>
                            <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 6, fontWeight: "600" }}>Datum</Text>
                            <TextInput
                                style={{ fontSize: 15, color: colors.foreground, padding: 0 }}
                                value={form.date}
                                onChangeText={(v) => setForm({ ...form, date: v })}
                                placeholder="YYYY-MM-DD"
                                placeholderTextColor={colors.muted}
                            />
                        </View>
                        <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border }}>
                            <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 6, fontWeight: "600" }}>Lieferant</Text>
                            <TextInput
                                style={{ fontSize: 15, color: colors.foreground, padding: 0 }}
                                value={form.supplier}
                                onChangeText={(v) => setForm({ ...form, supplier: v })}
                                placeholder="Optional"
                                placeholderTextColor={colors.muted}
                            />
                        </View>
                    </View>

                    {/* Kategorie */}
                    <TouchableOpacity
                        style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
                        onPress={() => setShowCategoryPicker(!showCategoryPicker)}
                        activeOpacity={0.7}
                    >
                        <View>
                            <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 4, fontWeight: "600" }}>Kategorie</Text>
                            <Text style={{ fontSize: 15, color: colors.foreground }}>{getCategoryLabel(form.category)}</Text>
                        </View>
                        <IconSymbol name="chevron.down" size={16} color={colors.muted} />
                    </TouchableOpacity>

                    {showCategoryPicker && (
                        <View style={{ backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
                            {Data.EXPENSE_CATEGORIES.map((cat) => (
                                <TouchableOpacity
                                    key={cat.value}
                                    style={{
                                        padding: 14,
                                        borderBottomWidth: 1,
                                        borderBottomColor: colors.border,
                                        backgroundColor: form.category === cat.value ? colors.primary + "20" : "transparent",
                                        flexDirection: "row",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                    }}
                                    onPress={() => { setForm({ ...form, category: cat.value }); setShowCategoryPicker(false); }}
                                >
                                    <Text style={{ fontSize: 15, color: form.category === cat.value ? colors.primary : colors.foreground }}>{cat.label}</Text>
                                    {form.category === cat.value && <IconSymbol name="checkmark" size={16} color={colors.primary} />}
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Zahlungsart */}
                    <TouchableOpacity
                        style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
                        onPress={() => setShowPaymentPicker(!showPaymentPicker)}
                        activeOpacity={0.7}
                    >
                        <View>
                            <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 4, fontWeight: "600" }}>Zahlungsart</Text>
                            <Text style={{ fontSize: 15, color: colors.foreground }}>{getPaymentLabel(form.payment_method)}</Text>
                        </View>
                        <IconSymbol name="chevron.down" size={16} color={colors.muted} />
                    </TouchableOpacity>

                    {showPaymentPicker && (
                        <View style={{ backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
                            {Data.PAYMENT_METHODS.map((pm) => (
                                <TouchableOpacity
                                    key={pm.value}
                                    style={{
                                        padding: 14,
                                        borderBottomWidth: 1,
                                        borderBottomColor: colors.border,
                                        backgroundColor: form.payment_method === pm.value ? colors.primary + "20" : "transparent",
                                        flexDirection: "row",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                    }}
                                    onPress={() => { setForm({ ...form, payment_method: pm.value }); setShowPaymentPicker(false); }}
                                >
                                    <Text style={{ fontSize: 15, color: form.payment_method === pm.value ? colors.primary : colors.foreground }}>{pm.label}</Text>
                                    {form.payment_method === pm.value && <IconSymbol name="checkmark" size={16} color={colors.primary} />}
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* MwSt-Satz */}
                    <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border }}>
                        <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 8, fontWeight: "600" }}>MwSt-Satz (%)</Text>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                            {["0", "2.6", "3.8", "8.1"].map((rate) => (
                                <TouchableOpacity
                                    key={rate}
                                    style={{
                                        flex: 1,
                                        paddingVertical: 10,
                                        borderRadius: 8,
                                        backgroundColor: form.tax_rate === rate ? colors.primary : colors.border,
                                        alignItems: "center",
                                    }}
                                    onPress={() => setForm({ ...form, tax_rate: rate })}
                                >
                                    <Text style={{ fontSize: 14, fontWeight: "600", color: form.tax_rate === rate ? "#111" : colors.foreground }}>
                                        {rate}%
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Abzugsfähig */}
                    <View style={{
                        backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border,
                        flexDirection: "row", justifyContent: "space-between", alignItems: "center"
                    }}>
                        <View>
                            <Text style={{ fontSize: 15, color: colors.foreground, fontWeight: "600" }}>Geschäftsausgabe</Text>
                            <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>Steuerlich absetzbar</Text>
                        </View>
                        <Switch
                            value={form.is_deductible}
                            onValueChange={(v) => setForm({ ...form, is_deductible: v })}
                            trackColor={{ false: colors.border, true: colors.primary }}
                            thumbColor="#fff"
                        />
                    </View>

                    {/* Notizen */}
                    <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border }}>
                        <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 6, fontWeight: "600" }}>Notizen</Text>
                        <TextInput
                            style={{ fontSize: 15, color: colors.foreground, padding: 0, minHeight: 60, textAlignVertical: "top" }}
                            value={form.notes}
                            onChangeText={(v) => setForm({ ...form, notes: v })}
                            placeholder="Optionale Notizen..."
                            placeholderTextColor={colors.muted}
                            multiline
                        />
                    </View>

                    <View style={{ height: 40 }} />
                </ScrollView>
            </View>
        </Modal>
    );
}

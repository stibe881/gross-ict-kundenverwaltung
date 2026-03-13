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
    ActivityIndicator,
} from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import * as Data from "@/lib/data";
import { supabase } from "@/lib/supabase";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Linking from "expo-linking";

interface ExpenseFormModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
    expense?: any; // Für Bearbeitung
    initialScanReceipt?: { uri: string; name: string; type: string } | null;
}

export function ExpenseFormModal({ visible, onClose, onSuccess, expense, initialScanReceipt }: ExpenseFormModalProps) {
    const colors = useColors();
    const [loading, setLoading] = useState(false);
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const [showPaymentPicker, setShowPaymentPicker] = useState(false);
    const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);

    // Receipt File State
    const [receiptFile, setReceiptFile] = useState<{ uri: string; name: string; type: string; size?: number } | null>(null);
    const [existingReceiptPath, setExistingReceiptPath] = useState<string | null>(null);
    const [existingReceiptUrl, setExistingReceiptUrl] = useState<string | null>(null);

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
                date: expense.date || expense.expense_date || new Date().toISOString().slice(0, 10),
                amount: expense.amount?.toString() || "",
                description: expense.description || "",
                category: expense.category || "other",
                supplier: expense.supplier || "",
                payment_method: expense.payment_method || "bank",
                tax_rate: expense.tax_rate?.toString() || "0",
                is_deductible: expense.is_deductible ?? true,
                notes: expense.notes || "",
            });
            setExistingReceiptPath(expense.receipt_path || null);
            setExistingReceiptUrl(expense.receipt_url || null);
            setReceiptFile(null);
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
            setExistingReceiptPath(null);
            setExistingReceiptUrl(null);
            
            if (initialScanReceipt) {
                setReceiptFile(initialScanReceipt);
                // Trigger AI analysis here if needed
                handleAnalyzeReceipt(initialScanReceipt);
            } else {
                setReceiptFile(null);
            }
        }
    }, [expense, visible, initialScanReceipt]);

    const handleAnalyzeReceipt = async (file: { uri: string; name: string; type: string }) => {
        setIsAnalyzingAI(true);
        try {
            console.log("Analyzing with AI...", file);
            let base64Data = "";
            let mimeType = file.type;

            if (Platform.OS === "web") {
                // Fetch blob and convert to base64
                const response = await fetch(file.uri);
                const blob = await response.blob();
                mimeType = blob.type || "image/jpeg";
                base64Data = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const b64 = reader.result as string;
                        // Strip data prefix (e.g. data:image/jpeg;base64,)
                        resolve(b64.split(",")[1]);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            } else {
                base64Data = await FileSystem.readAsStringAsync(file.uri, {
                    encoding: 'base64',
                });
            }

            const { data, error } = await supabase.functions.invoke("analyze-receipt", {
                body: { fileBase64: base64Data, mimeType },
            });

            if (error) {
                console.error("AI Error Response:", error);
                throw new Error("Fehler bei der KI-Analyse");
            }

            if (data) {
                setForm((prev) => ({
                    ...prev,
                    amount: data.amount ? String(data.amount) : prev.amount,
                    date: data.date ? data.date : prev.date,
                    supplier: data.supplier ? data.supplier : prev.supplier,
                    description: data.description ? data.description : prev.description,
                    tax_rate: (data.tax_rate !== null && data.tax_rate !== undefined) ? String(data.tax_rate) : prev.tax_rate,
                }));
            }
        } catch (error: any) {
            console.error("Analysis failed:", error);
            Alert.alert("KI Fehler", "Der Beleg konnte nicht automatisch analysiert werden.");
        } finally {
            setIsAnalyzingAI(false);
        }
    };

    const getCategoryLabel = (value: string) =>
        Data.EXPENSE_CATEGORIES.find((c) => c.value === value)?.label || value;

    const getPaymentLabel = (value: string) =>
        Data.PAYMENT_METHODS.find((p) => p.value === value)?.label || value;

    const handleTakePhoto = async () => {
        try {
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.8,
            });
            if (!result.canceled && result.assets && result.assets[0]) {
                const asset = result.assets[0];
                setReceiptFile({
                    uri: asset.uri,
                    name: asset.fileName || `Foto_${Date.now()}.jpg`,
                    type: asset.mimeType || "image/jpeg",
                    size: asset.fileSize,
                });
            }
        } catch (_e) {
            Alert.alert("Fehler", "Kamera konnte nicht gestartet werden.");
        }
    };

    const handlePickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.8,
            });
            if (!result.canceled && result.assets && result.assets[0]) {
                const asset = result.assets[0];
                setReceiptFile({
                    uri: asset.uri,
                    name: asset.fileName || `Bild_${Date.now()}.jpg`,
                    type: asset.mimeType || "image/jpeg",
                    size: asset.fileSize,
                });
            }
        } catch (_e) {
            Alert.alert("Fehler", "Bildergalerie konnte nicht geöffnet werden.");
        }
    };

    const handlePickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: "*/*",
                copyToCacheDirectory: true,
            });
            if (result.canceled) return;
            if (result.assets && result.assets[0]) {
                const doc = result.assets[0];
                setReceiptFile({
                    uri: doc.uri,
                    name: doc.name,
                    type: doc.mimeType || "application/octet-stream",
                    size: doc.size,
                });
            }
        } catch (_e) {
            Alert.alert("Fehler", "Dokument konnte nicht ausgewählt werden.");
        }
    };

    const handleRemoveReceipt = () => {
        if (receiptFile) {
            setReceiptFile(null);
        } else if (existingReceiptPath) {
            Alert.alert(
                "Beleg löschen",
                "Möchten Sie diesen Beleg unwiderruflich löschen?",
                [
                    { text: "Abbrechen", style: "cancel" },
                    {
                        text: "Löschen", style: "destructive", onPress: async () => {
                            setLoading(true);
                            try {
                                await Data.deleteExpenseReceipt(existingReceiptPath, expense.id);
                                setExistingReceiptPath(null);
                                setExistingReceiptUrl(null);
                                onSuccess(); // Refresh list to show without clip
                            } catch (err: any) {
                                Alert.alert("Fehler", err.message);
                            } finally {
                                setLoading(false);
                            }
                        }
                    }
                ]
            );
        }
    };

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
            let uploadedPath = existingReceiptPath;
            let uploadedUrl = existingReceiptUrl;

            // Upload new receipt if one was selected
            if (receiptFile) {
                const uploadRes = await Data.uploadExpenseReceipt(receiptFile);
                uploadedPath = uploadRes.filePath;
                uploadedUrl = uploadRes.publicUrl;
            }

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
                receipt_path: uploadedPath,
                receipt_url: uploadedUrl,
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
                {isAnalyzingAI && (
                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 999, justifyContent: 'center', alignItems: 'center' }}>
                        <ActivityIndicator size="large" color="#D4A432" />
                        <Text style={{ color: "white", marginTop: 16, fontSize: 16, fontWeight: "600" }}>KI analysiert Beleg...</Text>
                        <Text style={{ color: "rgba(255,255,255,0.7)", marginTop: 8, fontSize: 13, textAlign: 'center', paddingHorizontal: 40 }}>
                            Bitte warten Sie einen Moment. Daten wie Betrag, Datum und Lieferant werden automatisch extrahiert.
                        </Text>
                    </View>
                )}
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

                    {/* Beleg Upload */}
                    <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border }}>
                        <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 12, fontWeight: "600" }}>Beleg (Optional)</Text>
                        
                        {(receiptFile || existingReceiptPath) ? (
                            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.background, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                                    <View style={{ width: 40, height: 40, backgroundColor: colors.primary + "20", borderRadius: 8, alignItems: "center", justifyContent: "center" }}>
                                        <IconSymbol name="doc.text.fill" size={20} color={colors.primary} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 14, color: colors.foreground, fontWeight: "600" }} numberOfLines={1}>
                                            {receiptFile ? receiptFile.name : `Beleg vorhanden`}
                                        </Text>
                                        <Text style={{ fontSize: 12, color: colors.muted }}>
                                            {receiptFile ? "Noch nicht gespeichert" : "Bereits hochgeladen"}
                                        </Text>
                                    </View>
                                </View>
                                <View style={{ flexDirection: "row", gap: 8 }}>
                                    {existingReceiptUrl && !receiptFile && (
                                        <TouchableOpacity 
                                            onPress={() => Linking.openURL(existingReceiptUrl)}
                                            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary + "20", alignItems: "center", justifyContent: "center" }}
                                        >
                                            <IconSymbol name="eye.fill" size={14} color={colors.primary} />
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity 
                                        onPress={handleRemoveReceipt}
                                        style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.error + "20", alignItems: "center", justifyContent: "center" }}
                                    >
                                        <IconSymbol name="trash.fill" size={14} color={colors.error} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <View style={{ flexDirection: "row", gap: 8 }}>
                                <TouchableOpacity 
                                    onPress={handleTakePhoto}
                                    style={{ flex: 1, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, alignItems: "center", gap: 6 }}
                                >
                                    <IconSymbol name="camera.fill" size={20} color={colors.primary} />
                                    <Text style={{ fontSize: 12, color: colors.foreground, fontWeight: "500" }}>Kamera</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    onPress={handlePickImage}
                                    style={{ flex: 1, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, alignItems: "center", gap: 6 }}
                                >
                                    <IconSymbol name="photo.fill" size={20} color={colors.primary} />
                                    <Text style={{ fontSize: 12, color: colors.foreground, fontWeight: "500" }}>Foto</Text>
                                </TouchableOpacity>
                                {Platform.OS !== "web" && (
                                    <TouchableOpacity 
                                        onPress={handlePickDocument}
                                        style={{ flex: 1, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, alignItems: "center", gap: 6 }}
                                    >
                                        <IconSymbol name="folder.fill" size={20} color={colors.primary} />
                                        <Text style={{ fontSize: 12, color: colors.foreground, fontWeight: "500" }}>Datei</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                    </View>

                    <View style={{ height: 40 }} />
                </ScrollView>
            </View>
        </Modal>
    );
}

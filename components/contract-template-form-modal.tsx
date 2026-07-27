import { useState, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Modal,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import * as Data from "@/lib/data";

interface ContractTemplateFormModalProps {
    visible: boolean;
    template?: any;
    onClose: () => void;
    onSubmit: (data: any) => void;
}

export function ContractTemplateFormModal({
    visible,
    template,
    onClose,
    onSubmit,
}: ContractTemplateFormModalProps) {
    const colors = useColors();
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        default_amount: "",
        default_internal_costs: "",
        default_duration_months: "12",
        default_notice_period_months: "3",
        default_payment_terms: "",
        default_scope_of_services: "",
        default_special_agreements: "",
    });

    useEffect(() => {
        if (template) {
            setFormData({
                name: template.name || "",
                description: template.description || "",
                default_amount: template.default_amount?.toString() || "",
                default_internal_costs: template.default_internal_costs?.toString() || "",
                default_duration_months: template.default_duration_months?.toString() || "12",
                default_notice_period_months: template.default_notice_period_months?.toString() || "3",
                default_payment_terms: template.default_payment_terms || "",
                default_scope_of_services: template.default_scope_of_services || "",
                default_special_agreements: template.default_special_agreements || "",
            });
        } else {
            setFormData({
                name: "",
                description: "",
                default_amount: "",
                default_internal_costs: "",
                default_duration_months: "12",
                default_notice_period_months: "3",
                default_payment_terms: "",
                default_scope_of_services: "",
                default_special_agreements: "",
            });
        }
    }, [template, visible]);

    const handleSubmit = () => {
        if (!formData.name.trim()) {
            alert("Bitte geben Sie einen Namen für die Vorlage ein");
            return;
        }

        onSubmit({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            default_amount: formData.default_amount ? parseFloat(formData.default_amount) : null,
            default_internal_costs: formData.default_internal_costs ? parseFloat(formData.default_internal_costs) : null,
            default_duration_months: parseInt(formData.default_duration_months) || 12,
            default_notice_period_months: parseInt(formData.default_notice_period_months) || 3,
            default_payment_terms: formData.default_payment_terms.trim() || null,
            default_scope_of_services: formData.default_scope_of_services.trim() || null,
            default_special_agreements: formData.default_special_agreements.trim() || null,
        });
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 bg-black/50 justify-end">
                <View className="bg-background rounded-t-3xl" style={{ maxHeight: "90%" }}>
                    {/* Header */}
                    <View className="flex-row items-center justify-between p-4 border-b border-border">
                        <Text className="text-2xl font-bold text-foreground">
                            {template ? "Vorlage bearbeiten" : "Neue Vorlage"}
                        </Text>
                        <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
                            <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
                        </TouchableOpacity>
                    </View>

                    {/* Form */}
                    <ScrollView className="p-4" showsVerticalScrollIndicator={false}>
                        <View className="gap-4">
                            {/* Name */}
                            <View>
                                <Text className="text-sm font-semibold text-foreground mb-2">
                                    Vorlagenname *
                                </Text>
                                <TextInput
                                    className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                                    placeholder="z.B. Wartungsvertrag"
                                    placeholderTextColor={colors.muted}
                                    value={formData.name}
                                    onChangeText={(text) => setFormData({ ...formData, name: text })}
                                />
                            </View>

                            {/* Beschreibung */}
                            <View>
                                <Text className="text-sm font-semibold text-foreground mb-2">
                                    Beschreibung
                                </Text>
                                <TextInput
                                    className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                                    placeholder="Optionale Beschreibung der Vorlage"
                                    placeholderTextColor={colors.muted}
                                    multiline
                                    numberOfLines={3}
                                    textAlignVertical="top"
                                    value={formData.description}
                                    onChangeText={(text) => setFormData({ ...formData, description: text })}
                                />
                            </View>

                            {/* Standard-Betrag + Eigenkosten nebeneinander */}
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 1 }}>
                                    <Text className="text-sm font-semibold text-foreground mb-2">
                                        Standard-Jahresbetrag (CHF)
                                    </Text>
                                    <TextInput
                                        className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                                        placeholder="0.00"
                                        placeholderTextColor={colors.muted}
                                        keyboardType="decimal-pad"
                                        value={formData.default_amount}
                                        onChangeText={(text) => setFormData({ ...formData, default_amount: text })}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text className="text-sm font-semibold text-foreground mb-2">
                                        Standard-Eigenkosten (CHF)
                                    </Text>
                                    <TextInput
                                        className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                                        placeholder="0.00"
                                        placeholderTextColor={colors.muted}
                                        keyboardType="decimal-pad"
                                        value={formData.default_internal_costs}
                                        onChangeText={(text) => setFormData({ ...formData, default_internal_costs: text })}
                                    />
                                </View>
                            </View>

                            {/* Standard-Laufzeit */}
                            <View>
                                <Text className="text-sm font-semibold text-foreground mb-2">
                                    Standard-Laufzeit (Monate)
                                </Text>
                                <TextInput
                                    className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                                    placeholder="12"
                                    placeholderTextColor={colors.muted}
                                    keyboardType="number-pad"
                                    value={formData.default_duration_months}
                                    onChangeText={(text) =>
                                        setFormData({ ...formData, default_duration_months: text })
                                    }
                                />
                            </View>

                            {/* Standard-Kündigungsfrist */}
                            <View>
                                <Text className="text-sm font-semibold text-foreground mb-2">
                                    Standard-Kündigungsfrist (Monate)
                                </Text>
                                <TextInput
                                    className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                                    placeholder="3"
                                    placeholderTextColor={colors.muted}
                                    keyboardType="number-pad"
                                    value={formData.default_notice_period_months}
                                    onChangeText={(text) =>
                                        setFormData({ ...formData, default_notice_period_months: text })
                                    }
                                />
                            </View>

                            {/* Standard-Leistungsumfang */}
                            <View>
                                <Text className="text-sm font-semibold text-foreground mb-2">
                                    Standard-Leistungsumfang
                                </Text>
                                <TextInput
                                    className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                                    placeholder="Optionale Standard-Beschreibung der Leistungen"
                                    placeholderTextColor={colors.muted}
                                    multiline
                                    numberOfLines={4}
                                    textAlignVertical="top"
                                    value={formData.default_scope_of_services}
                                    onChangeText={(text) => setFormData({ ...formData, default_scope_of_services: text })}
                                />
                            </View>

                            {/* Standard-Zahlungsbedingungen */}
                            <View>
                                <Text className="text-sm font-semibold text-foreground mb-2">
                                    Standard-Zahlungsbedingungen
                                </Text>
                                <View style={{ flexDirection: "row", gap: 8 }}>
                                    {Data.PAYMENT_TERMS_OPTIONS.map((opt) => (
                                        <TouchableOpacity
                                            key={opt.key}
                                            onPress={() => setFormData({ ...formData, default_payment_terms: opt.label })}
                                            activeOpacity={0.7}
                                            style={{
                                                flex: 1, paddingVertical: 10, borderRadius: 8,
                                                backgroundColor: formData.default_payment_terms === opt.label ? colors.primary : colors.surface,
                                                borderWidth: 1,
                                                borderColor: formData.default_payment_terms === opt.label ? colors.primary : colors.border,
                                                alignItems: "center",
                                            }}
                                        >
                                            <Text style={{
                                                fontSize: 13, fontWeight: "600",
                                                color: formData.default_payment_terms === opt.label ? "#fff" : colors.foreground,
                                            }}>
                                                {opt.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Standard-Zusatzvereinbarungen */}
                            <View>
                                <Text className="text-sm font-semibold text-foreground mb-2">
                                    Standard-Zusatzvereinbarungen
                                </Text>
                                <TextInput
                                    className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                                    placeholder="Optionale Standard-Zusatzvereinbarungen"
                                    placeholderTextColor={colors.muted}
                                    multiline
                                    numberOfLines={3}
                                    textAlignVertical="top"
                                    value={formData.default_special_agreements}
                                    onChangeText={(text) => setFormData({ ...formData, default_special_agreements: text })}
                                />
                            </View>
                        </View>
                    </ScrollView>

                    {/* Footer */}
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
                            activeOpacity={0.8}
                        >
                            <Text className="text-background font-semibold text-center">
                                {template ? "Aktualisieren" : "Erstellen"}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

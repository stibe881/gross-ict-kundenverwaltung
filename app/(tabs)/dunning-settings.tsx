import { useState, useEffect } from "react";
import {
    ScrollView,
    Text,
    View,
    TouchableOpacity,
    TextInput,
    Switch,
    ActivityIndicator,
    Alert,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";

type TabKey = "invoices" | "dunning";

const LEVEL_CONFIG = [
    { key: "reminder", label: "Zahlungserinnerung", icon: "bell.fill", color: "#f59e0b", textKey: "text_reminder", subjectKey: "subject_reminder", description: "Freundliche Erinnerung nach Fälligkeit" },
    { key: "level1", label: "1. Mahnung", icon: "exclamationmark.triangle.fill", color: "#f97316", textKey: "text_level1", subjectKey: "subject_level1", description: "Bestimmter Ton, Androhung Mahngebühr" },
    { key: "level2", label: "2. Mahnung", icon: "exclamationmark.circle.fill", color: "#ef4444", textKey: "text_level2", subjectKey: "subject_level2", description: "+CHF 20 Mahngebühr, Androhung Sperrung" },
    { key: "level3", label: "Betreibungsandrohung", icon: "xmark.octagon.fill", color: "#dc2626", textKey: "text_level3", subjectKey: "subject_level3", description: "Letzte Warnung, Androhung Betreibung" },
];

export default function DunningSettingsScreen() {
    const router = useRouter();
    const colors = useColors();
    const { containerStyle, contentPadding } = useResponsiveLayout();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<TabKey>("invoices");
    const [expandedLevel, setExpandedLevel] = useState<string | null>(null);

    // Dunning Settings
    const { data: dunningSettings, isLoading: loadingDunning, refetch: refetchDunning } = useQuery({
        queryKey: ["dunningSettings"],
        queryFn: Data.getDunningSettings,
    });

    // Invoice Settings
    const { data: invoiceSettings, isLoading: loadingInvoice, refetch: refetchInvoice } = useQuery({
        queryKey: ["invoiceSettings"],
        queryFn: Data.getInvoiceSettings,
    });

    // Tab-Screens bleiben gemountet — beim (erneuten) Öffnen der Seite
    // die Einstellungen frisch aus der DB laden
    useFocusEffect(
        useCallback(() => {
            refetchDunning();
            refetchInvoice();
        }, [refetchDunning, refetchInvoice])
    );

    const [dunningForm, setDunningForm] = useState<any>(null);
    const [invoiceForm, setInvoiceForm] = useState<any>(null);

    useEffect(() => {
        if (dunningSettings) setDunningForm({ ...dunningSettings });
    }, [dunningSettings]);

    useEffect(() => {
        if (invoiceSettings) setInvoiceForm({ ...invoiceSettings });
    }, [invoiceSettings]);

    const saveDunningMutation = useMutation({
        mutationFn: (data: any) => Data.updateDunningSettings(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["dunningSettings"] });
            Alert.alert("Gespeichert", "Mahnungseinstellungen aktualisiert.");
        },
        onError: (err: any) => {
            const msg = err.message || "";
            if (msg.includes("schema cache") || msg.includes("relation") || msg.includes("not find")) {
                Alert.alert("Migration erforderlich", "Bitte führe im Supabase SQL-Editor den Befehl 'NOTIFY pgrst, \\'reload schema\\'' aus, oder starte das Supabase-Projekt neu.\n\nDie Tabellen wurden erstellt, aber der API-Cache muss noch aktualisiert werden.");
            } else {
                Alert.alert("Fehler", msg);
            }
        },
    });

    const saveInvoiceMutation = useMutation({
        mutationFn: (data: any) => Data.updateInvoiceSettings(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["invoiceSettings"] });
            Alert.alert("Gespeichert", "Rechnungseinstellungen aktualisiert.");
        },
        onError: (err: any) => {
            const msg = err.message || "";
            if (msg.includes("schema cache") || msg.includes("relation") || msg.includes("not find")) {
                Alert.alert("Migration erforderlich", "Bitte führe im Supabase SQL-Editor den Befehl 'NOTIFY pgrst, \\'reload schema\\'' aus, oder starte das Supabase-Projekt neu.\n\nDie Tabellen wurden erstellt, aber der API-Cache muss noch aktualisiert werden.");
            } else {
                Alert.alert("Fehler", msg);
            }
        },
    });

    const handleSave = () => {
        if (activeTab === "invoices" && invoiceForm) {
            const { id, created_at, updated_at, ...payload } = invoiceForm;
            saveInvoiceMutation.mutate(payload);
        } else if (activeTab === "dunning" && dunningForm) {
            const { id, created_at, updated_at, ...payload } = dunningForm;
            saveDunningMutation.mutate(payload);
        }
    };

    const isLoading = loadingDunning || loadingInvoice;
    const isSaving = saveDunningMutation.isPending || saveInvoiceMutation.isPending;

    if (isLoading || !dunningForm || !invoiceForm) {
        return (
            <ScreenContainer>
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </ScreenContainer>
        );
    }

    const renderInvoiceSettings = () => (
        <View className="gap-4">
            {/* Begrüssungstext */}
            <View className="bg-surface rounded-xl p-5 border border-border">
                <Text className="text-base font-bold text-foreground mb-4">Rechnungstexte</Text>

                <View className="mb-3">
                    <Text className="text-xs text-muted mb-1 font-semibold">Begrüssungstext</Text>
                    <TextInput
                        className="bg-background border border-border rounded-lg px-3 py-2.5 text-foreground text-sm"
                        style={{ color: colors.foreground, minHeight: 80, textAlignVertical: "top" }}
                        value={invoiceForm.greeting_text}
                        onChangeText={(v) => setInvoiceForm({ ...invoiceForm, greeting_text: v })}
                        multiline
                        placeholderTextColor={colors.muted}
                    />
                </View>

                <View className="mb-3">
                    <Text className="text-xs text-muted mb-1 font-semibold">Schlusstext</Text>
                    <TextInput
                        className="bg-background border border-border rounded-lg px-3 py-2.5 text-foreground text-sm"
                        style={{ color: colors.foreground }}
                        value={invoiceForm.closing_text}
                        onChangeText={(v) => setInvoiceForm({ ...invoiceForm, closing_text: v })}
                        placeholderTextColor={colors.muted}
                    />
                </View>

                <View>
                    <Text className="text-xs text-muted mb-1 font-semibold">Zahlungsfrist (Tage)</Text>
                    <TextInput
                        className="bg-background border border-border rounded-lg px-3 py-2.5 text-foreground text-sm"
                        style={{ color: colors.foreground }}
                        value={invoiceForm.payment_terms_days?.toString()}
                        onChangeText={(v) => setInvoiceForm({ ...invoiceForm, payment_terms_days: parseInt(v) || 30 })}
                        keyboardType="number-pad"
                        placeholderTextColor={colors.muted}
                    />
                </View>
            </View>

            {/* Bankverbindung */}
            <View className="bg-surface rounded-xl p-5 border border-border">
                <Text className="text-base font-bold text-foreground mb-4">Bankverbindung</Text>

                <View className="mb-3">
                    <Text className="text-xs text-muted mb-1 font-semibold">Kontoinhaber</Text>
                    <TextInput
                        className="bg-background border border-border rounded-lg px-3 py-2.5 text-foreground text-sm"
                        style={{ color: colors.foreground }}
                        value={invoiceForm.account_holder}
                        onChangeText={(v) => setInvoiceForm({ ...invoiceForm, account_holder: v })}
                        placeholderTextColor={colors.muted}
                    />
                </View>

                <View className="mb-3">
                    <Text className="text-xs text-muted mb-1 font-semibold">Bank</Text>
                    <TextInput
                        className="bg-background border border-border rounded-lg px-3 py-2.5 text-foreground text-sm"
                        style={{ color: colors.foreground }}
                        value={invoiceForm.bank_name}
                        onChangeText={(v) => setInvoiceForm({ ...invoiceForm, bank_name: v })}
                        placeholderTextColor={colors.muted}
                    />
                </View>

                <View className="mb-3">
                    <Text className="text-xs text-muted mb-1 font-semibold">IBAN</Text>
                    <TextInput
                        className="bg-background border border-border rounded-lg px-3 py-2.5 text-foreground text-sm"
                        style={{ color: colors.foreground }}
                        value={invoiceForm.iban}
                        onChangeText={(v) => setInvoiceForm({ ...invoiceForm, iban: v })}
                        placeholder="CH00 0000 0000 0000 0000 0"
                        placeholderTextColor={colors.muted}
                    />
                </View>

                <View className="flex-row gap-3">
                    <View className="flex-1">
                        <Text className="text-xs text-muted mb-1 font-semibold">SWIFT/BIC</Text>
                        <TextInput
                            className="bg-background border border-border rounded-lg px-3 py-2.5 text-foreground text-sm"
                            style={{ color: colors.foreground }}
                            value={invoiceForm.swift_bic}
                            onChangeText={(v) => setInvoiceForm({ ...invoiceForm, swift_bic: v })}
                            placeholder="Optional"
                            placeholderTextColor={colors.muted}
                        />
                    </View>
                    <View className="flex-1">
                        <Text className="text-xs text-muted mb-1 font-semibold">Kontonummer</Text>
                        <TextInput
                            className="bg-background border border-border rounded-lg px-3 py-2.5 text-foreground text-sm"
                            style={{ color: colors.foreground }}
                            value={invoiceForm.account_number}
                            onChangeText={(v) => setInvoiceForm({ ...invoiceForm, account_number: v })}
                            placeholder="Optional"
                            placeholderTextColor={colors.muted}
                        />
                    </View>
                </View>
            </View>

            <View className="bg-surface rounded-xl p-4 border border-border">
                <Text className="text-xs text-muted leading-5">
                    ℹ️ Diese Angaben werden auf allen neuen Rechnungen, Mahnungen und E-Mails verwendet.
                </Text>
            </View>
        </View>
    );

    const renderDunningSettings = () => (
        <View className="gap-4">
            {/* Auto-Toggle */}
            <View className="bg-surface rounded-xl p-5 border border-border">
                <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                        <Text className="text-base font-bold text-foreground">Automatische Mahnungen</Text>
                        <Text className="text-sm text-muted mt-1">
                            Überfällige Rechnungen automatisch mahnen
                        </Text>
                    </View>
                    <Switch
                        value={dunningForm.auto_enabled}
                        onValueChange={(v) => setDunningForm({ ...dunningForm, auto_enabled: v })}
                        trackColor={{ false: colors.border, true: colors.primary }}
                        thumbColor="#fff"
                    />
                </View>
            </View>

            {/* Allgemein */}
            <View className="bg-surface rounded-xl p-5 border border-border">
                <Text className="text-base font-bold text-foreground mb-4">Fristen & Gebühren</Text>
                <View className="flex-row gap-3 mb-3">
                    <View className="flex-1">
                        <Text className="text-xs text-muted mb-1 font-semibold">Tage nach Fälligkeit</Text>
                        <TextInput
                            className="bg-background border border-border rounded-lg px-3 py-2.5 text-foreground"
                            style={{ color: colors.foreground }}
                            value={dunningForm.days_after_due_reminder?.toString()}
                            onChangeText={(v) => setDunningForm({ ...dunningForm, days_after_due_reminder: parseInt(v) || 0 })}
                            keyboardType="number-pad"
                            placeholderTextColor={colors.muted}
                        />
                        <Text className="text-xs text-muted mt-1">Erste Erinnerung</Text>
                    </View>
                    <View className="flex-1">
                        <Text className="text-xs text-muted mb-1 font-semibold">Tage zwischen Stufen</Text>
                        <TextInput
                            className="bg-background border border-border rounded-lg px-3 py-2.5 text-foreground"
                            style={{ color: colors.foreground }}
                            value={dunningForm.days_between_levels?.toString()}
                            onChangeText={(v) => setDunningForm({ ...dunningForm, days_between_levels: parseInt(v) || 0 })}
                            keyboardType="number-pad"
                            placeholderTextColor={colors.muted}
                        />
                        <Text className="text-xs text-muted mt-1">Nächste Mahnstufe</Text>
                    </View>
                </View>
                <View>
                    <Text className="text-xs text-muted mb-1 font-semibold">Mahngebühr (CHF)</Text>
                    <TextInput
                        className="bg-background border border-border rounded-lg px-3 py-2.5 text-foreground"
                        style={{ color: colors.foreground }}
                        value={dunningForm.dunning_fee?.toString()}
                        onChangeText={(v) => setDunningForm({ ...dunningForm, dunning_fee: parseFloat(v) || 0 })}
                        keyboardType="decimal-pad"
                        placeholderTextColor={colors.muted}
                    />
                    <Text className="text-xs text-muted mt-1">Wird ab der 2. Mahnung verrechnet</Text>
                </View>
            </View>

            {/* Mahnstufen */}
            <Text className="text-base font-bold text-foreground">Mahnstufen & Texte</Text>
            {LEVEL_CONFIG.map((level) => (
                <TouchableOpacity
                    key={level.key}
                    className="bg-surface rounded-xl border border-border overflow-hidden"
                    activeOpacity={0.8}
                    onPress={() => setExpandedLevel(expandedLevel === level.key ? null : level.key)}
                >
                    <View className="p-4 flex-row items-center justify-between">
                        <View className="flex-row items-center gap-3">
                            <View
                                className="w-10 h-10 rounded-lg items-center justify-center"
                                style={{ backgroundColor: level.color + "20" }}
                            >
                                <IconSymbol name={level.icon as any} size={18} color={level.color} />
                            </View>
                            <View>
                                <Text className="text-sm font-bold text-foreground">{level.label}</Text>
                                <Text className="text-xs text-muted">{level.description}</Text>
                            </View>
                        </View>
                        <IconSymbol
                            name={expandedLevel === level.key ? "chevron.up" : "chevron.down"}
                            size={16}
                            color={colors.muted}
                        />
                    </View>
                    {expandedLevel === level.key && (
                        <View className="px-4 pb-4 gap-3 border-t border-border pt-3">
                            <View>
                                <Text className="text-xs text-muted mb-1 font-semibold">E-Mail Betreff</Text>
                                <TextInput
                                    className="bg-background border border-border rounded-lg px-3 py-2.5 text-foreground text-sm"
                                    style={{ color: colors.foreground }}
                                    value={dunningForm[level.subjectKey]}
                                    onChangeText={(v) => setDunningForm({ ...dunningForm, [level.subjectKey]: v })}
                                    placeholderTextColor={colors.muted}
                                />
                            </View>
                            <View>
                                <Text className="text-xs text-muted mb-1 font-semibold">Mahntext</Text>
                                <TextInput
                                    className="bg-background border border-border rounded-lg px-3 py-2.5 text-foreground text-sm"
                                    style={{ color: colors.foreground, minHeight: 120, textAlignVertical: "top" }}
                                    value={dunningForm[level.textKey]}
                                    onChangeText={(v) => setDunningForm({ ...dunningForm, [level.textKey]: v })}
                                    multiline
                                    placeholderTextColor={colors.muted}
                                />
                                <Text className="text-xs text-muted mt-1">
                                    Platzhalter: {"{invoice_number}"}, {"{amount}"}, {"{due_date}"}
                                </Text>
                            </View>
                        </View>
                    )}
                </TouchableOpacity>
            ))}

            <View className="bg-surface rounded-xl p-4 border border-border">
                <Text className="text-xs text-muted leading-5">
                    ℹ️ Ablauf: Nach Fälligkeit → Zahlungserinnerung → 1. Mahnung → 2. Mahnung (+Gebühr) → 3. Mahnung (Betreibung).
                    {"\n"}Verfügbare Platzhalter: {"{invoice_number}"}, {"{amount}"}, {"{due_date}"}
                </Text>
            </View>
        </View>
    );

    return (
        <ScreenContainer>
            <ScrollView className="flex-1" contentContainerStyle={{ padding: contentPadding, paddingBottom: 40 }}>
                <View style={containerStyle}>
                    {/* Header */}
                    <View className="flex-row items-center justify-between mb-4">
                        <View className="flex-row items-center gap-3">
                            <TouchableOpacity onPress={() => router.push("/settings" as any)} activeOpacity={0.7}>
                                <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
                            </TouchableOpacity>
                            <View>
                                <Text className="text-2xl font-bold text-foreground">Rechnungen & Mahnwesen</Text>
                                <Text className="text-sm text-muted">Einstellungen und Konfiguration</Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            className="bg-primary px-5 py-2.5 rounded-lg"
                            activeOpacity={0.8}
                            onPress={handleSave}
                            disabled={isSaving}
                        >
                            <Text className="text-background font-semibold">
                                {isSaving ? "..." : "Speichern"}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Tabs */}
                    <View className="flex-row gap-2 mb-4">
                        <TouchableOpacity
                            className={`flex-1 py-3 rounded-lg flex-row items-center justify-center gap-2 ${activeTab === "invoices" ? "bg-primary" : "bg-surface border border-border"}`}
                            onPress={() => setActiveTab("invoices")}
                        >
                            <IconSymbol name="doc.text.fill" size={16} color={activeTab === "invoices" ? colors.background : colors.muted} />
                            <Text className={`text-sm font-semibold ${activeTab === "invoices" ? "text-background" : "text-foreground"}`}>
                                Rechnungen
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            className={`flex-1 py-3 rounded-lg flex-row items-center justify-center gap-2 ${activeTab === "dunning" ? "bg-primary" : "bg-surface border border-border"}`}
                            onPress={() => setActiveTab("dunning")}
                        >
                            <IconSymbol name="exclamationmark.triangle.fill" size={16} color={activeTab === "dunning" ? colors.background : colors.muted} />
                            <Text className={`text-sm font-semibold ${activeTab === "dunning" ? "text-background" : "text-foreground"}`}>
                                Mahnungen
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Content */}
                    {activeTab === "invoices" && renderInvoiceSettings()}
                    {activeTab === "dunning" && renderDunningSettings()}
                </View>
            </ScrollView>
        </ScreenContainer>
    );
}

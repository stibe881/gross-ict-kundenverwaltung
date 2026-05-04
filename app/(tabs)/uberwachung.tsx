import { useState, useCallback } from "react";
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    TextInput,
    Platform,
    Alert,
    RefreshControl,
} from "react-native";
import { useGlobalRefresh } from "@/hooks/use-global-refresh";
import { Stack, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";

// ── Typen ──────────────────────────────────────────────────────────────────

interface MonitoringUrl {
    id: string;
    name: string;
    url: string;
    check_interval: number;
    is_active: boolean;
    last_checked_at: string | null;
    last_status: "up" | "down" | "unknown";
    last_response_time: number | null;
    last_status_code: number | null;
    notes: string | null;
    created_at: string;
}

// ── Hilfsfunktionen ────────────────────────────────────────────────────────

function formatRelativeTime(isoString: string | null): string {
    if (!isoString) return "Nie geprüft";
    const diff = Date.now() - new Date(isoString).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Gerade eben";
    if (minutes < 60) return `vor ${minutes} Min.`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `vor ${hours} Std.`;
    return `vor ${Math.floor(hours / 24)} Tagen`;
}

async function pingUrl(url: string): Promise<{
    status: "up" | "down";
    statusCode?: number;
    responseTime?: number;
}> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const start = Date.now();
    try {
        const res = await fetch(url, {
            method: "GET",
            signal: controller.signal,
            // no-cors nur auf Web möglich; auf Native ist es nicht nötig
            ...(Platform.OS === "web" ? { mode: "no-cors" } : {}),
        });
        clearTimeout(timeout);
        const responseTime = Date.now() - start;
        // no-cors liefert immer opaque response (status 0) – gilt als up
        const statusCode = res.status;
        return { status: "up", statusCode, responseTime };
    } catch {
        clearTimeout(timeout);
        return { status: "down" };
    }
}

// ── Komponente: Status-Badge ───────────────────────────────────────────────

function StatusBadge({ status }: { status: "up" | "down" | "unknown" }) {
    const colors = useColors();
    const config = {
        up: { label: "Online", bg: "#16A34A18", text: "#16A34A", dot: "#16A34A" },
        down: { label: "Offline", bg: "#DC262618", text: "#DC2626", dot: "#DC2626" },
        unknown: { label: "Unbekannt", bg: colors.surface, text: colors.muted, dot: colors.muted },
    }[status];

    return (
        <View style={{
            flexDirection: "row", alignItems: "center", gap: 6,
            backgroundColor: config.bg, borderRadius: 20,
            paddingHorizontal: 10, paddingVertical: 5,
        }}>
            <View style={{
                width: 7, height: 7, borderRadius: 4,
                backgroundColor: config.dot,
                ...(status === "up" ? {
                    shadowColor: config.dot,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.8,
                    shadowRadius: 3,
                } : {}),
            }} />
            <Text style={{ fontSize: 12, fontWeight: "600", color: config.text }}>{config.label}</Text>
        </View>
    );
}

// ── Hauptkomponente ────────────────────────────────────────────────────────

export default function UeberwachungScreen() {
    const colors = useColors();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { refreshing, onRefresh } = useGlobalRefresh();
    const { isWide, contentPadding } = useResponsiveLayout();

    // Form-State
    const [isEditing, setIsEditing] = useState(false);
    const [editingEntry, setEditingEntry] = useState<MonitoringUrl | null>(null);
    const [form, setForm] = useState({ name: "", url: "", notes: "" });
    const [isSaving, setIsSaving] = useState(false);

    // Checking-State (Map id → boolean)
    const [checkingIds, setCheckingIds] = useState<Record<string, boolean>>({});

    // ── Daten laden ──────────────────────────────────────────────────────

    const { data: urls = [], isLoading } = useQuery({
        queryKey: ["monitoringUrls"],
        queryFn: Data.getMonitoringUrls,
    });

    // ── Formular-Handlers ────────────────────────────────────────────────

    const openAddForm = () => {
        setForm({ name: "", url: "", notes: "" });
        setEditingEntry(null);
        setIsEditing(true);
    };

    const openEditForm = (entry: MonitoringUrl) => {
        setForm({ name: entry.name, url: entry.url, notes: entry.notes || "" });
        setEditingEntry(entry);
        setIsEditing(true);
    };

    const cancelForm = () => {
        setIsEditing(false);
        setEditingEntry(null);
    };

    const handleSave = async () => {
        if (!form.name.trim() || !form.url.trim()) {
            Alert.alert("Fehler", "Name und URL sind erforderlich.");
            return;
        }
        let finalUrl = form.url.trim();
        if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
            finalUrl = "https://" + finalUrl;
        }
        setIsSaving(true);
        try {
            if (editingEntry) {
                await Data.updateMonitoringUrl(editingEntry.id, {
                    name: form.name.trim(),
                    url: finalUrl,
                    notes: form.notes.trim() || undefined,
                });
            } else {
                await Data.createMonitoringUrl({
                    name: form.name.trim(),
                    url: finalUrl,
                    notes: form.notes.trim() || undefined,
                });
            }
            queryClient.invalidateQueries({ queryKey: ["monitoringUrls"] });
            cancelForm();
        } catch (e: any) {
            Alert.alert("Fehler", e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (entry: MonitoringUrl) => {
        const confirm = () => executeDelete(entry.id);
        if (Platform.OS === "web") {
            if (window.confirm(`"${entry.name}" wirklich löschen?`)) confirm();
        } else {
            Alert.alert("Löschen", `"${entry.name}" wirklich löschen?`, [
                { text: "Abbrechen", style: "cancel" },
                { text: "Löschen", style: "destructive", onPress: confirm },
            ]);
        }
    };

    const executeDelete = async (id: string) => {
        try {
            await Data.deleteMonitoringUrl(id);
            queryClient.invalidateQueries({ queryKey: ["monitoringUrls"] });
        } catch (e: any) {
            Alert.alert("Fehler", e.message);
        }
    };

    // ── Ping-Handler ─────────────────────────────────────────────────────

    const handleCheck = useCallback(async (entry: MonitoringUrl) => {
        setCheckingIds(prev => ({ ...prev, [entry.id]: true }));
        try {
            const result = await pingUrl(entry.url);
            await Data.saveMonitoringCheckResult(entry.id, {
                last_status: result.status,
                last_status_code: result.statusCode,
                last_response_time: result.responseTime,
            });
            queryClient.invalidateQueries({ queryKey: ["monitoringUrls"] });
        } catch (e) {
            // Stille Fehler – Result wurde schon gespeichert
        } finally {
            setCheckingIds(prev => ({ ...prev, [entry.id]: false }));
        }
    }, [queryClient]);

    // ── Render ────────────────────────────────────────────────────────────

    if (isLoading) {
        return (
            <ScreenContainer className="items-center justify-center">
                <ActivityIndicator size="large" color={colors.primary} />
            </ScreenContainer>
        );
    }

    return (
        <ScreenContainer>
            <Stack.Screen options={{ headerShown: false }} />

            <ScrollView
                className="flex-1"
                contentContainerStyle={{ padding: contentPadding, paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                <View style={isWide ? { maxWidth: 860, alignSelf: "center", width: "100%" } : undefined}>

                    {/* ── Header ─────────────────────────────────────────── */}
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 28, marginTop: 4 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ padding: 4, marginLeft: -4 }}>
                                <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
                            </TouchableOpacity>
                            <View>
                                <Text style={{ fontSize: 24, fontWeight: "bold", color: colors.foreground }}>Überwachung</Text>
                                <Text style={{ fontSize: 14, color: colors.muted, marginTop: 4 }}>
                                    {(urls as MonitoringUrl[]).length > 0
                                        ? `${(urls as MonitoringUrl[]).filter(u => u.last_status === "up").length} von ${(urls as MonitoringUrl[]).length} URLs online`
                                        : "Websites & Dienste überwachen"
                                    }
                                </Text>
                            </View>
                        </View>

                        {!isEditing && (
                            <TouchableOpacity
                                onPress={openAddForm}
                                style={{
                                    backgroundColor: colors.primary,
                                    paddingHorizontal: 16,
                                    paddingVertical: 10,
                                    borderRadius: 12,
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 8,
                                }}
                                activeOpacity={0.8}
                            >
                                <IconSymbol name="plus" size={16} color="#FFFFFF" />
                                <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 14 }}>URL hinzufügen</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* ── Formular ───────────────────────────────────────── */}
                    {isEditing && (
                        <View style={{
                            backgroundColor: colors.surface,
                            borderRadius: 16,
                            padding: 20,
                            borderWidth: 1,
                            borderColor: colors.primary + "40",
                            marginBottom: 24,
                        }}>
                            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground, marginBottom: 20 }}>
                                {editingEntry ? "URL bearbeiten" : "Neue URL hinzufügen"}
                            </Text>

                            <View style={{ gap: 16 }}>
                                {/* Name */}
                                <View>
                                    <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 6, fontWeight: "500", marginLeft: 2 }}>
                                        Name *
                                    </Text>
                                    <View style={{
                                        backgroundColor: colors.background,
                                        borderRadius: 10,
                                        borderWidth: 1,
                                        borderColor: form.name ? colors.primary + "60" : colors.border,
                                        padding: Platform.OS === "web" ? 12 : 14,
                                    }}>
                                        <TextInput
                                            value={form.name}
                                            onChangeText={t => setForm(p => ({ ...p, name: t }))}
                                            placeholder="z.B. Firmen-Website"
                                            placeholderTextColor={colors.muted}
                                            style={{ fontSize: 15, color: colors.foreground }}
                                        />
                                    </View>
                                </View>

                                {/* URL */}
                                <View>
                                    <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 6, fontWeight: "500", marginLeft: 2 }}>
                                        URL *
                                    </Text>
                                    <View style={{
                                        backgroundColor: colors.background,
                                        borderRadius: 10,
                                        borderWidth: 1,
                                        borderColor: form.url ? colors.primary + "60" : colors.border,
                                        padding: Platform.OS === "web" ? 12 : 14,
                                    }}>
                                        <TextInput
                                            value={form.url}
                                            onChangeText={t => setForm(p => ({ ...p, url: t }))}
                                            placeholder="z.B. https://gross-ict.ch"
                                            placeholderTextColor={colors.muted}
                                            autoCapitalize="none"
                                            keyboardType="url"
                                            style={{ fontSize: 15, color: colors.foreground }}
                                        />
                                    </View>
                                </View>

                                {/* Notiz */}
                                <View>
                                    <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 6, fontWeight: "500", marginLeft: 2 }}>
                                        Notiz (Optional)
                                    </Text>
                                    <View style={{
                                        backgroundColor: colors.background,
                                        borderRadius: 10,
                                        borderWidth: 1,
                                        borderColor: colors.border,
                                        padding: Platform.OS === "web" ? 12 : 14,
                                    }}>
                                        <TextInput
                                            value={form.notes}
                                            onChangeText={t => setForm(p => ({ ...p, notes: t }))}
                                            placeholder="Kurze Beschreibung..."
                                            placeholderTextColor={colors.muted}
                                            style={{ fontSize: 15, color: colors.foreground }}
                                        />
                                    </View>
                                </View>

                                {/* Aktionen */}
                                <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 4 }}>
                                    <TouchableOpacity
                                        onPress={cancelForm}
                                        style={{ paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10 }}
                                    >
                                        <Text style={{ color: colors.muted, fontWeight: "600", fontSize: 15 }}>Abbrechen</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={handleSave}
                                        disabled={isSaving}
                                        style={{
                                            backgroundColor: colors.primary,
                                            paddingHorizontal: 20,
                                            paddingVertical: 12,
                                            borderRadius: 10,
                                            opacity: isSaving ? 0.7 : 1,
                                        }}
                                    >
                                        <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 15 }}>
                                            {isSaving ? "Speichern..." : "Speichern"}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* ── Leer-Zustand ───────────────────────────────────── */}
                    {!isEditing && (urls as MonitoringUrl[]).length === 0 && (
                        <View style={{
                            alignItems: "center",
                            justifyContent: "center",
                            paddingVertical: 64,
                            backgroundColor: colors.surface,
                            borderRadius: 20,
                            borderWidth: 1,
                            borderColor: colors.border,
                        }}>
                            <View style={{
                                width: 72, height: 72, borderRadius: 36,
                                backgroundColor: "#06B6D418",
                                alignItems: "center", justifyContent: "center",
                                marginBottom: 20,
                            }}>
                                <IconSymbol name="wifi" size={36} color="#06B6D4" />
                            </View>
                            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground }}>
                                Noch keine URLs überwacht
                            </Text>
                            <Text style={{ fontSize: 14, color: colors.muted, marginTop: 8, textAlign: "center", maxWidth: 280 }}>
                                Fügen Sie URLs hinzu, um deren Erreichbarkeit zu überwachen.
                            </Text>
                            <TouchableOpacity
                                onPress={openAddForm}
                                style={{
                                    marginTop: 24,
                                    backgroundColor: "#06B6D4",
                                    paddingHorizontal: 24,
                                    paddingVertical: 12,
                                    borderRadius: 12,
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 8,
                                }}
                                activeOpacity={0.8}
                            >
                                <IconSymbol name="plus" size={16} color="#FFFFFF" />
                                <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 15 }}>Erste URL hinzufügen</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* ── URL-Liste ──────────────────────────────────────── */}
                    <View style={{ gap: 12 }}>
                        {(urls as MonitoringUrl[]).map((entry) => {
                            const isChecking = !!checkingIds[entry.id];
                            return (
                                <View
                                    key={entry.id}
                                    style={{
                                        backgroundColor: colors.surface,
                                        borderRadius: 16,
                                        borderWidth: 1,
                                        borderColor: entry.last_status === "down"
                                            ? "#DC262630"
                                            : entry.last_status === "up"
                                                ? "#16A34A20"
                                                : colors.border,
                                        overflow: "hidden",
                                    }}
                                >
                                    {/* Oberer Bereich */}
                                    <View style={{ padding: 16, flexDirection: "row", alignItems: "flex-start", gap: 14 }}>
                                        {/* Icon */}
                                        <View style={{
                                            width: 46, height: 46, borderRadius: 14,
                                            backgroundColor: "#06B6D415",
                                            alignItems: "center", justifyContent: "center",
                                            marginTop: 2,
                                        }}>
                                            <IconSymbol
                                                name={entry.last_status === "up" ? "wifi" : entry.last_status === "down" ? "wifi.slash" : "wifi"}
                                                size={22}
                                                color={entry.last_status === "up" ? "#16A34A" : entry.last_status === "down" ? "#DC2626" : "#06B6D4"}
                                            />
                                        </View>

                                        {/* Info */}
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>
                                                    {entry.name}
                                                </Text>
                                                <StatusBadge status={entry.last_status || "unknown"} />
                                            </View>
                                            <Text style={{ fontSize: 13, color: colors.primary, marginTop: 3 }} numberOfLines={1}>
                                                {entry.url}
                                            </Text>
                                            {entry.notes && (
                                                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4 }} numberOfLines={2}>
                                                    {entry.notes}
                                                </Text>
                                            )}
                                        </View>

                                        {/* Aktionen */}
                                        <View style={{ flexDirection: "row", gap: 4 }}>
                                            <TouchableOpacity
                                                onPress={() => openEditForm(entry)}
                                                style={{ padding: 8 }}
                                                activeOpacity={0.7}
                                            >
                                                <IconSymbol name="pencil" size={17} color={colors.muted} />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => handleDelete(entry)}
                                                style={{ padding: 8 }}
                                                activeOpacity={0.7}
                                            >
                                                <IconSymbol name="trash.fill" size={17} color={colors.error} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    {/* Unterer Bereich – Stats + Check-Button */}
                                    <View style={{
                                        borderTopWidth: 1,
                                        borderTopColor: colors.border,
                                        paddingHorizontal: 16,
                                        paddingVertical: 10,
                                        flexDirection: "row",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        backgroundColor: colors.background + "60",
                                    }}>
                                        <View style={{ flexDirection: "row", gap: 20 }}>
                                            {/* Letzte Prüfung */}
                                            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                                                <IconSymbol name="clock" size={13} color={colors.muted} />
                                                <Text style={{ fontSize: 12, color: colors.muted }}>
                                                    {formatRelativeTime(entry.last_checked_at)}
                                                </Text>
                                            </View>
                                            {/* HTTP-Code */}
                                            {entry.last_status_code != null && (
                                                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                                                    <IconSymbol name="number" size={13} color={colors.muted} />
                                                    <Text style={{ fontSize: 12, color: colors.muted }}>
                                                        HTTP {entry.last_status_code}
                                                    </Text>
                                                </View>
                                            )}
                                            {/* Antwortzeit */}
                                            {entry.last_response_time != null && (
                                                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                                                    <IconSymbol name="bolt.fill" size={13} color={colors.muted} />
                                                    <Text style={{ fontSize: 12, color: colors.muted }}>
                                                        {entry.last_response_time} ms
                                                    </Text>
                                                </View>
                                            )}
                                        </View>

                                        {/* Jetzt prüfen */}
                                        <TouchableOpacity
                                            onPress={() => handleCheck(entry)}
                                            disabled={isChecking}
                                            style={{
                                                flexDirection: "row",
                                                alignItems: "center",
                                                gap: 6,
                                                backgroundColor: isChecking ? colors.border : "#06B6D415",
                                                borderRadius: 8,
                                                paddingHorizontal: 12,
                                                paddingVertical: 6,
                                                borderWidth: 1,
                                                borderColor: isChecking ? colors.border : "#06B6D440",
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            {isChecking ? (
                                                <ActivityIndicator size="small" color="#06B6D4" />
                                            ) : (
                                                <IconSymbol name="arrow.clockwise" size={13} color="#06B6D4" />
                                            )}
                                            <Text style={{ fontSize: 12, fontWeight: "600", color: isChecking ? colors.muted : "#06B6D4" }}>
                                                {isChecking ? "Prüfe..." : "Jetzt prüfen"}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })}
                    </View>

                </View>
            </ScrollView>
        </ScreenContainer>
    );
}

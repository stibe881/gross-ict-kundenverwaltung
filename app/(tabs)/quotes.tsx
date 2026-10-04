import { useState, useCallback, useMemo } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    RefreshControl,
    TextInput,
    ScrollView,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BackButton } from "@/components/back-button";
import { useColors } from "@/hooks/use-colors";
import { useIsReadOnly } from "@/hooks/use-is-read-only";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useGlobalRefresh } from "@/hooks/use-global-refresh";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/format";
import { QuoteFormModal } from "@/components/quote-form-modal";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
    draft: { label: "Entwurf", color: "#6B7280", icon: "pencil" },
    sent: { label: "Gesendet", color: "#3B82F6", icon: "paperplane.fill" },
    opened: { label: "Geöffnet", color: "#8B5CF6", icon: "envelope.open.fill" },
    accepted: { label: "Angenommen", color: "#10B981", icon: "checkmark.circle.fill" },
    rejected: { label: "Abgelehnt", color: "#EF4444", icon: "xmark" },
    expired: { label: "Abgelaufen", color: "#F59E0B", icon: "clock" },
};

export default function QuotesScreen() {
    const colors = useColors();
    const isReadOnly = useIsReadOnly();
    const { containerStyle, contentPadding } = useResponsiveLayout();
    const router = useRouter();
    const queryClient = useQueryClient();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string | null>("sent");
    const [searchQuery, setSearchQuery] = useState("");
    const { refreshing, onRefresh } = useGlobalRefresh();

    const {
        data: quotes,
        isLoading,
        refetch,
    } = useQuery({
        queryKey: ["quotes"],
        queryFn: Data.getAllQuotes,
    });

    useFocusEffect(
        useCallback(() => {
            // Auto-expire quotes with passed valid_until date
            Data.autoExpireQuotes().then(() => refetch());
        }, [])
    );

    const allQuotes = quotes || [];

    const counts = useMemo(() => {
        const c: Record<string, number> = { all: allQuotes.length };
        Object.keys(STATUS_CONFIG).forEach(k => { c[k] = 0; });
        allQuotes.forEach((q: any) => { c[q.status] = (c[q.status] || 0) + 1; });
        return c;
    }, [allQuotes]);

    const filteredQuotes = useMemo(() => {
        let list = allQuotes.filter((q: any) => (filterStatus ? q.status === filterStatus : true));
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            list = list.filter((q: any) => {
                const customerName = (q.customer?.company_name || `${q.customer?.first_name || ""} ${q.customer?.last_name || ""}`.trim()).toLowerCase();
                return q.quote_number?.toLowerCase().includes(query) || customerName.includes(query);
            });
        }
        // Neueste zuerst
        return [...list].sort((a: any, b: any) => (b.quote_date || "").localeCompare(a.quote_date || ""));
    }, [allQuotes, filterStatus, searchQuery]);

    const totalValue = filteredQuotes.reduce(
        (sum: number, q: any) => sum + (q.total || 0),
        0
    );

    // Läuft in den nächsten 7 Tagen ab (nur offene Angebote)
    const isExpiringSoon = (q: any) => {
        if (!q.valid_until || !["sent", "opened"].includes(q.status)) return false;
        const diff = (new Date(q.valid_until).getTime() - Date.now()) / 86400000;
        return diff >= 0 && diff <= 7;
    };

    const renderQuote = ({ item }: { item: any }) => {
        const customerName =
            item.customer?.company_name ||
            `${item.customer?.first_name || ""} ${item.customer?.last_name || ""}`.trim() ||
            "Unbekannt";
        const conf = STATUS_CONFIG[item.status] || STATUS_CONFIG.draft;
        const expiring = isExpiringSoon(item);

        const items = item.items || [];
        const nonOptionalItems = items.filter((i: any) => !i.optional);
        const optionalItems = items.filter((i: any) => !!i.optional);
        const nonOptionalTotal = nonOptionalItems.reduce((s: number, i: any) => s + (i.total || 0), 0);
        const optionalTotal = optionalItems.reduce((s: number, i: any) => s + (i.total || 0), 0);
        let optionalTax = 0;
        optionalItems.forEach((i: any) => {
            optionalTax += (i.total || 0) * ((i.vat_rate || 8.1) / 100);
        });
        const hasOptional = optionalTotal > 0;
        const totalExcl = item.total || (nonOptionalTotal + (item.tax || 0));
        const totalIncl = totalExcl + optionalTotal + optionalTax;

        return (
            <TouchableOpacity
                className="bg-surface rounded-xl mb-3 border border-border overflow-hidden"
                style={{ flexDirection: "row" }}
                activeOpacity={0.7}
                onPress={() => router.push(`/quote/${item.id}` as any)}
            >
                {/* Farbiger Status-Streifen links */}
                <View style={{ width: 4, backgroundColor: conf.color }} />

                <View className="flex-1 p-3.5">
                    {/* Kopfzeile: Nummer + Status */}
                    <View className="flex-row items-center mb-1.5">
                        <Text className="text-[11px] font-semibold text-muted">{item.quote_number}</Text>
                        <View className="flex-1" />
                        <View className="flex-row items-center px-2 py-0.5 rounded-full" style={{ backgroundColor: conf.color + "18" }}>
                            <IconSymbol name={conf.icon as any} size={10} color={conf.color} />
                            <Text className="text-[10px] font-bold ml-1" style={{ color: conf.color }}>{conf.label}</Text>
                        </View>
                    </View>

                    {/* Kunde */}
                    <Text className="text-base font-bold text-foreground" numberOfLines={1}>
                        {customerName}
                    </Text>

                    {/* Fusszeile: Datum/Gültigkeit + Betrag */}
                    <View className="flex-row items-end justify-between mt-2">
                        <View className="flex-1 mr-2">
                            <Text className="text-[11px] text-muted">{formatDate(item.quote_date)}</Text>
                            {item.valid_until && (
                                <View className="flex-row items-center mt-0.5">
                                    {expiring && (
                                        <IconSymbol name="exclamationmark.triangle.fill" size={10} color="#F59E0B" style={{ marginRight: 3 }} />
                                    )}
                                    <Text className="text-[11px]" style={{ color: expiring ? "#F59E0B" : colors.muted, fontWeight: expiring ? "700" : "400" }}>
                                        Gültig bis {formatDate(item.valid_until)}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <View className="items-end">
                            <Text className="text-base font-bold text-foreground">
                                {formatCurrency(totalExcl)}
                            </Text>
                            {hasOptional && (
                                <Text className="text-[10px] font-bold mt-0.5" style={{ color: colors.primary }}>
                                    Inkl. Optionen: {formatCurrency(totalIncl)}
                                </Text>
                            )}
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <ScreenContainer>
            <View className="flex-1" style={{ padding: contentPadding }}>
                <View style={[containerStyle, { flex: 1 }]}>
                    {/* ── Kopfzeile ── */}
                    <View className="flex-row justify-between items-center mb-4">
                        <View className="flex-row items-center gap-3 flex-1">
                            <BackButton />
                            <View>
                                <Text className="text-2xl font-bold text-foreground">Angebote</Text>
                                <Text className="text-xs text-muted">
                                    {filteredQuotes.length} {filteredQuotes.length === 1 ? "Angebot" : "Angebote"} · {formatCurrency(totalValue)}
                                </Text>
                            </View>
                        </View>
                        {!isReadOnly && (
                        <TouchableOpacity
                            onPress={() => setShowCreateModal(true)}
                            style={{ backgroundColor: colors.primary }}
                            className="w-10 h-10 rounded-full items-center justify-center"
                            activeOpacity={0.8}
                        >
                            <IconSymbol name="plus" size={22} color={colors.background} />
                        </TouchableOpacity>
                        )}
                    </View>

                    {/* ── Suche ── */}
                    <View className="flex-row items-center bg-surface border border-border rounded-xl px-3 py-2.5 gap-2 mb-3">
                        <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
                        <TextInput
                            className="flex-1 text-foreground text-sm"
                            placeholder="Angebot oder Kunde suchen..."
                            placeholderTextColor={colors.muted}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery("")}>
                                <IconSymbol name="xmark.circle.fill" size={16} color={colors.muted} />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* ── Filter-Chips mit Zählern ── */}
                    <View className="mb-4">
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                            <TouchableOpacity
                                onPress={() => setFilterStatus(null)}
                                className="flex-row items-center px-3 py-1.5 rounded-full border"
                                style={{
                                    backgroundColor: filterStatus === null ? colors.primary : colors.surface,
                                    borderColor: filterStatus === null ? colors.primary : colors.border,
                                }}
                                activeOpacity={0.8}
                            >
                                <Text className="text-xs font-semibold" style={{ color: filterStatus === null ? "#fff" : colors.foreground }}>Alle</Text>
                                <Text className="text-xs font-bold ml-1.5" style={{ color: filterStatus === null ? "#fff" : colors.primary }}>{counts.all}</Text>
                            </TouchableOpacity>
                            {Object.entries(STATUS_CONFIG).map(([key, config]) => {
                                const active = filterStatus === key;
                                return (
                                    <TouchableOpacity
                                        key={key}
                                        onPress={() => setFilterStatus(key)}
                                        className="flex-row items-center px-3 py-1.5 rounded-full border"
                                        style={{
                                            backgroundColor: active ? config.color : colors.surface,
                                            borderColor: active ? config.color : colors.border,
                                        }}
                                        activeOpacity={0.8}
                                    >
                                        <Text className="text-xs font-semibold" style={{ color: active ? "#fff" : colors.foreground }}>{config.label}</Text>
                                        <Text className="text-xs font-bold ml-1.5" style={{ color: active ? "#fff" : config.color }}>{counts[key] || 0}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>

                    {/* ── Liste ── */}
                    {isLoading && !quotes ? (
                        <View className="flex-1 items-center justify-center">
                            <ActivityIndicator size="large" color={colors.primary} />
                        </View>
                    ) : (
                        <FlatList
                            data={filteredQuotes}
                            renderItem={renderQuote}
                            keyExtractor={(item) => item.id}
                            showsVerticalScrollIndicator={false}
                            refreshControl={
                                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                            }
                            ListEmptyComponent={
                                <View className="items-center justify-center py-16">
                                    <IconSymbol name="doc.text" size={48} color={colors.muted} />
                                    <Text className="text-base font-semibold text-foreground mt-4">
                                        {searchQuery || filterStatus ? "Keine Angebote gefunden" : "Noch keine Angebote"}
                                    </Text>
                                    <Text className="text-sm text-muted mt-1 text-center">
                                        {searchQuery || filterStatus
                                            ? "Suche oder Filter anpassen."
                                            : "Erstelle dein erstes Angebot."}
                                    </Text>
                                    {!searchQuery && !filterStatus && (
                                        <TouchableOpacity
                                            onPress={() => setShowCreateModal(true)}
                                            style={{ backgroundColor: colors.primary }}
                                            className="mt-5 px-6 py-3 rounded-xl"
                                            activeOpacity={0.8}
                                        >
                                            <Text className="font-semibold" style={{ color: colors.background }}>
                                                Erstes Angebot erstellen
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            }
                        />
                    )}
                </View>
            </View>

            <QuoteFormModal
                visible={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ["quotes"] });
                }}
            />
        </ScreenContainer>
    );
}

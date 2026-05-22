import { useState, useCallback } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    RefreshControl,
    TextInput,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useGlobalRefresh } from "@/hooks/use-global-refresh";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/format";
import { QuoteFormModal } from "@/components/quote-form-modal";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    draft: { label: "Entwurf", color: "#6B7280" },
    sent: { label: "Gesendet", color: "#3B82F6" },
    accepted: { label: "Angenommen", color: "#10B981" },
    rejected: { label: "Abgelehnt", color: "#EF4444" },
    expired: { label: "Abgelaufen", color: "#F59E0B" },
};

export default function QuotesScreen() {
    const colors = useColors();
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

    const filteredQuotes = (quotes || []).filter((q: any) => {
        const matchesStatus = filterStatus ? q.status === filterStatus : true;
        if (!matchesStatus) return false;
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        const customerName = (q.customer?.company_name || `${q.customer?.first_name || ""} ${q.customer?.last_name || ""}`.trim()).toLowerCase();
        return (
            q.quote_number?.toLowerCase().includes(query) ||
            customerName.includes(query)
        );
    });

    const totalValue = filteredQuotes.reduce(
        (sum: number, q: any) => sum + (q.total || 0),
        0
    );

    const getStatusBadge = (status: string) => {
        const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
        return (
            <View
                style={{ backgroundColor: config.color + "20", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }}
            >
                <Text style={{ color: config.color, fontSize: 12, fontWeight: "600" }}>
                    {config.label}
                </Text>
            </View>
        );
    };

    const renderQuote = ({ item }: { item: any }) => {
        const customerName =
            item.customer?.company_name ||
            `${item.customer?.first_name || ""} ${item.customer?.last_name || ""}`.trim() ||
            "Unbekannt";

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
                className="bg-surface rounded-xl p-4 mb-3 border border-border"
                activeOpacity={0.7}
                onPress={() => router.push(`/quote/${item.id}` as any)}
            >
                <View className="flex-row justify-between items-start mb-2">
                    <View className="flex-1">
                        <Text className="text-base font-semibold text-foreground">
                            {item.quote_number}
                        </Text>
                        <Text className="text-sm text-muted mt-1">{customerName}</Text>
                    </View>
                    {getStatusBadge(item.status)}
                </View>
                <View className="flex-row justify-between items-center mt-2">
                    <Text className="text-sm text-muted">
                        {formatDate(item.quote_date)} {item.valid_until ? `· Gültig bis ${formatDate(item.valid_until)}` : ""}
                    </Text>
                    <View className="items-end">
                        <Text className="text-base font-bold text-foreground">
                            {formatCurrency(totalExcl)}
                        </Text>
                        {hasOptional && (
                            <Text className="text-xs font-bold mt-1" style={{ color: colors.primary }}>
                                Inkl. Opt: {formatCurrency(totalIncl)}
                            </Text>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <ScreenContainer>
            <View className="flex-1" style={{ padding: contentPadding }}>
                <View style={containerStyle}>
                    {/* Header */}
                    <View className="flex-row justify-between items-center mb-4">
                        <View className="flex-row items-center gap-3">
                            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
                                <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
                            </TouchableOpacity>
                            <View>
                                <Text className="text-2xl font-bold text-foreground">Angebote</Text>
                                <Text className="text-sm text-muted mt-1">
                                    {filteredQuotes.length} Angebote · Gesamt: {formatCurrency(totalValue)}
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            onPress={() => setShowCreateModal(true)}
                            style={{ backgroundColor: colors.primary }}
                            className="w-10 h-10 rounded-full items-center justify-center"
                        >
                            <IconSymbol name="plus" size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    {/* Suchleiste */}
                    <View className="bg-surface rounded-xl p-3 mb-4 flex-row items-center border border-border">
                        <IconSymbol name="magnifyingglass" size={20} color={colors.muted} />
                        <TextInput
                            className="flex-1 ml-2 text-base text-foreground"
                            placeholder="Angebot suchen..."
                            placeholderTextColor={colors.muted}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>

                    {/* Filter */}
                    <View className="flex-row gap-2 mb-4">
                        <TouchableOpacity
                            onPress={() => setFilterStatus(null)}
                            style={{
                                backgroundColor: filterStatus === null ? colors.primary : colors.surface,
                                borderColor: colors.border,
                            }}
                            className="px-3 py-1.5 rounded-full border"
                        >
                            <Text
                                style={{
                                    color: filterStatus === null ? "#fff" : colors.foreground,
                                    fontSize: 13,
                                    fontWeight: "600",
                                }}
                            >
                                Alle
                            </Text>
                        </TouchableOpacity>
                        {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                            <TouchableOpacity
                                key={key}
                                onPress={() => setFilterStatus(key)}
                                style={{
                                    backgroundColor: filterStatus === key ? config.color : colors.surface,
                                    borderColor: colors.border,
                                }}
                                className="px-3 py-1.5 rounded-full border"
                            >
                                <Text
                                    style={{
                                        color: filterStatus === key ? "#fff" : colors.foreground,
                                        fontSize: 13,
                                        fontWeight: "600",
                                    }}
                                >
                                    {config.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Liste */}
                    {isLoading && !quotes ? (
                        <View className="flex-1 items-center justify-center">
                            <ActivityIndicator size="large" color={colors.primary} />
                        </View>
                    ) : (
                        <FlatList
                            data={filteredQuotes}
                            renderItem={renderQuote}
                            keyExtractor={(item) => item.id}
                            refreshControl={
                                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                            }
                            ListEmptyComponent={
                                <View className="items-center justify-center py-12">
                                    <IconSymbol name="doc.text" size={48} color={colors.muted} />
                                    <Text className="text-muted text-base mt-4">
                                        Keine Angebote vorhanden
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => setShowCreateModal(true)}
                                        style={{ backgroundColor: colors.primary }}
                                        className="mt-4 px-6 py-3 rounded-lg"
                                    >
                                        <Text className="text-background font-semibold">
                                            Erstes Angebot erstellen
                                        </Text>
                                    </TouchableOpacity>
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

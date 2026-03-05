import { useState } from "react";
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/format";
import { showAlert, showConfirm } from "@/lib/alert";
import { QuoteFormModal } from "@/components/quote-form-modal";
import { downloadQuotePDF } from "@/lib/pdf-utils";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    draft: { label: "Entwurf", color: "#6B7280" },
    sent: { label: "Gesendet", color: "#3B82F6" },
    accepted: { label: "Angenommen", color: "#10B981" },
    rejected: { label: "Abgelehnt", color: "#EF4444" },
    expired: { label: "Abgelaufen", color: "#F59E0B" },
};

export default function QuoteDetailScreen() {
    const { id } = useLocalSearchParams();
    const colors = useColors();
    const router = useRouter();
    const queryClient = useQueryClient();
    const [showEditModal, setShowEditModal] = useState(false);

    const { data: quote, isLoading } = useQuery({
        queryKey: ["quote", id],
        queryFn: () => Data.getQuoteById(id as string),
        enabled: !!id,
    });

    const deleteQuote = useMutation({
        mutationFn: (quoteId: string) => Data.deleteQuote(quoteId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["quotes"] });
            showAlert("Erfolg", "Angebot wurde gelöscht");
            router.back();
        },
        onError: (error: any) => {
            showAlert("Fehler", error.message);
        },
    });

    const convertMutation = useMutation({
        mutationFn: (quoteId: string) => Data.convertQuoteToInvoice(quoteId),
        onSuccess: (invoice) => {
            queryClient.invalidateQueries({ queryKey: ["quotes"] });
            queryClient.invalidateQueries({ queryKey: ["invoices"] });
            showAlert("Erfolg", `Rechnung ${invoice.invoice_number} wurde erstellt!`);
            router.replace(`/invoice/${invoice.id}` as any);
        },
        onError: (error: any) => {
            showAlert("Fehler", error.message);
        },
    });

    const handleDelete = () => {
        showConfirm(
            "Angebot löschen",
            "Möchten Sie dieses Angebot wirklich löschen?",
            () => deleteQuote.mutate(id as string),
            "Löschen"
        );
    };

    const handleConvert = () => {
        showConfirm(
            "In Rechnung umwandeln",
            "Möchten Sie dieses Angebot in eine Rechnung umwandeln? Das Angebot wird als 'Angenommen' markiert.",
            () => convertMutation.mutate(id as string),
            "Umwandeln"
        );
    };

    const handleDownloadPDF = async () => {
        if (!quote) return;
        try {
            await downloadQuotePDF(quote);
        } catch (error: any) {
            showAlert("Fehler", "PDF konnte nicht erstellt werden: " + (error.message || ""));
        }
    };

    if (isLoading) {
        return (
            <ScreenContainer className="items-center justify-center">
                <ActivityIndicator size="large" color={colors.primary} />
            </ScreenContainer>
        );
    }

    if (!quote) {
        return (
            <ScreenContainer className="items-center justify-center">
                <Text className="text-muted text-base">Angebot nicht gefunden</Text>
            </ScreenContainer>
        );
    }

    const statusConfig = STATUS_CONFIG[quote.status] || STATUS_CONFIG.draft;
    const customerName =
        quote.customer?.company_name ||
        `${quote.customer?.first_name || ""} ${quote.customer?.last_name || ""}`.trim() ||
        "Unbekannt";

    return (
        <ScreenContainer>
            <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
                {/* Header */}
                <View className="flex-row items-center mb-6">
                    <TouchableOpacity onPress={() => router.back()} className="mr-3">
                        <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
                    </TouchableOpacity>
                    <View className="flex-1">
                        <Text className="text-2xl font-bold text-foreground">{quote.quote_number}</Text>
                        <Text className="text-sm text-muted mt-1">{customerName}</Text>
                    </View>
                    <View
                        style={{ backgroundColor: statusConfig.color + "20", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}
                    >
                        <Text style={{ color: statusConfig.color, fontWeight: "600", fontSize: 13 }}>
                            {statusConfig.label}
                        </Text>
                    </View>
                </View>

                {/* Infos */}
                <View className="bg-surface rounded-xl p-4 border border-border mb-4">
                    <View className="flex-row justify-between mb-3">
                        <Text className="text-sm text-muted">Datum</Text>
                        <Text className="text-sm text-foreground">{formatDate(quote.quote_date)}</Text>
                    </View>
                    {quote.valid_until && (
                        <View className="flex-row justify-between mb-3">
                            <Text className="text-sm text-muted">Gültig bis</Text>
                            <Text className="text-sm text-foreground">{formatDate(quote.valid_until)}</Text>
                        </View>
                    )}
                    <View className="flex-row justify-between mb-3">
                        <Text className="text-sm text-muted">Kunde</Text>
                        <Text className="text-sm text-foreground">{customerName}</Text>
                    </View>
                    {quote.customer?.email && (
                        <View className="flex-row justify-between">
                            <Text className="text-sm text-muted">E-Mail</Text>
                            <Text className="text-sm text-foreground">{quote.customer.email}</Text>
                        </View>
                    )}
                </View>

                {/* Positionen */}
                <Text className="text-lg font-bold text-foreground mb-3">Positionen</Text>
                {(quote.items || []).map((item: any, index: number) => (
                    <View
                        key={item.id || index}
                        className="bg-surface rounded-lg p-3 mb-2 border border-border"
                    >
                        <Text className="text-sm font-semibold text-foreground mb-1">{item.description}</Text>
                        <View className="flex-row justify-between">
                            <Text className="text-xs text-muted">
                                {item.quantity} × {formatCurrency(item.unit_price)} · {item.vat_rate}% MwSt
                            </Text>
                            <Text className="text-sm font-semibold text-foreground">
                                {formatCurrency(item.total)}
                            </Text>
                        </View>
                    </View>
                ))}

                {/* Zusammenfassung */}
                <View className="bg-surface rounded-xl p-4 border border-border mt-4">
                    <View className="flex-row justify-between mb-2">
                        <Text className="text-sm text-muted">Zwischensumme</Text>
                        <Text className="text-sm text-foreground">{formatCurrency(quote.subtotal)}</Text>
                    </View>
                    <View className="flex-row justify-between mb-3">
                        <Text className="text-sm text-muted">MwSt</Text>
                        <Text className="text-sm text-foreground">{formatCurrency(quote.tax)}</Text>
                    </View>
                    <View
                        className="flex-row justify-between pt-3 border-t"
                        style={{ borderTopColor: colors.border }}
                    >
                        <Text className="text-lg font-bold text-foreground">Total</Text>
                        <Text className="text-lg font-bold text-foreground">{formatCurrency(quote.total)}</Text>
                    </View>
                </View>

                {/* Notizen */}
                {quote.notes && (
                    <View className="bg-surface rounded-xl p-4 border border-border mt-4">
                        <Text className="text-sm font-semibold text-foreground mb-1">Notizen</Text>
                        <Text className="text-sm text-muted">{quote.notes}</Text>
                    </View>
                )}

                {/* Actions */}
                <View className="mt-6 gap-3">
                    {/* PDF herunterladen */}
                    <TouchableOpacity
                        onPress={handleDownloadPDF}
                        style={{ backgroundColor: colors.primary }}
                        className="p-4 rounded-lg flex-row items-center justify-center"
                        activeOpacity={0.8}
                    >
                        <IconSymbol name="arrow.down.doc.fill" size={20} color="#fff" />
                        <Text className="text-background font-semibold ml-2">PDF herunterladen</Text>
                    </TouchableOpacity>

                    {/* In Rechnung umwandeln */}
                    {(quote.status === "draft" || quote.status === "sent") && (
                        <TouchableOpacity
                            onPress={handleConvert}
                            disabled={convertMutation.isPending}
                            style={{ backgroundColor: colors.success }}
                            className="p-4 rounded-lg flex-row items-center justify-center"
                            activeOpacity={0.8}
                        >
                            {convertMutation.isPending ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <IconSymbol name="arrow.right.circle.fill" size={20} color="#fff" />
                                    <Text className="text-background font-semibold ml-2">In Rechnung umwandeln</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}

                    {/* Bearbeiten */}
                    <TouchableOpacity
                        onPress={() => setShowEditModal(true)}
                        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                        className="p-4 rounded-lg flex-row items-center justify-center border"
                        activeOpacity={0.7}
                    >
                        <IconSymbol name="pencil" size={18} color={colors.primary} />
                        <Text className="text-foreground font-semibold ml-2">Bearbeiten</Text>
                    </TouchableOpacity>

                    {/* Löschen */}
                    <TouchableOpacity
                        onPress={handleDelete}
                        disabled={deleteQuote.isPending}
                        className="p-4 rounded-lg flex-row items-center justify-center"
                        activeOpacity={0.7}
                    >
                        {deleteQuote.isPending ? (
                            <ActivityIndicator color={colors.error} />
                        ) : (
                            <>
                                <IconSymbol name="trash" size={18} color={colors.error} />
                                <Text style={{ color: colors.error }} className="font-semibold ml-2">Löschen</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* Edit Modal */}
            <QuoteFormModal
                visible={showEditModal}
                onClose={() => setShowEditModal(false)}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ["quote", id] });
                    queryClient.invalidateQueries({ queryKey: ["quotes"] });
                }}
                editQuote={quote}
            />
        </ScreenContainer>
    );
}

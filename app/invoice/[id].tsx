import { useState } from "react";
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { formatDate, formatCurrency } from "@/lib/format";

export default function InvoiceDetailScreen() {
    const { id } = useLocalSearchParams();
    const colors = useColors();

    const { data: invoice, isLoading } = trpc.invoices.getById.useQuery(
        { id: id as string },
        { enabled: !!id }
    );

    const getStatusLabel = (status: string) => {
        switch (status) {
            case "open": return "Offen";
            case "paid": return "Bezahlt";
            case "overdue": return "Überfällig";
            case "cancelled": return "Storniert";
            default: return status;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "open": return "bg-warning";
            case "paid": return "bg-success";
            case "overdue": return "bg-error";
            case "cancelled": return "bg-muted";
            default: return "bg-muted";
        }
    };

    if (isLoading) {
        return (
            <ScreenContainer>
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </ScreenContainer>
        );
    }

    if (!invoice) {
        return (
            <ScreenContainer>
                <View className="flex-1 items-center justify-center p-4">
                    <Text className="text-lg text-muted">Rechnung nicht gefunden</Text>
                    <TouchableOpacity
                        className="mt-4 bg-primary px-6 py-3 rounded-lg"
                        onPress={() => router.back()}
                    >
                        <Text className="text-background font-semibold">Zurück</Text>
                    </TouchableOpacity>
                </View>
            </ScreenContainer>
        );
    }

    const customerName = invoice.customer?.company_name ||
        `${invoice.customer?.first_name || ""} ${invoice.customer?.last_name || ""}`.trim() ||
        "Unbekannt";

    return (
        <ScreenContainer>
            <ScrollView className="flex-1">
                {/* Header */}
                <View className="p-4 flex-row items-center justify-between border-b border-border">
                    <TouchableOpacity
                        onPress={() => router.back()}
                        activeOpacity={0.7}
                        className="flex-row items-center"
                    >
                        <IconSymbol name="chevron.left" size={20} color={colors.primary} />
                        <Text className="text-primary font-semibold ml-1">Zurück</Text>
                    </TouchableOpacity>
                    <View className={`px-3 py-1 rounded-full ${getStatusColor(invoice.status)}`}>
                        <Text className="text-xs font-semibold text-white">
                            {getStatusLabel(invoice.status)}
                        </Text>
                    </View>
                </View>

                {/* Rechnungsnummer & Betrag */}
                <View className="p-4">
                    <Text className="text-3xl font-bold text-foreground mb-1">
                        {invoice.invoice_number}
                    </Text>
                    <Text className="text-lg text-muted mb-4">{customerName}</Text>
                    <Text className="text-4xl font-bold text-primary mb-6">
                        {formatCurrency(invoice.total)}
                    </Text>

                    {/* Rechnungsdetails */}
                    <View className="bg-surface rounded-xl border border-border p-4 mb-4">
                        <Text className="text-lg font-bold text-foreground mb-3">Details</Text>
                        <View className="gap-3">
                            <View className="flex-row justify-between">
                                <Text className="text-sm text-muted">Rechnungsdatum</Text>
                                <Text className="text-sm font-semibold text-foreground">
                                    {formatDate(invoice.invoice_date)}
                                </Text>
                            </View>
                            <View className="flex-row justify-between">
                                <Text className="text-sm text-muted">Fälligkeitsdatum</Text>
                                <Text className="text-sm font-semibold text-foreground">
                                    {formatDate(invoice.due_date)}
                                </Text>
                            </View>
                            <View className="flex-row justify-between">
                                <Text className="text-sm text-muted">Zwischensumme</Text>
                                <Text className="text-sm text-foreground">
                                    {formatCurrency(invoice.subtotal)}
                                </Text>
                            </View>
                            <View className="flex-row justify-between">
                                <Text className="text-sm text-muted">MwSt.</Text>
                                <Text className="text-sm text-foreground">
                                    {formatCurrency(invoice.vat_amount)}
                                </Text>
                            </View>
                            <View className="flex-row justify-between pt-2 border-t border-border">
                                <Text className="text-base font-bold text-foreground">Total</Text>
                                <Text className="text-base font-bold text-primary">
                                    {formatCurrency(invoice.total)}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Kunde */}
                    <View className="bg-surface rounded-xl border border-border p-4 mb-4">
                        <Text className="text-lg font-bold text-foreground mb-3">Kunde</Text>
                        <Text className="text-base font-semibold text-foreground">{customerName}</Text>
                        {invoice.customer?.email && (
                            <Text className="text-sm text-muted mt-1">{invoice.customer.email}</Text>
                        )}
                        {invoice.customer?.phone && (
                            <Text className="text-sm text-muted mt-1">{invoice.customer.phone}</Text>
                        )}
                        {(invoice.customer?.street || invoice.customer?.city) && (
                            <Text className="text-sm text-muted mt-1">
                                {[invoice.customer?.street, `${invoice.customer?.zip || ""} ${invoice.customer?.city || ""}`.trim()]
                                    .filter(Boolean)
                                    .join(", ")}
                            </Text>
                        )}
                    </View>

                    {/* Positionen */}
                    <View className="bg-surface rounded-xl border border-border p-4 mb-4">
                        <Text className="text-lg font-bold text-foreground mb-3">Positionen</Text>
                        {invoice.items && invoice.items.length > 0 ? (
                            <View className="gap-3">
                                {invoice.items.map((item: any, index: number) => (
                                    <View key={item.id || index} className="pb-3 border-b border-border last:border-0">
                                        <Text className="text-sm font-semibold text-foreground">{item.description}</Text>
                                        <View className="flex-row justify-between mt-1">
                                            <Text className="text-xs text-muted">
                                                {item.quantity} × {formatCurrency(item.unit_price)} · MwSt: {item.vat_rate}%
                                            </Text>
                                            <Text className="text-sm font-semibold text-foreground">
                                                {formatCurrency(item.total)}
                                            </Text>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <Text className="text-sm text-muted">Keine Positionen</Text>
                        )}
                    </View>

                    {/* Notizen */}
                    {invoice.notes && (
                        <View className="bg-surface rounded-xl border border-border p-4 mb-4">
                            <Text className="text-lg font-bold text-foreground mb-2">Notizen</Text>
                            <Text className="text-sm text-foreground">{invoice.notes}</Text>
                        </View>
                    )}
                </View>
            </ScrollView>
        </ScreenContainer>
    );
}

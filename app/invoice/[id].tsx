import { useState } from "react";
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    TextInput,
    Modal,
    Platform,
    Linking,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { formatCurrency, formatDate, getInvoiceTotal } from "@/lib/format";
import { InvoiceFormModal } from "@/components/invoice-form-modal-v2";
import { downloadInvoicePDF } from "@/lib/pdf-utils";
import { showAlert, showConfirm } from "@/lib/alert";

export default function InvoiceDetailScreen() {
    const { id } = useLocalSearchParams();
    const colors = useColors();

    const { data: invoice, isLoading, refetch } = useQuery({
        queryKey: ["invoice", id],
        queryFn: () => Data.getInvoiceById(id as string),
        enabled: !!id,
    });
    const { data: activities } = useQuery({
        queryKey: ["invoiceActivities", id],
        queryFn: () => Data.getInvoiceActivities(id as string),
        enabled: !!id,
    });
    const [showEditModal, setShowEditModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState("");

    const queryClient = useQueryClient();

    const deleteInvoice = useMutation({
        mutationFn: (invoiceId: string) => Data.deleteInvoice(invoiceId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["invoices"] });
            showAlert("Erfolg", "Rechnung wurde gelöscht");
            router.back();
        },
        onError: (error: any) => {
            showAlert("Fehler", `Rechnung konnte nicht gelöscht werden: ${error.message}`);
        },
    });

    const addPaymentMut = useMutation({
        mutationFn: ({ invoiceId, amount }: { invoiceId: string; amount: number }) =>
            Data.addPayment(invoiceId, amount),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["invoices"] });
            refetch();
            setShowPaymentModal(false);
            setPaymentAmount("");
            showAlert("Erfolg", "Zahlung wurde erfasst");
        },
        onError: (error: any) => {
            showAlert("Fehler", `Zahlung konnte nicht erfasst werden: ${error.message}`);
        },
    });

    const handleDelete = () => {
        showConfirm(
            "Rechnung löschen",
            "Möchten Sie diese Rechnung wirklich unwiderruflich löschen?",
            () => deleteInvoice.mutate(id as string)
        );
    };

    const handleAddPayment = () => {
        const amount = parseFloat(paymentAmount);
        if (!amount || amount <= 0) {
            showAlert("Fehler", "Bitte geben Sie einen gültigen Betrag ein");
            return;
        }
        addPaymentMut.mutate({ invoiceId: id as string, amount });
    };

    const handleDownloadPDF = async () => {
        if (!invoice) return;
        try {
            await downloadInvoicePDF(invoice);
        } catch (error: any) {
            showAlert("Fehler", "PDF konnte nicht erstellt werden: " + (error.message || ""));
        }
    };

    const handleSendInvoice = async () => {
        if (!invoice) return;
        try {
            await downloadInvoicePDF(invoice);
        } catch (error: any) {
            showAlert("Fehler", "PDF konnte nicht erstellt werden: " + (error.message || ""));
        }
    };

    const handleSendReminder = async () => {
        if (!invoice) return;
        try {
            await downloadInvoicePDF(invoice);
        } catch (error: any) {
            showAlert("Fehler", "PDF konnte nicht erstellt werden: " + (error.message || ""));
        }
    };

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

    const invoiceTotal = getInvoiceTotal(invoice);
    const remainingAmount = invoiceTotal - (invoice.paid_amount || 0);

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
                    <View className="flex-row items-center gap-3">
                        <TouchableOpacity
                            onPress={() => setShowEditModal(true)}
                            activeOpacity={0.7}
                            className="bg-primary px-4 py-2 rounded-lg"
                        >
                            <Text className="text-background font-semibold text-sm">Bearbeiten</Text>
                        </TouchableOpacity>
                        <View className={`px-3 py-1 rounded-full ${getStatusColor(invoice.status)}`}>
                            <Text className="text-xs font-semibold text-white">
                                {getStatusLabel(invoice.status)}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Rechnungsnummer & Betrag */}
                <View className="p-4">
                    <Text className="text-3xl font-bold text-foreground mb-1">
                        {invoice.invoice_number}
                    </Text>
                    <Text className="text-lg text-muted mb-4">{customerName}</Text>
                    <Text className="text-4xl font-bold text-primary mb-2">
                        {formatCurrency(invoiceTotal)}
                    </Text>
                    {(invoice.paid_amount || 0) > 0 && (
                        <View className="flex-row items-center gap-2 mb-4">
                            <Text className="text-sm text-success">
                                Bezahlt: {formatCurrency(invoice.paid_amount || 0)}
                            </Text>
                            {remainingAmount > 0 && (
                                <Text className="text-sm text-warning">
                                    · Offen: {formatCurrency(remainingAmount)}
                                </Text>
                            )}
                        </View>
                    )}

                    {/* Aktions-Buttons */}
                    <View className="gap-3 mb-4">
                        <View className="flex-row gap-3">
                            <TouchableOpacity
                                className="flex-1 bg-success py-3 rounded-lg flex-row items-center justify-center"
                                activeOpacity={0.8}
                                onPress={() => setShowPaymentModal(true)}
                            >
                                <IconSymbol name="banknote.fill" size={18} color="#FFFFFF" />
                                <Text className="text-white font-semibold ml-2 text-sm">Zahlung</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="flex-1 bg-primary py-3 rounded-lg flex-row items-center justify-center"
                                activeOpacity={0.8}
                                onPress={handleDownloadPDF}
                            >
                                <IconSymbol name="arrow.down.doc.fill" size={18} color="#FFFFFF" />
                                <Text className="text-background font-semibold ml-2 text-sm">PDF</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="flex-1 bg-error py-3 rounded-lg flex-row items-center justify-center"
                                activeOpacity={0.8}
                                onPress={handleDelete}
                            >
                                <IconSymbol name="trash.fill" size={18} color="#FFFFFF" />
                                <Text className="text-white font-semibold ml-2 text-sm">Löschen</Text>
                            </TouchableOpacity>
                        </View>
                        <View className="flex-row gap-3">
                            <TouchableOpacity
                                className="flex-1 bg-surface border border-border py-3 rounded-lg flex-row items-center justify-center"
                                activeOpacity={0.8}
                                onPress={handleSendInvoice}
                            >
                                <IconSymbol name="paperplane.fill" size={18} color={colors.primary} />
                                <Text className="text-foreground font-semibold ml-2 text-sm">Rechnung senden</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="flex-1 bg-surface border border-warning py-3 rounded-lg flex-row items-center justify-center"
                                activeOpacity={0.8}
                                onPress={handleSendReminder}
                            >
                                <IconSymbol name="exclamationmark.triangle.fill" size={18} color={colors.warning} />
                                <Text className="text-foreground font-semibold ml-2 text-sm">Mahnung</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

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
                            <View className="flex-row justify-between">
                                <Text className="text-sm text-muted">Bezahlt</Text>
                                <Text className="text-sm font-semibold text-success">
                                    {formatCurrency(invoice.paid_amount || 0)}
                                </Text>
                            </View>
                            <View className="flex-row justify-between pt-2 border-t border-border">
                                <Text className="text-base font-bold text-foreground">Restbetrag</Text>
                                <Text className={`text-base font-bold ${remainingAmount <= 0 ? "text-success" : "text-primary"}`}>
                                    {formatCurrency(remainingAmount > 0 ? remainingAmount : 0)}
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

                    {/* Aktivitätsverlauf */}
                    <View className="bg-surface rounded-xl border border-border p-4 mb-4">
                        <Text className="text-lg font-bold text-foreground mb-3">Verlauf</Text>
                        {!activities || activities.length === 0 ? (
                            <Text className="text-sm text-muted">Noch keine Aktivitäten.</Text>
                        ) : (
                            <View className="gap-3">
                                {activities.map((activity: any, index: number) => {
                                    const icons: Record<string, string> = {
                                        created: "📝",
                                        edited: "✏️",
                                        sent: "📧",
                                        reminder_sent: "⚠️",
                                        opened: "👁️",
                                        payment_added: "💰",
                                    };
                                    return (
                                        <View key={activity.id} className="flex-row items-start gap-3">
                                            <View className="items-center">
                                                <Text className="text-base">{icons[activity.type] || "•"}</Text>
                                                {index < activities.length - 1 && (
                                                    <View className="w-[1px] flex-1 bg-border mt-1" style={{ minHeight: 20 }} />
                                                )}
                                            </View>
                                            <View className="flex-1">
                                                <Text className="text-sm text-foreground">{activity.description}</Text>
                                                <View className="flex-row items-center gap-2 mt-1">
                                                    <Text className="text-xs text-muted">
                                                        {formatDate(activity.created_at)}
                                                    </Text>
                                                    {activity.user_name && (
                                                        <Text className="text-xs text-muted">• {activity.user_name}</Text>
                                                    )}
                                                </View>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        )}
                    </View>
                </View>
            </ScrollView>

            {/* Edit Modal */}
            <InvoiceFormModal
                visible={showEditModal}
                onClose={() => setShowEditModal(false)}
                onSuccess={() => refetch()}
                editInvoice={invoice}
            />

            {/* Zahlung hinzufügen Modal */}
            <Modal
                visible={showPaymentModal}
                animationType="slide"
                transparent
                onRequestClose={() => setShowPaymentModal(false)}
            >
                <View className="flex-1 bg-black/50 justify-end">
                    <View className="bg-background rounded-t-3xl p-6">
                        <View className="flex-row items-center justify-between mb-4">
                            <Text className="text-xl font-bold text-foreground">
                                Zahlung erfassen
                            </Text>
                            <TouchableOpacity
                                onPress={() => setShowPaymentModal(false)}
                                activeOpacity={0.7}
                            >
                                <IconSymbol name="xmark.circle.fill" size={24} color={colors.muted} />
                            </TouchableOpacity>
                        </View>

                        <View className="mb-4">
                            <Text className="text-sm text-muted mb-2">
                                Offener Betrag: {formatCurrency(remainingAmount)}
                            </Text>
                            <Text className="text-sm font-semibold text-foreground mb-2">Zahlungsbetrag (CHF)</Text>
                            <TextInput
                                className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground text-lg"
                                placeholder={String(remainingAmount.toFixed(2))}
                                placeholderTextColor={colors.muted}
                                keyboardType="decimal-pad"
                                value={paymentAmount}
                                onChangeText={setPaymentAmount}
                                autoFocus
                            />
                        </View>

                        <View className="flex-row gap-3">
                            <TouchableOpacity
                                className="flex-1 bg-surface border border-border py-3 rounded-lg"
                                onPress={() => {
                                    setPaymentAmount(String(remainingAmount.toFixed(2)));
                                }}
                                activeOpacity={0.7}
                            >
                                <Text className="text-foreground font-semibold text-center text-sm">
                                    Gesamtbetrag
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="flex-1 bg-success py-3 rounded-lg"
                                onPress={handleAddPayment}
                                activeOpacity={0.8}
                            >
                                <Text className="text-white font-semibold text-center">
                                    Zahlung buchen
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScreenContainer>
    );
}

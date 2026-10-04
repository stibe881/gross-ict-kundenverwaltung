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
    Switch,
    useWindowDimensions,
    KeyboardAvoidingView,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { formatCurrency, formatDate, getInvoiceTotal } from "@/lib/format";
import { InvoiceFormModal } from "@/components/invoice-form-modal-v2";
import { LinkedRecords } from "@/components/linked-records";
import { downloadInvoicePDF, generateInvoicePDFBase64 } from "@/lib/pdf-utils";
import { showAlert, showConfirm } from "@/lib/alert";
import { showToast } from "@/components/toast-provider";
import { supabase } from "@/lib/supabase";

export default function InvoiceDetailScreen() {
    const { id } = useLocalSearchParams();
    const colors = useColors();
    const { width } = useWindowDimensions();
    const isWeb = Platform.OS === "web";
    const isWebWide = isWeb && width > 800;

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
    const { data: invoiceSettings } = useQuery({
        queryKey: ["invoiceSettings"],
        queryFn: Data.getInvoiceSettings,
    });

    // Verknüpfungen: Quell-Angebot und Projekt
    const { data: linkedQuote = null } = useQuery({
        queryKey: ["invoiceLinkedQuote", (invoice as any)?.quote_id],
        queryFn: () => Data.getQuoteBasic((invoice as any).quote_id),
        enabled: !!(invoice as any)?.quote_id,
    });
    const { data: linkedProject = null } = useQuery({
        queryKey: ["invoiceLinkedProject", (invoice as any)?.project_id],
        queryFn: () => Data.getProjectBasic((invoice as any).project_id),
        enabled: !!(invoice as any)?.project_id,
    });
    const [showEditModal, setShowEditModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState("");

    const queryClient = useQueryClient();

    const deleteInvoice = useMutation({
        mutationFn: (invoiceId: string) => Data.deleteInvoice(invoiceId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["invoices"] });
            showToast("Rechnung wurde gelöscht");
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
            await downloadInvoicePDF(invoice, invoiceSettings);
        } catch (error: any) {
            showAlert("Fehler", "PDF konnte nicht erstellt werden: " + (error.message || ""));
        }
    };

    const handleSendInvoice = async () => {
        if (!invoice) return;
        if (!invoice.customer?.email) {
            showAlert("Fehler", "Dieser Kunde hat keine E-Mail-Adresse hinterlegt.");
            return;
        }
        showConfirm(
            "Rechnung per E-Mail senden",
            `Rechnung ${invoice.invoice_number} an ${invoice.customer.email} senden?`,
            async () => {
                try {
                    let draftUpdateOk = true;
                    if (invoice.status === 'draft') {
                        const newInvoiceDate = new Date();
                        const oldInvDate = new Date(invoice.invoice_date);
                        const oldDueDate = new Date(invoice.due_date);
                        const diffTime = oldDueDate.getTime() - oldInvDate.getTime();
                        let diffDays = Math.round(diffTime / (1000 * 3600 * 24));
                        if (isNaN(diffDays) || diffDays < 0) diffDays = 30;

                        const newDueDate = new Date(newInvoiceDate.getTime() + diffDays * 24 * 3600 * 1000);
                        const newInvoiceDateStr = newInvoiceDate.toISOString().split("T")[0];
                        const newDueDateStr = newDueDate.toISOString().split("T")[0];

                        const { error: updErr } = await supabase.from("invoices").update({ 
                            status: 'open', 
                            invoice_date: newInvoiceDateStr, 
                            due_date: newDueDateStr 
                        }).eq("id", invoice.id);
                        
                        if (!updErr) {
                            invoice.status = 'open';
                            invoice.invoice_date = newInvoiceDateStr;
                            invoice.due_date = newDueDateStr;
                        } else {
                            draftUpdateOk = false;
                        }
                    }
                    if (!draftUpdateOk) throw new Error("Status konnte nicht aktualisiert werden");

                    // PDF client-seitig generieren (gleich wie Download-Button)
                    const pdfBase64 = await generateInvoicePDFBase64(invoice, invoiceSettings);
                    const { data, error } = await supabase.functions.invoke('send-invoice-email', {
                        body: { id: invoice.id, pdfBase64 },
                    });
                    if (error) throw new Error(error.message || "E-Mail konnte nicht gesendet werden");
                    if (data?.error) throw new Error(data.error);
                    showAlert("Erfolg", `Rechnung wurde an ${invoice.customer?.email} gesendet.`);
                    refetch();
                    queryClient.invalidateQueries({ queryKey: ["invoices"] });
                } catch (error: any) {
                    showAlert("Fehler", error.message || "E-Mail konnte nicht gesendet werden");
                }
            },
            "Senden"
        );
    };

    const [showDunningModal, setShowDunningModal] = useState(false);

    const handleSendDunning = (level: number) => {
        if (!invoice) return;
        if (!invoice.customer?.email) {
            showAlert("Fehler", "Dieser Kunde hat keine E-Mail-Adresse hinterlegt.");
            return;
        }
        const levelLabels = ["Zahlungserinnerung", "1. Mahnung", "2. Mahnung", "3. Mahnung"];
        setShowDunningModal(false);
        showConfirm(
            levelLabels[level] + " senden",
            `${levelLabels[level]} für ${invoice.invoice_number} an ${invoice.customer.email} senden?`,
            async () => {
                try {
                    const pdfBase64 = await generateInvoicePDFBase64({ ...invoice, dunning_level: level, is_dunning_document: true } as any, invoiceSettings);
                    const { data, error } = await supabase.functions.invoke('send-reminder-email', {
                        body: { id: invoice.id, pdfBase64, level },
                    });
                    if (error) throw new Error(error.message || "Mahnung konnte nicht gesendet werden");
                    if (data?.error) throw new Error(data.error);
                    showAlert("Erfolg", `${levelLabels[level]} wurde an ${invoice.customer?.email} gesendet.`);
                    refetch();
                    queryClient.invalidateQueries({ queryKey: ["invoices"] });
                } catch (error: any) {
                    showAlert("Fehler", error.message || "Mahnung konnte nicht gesendet werden");
                }
            },
            "Senden"
        );
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case "draft": return "Ungesendet";
            case "open": return "Gesendet";    // versendet, noch nicht geöffnet
            case "sent": return "Geöffnet";   // vom Kunden geöffnet
            case "paid": return "Bezahlt";
            case "overdue": return "Überfällig";
            case "cancelled": return "Storniert";
            default: return status;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "draft": return "bg-muted";
            case "open": return "bg-warning";
            case "sent": return "bg-primary";
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
            <ScrollView className="flex-1" contentContainerStyle={isWebWide ? { alignItems: "center" } : undefined}>
                <View style={isWebWide ? { maxWidth: 800, width: "100%", paddingVertical: 16 } : { flex: 1 }}>
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
                            <TouchableOpacity
                                onPress={() => setShowStatusModal(true)}
                                activeOpacity={0.7}
                                className={`px-3 py-1 rounded-full ${getStatusColor(invoice.status || "")}`}
                            >
                                <Text className="text-xs font-semibold text-white">
                                    {getStatusLabel(invoice.status || "")}
                                </Text>
                            </TouchableOpacity>
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
                            {remainingAmount > 0 && invoice.status !== "cancelled" && (
                                <TouchableOpacity
                                    className="bg-primary py-3 rounded-lg flex-row items-center justify-center"
                                    activeOpacity={0.8}
                                    onPress={() => router.push({
                                        pathname: "/tap-to-pay",
                                        params: {
                                            invoiceId: invoice.id,
                                            invoiceNumber: invoice.invoice_number,
                                            customerName,
                                            customerEmail: invoice.customer?.email || "",
                                            amount: remainingAmount.toFixed(2),
                                        },
                                    })}
                                >
                                    <IconSymbol name="wave.3.right" size={18} color="#FFFFFF" />
                                    <Text className="text-white font-semibold ml-2 text-sm">Mit Tap to Pay kassieren</Text>
                                </TouchableOpacity>
                            )}
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
                                    onPress={() => setShowDunningModal(true)}
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
                                        {invoice.status === 'draft' ? '-' : formatDate(invoice.invoice_date)}
                                    </Text>
                                </View>
                                <View className="flex-row justify-between">
                                    <Text className="text-sm text-muted">Fälligkeitsdatum</Text>
                                    <Text className="text-sm font-semibold text-foreground">
                                        {invoice.status === 'draft' ? '-' : formatDate(invoice.due_date)}
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
                                {(invoice.dunning_level || 0) > 0 && (
                                    <View className="flex-row justify-between pt-2 border-t border-border">
                                        <Text className="text-sm text-muted">Mahnstufe</Text>
                                        <Text className="text-sm font-semibold" style={{ color: "#ef4444" }}>
                                            {["Erinnerung", "1. Mahnung", "2. Mahnung", "Betreibungsandrohung"][invoice.dunning_level || 0] || `Stufe ${invoice.dunning_level}`}
                                        </Text>
                                    </View>
                                )}
                                {/* Mahnstop Toggle */}
                                <View className="flex-row items-center justify-between pt-2 border-t border-border">
                                    <View>
                                        <Text className="text-sm text-foreground">Mahnstop</Text>
                                        <Text className="text-xs text-muted">Keine automatischen Mahnungen</Text>
                                    </View>
                                    <Switch
                                        value={!!invoice.dunning_stopped}
                                        onValueChange={async (val: boolean) => {
                                            try {
                                                await supabase.from("invoices").update({ dunning_stopped: val }).eq("id", invoice.id);
                                                refetch();
                                                queryClient.invalidateQueries({ queryKey: ["invoices"] });
                                            } catch (_e) { /* ignore */ }
                                        }}
                                        trackColor={{ false: colors.border, true: "#ef4444" }}
                                        thumbColor="#fff"
                                    />
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
                            {(invoice.customer?.address || invoice.customer?.city) && (
                                <Text className="text-sm text-muted mt-1">
                                    {[invoice.customer?.address, `${invoice.customer?.postal_code || ""} ${invoice.customer?.city || ""}`.trim()]
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

                        {/* Verknüpft mit (Angebot + Projekt) */}
                        {(linkedQuote || linkedProject) && (
                            <View className="mb-4">
                                <LinkedRecords
                                    records={[
                                        ...(linkedQuote ? [{
                                            key: `qt-${linkedQuote.id}`,
                                            icon: "doc.on.doc.fill",
                                            color: "#EC4899",
                                            title: linkedQuote.quote_number,
                                            subtitle: `Angebot · ${formatCurrency(linkedQuote.total || 0)}`,
                                            route: `/quote/${linkedQuote.id}`,
                                        }] : []),
                                        ...(linkedProject ? [{
                                            key: `prj-${linkedProject.id}`,
                                            icon: "folder.fill",
                                            color: "#14B8A6",
                                            title: `${linkedProject.project_number} · ${linkedProject.title}`,
                                            subtitle: "Projekt",
                                            route: "/projects",
                                        }] : []),
                                    ]}
                                />
                            </View>
                        )}

                        {/* Zahlungsplan (Teilzahlungen) */}
                        {invoice.status !== "draft" && invoice.status !== "cancelled" ? (
                            <InstallmentPlanCard
                                invoiceId={id as string}
                                invoiceTotal={getInvoiceTotal(invoice)}
                                colors={colors}
                                onPaymentBooked={() => { refetch(); queryClient.invalidateQueries({ queryKey: ["invoices"] }); }}
                            />
                        ) : null}

                        {/* Aktivitätsverlauf */}
                        <View className="bg-surface rounded-xl border border-border p-4 mb-4">
                            <Text className="text-lg font-bold text-foreground mb-3">Verlauf</Text>
                            {!activities || activities.length === 0 ? (
                                <Text className="text-sm text-muted">Noch keine Aktivitäten.</Text>
                            ) : (
                                <View className="gap-3">
                                    {activities.map((activity: any, index: number) => {
                                        const iconNames: Record<string, string> = {
                                            created: "doc.text",
                                            edited: "pencil",
                                            sent: "paperplane",
                                            reminder_sent: "exclamationmark.triangle",
                                            viewed: "eye",
                                            payment_added: "banknote",
                                        };
                                        const iconName = iconNames[activity.type] || "circle.fill";
                                        return (
                                            <View key={activity.id} className="flex-row items-start gap-3">
                                                <View className="items-center">
                                                    <IconSymbol name={iconName as any} size={14} color={colors.primary} />
                                                    {index < activities.length - 1 && (
                                                        <View className="w-[1px] flex-1 bg-border mt-1" style={{ minHeight: 20 }} />
                                                    )}
                                                </View>
                                                <View className="flex-1">
                                                    <Text className="text-sm text-foreground">{activity.description}</Text>
                                                    <View className="flex-row items-center gap-2 mt-1">
                                                        <Text className="text-xs text-muted">
                                                            {formatDate(activity.created_at)}, {new Date(activity.created_at).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}
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
                </View>
            </ScrollView>

            {/* Edit Modal */}
            <InvoiceFormModal
                visible={showEditModal}
                onClose={() => setShowEditModal(false)}
                onSuccess={() => {
                    refetch();
                    queryClient.invalidateQueries({ queryKey: ["invoices"] });
                }}
                editInvoice={invoice}
            />

            {/* Dunning Level Selection Modal */}
            <Modal
                visible={showDunningModal}
                animationType="slide"
                transparent
                onRequestClose={() => setShowDunningModal(false)}
            >
                <View className="flex-1 bg-black/50 justify-end">
                    <View className="bg-background rounded-t-3xl p-6">
                        <View className="flex-row items-center justify-between mb-4">
                            <Text className="text-xl font-bold text-foreground">
                                Mahnstufe wählen
                            </Text>
                            <TouchableOpacity onPress={() => setShowDunningModal(false)} activeOpacity={0.7}>
                                <IconSymbol name="xmark.circle.fill" size={24} color={colors.muted} />
                            </TouchableOpacity>
                        </View>

                        <View className="gap-2 mb-4">
                            {[
                                { level: 0, label: "Zahlungserinnerung", desc: "Freundliche Erinnerung", color: "#f59e0b", icon: "bell.fill" },
                                { level: 1, label: "1. Mahnung", desc: "Bestimmt, Androhung Gebühr", color: "#f97316", icon: "exclamationmark.triangle.fill" },
                                { level: 2, label: "2. Mahnung", desc: "+CHF 20 Gebühr, Androhung Sperrung", color: "#ef4444", icon: "exclamationmark.circle.fill" },
                                { level: 3, label: "Betreibungsandrohung", desc: "Letzte Warnung vor Betreibung", color: "#dc2626", icon: "xmark.octagon.fill" },
                            ].map((item) => (
                                <TouchableOpacity
                                    key={item.level}
                                    className="flex-row items-center gap-3 p-4 bg-surface rounded-xl border border-border"
                                    activeOpacity={0.7}
                                    onPress={() => handleSendDunning(item.level)}
                                >
                                    <View className="w-10 h-10 rounded-lg items-center justify-center" style={{ backgroundColor: item.color + "20" }}>
                                        <IconSymbol name={item.icon as any} size={18} color={item.color} />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-sm font-bold text-foreground">{item.label}</Text>
                                        <Text className="text-xs text-muted">{item.desc}</Text>
                                    </View>
                                    <IconSymbol name="chevron.right" size={16} color={colors.muted} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Zahlung hinzufügen Modal */}
            <Modal
                visible={showPaymentModal}
                animationType="slide"
                transparent
                onRequestClose={() => setShowPaymentModal(false)}
            >
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                >
                    <View className="flex-1 bg-black/50 justify-end">
                        <View className="bg-background rounded-t-3xl p-6 pb-10">
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
                                    className="flex-1 bg-success py-3 rounded-lg flex-row justify-center items-center"
                                    onPress={handleAddPayment}
                                    activeOpacity={0.8}
                                >
                                    {addPaymentMut.isPending ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <Text className="text-white font-semibold text-center">
                                            Zahlung buchen
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Status ändern Modal */}
            <Modal
                visible={showStatusModal}
                animationType="slide"
                transparent
                onRequestClose={() => setShowStatusModal(false)}
            >
                <View className="flex-1 bg-black/50 justify-end">
                    <View className="bg-background rounded-t-3xl p-6">
                        <View className="flex-row items-center justify-between mb-4">
                            <Text className="text-xl font-bold text-foreground">
                                Status ändern
                            </Text>
                            <TouchableOpacity onPress={() => setShowStatusModal(false)} activeOpacity={0.7}>
                                <IconSymbol name="xmark.circle.fill" size={24} color={colors.muted} />
                            </TouchableOpacity>
                        </View>

                        <View className="gap-2 mb-4">
                            {[
                                { status: "open", label: "Offen", color: "#f59e0b", icon: "clock.fill" },
                                { status: "sent", label: "Geöffnet", color: "#06b6d4", icon: "eye.fill" },
                                { status: "paid", label: "Bezahlt", color: "#22c55e", icon: "checkmark.circle.fill" },
                                { status: "overdue", label: "Überfällig", color: "#ef4444", icon: "exclamationmark.triangle.fill" },
                                { status: "cancelled", label: "Storniert", color: "#6b7280", icon: "xmark.circle.fill" },
                            ].map((item) => (
                                <TouchableOpacity
                                    key={item.status}
                                    className="flex-row items-center gap-3 p-4 bg-surface rounded-xl border border-border"
                                    activeOpacity={0.7}
                                    style={invoice.status === item.status ? { borderColor: item.color, borderWidth: 2 } : undefined}
                                    onPress={async () => {
                                        try {
                                            await supabase.from("invoices").update({ status: item.status }).eq("id", invoice.id);
                                            refetch();
                                            queryClient.invalidateQueries({ queryKey: ["invoices"] });
                                            setShowStatusModal(false);
                                        } catch (e: any) {
                                            showAlert("Fehler", e.message || "Status konnte nicht geändert werden");
                                        }
                                    }}
                                >
                                    <View className="w-10 h-10 rounded-lg items-center justify-center" style={{ backgroundColor: item.color + "20" }}>
                                        <IconSymbol name={item.icon as any} size={18} color={item.color} />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-sm font-bold text-foreground">{item.label}</Text>
                                    </View>
                                    {invoice.status === item.status && (
                                        <IconSymbol name="checkmark" size={18} color={item.color} />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </View>
            </Modal>
        </ScreenContainer>
    );
}


// ── Zahlungsplan: Rechnung in Raten aufteilen ──
function InstallmentPlanCard({
    invoiceId,
    invoiceTotal,
    colors,
    onPaymentBooked,
}: {
    invoiceId: string;
    invoiceTotal: number;
    colors: any;
    onPaymentBooked: () => void;
}) {
    const queryClient = useQueryClient();
    const [expanded, setExpanded] = useState(false);
    const [rateCount, setRateCount] = useState("3");
    const [creating, setCreating] = useState(false);

    const { data: installments = [] } = useQuery({
        queryKey: ["invoiceInstallments", invoiceId],
        queryFn: () => Data.getInvoiceInstallments(invoiceId),
    });

    const refresh = () => queryClient.invalidateQueries({ queryKey: ["invoiceInstallments", invoiceId] });

    const handleCreatePlan = async () => {
        const n = parseInt(rateCount, 10);
        if (!n || n < 2 || n > 24) {
            showAlert("Fehler", "Bitte 2–24 Raten angeben.");
            return;
        }
        setCreating(true);
        try {
            const per = Math.floor((invoiceTotal / n) * 100) / 100;
            const rows: { amount: number; due_date: string }[] = [];
            let assigned = 0;
            for (let i = 0; i < n; i++) {
                const due = new Date();
                due.setMonth(due.getMonth() + i + 1);
                due.setDate(1);
                const amount = i === n - 1 ? Math.round((invoiceTotal - assigned) * 100) / 100 : per;
                assigned += amount;
                rows.push({ amount, due_date: due.toISOString().split("T")[0] });
            }
            await Data.createInstallmentPlan(invoiceId, rows);
            await Data.addInvoiceActivity(invoiceId, "installments", `Zahlungsplan mit ${n} Raten erstellt.`);
            refresh();
            showToast(`Zahlungsplan mit ${n} Raten erstellt`);
        } catch (e: any) {
            showAlert("Fehler", e.message);
        } finally {
            setCreating(false);
        }
    };

    const handleTogglePaid = async (inst: any) => {
        try {
            if (!inst.paid_at) {
                await Data.markInstallmentPaid(inst.id, true);
                // Rate auch als Zahlung auf der Rechnung verbuchen
                await Data.addPayment(invoiceId, Number(inst.amount), "Teilzahlung (Rate)");
                onPaymentBooked();
            } else {
                await Data.markInstallmentPaid(inst.id, false);
            }
            refresh();
        } catch (e: any) {
            showAlert("Fehler", e.message);
        }
    };

    const paidCount = (installments as any[]).filter((i) => i.paid_at).length;
    const overdue = (installments as any[]).filter((i) => !i.paid_at && i.due_date < new Date().toISOString().split("T")[0]).length;

    return (
        <View className="bg-surface rounded-xl border border-border p-4 mb-4">
            <TouchableOpacity className="flex-row items-center justify-between" onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
                <View className="flex-row items-center gap-2">
                    <IconSymbol name="calendar" size={16} color={colors.primary} />
                    <Text className="text-lg font-bold text-foreground">Zahlungsplan</Text>
                    {(installments as any[]).length > 0 ? (
                        <Text className="text-xs text-muted">
                            {paidCount}/{(installments as any[]).length} Raten bezahlt{overdue > 0 ? ` · ${overdue} überfällig` : ""}
                        </Text>
                    ) : null}
                </View>
                <IconSymbol name={expanded ? "chevron.up" : "chevron.down"} size={14} color={colors.muted} />
            </TouchableOpacity>

            {expanded ? (
                <View className="mt-3">
                    {(installments as any[]).length === 0 ? (
                        <View>
                            <Text className="text-sm text-muted mb-2">
                                Rechnung in gleichmässige Monatsraten aufteilen (je zum 1. des Monats fällig):
                            </Text>
                            <View className="flex-row items-center gap-2">
                                <TextInput
                                    value={rateCount}
                                    onChangeText={setRateCount}
                                    keyboardType="number-pad"
                                    className="bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                                    style={{ width: 60 }}
                                />
                                <Text className="text-sm text-foreground">Raten à ca. {formatCurrency(invoiceTotal / (parseInt(rateCount, 10) || 3))}</Text>
                                <TouchableOpacity
                                    className="bg-primary px-4 py-2 rounded-lg ml-auto"
                                    onPress={handleCreatePlan}
                                    disabled={creating}
                                    activeOpacity={0.8}
                                >
                                    <Text className="text-background text-xs font-semibold">{creating ? "Erstellt…" : "Plan erstellen"}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <View>
                            {(installments as any[]).map((inst, idx) => {
                                const isOverdue = !inst.paid_at && inst.due_date < new Date().toISOString().split("T")[0];
                                return (
                                    <TouchableOpacity
                                        key={inst.id}
                                        className="flex-row items-center gap-3 py-2 border-t border-border"
                                        onPress={() => handleTogglePaid(inst)}
                                        activeOpacity={0.7}
                                    >
                                        <View
                                            style={{
                                                width: 20, height: 20, borderRadius: 10, borderWidth: 2,
                                                borderColor: inst.paid_at ? "#22C55E" : isOverdue ? "#EF4444" : colors.border,
                                                backgroundColor: inst.paid_at ? "#22C55E" : "transparent",
                                                alignItems: "center", justifyContent: "center",
                                            }}
                                        >
                                            {inst.paid_at ? <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>✓</Text> : null}
                                        </View>
                                        <View className="flex-1">
                                            <Text className="text-sm font-semibold text-foreground">
                                                Rate {idx + 1} · {formatCurrency(Number(inst.amount))}
                                            </Text>
                                            <Text className="text-xs" style={{ color: isOverdue ? "#EF4444" : colors.muted }}>
                                                fällig {formatDate(inst.due_date)}
                                                {inst.paid_at ? ` · bezahlt am ${formatDate(inst.paid_at)}` : isOverdue ? " · überfällig" : ""}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                            <TouchableOpacity
                                className="mt-2 pt-2 border-t border-border"
                                onPress={() =>
                                    showConfirm("Zahlungsplan löschen", "Alle Raten entfernen? Bereits verbuchte Zahlungen bleiben bestehen.", async () => {
                                        try {
                                            await Data.deleteInstallments(invoiceId);
                                            refresh();
                                        } catch (e: any) { showAlert("Fehler", e.message); }
                                    }, "Löschen")
                                }
                                activeOpacity={0.7}
                            >
                                <Text className="text-xs font-bold" style={{ color: "#EF4444" }}>Zahlungsplan löschen</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    <Text className="text-xs text-muted mt-2">
                        Rate antippen = als bezahlt verbuchen (erfasst automatisch eine Teilzahlung). Fällige, unbezahlte Raten lösen eine Push-Erinnerung aus.
                    </Text>
                </View>
            ) : null}
        </View>
    );
}

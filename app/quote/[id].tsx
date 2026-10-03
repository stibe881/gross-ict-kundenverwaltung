import { useState, useEffect } from "react";
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/format";
import { showAlert, showConfirm, showConfirm2 } from "@/lib/alert";
import { showToast } from "@/components/toast-provider";
import { QuoteFormModal } from "@/components/quote-form-modal";
import { LinkedRecords } from "@/components/linked-records";
import { downloadQuotePDF } from "@/lib/pdf-utils";
import { Platform, Linking } from "react-native";
import { supabase } from "@/lib/supabase";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    draft: { label: "Entwurf", color: "#6B7280" },
    sent: { label: "Gesendet", color: "#3B82F6" },
    opened: { label: "Geöffnet", color: "#8B5CF6" },
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
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [isSendingEmail, setIsSendingEmail] = useState(false);

    const { data: quote, isLoading } = useQuery({
        queryKey: ["quote", id],
        queryFn: () => Data.getQuoteById(id as string),
        enabled: !!id,
    });

    const { data: activities = [] } = useQuery({
        queryKey: ["quote_activities", id],
        queryFn: () => Data.getQuoteActivities(id as string),
        enabled: !!id,
    });

    // Verknüpfungen: Projekt und Rechnungen aus diesem Angebot
    const { data: linkedProject = null } = useQuery({
        queryKey: ["quoteLinkedProject", id],
        queryFn: () => Data.getProjectForQuote(id as string),
        enabled: !!id,
    });
    const { data: linkedInvoices = [] } = useQuery({
        queryKey: ["quoteLinkedInvoices", id],
        queryFn: () => Data.getInvoicesForQuote(id as string),
        enabled: !!id,
    });

    const deleteQuote = useMutation({
        mutationFn: (quoteId: string) => Data.deleteQuote(quoteId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["quotes"] });
            showToast("Angebot wurde gelöscht");
            router.back();
        },
        onError: (error: any) => {
            showAlert("Fehler", error.message);
        },
    });

    const convertMutation = useMutation({
        mutationFn: ({ quoteId, includeOptions }: { quoteId: string; includeOptions: boolean }) =>
            Data.convertQuoteToInvoice(quoteId, includeOptions),
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

    const projectMutation = useMutation({
        mutationFn: ({ quoteId, includeOptions }: { quoteId: string; includeOptions: boolean }) =>
            Data.convertQuoteToProject(quoteId, includeOptions),
        onSuccess: (project) => {
            queryClient.invalidateQueries({ queryKey: ["quotes"] });
            queryClient.invalidateQueries({ queryKey: ["projects"] });
            showAlert("Erfolg", `Projekt ${project.project_number} wurde erstellt!`);
        },
        onError: (error: any) => {
            showAlert("Fehler", error.message);
        },
    });

    const statusMutation = useMutation({
        mutationFn: ({ quoteId, status }: { quoteId: string; status: string }) =>
            Data.updateQuoteStatus(quoteId, status),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ["quote", id] });
            queryClient.invalidateQueries({ queryKey: ["quotes"] });
            showAlert("Erfolg", "Status wurde aktualisiert");
            // When accepted, ask to create project
            if (variables.status === "accepted") {
                showConfirm(
                    "Projekt erstellen?",
                    "Möchten Sie aus diesem Angebot ein Projekt erstellen?",
                    () => resolveIncludeOptions((includeOptions) =>
                        projectMutation.mutate({ quoteId: id as string, includeOptions })
                    ),
                    "Projekt erstellen"
                );
            }
        },
        onError: (error: any) => {
            showAlert("Fehler", error.message);
        },
    });

    // Auto-expire on load / Auto-reactivate if validity was extended
    useEffect(() => {
        if (quote && quote.valid_until) {
            const validDate = new Date(quote.valid_until);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (validDate < today && (quote.status === "draft" || quote.status === "sent")) {
                // Abgelaufen: setze auf expired
                Data.updateQuoteStatus(quote.id, "expired").then(() => {
                    queryClient.invalidateQueries({ queryKey: ["quote", id] });
                    queryClient.invalidateQueries({ queryKey: ["quotes"] });
                });
            } else if (validDate >= today && quote.status === "expired") {
                // Gültigkeit wurde verlängert: reaktiviere als 'sent'
                Data.updateQuoteStatus(quote.id, "sent").then(() => {
                    queryClient.invalidateQueries({ queryKey: ["quote", id] });
                    queryClient.invalidateQueries({ queryKey: ["quotes"] });
                });
            }
        }
    }, [quote]);

    // Klärt, ob optionale Leistungen übernommen werden sollen:
    // 1. keine Optionen im Angebot -> nein, ohne Nachfrage
    // 2. Kunde hat online entschieden (accepted_with_options) -> dessen Wahl
    // 3. sonst nachfragen
    const resolveIncludeOptions = (then: (includeOptions: boolean) => void) => {
        const hasOptional = (quote?.items || []).some((it: any) => !!it.optional);
        if (!hasOptional) return then(false);
        const customerChoice = (quote as any)?.accepted_with_options;
        if (customerChoice === true || customerChoice === false) {
            return then(customerChoice);
        }
        showConfirm2(
            "Optionale Leistungen",
            "Dieses Angebot enthält optionale Leistungen. Sollen sie übernommen werden?",
            "Mit Optionen",
            () => then(true),
            "Ohne Optionen",
            () => then(false)
        );
    };

    const handleDelete = () => {
        showConfirm(
            "Angebot löschen",
            "Möchten Sie dieses Angebot wirklich löschen?",
            () => deleteQuote.mutate(id as string),
            "Löschen"
        );
    };

    const handleConvert = () => {
        const message = quote?.status === "accepted" 
            ? "Möchten Sie aus diesem Angebot eine Rechnung erstellen?" 
            : "Möchten Sie dieses Angebot in eine Rechnung umwandeln? Das Angebot wird als 'Angenommen' markiert.";
            
        showConfirm(
            "In Rechnung umwandeln",
            message,
            () => resolveIncludeOptions((includeOptions) =>
                convertMutation.mutate({ quoteId: id as string, includeOptions })
            ),
            "Umwandeln"
        );
    };

    const handleDownloadPDF = async () => {
        if (!quote) return;
        try {
            // Aktuellen Benutzer für PDF-Header holen
            const { data: { session } } = await (await import("@/lib/supabase")).supabase.auth.getSession();
            const userName = session?.user?.user_metadata?.full_name ||
                session?.user?.user_metadata?.name ||
                `${session?.user?.user_metadata?.first_name || ""} ${session?.user?.user_metadata?.last_name || ""}`.trim() ||
                "Stefan Gross";
            await downloadQuotePDF({ ...quote, creator_name: userName });
        } catch (error: any) {
            showAlert("Fehler", "PDF konnte nicht erstellt werden: " + (error.message || ""));
        }
    };

    const handleSendEmail = async () => {
        if (!quote) return;
        if (!quote.customer?.email) {
            showAlert("Fehler", "Dieser Kunde hat keine E-Mail-Adresse hinterlegt.");
            return;
        }

        showConfirm(
            "Angebot per E-Mail senden",
            `Angebot ${quote.quote_number} an ${quote.customer.email} senden?`,
            async () => {
                setIsSendingEmail(true);
                try {
                    // PDF Base64 via Edge Function generieren
                    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
                    const pdfUrl = `${supabaseUrl}/functions/v1/contract-page?id=${encodeURIComponent(quote.id)}&action=generate-quote-pdf`;
                    const pdfResponse = await fetch(pdfUrl);
                    let pdfBase64 = "";
                    if (pdfResponse.ok) {
                        const pdfData = await pdfResponse.json();
                        pdfBase64 = pdfData.pdf || "";
                    }

                    await Data.sendQuoteEmail(quote.id, pdfBase64);
                    queryClient.invalidateQueries({ queryKey: ["quote", id] });
                    queryClient.invalidateQueries({ queryKey: ["quotes"] });
                    queryClient.invalidateQueries({ queryKey: ["quote_activities", id] });
                    showAlert("Erfolg", `Angebot wurde an ${quote.customer.email} gesendet.`);
                } catch (error: any) {
                    showAlert("Fehler", error.message || "E-Mail konnte nicht gesendet werden");
                } finally {
                    setIsSendingEmail(false);
                }
            },
            "Senden"
        );
    };

    const handleShareLink = async () => {
        if (!quote) return;
        const link = `https://angebote.gross-ict.ch/?id=${quote.id}`;

        if (Platform.OS === "web") {
            try {
                await navigator.clipboard.writeText(link);
                showAlert("Link kopiert!", link);
            } catch {
                showAlert("Kunden-Link", link);
            }
        } else {
            const { Share } = require("react-native");
            try {
                await Share.share({ message: `Ihr Angebot von Gross ICT: ${link}`, url: link });
            } catch {
                showAlert("Kunden-Link", link);
            }
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

    const items = quote.items || [];
    const nonOptionalItems = items.filter((i: any) => !i.optional);
    const optionalItems = items.filter((i: any) => !!i.optional);
    const nonOptionalTotal = nonOptionalItems.reduce((s: number, i: any) => s + (i.total || 0), 0);
    const optionalTotal = optionalItems.reduce((s: number, i: any) => s + (i.total || 0), 0);
    let optionalTax = 0;
    optionalItems.forEach((i: any) => {
        optionalTax += (i.total || 0) * ((i.vat_rate || 8.1) / 100);
    });
    const hasOptional = optionalTotal > 0;

    let specialDiscountAmount = 0;
    if (quote.special_discount && Number(quote.special_discount) > 0) {
        if (quote.special_discount_type === 'percentage') {
            specialDiscountAmount = nonOptionalTotal * (Number(quote.special_discount) / 100);
        } else {
            specialDiscountAmount = Number(quote.special_discount);
        }
    }

    const totalExcl = quote.total || (nonOptionalTotal - specialDiscountAmount + (quote.tax || 0));
    const totalIncl = totalExcl + optionalTotal + optionalTax;

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
                    <TouchableOpacity
                        onPress={() => setShowStatusModal(true)}
                        activeOpacity={0.7}
                        style={{ backgroundColor: statusConfig.color + "20", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}
                    >
                        <Text style={{ color: statusConfig.color, fontWeight: "600", fontSize: 13 }}>
                            {statusConfig.label}
                        </Text>
                    </TouchableOpacity>
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
                        <Text className="text-sm text-foreground">{formatCurrency(nonOptionalTotal)}</Text>
                    </View>
                    {specialDiscountAmount > 0 && (
                        <View className="flex-row justify-between mb-2">
                            <Text className="text-sm text-muted">Spezialrabatt</Text>
                            <Text className="text-sm text-foreground">- {formatCurrency(specialDiscountAmount)}</Text>
                        </View>
                    )}
                    <View className="flex-row justify-between mb-3">
                        <Text className="text-sm text-muted">MwSt</Text>
                        <Text className="text-sm text-foreground">{formatCurrency(quote.tax || 0)}</Text>
                    </View>
                    {hasOptional && (
                        <View className="flex-row justify-between mb-3">
                            <Text className="text-sm text-muted">Optional-Positionen</Text>
                            <Text className="text-sm text-foreground">{formatCurrency(optionalTotal)}</Text>
                        </View>
                    )}
                    <View
                        className="flex-row justify-between pt-3 border-t mb-2"
                        style={{ borderTopColor: colors.border }}
                    >
                        <Text className="text-base font-bold text-foreground">
                            {hasOptional ? "Total ohne Optionen" : "Total"}
                        </Text>
                        <Text className="text-base font-bold text-foreground">{formatCurrency(nonOptionalTotal - specialDiscountAmount + (quote.tax || 0))}</Text>
                    </View>
                    {hasOptional && (
                        <View className="flex-row justify-between pt-2 border-t" style={{ borderTopColor: colors.border }}>
                            <Text className="text-lg font-bold" style={{ color: colors.primary }}>Total inkl. Optionen</Text>
                            <Text className="text-lg font-bold" style={{ color: colors.primary }}>{formatCurrency(totalIncl)}</Text>
                        </View>
                    )}
                </View>

                {/* Notizen */}
                {quote.notes && (
                    <View className="bg-surface rounded-xl p-4 border border-border mt-4">
                        <Text className="text-sm font-semibold text-foreground mb-1">Notizen</Text>
                        <Text className="text-sm text-muted">{quote.notes}</Text>
                    </View>
                )}

                {/* Verknüpft mit (Projekt + Rechnungen) */}
                {(linkedProject || linkedInvoices.length > 0) && (
                    <View className="mt-4">
                        <LinkedRecords
                            records={[
                                ...(linkedProject ? [{
                                    key: `prj-${linkedProject.id}`,
                                    icon: "folder.fill",
                                    color: "#14B8A6",
                                    title: `${linkedProject.project_number} · ${linkedProject.title}`,
                                    subtitle: "Projekt",
                                    route: "/projects",
                                }] : []),
                                ...linkedInvoices.map((inv: any) => ({
                                    key: `inv-${inv.id}`,
                                    icon: "doc.text.fill",
                                    color: "#22C55E",
                                    title: inv.invoice_number,
                                    subtitle: `Rechnung · ${formatCurrency(inv.total || 0)}`,
                                    route: `/invoice/${inv.id}`,
                                })),
                            ]}
                        />
                    </View>
                )}

                {/* Verlauf (Timeline) */}
                <View className="mt-6">
                    <Text className="text-lg font-bold text-foreground mb-3">Verlauf</Text>
                    <View className="bg-surface rounded-xl p-4 border border-border">
                        {!activities || activities.length === 0 ? (
                            <Text className="text-sm text-muted">Noch keine Aktivitäten.</Text>
                        ) : (
                            activities.map((activity: any, index: number) => (
                                <View key={activity.id} className="flex-row">
                                    <View className="items-center mr-3">
                                        <View className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                                        {index < activities.length - 1 && (
                                            <View className="w-px flex-1 bg-border my-1" />
                                        )}
                                    </View>
                                    <View className="flex-1 pb-4">
                                        <Text className="text-sm font-semibold text-foreground">
                                            {activity.type === "created" ? "Erstellt" :
                                             activity.type === "edited" ? "Bearbeitet" :
                                             activity.type === "sent" ? "Gesendet" :
                                             activity.type === "viewed" ? "Geöffnet" : activity.type}
                                        </Text>
                                        <Text className="text-sm text-muted mt-0.5">
                                            {activity.description}
                                        </Text>
                                        <Text className="text-xs text-muted mt-1">
                                            {new Date(activity.created_at).toLocaleString("de-CH")}
                                            {activity.user_name ? ` • ${activity.user_name}` : ""}
                                        </Text>
                                    </View>
                                </View>
                            ))
                        )}
                    </View>
                </View>

                {/* Status ändern */}
                <View className="mt-6">
                    <TouchableOpacity
                        onPress={() => setShowStatusModal(true)}
                        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                        className="p-4 rounded-lg flex-row items-center justify-center border"
                        activeOpacity={0.7}
                    >
                        <IconSymbol name="arrow.triangle.2.circlepath" size={18} color={colors.primary} />
                        <Text className="text-foreground font-semibold ml-2">Status ändern</Text>
                    </TouchableOpacity>
                </View>

                {/* Actions */}
                <View className="mt-6 flex-row flex-wrap gap-3">
                    {/* Per E-Mail senden */}
                    {quote.customer?.email && (
                        <TouchableOpacity
                            onPress={handleSendEmail}
                            disabled={isSendingEmail}
                            style={{ backgroundColor: "#8B5CF6" }}
                            className="p-4 rounded-lg flex-row items-center justify-center flex-1 min-w-[200px]"
                            activeOpacity={0.8}
                        >
                            {isSendingEmail ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <IconSymbol name="envelope.fill" size={20} color="#fff" />
                                    <Text className="text-background font-semibold ml-2">Per E-Mail senden</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}

                    {/* Kunden-Link teilen */}
                    <TouchableOpacity
                        onPress={handleShareLink}
                        style={{ backgroundColor: "#0EA5E9" }}
                        className="p-4 rounded-lg flex-row items-center justify-center flex-1 min-w-[200px]"
                        activeOpacity={0.8}
                    >
                        <IconSymbol name="link" size={20} color="#fff" />
                        <Text className="text-background font-semibold ml-2">Kunden-Link kopieren</Text>
                    </TouchableOpacity>

                    {/* PDF herunterladen */}
                    <TouchableOpacity
                        onPress={handleDownloadPDF}
                        style={{ backgroundColor: colors.primary }}
                        className="p-4 rounded-lg flex-row items-center justify-center flex-1 min-w-[200px]"
                        activeOpacity={0.8}
                    >
                        <IconSymbol name="arrow.down.doc.fill" size={20} color="#fff" />
                        <Text className="text-background font-semibold ml-2">PDF herunterladen</Text>
                    </TouchableOpacity>

                    {/* In Rechnung umwandeln */}
                    {(quote.status === "draft" || quote.status === "sent" || quote.status === "accepted") && (
                        <TouchableOpacity
                            onPress={handleConvert}
                            disabled={convertMutation.isPending}
                            style={{ backgroundColor: colors.success }}
                            className="p-4 rounded-lg flex-row items-center justify-center flex-1 min-w-[200px]"
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

                    {/* Als Projekt anlegen */}
                    {quote.status === "accepted" && (
                        <TouchableOpacity
                            onPress={() =>
                                showConfirm(
                                    "Projekt erstellen",
                                    `Aus Angebot ${quote.quote_number} ein neues Projekt erstellen?`,
                                    () => resolveIncludeOptions((includeOptions) =>
                                        projectMutation.mutate({ quoteId: id as string, includeOptions })
                                    ),
                                    "Erstellen"
                                )
                            }
                            disabled={projectMutation.isPending}
                            style={{ backgroundColor: "#14B8A6" }}
                            className="p-4 rounded-lg flex-row items-center justify-center flex-1 min-w-[200px]"
                            activeOpacity={0.8}
                        >
                            {projectMutation.isPending ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <IconSymbol name="folder.fill.badge.plus" size={20} color="#fff" />
                                    <Text className="text-background font-semibold ml-2">Als Projekt anlegen</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}

                    {/* Bearbeiten */}
                    <TouchableOpacity
                        onPress={() => setShowEditModal(true)}
                        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                        className="p-4 rounded-lg flex-row items-center justify-center border flex-1 min-w-[200px]"
                        activeOpacity={0.7}
                    >
                        <IconSymbol name="pencil" size={18} color={colors.primary} />
                        <Text className="text-foreground font-semibold ml-2">Bearbeiten</Text>
                    </TouchableOpacity>

                    {/* Löschen */}
                    <TouchableOpacity
                        onPress={handleDelete}
                        disabled={deleteQuote.isPending}
                        className="p-4 rounded-lg flex-row items-center justify-center flex-1 min-w-[200px]"
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
                    queryClient.invalidateQueries({ queryKey: ["quote_activities", id] });
                }}
                editQuote={quote}
            />

            {/* Status Modal */}
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
                                { status: "draft", label: "Entwurf", color: "#6B7280", icon: "doc.text.fill" },
                                { status: "sent", label: "Gesendet", color: "#3B82F6", icon: "paperplane.fill" },
                                { status: "opened", label: "Geöffnet", color: "#8B5CF6", icon: "eye.fill" },
                                { status: "accepted", label: "Angenommen", color: "#10B981", icon: "checkmark.circle.fill" },
                                { status: "rejected", label: "Abgelehnt", color: "#EF4444", icon: "xmark.circle.fill" },
                                { status: "expired", label: "Abgelaufen", color: "#F59E0B", icon: "clock.fill" },
                            ].map((item: any) => (
                                <TouchableOpacity
                                    key={item.status}
                                    className="flex-row items-center gap-3 p-4 bg-surface rounded-xl border border-border"
                                    activeOpacity={0.7}
                                    style={quote.status === item.status ? { borderColor: item.color, borderWidth: 2 } : undefined}
                                    onPress={() => {
                                        setShowStatusModal(false);
                                        statusMutation.mutate({ quoteId: id as string, status: item.status });
                                    }}
                                >
                                    <View className="w-10 h-10 rounded-lg items-center justify-center" style={{ backgroundColor: item.color + "20" }}>
                                        <IconSymbol name={item.icon} size={18} color={item.color} />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-sm font-bold text-foreground">{item.label}</Text>
                                    </View>
                                    {quote.status === item.status && (
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

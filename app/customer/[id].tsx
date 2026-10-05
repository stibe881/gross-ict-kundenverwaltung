import { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Linking,
  Image,
  TextInput,
  Platform,
  Alert,
  Switch,
} from "react-native";
import { showAlert, showConfirm } from "@/lib/alert";
import { showToast } from "@/components/toast-provider";
import { useLocalSearchParams, router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { formatDate, formatCurrency, getInvoiceTotal } from "@/lib/format";
import { CustomerPortalManagement } from "@/components/customer-portal-management";
import { CustomerDocuments } from "@/components/customer-documents";
import { ContractFormModal } from "@/components/contract-form-modal";
import { CustomerFormModal } from "@/components/customer-form-modal";
import { QuoteFormModal } from "@/components/quote-form-modal";
import { TicketFormModal } from "@/components/ticket-form-modal";
import { InvoiceFormModal } from "@/components/invoice-form-modal-v2";

type Tab = "tickets" | "rechnungen" | "vertraege" | "angebote" | "links" | "kontakte" | "uberwachung" | "dokumente" | "inventar" | "timeline";

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams();
  const colors = useColors();
  const { containerStyle, contentPadding, isWide } = useResponsiveLayout();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>("tickets");
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [editingContract, setEditingContract] = useState<any>(null);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({ first_name: "", last_name: "", email: "", phone: "", position: "" });
  const [editingContact, setEditingContact] = useState<any>(null);
  const [editContactData, setEditContactData] = useState({ first_name: "", last_name: "", email: "", phone: "", position: "" });
  const [showNewQuote, setShowNewQuote] = useState(false);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [showAddLink, setShowAddLink] = useState(false);
  const [newLink, setNewLink] = useState({ title: "", url: "", description: "" });

  // ── Data ──
  const { data: customer, isLoading: loading } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => Data.getCustomerById(id as string),
    enabled: !!id,
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ["contracts", id],
    queryFn: () => Data.getCustomerContracts(id as string),
    enabled: !!id,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices", "customer", id],
    queryFn: () => Data.getCustomerInvoices(id as string),
    enabled: !!id,
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ["tickets", "customer", id],
    queryFn: () => Data.getCustomerTickets(id as string),
    enabled: !!id,
  });

  const { data: customerContacts = [] } = useQuery({
    queryKey: ["customer-contacts", id],
    queryFn: () => Data.getCustomerContacts(id as string),
    enabled: !!id,
  });

  const { data: quotes = [] } = useQuery({
    queryKey: ["quotes", "customer", id],
    queryFn: () => Data.getCustomerQuotes(id as string),
    enabled: !!id,
  });

  const { data: customerLinks = [] } = useQuery({
    queryKey: ["customer-links", id],
    queryFn: () => Data.getCustomerLinks(id as string),
    enabled: !!id,
  });

  const { data: monitoringUrls = [] } = useQuery({
    queryKey: ["monitoringUrls"],
    queryFn: Data.getMonitoringUrls,
  });
  const customerUrls = useMemo(() => monitoringUrls.filter((u: any) => u.customer_id === id), [monitoringUrls, id]);

  const { data: customerDocs = [] } = useQuery({
    queryKey: ["customerDocuments", id],
    queryFn: () => Data.listCustomerDocuments(id as string),
    enabled: !!id,
  });

  const { data: onboardingSteps = [] } = useQuery({
    queryKey: ["customerOnboarding", id],
    queryFn: () => Data.getOnboardingSteps(id as string),
    enabled: !!id,
  });

  const [showTouchpointForm, setShowTouchpointForm] = useState(false);
  const [tpChannel, setTpChannel] = useState("phone");
  const [tpNote, setTpNote] = useState("");
  const [tpSaving, setTpSaving] = useState(false);
  const { data: lastTouchpoint } = useQuery({
    queryKey: ["lastTouchpoint", id],
    queryFn: () => Data.getLastTouchpoint(id as string),
    enabled: !!id,
  });

  const { data: timeline = [] } = useQuery({
    queryKey: ["customerTimeline", id],
    queryFn: () => Data.getCustomerTimeline(id as string),
    enabled: !!id,
  });

  const { data: customerAssets = [] } = useQuery({
    queryKey: ["customerAssets", id],
    queryFn: () => Data.getCustomerAssets(id as string),
    enabled: !!id,
  });

  const { data: pendingChangeRequests = [] } = useQuery({
    queryKey: ["pendingChangeRequests"],
    queryFn: Data.getPendingChangeRequests,
  });
  const myChangeRequests = useMemo(
    () => (pendingChangeRequests as any[]).filter((r: any) => r.customer_id === id),
    [pendingChangeRequests, id]
  );

  // ── Mutations ──
  const deleteCustomer = useMutation({
    mutationFn: (custId: string) => Data.deleteCustomer(custId),
    onSuccess: () => {
      showToast("Kunde wurde gelöscht");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      router.back();
    },
    onError: (error: any) => showAlert("Fehler", error.message),
  });

  const updateCustomer = useMutation({
    mutationFn: ({ custId, ...data }: any) => Data.updateCustomer(custId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", id] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      showAlert("Erfolg", "Kundenstatus wurde geändert");
    },
    onError: (error: any) => showAlert("Fehler", error.message),
  });

  const deleteTicketMutation = useMutation({
    mutationFn: (ticketId: string) => Data.deleteTicket(ticketId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets", "customer", id] });
      showToast("Ticket gelöscht");
    },
    onError: (error: any) => showAlert("Fehler", error.message),
  });

  const createContactMutation = useMutation({
    mutationFn: (contact: any) => Data.createCustomerContact({ customer_id: id, ...contact }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-contacts", id] });
      setShowAddContact(false);
      setNewContact({ first_name: "", last_name: "", email: "", phone: "", position: "" });
      showAlert("Erfolg", "Kontakt hinzugefügt");
    },
    onError: (error: any) => showAlert("Fehler", error.message),
  });

  const deleteContactMutation = useMutation({
    mutationFn: (contactId: string) => Data.deleteCustomerContact(contactId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-contacts", id] });
      showToast("Kontakt gelöscht");
    },
    onError: (error: any) => showAlert("Fehler", error.message),
  });

  const updateContactMutation = useMutation({
    mutationFn: ({ contactId, data }: { contactId: string; data: any }) => Data.updateCustomerContact(contactId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-contacts", id] });
      setEditingContact(null);
      showAlert("Erfolg", "Kontakt aktualisiert");
    },
    onError: (error: any) => showAlert("Fehler", error.message),
  });

  const createLinkMutation = useMutation({
    mutationFn: (link: any) => Data.createCustomerLink({ customer_id: id as string, ...link }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-links", id] });
      setShowAddLink(false);
      setNewLink({ title: "", url: "", description: "" });
      showAlert("Erfolg", "Link hinzugefügt");
    },
    onError: (error: any) => showAlert("Fehler", error.message),
  });

  const deleteLinkMutation = useMutation({
    mutationFn: (linkId: string) => Data.deleteCustomerLink(linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-links", id] });
      showToast("Link gelöscht");
    },
    onError: (error: any) => showAlert("Fehler", error.message),
  });

  const startEditContact = (contact: any) => {
    setEditingContact(contact.id);
    setEditContactData({
      first_name: contact.first_name || "",
      last_name: contact.last_name || "",
      email: contact.email || "",
      phone: contact.phone || "",
      position: contact.position || "",
    });
  };

  const handleSaveEditContact = () => {
    if (!editContactData.first_name && !editContactData.last_name) {
      showAlert("Fehler", "Bitte mindestens einen Namen eingeben");
      return;
    }
    updateContactMutation.mutate({ contactId: editingContact, data: editContactData });
  };

  // ── Derived Data ──
  const displayName = customer?.company_name ||
    `${customer?.first_name || ""} ${customer?.last_name || ""}`.trim() || "Kunde";

  const initial = displayName.charAt(0).toUpperCase();

  const openTickets = tickets.filter((t: any) => t.status !== "closed").length;
  const totalPaid = invoices
    .filter((inv: any) => inv.status === "paid")
    .reduce((sum: number, inv: any) => sum + (getInvoiceTotal(inv) || 0), 0);
  const totalUnpaid = invoices
    .filter((inv: any) => ["open", "sent", "overdue"].includes(inv.status))
    .reduce((sum: number, inv: any) => sum + Math.max(0, (getInvoiceTotal(inv) || 0) - (inv.paid_amount || 0)), 0);

  // Zahlungsmoral — gleiche Näherung wie "Debitoren & Zahlungsmoral":
  // Zahlungsdatum = letzte Änderung der bezahlten Rechnung
  const paymentStats = (() => {
    const paid = invoices.filter((inv: any) => inv.status === "paid");
    if (!paid.length) return null;
    let daysSum = 0;
    let late = 0;
    for (const inv of paid as any[]) {
      daysSum += Math.max(0, Math.round(
        (new Date(inv.updated_at || inv.invoice_date).getTime() - new Date(inv.invoice_date).getTime()) / 86400000
      ));
      if (inv.due_date && (inv.updated_at || "").split("T")[0] > inv.due_date) late++;
    }
    return {
      count: paid.length,
      avgDays: Math.round(daysSum / paid.length),
      latePct: Math.round((late / paid.length) * 100),
    };
  })();
  const payColor = !paymentStats
    ? colors.muted
    : paymentStats.latePct >= 50 ? colors.error
    : paymentStats.latePct > 0 ? colors.warning
    : colors.success;

  const contactPerson = customer?.first_name || customer?.last_name
    ? `${customer?.first_name || ""} ${customer?.last_name || ""}`.trim()
    : null;

  const formatKPI = (val: number) => {
    if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
    return val.toString();
  };

  const tabs: { key: Tab; label: string; icon: any; count: number }[] = [
    { key: "tickets", label: "Tickets", icon: "ticket.fill", count: tickets.length },
    { key: "rechnungen", label: "Rechnungen", icon: "chart.bar.fill", count: invoices.length },
    { key: "vertraege", label: "Verträge", icon: "doc.text.fill", count: contracts.length },
    { key: "angebote", label: "Angebote", icon: "doc.badge.clock.fill", count: quotes.length },
    { key: "links", label: "Links", icon: "link", count: customerLinks.length + quotes.length },
    { key: "kontakte", label: "Kontakte", icon: "person.2.fill", count: (customerContacts.length || 0) + (contactPerson ? 1 : 0) },
    { key: "uberwachung", label: "Überwachung", icon: "globe", count: customerUrls.length },
    { key: "dokumente", label: "Dokumente", icon: "folder.fill", count: customerDocs.length },
    { key: "inventar", label: "Inventar", icon: "desktopcomputer", count: customerAssets.length },
    { key: "timeline", label: "Timeline", icon: "clock.fill", count: timeline.length },
  ];

  // ── Status / Priority Labels ──
  const ticketStatusLabel = (s: string) =>
    s === "open" ? "OFFEN" : s === "in_progress" ? "IN ARBEIT" : s === "waiting" ? "WARTEND" : "GESCHLOSSEN";
  const ticketStatusColor = (s: string) =>
    s === "open" ? colors.error : s === "in_progress" ? colors.primary : s === "waiting" ? colors.warning : colors.success;
  const priorityLabel = (p: string) =>
    p === "low" ? "NIEDRIG" : p === "medium" ? "MITTEL" : p === "high" ? "HOCH" : "DRINGEND";
  const priorityColor = (p: string) =>
    p === "low" ? colors.success : p === "medium" ? colors.warning : colors.error;

  const invoiceStatusLabel = (s: string) =>
    s === "draft" ? "ENTWURF" : s === "open" ? "OFFEN" : s === "sent" ? "GEÖFFNET" : s === "paid" ? "BEZAHLT" : s === "overdue" ? "ÜBERFÄLLIG" : "STORNIERT";
  const invoiceStatusColor = (s: string) =>
    s === "paid" ? colors.success : s === "overdue" ? colors.error : s === "sent" ? "#06b6d4" : s === "open" ? colors.primary : colors.muted;

  const contractStatusLabel = (s: string) =>
    s === "active" ? "AKTIV" : s === "cancelled" ? "GEKÜNDIGT" : "ABGELAUFEN";
  const contractStatusColor = (s: string) =>
    s === "active" ? colors.success : s === "cancelled" ? colors.error : colors.warning;

  const quoteStatusLabel = (s: string) =>
    s === "draft" ? "ENTWURF" : s === "sent" ? "GESENDET" : s === "accepted" ? "ANGENOMMEN" : s === "declined" ? "ABGELEHNT" : s === "expired" ? "ABGELAUFEN" : s.toUpperCase();
  const quoteStatusColor = (s: string) =>
    s === "accepted" ? colors.success : s === "sent" ? colors.primary : s === "declined" ? colors.error : s === "expired" ? colors.warning : colors.muted;

  const handleOpenAddressChoice = () => {
    const addressParts = [customer?.address, customer?.postal_code, customer?.city, customer?.country].filter(Boolean);
    const fullAddress = addressParts.join(", ");
    if (!fullAddress) return;
    const encodedAddress = encodeURIComponent(fullAddress);
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
    const appleMapsUrl = `https://maps.apple.com/?q=${encodedAddress}`;

    if (Platform.OS === "web") {
      Linking.openURL(googleMapsUrl);
      return;
    }

    Alert.alert(
      "Karte öffnen",
      fullAddress,
      [
        { text: "Abbrechen", style: "cancel" },
        { text: "Google Maps", onPress: () => Linking.openURL(googleMapsUrl) },
        { text: "Apple Maps", onPress: () => Linking.openURL(appleMapsUrl) },
      ]
    );
  };

  // ── Handlers ──
  const handleToggleStatus = () => {
    const newStatus = customer?.status === "active" ? "inactive" : "active";
    const label = newStatus === "active" ? "aktivieren" : "deaktivieren";
    showConfirm(
      "Status ändern",
      `Möchten Sie diesen Kunden wirklich ${label}?`,
      () => updateCustomer.mutate({ custId: id as string, status: newStatus }),
      newStatus === "active" ? "Aktivieren" : "Deaktivieren"
    );
  };

  const handleDelete = () => {
    showConfirm(
      "Kunde löschen",
      `Möchten Sie "${displayName}" wirklich löschen?`,
      () => deleteCustomer.mutate(id as string),
      "Löschen"
    );
  };

  // ── Tab Content ──
  const renderTabContent = () => {
    if (activeTab === "dokumente") {
      return <CustomerDocuments customerId={id as string} />;
    }
    if (activeTab === "inventar") {
      return <CustomerAssetsTab customerId={id as string} colors={colors} />;
    }
    if (activeTab === "timeline") {
      if (timeline.length === 0) return renderEmpty("Noch keine Aktivitäten", "clock.fill");
      const categoryColor = (c: string) =>
        c === "invoice" ? "#EF4444" : c === "contract" ? "#6366F1" : c === "quote" ? "#F59E0B" : c === "ticket" ? "#0EA5E9" : c === "touchpoint" ? "#22C55E" : "#14B8A6";
      const categoryLabel = (c: string) =>
        c === "invoice" ? "Rechnung" : c === "contract" ? "Vertrag" : c === "quote" ? "Angebot" : c === "ticket" ? "Ticket" : c === "touchpoint" ? "Kontakt" : "Projekt";
      return (
        <View>
          {timeline.map((ev: Data.TimelineEvent, idx: number) => (
            <View key={ev.id} className="flex-row" style={{ minHeight: 56 }}>
              {/* Zeitstrahl: Punkt + Linie */}
              <View style={{ width: 24, alignItems: "center" }}>
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: categoryColor(ev.category),
                    marginTop: 5,
                  }}
                />
                {idx < timeline.length - 1 ? (
                  <View style={{ flex: 1, width: 2, backgroundColor: colors.border, marginTop: 2 }} />
                ) : null}
              </View>
              <View className="flex-1 pb-4 pl-1">
                <View className="flex-row items-center gap-2">
                  <Text style={{ fontSize: 10, fontWeight: "700", color: categoryColor(ev.category), textTransform: "uppercase", letterSpacing: 0.5 }}>
                    {categoryLabel(ev.category)}
                  </Text>
                  <Text className="text-xs text-muted">
                    {formatDate(ev.date)}
                    {ev.user_name ? ` · ${ev.user_name}` : ""}
                  </Text>
                </View>
                <Text className="text-sm font-semibold text-foreground mt-0.5">{ev.title}</Text>
                {ev.subtitle ? (
                  <Text className="text-xs text-muted mt-0.5" numberOfLines={2}>
                    {ev.subtitle}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      );
    }
    switch (activeTab) {
      case "tickets":
        if (tickets.length === 0) return renderEmpty("Keine Tickets", "ticket.fill");
        if (!isWide) {
          // Mobile: Card layout
          return (
            <View className="gap-3">
              {tickets.map((ticket: any) => (
                <TouchableOpacity
                  key={ticket.id}
                  className="bg-surface rounded-xl border border-border p-4"
                  activeOpacity={0.7}
                  onPress={() => setSelectedTicket(ticket)}
                >
                  <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-1 mr-3">
                      <Text className="text-xs text-primary font-semibold mb-1">
                        TKT-{ticket.id?.substring(0, 6).toUpperCase()}
                      </Text>
                      <Text className="text-base font-semibold text-foreground" numberOfLines={2}>
                        {ticket.title}
                      </Text>
                    </View>
                    <View className="px-2 py-0.5 rounded" style={{ backgroundColor: ticketStatusColor(ticket.status) + "20" }}>
                      <Text className="text-[10px] font-bold" style={{ color: ticketStatusColor(ticket.status) }}>
                        {ticketStatusLabel(ticket.status)}
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[10px] font-bold" style={{ color: priorityColor(ticket.priority) }}>
                      {priorityLabel(ticket.priority)}
                    </Text>
                    <Text className="text-xs text-muted">{formatDate(ticket.created_at)}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          );
        }
        // Desktop: Table layout
        return (
          <View className="bg-surface rounded-xl border border-border overflow-hidden">
            <View className="flex-row px-4 py-3 border-b border-border">
              <Text className="text-[10px] font-semibold text-muted uppercase" style={{ width: 100 }}>ID</Text>
              <Text className="text-[10px] font-semibold text-muted uppercase flex-1">Titel</Text>
              <Text className="text-[10px] font-semibold text-muted uppercase" style={{ width: 100 }}>Status</Text>
              <Text className="text-[10px] font-semibold text-muted uppercase" style={{ width: 80 }}>Priorität</Text>
              <Text className="text-[10px] font-semibold text-muted uppercase" style={{ width: 80, textAlign: "right" }}>Erstellt</Text>
            </View>
            {tickets.map((ticket: any, idx: number) => (
              <TouchableOpacity
                key={ticket.id}
                className="flex-row items-center px-4 py-3"
                style={{ borderBottomWidth: idx < tickets.length - 1 ? 1 : 0, borderColor: colors.border }}
                activeOpacity={0.6}
                onPress={() => setSelectedTicket(ticket)}
              >
                <Text className="text-xs text-primary font-semibold" style={{ width: 100 }}>
                  TKT-{ticket.id?.substring(0, 6).toUpperCase()}
                </Text>
                <Text className="text-sm text-foreground flex-1" numberOfLines={1}>
                  {ticket.title}
                </Text>
                <View style={{ width: 100 }}>
                  <Text className="text-[10px] font-bold" style={{ color: ticketStatusColor(ticket.status) }}>
                    {ticketStatusLabel(ticket.status)}
                  </Text>
                </View>
                <View style={{ width: 80 }}>
                  <Text className="text-[10px] font-bold" style={{ color: priorityColor(ticket.priority) }}>
                    {priorityLabel(ticket.priority)}
                  </Text>
                </View>
                <Text className="text-xs text-muted" style={{ width: 80, textAlign: "right" }}>
                  {formatDate(ticket.created_at)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      case "rechnungen":
        if (invoices.length === 0)
          return (
            <View className="gap-3">
              <UnbilledWorkCard customerId={id as string} colors={colors} />
              {renderEmpty("Keine Rechnungen", "chart.bar.fill")}
            </View>
          );
        if (!isWide) {
          return (
            <View className="gap-3">
              <UnbilledWorkCard customerId={id as string} colors={colors} />
              {invoices.map((inv: any) => (
                <TouchableOpacity
                  key={inv.id}
                  className="bg-surface rounded-xl border border-border p-4"
                  activeOpacity={0.7}
                  onPress={() => router.push(`/invoice/${inv.id}`)}
                >
                  <View className="flex-row items-start justify-between mb-2">
                    <View>
                      <Text className="text-base font-semibold text-foreground">{inv.invoice_number}</Text>
                      <Text className="text-xs text-muted">{formatDate(inv.invoice_date)}</Text>
                    </View>
                    <View className="px-2 py-0.5 rounded" style={{ backgroundColor: invoiceStatusColor(inv.status) + "20" }}>
                      <Text className="text-[10px] font-bold" style={{ color: invoiceStatusColor(inv.status) }}>
                        {invoiceStatusLabel(inv.status)}
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs text-muted">Fällig: {formatDate(inv.due_date)}</Text>
                    <Text className="text-lg font-bold text-primary">{formatCurrency(getInvoiceTotal(inv))}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          );
        }
        return (
          <View className="gap-3">
          <UnbilledWorkCard customerId={id as string} colors={colors} />
          <View className="bg-surface rounded-xl border border-border overflow-hidden">
            <View className="flex-row px-4 py-3 border-b border-border">
              <Text className="text-[10px] font-semibold text-muted uppercase" style={{ width: 110 }}>Nr.</Text>
              <Text className="text-[10px] font-semibold text-muted uppercase flex-1">Datum</Text>
              <Text className="text-[10px] font-semibold text-muted uppercase" style={{ width: 100 }}>Status</Text>
              <Text className="text-[10px] font-semibold text-muted uppercase" style={{ width: 90, textAlign: "right" }}>Fällig</Text>
              <Text className="text-[10px] font-semibold text-muted uppercase" style={{ width: 90, textAlign: "right" }}>Betrag</Text>
            </View>
            {invoices.map((inv: any, idx: number) => (
              <TouchableOpacity
                key={inv.id}
                className="flex-row items-center px-4 py-3"
                style={{ borderBottomWidth: idx < invoices.length - 1 ? 1 : 0, borderColor: colors.border }}
                activeOpacity={0.6}
                onPress={() => router.push(`/invoice/${inv.id}`)}
              >
                <Text className="text-xs text-primary font-semibold" style={{ width: 110 }}>
                  {inv.invoice_number}
                </Text>
                <Text className="text-sm text-foreground flex-1">
                  {formatDate(inv.invoice_date)}
                </Text>
                <View style={{ width: 100 }}>
                  <Text className="text-[10px] font-bold" style={{ color: invoiceStatusColor(inv.status) }}>
                    {invoiceStatusLabel(inv.status)}
                  </Text>
                </View>
                <Text className="text-xs text-muted" style={{ width: 90, textAlign: "right" }}>
                  {formatDate(inv.due_date)}
                </Text>
                <Text className="text-sm font-bold text-foreground" style={{ width: 90, textAlign: "right" }}>
                  {formatCurrency(getInvoiceTotal(inv))}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          </View>
        );

      case "vertraege":
        if (contracts.length === 0) return renderEmpty("Keine Verträge", "doc.text.fill");
        if (!isWide) {
          return (
            <View className="gap-3">
              {contracts.map((c: any) => (
                <TouchableOpacity
                  key={c.id}
                  className="bg-surface rounded-xl border border-border p-4"
                  activeOpacity={0.7}
                  onPress={() => setSelectedContract(c)}
                >
                  <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-1 flex-row flex-wrap items-center gap-2 pr-2">
                      <Text className="text-base font-semibold text-foreground" numberOfLines={1}>{c.title}</Text>
                      {c.is_internal && (
                        <View className="px-2 py-0.5 rounded" style={{ backgroundColor: colors.primary + "20" }}>
                          <Text className="text-[10px] font-bold" style={{ color: colors.primary }}>INTERN</Text>
                        </View>
                      )}
                    </View>
                    <View className="px-2 py-0.5 rounded" style={{ backgroundColor: contractStatusColor(c.status) + "20" }}>
                      <Text className="text-[10px] font-bold" style={{ color: contractStatusColor(c.status) }}>
                        {contractStatusLabel(c.status)}
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs text-muted">{formatDate(c.start_date)} – {formatDate(c.end_date)}</Text>
                    <Text className="text-lg font-bold text-primary">{formatCurrency(c.amount)}/Jahr</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          );
        }
        return (
          <View className="bg-surface rounded-xl border border-border overflow-hidden">
            <View className="flex-row px-4 py-3 border-b border-border">
              <Text className="text-[10px] font-semibold text-muted uppercase flex-1">Titel</Text>
              <Text className="text-[10px] font-semibold text-muted uppercase" style={{ width: 80 }}>Status</Text>
              <Text className="text-[10px] font-semibold text-muted uppercase" style={{ width: 100 }}>Laufzeit</Text>
              <Text className="text-[10px] font-semibold text-muted uppercase" style={{ width: 90, textAlign: "right" }}>Betrag</Text>
            </View>
            {contracts.map((c: any, idx: number) => (
              <TouchableOpacity
                key={c.id}
                className="flex-row items-center px-4 py-3"
                style={{ borderBottomWidth: idx < contracts.length - 1 ? 1 : 0, borderColor: colors.border }}
                activeOpacity={0.6}
                onPress={() => setSelectedContract(c)}
              >
                <View className="flex-1 flex-row items-center gap-2 pr-2">
                  <Text className="text-sm text-foreground" numberOfLines={1}>{c.title}</Text>
                  {c.is_internal && (
                    <View className="px-1.5 py-0.5 rounded" style={{ backgroundColor: colors.primary + "20" }}>
                      <Text className="text-[9px] font-bold" style={{ color: colors.primary }}>INTERN</Text>
                    </View>
                  )}
                </View>
                <View style={{ width: 80 }}>
                  <Text className="text-[10px] font-bold" style={{ color: contractStatusColor(c.status) }}>
                    {contractStatusLabel(c.status)}
                  </Text>
                </View>
                <Text className="text-xs text-muted" style={{ width: 100 }}>
                  {formatDate(c.start_date)}
                </Text>
                <Text className="text-sm font-bold text-foreground" style={{ width: 90, textAlign: "right" }}>
                  {formatCurrency(c.amount)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      case "angebote":
        if (quotes.length === 0) return renderEmpty("Keine Angebote", "doc.badge.clock.fill");
        if (!isWide) {
          return (
            <View className="gap-3">
              {quotes.map((q: any) => (
                <TouchableOpacity
                  key={q.id}
                  className="bg-surface rounded-xl border border-border p-4"
                  activeOpacity={0.7}
                  onPress={() => router.push(`/quote/${q.id}`)}
                >
                  <View className="flex-row items-start justify-between mb-2">
                    <View>
                      <Text className="text-base font-semibold text-foreground">{q.quote_number || "—"}</Text>
                      <Text className="text-xs text-muted">{formatDate(q.created_at)}</Text>
                    </View>
                    <View className="px-2 py-0.5 rounded" style={{ backgroundColor: quoteStatusColor(q.status) + "20" }}>
                      <Text className="text-[10px] font-bold" style={{ color: quoteStatusColor(q.status) }}>
                        {quoteStatusLabel(q.status)}
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs text-muted">Gültig bis: {q.valid_until ? formatDate(q.valid_until) : "—"}</Text>
                    <Text className="text-lg font-bold text-primary">{formatCurrency(q.total || 0)}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          );
        }
        return (
          <View className="bg-surface rounded-xl border border-border overflow-hidden">
            <View className="flex-row px-4 py-3 border-b border-border">
              <Text className="text-[10px] font-semibold text-muted uppercase" style={{ width: 110 }}>Nr.</Text>
              <Text className="text-[10px] font-semibold text-muted uppercase flex-1">Datum</Text>
              <Text className="text-[10px] font-semibold text-muted uppercase" style={{ width: 100 }}>Status</Text>
              <Text className="text-[10px] font-semibold text-muted uppercase" style={{ width: 90, textAlign: "right" }}>Gültig bis</Text>
              <Text className="text-[10px] font-semibold text-muted uppercase" style={{ width: 90, textAlign: "right" }}>Betrag</Text>
            </View>
            {quotes.map((q: any, idx: number) => (
              <TouchableOpacity
                key={q.id}
                className="flex-row items-center px-4 py-3"
                style={{ borderBottomWidth: idx < quotes.length - 1 ? 1 : 0, borderColor: colors.border }}
                activeOpacity={0.6}
                onPress={() => router.push(`/quote/${q.id}`)}
              >
                <Text className="text-xs text-primary font-semibold" style={{ width: 110 }}>
                  {q.quote_number || "—"}
                </Text>
                <Text className="text-sm text-foreground flex-1">
                  {formatDate(q.created_at)}
                </Text>
                <View style={{ width: 100 }}>
                  <Text className="text-[10px] font-bold" style={{ color: quoteStatusColor(q.status) }}>
                    {quoteStatusLabel(q.status)}
                  </Text>
                </View>
                <Text className="text-xs text-muted" style={{ width: 90, textAlign: "right" }}>
                  {q.valid_until ? formatDate(q.valid_until) : "—"}
                </Text>
                <Text className="text-sm font-bold text-foreground" style={{ width: 90, textAlign: "right" }}>
                  {formatCurrency(q.total || 0)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      case "links": {
        // Auto-generate links from quotes
        const quoteLinks = quotes.map((q: any) => ({
          id: `quote-${q.id}`,
          title: `Angebot ${q.quote_number || q.id?.substring(0, 6).toUpperCase()}`,
          url: `https://angebote.gross-ict.ch/?id=${q.id}`,
          description: q.title || null,
          created_at: q.created_at,
          _isQuoteLink: true,
          _quoteStatus: q.status,
        }));

        // Merge and sort by date (newest first)
        const allLinks = [...customerLinks, ...quoteLinks].sort(
          (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        const addLinkForm = showAddLink ? (
          <View className="bg-surface rounded-xl border border-primary/30 p-4 mb-3">
            <Text className="text-sm font-bold text-foreground mb-3">Neuer Kundenlink</Text>
            <View className="gap-2">
              <TextInput
                className="bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                placeholder="Titel (z.B. Webseite, Portal)" placeholderTextColor={colors.muted}
                value={newLink.title}
                onChangeText={(t) => setNewLink({ ...newLink, title: t })}
              />
              <TextInput
                className="bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                placeholder="URL (z.B. https://kunde.ch)" placeholderTextColor={colors.muted}
                autoCapitalize="none" keyboardType="url"
                value={newLink.url}
                onChangeText={(t) => setNewLink({ ...newLink, url: t })}
              />
              <TextInput
                className="bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                placeholder="Beschreibung (optional)" placeholderTextColor={colors.muted}
                value={newLink.description}
                onChangeText={(t) => setNewLink({ ...newLink, description: t })}
              />
              <View className="flex-row gap-2 mt-1">
                <TouchableOpacity
                  className="flex-1 bg-surface border border-border py-2 rounded-lg"
                  onPress={() => { setShowAddLink(false); setNewLink({ title: "", url: "", description: "" }); }}
                >
                  <Text className="text-foreground font-semibold text-center text-sm">Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-primary py-2 rounded-lg"
                  onPress={() => {
                    if (!newLink.title.trim() || !newLink.url.trim()) {
                      showAlert("Fehler", "Titel und URL sind erforderlich");
                      return;
                    }
                    createLinkMutation.mutate(newLink);
                  }}
                >
                  {createLinkMutation.isPending ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Text className="font-semibold text-center text-sm" style={{ color: colors.background }}>Speichern</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null;

        const addLinkButton = (
          <TouchableOpacity
            className="flex-row items-center justify-center gap-1.5 bg-primary/10 border border-primary/30 py-2.5 rounded-xl mb-3"
            onPress={() => setShowAddLink(true)}
            activeOpacity={0.7}
          >
            <IconSymbol name="plus.circle.fill" size={16} color={colors.primary} />
            <Text className="text-sm font-semibold" style={{ color: colors.primary }}>Link hinzuf&#252;gen</Text>
          </TouchableOpacity>
        );

        if (allLinks.length === 0 && !showAddLink) {
          return (
            <View>
              {addLinkButton}
              {renderEmpty("Keine Links erfasst", "link")}
            </View>
          );
        }

        return (
          <View>
            {!showAddLink && addLinkButton}
            {addLinkForm}
            <View className="gap-3">
              {allLinks.map((link: any) => (
                <TouchableOpacity
                  key={link.id}
                  className="bg-surface rounded-xl border border-border p-4"
                  activeOpacity={0.7}
                  onPress={() => Linking.openURL(link.url)}
                >
                  <View className="flex-row items-center gap-3">
                    <View className="w-10 h-10 rounded-lg items-center justify-center" style={{ backgroundColor: link._isQuoteLink ? "#8b5cf615" : colors.primary + "15" }}>
                      <IconSymbol name={link._isQuoteLink ? "doc.badge.clock.fill" as any : "link"} size={18} color={link._isQuoteLink ? "#8b5cf6" : colors.primary} />
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-base font-semibold text-foreground" numberOfLines={1}>{link.title}</Text>
                        {link._isQuoteLink && (
                          <View className="px-1.5 py-0.5 rounded" style={{ backgroundColor: "#8b5cf620" }}>
                            <Text className="text-[9px] font-bold" style={{ color: "#8b5cf6" }}>ANGEBOT</Text>
                          </View>
                        )}
                      </View>
                      <Text className="text-xs text-primary" numberOfLines={1}>{link.url}</Text>
                      {link.description ? (
                        <Text className="text-xs text-muted mt-1" numberOfLines={2}>{link.description}</Text>
                      ) : null}
                      <Text className="text-[10px] text-muted mt-1">
                        Erstellt: {formatDate(link.created_at)}
                      </Text>
                    </View>
                    {!link._isQuoteLink && (
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          showConfirm("Link l\u00f6schen", `"${link.title}" wirklich l\u00f6schen?`, () => deleteLinkMutation.mutate(link.id), "L\u00f6schen");
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        style={{ padding: 8 }}
                      >
                        <IconSymbol name="trash.fill" size={14} color={colors.error} />
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      }

      case "uberwachung":
        if (customerUrls.length === 0) return renderEmpty("Keine überwachten URLs", "globe");
        return (
          <View className="gap-3">
            {customerUrls.map((u: any) => (
              <TouchableOpacity
                key={u.id}
                className="bg-surface rounded-xl border border-border p-4"
                activeOpacity={0.7}
                onPress={() => router.push(`/uberwachung?openId=${u.id}`)}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-base font-semibold text-foreground" numberOfLines={1}>{u.name}</Text>
                  <View className="px-2 py-0.5 rounded" style={{ backgroundColor: u.last_status === 'up' ? '#16A34A20' : (u.last_status === 'down' ? '#DC262620' : colors.muted + '20') }}>
                    <Text className="text-[10px] font-bold" style={{ color: u.last_status === 'up' ? '#16A34A' : (u.last_status === 'down' ? '#DC2626' : colors.muted) }}>
                      {u.last_status === 'up' ? 'Online' : (u.last_status === 'down' ? 'Offline' : 'Unbekannt')}
                    </Text>
                  </View>
                </View>
                <Text className="text-sm text-muted">{u.url}</Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      case "kontakte": {
        const allContacts = [
          ...(contactPerson ? [{
            id: "legacy",
            first_name: customer?.first_name || "",
            last_name: customer?.last_name || "",
            email: customer?.email || "",
            phone: customer?.phone || "",
            position: "Hauptkontakt",
            is_primary: true,
          }] : []),
          ...customerContacts,
        ];

        const addContactForm = showAddContact ? (
          <View className="bg-surface rounded-xl border border-primary/30 p-4 mb-3">
            <Text className="text-sm font-bold text-foreground mb-3">Neuer Kontakt</Text>
            <View className="gap-2">
              <View className="flex-row gap-2">
                <TextInput
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                  placeholder="Vorname" placeholderTextColor={colors.muted}
                  value={newContact.first_name}
                  onChangeText={(t) => setNewContact({ ...newContact, first_name: t })}
                />
                <TextInput
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                  placeholder="Nachname" placeholderTextColor={colors.muted}
                  value={newContact.last_name}
                  onChangeText={(t) => setNewContact({ ...newContact, last_name: t })}
                />
              </View>
              <TextInput
                className="bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                placeholder="Position (z.B. CEO)" placeholderTextColor={colors.muted}
                value={newContact.position}
                onChangeText={(t) => setNewContact({ ...newContact, position: t })}
              />
              <TextInput
                className="bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                placeholder="E-Mail" placeholderTextColor={colors.muted}
                keyboardType="email-address" autoCapitalize="none"
                value={newContact.email}
                onChangeText={(t) => setNewContact({ ...newContact, email: t })}
              />
              <TextInput
                className="bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                placeholder="Telefon" placeholderTextColor={colors.muted}
                keyboardType="phone-pad"
                value={newContact.phone}
                onChangeText={(t) => setNewContact({ ...newContact, phone: t })}
              />
              <View className="flex-row gap-2 mt-1">
                <TouchableOpacity
                  className="flex-1 bg-surface border border-border py-2 rounded-lg"
                  onPress={() => { setShowAddContact(false); setNewContact({ first_name: "", last_name: "", email: "", phone: "", position: "" }); }}
                >
                  <Text className="text-foreground font-semibold text-center text-sm">Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-primary py-2 rounded-lg"
                  onPress={() => {
                    if (!newContact.first_name && !newContact.last_name) {
                      showAlert("Fehler", "Bitte mindestens einen Namen eingeben");
                      return;
                    }
                    createContactMutation.mutate(newContact);
                  }}
                >
                  {createContactMutation.isPending ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Text className="font-semibold text-center text-sm" style={{ color: colors.background }}>Speichern</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null;

        const addButton = (
          <TouchableOpacity
            className="flex-row items-center justify-center gap-1.5 bg-primary/10 border border-primary/30 py-2.5 rounded-xl mb-3"
            onPress={() => setShowAddContact(true)}
            activeOpacity={0.7}
          >
            <IconSymbol name="plus.circle.fill" size={16} color={colors.primary} />
            <Text className="text-sm font-semibold" style={{ color: colors.primary }}>Kontakt hinzufügen</Text>
          </TouchableOpacity>
        );

        if (allContacts.length === 0 && !showAddContact) {
          return (
            <View>
              {addButton}
              {renderEmpty("Keine Kontakte erfasst", "person.2.fill")}
            </View>
          );
        }

        if (!isWide) {
          return (
            <View>
              {!showAddContact && addButton}
              {addContactForm}
              <View className="gap-3">
                {allContacts.map((contact: any, idx: number) => (
                  <View key={contact.id || idx} className="bg-surface rounded-xl border border-border p-4">
                    {editingContact === contact.id ? (
                      /* ── Inline Edit Form (Mobile) ── */
                      <View>
                        <Text className="text-sm font-bold text-foreground mb-3">Kontakt bearbeiten</Text>
                        <View className="gap-2">
                          <View className="flex-row gap-2">
                            <TextInput
                              className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                              placeholder="Vorname" placeholderTextColor={colors.muted}
                              value={editContactData.first_name}
                              onChangeText={(t) => setEditContactData({ ...editContactData, first_name: t })}
                            />
                            <TextInput
                              className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                              placeholder="Nachname" placeholderTextColor={colors.muted}
                              value={editContactData.last_name}
                              onChangeText={(t) => setEditContactData({ ...editContactData, last_name: t })}
                            />
                          </View>
                          <TextInput
                            className="bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                            placeholder="Position (z.B. CEO)" placeholderTextColor={colors.muted}
                            value={editContactData.position}
                            onChangeText={(t) => setEditContactData({ ...editContactData, position: t })}
                          />
                          <TextInput
                            className="bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                            placeholder="E-Mail" placeholderTextColor={colors.muted}
                            keyboardType="email-address" autoCapitalize="none"
                            value={editContactData.email}
                            onChangeText={(t) => setEditContactData({ ...editContactData, email: t })}
                          />
                          <TextInput
                            className="bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                            placeholder="Telefon" placeholderTextColor={colors.muted}
                            keyboardType="phone-pad"
                            value={editContactData.phone}
                            onChangeText={(t) => setEditContactData({ ...editContactData, phone: t })}
                          />
                          <View className="flex-row gap-2 mt-1">
                            <TouchableOpacity
                              className="flex-1 bg-surface border border-border py-2 rounded-lg"
                              onPress={() => setEditingContact(null)}
                            >
                              <Text className="text-foreground font-semibold text-center text-sm">Abbrechen</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              className="flex-1 bg-primary py-2 rounded-lg"
                              onPress={handleSaveEditContact}
                            >
                              {updateContactMutation.isPending ? (
                                <ActivityIndicator color="#FFF" size="small" />
                              ) : (
                                <Text className="font-semibold text-center text-sm" style={{ color: colors.background }}>Speichern</Text>
                              )}
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    ) : (
                      /* ── Display Mode (Mobile) ── */
                      <>
                        <View className="flex-row items-center gap-3 mb-2">
                          <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: colors.primary + "20" }}>
                            <Text className="text-sm font-bold" style={{ color: colors.primary }}>
                              {(contact.first_name || contact.last_name || "?").charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <View className="flex-1">
                            <Text className="text-base font-semibold text-foreground">
                              {`${contact.first_name || ""} ${contact.last_name || ""}`.trim() || "—"}
                            </Text>
                            {contact.position && <Text className="text-xs text-muted">{contact.position}</Text>}
                          </View>
                          {contact.is_primary && (
                            <View className="px-2 py-0.5 rounded" style={{ backgroundColor: colors.primary + "20" }}>
                              <Text className="text-[10px] font-bold" style={{ color: colors.primary }}>PRIMÄR</Text>
                            </View>
                          )}
                          {contact.id !== "legacy" && (
                            <View className="flex-row items-center gap-2">
                              <TouchableOpacity
                                onPress={() => startEditContact(contact)}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              >
                                <IconSymbol name="pencil" size={14} color={colors.primary} />
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => showConfirm("Kontakt löschen", "Diesen Kontakt wirklich löschen?", () => deleteContactMutation.mutate(contact.id), "Löschen")}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              >
                                <IconSymbol name="trash.fill" size={14} color={colors.error} />
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                        {contact.email && (
                          <TouchableOpacity className="flex-row items-center gap-2 py-1.5" onPress={() => Linking.openURL(`mailto:${contact.email}`)}>
                            <IconSymbol name="envelope.fill" size={14} color={colors.muted} />
                            <Text className="text-sm text-foreground">{contact.email}</Text>
                          </TouchableOpacity>
                        )}
                        {contact.phone && (
                          <TouchableOpacity className="flex-row items-center gap-2 py-1.5" onPress={() => Linking.openURL(`tel:${contact.phone}`)}>
                            <IconSymbol name="phone.fill" size={14} color={colors.muted} />
                            <Text className="text-sm text-foreground">{contact.phone}</Text>
                          </TouchableOpacity>
                        )}
                      </>
                    )}
                  </View>
                ))}
              </View>
            </View>
          );
        }
        return (
          <View>
            {!showAddContact && addButton}
            {addContactForm}
            <View className="bg-surface rounded-xl border border-border overflow-hidden">
              <View className="flex-row px-4 py-3 border-b border-border" style={{ backgroundColor: colors.background + "80" }}>
                <Text className="text-[10px] font-semibold text-muted uppercase" style={{ width: 220 }}>Kontakt</Text>
                <Text className="text-[10px] font-semibold text-muted uppercase" style={{ width: 100 }}>Firma</Text>
                <Text className="text-[10px] font-semibold text-muted uppercase" style={{ width: 140 }}>Funktion</Text>
                <Text className="text-[10px] font-semibold text-muted uppercase flex-1">E-Mail</Text>
                <Text className="text-[10px] font-semibold text-muted uppercase" style={{ width: 160 }}>Telefon</Text>
                <View style={{ width: 60 }} />
              </View>
              {allContacts.map((contact: any, idx: number) => (
                editingContact === contact.id ? (
                  /* ── Inline Edit Row (Desktop) ── */
                  <View key={contact.id || idx} className="px-4 py-3 border-b border-border">
                    <Text className="text-sm font-bold text-foreground mb-3">Kontakt bearbeiten</Text>
                    <View className="gap-2">
                      <View className="flex-row gap-2">
                        <TextInput
                          className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                          placeholder="Vorname" placeholderTextColor={colors.muted}
                          value={editContactData.first_name}
                          onChangeText={(t) => setEditContactData({ ...editContactData, first_name: t })}
                        />
                        <TextInput
                          className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                          placeholder="Nachname" placeholderTextColor={colors.muted}
                          value={editContactData.last_name}
                          onChangeText={(t) => setEditContactData({ ...editContactData, last_name: t })}
                        />
                      </View>
                      <View className="flex-row gap-2">
                        <TextInput
                          className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                          placeholder="E-Mail" placeholderTextColor={colors.muted}
                          keyboardType="email-address" autoCapitalize="none"
                          value={editContactData.email}
                          onChangeText={(t) => setEditContactData({ ...editContactData, email: t })}
                        />
                        <TextInput
                          className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                          placeholder="Telefon" placeholderTextColor={colors.muted}
                          keyboardType="phone-pad"
                          value={editContactData.phone}
                          onChangeText={(t) => setEditContactData({ ...editContactData, phone: t })}
                        />
                      </View>
                      <TextInput
                        className="bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                        placeholder="Position (z.B. CEO)" placeholderTextColor={colors.muted}
                        value={editContactData.position}
                        onChangeText={(t) => setEditContactData({ ...editContactData, position: t })}
                      />
                      <View className="flex-row gap-2 mt-1">
                        <TouchableOpacity
                          className="bg-surface border border-border px-4 py-2 rounded-lg"
                          onPress={() => setEditingContact(null)}
                        >
                          <Text className="text-foreground font-semibold text-center text-sm">Abbrechen</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          className="bg-primary px-4 py-2 rounded-lg"
                          onPress={handleSaveEditContact}
                        >
                          {updateContactMutation.isPending ? (
                            <ActivityIndicator color="#FFF" size="small" />
                          ) : (
                            <Text className="font-semibold text-center text-sm" style={{ color: colors.background }}>Speichern</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View key={contact.id || idx} className="flex-row items-center px-4 py-3 border-b border-border">
                    {/* Kontakt: Avatar + Name + Position subtitle */}
                    <View style={{ width: 220, flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View style={{
                        width: 36, height: 36, borderRadius: 18,
                        backgroundColor: contact.is_primary ? colors.primary : "#0EA5E9",
                        alignItems: "center", justifyContent: "center",
                      }}>
                        <Text style={{ color: "#FFF", fontSize: 13, fontWeight: "700" }}>
                          {((contact.first_name || "?").charAt(0) + (contact.last_name || "").charAt(0)).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }} numberOfLines={1}>
                          {`${contact.first_name || ""} ${contact.last_name || ""}`.trim() || "—"}
                        </Text>
                        {contact.position && (
                          <Text style={{ fontSize: 11, color: colors.muted }} numberOfLines={1}>{contact.position}</Text>
                        )}
                      </View>
                    </View>
                    {/* Firma */}
                    <Text style={{ width: 100, fontSize: 13, color: colors.muted }} numberOfLines={1}>—</Text>
                    {/* Funktion as badge */}
                    <View style={{ width: 140 }}>
                      {contact.position ? (
                        <View style={{
                          backgroundColor: colors.primary + "20",
                          paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6,
                          alignSelf: "flex-start",
                        }}>
                          <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "700", textTransform: "uppercase" }} numberOfLines={1}>
                            {contact.position}
                          </Text>
                        </View>
                      ) : (
                        <Text style={{ fontSize: 13, color: colors.muted }}>—</Text>
                      )}
                    </View>
                    {/* E-Mail with icon */}
                    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
                      {contact.email ? (
                        <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: 6 }} onPress={() => Linking.openURL(`mailto:${contact.email}`)}>
                          <IconSymbol name="envelope.fill" size={13} color={colors.muted} />
                          <Text style={{ fontSize: 13, color: colors.foreground }} numberOfLines={1}>{contact.email}</Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={{ fontSize: 13, color: colors.muted }}>—</Text>
                      )}
                    </View>
                    {/* Telefon with icon */}
                    <View style={{ width: 160, flexDirection: "row", alignItems: "center", gap: 6 }}>
                      {contact.phone ? (
                        <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: 6 }} onPress={() => Linking.openURL(`tel:${contact.phone}`)}>
                          <IconSymbol name="phone.fill" size={13} color={colors.muted} />
                          <Text style={{ fontSize: 13, color: colors.foreground }} numberOfLines={1}>{contact.phone}</Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={{ fontSize: 13, color: colors.muted }}>—</Text>
                      )}
                    </View>
                    {/* Actions */}
                    <View style={{ width: 60, flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
                      {contact.id !== "legacy" && (
                        <>
                          <TouchableOpacity
                            onPress={() => startEditContact(contact)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <IconSymbol name="pencil" size={14} color={colors.primary} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => showConfirm("Kontakt löschen", "Diesen Kontakt wirklich löschen?", () => deleteContactMutation.mutate(contact.id), "Löschen")}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <IconSymbol name="trash.fill" size={14} color={colors.error} />
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                )
              ))}
            </View>
          </View>
        );
      }

      default:
        return null;
    }
  };

  const renderEmpty = (text: string, icon: string) => (
    <View className="items-center justify-center py-12">
      <IconSymbol name={icon as any} size={40} color={colors.muted} />
      <Text className="text-base text-muted mt-3">{text}</Text>
    </View>
  );

  if (loading) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <>
      <ScreenContainer>
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View style={{ padding: contentPadding }}>
            <View style={containerStyle}>
              {/* ← Zurück zu Kunden */}
              <TouchableOpacity
                className="flex-row items-center gap-1 mb-4"
                onPress={() => router.push("/(tabs)/customers" as any)}
                activeOpacity={0.7}
              >
                <IconSymbol name="chevron.left" size={16} color={colors.muted} />
                <Text className="text-sm text-muted">Zurück zu Kunden</Text>
              </TouchableOpacity>

              {/* ── Header Card ── */}
              <View className="bg-surface rounded-xl border border-border p-5 mb-4">
                {/* Edit / Delete actions in top right */}
                <View className="flex-row items-center justify-end gap-3 mb-3">
                  <TouchableOpacity
                    onPress={() => setShowEditModal(true)}
                    activeOpacity={0.7}
                    className="flex-row items-center gap-1.5 bg-primary/10 px-3 py-1.5 rounded-lg"
                  >
                    <IconSymbol name="pencil" size={14} color={colors.primary} />
                    <Text className="text-xs font-semibold" style={{ color: colors.primary }}>Bearbeiten</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleDelete}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <IconSymbol name="trash.fill" size={16} color={colors.error} />
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: isWide ? "row" : "column", alignItems: isWide ? "center" : "stretch" }}>
                  {/* Avatar + Info */}
                  <View className="flex-row items-center flex-1">
                    {/* Avatar / Logo */}
                    {customer?.logo_url ? (
                      <Image
                        source={{ uri: customer.logo_url }}
                        style={{ width: 56, height: 56, borderRadius: 12, marginRight: 16 }}
                        resizeMode="contain"
                      />
                    ) : (
                      <View
                        className="w-14 h-14 rounded-xl items-center justify-center mr-4"
                        style={{ backgroundColor: colors.primary }}
                      >
                        <Text className="text-2xl font-bold" style={{ color: colors.background }}>
                          {initial}
                        </Text>
                      </View>
                    )}

                    <View className="flex-1">
                      {/* Name + Badges */}
                      <View className="flex-row items-center flex-wrap gap-2 mb-1">
                        <Text className="text-xl font-bold text-foreground">{displayName}</Text>
                        <TouchableOpacity
                          onPress={handleToggleStatus}
                          activeOpacity={0.7}
                        >
                          <View
                            className="px-2 py-0.5 rounded"
                            style={{ backgroundColor: customer?.status === "active" ? colors.success : colors.muted }}
                          >
                            <Text className="text-[10px] font-bold" style={{ color: "#FFF" }}>
                              {customer?.status === "active" ? "AKTIV" : "INAKTIV"}
                            </Text>
                          </View>
                        </TouchableOpacity>
                        {(customer as any)?.industry && (
                          <View
                            className="px-2 py-0.5 rounded"
                            style={{ backgroundColor: colors.primary + "20" }}
                          >
                            <Text className="text-[10px] font-bold" style={{ color: colors.primary }}>
                              {(customer as any).industry.toUpperCase()}
                            </Text>
                          </View>
                        )}
                        {paymentStats && paymentStats.count >= 2 && paymentStats.latePct >= 50 && (
                          <View className="px-2 py-0.5 rounded" style={{ backgroundColor: colors.error + "20" }}>
                            <Text className="text-[10px] font-bold" style={{ color: colors.error }}>ZAHLT SPÄT</Text>
                          </View>
                        )}
                        {paymentStats && paymentStats.count >= 2 && paymentStats.latePct === 0 && (
                          <View className="px-2 py-0.5 rounded" style={{ backgroundColor: colors.success + "20" }}>
                            <Text className="text-[10px] font-bold" style={{ color: colors.success }}>ZAHLT PÜNKTLICH</Text>
                          </View>
                        )}
                      </View>

                      {/* Contact Info Row */}
                      <View className="flex-row items-center flex-wrap gap-3">
                        {customer?.website && (
                          <TouchableOpacity
                            className="flex-row items-center gap-1"
                            onPress={() => { const w = customer.website || ""; Linking.openURL(w.startsWith("http") ? w : `https://${w}`); }}
                            activeOpacity={0.7}
                          >
                            <IconSymbol name="globe" size={12} color={colors.success} />
                            <Text className="text-xs text-muted">{customer.website}</Text>
                          </TouchableOpacity>
                        )}
                        {customer?.phone && (
                          <TouchableOpacity
                            className="flex-row items-center gap-1"
                            onPress={() => Linking.openURL(`tel:${customer.phone}`)}
                            activeOpacity={0.7}
                          >
                            <IconSymbol name="phone.fill" size={12} color={colors.muted} />
                            <Text className="text-xs text-muted">{customer.phone}</Text>
                          </TouchableOpacity>
                        )}
                        {(customer?.city || customer?.address) && (
                          <TouchableOpacity
                            className="flex-row items-center gap-1"
                            onPress={handleOpenAddressChoice}
                            activeOpacity={0.7}
                          >
                            <IconSymbol name="mappin.circle.fill" size={12} color={colors.success} />
                            <Text className="text-xs text-muted" style={{ textDecorationLine: "underline" }}>
                              {[customer?.address, [customer?.postal_code, customer?.city].filter(Boolean).join(" "), customer?.country].filter(Boolean).join(", ")}
                            </Text>
                          </TouchableOpacity>
                        )}
                        {customer?.email && (
                          <TouchableOpacity
                            className="flex-row items-center gap-1"
                            onPress={() => Linking.openURL(`mailto:${customer.email}`)}
                            activeOpacity={0.7}
                          >
                            <IconSymbol name="envelope.fill" size={12} color={colors.muted} />
                            <Text className="text-xs text-muted">{customer.email}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* KPI Cards */}
                  <View className="flex-row gap-3" style={{ marginLeft: isWide ? 16 : 0, marginTop: isWide ? 0 : 16 }}>
                    <View className="flex-1 bg-background rounded-lg border border-border px-3 py-3 items-center" style={isWide ? { minWidth: 80, flex: undefined } : {}}>
                      <Text className="text-2xl font-bold" style={{ color: colors.success }}>
                        {openTickets}
                      </Text>
                      <Text className="text-[9px] font-semibold text-muted uppercase mt-0.5">Offene Tickets</Text>
                    </View>
                    <View className="flex-1 bg-background rounded-lg border border-border px-3 py-3 items-center" style={isWide ? { minWidth: 80, flex: undefined } : {}}>
                      <Text className="text-2xl font-bold" style={{ color: colors.warning }}>
                        {formatKPI(totalPaid)}
                      </Text>
                      <Text className="text-[9px] font-semibold text-muted uppercase mt-0.5">CHF Bezahlt</Text>
                    </View>
                    {totalUnpaid > 0 && (
                      <View className="flex-1 bg-background rounded-lg border border-border px-3 py-3 items-center" style={isWide ? { minWidth: 80, flex: undefined } : {}}>
                        <Text className="text-2xl font-bold" style={{ color: colors.error }}>
                          {formatKPI(totalUnpaid)}
                        </Text>
                        <Text className="text-[9px] font-semibold text-muted uppercase mt-0.5">CHF Offen</Text>
                      </View>
                    )}
                    {paymentStats && (
                      <View className="flex-1 bg-background rounded-lg border border-border px-3 py-3 items-center" style={isWide ? { minWidth: 80, flex: undefined } : {}}>
                        <Text className="text-2xl font-bold" style={{ color: payColor }}>
                          {paymentStats.avgDays}
                        </Text>
                        <Text className="text-[9px] font-semibold text-muted uppercase mt-0.5 text-center">
                          Ø Tage bis Zahlung{paymentStats.latePct > 0 ? ` · ${paymentStats.latePct}% spät` : ""}
                        </Text>
                      </View>
                    )}
                    <View className="flex-1 bg-background rounded-lg border border-border px-3 py-3 items-center" style={isWide ? { minWidth: 80, flex: undefined } : {}}>
                      <Text className="text-2xl font-bold text-foreground">
                        {contactPerson ? 1 : 0}
                      </Text>
                      <Text className="text-[9px] font-semibold text-muted uppercase mt-0.5">Kontakte</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* ── Quick Actions ── */}
              <View className="flex-row items-center flex-wrap gap-2 mb-4">
                <TouchableOpacity
                  className="flex-row items-center gap-1.5 bg-primary px-4 py-2 rounded-lg"
                  activeOpacity={0.8}
                  onPress={() => setShowNewTicket(true)}
                >
                  <Text className="text-sm font-semibold" style={{ color: colors.background }}>+ Neues Ticket</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-row items-center gap-1.5 bg-surface border border-border px-4 py-2 rounded-lg"
                  activeOpacity={0.8}
                  onPress={() => setShowNewQuote(true)}
                >
                  <Text className="text-sm font-semibold text-foreground">+ Neues Angebot</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-row items-center gap-1.5 bg-surface border border-border px-4 py-2 rounded-lg"
                  activeOpacity={0.8}
                  onPress={() => setEditingContract({ customer_id: id })}
                >
                  <Text className="text-sm font-semibold text-foreground">+ Neuer Vertrag</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-row items-center gap-1.5 bg-surface border border-border px-4 py-2 rounded-lg"
                  activeOpacity={0.8}
                  onPress={() => setShowNewInvoice(true)}
                >
                  <Text className="text-sm font-semibold text-foreground">+ Neue Rechnung</Text>
                </TouchableOpacity>
              </View>

              {/* ── Stammdaten-Änderungsanträge aus dem Portal ── */}
              {myChangeRequests.map((req: any) => (
                <View
                  key={req.id}
                  className="rounded-xl border p-4 mb-4"
                  style={{ backgroundColor: "#8B5CF610", borderColor: "#8B5CF650" }}
                >
                  <View className="flex-row items-center gap-2 mb-2">
                    <IconSymbol name="person.crop.circle.badge.exclamationmark" size={16} color="#8B5CF6" />
                    <Text className="text-sm font-bold text-foreground">
                      Stammdaten-Änderung aus dem Portal{req.requested_by ? ` (${req.requested_by})` : ""}
                    </Text>
                  </View>
                  {Object.entries(req.changes || {}).map(([field, value]) => {
                    const labels: Record<string, string> = {
                      address: "Adresse", postal_code: "PLZ", city: "Ort", phone: "Telefon", email: "E-Mail",
                    };
                    const current = (customer as any)?.[field];
                    return (
                      <Text key={field} className="text-xs text-foreground mb-0.5">
                        {labels[field] || field}: <Text style={{ color: colors.muted, textDecorationLine: "line-through" }}>{String(current || "–")}</Text> → <Text style={{ fontWeight: "700" }}>{String(value || "–")}</Text>
                      </Text>
                    );
                  })}
                  <View className="flex-row gap-2 mt-3">
                    <TouchableOpacity
                      className="flex-1 py-2 rounded-lg"
                      style={{ backgroundColor: "#22C55E" }}
                      onPress={async () => {
                        try {
                          await Data.resolveChangeRequest(req.id, true);
                          queryClient.invalidateQueries({ queryKey: ["pendingChangeRequests"] });
                          queryClient.invalidateQueries({ queryKey: ["customer", id] });
                          showToast("Änderung übernommen");
                        } catch (e: any) { showAlert("Fehler", e.message); }
                      }}
                      activeOpacity={0.8}
                    >
                      <Text className="text-center text-xs font-bold text-white">Übernehmen</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="flex-1 py-2 rounded-lg border border-border bg-surface"
                      onPress={async () => {
                        try {
                          await Data.resolveChangeRequest(req.id, false);
                          queryClient.invalidateQueries({ queryKey: ["pendingChangeRequests"] });
                          showToast("Änderung abgelehnt");
                        } catch (e: any) { showAlert("Fehler", e.message); }
                      }}
                      activeOpacity={0.8}
                    >
                      <Text className="text-center text-xs font-bold text-foreground">Ablehnen</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {/* ── Onboarding-Checkliste (nur solange Schritte offen sind) ── */}
              {(onboardingSteps as any[]).some((s: any) => !s.done) ? (
                <View className="bg-surface rounded-xl border border-border p-4 mb-4">
                  <View className="flex-row items-center gap-2 mb-2">
                    <IconSymbol name="checklist" size={16} color={colors.primary} />
                    <Text className="text-base font-bold text-foreground">Onboarding</Text>
                    <Text className="text-xs text-muted">
                      {(onboardingSteps as any[]).filter((s: any) => s.done).length}/{(onboardingSteps as any[]).length} erledigt
                    </Text>
                  </View>
                  {(onboardingSteps as any[]).map((s: any) => (
                    <TouchableOpacity
                      key={s.id}
                      className="flex-row items-center gap-2.5 py-1.5"
                      onPress={async () => {
                        try {
                          await Data.toggleOnboardingStep(s.id, !s.done);
                          queryClient.invalidateQueries({ queryKey: ["customerOnboarding", id] });
                        } catch (e: any) { showAlert("Fehler", e.message); }
                      }}
                      activeOpacity={0.7}
                    >
                      <IconSymbol
                        name={s.done ? "checkmark.circle.fill" : "circle"}
                        size={18}
                        color={s.done ? colors.success : colors.muted}
                      />
                      <Text
                        className="text-sm flex-1"
                        style={{
                          color: s.done ? colors.muted : colors.foreground,
                          textDecorationLine: s.done ? "line-through" : "none",
                        }}
                      >
                        {s.step}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              {/* ── Inaktivitäts-Erinnerung ── */}
              <View className="bg-surface rounded-xl border border-border p-4 mb-4">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2 flex-1 mr-2">
                    <IconSymbol
                      name={(customer as any)?.inactive_muted ? "bell.slash.fill" : "bell.fill"}
                      size={16}
                      color={(customer as any)?.inactive_muted ? colors.muted : colors.primary}
                    />
                    <View className="flex-1">
                      <Text className="text-sm font-bold text-foreground">Inaktivitäts-Erinnerung</Text>
                      <Text className="text-[11px] text-muted">
                        {(customer as any)?.inactive_muted
                          ? "Stummgeschaltet — keine Erinnerung in «Heute wichtig»"
                          : `Erinnert nach ${(customer as any)?.inactive_months || 6} Monaten ohne Rechnung und Ticket`}
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={!(customer as any)?.inactive_muted}
                    onValueChange={async (v) => {
                      try {
                        // Beim Reaktivieren auch eine laufende Pause aufheben
                        await Data.updateInactiveReminderSettings(id as string, v ? { muted: false, snoozeUntil: null } : { muted: true });
                        queryClient.invalidateQueries({ queryKey: ["customer", id] });
                        queryClient.invalidateQueries({ queryKey: ["todayFeed"] });
                      } catch (e: any) { showAlert("Fehler", e.message); }
                    }}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor="#fff"
                  />
                </View>
                {!(customer as any)?.inactive_muted && (
                  <View className="flex-row items-center gap-2 mt-3 flex-wrap">
                    <Text className="text-xs text-muted">Erinnern nach:</Text>
                    {[3, 6, 9, 12].map((m) => {
                      const active = ((customer as any)?.inactive_months || 6) === m;
                      return (
                        <TouchableOpacity
                          key={m}
                          className="px-3 py-1.5 rounded-full border"
                          style={{
                            backgroundColor: active ? colors.primary : colors.background,
                            borderColor: active ? colors.primary : colors.border,
                          }}
                          onPress={async () => {
                            try {
                              await Data.updateInactiveReminderSettings(id as string, { months: m });
                              queryClient.invalidateQueries({ queryKey: ["customer", id] });
                              queryClient.invalidateQueries({ queryKey: ["todayFeed"] });
                            } catch (e: any) { showAlert("Fehler", e.message); }
                          }}
                          activeOpacity={0.8}
                        >
                          <Text className="text-xs font-semibold" style={{ color: active ? colors.background : colors.foreground }}>
                            {m} Mt.
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
                {!(customer as any)?.inactive_muted && (customer as any)?.inactive_snooze_until &&
                  (customer as any).inactive_snooze_until > new Date().toISOString().split("T")[0] && (
                  <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-border">
                    <Text className="text-xs text-muted flex-1 mr-2">
                      Pausiert bis {formatDate((customer as any).inactive_snooze_until)}
                    </Text>
                    <TouchableOpacity
                      className="px-3 py-1.5 rounded-lg border border-border bg-background"
                      onPress={async () => {
                        try {
                          await Data.updateInactiveReminderSettings(id as string, { snoozeUntil: null });
                          queryClient.invalidateQueries({ queryKey: ["customer", id] });
                          queryClient.invalidateQueries({ queryKey: ["todayFeed"] });
                        } catch (e: any) { showAlert("Fehler", e.message); }
                      }}
                      activeOpacity={0.8}
                    >
                      <Text className="text-xs font-semibold text-foreground">Pause aufheben</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Kontakt festhalten: setzt die Inaktivitäts-Frist zurück */}
                <View className="mt-3 pt-3 border-t border-border">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs text-muted flex-1 mr-2">
                      {lastTouchpoint
                        ? `Letzter Kontaktvermerk: ${formatDate(lastTouchpoint.touched_at)} · ${Data.touchpointChannelLabel(lastTouchpoint.channel)}`
                        : "Noch kein Kontakt vermerkt"}
                    </Text>
                    <TouchableOpacity
                      className="px-3 py-1.5 rounded-lg bg-primary"
                      onPress={() => setShowTouchpointForm(!showTouchpointForm)}
                      activeOpacity={0.8}
                    >
                      <Text className="text-xs font-semibold" style={{ color: colors.background }}>Kontakt festhalten</Text>
                    </TouchableOpacity>
                  </View>
                  {showTouchpointForm && (
                    <View className="mt-3 gap-2.5">
                      <View className="flex-row flex-wrap gap-2">
                        {Data.TOUCHPOINT_CHANNELS.map((ch) => {
                          const active = tpChannel === ch.value;
                          return (
                            <TouchableOpacity
                              key={ch.value}
                              className="px-3 py-1.5 rounded-full border"
                              style={{
                                backgroundColor: active ? colors.primary : colors.background,
                                borderColor: active ? colors.primary : colors.border,
                              }}
                              onPress={() => setTpChannel(ch.value)}
                              activeOpacity={0.8}
                            >
                              <Text className="text-xs font-semibold" style={{ color: active ? colors.background : colors.foreground }}>
                                {ch.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      <TextInput
                        className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                        value={tpNote}
                        onChangeText={setTpNote}
                        placeholder="Notiz (optional), z.B. «Nach Offerte gefragt»"
                        placeholderTextColor={colors.muted}
                      />
                      <TouchableOpacity
                        className="bg-primary rounded-lg py-2.5 items-center"
                        disabled={tpSaving}
                        onPress={async () => {
                          setTpSaving(true);
                          try {
                            await Data.logCustomerTouchpoint(id as string, tpChannel, tpNote);
                            queryClient.invalidateQueries({ queryKey: ["lastTouchpoint", id] });
                            queryClient.invalidateQueries({ queryKey: ["customerTimeline", id] });
                            queryClient.invalidateQueries({ queryKey: ["todayFeed"] });
                            setShowTouchpointForm(false);
                            setTpNote("");
                            showToast("Kontakt vermerkt – Inaktivitäts-Frist beginnt neu");
                          } catch (e: any) {
                            showAlert("Fehler", e.message);
                          } finally {
                            setTpSaving(false);
                          }
                        }}
                        activeOpacity={0.8}
                      >
                        <Text className="text-sm font-semibold" style={{ color: colors.background }}>
                          {tpSaving ? "Speichert..." : "Kontakt speichern"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>

              {/* ── Tab Navigation ── */}
              <ScrollView horizontal={!isWide} showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} className="mb-4 border-b border-border pb-2">
              <View className="flex-row items-center gap-4">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.key;
                  return (
                    <TouchableOpacity
                      key={tab.key}
                      className="flex-row items-center gap-1.5 pb-1"
                      style={{
                        borderBottomWidth: isActive ? 2 : 0,
                        borderColor: isActive ? colors.primary : "transparent",
                      }}
                      onPress={() => setActiveTab(tab.key)}
                      activeOpacity={0.7}
                    >
                      <IconSymbol name={tab.icon} size={14} color={isActive ? colors.foreground : colors.muted} />
                      <Text
                        className="text-sm font-semibold"
                        style={{ color: isActive ? colors.foreground : colors.muted }}
                      >
                        {tab.label}
                      </Text>
                      <View
                        className="px-1.5 py-0.5 rounded-full min-w-[20px] items-center"
                        style={{ backgroundColor: isActive ? colors.primary + "20" : colors.border }}
                      >
                        <Text
                          className="text-[10px] font-bold"
                          style={{ color: isActive ? colors.primary : colors.muted }}
                        >
                          {tab.count}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
              </ScrollView>

              {/* ── Tab Content ── */}
              {renderTabContent()}

              <View style={{ height: 32 }} />
            </View>
          </View>
        </ScrollView>
      </ScreenContainer>

      {/* ── Vertragsdetail-Modal ── */}
      {selectedContract && (
        <Modal visible={true} animationType="slide" transparent onRequestClose={() => setSelectedContract(null)}>
          <View className="flex-1 bg-black/50 justify-end">
            <View className="bg-background rounded-t-3xl" style={{ maxHeight: "90%" }}>
              <View className="flex-row items-center justify-between p-4 border-b border-border">
                <Text className="text-2xl font-bold text-foreground">Vertragsdetails</Text>
                <TouchableOpacity onPress={() => setSelectedContract(null)} activeOpacity={0.7}>
                  <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
                </TouchableOpacity>
              </View>
              <ScrollView className="p-4" showsVerticalScrollIndicator={false}>
                <View className="gap-4">
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1">
                      <Text className="text-xl font-bold text-foreground mb-1">{selectedContract.title}</Text>
                    </View>
                    <View className={`px-3 py-1 rounded-full`}
                      style={{ backgroundColor: contractStatusColor(selectedContract.status) + "20" }}
                    >
                      <Text className="text-sm font-semibold" style={{ color: contractStatusColor(selectedContract.status) }}>
                        {contractStatusLabel(selectedContract.status)}
                      </Text>
                    </View>
                  </View>

                  {selectedContract.description && (
                    <Text className="text-base text-muted">{selectedContract.description}</Text>
                  )}

                  <View className="bg-surface rounded-xl p-4 border border-border gap-3">
                    <View>
                      <Text className="text-sm text-muted mb-1">Laufzeit</Text>
                      <Text className="text-base text-foreground">
                        {formatDate(selectedContract.start_date)} - {formatDate(selectedContract.end_date)}
                      </Text>
                    </View>
                    <View>
                      <Text className="text-sm text-muted mb-1">Dauer</Text>
                      <Text className="text-base text-foreground">
                        {selectedContract.duration_months} Monate
                      </Text>
                    </View>
                    <View>
                      <Text className="text-sm text-muted mb-1">Jahresbetrag</Text>
                      <Text className="text-lg font-bold text-success">
                        {formatCurrency(selectedContract.amount)}
                      </Text>
                    </View>
                    <View>
                      <Text className="text-sm text-muted mb-1">Kündigungsfrist</Text>
                      <Text className="text-base text-foreground">
                        {selectedContract.notice_period_months} {selectedContract.notice_period_months === 1 ? 'Monat' : 'Monate'}
                      </Text>
                    </View>
                  </View>
                </View>
              </ScrollView>
              <View className="p-4 border-t border-border flex-row gap-3">
                <TouchableOpacity
                  className="flex-1 bg-surface border border-border py-3 rounded-lg"
                  onPress={() => setSelectedContract(null)}
                  activeOpacity={0.8}
                >
                  <Text className="text-foreground font-semibold text-center">Schließen</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-primary py-3 rounded-lg"
                  onPress={() => {
                    setEditingContract(selectedContract);
                    setSelectedContract(null);
                  }}
                  activeOpacity={0.8}
                >
                  <Text className="text-background font-semibold text-center">Bearbeiten</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {editingContract && (
        <ContractFormModal
          visible={true}
          contract={editingContract.id ? editingContract : (editingContract.customer_id ? { customerId: editingContract.customer_id } : undefined)}
          onClose={() => setEditingContract(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["contracts", id] });
            queryClient.invalidateQueries({ queryKey: ["customers"] });
            setEditingContract(null);
          }}
        />
      )}

      {/* ── Ticket-Detail-Modal ── */}
      {selectedTicket && (
        <Modal visible={true} animationType="slide" transparent onRequestClose={() => setSelectedTicket(null)}>
          <View className="flex-1 bg-black/50 justify-end">
            <View className="bg-background rounded-t-3xl" style={{ maxHeight: "90%" }}>
              <View className="flex-row items-center justify-between p-4 border-b border-border">
                <Text className="text-2xl font-bold text-foreground">Ticket-Details</Text>
                <TouchableOpacity onPress={() => setSelectedTicket(null)} activeOpacity={0.7}>
                  <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
                </TouchableOpacity>
              </View>
              <ScrollView className="p-4" showsVerticalScrollIndicator={false}>
                <View className="gap-4">
                  <View>
                    <Text className="text-sm text-muted mb-1">Titel</Text>
                    <Text className="text-lg font-semibold text-foreground">{selectedTicket.title}</Text>
                  </View>
                  {selectedTicket.description && (
                    <View>
                      <Text className="text-sm text-muted mb-1">Beschreibung</Text>
                      <Text className="text-base text-foreground">{selectedTicket.description}</Text>
                    </View>
                  )}
                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <Text className="text-sm text-muted mb-1">Status</Text>
                      <View className="px-3 py-2 rounded-lg" style={{ backgroundColor: ticketStatusColor(selectedTicket.status) + "20" }}>
                        <Text className="text-sm font-semibold text-center" style={{ color: ticketStatusColor(selectedTicket.status) }}>
                          {ticketStatusLabel(selectedTicket.status)}
                        </Text>
                      </View>
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm text-muted mb-1">Priorität</Text>
                      <View className="px-3 py-2 rounded-lg" style={{ backgroundColor: priorityColor(selectedTicket.priority) + "20" }}>
                        <Text className="text-sm font-semibold text-center" style={{ color: priorityColor(selectedTicket.priority) }}>
                          {priorityLabel(selectedTicket.priority)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View>
                    <Text className="text-sm text-muted mb-1">Erstellt am</Text>
                    <Text className="text-base text-foreground">{formatDate(selectedTicket.created_at)}</Text>
                  </View>
                </View>
              </ScrollView>
              <View className="p-4 border-t border-border flex-row gap-3">
                <TouchableOpacity
                  className="flex-1 bg-error/10 border border-error/30 py-3 rounded-lg"
                  onPress={() => {
                    deleteTicketMutation.mutate(selectedTicket.id);
                    setSelectedTicket(null);
                  }}
                  activeOpacity={0.8}
                >
                  <Text className="text-error font-semibold text-center">Löschen</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-surface border border-border py-3 rounded-lg"
                  onPress={() => setSelectedTicket(null)}
                  activeOpacity={0.8}
                >
                  <Text className="text-foreground font-semibold text-center">Schließen</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {showEditModal && customer && (
        <CustomerFormModal
          visible={showEditModal}
          editCustomer={customer}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["customer", id] });
            queryClient.invalidateQueries({ queryKey: ["customers"] });
            queryClient.invalidateQueries({ queryKey: ["customer-contacts", id] });
          }}
        />
      )}

      {showNewQuote && (
        <QuoteFormModal
          visible={showNewQuote}
          initialCustomerId={id as string}
          onClose={() => setShowNewQuote(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["quotes", "customer", id] });
            queryClient.invalidateQueries({ queryKey: ["quotes"] });
            setShowNewQuote(false);
          }}
        />
      )}

      {showNewTicket && (
        <TicketFormModal
          visible={showNewTicket}
          ticket={{ customer_id: id }}
          onClose={() => setShowNewTicket(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["tickets", id] });
            queryClient.invalidateQueries({ queryKey: ["tickets"] });
            setShowNewTicket(false);
          }}
        />
      )}

      {showNewInvoice && (
        <InvoiceFormModal
          visible={showNewInvoice}
          initialCustomerId={id as string}
          onClose={() => setShowNewInvoice(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["invoices", "customer", id] });
            queryClient.invalidateQueries({ queryKey: ["invoices"] });
            setShowNewInvoice(false);
          }}
        />
      )}
    </>
  );
}

// ── Zeit → Rechnung: offene (unverrechnete) Ticket-Aufwände sammeln ──
function UnbilledWorkCard({ customerId, colors }: { customerId: string; colors: any }) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [linkingItem, setLinkingItem] = useState<any>(null);

  const { data: customerInvoices = [] } = useQuery({
    queryKey: ["invoices", "customer", customerId],
    queryFn: () => Data.getCustomerInvoices(customerId),
    enabled: !!customerId,
  });

  const { data: items = [] } = useQuery({
    queryKey: ["unbilledItems", customerId],
    queryFn: () => Data.getUnbilledTicketItems(customerId),
    enabled: !!customerId,
  });

  const total = (items as any[]).reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0);
  if (!(items as any[]).length) return null;

  const handleCreateInvoice = () => {
    showConfirm(
      "Aufwände verrechnen",
      `${(items as any[]).length} offene Position(en) über ${formatCurrency(total)} in eine neue Rechnung (Entwurf) übernehmen?`,
      async () => {
        setCreating(true);
        try {
          const invoiceNumber = await Data.getNextInvoiceNumber();
          const today = new Date().toISOString().split("T")[0];
          const dueDate = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
          const vatRate = 8.1;
          const subtotal = total;
          const invoiceItems = (items as any[]).map((i: any) => {
            const qty = Number(i.quantity) || 1;
            const price = Number(i.unit_price) || 0;
            return {
              description: `${i.description || "Aufwand"}${i.ticket_title ? ` (Ticket: ${i.ticket_title})` : ""}`,
              quantity: qty,
              unit: i.unit || "Std.",
              unit_price: price,
              vat_rate: vatRate,
              total: qty * price * (1 + vatRate / 100),
            };
          });
          const invoice = await Data.createInvoice(
            {
              customer_id: customerId,
              invoice_number: invoiceNumber,
              invoice_date: today,
              due_date: dueDate,
              subtotal,
              vat_amount: Math.round(subtotal * vatRate) / 100,
              total: Math.round(subtotal * (1 + vatRate / 100) * 100) / 100,
              status: "draft",
              notes: "Rechnung aus offenen Ticket-Aufwänden",
            },
            invoiceItems
          );
          await Data.markTicketItemsBilled((items as any[]).map((i: any) => i.id), invoice.id);
          queryClient.invalidateQueries({ queryKey: ["unbilledItems", customerId] });
          queryClient.invalidateQueries({ queryKey: ["invoices"] });
          queryClient.invalidateQueries({ queryKey: ["invoices", "customer", customerId] });
          showToast(`Rechnung ${invoiceNumber} als Entwurf erstellt`);
          router.push(`/invoice/${invoice.id}`);
        } catch (e: any) {
          showAlert("Fehler", e.message);
        } finally {
          setCreating(false);
        }
      },
      "Rechnung erstellen"
    );
  };

  return (
    <View className="bg-surface rounded-xl border p-4" style={{ borderColor: colors.warning + "60", backgroundColor: colors.warning + "08" }}>
      <View className="flex-row items-center gap-2 mb-1">
        <IconSymbol name="clock.fill" size={16} color={colors.warning} />
        <Text className="text-base font-bold text-foreground">Offene Aufwände</Text>
      </View>
      <Text className="text-sm text-muted mb-3">
        {(items as any[]).length} unverrechnete Position(en) aus Tickets · {formatCurrency(total)} (exkl. MwSt)
      </Text>

      {/* Einzelpositionen: verknüpfen (schon verrechnet) oder abschreiben */}
      {(items as any[]).map((i: any) => (
        <View key={i.id} className="flex-row items-center gap-2 py-1.5" style={{ borderBottomWidth: 1, borderBottomColor: colors.border + "40" }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text className="text-sm text-foreground" numberOfLines={1}>{i.description || "Aufwand"}</Text>
            <Text className="text-xs text-muted">
              {i.quantity} × {formatCurrency(Number(i.unit_price) || 0)}{i.ticket_title ? ` · ${i.ticket_title}` : ""}
            </Text>
          </View>
          <TouchableOpacity
            style={{ paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7, backgroundColor: colors.primary + "15" }}
            onPress={() => setLinkingItem(i)}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", color: colors.primary }}>Verknüpfen</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7, backgroundColor: colors.muted + "20" }}
            onPress={() =>
              showConfirm(
                "Abschreiben",
                `"${i.description || "Aufwand"}" als nicht verrechenbar abschreiben? Die Position bleibt am Ticket dokumentiert.`,
                async () => {
                  await Data.writeOffTicketItem(i.id);
                  queryClient.invalidateQueries({ queryKey: ["unbilledItems", customerId] });
                },
                "Abschreiben"
              )
            }
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", color: colors.muted }}>Abschreiben</Text>
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity
        className="bg-primary py-2.5 rounded-lg flex-row items-center justify-center gap-2 mt-3"
        onPress={handleCreateInvoice}
        disabled={creating}
        activeOpacity={0.8}
      >
        {creating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <IconSymbol name="doc.text.fill" size={14} color={colors.background} />}
        <Text className="text-background font-semibold text-sm">In Rechnung übernehmen</Text>
      </TouchableOpacity>

      {/* Mit bestehender Rechnung verknüpfen */}
      {linkingItem ? (
        <View className="mt-3 rounded-lg border p-3" style={{ borderColor: colors.primary + "40", backgroundColor: colors.background }}>
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-xs font-bold text-muted">MIT WELCHER RECHNUNG WURDE DAS VERRECHNET?</Text>
            <TouchableOpacity onPress={() => setLinkingItem(null)}>
              <IconSymbol name="xmark.circle.fill" size={18} color={colors.muted} />
            </TouchableOpacity>
          </View>
          {(customerInvoices as any[]).filter((inv: any) => inv.status !== "cancelled").slice(0, 10).map((inv: any) => (
            <TouchableOpacity
              key={inv.id}
              className="flex-row items-center justify-between py-2"
              style={{ borderBottomWidth: 1, borderBottomColor: colors.border + "40" }}
              onPress={async () => {
                await Data.linkTicketItemToInvoice(linkingItem.id, inv.id);
                setLinkingItem(null);
                queryClient.invalidateQueries({ queryKey: ["unbilledItems", customerId] });
                showToast(`Mit ${inv.invoice_number} verknüpft`);
              }}
              activeOpacity={0.7}
            >
              <Text className="text-sm font-semibold text-foreground">{inv.invoice_number}</Text>
              <Text className="text-xs text-muted">{formatDate(inv.invoice_date)} · {formatCurrency(inv.total || 0)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ── Inventar: Geräte & Lizenzen pro Kunde ──
function CustomerAssetsTab({ customerId, colors }: { customerId: string; colors: any }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<"device" | "license">("device");
  const [name, setName] = useState("");
  const [serial, setSerial] = useState("");
  const [expires, setExpires] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: assets = [] } = useQuery({
    queryKey: ["customerAssets", customerId],
    queryFn: () => Data.getCustomerAssets(customerId),
    enabled: !!customerId,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["customerAssets", customerId] });

  const handleSave = async () => {
    if (!name.trim()) { showAlert("Fehler", "Bitte eine Bezeichnung angeben."); return; }
    let dbDate: string | null = expires.trim() || null;
    if (dbDate) {
      const parts = dbDate.split(".");
      if (parts.length === 3) dbDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }
    setSaving(true);
    try {
      await Data.createCustomerAsset({
        customer_id: customerId,
        type,
        name: name.trim(),
        serial_number: serial.trim() || null,
        expires_at: dbDate,
        notes: notes.trim() || null,
      });
      setName(""); setSerial(""); setExpires(""); setNotes(""); setShowForm(false);
      refresh();
      showToast("Eintrag gespeichert");
    } catch (e: any) {
      showAlert("Fehler", e.message);
    } finally {
      setSaving(false);
    }
  };

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <View className="gap-3">
      {!showForm ? (
        <TouchableOpacity
          className="flex-row items-center justify-center gap-2 bg-primary py-3 rounded-xl"
          onPress={() => setShowForm(true)}
          activeOpacity={0.8}
        >
          <IconSymbol name="plus" size={16} color={colors.background} />
          <Text className="text-background font-semibold">Gerät / Lizenz erfassen</Text>
        </TouchableOpacity>
      ) : (
        <View className="bg-surface rounded-xl border border-border p-4 gap-2">
          <View className="flex-row gap-2">
            {([
              { key: "device", label: "Gerät" },
              { key: "license", label: "Lizenz" },
            ] as const).map((t) => (
              <TouchableOpacity
                key={t.key}
                className={`flex-1 py-2 rounded-lg ${type === t.key ? "bg-primary" : "bg-background border border-border"}`}
                onPress={() => setType(t.key)}
              >
                <Text className={`text-center text-xs font-semibold ${type === t.key ? "text-background" : "text-foreground"}`}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            value={name} onChangeText={setName}
            placeholder={type === "license" ? "Lizenz (z.B. Microsoft 365 Business)" : "Gerät (z.B. HP ProBook 450)"}
            placeholderTextColor={colors.muted}
            className="bg-background border border-border rounded-lg px-3 py-2.5 text-foreground text-sm"
          />
          <View className="flex-row gap-2">
            <TextInput
              value={serial} onChangeText={setSerial}
              placeholder="Seriennummer / Schlüssel" placeholderTextColor={colors.muted}
              className="flex-1 bg-background border border-border rounded-lg px-3 py-2.5 text-foreground text-sm"
            />
            <TextInput
              value={expires} onChangeText={setExpires}
              placeholder={type === "license" ? "Ablauf (DD.MM.YYYY)" : "Garantie bis (DD.MM.YYYY)"}
              placeholderTextColor={colors.muted}
              className="flex-1 bg-background border border-border rounded-lg px-3 py-2.5 text-foreground text-sm"
            />
          </View>
          <TextInput
            value={notes} onChangeText={setNotes} multiline
            placeholder="Notizen (optional)" placeholderTextColor={colors.muted}
            className="bg-background border border-border rounded-lg px-3 py-2.5 text-foreground text-sm"
          />
          <View className="flex-row gap-2">
            <TouchableOpacity className="flex-1 bg-background border border-border py-2.5 rounded-lg" onPress={() => setShowForm(false)}>
              <Text className="text-center text-xs font-semibold text-foreground">Abbrechen</Text>
            </TouchableOpacity>
            <TouchableOpacity className="flex-1 bg-primary py-2.5 rounded-lg" onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color={colors.background} /> : (
                <Text className="text-center text-xs font-semibold text-background">Speichern</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {(assets as any[]).length === 0 ? (
        <View className="items-center py-10">
          <IconSymbol name="desktopcomputer" size={40} color={colors.muted} />
          <Text className="text-base font-semibold text-foreground mt-3">Kein Inventar</Text>
          <Text className="text-sm text-muted mt-1 text-center">
            Geräte und Lizenzen mit Ablaufdatum erfassen – der Ablauf-Wächter erinnert dich und den Kunden automatisch.
          </Text>
        </View>
      ) : (
        <View className="bg-surface rounded-xl border border-border overflow-hidden">
          {(assets as any[]).map((a: any, idx: number) => {
            const expired = a.expires_at && a.expires_at < todayStr;
            const soon = !expired && a.expires_at && new Date(a.expires_at).getTime() - Date.now() < 30 * 86400000;
            const color = expired ? "#EF4444" : soon ? "#F59E0B" : colors.primary;
            return (
              <TouchableOpacity
                key={a.id}
                className="flex-row items-center px-3.5 py-3 gap-3"
                style={{ borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: colors.border }}
                activeOpacity={0.7}
                onLongPress={() =>
                  showConfirm("Löschen", `"${a.name}" entfernen?`, async () => {
                    await Data.deleteCustomerAsset(a.id);
                    refresh();
                  }, "Löschen")
                }
              >
                <View style={{ width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: color + "18" }}>
                  <IconSymbol name={a.type === "license" ? "key.fill" : "desktopcomputer"} size={17} color={color} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>{a.name}</Text>
                  <Text className="text-[11px] text-muted" numberOfLines={2}>
                    {a.type === "license" ? "Lizenz" : "Gerät"}
                    {a.serial_number ? ` · SN ${a.serial_number}` : ""}
                    {a.expires_at ? ` · ${a.type === "license" ? "läuft ab" : "Garantie bis"} ${formatDate(a.expires_at)}` : ""}
                    {a.notes ? ` · ${a.notes}` : ""}
                  </Text>
                  {expired ? (
                    <Text className="text-[11px] font-bold" style={{ color: "#EF4444" }}>Abgelaufen</Text>
                  ) : soon ? (
                    <Text className="text-[11px] font-bold" style={{ color: "#F59E0B" }}>Läuft in weniger als 30 Tagen ab</Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      {(assets as any[]).length > 0 && (
        <Text className="text-[10px] text-muted text-center">Gedrückt halten zum Löschen</Text>
      )}
    </View>
  );
}

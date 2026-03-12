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
} from "react-native";
import { showAlert, showConfirm } from "@/lib/alert";
import { useLocalSearchParams, router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { formatDate, formatCurrency, getInvoiceTotal } from "@/lib/format";
import { CustomerPortalManagement } from "@/components/customer-portal-management";
import { ContractFormModal } from "@/components/contract-form-modal";
import { CustomerFormModal } from "@/components/customer-form-modal";

type Tab = "tickets" | "rechnungen" | "vertraege" | "kontakte";

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

  // ── Mutations ──
  const deleteCustomer = useMutation({
    mutationFn: (custId: string) => Data.deleteCustomer(custId),
    onSuccess: () => {
      showAlert("Erfolg", "Kunde wurde erfolgreich gelöscht");
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
      showAlert("Erfolg", "Ticket gelöscht");
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
      showAlert("Erfolg", "Kontakt gelöscht");
    },
    onError: (error: any) => showAlert("Fehler", error.message),
  });

  // ── Derived Data ──
  const displayName = customer?.company_name ||
    `${customer?.first_name || ""} ${customer?.last_name || ""}`.trim() || "Kunde";

  const initial = displayName.charAt(0).toUpperCase();

  const openTickets = tickets.filter((t: any) => t.status !== "closed").length;
  const totalPaid = invoices
    .filter((inv: any) => inv.status === "paid")
    .reduce((sum: number, inv: any) => sum + (getInvoiceTotal(inv) || 0), 0);

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
    { key: "kontakte", label: "Kontakte", icon: "person.2.fill", count: (customerContacts.length || 0) + (contactPerson ? 1 : 0) },
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
    s === "draft" ? "ENTWURF" : s === "open" ? "OFFEN" : s === "paid" ? "BEZAHLT" : s === "overdue" ? "ÜBERFÄLLIG" : "STORNIERT";
  const invoiceStatusColor = (s: string) =>
    s === "paid" ? colors.success : s === "overdue" ? colors.error : s === "open" ? colors.primary : colors.muted;

  const contractStatusLabel = (s: string) =>
    s === "active" ? "AKTIV" : s === "cancelled" ? "GEKÜNDIGT" : "ABGELAUFEN";
  const contractStatusColor = (s: string) =>
    s === "active" ? colors.success : s === "cancelled" ? colors.error : colors.warning;

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
        if (invoices.length === 0) return renderEmpty("Keine Rechnungen", "chart.bar.fill");
        if (!isWide) {
          return (
            <View className="gap-3">
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
                    <Text className="text-base font-semibold text-foreground flex-1" numberOfLines={1}>{c.title}</Text>
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
                <Text className="text-sm text-foreground flex-1" numberOfLines={1}>{c.title}</Text>
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
                    <Text className="font-semibold text-center text-sm" style={{ color: "#111" }}>Speichern</Text>
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
                        <TouchableOpacity
                          onPress={() => showConfirm("Kontakt löschen", "Diesen Kontakt wirklich löschen?", () => deleteContactMutation.mutate(contact.id), "Löschen")}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <IconSymbol name="trash.fill" size={14} color={colors.error} />
                        </TouchableOpacity>
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
              <View className="flex-row px-4 py-3 border-b border-border">
                <Text className="text-[10px] font-semibold text-muted uppercase flex-1">Name</Text>
                <Text className="text-[10px] font-semibold text-muted uppercase" style={{ width: 140 }}>E-Mail</Text>
                <Text className="text-[10px] font-semibold text-muted uppercase" style={{ width: 120 }}>Telefon</Text>
                <Text className="text-[10px] font-semibold text-muted uppercase" style={{ width: 120 }}>Position</Text>
                <View style={{ width: 30 }} />
              </View>
              {allContacts.map((contact: any, idx: number) => (
                <View key={contact.id || idx} className="flex-row items-center px-4 py-3 border-b border-border">
                  <Text className="text-sm text-foreground flex-1">
                    {`${contact.first_name || ""} ${contact.last_name || ""}`.trim() || "—"}
                  </Text>
                  <Text className="text-xs text-muted" style={{ width: 140 }} numberOfLines={1}>{contact.email || "—"}</Text>
                  <Text className="text-xs text-muted" style={{ width: 120 }}>{contact.phone || "—"}</Text>
                  <Text className="text-xs text-muted" style={{ width: 120 }}>{contact.position || "—"}</Text>
                  <View style={{ width: 30, alignItems: "center" }}>
                    {contact.id !== "legacy" && (
                      <TouchableOpacity
                        onPress={() => showConfirm("Kontakt löschen", "Diesen Kontakt wirklich löschen?", () => deleteContactMutation.mutate(contact.id), "Löschen")}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <IconSymbol name="trash.fill" size={14} color={colors.error} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
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
                onPress={() => router.back()}
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
                        className="w-14 h-14 rounded-xl mr-4"
                        style={{ backgroundColor: colors.border }}
                        resizeMode="contain"
                      />
                    ) : (
                      <View
                        className="w-14 h-14 rounded-xl items-center justify-center mr-4"
                        style={{ backgroundColor: colors.primary }}
                      >
                        <Text className="text-2xl font-bold" style={{ color: "#111" }}>
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
                        {customer?.industry && (
                          <View
                            className="px-2 py-0.5 rounded"
                            style={{ backgroundColor: colors.primary + "20" }}
                          >
                            <Text className="text-[10px] font-bold" style={{ color: colors.primary }}>
                              {customer.industry.toUpperCase()}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Contact Info Row */}
                      <View className="flex-row items-center flex-wrap gap-3">
                        {customer?.website && (
                          <TouchableOpacity
                            className="flex-row items-center gap-1"
                            onPress={() => Linking.openURL(customer.website.startsWith("http") ? customer.website : `https://${customer.website}`)}
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
                          <View className="flex-row items-center gap-1">
                            <IconSymbol name="mappin.circle.fill" size={12} color={colors.muted} />
                            <Text className="text-xs text-muted">
                              {[customer?.address, [customer?.postal_code, customer?.city].filter(Boolean).join(" "), customer?.country].filter(Boolean).join(", ")}
                            </Text>
                          </View>
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
                >
                  <Text className="text-sm font-semibold" style={{ color: "#111" }}>+ Neues Ticket</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-row items-center gap-1.5 bg-surface border border-border px-4 py-2 rounded-lg"
                  activeOpacity={0.8}
                  onPress={() => router.push(`/quote/new?customer_id=${id}`)}
                >
                  <Text className="text-sm font-semibold text-foreground">+ Neue Offerte</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-row items-center gap-1.5 bg-surface border border-border px-4 py-2 rounded-lg"
                  activeOpacity={0.8}
                  onPress={() => setEditingContract({ customer_id: id })}
                >
                  <Text className="text-sm font-semibold text-foreground">+ Neuer Vertrag</Text>
                </TouchableOpacity>
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
      {selectedContract && !selectedContract.customer_id && (
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
          contract={editingContract.customer_id ? undefined : editingContract}
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
    </>
  );
}

import { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Linking,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { formatDate, formatDateTime, formatCurrency, getInvoiceTotal } from "@/lib/format";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Data from "@/lib/data";

type TicketStatus = "open" | "in_progress" | "waiting" | "closed";
type TicketPriority = "low" | "medium" | "high" | "urgent";

interface Ticket {
  id: number;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  created_at: string;
  description: string;
}

interface TicketComment {
  id: number;
  user_name: string;
  comment: string;
  created_at: string;
  is_internal: boolean;
  is_system: boolean;
}

type PortalSection = "tickets" | "invoices" | "contracts" | "quotes" | "documents" | "profile";

export default function PortalTicketsScreen() {
  const colors = useColors();
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [filter, setFilter] = useState<"all" | TicketStatus>("all");
  const [section, setSection] = useState<PortalSection>("tickets");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [portalUserId, setPortalUserId] = useState<string | null>(null);
  const { ticketId } = useLocalSearchParams();

  const [portalUserName, setPortalUserName] = useState("Kunde");

  useEffect(() => {
    Data.supabase.auth.getSession().then(({ data: { session } }: { data: { session: any } }) => {
      if (session?.user?.id) {
        setPortalUserId(session.user.id);
      }
      if (session?.user?.user_metadata?.customer_id) {
        setCustomerId(session.user.user_metadata.customer_id);
      }
      const meta = session?.user?.user_metadata || {};
      const name = `${meta.first_name || ""} ${meta.last_name || ""}`.trim();
      if (name) setPortalUserName(name);
      else if (session?.user?.email) setPortalUserName(session.user.email);
    });
  }, []);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["portalTickets", customerId],
    queryFn: () => Data.getPortalTickets(customerId!),
    enabled: !!customerId,
  });

  useEffect(() => {
    if (ticketId && tickets.length > 0) {
      const foundTicket = tickets.find((t: Ticket) => t.id.toString() === ticketId.toString());
      if (foundTicket && selectedTicket?.id !== foundTicket.id) {
        setSelectedTicket(foundTicket);
      }
    }
  }, [ticketId, tickets]);

  const { data: invoices = [] } = useQuery({
    queryKey: ["portalInvoices", customerId],
    queryFn: () => Data.getCustomerInvoices(customerId!),
    enabled: !!customerId,
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ["portalContracts", customerId],
    queryFn: () => Data.getCustomerContracts(customerId!),
    enabled: !!customerId,
  });

  // Entwürfe und stornierte Rechnungen gehören nicht ins Kundenportal
  const visibleInvoices = invoices.filter(
    (inv: any) => inv.status !== "draft" && inv.status !== "cancelled"
  );

  const { data: quotes = [] } = useQuery({
    queryKey: ["portalQuotes", customerId],
    queryFn: () => Data.getCustomerQuotes(customerId!),
    enabled: !!customerId,
  });
  // Nur versendete/beantwortete Angebote zeigen, keine Entwürfe
  const visibleQuotes = quotes.filter((q: any) => q.status !== "draft");

  const { data: sharedDocNames = [] } = useQuery({
    queryKey: ["portalSharedDocs", customerId],
    queryFn: () => Data.getSharedDocumentNames(customerId!),
    enabled: !!customerId,
  });

  const { data: maintenance = [] } = useQuery({
    queryKey: ["portalMaintenance", customerId],
    queryFn: () => Data.getPortalMaintenanceWindows(customerId!),
    enabled: !!customerId,
  });

  const { data: assets = [] } = useQuery({
    queryKey: ["portalAssets", customerId],
    queryFn: () => Data.getCustomerAssets(customerId!),
    enabled: !!customerId,
  });

  const { data: customerData } = useQuery({
    queryKey: ["portalCustomer", customerId],
    queryFn: () => Data.getCustomerById(customerId!),
    enabled: !!customerId,
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["unreadPortalNotifications", portalUserId],
    queryFn: async () => {
      const { count, error } = await Data.supabase
        .from("notifications")
        .select('*', { count: 'exact', head: true })
        .eq("customer_portal_user_id", portalUserId)
        .eq("is_read", false);
      if (error) throw new Error(error.message);
      return count || 0;
    },
    enabled: !!portalUserId,
    refetchInterval: 30000, // Poll every 30s
  });

  const getStatusLabel = (status: TicketStatus) => {
    const labels: Record<TicketStatus, string> = {
      open: "Offen",
      in_progress: "In Bearbeitung",
      waiting: "Wartend",
      closed: "Geschlossen",
    };
    return labels[status];
  };

  const getStatusColor = (status: TicketStatus) => {
    const colorMap: Record<TicketStatus, string> = {
      open: colors.error,
      in_progress: colors.primary,
      waiting: colors.warning,
      closed: colors.success,
    };
    return colorMap[status];
  };

  const getPriorityLabel = (priority: TicketPriority) => {
    const labels: Record<TicketPriority, string> = {
      low: "Niedrig",
      medium: "Mittel",
      high: "Hoch",
      urgent: "Dringend",
    };
    return labels[priority];
  };

  const getPriorityColor = (priority: TicketPriority) => {
    const colorMap: Record<TicketPriority, string> = {
      low: colors.success,
      medium: colors.warning,
      high: colors.error,
      urgent: "#DC143C",
    };
    return colorMap[priority];
  };

  const filteredTickets =
    filter === "all" ? tickets : tickets.filter((t: Ticket) => t.status === filter);

  const renderTicketItem = ({ item }: { item: Ticket }) => (
    <TouchableOpacity
      onPress={() => setSelectedTicket(item)}
      className="bg-surface p-4 rounded-lg border border-border mb-3"
      activeOpacity={0.7}
    >
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-base font-semibold text-foreground flex-1">
          {item.title}
        </Text>
        <View
          style={{ backgroundColor: getPriorityColor(item.priority) + "20" }}
          className="px-2 py-1 rounded ml-2"
        >
          <Text
            style={{ color: getPriorityColor(item.priority) }}
            className="text-xs font-semibold"
          >
            {getPriorityLabel(item.priority)}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center justify-between">
        <View
          style={{ backgroundColor: getStatusColor(item.status) + "20" }}
          className="px-3 py-1 rounded-full"
        >
          <Text
            style={{ color: getStatusColor(item.status) }}
            className="text-xs font-semibold"
          >
            {getStatusLabel(item.status)}
          </Text>
        </View>
        <Text className="text-sm text-muted">{formatDate(item.created_at)}</Text>
      </View>
    </TouchableOpacity>
  );

  // ── Rechnungen ──
  const invoiceStatusLabel = (s: string) =>
    s === "open" ? "Offen" : s === "sent" ? "Versendet" : s === "paid" ? "Bezahlt" : s === "overdue" ? "Überfällig" : s;
  const invoiceStatusColor = (s: string) =>
    s === "paid" ? colors.success : s === "overdue" ? colors.error : s === "sent" ? "#06b6d4" : colors.primary;

  const handlePayInvoice = (invoiceId: string) => {
    const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
    if (!baseUrl) return;
    Linking.openURL(`${baseUrl}/functions/v1/invoice-payment?id=${invoiceId}`);
  };

  const renderInvoiceItem = ({ item }: { item: any }) => {
    const total = getInvoiceTotal(item);
    const payable = item.status === "open" || item.status === "sent" || item.status === "overdue";
    return (
      <View className="bg-surface p-4 rounded-lg border border-border mb-3">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-base font-semibold text-foreground flex-1">
            Rechnung {item.invoice_number}
          </Text>
          <View
            style={{ backgroundColor: invoiceStatusColor(item.status) + "20" }}
            className="px-3 py-1 rounded-full ml-2"
          >
            <Text
              style={{ color: invoiceStatusColor(item.status) }}
              className="text-xs font-semibold"
            >
              {invoiceStatusLabel(item.status)}
            </Text>
          </View>
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-muted">
            {formatDate(item.invoice_date)}
            {item.due_date ? ` · fällig ${formatDate(item.due_date)}` : ""}
          </Text>
          <Text className="text-base font-bold text-foreground">{formatCurrency(total)}</Text>
        </View>
        {payable ? (
          <TouchableOpacity
            className="bg-primary py-2.5 rounded-lg mt-3 flex-row items-center justify-center gap-2"
            onPress={() => handlePayInvoice(item.id)}
            activeOpacity={0.8}
          >
            <IconSymbol name="creditcard.fill" size={16} color={colors.background} />
            <Text className="text-background font-semibold">Online bezahlen</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  // ── Verträge ──
  const contractStatusLabel = (s: string) =>
    s === "active" ? "Aktiv" : s === "cancelled" ? "Gekündigt" : "Abgelaufen";
  const contractStatusColor = (s: string) =>
    s === "active" ? colors.success : s === "cancelled" ? colors.error : colors.warning;

  const renderContractItem = ({ item }: { item: any }) => (
    <View className="bg-surface p-4 rounded-lg border border-border mb-3">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-base font-semibold text-foreground flex-1">
          {item.title || item.contract_number || "Vertrag"}
        </Text>
        <View
          style={{ backgroundColor: contractStatusColor(item.status) + "20" }}
          className="px-3 py-1 rounded-full ml-2"
        >
          <Text
            style={{ color: contractStatusColor(item.status) }}
            className="text-xs font-semibold"
          >
            {contractStatusLabel(item.status)}
          </Text>
        </View>
      </View>
      {item.contract_number && item.title ? (
        <Text className="text-xs text-muted mb-1">{item.contract_number}</Text>
      ) : null}
      <View className="flex-row items-center justify-between">
        <Text className="text-sm text-muted">
          {item.start_date ? `Seit ${formatDate(item.start_date)}` : ""}
          {item.end_date ? ` · bis ${formatDate(item.end_date)}` : ""}
        </Text>
        {item.annual_amount || item.amount ? (
          <Text className="text-base font-bold text-foreground">
            {formatCurrency(Number(item.annual_amount || item.amount))} / Jahr
          </Text>
        ) : null}
      </View>
    </View>
  );

  // ── Angebote ──
  const quoteStatusLabel = (s: string) =>
    s === "sent" ? "Offen" : s === "opened" ? "Offen" : s === "accepted" ? "Angenommen" : s === "declined" ? "Abgelehnt" : s === "expired" ? "Abgelaufen" : s;
  const quoteStatusColor = (s: string) =>
    s === "accepted" ? colors.success : s === "declined" ? colors.error : s === "expired" ? colors.warning : colors.primary;

  const renderQuoteItem = ({ item }: { item: any }) => {
    const open = item.status === "sent" || item.status === "opened";
    return (
      <View className="bg-surface p-4 rounded-lg border border-border mb-3">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-base font-semibold text-foreground flex-1">
            Angebot {item.quote_number}
          </Text>
          <View
            style={{ backgroundColor: quoteStatusColor(item.status) + "20" }}
            className="px-3 py-1 rounded-full ml-2"
          >
            <Text style={{ color: quoteStatusColor(item.status) }} className="text-xs font-semibold">
              {quoteStatusLabel(item.status)}
            </Text>
          </View>
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-muted">
            {formatDate(item.quote_date)}
            {item.valid_until ? ` · gültig bis ${formatDate(item.valid_until)}` : ""}
          </Text>
          <Text className="text-base font-bold text-foreground">{formatCurrency(item.total || 0)}</Text>
        </View>
        {open ? (
          <TouchableOpacity
            className="bg-primary py-2.5 rounded-lg mt-3 flex-row items-center justify-center gap-2"
            onPress={() => Linking.openURL(`https://angebote.gross-ict.ch/?id=${item.id}`)}
            activeOpacity={0.8}
          >
            <IconSymbol name="doc.on.doc.fill" size={16} color={colors.background} />
            <Text className="text-background font-semibold">Ansehen & antworten</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  const handleLogout = async () => {
    await Data.supabase.auth.signOut();
    await AsyncStorage.removeItem("isCustomerLoggedIn");
    await AsyncStorage.removeItem("customerEmail");
    await AsyncStorage.removeItem("customer_portal_user");
    router.replace("/portal-login-customer");
  };

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View className="flex-1">
        {/* Header */}
        <View className="p-4 border-b border-border">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-2xl font-bold text-foreground">
              Kundenportal
            </Text>
            <View className="flex-row items-center gap-4">
              <TouchableOpacity
                onPress={() => router.push("/portal-notifications")}
                className="relative"
                activeOpacity={0.7}
              >
                <IconSymbol name="bell.fill" size={24} color={colors.foreground} />
                {unreadCount > 0 && (
                  <View className="absolute -top-1 -right-1 bg-primary rounded-full min-w-[16px] h-4 items-center justify-center px-1">
                    <Text className="text-[10px] font-bold text-background leading-none">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleLogout}
                className="flex-row items-center gap-2"
                activeOpacity={0.7}
              >
                <IconSymbol name="xmark.circle.fill" size={24} color={colors.muted} />
                <Text className="text-sm text-muted">Abmelden</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Wartungsfenster-Ankündigungen */}
          {(maintenance as any[]).length > 0 ? (
            <View
              className="rounded-xl border p-3 mb-3"
              style={{ backgroundColor: "#F59E0B15", borderColor: "#F59E0B50" }}
            >
              <View className="flex-row items-center gap-2 mb-1">
                <IconSymbol name="wrench.fill" size={14} color="#F59E0B" />
                <Text className="text-sm font-bold text-foreground">Geplante Wartung</Text>
              </View>
              {(maintenance as any[]).slice(0, 3).map((w: any) => (
                <Text key={w.id} className="text-xs text-foreground mt-0.5">
                  {w.title}: {new Date(w.starts_at).toLocaleString("de-CH", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  {" – "}
                  {new Date(w.ends_at).toLocaleString("de-CH", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  {w.description ? ` · ${w.description}` : ""}
                </Text>
              ))}
            </View>
          ) : null}

          {/* Bereichswahl */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
            <View className="flex-row bg-surface border border-border rounded-xl overflow-hidden">
              {([
                { key: "tickets", label: "Tickets", icon: "ticket.fill" },
                { key: "invoices", label: "Rechnungen", icon: "doc.text.fill" },
                { key: "contracts", label: "Verträge", icon: "doc.badge.clock.fill" },
                { key: "quotes", label: "Angebote", icon: "doc.on.doc.fill" },
                { key: "documents", label: "Dokumente", icon: "folder.fill" },
                { key: "profile", label: "Profil", icon: "person.2.fill" },
              ] as { key: PortalSection; label: string; icon: any }[]).map((s) => (
                <TouchableOpacity
                  key={s.key}
                  className="flex-row items-center justify-center gap-1.5 py-2.5 px-3"
                  style={{ backgroundColor: section === s.key ? colors.primary : "transparent" }}
                  onPress={() => setSection(s.key)}
                  activeOpacity={0.7}
                >
                  <IconSymbol
                    name={s.icon}
                    size={14}
                    color={section === s.key ? colors.background : colors.muted}
                  />
                  <Text
                    className="text-xs font-semibold"
                    style={{ color: section === s.key ? colors.background : colors.foreground }}
                  >
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Filter (nur für Tickets) */}
          {section === "tickets" ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="flex-row gap-2"
          >
            {["all", "open", "in_progress", "waiting", "closed"].map((status) => (
              <TouchableOpacity
                key={status}
                onPress={() => setFilter(status as typeof filter)}
                style={{
                  backgroundColor:
                    filter === status ? colors.primary : colors.surface,
                  borderColor: filter === status ? colors.primary : colors.border,
                }}
                className="px-4 py-2 rounded-lg border"
                activeOpacity={0.7}
              >
                <Text
                  style={{
                    color: filter === status ? colors.background : colors.foreground,
                  }}
                  className="text-sm font-semibold"
                >
                  {status === "all"
                    ? "Alle"
                    : getStatusLabel(status as TicketStatus)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          ) : null}
        </View>

        {/* Inhalt je Bereich */}
        <View className="flex-1 p-4">
          {section === "tickets" ? (
            filteredTickets.length > 0 ? (
              <FlatList
                data={filteredTickets}
                renderItem={renderTicketItem}
                keyExtractor={(item) => item.id.toString()}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <View className="flex-1 items-center justify-center">
                <IconSymbol name="ticket.fill" size={48} color={colors.muted} />
                <Text className="text-lg text-muted mt-4">Keine Tickets</Text>
                <Text className="text-sm text-muted text-center mt-2">
                  {filter === "all"
                    ? "Sie haben noch keine Tickets"
                    : `Keine Tickets mit Status "${getStatusLabel(filter as TicketStatus)}"`}
                </Text>
              </View>
            )
          ) : section === "invoices" ? (
            visibleInvoices.length > 0 ? (
              <FlatList
                data={visibleInvoices}
                renderItem={renderInvoiceItem}
                keyExtractor={(item: any) => String(item.id)}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <View className="flex-1 items-center justify-center">
                <IconSymbol name="doc.text.fill" size={48} color={colors.muted} />
                <Text className="text-lg text-muted mt-4">Keine Rechnungen</Text>
                <Text className="text-sm text-muted text-center mt-2">
                  Es sind noch keine Rechnungen vorhanden.
                </Text>
              </View>
            )
          ) : section === "contracts" ? (
            contracts.length > 0 ? (
              <FlatList
                data={contracts}
                renderItem={renderContractItem}
                keyExtractor={(item: any) => String(item.id)}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <View className="flex-1 items-center justify-center">
                <IconSymbol name="doc.badge.clock.fill" size={48} color={colors.muted} />
                <Text className="text-lg text-muted mt-4">Keine Verträge</Text>
                <Text className="text-sm text-muted text-center mt-2">
                  Es sind noch keine Verträge vorhanden.
                </Text>
              </View>
            )
          ) : section === "quotes" ? (
            visibleQuotes.length > 0 ? (
              <FlatList
                data={visibleQuotes}
                renderItem={renderQuoteItem}
                keyExtractor={(item: any) => String(item.id)}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <View className="flex-1 items-center justify-center">
                <IconSymbol name="doc.on.doc.fill" size={48} color={colors.muted} />
                <Text className="text-lg text-muted mt-4">Keine Angebote</Text>
                <Text className="text-sm text-muted text-center mt-2">
                  Es liegen keine Angebote vor.
                </Text>
              </View>
            )
          ) : section === "documents" ? (
            (sharedDocNames as string[]).length > 0 ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                {(sharedDocNames as string[]).map((name) => (
                  <TouchableOpacity
                    key={name}
                    className="bg-surface p-4 rounded-lg border border-border mb-3 flex-row items-center gap-3"
                    activeOpacity={0.7}
                    onPress={async () => {
                      try {
                        const url = await Data.getCustomerDocumentUrl(customerId!, name);
                        Linking.openURL(url);
                      } catch (e: any) {
                        console.error("Dokument konnte nicht geöffnet werden:", e.message);
                      }
                    }}
                  >
                    <IconSymbol name="doc.text.fill" size={22} color={colors.primary} />
                    <Text className="text-sm font-semibold text-foreground flex-1" numberOfLines={2}>
                      {name.replace(/^\d+_/, "")}
                    </Text>
                    <IconSymbol name="square.and.arrow.up" size={16} color={colors.muted} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View className="flex-1 items-center justify-center">
                <IconSymbol name="folder.fill" size={48} color={colors.muted} />
                <Text className="text-lg text-muted mt-4">Keine Dokumente</Text>
                <Text className="text-sm text-muted text-center mt-2">
                  Es wurden noch keine Dokumente für Sie freigegeben.
                </Text>
              </View>
            )
          ) : (
            <ProfileSection
              customerId={customerId!}
              customerData={customerData}
              assets={assets as any[]}
              portalUserName={portalUserName}
              colors={colors}
            />
          )}
        </View>
      </View>

      {/* Ticket-Details Modal */}
      {selectedTicket && (
        <TicketDetailsModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
        />
      )}
    </ScreenContainer>
  );
}

// Ticket-Details Modal (nur externe Kommentare sichtbar)
function TicketDetailsModal({
  ticket,
  onClose,
}: {
  ticket: Ticket;
  onClose: () => void;
}) {
  const colors = useColors();
  const [newComment, setNewComment] = useState("");
  const queryClient = useQueryClient();

  const { data: comments = [], isLoading: isLoadingComments } = useQuery({
    queryKey: ["portalTicketComments", ticket.id],
    queryFn: () => Data.getPortalTicketComments(ticket.id),
  });

  const [customerName, setCustomerName] = useState("Kunde");
  useEffect(() => {
    Data.supabase.auth.getSession().then(({ data: { session } }: { data: { session: any } }) => {
      if (session?.user?.user_metadata) {
        const { first_name, last_name } = session.user.user_metadata;
        if (first_name || last_name) {
          setCustomerName(`${first_name || ""} ${last_name || ""}`.trim());
        }
      }
    });
  }, []);

  const addCommentMutation = useMutation({
    mutationFn: () => Data.addPortalTicketComment(ticket.id, newComment, customerName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portalTicketComments", ticket.id] });
      setNewComment("");
    }
  });

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    addCommentMutation.mutate();
  };

  const getStatusLabel = (status: TicketStatus) => {
    const labels: Record<TicketStatus, string> = {
      open: "Offen",
      in_progress: "In Bearbeitung",
      waiting: "Wartend",
      closed: "Geschlossen",
    };
    return labels[status];
  };

  const getStatusColor = (status: TicketStatus) => {
    const colorMap: Record<TicketStatus, string> = {
      open: colors.error,
      in_progress: colors.primary,
      waiting: colors.warning,
      closed: colors.success,
    };
    return colorMap[status];
  };

  const getPriorityLabel = (priority: TicketPriority) => {
    const labels: Record<TicketPriority, string> = {
      low: "Niedrig",
      medium: "Mittel",
      high: "Hoch",
      urgent: "Dringend",
    };
    return labels[priority];
  };

  const getPriorityColor = (priority: TicketPriority) => {
    const colorMap: Record<TicketPriority, string> = {
      low: colors.success,
      medium: colors.warning,
      high: colors.error,
      urgent: "#DC143C",
    };
    return colorMap[priority];
  };

  return (
    <Modal visible={true} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-background rounded-t-3xl" style={{ maxHeight: "90%" }}>
          {/* Header */}
          <View className="flex-row items-center justify-between p-4 border-b border-border">
            <Text className="text-2xl font-bold text-foreground">Ticket-Details</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView className="p-4" showsVerticalScrollIndicator={false}>
            <View className="gap-4">
              <View>
                <Text className="text-sm text-muted mb-1">Titel</Text>
                <Text className="text-lg font-semibold text-foreground">{ticket.title}</Text>
              </View>

              <View>
                <Text className="text-sm text-muted mb-1">Beschreibung</Text>
                <Text className="text-base text-foreground">{ticket.description}</Text>
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-sm text-muted mb-1">Status</Text>
                  <View
                    className="px-3 py-2 rounded-lg"
                    style={{ backgroundColor: getStatusColor(ticket.status) + "20" }}
                  >
                    <Text
                      className="text-sm font-semibold text-center"
                      style={{ color: getStatusColor(ticket.status) }}
                    >
                      {getStatusLabel(ticket.status)}
                    </Text>
                  </View>
                </View>
                <View className="flex-1">
                  <Text className="text-sm text-muted mb-1">Priorität</Text>
                  <View
                    className="px-3 py-2 rounded-lg"
                    style={{ backgroundColor: getPriorityColor(ticket.priority) + "20" }}
                  >
                    <Text
                      className="text-sm font-semibold text-center"
                      style={{ color: getPriorityColor(ticket.priority) }}
                    >
                      {getPriorityLabel(ticket.priority)}
                    </Text>
                  </View>
                </View>
              </View>

              <View>
                <Text className="text-sm text-muted mb-1">Erstellt am</Text>
                <Text className="text-base text-foreground">{formatDate(ticket.created_at)}</Text>
              </View>
            </View>

            {/* Kommunikation */}
            <View className="mt-6">
              <Text className="text-lg font-bold text-foreground mb-3">Kommunikation</Text>

              {isLoadingComments ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <ScrollView className="max-h-64 mb-4" showsVerticalScrollIndicator={false}>
                  {comments.map((comment: TicketComment) => (
                    <View
                      key={comment.id}
                      className={`mb-3 p-3 rounded-lg ${comment.is_system ? "bg-surface" : "bg-primary/10"
                        }`}
                    >
                      <View className="flex-row items-center justify-between mb-1">
                        <Text
                          className={`text-xs font-semibold ${comment.is_system ? "text-muted" : "text-primary"
                            }`}
                        >
                          {comment.user_name || "System"}
                        </Text>
                        <Text className="text-xs text-muted">
                          {formatDateTime(comment.created_at)}
                        </Text>
                      </View>
                      <Text className="text-sm text-foreground">{comment.comment}</Text>
                    </View>
                  ))}
                </ScrollView>
              )}

              {/* Kommentar hinzufügen */}
              <View className="gap-2">
                <TextInput
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="Antwort schreiben..."
                  placeholderTextColor={colors.muted}
                  multiline
                  numberOfLines={2}
                  textAlignVertical="top"
                  value={newComment}
                  onChangeText={setNewComment}
                  editable={!addCommentMutation.isPending}
                />
                <TouchableOpacity
                  className="bg-primary py-2 rounded-lg"
                  onPress={handleAddComment}
                  disabled={addCommentMutation.isPending || !newComment.trim()}
                  style={{ opacity: addCommentMutation.isPending || !newComment.trim() ? 0.7 : 1 }}
                  activeOpacity={0.8}
                >
                  <Text className="text-background font-semibold text-center">
                    {addCommentMutation.isPending ? "Wird gesendet..." : "Antwort senden"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Profil: Stammdaten-Selfservice + Geräte/Lizenzen ──
function ProfileSection({
  customerId,
  customerData,
  assets,
  portalUserName,
  colors,
}: {
  customerId: string;
  customerData: any;
  assets: any[];
  portalUserName: string;
  colors: any;
}) {
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (customerData) {
      setAddress(customerData.address || "");
      setPostalCode(customerData.postal_code || "");
      setCity(customerData.city || "");
      setPhone(customerData.phone || "");
      setEmail(customerData.email || "");
    }
  }, [customerData]);

  const handleSubmit = async () => {
    if (!customerData) return;
    const changes: Record<string, any> = {};
    if (address !== (customerData.address || "")) changes.address = address;
    if (postalCode !== (customerData.postal_code || "")) changes.postal_code = postalCode;
    if (city !== (customerData.city || "")) changes.city = city;
    if (phone !== (customerData.phone || "")) changes.phone = phone;
    if (email !== (customerData.email || "")) changes.email = email;
    if (Object.keys(changes).length === 0) return;

    setSubmitting(true);
    try {
      await Data.createChangeRequest(customerId, portalUserName, changes);
      setSubmitted(true);
    } catch (e: any) {
      console.error("Änderungsantrag fehlgeschlagen:", e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "bg-surface border border-border rounded-lg px-4 py-3 text-foreground mb-2";

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text className="text-lg font-bold text-foreground mb-2">Ihre Stammdaten</Text>
      <Text className="text-xs text-muted mb-3">
        Änderungen werden an Gross ICT übermittelt und nach Prüfung übernommen.
      </Text>

      <Text className="text-xs font-semibold text-muted mb-1">Adresse</Text>
      <TextInput value={address} onChangeText={setAddress} className={inputClass} placeholder="Strasse Nr." placeholderTextColor={colors.muted} />
      <View className="flex-row gap-2">
        <View style={{ width: 110 }}>
          <Text className="text-xs font-semibold text-muted mb-1">PLZ</Text>
          <TextInput value={postalCode} onChangeText={setPostalCode} className={inputClass} placeholder="PLZ" placeholderTextColor={colors.muted} keyboardType="number-pad" />
        </View>
        <View className="flex-1">
          <Text className="text-xs font-semibold text-muted mb-1">Ort</Text>
          <TextInput value={city} onChangeText={setCity} className={inputClass} placeholder="Ort" placeholderTextColor={colors.muted} />
        </View>
      </View>
      <Text className="text-xs font-semibold text-muted mb-1">Telefon</Text>
      <TextInput value={phone} onChangeText={setPhone} className={inputClass} placeholder="Telefon" placeholderTextColor={colors.muted} keyboardType="phone-pad" />
      <Text className="text-xs font-semibold text-muted mb-1">E-Mail</Text>
      <TextInput value={email} onChangeText={setEmail} className={inputClass} placeholder="E-Mail" placeholderTextColor={colors.muted} keyboardType="email-address" autoCapitalize="none" />

      {submitted ? (
        <View className="rounded-lg p-3 mt-1 mb-4" style={{ backgroundColor: colors.success + "15", borderWidth: 1, borderColor: colors.success + "40" }}>
          <Text className="text-sm font-semibold" style={{ color: colors.success }}>
            Änderungsantrag übermittelt – wir prüfen die Angaben und melden uns bei Rückfragen.
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          className="bg-primary py-3 rounded-lg mt-1 mb-4"
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <Text className="text-background font-semibold text-center">Änderung beantragen</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Geräte & Lizenzen */}
      <Text className="text-lg font-bold text-foreground mb-2">Geräte & Lizenzen</Text>
      {assets.length === 0 ? (
        <Text className="text-sm text-muted mb-6">Noch keine Geräte oder Lizenzen hinterlegt.</Text>
      ) : (
        assets.map((a: any) => {
          const expired = a.expires_at && a.expires_at < new Date().toISOString().split("T")[0];
          const soon = !expired && a.expires_at && new Date(a.expires_at).getTime() - Date.now() < 30 * 86400000;
          return (
            <View key={a.id} className="bg-surface p-3 rounded-lg border border-border mb-2 flex-row items-center gap-3">
              <IconSymbol
                name={a.type === "license" ? "key.fill" : "desktopcomputer"}
                size={20}
                color={expired ? colors.error : soon ? colors.warning : colors.primary}
              />
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground">{a.name}</Text>
                <Text className="text-xs text-muted">
                  {a.type === "license" ? "Lizenz" : "Gerät"}
                  {a.serial_number ? ` · SN ${a.serial_number}` : ""}
                  {a.expires_at ? ` · ${a.type === "license" ? "läuft ab" : "Garantie bis"} ${formatDate(a.expires_at)}` : ""}
                </Text>
                {expired ? (
                  <Text className="text-xs font-semibold" style={{ color: colors.error }}>Abgelaufen</Text>
                ) : soon ? (
                  <Text className="text-xs font-semibold" style={{ color: colors.warning }}>Läuft bald ab</Text>
                ) : null}
              </View>
            </View>
          );
        })
      )}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

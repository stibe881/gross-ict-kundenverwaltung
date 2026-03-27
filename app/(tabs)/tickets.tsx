import React, { useState, useEffect } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Switch,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  KeyboardAvoidingView,
  RefreshControl,
} from "react-native";
import { useGlobalRefresh } from "@/hooks/use-global-refresh";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { TicketFormModal } from "@/components/ticket-form-modal";
import { formatDate, formatDateTime } from "@/lib/format";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { showAlert, showConfirm } from "@/lib/alert";
import { showToast } from "@/components/toast-provider";

type TicketStatus = "open" | "in_progress" | "waiting" | "closed";
type TicketPriority = "low" | "medium" | "high";

export default function TicketsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { isWide, containerStyle, contentPadding } = useResponsiveLayout();
  const queryClient = useQueryClient();
  const { refreshing, onRefresh } = useGlobalRefresh();
  const [filter, setFilter] = useState<"all" | TicketStatus>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("unassigned");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

  const { ticketId } = useLocalSearchParams();
  const [currentUserName, setCurrentUserName] = useState("Admin");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const hasInitializedFilter = React.useRef(false);

  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width > 900;

  // Mitarbeitende laden für Filter
  const { data: allUsers = [] } = useQuery({
    queryKey: ["users"],
    queryFn: Data.getAllUsers,
  });

  // Aktuellen Benutzer-Namen laden
  useEffect(() => {
    Data.supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setCurrentUserId(session.user.id);
        const name = session.user.user_metadata?.full_name
          || session.user.user_metadata?.name
          || `${session.user.user_metadata?.first_name || ''} ${session.user.user_metadata?.last_name || ''}`.trim()
          || session.user.email?.split('@')[0]
          || 'Admin';
        setCurrentUserName(name);
      }
    });
  }, []);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["tickets"],
    queryFn: Data.getAllTickets,
    refetchInterval: 5000, // Automatischer Refresh alle 5 Sekunden
  });

  useEffect(() => {
    if (ticketId && tickets.length > 0) {
      const foundTicket = tickets.find((t: any) => t.id === ticketId);
      if (foundTicket && selectedTicket?.id !== foundTicket.id) {
        setSelectedTicket(foundTicket);
      }
    }
  }, [ticketId, tickets]);



  const deleteTicketMutation = useMutation({
    mutationFn: (ticketId: string) => Data.deleteTicket(ticketId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["customer"] });
      showToast("Ticket erfolgreich gelöscht");
    },
    onError: (error: any) => {
      showAlert("Fehler", `Ticket konnte nicht gelöscht werden: ${error.message}`);
    },
  });

  const handleDeleteTicket = (ticketId: string, event: any) => {
    event.stopPropagation();
    showConfirm(
      "Ticket löschen",
      "Möchten Sie dieses Ticket wirklich unwiderruflich löschen?",
      () => deleteTicketMutation.mutate(ticketId),
      "Löschen"
    );
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
    };
    return labels[priority];
  };

  const getPriorityColor = (priority: TicketPriority) => {
    const colorMap: Record<TicketPriority, string> = {
      low: "#6C757D",
      medium: colors.primary,
      high: colors.error,
    };
    return colorMap[priority];
  };

  const getCustomerName = (item: any) =>
    item.customer?.company_name || `${item.customer?.first_name || ''} ${item.customer?.last_name || ''}`.trim() || 'Unbekannt';

  const getAssigneeName = (item: any) => {
    if (!item.assigned_to) return null;
    const user = allUsers.find((u: any) => u.id === item.assigned_to);
    return user?.name || null;
  };

  const filteredTickets = tickets
    .filter((t) => filter === "all" || t.status === filter)
    .filter((t) => {
      if (assigneeFilter === "all") return true;
      if (assigneeFilter === "unassigned") return !t.assigned_to;
      return t.assigned_to === assigneeFilter;
    })
    .filter((t) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        t.title?.toLowerCase().includes(q) ||
        getCustomerName(t).toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q)
      );
    });

  // Apply sorting
  if (sortConfig !== null) {
    filteredTickets.sort((a, b) => {
      let valA: string | number = "";
      let valB: string | number = "";

      switch (sortConfig.key) {
        case "prio":
          // map priorities for sorting
          const mapPrio = { low: 1, medium: 2, high: 3 } as any;
          valA = mapPrio[a.priority] || 0;
          valB = mapPrio[b.priority] || 0;
          break;
        case "titel":
          valA = a.title?.toLowerCase() || "";
          valB = b.title?.toLowerCase() || "";
          break;
        case "kunde":
          valA = getCustomerName(a).toLowerCase();
          valB = getCustomerName(b).toLowerCase();
          break;
        case "status":
          // map status for sorting
          const mapStatus = { open: 1, in_progress: 2, waiting: 3, closed: 4 } as any;
          valA = mapStatus[a.status] || 0;
          valB = mapStatus[b.status] || 0;
          break;
        case "zugewiesen":
          valA = getAssigneeName(a)?.toLowerCase() || "";
          valB = getAssigneeName(b)?.toLowerCase() || "";
          break;
        case "datum":
          valA = new Date(a.created_at).getTime();
          valB = new Date(b.created_at).getTime();
          break;
      }

      if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
      if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  } else {
    // Standard-Sortierung: Zuerst nach Status (Offen -> Geschlossen), dann nach Datum (Neueste zuerst)
    filteredTickets.sort((a, b) => {
      const mapStatus = { open: 1, in_progress: 2, waiting: 3, closed: 4 } as any;
      const statA = mapStatus[a.status] || 0;
      const statB = mapStatus[b.status] || 0;

      if (statA !== statB) {
        return statA - statB; // Aufsteigend nach Status (1=offen, 4=geschlossen)
      }

      // Bei gleichem Status nach Datum absteigend (neueste zuerst)
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA;
    });
  }

  // Stats — folgen dem Mitarbeiter-Filter
  const assigneeTickets = tickets.filter((t) => {
    if (assigneeFilter === "all") return true;
    if (assigneeFilter === "unassigned") return !t.assigned_to;
    return t.assigned_to === assigneeFilter;
  });
  const openCount = assigneeTickets.filter((t) => t.status === "open").length;
  const inProgressCount = assigneeTickets.filter((t) => t.status === "in_progress").length;
  const waitingCount = assigneeTickets.filter((t) => t.status === "waiting").length;
  const closedCount = assigneeTickets.filter((t) => t.status === "closed").length;

  const statCards = [
    { label: "Offen", count: openCount, color: colors.error, icon: "envelope.fill" as const },
    { label: "In Arbeit", count: inProgressCount, color: colors.primary, icon: "gear" as const },
    { label: "Wartend", count: waitingCount, color: colors.warning, icon: "calendar" as const },
    { label: "Gelöst", count: closedCount, color: colors.success, icon: "checkmark" as const },
  ];

  const renderTicketCard = ({ item }: { item: any }) => {
    const priorityColor = getPriorityColor(item.priority);
    const statusColor = getStatusColor(item.status);
    const assignee = getAssigneeName(item);

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setSelectedTicket(item)}
        style={{
          backgroundColor: colors.surface,
          borderRadius: 14,
          marginBottom: 10,
          borderWidth: 1,
          borderColor: colors.border,
          borderLeftWidth: 4,
          borderLeftColor: priorityColor,
          overflow: "hidden",
        }}
      >
        <View style={{ padding: 14 }}>
          {/* Top row: title + priority badge */}
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }} numberOfLines={1}>{item.title}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <View style={{ backgroundColor: priorityColor + "18", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                <Text style={{ color: priorityColor, fontSize: 11, fontWeight: "600" }}>{getPriorityLabel(item.priority)}</Text>
              </View>
              <View style={{ backgroundColor: statusColor + "18", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                <Text style={{ color: statusColor, fontSize: 11, fontWeight: "600" }}>{getStatusLabel(item.status)}</Text>
              </View>
            </View>
          </View>

          {/* Description preview */}
          {item.description ? (
            <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 8 }} numberOfLines={1}>{item.description}</Text>
          ) : null}

          {/* Bottom row: customer, assignee, date */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <IconSymbol name="person.2.fill" size={12} color={colors.muted} />
                <Text style={{ fontSize: 12, color: colors.muted }} numberOfLines={1}>{getCustomerName(item)}</Text>
              </View>
              {assignee && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <IconSymbol name="person.fill.badge.plus" size={12} color={colors.primary} />
                  <Text style={{ fontSize: 12, color: colors.primary, fontWeight: "500" }} numberOfLines={1}>{assignee}</Text>
                </View>
              )}
            </View>
            <Text style={{ fontSize: 11, color: colors.muted }}>{formatDate(item.created_at)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) return null;
    return <IconSymbol name={sortConfig.direction === "asc" ? "chevron.up" : "chevron.down"} size={10} color={colors.primary} />;
  };

  const renderDesktopTable = () => (
    <View style={{ backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
      {/* Table Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.background }}>
        <TouchableOpacity style={{ width: 50, flexDirection: "row", alignItems: "center", gap: 4 }} onPress={() => handleSort("prio")}>
          <Text style={{ fontSize: 10, fontWeight: "700", color: sortConfig?.key === "prio" ? colors.primary : colors.muted, textTransform: "uppercase" }}>Prio</Text>
          {getSortIcon("prio")}
        </TouchableOpacity>
        <TouchableOpacity style={{ flex: 2, flexDirection: "row", alignItems: "center", gap: 4 }} onPress={() => handleSort("titel")}>
          <Text style={{ fontSize: 10, fontWeight: "700", color: sortConfig?.key === "titel" ? colors.primary : colors.muted, textTransform: "uppercase" }}>Titel</Text>
          {getSortIcon("titel")}
        </TouchableOpacity>
        <TouchableOpacity style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 4 }} onPress={() => handleSort("kunde")}>
          <Text style={{ fontSize: 10, fontWeight: "700", color: sortConfig?.key === "kunde" ? colors.primary : colors.muted, textTransform: "uppercase" }}>Kunde</Text>
          {getSortIcon("kunde")}
        </TouchableOpacity>
        <TouchableOpacity style={{ width: 120, flexDirection: "row", alignItems: "center", gap: 4 }} onPress={() => handleSort("status")}>
          <Text style={{ fontSize: 10, fontWeight: "700", color: sortConfig?.key === "status" ? colors.primary : colors.muted, textTransform: "uppercase" }}>Status</Text>
          {getSortIcon("status")}
        </TouchableOpacity>
        <TouchableOpacity style={{ width: 120, flexDirection: "row", alignItems: "center", gap: 4 }} onPress={() => handleSort("zugewiesen")}>
          <Text style={{ fontSize: 10, fontWeight: "700", color: sortConfig?.key === "zugewiesen" ? colors.primary : colors.muted, textTransform: "uppercase" }}>Zugewiesen</Text>
          {getSortIcon("zugewiesen")}
        </TouchableOpacity>
        <TouchableOpacity style={{ width: 90, flexDirection: "row", alignItems: "center", gap: 4 }} onPress={() => handleSort("datum")}>
          <Text style={{ fontSize: 10, fontWeight: "700", color: sortConfig?.key === "datum" ? colors.primary : colors.muted, textTransform: "uppercase" }}>Datum</Text>
          {getSortIcon("datum")}
        </TouchableOpacity>
        <View style={{ width: 40 }} />
      </View>
      {/* Table Rows */}
      {filteredTickets.map((item: any) => {
        const priorityColor = getPriorityColor(item.priority);
        const statusColor = getStatusColor(item.status);
        const assignee = getAssigneeName(item);
        return (
          <TouchableOpacity
            key={item.id}
            style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}
            activeOpacity={0.7}
            onPress={() => setSelectedTicket(item)}
          >
            {/* Priority dot */}
            <View style={{ width: 50, flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: priorityColor }} />
              <Text style={{ fontSize: 11, color: priorityColor, fontWeight: "600" }}>{getPriorityLabel(item.priority).charAt(0)}</Text>
            </View>
            {/* Title */}
            <View style={{ flex: 2, paddingRight: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }} numberOfLines={1}>{item.title}</Text>
              {item.description ? <Text style={{ fontSize: 12, color: colors.muted, marginTop: 1 }} numberOfLines={1}>{item.description}</Text> : null}
            </View>
            {/* Customer */}
            <Text style={{ flex: 1, fontSize: 13, color: colors.foreground }} numberOfLines={1}>{getCustomerName(item)}</Text>
            {/* Status */}
            <View style={{ width: 120 }}>
              <View style={{ backgroundColor: statusColor + "18", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, alignSelf: "flex-start" }}>
                <Text style={{ color: statusColor, fontSize: 11, fontWeight: "600" }}>{getStatusLabel(item.status)}</Text>
              </View>
            </View>
            {/* Assignee */}
            <Text style={{ width: 120, fontSize: 13, color: assignee ? colors.foreground : colors.muted }} numberOfLines={1}>
              {assignee || "—"}
            </Text>
            {/* Date */}
            <Text style={{ width: 90, fontSize: 12, color: colors.muted }}>{formatDate(item.created_at)}</Text>
            {/* Delete */}
            <View style={{ width: 40, alignItems: "center" }}>
              <TouchableOpacity
                onPress={(e) => handleDeleteTicket(item.id, e)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <IconSymbol name="trash.fill" size={14} color={colors.error} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <ScreenContainer>
      <View className="flex-1" style={{ padding: contentPadding }}>
        <View style={containerStyle}>
          {/* Header */}
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center gap-3">
              <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
                <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
              </TouchableOpacity>
              <View>
                <Text className="text-2xl font-bold text-foreground">Tickets</Text>
                <Text className="text-sm text-muted">{filteredTickets.length} von {tickets.length} Tickets</Text>
              </View>
            </View>
            <TouchableOpacity
              className="bg-primary px-4 py-2.5 rounded-xl flex-row items-center gap-2"
              activeOpacity={0.8}
              onPress={() => setShowAddModal(true)}
            >
              <IconSymbol name="plus" size={16} color={colors.background} />
              {isDesktop && <Text style={{ color: colors.background, fontWeight: "700", fontSize: 14 }}>Neues Ticket</Text>}
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, marginBottom: 14, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
            <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
            <TextInput
              style={{ flex: 1, marginLeft: 10, fontSize: 15, color: colors.foreground }}
              placeholder="Ticket suchen..."
              placeholderTextColor={colors.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <IconSymbol name="xmark.circle.fill" size={18} color={colors.muted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Stat Cards */}
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
            {statCards.map((stat) => (
              <TouchableOpacity
                key={stat.label}
                style={{
                  flex: 1,
                  backgroundColor: filter === (stat.label === "Offen" ? "open" : stat.label === "In Arbeit" ? "in_progress" : stat.label === "Wartend" ? "waiting" : "closed")
                    ? stat.color + "15"
                    : colors.surface,
                  borderRadius: 12,
                  padding: isDesktop ? 14 : 10,
                  borderWidth: 1,
                  borderColor: filter === (stat.label === "Offen" ? "open" : stat.label === "In Arbeit" ? "in_progress" : stat.label === "Wartend" ? "waiting" : "closed")
                    ? stat.color + "50"
                    : colors.border,
                  alignItems: "center",
                }}
                activeOpacity={0.7}
                onPress={() => {
                  const statusKey = stat.label === "Offen" ? "open" : stat.label === "In Arbeit" ? "in_progress" : stat.label === "Wartend" ? "waiting" : "closed";
                  setFilter(filter === statusKey ? "all" : statusKey as TicketStatus);
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <IconSymbol name={stat.icon} size={14} color={stat.color} />
                  <Text style={{ fontSize: isDesktop ? 22 : 18, fontWeight: "800", color: stat.color }}>{stat.count}</Text>
                </View>
                <Text style={{ fontSize: 10, color: colors.muted, fontWeight: "600", textTransform: "uppercase" }}>{stat.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Assignee Filter */}
          {allUsers.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 14 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  style={{
                    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
                    backgroundColor: assigneeFilter === "unassigned" ? colors.primary : colors.surface,
                    borderWidth: 1, borderColor: assigneeFilter === "unassigned" ? colors.primary : colors.border,
                  }}
                  onPress={() => setAssigneeFilter("unassigned")}
                >
                  <Text style={{ fontSize: 13, fontWeight: "600", color: assigneeFilter === "unassigned" ? colors.background : colors.foreground }}>Nicht zugewiesen</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
                    backgroundColor: assigneeFilter === "all" ? colors.primary : colors.surface,
                    borderWidth: 1, borderColor: assigneeFilter === "all" ? colors.primary : colors.border,
                  }}
                  onPress={() => setAssigneeFilter("all")}
                >
                  <Text style={{ fontSize: 13, fontWeight: "600", color: assigneeFilter === "all" ? colors.background : colors.foreground }}>Alle</Text>
                </TouchableOpacity>
                {allUsers.map((user: any) => (
                  <TouchableOpacity
                    key={user.id}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
                      backgroundColor: assigneeFilter === user.id ? colors.primary : colors.surface,
                      borderWidth: 1, borderColor: assigneeFilter === user.id ? colors.primary : colors.border,
                    }}
                    onPress={() => setAssigneeFilter(assigneeFilter === user.id ? "all" : user.id)}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "600", color: assigneeFilter === user.id ? colors.background : colors.foreground }}>
                      {user.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}

          {/* Ticket List / Table */}
          {isLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : filteredTickets.length > 0 ? (
            isDesktop ? (
              <ScrollView 
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              >
                {renderDesktopTable()}
              </ScrollView>
            ) : (
              <FlatList
                data={filteredTickets}
                renderItem={renderTicketCard}
                keyExtractor={(item) => item.id.toString()}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              />
            )
          ) : (
            <View className="flex-1 items-center justify-center">
              <IconSymbol name="ticket.fill" size={48} color={colors.muted} />
              <Text className="text-lg text-muted mt-4">Keine Tickets gefunden</Text>
              <Text className="text-sm text-muted text-center mt-2">
                {searchQuery
                  ? `Keine Ergebnisse für "${searchQuery}"`
                  : filter === "all"
                    ? "Erstellen Sie Ihr erstes Ticket"
                    : `Keine Tickets mit Status "${getStatusLabel(filter as TicketStatus)}"`}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Ticket-Formular Modal */}
      <TicketFormModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={(newTicket) => {
          if (newTicket) {
             setSelectedTicket(newTicket);
          }
        }}
      />

      {/* Ticket-Details Modal */}
      {selectedTicket && (
        <TicketDetailsModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          currentUserName={currentUserName}
        />
      )}
    </ScreenContainer>
  );
}

// Ticket-Details Modal
function TicketDetailsModal({
  ticket,
  onClose,
  currentUserName,
}: {
  ticket: any;
  onClose: () => void;
  currentUserName: string;
}) {
  const router = useRouter();
  const colors = useColors();
  const queryClient = useQueryClient();
  const [currentStatus, setCurrentStatus] = useState<TicketStatus>(ticket.status || "open");
  const [currentPriority, setCurrentPriority] = useState<TicketPriority>(ticket.priority || "medium");
  const [assignedTo, setAssignedTo] = useState<string | null>(ticket.assigned_to || null);
  const [newComment, setNewComment] = useState("");
  const [addingComment, setAddingComment] = useState(false);
  const [isInternalComment, setIsInternalComment] = useState(true);
  const [showAssignPicker, setShowAssignPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);

  // Kommentare laden
  const { data: comments, refetch: refetchComments } = useQuery({
    queryKey: ["ticket-comments", ticket.id],
    queryFn: () => Data.getTicketComments(ticket.id),
  });

  // Mitarbeitende laden
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: Data.getAllUsers,
  });

  // Positionen (Aufwände/Artikel) laden
  const { data: ticketItems = [], refetch: refetchTicketItems } = useQuery({
    queryKey: ["ticket-items", ticket.id],
    queryFn: () => Data.getTicketItems(ticket.id),
  });

  // Katalog laden (falls Katalog-Tab gewählt)
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: Data.getProducts,
  });

  const [activeTab, setActiveTab] = useState<"comments" | "items">("comments");
  const [showItemTypePicker, setShowItemTypePicker] = useState<"time" | "product" | null>(null);

  // Form State für neuen Zeitaufwand
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemQty, setNewItemQty] = useState("1");
  const [newItemPrice, setNewItemPrice] = useState("150"); // Std. Ansatz

  // Form State für Katalogprodukt
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [addingItem, setAddingItem] = useState(false);

  const statusOptions: { key: TicketStatus; label: string; color: string }[] = [
    { key: "open", label: "Offen", color: colors.error },
    { key: "in_progress", label: "In Bearbeitung", color: colors.primary },
    { key: "waiting", label: "Wartend", color: colors.warning },
    { key: "closed", label: "Geschlossen", color: colors.success },
  ];

  const priorityOptions: { key: TicketPriority; label: string; color: string }[] = [
    { key: "low", label: "Niedrig", color: colors.success },
    { key: "medium", label: "Mittel", color: colors.warning },
    { key: "high", label: "Hoch", color: colors.error },
  ];

  const handleStatusChange = async (newStatus: TicketStatus) => {
    setCurrentStatus(newStatus);
    try {
      await Data.updateTicket(ticket.id, { status: newStatus });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    } catch (err: any) {
      setCurrentStatus(ticket.status);
      showAlert("Fehler", err.message);
    }
  };

  const handlePriorityChange = async (newPriority: TicketPriority) => {
    setCurrentPriority(newPriority);
    try {
      await Data.updateTicket(ticket.id, { priority: newPriority });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    } catch (err: any) {
      setCurrentPriority(ticket.priority);
      showAlert("Fehler", err.message);
    }
  };

  const handleAssign = async (userId: string | null) => {
    setAssignedTo(userId);
    setShowAssignPicker(false);
    try {
      await Data.updateTicket(ticket.id, { assigned_to: userId });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });

      // Save activity to notifications table for CURRENT user
      const assignedUserName = users.find((u: any) => u.id === userId)?.name || "Jemand";
      try {
        const { data: { session } } = await (await import("@/lib/supabase")).supabase.auth.getSession();
        if (session?.user) {
          const { error: insErr } = await (await import("@/lib/supabase")).supabase.from("notifications").insert({
            user_id: session.user.id,
            title: "Ticket zugewiesen",
            message: `Ticket "${ticket.title}" wurde ${assignedUserName} zugewiesen.`,
            is_read: true,
          });
          console.log("[Activities] Ticket assignment saved:", insErr ? "ERROR: " + insErr.message : "OK");
        }
      } catch (e) {
        console.warn("[Activities] Failed to save assignment activity:", e);
      }

      // Push notification to assigned user
      if (userId) {
        Data.triggerPushNotification(
          [userId],
          "admin",
          "Ticket zugewiesen",
          `Dir wurde das Ticket "${ticket.title}" zugewiesen.`,
          { type: "ticket_assigned", ticketId: ticket.id, url: `/tickets?ticketId=${ticket.id}` },
          "tickets"
        );
      }
    } catch (err: any) {
      setAssignedTo(ticket.assigned_to);
      showAlert("Fehler", err.message);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setAddingComment(true);
    try {
      await Data.addTicketComment(ticket.id, newComment.trim(), currentUserName, isInternalComment);
      setNewComment("");
      refetchComments();
    } catch (err: any) {
      showAlert("Fehler", err.message);
    } finally {
      setAddingComment(false);
    }
  };

  const handleDelete = () => {
    showConfirm(
      "Ticket löschen",
      "Möchten Sie dieses Ticket wirklich unwiderruflich löschen?",
      async () => {
        try {
          await Data.deleteTicket(ticket.id);
          queryClient.invalidateQueries({ queryKey: ["tickets"] });
          onClose();
        } catch (err: any) {
          showAlert("Fehler", err.message);
        }
      },
      "Löschen"
    );
  };

  const handleCreateInvoice = async () => {
    try {
      if (!ticket.customer_id) {
        showAlert("Fehler", "Diesem Ticket ist kein Kunde zugewiesen. Bitte weisen Sie zuerst einen Kunden zu.");
        return;
      }
      
      let invoiceItems = ticketItems.map((item: any) => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        vat_rate: item.vat_rate || 0,
        total: item.quantity * item.unit_price
      }));

      if (invoiceItems.length === 0) {
        invoiceItems = [{
          description: `Leistungen gemäss Ticket #${ticket.id}: ${ticket.title}`,
          quantity: 1,
          unit_price: 0,
          vat_rate: 0,
          total: 0
        }];
      }

      const rawSubtotal = invoiceItems.reduce((sum: number, i: any) => sum + i.total, 0);
      const rawVatAmount = invoiceItems.reduce((sum: number, i: any) => sum + (i.total * (i.vat_rate / 100)), 0);

      const draftInvoice = {
        invoice_number: `ENTWURF-${Date.now().toString().slice(-6)}`,
        status: "sent",
        customer_id: ticket.customer_id,
        invoice_date: new Date().toISOString().split("T")[0],
        due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        subtotal: rawSubtotal,
        vat_amount: rawVatAmount,
        total: rawSubtotal + rawVatAmount,
      };
      
      const newInvoice = await Data.createInvoice(draftInvoice, invoiceItems);
      
      onClose();
      router.push(`/invoice/${newInvoice.id}` as any);
    } catch (err: any) {
      showAlert("Fehler", err.message);
    }
  };

  const assignedUser = users.find((u: any) => u.id === assignedTo);

  const priorityConfig = {
    low: { label: "Niedrig", color: colors.success, icon: "arrow.down" },
    medium: { label: "Mittel", color: colors.warning, icon: "minus" },
    high: { label: "Hoch", color: colors.error, icon: "arrow.up" },
  } as Record<string, { label: string; color: string; icon: string }>;

  const statusConfig = {
    open: { label: "Offen", color: colors.error },
    in_progress: { label: "In Bearbeitung", color: colors.primary },
    waiting: { label: "Wartend", color: colors.warning },
    closed: { label: "Geschlossen", color: colors.success },
  } as Record<string, { label: string; color: string }>;

  const pCfg = priorityConfig[currentPriority] || priorityConfig.medium;
  const sCfg = statusConfig[currentStatus] || statusConfig.open;
  const customerName = ticket.customer?.company_name || `${ticket.customer?.first_name || ""} ${ticket.customer?.last_name || ""}`.trim() || "Kein Kunde";

  // Time since created
  const createdDate = new Date(ticket.created_at);
  const diffMs = Date.now() - createdDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const ageLabel = diffDays === 0 ? "Heute" : diffDays === 1 ? "Gestern" : `vor ${diffDays} Tagen`;

  return (
    <Modal visible={true} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-background rounded-t-3xl" style={{ maxHeight: "92%", flex: 1 }}>
          {/* ── Hero Header ── */}
          <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1, marginRight: 16 }}>
                {/* Badges row */}
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                  <View style={{ backgroundColor: sCfg.color, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 }}>
                    <Text style={{ color: "#FFF", fontSize: 11, fontWeight: "700" }}>{sCfg.label}</Text>
                  </View>
                  <View style={{ backgroundColor: pCfg.color + "18", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Text style={{ color: pCfg.color, fontSize: 11, fontWeight: "700" }}>{pCfg.label}</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 20, fontWeight: "800", color: colors.foreground, lineHeight: 26 }}>
                  {ticket.title}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={{ marginTop: 4 }}>
                <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Scrollable Content ── */}
          <ScrollView style={{ padding: 16 }} showsVerticalScrollIndicator={false}>
            <View style={{ gap: 16, paddingBottom: 20 }}>

              {/* ── Info Cards Grid ── */}
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <IconSymbol name="person.2.fill" size={13} color={colors.muted} />
                    <Text style={{ fontSize: 10, fontWeight: "600", color: colors.muted, textTransform: "uppercase" }}>Kunde</Text>
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }} numberOfLines={2}>{customerName}</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <IconSymbol name="person.fill.badge.plus" size={13} color={colors.muted} />
                    <Text style={{ fontSize: 10, fontWeight: "600", color: colors.muted, textTransform: "uppercase" }}>Zugewiesen</Text>
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: assignedUser ? colors.foreground : colors.muted }} numberOfLines={1}>
                    {assignedUser ? assignedUser.name : "Niemand"}
                  </Text>
                </View>
              </View>

              {/* Gast-Informationen (von Webseite) */}
              {(!ticket.customer_id && (ticket.contact_name || ticket.contact_email)) && (
                <View style={{ backgroundColor: colors.primary + "10", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.primary + "30" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
                    <IconSymbol name="globe" size={16} color={colors.primary} />
                    <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary, textTransform: "uppercase" }}>Webseite / Gastanfrage</Text>
                  </View>
                  <View style={{ gap: 6 }}>
                    {ticket.contact_name && <Text style={{ fontSize: 14, color: colors.foreground }}><Text style={{ fontWeight: "600" }}>Name:</Text> {ticket.contact_name}</Text>}
                    {ticket.contact_company && <Text style={{ fontSize: 14, color: colors.foreground }}><Text style={{ fontWeight: "600" }}>Firma:</Text> {ticket.contact_company}</Text>}
                    {ticket.contact_email && <Text style={{ fontSize: 14, color: colors.foreground }}><Text style={{ fontWeight: "600" }}>E-Mail:</Text> {ticket.contact_email}</Text>}
                    {ticket.contact_phone && <Text style={{ fontSize: 14, color: colors.foreground }}><Text style={{ fontWeight: "600" }}>Telefon:</Text> {ticket.contact_phone}</Text>}
                  </View>
                </View>
              )}
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <IconSymbol name="calendar" size={13} color={colors.muted} />
                    <Text style={{ fontSize: 10, fontWeight: "600", color: colors.muted, textTransform: "uppercase" }}>Erstellt</Text>
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>{formatDate(ticket.created_at)}</Text>
                  <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>{ageLabel}</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <IconSymbol name="doc.text.fill" size={13} color={colors.muted} />
                    <Text style={{ fontSize: 10, fontWeight: "600", color: colors.muted, textTransform: "uppercase" }}>Kommentare</Text>
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>{comments?.length || 0}</Text>
                </View>
              </View>

              {/* ── Description ── */}
              {ticket.description ? (
                <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, textTransform: "uppercase", marginBottom: 6 }}>Beschreibung</Text>
                  <Text style={{ fontSize: 14, color: colors.foreground, lineHeight: 20 }}>{ticket.description}</Text>
                </View>
              ) : null}

              {/* ── Zugewiesen an (Picker) ── */}
              <View>
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground, marginBottom: 8 }}>Zugewiesen an</Text>
                <TouchableOpacity
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: 1, borderColor: colors.border,
                    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
                    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                  }}
                  onPress={() => setShowAssignPicker(!showAssignPicker)}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{
                      width: 28, height: 28, borderRadius: 14,
                      backgroundColor: assignedUser ? colors.primary : colors.muted + "30",
                      alignItems: "center", justifyContent: "center",
                    }}>
                      {assignedUser ? (
                        <Text style={{ color: "#FFF", fontSize: 11, fontWeight: "700" }}>
                          {(assignedUser.name || "?").split(" ").map((p: string) => p[0]).join("").toUpperCase().slice(0, 2)}
                        </Text>
                      ) : (
                        <IconSymbol name="person.fill.badge.plus" size={14} color={colors.muted} />
                      )}
                    </View>
                    <Text style={{ color: colors.foreground, fontSize: 14 }}>
                      {assignedUser ? assignedUser.name : "Nicht zugewiesen"}
                    </Text>
                  </View>
                  <IconSymbol name="chevron.down" size={14} color={colors.muted} />
                </TouchableOpacity>

                {showAssignPicker && (
                  <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, marginTop: 4, overflow: "hidden" }}>
                    <TouchableOpacity
                      style={{ paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}
                      onPress={() => handleAssign(null)}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 14, color: colors.muted, fontStyle: "italic" }}>Nicht zugewiesen</Text>
                    </TouchableOpacity>
                    {users.map((user: any) => (
                      <TouchableOpacity
                        key={user.id}
                        style={{
                          paddingHorizontal: 14, paddingVertical: 12,
                          borderBottomWidth: 1, borderBottomColor: colors.border,
                          flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                          backgroundColor: assignedTo === user.id ? colors.primary + "10" : "transparent",
                        }}
                        onPress={() => handleAssign(user.id)}
                        activeOpacity={0.7}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
                            <Text style={{ color: "#FFF", fontSize: 10, fontWeight: "700" }}>
                              {(user.name || "?").split(" ").map((p: string) => p[0]).join("").toUpperCase().slice(0, 2)}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 14, color: colors.foreground }}>{user.name}</Text>
                        </View>
                        {assignedTo === user.id && (
                          <IconSymbol name="checkmark" size={14} color={colors.primary} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* ── Status ── */}
              <View>
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground, marginBottom: 8 }}>Status ändern</Text>
                <TouchableOpacity
                  style={{
                    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
                    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
                    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                  }}
                  onPress={() => setShowStatusPicker(!showStatusPicker)}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: sCfg.color }} />
                    <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>{sCfg.label}</Text>
                  </View>
                  <IconSymbol name="chevron.down" size={14} color={colors.muted} />
                </TouchableOpacity>
                {showStatusPicker && (
                  <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, marginTop: 4, overflow: "hidden" }}>
                    {statusOptions.map((opt) => (
                      <TouchableOpacity
                        key={opt.key}
                        style={{
                          paddingHorizontal: 14, paddingVertical: 12,
                          borderBottomWidth: 1, borderBottomColor: colors.border,
                          flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                          backgroundColor: currentStatus === opt.key ? opt.color + "10" : "transparent",
                        }}
                        onPress={() => { handleStatusChange(opt.key); setShowStatusPicker(false); }}
                        activeOpacity={0.7}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: opt.color }} />
                          <Text style={{ fontSize: 14, color: colors.foreground, fontWeight: currentStatus === opt.key ? "700" : "400" }}>{opt.label}</Text>
                        </View>
                        {currentStatus === opt.key && <IconSymbol name="checkmark" size={14} color={opt.color} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* ── Priorität ── */}
              <View>
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground, marginBottom: 8 }}>Priorität ändern</Text>
                <TouchableOpacity
                  style={{
                    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
                    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
                    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                  }}
                  onPress={() => setShowPriorityPicker(!showPriorityPicker)}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: pCfg.color }} />
                    <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>{pCfg.label}</Text>
                  </View>
                  <IconSymbol name="chevron.down" size={14} color={colors.muted} />
                </TouchableOpacity>
                {showPriorityPicker && (
                  <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, marginTop: 4, overflow: "hidden" }}>
                    {priorityOptions.map((opt) => (
                      <TouchableOpacity
                        key={opt.key}
                        style={{
                          paddingHorizontal: 14, paddingVertical: 12,
                          borderBottomWidth: 1, borderBottomColor: colors.border,
                          flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                          backgroundColor: currentPriority === opt.key ? opt.color + "10" : "transparent",
                        }}
                        onPress={() => { handlePriorityChange(opt.key); setShowPriorityPicker(false); }}
                        activeOpacity={0.7}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: opt.color }} />
                          <Text style={{ fontSize: 14, color: colors.foreground, fontWeight: currentPriority === opt.key ? "700" : "400" }}>{opt.label}</Text>
                        </View>
                        {currentPriority === opt.key && <IconSymbol name="checkmark" size={14} color={opt.color} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* ── Tabs (Kommentare vs. Aufwände) ── */}
              <View style={{ flexDirection: "row", backgroundColor: colors.surface, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: colors.border, marginBottom: 8 }}>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 8, backgroundColor: activeTab === "comments" ? colors.primary + "20" : "transparent" }}
                  onPress={() => setActiveTab("comments")}
                >
                  <Text style={{ fontSize: 13, fontWeight: activeTab === "comments" ? "700" : "500", color: activeTab === "comments" ? colors.primary : colors.muted }}>Kommentare</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 8, backgroundColor: activeTab === "items" ? colors.primary + "20" : "transparent" }}
                  onPress={() => setActiveTab("items")}
                >
                  <Text style={{ fontSize: 13, fontWeight: activeTab === "items" ? "700" : "500", color: activeTab === "items" ? colors.primary : colors.muted }}>Aufwände & Positionen</Text>
                </TouchableOpacity>
              </View>

              {activeTab === "comments" ? (
                /* ── Kommentare & Historie ── */
                <View>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>Kommentare & Historie</Text>
                    <Text style={{ fontSize: 11, color: colors.muted }}>{comments?.length || 0} Einträge</Text>
                  </View>

                  {comments && comments.length > 0 ? (
                    <View style={{ gap: 8, marginBottom: 12 }}>
                      {comments.map((c: any) => (
                        <View key={c.id} style={{
                          backgroundColor: colors.surface, borderRadius: 12,
                          padding: 14, borderWidth: 1, borderColor: colors.border,
                          borderLeftWidth: 3, borderLeftColor: c.is_internal ? colors.warning : colors.success,
                        }}>
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary + "20", alignItems: "center", justifyContent: "center" }}>
                                <Text style={{ fontSize: 10, fontWeight: "700", color: colors.primary }}>
                                  {(c.user_name || "S")[0].toUpperCase()}
                                </Text>
                              </View>
                              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.primary }}>
                                {c.user_name || "System"}
                              </Text>
                              <View style={{
                                paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
                                backgroundColor: c.is_internal ? colors.warning + "18" : colors.success + "18",
                              }}>
                                <Text style={{ fontSize: 9, fontWeight: "700", color: c.is_internal ? colors.warning : colors.success }}>
                                  {c.is_internal ? "INTERN" : "EXTERN"}
                                </Text>
                              </View>
                            </View>
                            <Text style={{ fontSize: 11, color: colors.muted }}>
                              {formatDateTime(c.created_at)}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 14, color: colors.foreground, lineHeight: 20 }}>{c.comment}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 20, alignItems: "center", marginBottom: 12, borderWidth: 1, borderColor: colors.border }}>
                      <IconSymbol name="doc.text.fill" size={28} color={colors.muted} />
                      <Text style={{ fontSize: 13, color: colors.muted, marginTop: 6 }}>Noch keine Kommentare</Text>
                    </View>
                  )}

                  {/* Sichtbarkeit Toggle */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <TouchableOpacity
                      style={{
                        flexDirection: "row", alignItems: "center", gap: 6,
                        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                        backgroundColor: isInternalComment ? colors.warning + "15" : colors.success + "15",
                        borderWidth: 1, borderColor: isInternalComment ? colors.warning + "30" : colors.success + "30",
                      }}
                      onPress={() => setIsInternalComment(!isInternalComment)}
                      activeOpacity={0.7}
                    >
                      <IconSymbol
                        name={isInternalComment ? "lock.fill" : "globe"}
                        size={12}
                        color={isInternalComment ? colors.warning : colors.success}
                      />
                      <Text style={{ fontSize: 12, fontWeight: "600", color: isInternalComment ? colors.warning : colors.success }}>
                        {isInternalComment ? "Nur intern" : "Kunde sichtbar"}
                      </Text>
                    </TouchableOpacity>
                    <Text style={{ fontSize: 11, color: colors.muted }}>Tippen um zu wechseln</Text>
                  </View>

                  {/* Neuer Kommentar */}
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TextInput
                      style={{
                        flex: 1, backgroundColor: colors.surface,
                        borderWidth: 1, borderColor: colors.border,
                        borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
                        color: colors.foreground, fontSize: 14,
                      }}
                      placeholder="Kommentar schreiben..."
                      placeholderTextColor={colors.muted}
                      value={newComment}
                      onChangeText={setNewComment}
                      multiline
                    />
                    <TouchableOpacity
                      style={{
                        backgroundColor: colors.primary, borderRadius: 12,
                        paddingHorizontal: 16, justifyContent: "center",
                        opacity: addingComment || !newComment.trim() ? 0.5 : 1,
                      }}
                      onPress={handleAddComment}
                      activeOpacity={0.7}
                      disabled={addingComment || !newComment.trim()}
                    >
                      {addingComment ? (
                        <ActivityIndicator color="#FFF" size="small" />
                      ) : (
                        <IconSymbol name="paperplane.fill" size={18} color="#FFF" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TicketItemsList
                  ticketId={ticket.id}
                  ticketItems={ticketItems}
                  products={products}
                  colors={colors}
                  onRefresh={refetchTicketItems}
                />
              )}
            </View>
          </ScrollView>

          {/* ── Footer Actions ── */}
          <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: "row", gap: 10 }}>
            {currentStatus === "closed" && (
              <TouchableOpacity
                style={{
                  flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
                  backgroundColor: colors.primary + "10", borderWidth: 1, borderColor: colors.primary + "25",
                  paddingVertical: 12, borderRadius: 12,
                }}
                onPress={handleCreateInvoice}
                activeOpacity={0.8}
              >
                <IconSymbol name="doc.text.fill" size={14} color={colors.primary} />
                <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>Rechnung</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={{
                flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
                backgroundColor: colors.error + "10", borderWidth: 1, borderColor: colors.error + "25",
                paddingVertical: 12, borderRadius: 12,
              }}
              onPress={handleDelete}
              activeOpacity={0.8}
            >
              <IconSymbol name="trash.fill" size={14} color={colors.error} />
              <Text style={{ color: colors.error, fontWeight: "600", fontSize: 14 }}>Löschen</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={{
                flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
                paddingVertical: 12, borderRadius: 12,
              }}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }}>Schliessen</Text>
            </TouchableOpacity>
          </View>
        </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function TicketItemsList({ ticketId, ticketItems, products, colors, onRefresh }: any) {
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState<"time" | "product">("time");
  const [desc, setDesc] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("150");
  const [prodId, setProdId] = useState("");
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);

  const handleAdd = async () => {
    try {
      setAdding(true);
      if (type === "time") {
        if (!desc.trim()) throw new Error("Beschreibung fehlt");
        await Data.addTicketItem({
          ticket_id: ticketId,
          description: desc,
          quantity: parseFloat(qty) || 1,
          unit_price: parseFloat(price) || 0,
          vat_rate: 8.1,
          is_time_tracking: true
        });
      } else {
        const p = products.find((x: any) => x.id === prodId);
        if (!p) throw new Error("Produkt nicht gewählt");
        await Data.addTicketItem({
          ticket_id: ticketId,
          product_id: p.id,
          description: p.name + (desc.trim() ? `\n${desc.trim()}` : ""),
          quantity: parseFloat(qty) || 1,
          unit_price: p.price || 0,
          vat_rate: p.vat_rate || 8.1,
          is_time_tracking: false
        });
      }
      setDesc("");
      setQty("1");
      setProdId("");
      onRefresh();
    } catch(err: any) {
      showConfirm("Fehler", err.message, () => {}, "OK");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    showConfirm("Wirklich löschen?", "Diese Position wird entfernt.", async () => {
      await Data.deleteTicketItem(id);
      onRefresh();
    }, "Löschen");
  };

  const totalAmount = ticketItems.reduce((acc: number, item: any) => acc + (item.quantity * item.unit_price), 0);

  return (
    <View>
      {/* List */}
      <View style={{ marginBottom: 16 }}>
        {ticketItems.length === 0 ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 20, alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
            <IconSymbol name="clock.arrow.circlepath" size={28} color={colors.muted} />
            <Text style={{ fontSize: 13, color: colors.muted, marginTop: 6 }}>Noch keine Aufwände erfasst</Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {ticketItems.map((item: any) => (
              <View key={item.id} style={{
                backgroundColor: colors.surface, borderRadius: 12, padding: 12,
                borderWidth: 1, borderColor: colors.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center"
              }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <IconSymbol name={item.is_time_tracking ? "clock.fill" : "shippingbox.fill"} size={12} color={colors.primary} />
                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>{item.description}</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: colors.muted }}>
                    {item.quantity} {item.is_time_tracking ? "Std." : "Stk."} à CHF {item.unit_price.toFixed(2)}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 6 }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>CHF {(item.quantity * item.unit_price).toFixed(2)}</Text>
                  <TouchableOpacity onPress={() => handleDelete(item.id)}>
                    <IconSymbol name="trash.fill" size={14} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>Total</Text>
              <Text style={{ fontSize: 14, fontWeight: "800", color: colors.primary }}>CHF {totalAmount.toFixed(2)}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Add Form */}
      <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border }}>
        <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground, marginBottom: 12 }}>Neuen Eintrag erfassen</Text>

        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
          <TouchableOpacity
            style={{ flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8, backgroundColor: type === "time" ? colors.primary + "20" : "transparent" }}
            onPress={() => setType("time")}
          >
             <Text style={{ fontSize: 13, fontWeight: type === "time" ? "700" : "500", color: type === "time" ? colors.primary : colors.muted }}>Zeit erfassen</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8, backgroundColor: type === "product" ? colors.primary + "20" : "transparent" }}
            onPress={() => setType("product")}
          >
             <Text style={{ fontSize: 13, fontWeight: type === "product" ? "700" : "500", color: type === "product" ? colors.primary : colors.muted }}>Katalog-Artikel</Text>
          </TouchableOpacity>
        </View>

        {type === "time" ? (
          <View style={{ gap: 8 }}>
            <TextInput
              style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground }}
              placeholder="Beschreibung (z.B. Fehleranalyse Server)"
              placeholderTextColor={colors.muted}
              value={desc}
              onChangeText={setDesc}
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                style={{ flex: 1, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground }}
                placeholder="Stunden"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
                value={qty}
                onChangeText={setQty}
              />
              <TextInput
                style={{ flex: 1, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground }}
                placeholder="Std-Ansatz CHF"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
                value={price}
                onChangeText={setPrice}
              />
            </View>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <TouchableOpacity
              style={{ paddingVertical: 10, paddingHorizontal: 12, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8 }}
              onPress={() => setShowProductPicker(!showProductPicker)}
            >
              <Text style={{ color: prodId ? colors.foreground : colors.muted }}>
                {prodId ? products.find((p:any) => p.id === prodId)?.name : "Produkt auswählen..."}
              </Text>
            </TouchableOpacity>
            {showProductPicker && (
              <View style={{ maxHeight: 150, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.background }}>
                <ScrollView nestedScrollEnabled>
                  {products.map((p: any) => (
                    <TouchableOpacity
                      key={p.id}
                      style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}
                      onPress={() => { setProdId(p.id); setShowProductPicker(false); setPrice(p.price.toString()); }}
                    >
                      <Text style={{ color: colors.foreground }}>{p.name}</Text>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>CHF {p.price.toFixed(2)} / {p.unit}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            <TextInput
              style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground }}
              placeholder="Bemerkung (optional, erscheint auf Rechnung)"
              placeholderTextColor={colors.muted}
              value={desc}
              onChangeText={setDesc}
            />
            <TextInput
              style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground }}
              placeholder="Anzahl"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              value={qty}
              onChangeText={setQty}
            />
          </View>
        )}

        <TouchableOpacity
          style={{
            backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 10, alignItems: "center", marginTop: 12,
            opacity: adding || (type === 'time' && !desc) || (type === 'product' && !prodId) ? 0.5 : 1
          }}
          onPress={handleAdd}
          disabled={adding || (type === 'time' && !desc.trim()) || (type === 'product' && !prodId)}
        >
          {adding ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={{ color: "#FFF", fontWeight: "600" }}>Hinzufügen</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}


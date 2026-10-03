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
import { ContractFormModal } from "@/components/contract-form-modal";
import { formatDate, formatDateTime } from "@/lib/format";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { showAlert, showConfirm, showConfirm2 } from "@/lib/alert";
import { showToast } from "@/components/toast-provider";

type TicketStatus = "open" | "in_progress" | "waiting" | "closed";
type TicketPriority = "low" | "medium" | "high";

export default function TicketsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { isWide, containerStyle, contentPadding } = useResponsiveLayout();
  const queryClient = useQueryClient();
  const { refreshing, onRefresh } = useGlobalRefresh();
  const [filter, setFilter] = useState<"all" | TicketStatus>("open");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | TicketPriority>("all");
  const [onlyMine, setOnlyMine] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAssigneeFilterPicker, setShowAssigneeFilterPicker] = useState(false);
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

  // Fälligkeit / Alter
  const isTicketOverdue = (t: any) =>
    t.status !== "closed" && !!(t as any).due_date &&
    new Date((t as any).due_date) < new Date(new Date().setHours(0, 0, 0, 0));

  const ticketAgeDays = (t: any) =>
    Math.floor((Date.now() - new Date(t.created_at).getTime()) / 86400000);

  const claimTicket = async (t: any) => {
    if (!currentUserId) return;
    try {
      await Data.updateTicket(t.id, { assigned_to: currentUserId });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      showToast("Ticket übernommen");
    } catch (e: any) {
      showAlert("Fehler", e.message);
    }
  };

  const filteredTickets = tickets
    .filter((t) => filter === "all" || t.status === filter)
    .filter((t) => {
      if (assigneeFilter === "all") return true;
      if (assigneeFilter === "unassigned") return !t.assigned_to;
      return t.assigned_to === assigneeFilter;
    })
    .filter((t) => (onlyMine ? t.assigned_to === currentUserId : true))
    .filter((t) => (priorityFilter === "all" ? true : (t.priority || "medium") === priorityFilter))
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
        case "faellig":
          // Tickets ohne Fälligkeit ans Ende
          valA = (a as any).due_date ? new Date((a as any).due_date).getTime() : Number.MAX_SAFE_INTEGER;
          valB = (b as any).due_date ? new Date((b as any).due_date).getTime() : Number.MAX_SAFE_INTEGER;
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
    const overdue = isTicketOverdue(item);
    const age = ticketAgeDays(item);
    const isOpenish = item.status !== "closed";

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
          borderLeftColor: overdue ? colors.error : priorityColor,
          overflow: "hidden",
        }}
      >
        <View style={{ padding: 14 }}>
          {/* Kopfzeile: Titel + Chips */}
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
            <View style={{ flex: 1, marginRight: 10, flexDirection: "row", alignItems: "center", gap: 6 }}>
              {item.covered_by_contract && (
                <IconSymbol name="checkmark.seal.fill" size={14} color={colors.success} />
              )}
              <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground, flex: 1 }} numberOfLines={1}>{item.title}</Text>
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

          {/* Beschreibung */}
          {item.description ? (
            <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 8 }} numberOfLines={1}>{item.description}</Text>
          ) : null}

          {/* Kunde + Zuweisung */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <IconSymbol name="person.2.fill" size={12} color={colors.muted} />
                <Text style={{ fontSize: 12, color: colors.muted }} numberOfLines={1}>{getCustomerName(item)}</Text>
              </View>
              {assignee ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <IconSymbol name="person.fill.badge.plus" size={12} color={colors.primary} />
                  <Text style={{ fontSize: 12, color: colors.primary, fontWeight: "500" }} numberOfLines={1}>{assignee}</Text>
                </View>
              ) : isOpenish ? (
                <TouchableOpacity
                  onPress={(e) => { e.stopPropagation(); claimTicket(item); }}
                  activeOpacity={0.7}
                  style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.primary + "15", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}
                >
                  <IconSymbol name="person.fill.badge.plus" size={12} color={colors.primary} />
                  <Text style={{ fontSize: 11, color: colors.primary, fontWeight: "700" }}>Übernehmen</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <Text style={{ fontSize: 11, color: colors.muted }}>{formatDate(item.created_at)}</Text>
          </View>

          {/* Fälligkeit + Alter */}
          {(item.due_date || (isOpenish && age >= 3)) && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
              {item.due_date && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <IconSymbol name={overdue ? "exclamationmark.triangle.fill" : "calendar"} size={12} color={overdue ? colors.error : colors.muted} />
                  <Text style={{ fontSize: 11, color: overdue ? colors.error : colors.muted, fontWeight: overdue ? "700" : "400" }}>
                    {overdue ? `Überfällig seit ${formatDate(item.due_date)}` : `Fällig ${formatDate(item.due_date)}`}
                  </Text>
                </View>
              )}
              {isOpenish && age >= 3 && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <IconSymbol name="clock" size={12} color={age >= 7 ? colors.warning : colors.muted} />
                  <Text style={{ fontSize: 11, color: age >= 7 ? colors.warning : colors.muted, fontWeight: age >= 7 ? "700" : "400" }}>
                    Offen seit {age} Tagen
                  </Text>
                </View>
              )}
            </View>
          )}
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
              className={isDesktop ? "bg-primary px-4 py-2.5 rounded-xl flex-row items-center gap-2" : "bg-primary w-10 h-10 rounded-full items-center justify-center"}
              activeOpacity={0.8}
              onPress={() => setShowAddModal(true)}
            >
              <IconSymbol name="plus" size={isDesktop ? 16 : 22} color={colors.background} />
              {isDesktop && <Text style={{ color: colors.background, fontWeight: "700", fontSize: 14 }}>Neues Ticket</Text>}
            </TouchableOpacity>
          </View>

          {/* Search & Filters Row */}
          <View style={{ flexDirection: isDesktop ? "row" : "column", gap: 10, marginBottom: 14 }}>
            {/* Search Bar */}
            <View style={{ flex: isDesktop ? 1 : undefined, backgroundColor: colors.surface, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
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

            {/* Filter Dropdowns Container */}
            <View style={{ flexDirection: "row", gap: 10 }}>
              {/* Assignee Filter Dropdown */}
              <TouchableOpacity
                style={{ flex: 1, minWidth: isDesktop ? 220 : undefined, backgroundColor: colors.surface, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: colors.border }}
                onPress={() => setShowAssigneeFilterPicker(true)}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <IconSymbol name="person.2.fill" size={14} color={colors.primary} />
                  <Text style={{ fontSize: 13, color: colors.foreground, fontWeight: "500" }} numberOfLines={1}>
                    {assigneeFilter === "all" ? "Alle Mitarbeiter" : assigneeFilter === "unassigned" ? "Nicht zugewiesen" : allUsers.find((u:any) => u.id === assigneeFilter)?.name || "Mitarbeiter"}
                  </Text>
                </View>
                <IconSymbol name="chevron.down" size={12} color={colors.muted} />
              </TouchableOpacity>

            </View>
          </View>

          {/* Schnellfilter + Sortierung */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }} contentContainerStyle={{ gap: 8, alignItems: "center", paddingRight: 16 }}>
            <TouchableOpacity
              onPress={() => setOnlyMine(!onlyMine)}
              activeOpacity={0.8}
              style={{
                flexDirection: "row", alignItems: "center", gap: 4,
                paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1,
                backgroundColor: onlyMine ? colors.primary : colors.surface,
                borderColor: onlyMine ? colors.primary : colors.border,
              }}
            >
              <IconSymbol name="person.fill" size={12} color={onlyMine ? "#fff" : colors.primary} />
              <Text style={{ fontSize: 12, fontWeight: "700", color: onlyMine ? "#fff" : colors.foreground }}>Meine Tickets</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setAssigneeFilter(assigneeFilter === "unassigned" ? "all" : "unassigned")}
              activeOpacity={0.8}
              style={{
                paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1,
                backgroundColor: assigneeFilter === "unassigned" ? colors.warning : colors.surface,
                borderColor: assigneeFilter === "unassigned" ? colors.warning : colors.border,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: assigneeFilter === "unassigned" ? "#fff" : colors.foreground }}>Nicht zugewiesen</Text>
            </TouchableOpacity>
            <View style={{ width: 1, height: 18, backgroundColor: colors.border }} />
            {([["high", "Hoch"], ["medium", "Mittel"], ["low", "Niedrig"]] as const).map(([key, label]) => {
              const active = priorityFilter === key;
              const pColor = getPriorityColor(key as TicketPriority);
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => setPriorityFilter(active ? "all" : (key as TicketPriority))}
                  activeOpacity={0.8}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1,
                    backgroundColor: active ? pColor : colors.surface,
                    borderColor: active ? pColor : colors.border,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "700", color: active ? "#fff" : colors.foreground }}>{label}</Text>
                </TouchableOpacity>
              );
            })}
            <View style={{ width: 1, height: 18, backgroundColor: colors.border }} />
            <IconSymbol name="arrow.up.arrow.down" size={13} color={colors.muted} />
            {([
              ["standard", "Standard", null],
              ["datum", "Neueste", { key: "datum", direction: "desc" }],
              ["prio", "Priorität", { key: "prio", direction: "desc" }],
              ["faellig", "Fälligkeit", { key: "faellig", direction: "asc" }],
            ] as const).map(([key, label, config]) => {
              const active = config === null ? sortConfig === null : sortConfig?.key === key;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => setSortConfig(config as any)}
                  activeOpacity={0.8}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1,
                    backgroundColor: active ? colors.primary + "15" : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "600", color: active ? colors.primary : colors.foreground }}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Stat Cards – dienen gleichzeitig als Status-Filter */}
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
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
      {selectedTicket && (() => {
        const liveTicket = tickets.find((t: any) => t.id === selectedTicket.id) ?? selectedTicket;
        return (
          <TicketDetailsModal
            ticket={liveTicket}
            onClose={() => setSelectedTicket(null)}
            currentUserName={currentUserName}
          />
        );
      })()}
      {/* Assignee Filter Modal */}
      {showAssigneeFilterPicker && (
        <Modal visible={true} transparent animationType="fade" onRequestClose={() => setShowAssigneeFilterPicker(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: isWide ? "center" : "flex-end", alignItems: "center" }}>
              <TouchableOpacity activeOpacity={1} style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }} onPress={() => setShowAssigneeFilterPicker(false)} />
              
              <View style={{ backgroundColor: colors.background, borderRadius: isWide ? 24 : 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, width: isWide ? 400 : "100%", maxHeight: "80%", overflow: "hidden" }}>
                <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground }}>Filter nach Mitarbeiter</Text>
                  <TouchableOpacity onPress={() => setShowAssigneeFilterPicker(false)}>
                    <IconSymbol name="xmark.circle.fill" size={24} color={colors.muted} />
                  </TouchableOpacity>
                </View>
                <ScrollView contentContainerStyle={{ padding: 16 }}>
                  <TouchableOpacity
                    style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
                    onPress={() => { setAssigneeFilter("all"); setShowAssigneeFilterPicker(false); }}
                  >
                    <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: assigneeFilter === "all" ? "700" : "500" }}>Alle Mitarbeiter</Text>
                    {assigneeFilter === "all" && <IconSymbol name="checkmark.circle.fill" size={20} color={colors.primary} />}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
                    onPress={() => { setAssigneeFilter("unassigned"); setShowAssigneeFilterPicker(false); }}
                  >
                    <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: assigneeFilter === "unassigned" ? "700" : "500" }}>Nicht zugewiesen</Text>
                    {assigneeFilter === "unassigned" && <IconSymbol name="checkmark.circle.fill" size={20} color={colors.primary} />}
                  </TouchableOpacity>

                  {allUsers.map((u: any) => (
                    <TouchableOpacity
                      key={u.id}
                      style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
                      onPress={() => { setAssigneeFilter(u.id); setShowAssigneeFilterPicker(false); }}
                    >
                      <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: assigneeFilter === u.id ? "700" : "500" }}>{u.name}</Text>
                      {assigneeFilter === u.id && <IconSymbol name="checkmark.circle.fill" size={20} color={colors.primary} />}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
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
  const [dueDate, setDueDate] = useState<string | null>(ticket.due_date || null);
  const [linkedProjectId, setLinkedProjectId] = useState<string | null>((ticket as any).project_id || null);

  // Laufende Projekte des Kunden (für die Zuordnung der Aufwände)
  const { data: customerProjects = [] } = useQuery({
    queryKey: ["customerProjects", ticket.customer_id],
    queryFn: () => Data.getCustomerProjects(ticket.customer_id as string),
    enabled: !!ticket.customer_id,
  });

  const handleProjectChange = async (projectId: string | null) => {
    const prev = linkedProjectId;
    setLinkedProjectId(projectId);
    try {
      await Data.updateTicket(ticket.id, { project_id: projectId } as any);
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      showToast(projectId ? "Ticket dem Projekt zugeordnet" : "Projekt-Zuordnung entfernt");
    } catch (e: any) {
      setLinkedProjectId(prev);
      showAlert("Fehler", "Zuordnung konnte nicht gespeichert werden: " + e.message);
    }
  };
  const dueDateOverdue = !!dueDate && currentStatus !== "closed" &&
    new Date(dueDate) < new Date(new Date().setHours(0, 0, 0, 0));

  const handleDueDateChange = async (newDate: string | null) => {
    const prev = dueDate;
    setDueDate(newDate);
    try {
      await Data.updateTicket(ticket.id, { due_date: newDate } as any);
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    } catch (e: any) {
      setDueDate(prev);
      showAlert("Fehler", "Fälligkeit konnte nicht gespeichert werden: " + e.message);
    }
  };
  const [newComment, setNewComment] = useState("");
  const [addingComment, setAddingComment] = useState(false);
  const [isInternalComment, setIsInternalComment] = useState(true);

  // Textbausteine (zentral im App-Einstellungs-Store) + KI-Antwortvorschlag
  const [showSnippets, setShowSnippets] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const { data: appSettings = {} } = useQuery({
    queryKey: ["marketingSettings"],
    queryFn: Data.getMarketingSettings,
  });
  const snippets: string[] = React.useMemo(() => {
    try { return JSON.parse((appSettings as any).ticket_snippets || "[]"); } catch { return []; }
  }, [appSettings]);
  const saveSnippets = async (list: string[]) => {
    try {
      await Data.setMarketingSetting("ticket_snippets", JSON.stringify(list));
      queryClient.invalidateQueries({ queryKey: ["marketingSettings"] });
    } catch (e: any) {
      showAlert("Fehler", "Baustein konnte nicht gespeichert werden: " + e.message);
    }
  };

  const handleSuggestReply = async () => {
    setSuggesting(true);
    try {
      const { data, error } = await Data.supabase.functions.invoke("suggest-reply", {
        body: { ticket_id: ticket.id },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (data?.reply) {
        setNewComment(data.reply);
        setIsInternalComment(false); // Vorschlag ist als Kundenantwort formuliert
      }
    } catch (e: any) {
      showAlert("Fehler", "KI-Vorschlag fehlgeschlagen: " + e.message);
    } finally {
      setSuggesting(false);
    }
  };
  const [showAssignPicker, setShowAssignPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedContract, setSelectedContract] = useState<any>(null);

  // Verträge des Kunden laden
  const { data: customerContracts = [], isLoading: isLoadingContracts } = useQuery({
    queryKey: ["customerContracts", ticket.customer_id],
    queryFn: () => Data.getCustomerContracts(ticket.customer_id as string),
    enabled: !!ticket.customer_id,
  });

  // Kunden laden
  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: Data.getCustomersWithCounts,
  });

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
  const [coveredByContract, setCoveredByContract] = useState<boolean>(!!ticket.covered_by_contract);

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

  const handleCoveredByContractChange = async (value: boolean) => {
    setCoveredByContract(value);
    try {
      await Data.updateTicket(ticket.id, { covered_by_contract: value } as any);
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    } catch (err: any) {
      setCoveredByContract(!value);
      showAlert("Fehler", err.message);
    }
  };

  const handleStatusChange = async (newStatus: TicketStatus) => {
    // Speziallogik beim Schliessen eines Tickets
    if (newStatus === "closed") {
      if (coveredByContract) {
        // Im Vertrag abgedeckt → direkt schliessen ohne Rechnungsdialog
        setCurrentStatus("closed");
        try {
          await Data.updateTicket(ticket.id, { status: "closed" });
          queryClient.invalidateQueries({ queryKey: ["tickets"] });
        } catch (err: any) {
          setCurrentStatus(ticket.status);
          showAlert("Fehler", err.message);
        }
        return;
      }
      if (ticketItems.length > 0) {
        // Positionen vorhanden → Rechnung erstellen?
        showConfirm2(
          "Ticket schliessen",
          `Dieses Ticket hat ${ticketItems.length} Aufwand/Position(en). Möchten Sie direkt eine Rechnung erstellen?`,
          "Rechnung erstellen",
          async () => {
            setCurrentStatus("closed");
            try {
              await Data.updateTicket(ticket.id, { status: "closed" });
              queryClient.invalidateQueries({ queryKey: ["tickets"] });
            } catch (err: any) {
              setCurrentStatus(ticket.status);
              showAlert("Fehler", err.message);
              return;
            }
            await handleCreateInvoice();
          },
          "Nur schliessen",
          async () => {
            setCurrentStatus("closed");
            try {
              await Data.updateTicket(ticket.id, { status: "closed" });
              queryClient.invalidateQueries({ queryKey: ["tickets"] });
            } catch (err: any) {
              setCurrentStatus(ticket.status);
              showAlert("Fehler", err.message);
            }
          }
        );
        return;
      } else {
        // Keine Positionen → Aufwände erfassen?
        showConfirm2(
          "Ticket schliessen",
          "Diesem Ticket sind noch keine Aufwände oder Positionen erfasst. Möchten Sie diese noch erfassen, bevor Sie das Ticket schliessen?",
          "Aufwände erfassen",
          () => {
            setActiveTab("items");
            setShowStatusPicker(false);
          },
          "Trotzdem schliessen",
          async () => {
            setCurrentStatus("closed");
            try {
              await Data.updateTicket(ticket.id, { status: "closed" });
              queryClient.invalidateQueries({ queryKey: ["tickets"] });
            } catch (err: any) {
              setCurrentStatus(ticket.status);
              showAlert("Fehler", err.message);
            }
          }
        );
        return;
      }
    }

    setCurrentStatus(newStatus);
    try {
      await Data.updateTicket(ticket.id, { status: newStatus });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    } catch (err: any) {
      setCurrentStatus(ticket.status);
      showAlert("Fehler", err.message);
    }
  };

  const handleCustomerChange = async (customerId: string | null) => {
    try {
      // Automatik: Kunde mit aktivem Vertrag → Abdeckung direkt mitsetzen
      let covered = false;
      if (customerId) {
        covered = await Data.customerHasActiveContract(customerId).catch(() => false);
      }
      await Data.updateTicket(ticket.id, { customer_id: customerId, covered_by_contract: covered });
      setCoveredByContract(covered);
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      setShowCustomerPicker(false);
      showToast(covered ? "Kunde geändert – aktiver Vertrag erkannt, als abgedeckt markiert" : "Kunde erfolgreich geändert");
    } catch (err: any) {
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
        invoice_number: await Data.getNextInvoiceNumber(),
        status: "draft",
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

  const { isWide } = useResponsiveLayout();

  const renderMetadataSection = () => (
    <View style={{ gap: 16 }}>
      {/* ── Info Cards ── */}
      <View style={{ gap: 10 }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <IconSymbol name="person.2.fill" size={13} color={colors.muted} />
              <Text style={{ fontSize: 10, fontWeight: "600", color: colors.muted, textTransform: "uppercase" }}>Kunde</Text>
            </View>
            <TouchableOpacity onPress={() => setShowCustomerPicker(!showCustomerPicker)} hitSlop={{top:10, bottom:10, left:10, right:10}}>
              <IconSymbol name={showCustomerPicker ? "chevron.up" : "pencil"} size={14} color={colors.primary} />
            </TouchableOpacity>
          </View>
          {!showCustomerPicker ? (
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }} numberOfLines={2}>{customerName}</Text>
          ) : (
            <View style={{ marginTop: 4 }}>
              <TextInput
                value={customerSearch}
                onChangeText={setCustomerSearch}
                placeholder="Kunde suchen..."
                placeholderTextColor={colors.muted}
                style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground, fontSize: 13, marginBottom: 8 }}
              />
              <ScrollView style={{ maxHeight: 150 }} keyboardShouldPersistTaps="handled">
                <TouchableOpacity onPress={() => handleCustomerChange(null)} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border + "40" }}>
                  <Text style={{ color: colors.muted, fontStyle: "italic", fontSize: 13 }}>Kein Kunde</Text>
                </TouchableOpacity>
                {customers.filter((c: any) => {
                  if (!customerSearch.trim()) return true;
                  const term = customerSearch.toLowerCase();
                  return (c.company_name || "").toLowerCase().includes(term) || 
                         (c.first_name || "").toLowerCase().includes(term) || 
                         (c.last_name || "").toLowerCase().includes(term) || 
                         (c.email || "").toLowerCase().includes(term);
                }).slice(0, 20).map((c: any) => {
                  const cName = c.company_name || `${c.first_name || ""} ${c.last_name || ""}`.trim() || c.email || "Unbekannt";
                  const isSelected = ticket.customer_id === c.id;
                  return (
                    <TouchableOpacity key={c.id} onPress={() => handleCustomerChange(c.id)} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border + "40", flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: isSelected ? "700" : "400" }}>{cName}</Text>
                      {isSelected && <IconSymbol name="checkmark" size={14} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Verträge anzeigen */}
        {ticket.customer_id && (
          <View style={{ marginTop: 2 }}>
            <Text style={{ fontSize: 10, fontWeight: "600", color: colors.muted, textTransform: "uppercase", marginBottom: 6 }}>Vorhandene Verträge</Text>
            {isLoadingContracts ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ alignSelf: 'flex-start' }} />
            ) : customerContracts.length > 0 ? (
              <View style={{ gap: 6 }}>
                {customerContracts.map((contract: any) => (
                  <TouchableOpacity
                    key={contract.id}
                    style={{ backgroundColor: colors.surface, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                    onPress={() => setSelectedContract(contract)}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <IconSymbol name="doc.text.fill" size={14} color={colors.primary} />
                      <View>
                        <Text style={{ fontSize: 12, fontWeight: "600", color: colors.foreground }}>{contract.title}</Text>
                        <Text style={{ fontSize: 10, color: colors.muted }}>{contract.status === "active" ? "Aktiv" : contract.status === "expired" ? "Abgelaufen" : "Gekündigt"}</Text>
                      </View>
                    </View>
                    <IconSymbol name="chevron.right" size={12} color={colors.muted} />
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={{ fontSize: 12, color: colors.muted, fontStyle: 'italic' }}>Keine Verträge für diesen Kunden gefunden.</Text>
            )}
          </View>
        )}

        {(!ticket.customer_id && (ticket.contact_name || ticket.contact_email)) && (
          <View style={{ backgroundColor: colors.primary + "10", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.primary + "30" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <IconSymbol name="globe" size={16} color={colors.primary} />
              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary, textTransform: "uppercase" }}>Gastanfrage</Text>
            </View>
            <View style={{ gap: 6 }}>
              {ticket.contact_name && <Text style={{ fontSize: 14, color: colors.foreground }}><Text style={{ fontWeight: "600" }}>Name:</Text> {ticket.contact_name}</Text>}
              {ticket.contact_company && <Text style={{ fontSize: 14, color: colors.foreground }}><Text style={{ fontWeight: "600" }}>Firma:</Text> {ticket.contact_company}</Text>}
              {ticket.contact_email && <Text style={{ fontSize: 14, color: colors.foreground }}><Text style={{ fontWeight: "600" }}>E-Mail:</Text> {ticket.contact_email}</Text>}
              {ticket.contact_phone && <Text style={{ fontSize: 14, color: colors.foreground }}><Text style={{ fontWeight: "600" }}>Telefon:</Text> {ticket.contact_phone}</Text>}
            </View>
          </View>
        )}

        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border, flexDirection: "row", justifyContent: "space-between" }}>
          <View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <IconSymbol name="calendar" size={13} color={colors.muted} />
              <Text style={{ fontSize: 10, fontWeight: "600", color: colors.muted, textTransform: "uppercase" }}>Erstellt</Text>
            </View>
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>{formatDate(ticket.created_at)}</Text>
          </View>
          <Text style={{ fontSize: 12, color: colors.muted, alignSelf: "flex-end" }}>{ageLabel}</Text>
        </View>
      </View>

      {/* ── Status, Priorität, Assignee ── */}
      <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border }}>
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.muted, textTransform: "uppercase", marginBottom: 6 }}>Zugewiesen an</Text>
          <TouchableOpacity
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 }}
            onPress={() => setShowAssignPicker(!showAssignPicker)}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: assignedUser ? colors.primary : colors.muted + "30", alignItems: "center", justifyContent: "center" }}>
                {assignedUser ? (
                  <Text style={{ color: "#FFF", fontSize: 10, fontWeight: "700" }}>
                    {(assignedUser.name || "?").split(" ").map((p: string) => p[0]).join("").toUpperCase().slice(0, 2)}
                  </Text>
                ) : (
                  <IconSymbol name="person.fill.badge.plus" size={12} color={colors.muted} />
                )}
              </View>
              <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "500" }}>{assignedUser ? assignedUser.name : "Niemand"}</Text>
            </View>
            <IconSymbol name={showAssignPicker ? "chevron.up" : "chevron.down"} size={14} color={colors.muted} />
          </TouchableOpacity>
          {showAssignPicker && (
            <View style={{ marginTop: 8, gap: 4 }}>
              <TouchableOpacity onPress={() => handleAssign(null)} style={{ paddingVertical: 8 }}><Text style={{ color: colors.muted, fontStyle: "italic" }}>Nicht zugewiesen</Text></TouchableOpacity>
              {users.map((u) => (
                <TouchableOpacity key={u.id} onPress={() => handleAssign(u.id)} style={{ paddingVertical: 8, flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.foreground, fontWeight: assignedTo === u.id ? "700" : "400" }}>{u.name}</Text>
                  {assignedTo === u.id && <IconSymbol name="checkmark" size={14} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 12 }} />

        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.muted, textTransform: "uppercase", marginBottom: 6 }}>Status</Text>
          <TouchableOpacity
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 }}
            onPress={() => setShowStatusPicker(!showStatusPicker)}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: sCfg.color }} />
              <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>{sCfg.label}</Text>
            </View>
            <IconSymbol name={showStatusPicker ? "chevron.up" : "chevron.down"} size={14} color={colors.muted} />
          </TouchableOpacity>
          {showStatusPicker && (
            <View style={{ marginTop: 8, gap: 4 }}>
              {statusOptions.map((opt) => (
                <TouchableOpacity key={opt.key} onPress={() => { handleStatusChange(opt.key); setShowStatusPicker(false); }} style={{ paddingVertical: 8, flexDirection: "row", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: opt.color }} />
                    <Text style={{ color: colors.foreground, fontWeight: currentStatus === opt.key ? "700" : "400" }}>{opt.label}</Text>
                  </View>
                  {currentStatus === opt.key && <IconSymbol name="checkmark" size={14} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 12 }} />

        <View>
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.muted, textTransform: "uppercase", marginBottom: 6 }}>Priorität</Text>
          <TouchableOpacity
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 }}
            onPress={() => setShowPriorityPicker(!showPriorityPicker)}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: pCfg.color }} />
              <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>{pCfg.label}</Text>
            </View>
            <IconSymbol name={showPriorityPicker ? "chevron.up" : "chevron.down"} size={14} color={colors.muted} />
          </TouchableOpacity>
          {showPriorityPicker && (
            <View style={{ marginTop: 8, gap: 4 }}>
              {priorityOptions.map((opt) => (
                <TouchableOpacity key={opt.key} onPress={() => { handlePriorityChange(opt.key); setShowPriorityPicker(false); }} style={{ paddingVertical: 8, flexDirection: "row", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: opt.color }} />
                    <Text style={{ color: colors.foreground, fontWeight: currentPriority === opt.key ? "700" : "400" }}>{opt.label}</Text>
                  </View>
                  {currentPriority === opt.key && <IconSymbol name="checkmark" size={14} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Fälligkeit */}
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.muted, textTransform: "uppercase", marginTop: 14, marginBottom: 6 }}>Fälligkeit</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            {dueDate ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: (dueDateOverdue ? colors.error : colors.primary) + "15", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 }}>
                <IconSymbol name={dueDateOverdue ? "exclamationmark.triangle.fill" : "calendar"} size={12} color={dueDateOverdue ? colors.error : colors.primary} />
                <Text style={{ fontSize: 12, fontWeight: "700", color: dueDateOverdue ? colors.error : colors.primary }}>
                  {formatDate(dueDate)}
                </Text>
                <TouchableOpacity onPress={() => handleDueDateChange(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <IconSymbol name="xmark.circle.fill" size={14} color={colors.muted} />
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={{ fontSize: 12, color: colors.muted, marginRight: 4 }}>Keine –</Text>
            )}
            {([["Heute", 0], ["Morgen", 1], ["+1 Woche", 7]] as const).map(([label, days]) => (
              <TouchableOpacity
                key={label}
                onPress={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + days);
                  handleDueDateChange(d.toISOString().split("T")[0]);
                }}
                activeOpacity={0.7}
                style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background }}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: colors.foreground }}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Projekt-Zuordnung: Aufwände erscheinen im Projekt */}
          {customerProjects.length > 0 && (
            <>
              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.muted, textTransform: "uppercase", marginTop: 14, marginBottom: 6 }}>Projekt</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                <TouchableOpacity
                  onPress={() => handleProjectChange(null)}
                  activeOpacity={0.7}
                  style={{
                    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1,
                    borderColor: !linkedProjectId ? colors.primary : colors.border,
                    backgroundColor: !linkedProjectId ? colors.primary + "15" : colors.background,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "600", color: !linkedProjectId ? colors.primary : colors.foreground }}>Kein Projekt</Text>
                </TouchableOpacity>
                {customerProjects.map((p: any) => {
                  const active = linkedProjectId === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      onPress={() => handleProjectChange(p.id)}
                      activeOpacity={0.7}
                      style={{
                        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1,
                        borderColor: active ? "#14B8A6" : colors.border,
                        backgroundColor: active ? "#14B8A615" : colors.background,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "600", color: active ? "#14B8A6" : colors.foreground }} numberOfLines={1}>
                        {p.project_number} · {p.title}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </View>
      </View>

      {/* Footer Actions am Desktop unten rechts */}
      {isWide && renderFooterActions()}
    </View>
  );

  const renderFooterActions = () => (
    <View style={{ flexDirection: isWide ? "column" : "row", gap: 10 }}>
      {currentStatus === "closed" && !coveredByContract && (
        <TouchableOpacity
          style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.primary + "10", borderWidth: 1, borderColor: colors.primary + "25", paddingVertical: 12, borderRadius: 12 }}
          onPress={handleCreateInvoice}
          activeOpacity={0.8}
        >
          <IconSymbol name="doc.text.fill" size={14} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>Rechnung</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.error + "10", borderWidth: 1, borderColor: colors.error + "25", paddingVertical: 12, borderRadius: 12 }}
        onPress={handleDelete}
        activeOpacity={0.8}
      >
        <IconSymbol name="trash.fill" size={14} color={colors.error} />
        <Text style={{ color: colors.error, fontWeight: "600", fontSize: 14 }}>Löschen</Text>
      </TouchableOpacity>
      
      {!isWide && (
        <TouchableOpacity
          style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingVertical: 12, borderRadius: 12 }}
          onPress={onClose}
          activeOpacity={0.8}
        >
          <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }}>Schliessen</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderMainContent = () => (
    <View style={{ gap: 16 }}>
      {/* ── Tabs (Kommentare vs Aufwände) ── */}
      <View style={{ flexDirection: "row", backgroundColor: colors.surface, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: colors.border }}>
        <TouchableOpacity
          style={{ flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 8, backgroundColor: activeTab === "comments" ? colors.primary + "20" : "transparent" }}
          onPress={() => setActiveTab("comments")}
        >
          <Text style={{ fontSize: 13, fontWeight: activeTab === "comments" ? "700" : "500", color: activeTab === "comments" ? colors.primary : colors.muted }}>Kommentare ({comments?.length || 0})</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 8, backgroundColor: activeTab === "items" ? colors.primary + "20" : "transparent" }}
          onPress={() => setActiveTab("items")}
        >
          <Text style={{ fontSize: 13, fontWeight: activeTab === "items" ? "700" : "500", color: activeTab === "items" ? colors.primary : colors.muted }}>Aufwände & Positionen</Text>
        </TouchableOpacity>
      </View>

      {activeTab === "comments" ? (
        <View>
          {ticket.description && (
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 16 }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, textTransform: "uppercase", marginBottom: 8 }}>Beschreibung vom {formatDate(ticket.created_at)}</Text>
              <Text style={{ fontSize: 15, color: colors.foreground, lineHeight: 22 }}>{ticket.description}</Text>
            </View>
          )}
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

          {/* Textbausteine + KI-Vorschlag */}
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <TouchableOpacity
              style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: showSnippets ? colors.primary : colors.border, backgroundColor: showSnippets ? colors.primary + "12" : colors.surface }}
              onPress={() => setShowSnippets(!showSnippets)}
              activeOpacity={0.7}
            >
              <IconSymbol name="note.text" size={12} color={colors.primary} />
              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.primary }}>Textbausteine</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, opacity: suggesting ? 0.6 : 1 }}
              onPress={handleSuggestReply}
              disabled={suggesting}
              activeOpacity={0.7}
            >
              {suggesting ? (
                <ActivityIndicator size="small" color="#8B5CF6" />
              ) : (
                <IconSymbol name="lightbulb.fill" size={12} color="#8B5CF6" />
              )}
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#8B5CF6" }}>
                {suggesting ? "KI schreibt…" : "KI-Antwort vorschlagen"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Baustein-Liste */}
          {showSnippets && (
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
              {snippets.length === 0 && (
                <Text style={{ fontSize: 12, color: colors.muted, padding: 12 }}>
                  Noch keine Bausteine. Text ins Kommentarfeld schreiben und unten speichern.
                </Text>
              )}
              {snippets.map((s, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={{ paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: colors.border }}
                  onPress={() => { setNewComment(newComment ? newComment + "\n" + s : s); setShowSnippets(false); }}
                  onLongPress={() => {
                    showConfirm("Baustein löschen", `"${s.substring(0, 60)}…" entfernen?`, () => {
                      saveSnippets(snippets.filter((_, i) => i !== idx));
                    }, "Löschen");
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 13, color: colors.foreground }} numberOfLines={2}>{s}</Text>
                </TouchableOpacity>
              ))}
              {newComment.trim().length > 0 && !snippets.includes(newComment.trim()) && (
                <TouchableOpacity
                  style={{ paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: snippets.length > 0 ? 1 : 0, borderTopColor: colors.border }}
                  onPress={() => saveSnippets([...snippets, newComment.trim()])}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>
                    + Aktuellen Text als Baustein speichern
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

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
        <View style={{ gap: 12 }}>
          {/* Im Vertrag abgedeckt Toggle */}
          <View style={{
            backgroundColor: coveredByContract ? colors.success + "12" : colors.surface,
            borderRadius: 14,
            padding: 14,
            borderWidth: 1,
            borderColor: coveredByContract ? colors.success + "40" : colors.border,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <IconSymbol
                  name={coveredByContract ? "checkmark.shield.fill" : "shield"}
                  size={15}
                  color={coveredByContract ? colors.success : colors.muted}
                />
                <Text style={{ fontSize: 14, fontWeight: "700", color: coveredByContract ? colors.success : colors.foreground }}>
                  Im Vertrag abgedeckt
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: colors.muted, lineHeight: 17 }}>
                {coveredByContract
                  ? "Leistungen sind vertraglich gedeckt — beim Schliessen wird keine Rechnung erstellt."
                  : "Beim Schliessen wird gefragt, ob eine Rechnung erstellt werden soll."}
              </Text>
            </View>
            <Switch
              value={coveredByContract}
              onValueChange={handleCoveredByContractChange}
              trackColor={{ false: colors.border, true: colors.success + "80" }}
              thumbColor={coveredByContract ? colors.success : colors.muted}
            />
          </View>

          <TicketItemsList
            ticketId={ticket.id}
            ticketItems={ticketItems}
            products={products}
            colors={colors}
            onRefresh={refetchTicketItems}
          />
        </View>
      )}
    </View>
  );

  return (
    <Modal visible={true} animationType={isWide ? "fade" : "slide"} transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: isWide ? 'center' : 'flex-end', alignItems: 'center' }}>
          <TouchableOpacity activeOpacity={1} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} onPress={onClose} />
          
          <View 
            style={{ 
              backgroundColor: colors.background, 
              borderRadius: isWide ? 24 : 0,
              borderTopLeftRadius: 24, 
              borderTopRightRadius: 24,
              width: isWide ? 900 : '100%',
              maxWidth: '100%',
              height: isWide ? '85%' : '90%',
              overflow: 'hidden'
            }}
          >
              {/* ── Hero Header ── */}
              <View style={{ padding: 24, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1, marginRight: 16 }}>
                  <Text style={{ fontSize: 24, fontWeight: "800", color: colors.foreground, lineHeight: 30 }}>
                    {ticket.title}
                  </Text>
                </View>
                {isWide && (
                  <TouchableOpacity onPress={onClose} activeOpacity={0.7} hitSlop={{top:10, bottom:10, left:10, right:10}}>
                    <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
                  </TouchableOpacity>
                )}
                {!isWide && (
                  <TouchableOpacity onPress={onClose} activeOpacity={0.7} hitSlop={{top:10, bottom:10, left:10, right:10}} style={{ backgroundColor: colors.surface, padding: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }}>Schliessen</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* ── Content ── */}
              <ScrollView 
                style={{ flex: 1 }} 
                contentContainerStyle={{ padding: isWide ? 24 : 16 }}
                showsVerticalScrollIndicator={false}
              >
                <View style={{ flexDirection: isWide ? "row" : "column", gap: 24 }}>
                  {/* On Mobile: Metadata first */}
                  {!isWide && renderMetadataSection()}

                  {/* Main Content (Left column on Wide) */}
                  <View style={{ flex: isWide ? 2 : undefined }}>
                    {renderMainContent()}
                  </View>

                  {/* On Wide: Metadata on the right */}
                  {isWide && (
                    <View style={{ flex: 1 }}>
                      {renderMetadataSection()}
                    </View>
                  )}
                </View>
                
                {/* On Mobile: Footer actions at the bottom of the scroll */}
                {!isWide && (
                  <View style={{ marginTop: 24, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 20 }}>
                     {renderFooterActions()}
                  </View>
                )}
              </ScrollView>
            </View>
        </View>
      </KeyboardAvoidingView>

      {selectedContract && (
        <ContractFormModal
          visible={!!selectedContract}
          contract={selectedContract}
          onClose={() => setSelectedContract(null)}
        />
      )}
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


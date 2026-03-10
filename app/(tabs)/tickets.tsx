import { useState, useEffect } from "react";
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
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { TicketFormModal } from "@/components/ticket-form-modal";
import { formatDate, formatDateTime } from "@/lib/format";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { showAlert, showConfirm } from "@/lib/alert";

type TicketStatus = "open" | "in_progress" | "waiting" | "closed";
type TicketPriority = "low" | "medium" | "high";

export default function TicketsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { isWide, containerStyle, contentPadding } = useResponsiveLayout();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | TicketStatus>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [currentUserName, setCurrentUserName] = useState("Admin");

  // Mitarbeitende laden für Filter
  const { data: allUsers = [] } = useQuery({
    queryKey: ["users"],
    queryFn: Data.getAllUsers,
  });

  // Aktuellen Benutzer-Namen laden
  useEffect(() => {
    Data.supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
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
  });

  const deleteTicketMutation = useMutation({
    mutationFn: (ticketId: string) => Data.deleteTicket(ticketId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["customer"] });
      showAlert("Erfolg", "Ticket erfolgreich gelöscht");
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

  const filteredTickets = tickets
    .filter((t) => filter === "all" || t.status === filter)
    .filter((t) => assigneeFilter === "all" || t.assigned_to === assigneeFilter);

  const renderTicketItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      className="bg-surface rounded-xl p-4 mb-3 border border-border"
      activeOpacity={0.7}
      onPress={() => setSelectedTicket(item)}
    >
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1">
          <Text className="text-lg font-semibold text-foreground mb-1">{item.title}</Text>
          <Text className="text-sm text-muted">{item.customer?.company_name || `${item.customer?.first_name || ''} ${item.customer?.last_name || ''}`.trim() || 'Unbekannt'}</Text>
        </View>
        <View
          className="px-3 py-1 rounded-full ml-2"
          style={{ backgroundColor: getPriorityColor(item.priority) + "20" }}
        >
          <Text
            className="text-xs font-semibold"
            style={{ color: getPriorityColor(item.priority) }}
          >
            {getPriorityLabel(item.priority)}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center justify-between mt-2">
        <View
          className="px-3 py-1 rounded-full"
          style={{ backgroundColor: getStatusColor(item.status) + "20" }}
        >
          <Text
            className="text-xs font-semibold"
            style={{ color: getStatusColor(item.status) }}
          >
            {getStatusLabel(item.status)}
          </Text>
        </View>
        <Text className="text-xs text-muted">{formatDate(item.createdAt)}</Text>
      </View>
    </TouchableOpacity>
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
              <Text className="text-3xl font-bold text-foreground">Tickets</Text>
            </View>
            <TouchableOpacity
              className="bg-primary w-12 h-12 rounded-full items-center justify-center"
              activeOpacity={0.8}
              onPress={() => setShowAddModal(true)}
            >
              <IconSymbol name="plus.circle.fill" size={24} color="#111111" />
            </TouchableOpacity>
          </View>

          {/* Statistik */}
          <View className="flex-row gap-3 mb-4">
            <View className="flex-1 bg-surface rounded-lg p-2 border border-border">
              <Text className="text-lg font-bold text-error">
                {tickets.filter((t) => t.status === "open").length}
              </Text>
              <Text className="text-[10px] text-muted">Offen</Text>
            </View>
            <View className="flex-1 bg-surface rounded-lg p-2 border border-border">
              <Text className="text-lg font-bold text-primary">
                {tickets.filter((t) => t.status === "in_progress").length}
              </Text>
              <Text className="text-[10px] text-muted">In Arbeit</Text>
            </View>
            <View className="flex-1 bg-surface rounded-lg p-2 border border-border">
              <Text className="text-lg font-bold text-success">
                {tickets.filter((t) => t.status === "closed").length}
              </Text>
              <Text className="text-[10px] text-muted">Gelöst</Text>
            </View>
          </View>

          {/* Filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4" style={{ flexGrow: 0 }}>
            <View className="flex-row gap-2">
              {["all", "open", "in_progress", "waiting", "closed"].map((status) => (
                <TouchableOpacity
                  key={status}
                  className={`px-3 py-1.5 rounded-md ${filter === status ? "bg-primary" : "bg-surface border border-border"
                    }`}
                  onPress={() => setFilter(status as any)}
                >
                  <Text
                    className={`text-sm font-semibold ${filter === status ? "text-background" : "text-foreground"
                      }`}
                  >
                    {status === "all"
                      ? "Alle"
                      : getStatusLabel(status as TicketStatus)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Zuweisungs-Filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4" style={{ flexGrow: 0 }}>
            <View className="flex-row gap-2">
              <TouchableOpacity
                className={`px-3 py-1.5 rounded-md ${assigneeFilter === "all" ? "bg-primary" : "bg-surface border border-border"}`}
                onPress={() => setAssigneeFilter("all")}
              >
                <Text className={`text-sm font-semibold ${assigneeFilter === "all" ? "text-background" : "text-foreground"}`}>
                  Alle Zuweisungen
                </Text>
              </TouchableOpacity>
              {allUsers.map((user: any) => (
                <TouchableOpacity
                  key={user.id}
                  className={`px-3 py-1.5 rounded-md ${assigneeFilter === user.id ? "bg-primary" : "bg-surface border border-border"}`}
                  onPress={() => setAssigneeFilter(user.id)}
                >
                  <Text className={`text-sm font-semibold ${assigneeFilter === user.id ? "text-background" : "text-foreground"}`}>
                    {user.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Ticket-Liste */}
          {isLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : filteredTickets.length > 0 ? (
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
        onSuccess={() => { }}
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
  const colors = useColors();
  const queryClient = useQueryClient();
  const [currentStatus, setCurrentStatus] = useState<TicketStatus>(ticket.status || "open");
  const [currentPriority, setCurrentPriority] = useState<TicketPriority>(ticket.priority || "medium");
  const [assignedTo, setAssignedTo] = useState<string | null>(ticket.assigned_to || null);
  const [newComment, setNewComment] = useState("");
  const [addingComment, setAddingComment] = useState(false);
  const [isInternalComment, setIsInternalComment] = useState(true);
  const [showAssignPicker, setShowAssignPicker] = useState(false);

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
      // Push-Benachrichtigung an zugewiesenen Mitarbeiter
      if (userId) {
        const assignedUserName = users.find((u: any) => u.id === userId)?.name || "Jemand";
        Data.triggerPushNotification(
          [userId],
          "admin",
          "Ticket zugewiesen",
          `Dir wurde das Ticket "${ticket.title}" zugewiesen.`,
          { type: "ticket_assigned", ticketId: ticket.id }
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

  const assignedUser = users.find((u: any) => u.id === assignedTo);

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

              {ticket.description ? (
                <View>
                  <Text className="text-sm text-muted mb-1">Beschreibung</Text>
                  <Text className="text-base text-foreground">{ticket.description}</Text>
                </View>
              ) : null}

              <View className="flex-row gap-4">
                <View className="flex-1">
                  <Text className="text-sm text-muted mb-1">Kunde</Text>
                  <Text className="text-base text-foreground">
                    {ticket.customer?.company_name || `${ticket.customer?.first_name || ""} ${ticket.customer?.last_name || ""}`.trim() || 'Kein Kunde'}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-sm text-muted mb-1">Erstellt am</Text>
                  <Text className="text-base text-foreground">{formatDate(ticket.created_at)}</Text>
                </View>
              </View>

              {/* Zugewiesen an */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">Zugewiesen an</Text>
                <TouchableOpacity
                  className="bg-surface border border-border rounded-lg px-3 py-3 flex-row items-center justify-between"
                  onPress={() => setShowAssignPicker(!showAssignPicker)}
                  activeOpacity={0.7}
                >
                  <Text className="text-foreground text-sm">
                    {assignedUser ? assignedUser.name : "Nicht zugewiesen"}
                  </Text>
                  <IconSymbol name="chevron.down" size={14} color={colors.muted} />
                </TouchableOpacity>

                {showAssignPicker && (
                  <View className="bg-surface border border-border rounded-lg mt-1 overflow-hidden">
                    <TouchableOpacity
                      className="px-3 py-3 border-b border-border"
                      onPress={() => handleAssign(null)}
                      activeOpacity={0.7}
                    >
                      <Text className="text-sm text-muted italic">Nicht zugewiesen</Text>
                    </TouchableOpacity>
                    {users.map((user: any) => (
                      <TouchableOpacity
                        key={user.id}
                        className="px-3 py-3 border-b border-border flex-row items-center justify-between"
                        onPress={() => handleAssign(user.id)}
                        activeOpacity={0.7}
                        style={{ backgroundColor: assignedTo === user.id ? colors.primary + "15" : "transparent" }}
                      >
                        <Text className="text-sm text-foreground">{user.name}</Text>
                        {assignedTo === user.id && (
                          <IconSymbol name="checkmark" size={14} color={colors.primary} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Status ändern */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">Status</Text>
                <View className="flex-row flex-wrap gap-2">
                  {statusOptions.map((opt) => (
                    <TouchableOpacity
                      key={opt.key}
                      className="px-3 py-2 rounded-lg"
                      style={{
                        backgroundColor: currentStatus === opt.key ? opt.color : opt.color + "15",
                        borderWidth: currentStatus === opt.key ? 0 : 1,
                        borderColor: currentStatus === opt.key ? "transparent" : opt.color + "40",
                      }}
                      onPress={() => handleStatusChange(opt.key)}
                      activeOpacity={0.7}
                    >
                      <Text
                        className="text-xs font-semibold"
                        style={{ color: currentStatus === opt.key ? "#FFFFFF" : opt.color }}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Priorität ändern */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">Priorität</Text>
                <View className="flex-row flex-wrap gap-2">
                  {priorityOptions.map((opt) => (
                    <TouchableOpacity
                      key={opt.key}
                      className="px-3 py-2 rounded-lg"
                      style={{
                        backgroundColor: currentPriority === opt.key ? opt.color : opt.color + "15",
                        borderWidth: currentPriority === opt.key ? 0 : 1,
                        borderColor: currentPriority === opt.key ? "transparent" : opt.color + "40",
                      }}
                      onPress={() => handlePriorityChange(opt.key)}
                      activeOpacity={0.7}
                    >
                      <Text
                        className="text-xs font-semibold"
                        style={{ color: currentPriority === opt.key ? "#FFFFFF" : opt.color }}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Kommentare / Historie */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">Kommentare & Historie</Text>

                {comments && comments.length > 0 ? (
                  <View className="gap-2 mb-3">
                    {comments.map((c: any) => (
                      <View key={c.id} className="bg-surface p-3 rounded-lg border border-border">
                        <View className="flex-row items-center justify-between mb-1">
                          <View className="flex-row items-center gap-2">
                            <Text className="text-xs font-semibold text-primary">
                              {c.user_name || "System"}
                            </Text>
                            <View className="px-1.5 py-0.5 rounded" style={{ backgroundColor: c.is_internal ? colors.warning + "20" : colors.success + "20" }}>
                              <Text className="text-[10px] font-semibold" style={{ color: c.is_internal ? colors.warning : colors.success }}>
                                {c.is_internal ? "Intern" : "Kunde sichtbar"}
                              </Text>
                            </View>
                          </View>
                          <Text className="text-xs text-muted">
                            {formatDateTime(c.created_at)}
                          </Text>
                        </View>
                        <Text className="text-sm text-foreground">{c.comment}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text className="text-sm text-muted mb-3">Noch keine Kommentare vorhanden.</Text>
                )}

                {/* Sichtbarkeit Toggle */}
                <View className="flex-row items-center gap-2 mb-2">
                  <TouchableOpacity
                    className="flex-row items-center px-3 py-1.5 rounded-full"
                    style={{
                      backgroundColor: isInternalComment ? colors.warning + "20" : colors.success + "20",
                      borderWidth: 1,
                      borderColor: isInternalComment ? colors.warning + "40" : colors.success + "40",
                    }}
                    onPress={() => setIsInternalComment(!isInternalComment)}
                    activeOpacity={0.7}
                  >
                    <IconSymbol
                      name={isInternalComment ? "lock.fill" : "globe"}
                      size={12}
                      color={isInternalComment ? colors.warning : colors.success}
                    />
                    <Text
                      className="text-xs font-semibold ml-1.5"
                      style={{ color: isInternalComment ? colors.warning : colors.success }}
                    >
                      {isInternalComment ? "Nur intern" : "Kunde sichtbar"}
                    </Text>
                  </TouchableOpacity>
                  <Text className="text-xs text-muted">Tippen um zu wechseln</Text>
                </View>

                {/* Neuer Kommentar */}
                <View className="flex-row gap-2">
                  <TextInput
                    className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                    placeholder="Kommentar schreiben..."
                    placeholderTextColor={colors.muted}
                    value={newComment}
                    onChangeText={setNewComment}
                    multiline
                  />
                  <TouchableOpacity
                    className="bg-primary px-4 rounded-lg justify-center"
                    onPress={handleAddComment}
                    activeOpacity={0.7}
                    disabled={addingComment || !newComment.trim()}
                    style={{ opacity: addingComment || !newComment.trim() ? 0.5 : 1 }}
                  >
                    <IconSymbol name="paperplane.fill" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View className="p-4 border-t border-border flex-row gap-3">
            <TouchableOpacity
              className="flex-1 bg-error/10 border border-error/30 py-3 rounded-lg"
              onPress={handleDelete}
              activeOpacity={0.8}
            >
              <Text className="text-error font-semibold text-center">Löschen</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 bg-surface border border-border py-3 rounded-lg"
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text className="text-foreground font-semibold text-center">Schließen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

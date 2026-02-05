import { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Switch,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { TicketFormModal } from "@/components/ticket-form-modal";
import { formatDate, formatDateTime } from "@/lib/format";

type TicketStatus = "open" | "in_progress" | "waiting" | "closed";
type TicketPriority = "low" | "medium" | "high" | "urgent";

interface Ticket {
  id: number;
  title: string;
  customer: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
}

const mockTickets: Ticket[] = [
  {
    id: 1,
    title: "Problem mit Rechnung #1234",
    customer: "Max Mustermann",
    status: "open",
    priority: "high",
    createdAt: "2026-02-04",
  },
  {
    id: 2,
    title: "Frage zu Vertragslaufzeit",
    customer: "Anna Schmidt",
    status: "in_progress",
    priority: "medium",
    createdAt: "2026-02-03",
  },
  {
    id: 3,
    title: "Technisches Problem",
    customer: "Peter Müller",
    status: "waiting",
    priority: "low",
    createdAt: "2026-02-02",
  },
];

export default function TicketsScreen() {
  const colors = useColors();
  const [tickets] = useState<Ticket[]>(mockTickets);
  const [filter, setFilter] = useState<"all" | TicketStatus>("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

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
      low: "#6C757D",
      medium: colors.primary,
      high: colors.warning,
      urgent: colors.error,
    };
    return colorMap[priority];
  };

  const filteredTickets =
    filter === "all" ? tickets : tickets.filter((t) => t.status === filter);

  const renderTicketItem = ({ item }: { item: Ticket }) => (
    <TouchableOpacity
      className="bg-surface rounded-xl p-4 mb-3 border border-border"
      activeOpacity={0.7}
      onPress={() => setSelectedTicket(item)}
    >
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1">
          <Text className="text-lg font-semibold text-foreground mb-1">{item.title}</Text>
          <Text className="text-sm text-muted">{item.customer}</Text>
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
      <View className="flex-1 p-4">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-3xl font-bold text-foreground">Tickets</Text>
          <TouchableOpacity
            className="bg-primary w-12 h-12 rounded-full items-center justify-center"
            activeOpacity={0.8}
            onPress={() => setShowAddModal(true)}
          >
            <IconSymbol name="plus.circle.fill" size={24} color="#FFFFFF" />
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
          <View className="flex-row gap-2">
            {["all", "open", "in_progress", "waiting", "closed"].map((status) => (
              <TouchableOpacity
                key={status}
                className={`px-4 py-2 rounded-lg ${
                  filter === status ? "bg-primary" : "bg-surface border border-border"
                }`}
                onPress={() => setFilter(status as any)}
              >
                <Text
                  className={`font-semibold ${
                    filter === status ? "text-background" : "text-foreground"
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

        {/* Ticket-Liste */}
        {filteredTickets.length > 0 ? (
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

      {/* Ticket-Formular Modal */}
      <TicketFormModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {}}
      />

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

// Ticket-Details Modal
function TicketDetailsModal({
  ticket,
  onClose,
}: {
  ticket: Ticket;
  onClose: () => void;
}) {
  const colors = useColors();
  const [newComment, setNewComment] = useState("");
  const [isInternal, setIsInternal] = useState(true); // Default: Internal
  const [comments, setComments] = useState([
    {
      id: 1,
      type: "system" as const,
      text: "Ticket erstellt",
      createdAt: ticket.createdAt,
      user: "System",
      isInternal: true,
    },
    {
      id: 2,
      type: "comment" as const,
      text: "Kunde kontaktiert, Problem analysiert",
      createdAt: "2026-02-04T10:30:00",
      user: "Max Muster",
      isInternal: true,
    },
    {
      id: 3,
      type: "comment" as const,
      text: "Frage an Kunden gesendet",
      createdAt: "2026-02-04T11:00:00",
      user: "Max Muster",
      isInternal: false,
    },
  ]);

  const handleAddComment = () => {
    if (!newComment.trim()) return;

    const comment = {
      id: comments.length + 1,
      type: "comment" as const,
      text: newComment,
      createdAt: new Date().toISOString(),
      user: "Aktueller Benutzer",
      isInternal: isInternal,
    };

    setComments([...comments, comment]);
    setNewComment("");
    setIsInternal(true); // Reset to default (Internal)
  };

  const getStatusLabel = (status: TicketStatus) => {
    const labels: Record<TicketStatus, string> = {
      open: "Offen",
      in_progress: "In Bearbeitung",
      waiting: "Wartet",
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
                <Text className="text-sm text-muted mb-1">Kunde</Text>
                <Text className="text-base text-foreground">{ticket.customer}</Text>
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
                <Text className="text-base text-foreground">{formatDate(ticket.createdAt)}</Text>
              </View>
            </View>

            {/* Historie */}
            <View className="mt-6">
              <Text className="text-lg font-bold text-foreground mb-3">Historie</Text>
              <ScrollView className="max-h-64 mb-4" showsVerticalScrollIndicator={false}>
            {comments.map((comment) => (
              <View
                key={comment.id}
                className={`mb-3 p-3 rounded-lg ${
                  comment.type === "system" ? "bg-surface" : "bg-primary/10"
                }`}
              >
                <View className="flex-row items-center justify-between mb-1">
                  <View className="flex-row items-center gap-2">
                    <Text
                      className={`text-xs font-semibold ${
                        comment.type === "system" ? "text-muted" : "text-primary"
                      }`}
                    >
                      {comment.user}
                    </Text>
                    {comment.type === "comment" && (
                      <View
                        style={{
                          backgroundColor: comment.isInternal
                            ? colors.warning + "20"
                            : colors.success + "20",
                        }}
                        className="px-2 py-0.5 rounded"
                      >
                        <Text
                          style={{
                            color: comment.isInternal ? colors.warning : colors.success,
                          }}
                          className="text-xs font-semibold"
                        >
                          {comment.isInternal ? "Intern" : "Extern"}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-xs text-muted">
                    {formatDateTime(comment.createdAt)}
                  </Text>
                </View>
                <Text className="text-sm text-foreground">{comment.text}</Text>
              </View>
            ))}
          </ScrollView>

              {/* Kommentar hinzufügen */}
              <View className="gap-2">
            {/* Internal/External Toggle */}
            <View className="flex-row items-center justify-between bg-surface p-3 rounded-lg border border-border">
              <View className="flex-row items-center gap-2">
                <Text className="text-sm font-semibold text-foreground">
                  {isInternal ? "Interner Kommentar" : "Externer Kommentar"}
                </Text>
                <View
                  style={{
                    backgroundColor: isInternal
                      ? colors.warning + "20"
                      : colors.success + "20",
                  }}
                  className="px-2 py-1 rounded"
                >
                  <Text
                    style={{
                      color: isInternal ? colors.warning : colors.success,
                    }}
                    className="text-xs font-semibold"
                  >
                    {isInternal ? "Nur für Mitarbeiter" : "Für Kunden sichtbar"}
                  </Text>
                </View>
              </View>
              <Switch
                value={!isInternal}
                onValueChange={(value) => setIsInternal(!value)}
                trackColor={{ false: colors.warning, true: colors.success }}
                thumbColor={colors.background}
              />
            </View>

            <TextInput
              className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
              placeholder="Kommentar hinzufügen..."
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
              value={newComment}
              onChangeText={setNewComment}
            />
            <TouchableOpacity
              className="bg-primary py-2 rounded-lg"
              onPress={handleAddComment}
              activeOpacity={0.8}
            >
              <Text className="text-background font-semibold text-center">
                Kommentar hinzufügen
              </Text>
              </TouchableOpacity>
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View className="p-4 border-t border-border">
              <TouchableOpacity
              className="bg-surface border border-border py-3 rounded-lg"
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

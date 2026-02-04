import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { formatDate, formatDateTime } from "@/lib/format";
import { router } from "expo-router";

type TicketStatus = "open" | "in_progress" | "waiting" | "closed";
type TicketPriority = "low" | "medium" | "high" | "urgent";

interface Ticket {
  id: number;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  description: string;
}

interface Comment {
  id: number;
  type: "system" | "comment";
  text: string;
  createdAt: string;
  user: string;
  isInternal: boolean;
}

// Mock-Daten für Kunden-Tickets (nur externe Kommentare sichtbar)
const mockTickets: Ticket[] = [
  {
    id: 1,
    title: "Problem mit Rechnung #1234",
    status: "in_progress",
    priority: "high",
    createdAt: "2026-02-04",
    description: "Rechnung stimmt nicht mit Vertrag überein",
  },
  {
    id: 2,
    title: "Frage zu Vertragslaufzeit",
    status: "waiting",
    priority: "medium",
    createdAt: "2026-02-03",
    description: "Wann läuft mein aktueller Vertrag aus?",
  },
];

export default function PortalTicketsScreen() {
  const colors = useColors();
  const [tickets] = useState<Ticket[]>(mockTickets);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [filter, setFilter] = useState<"all" | TicketStatus>("all");

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
    filter === "all" ? tickets : tickets.filter((t) => t.status === filter);

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
        <Text className="text-sm text-muted">{formatDate(item.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );

  const handleLogout = () => {
    // TODO: Logout-Logik
    router.push("/portal-login");
  };

  return (
    <ScreenContainer>
      <View className="flex-1">
        {/* Header */}
        <View className="p-4 border-b border-border">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-2xl font-bold text-foreground">
              Meine Tickets
            </Text>
            <TouchableOpacity
              onPress={handleLogout}
              className="flex-row items-center gap-2"
              activeOpacity={0.7}
            >
              <IconSymbol name="xmark.circle.fill" size={24} color={colors.muted} />
              <Text className="text-sm text-muted">Abmelden</Text>
            </TouchableOpacity>
          </View>

          {/* Filter */}
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
        </View>

        {/* Ticket-Liste */}
        <View className="flex-1 p-4">
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
                  ? "Sie haben noch keine Tickets"
                  : `Keine Tickets mit Status "${getStatusLabel(filter as TicketStatus)}"`}
              </Text>
            </View>
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
  
  // Nur externe Kommentare anzeigen (isInternal: false)
  const [comments, setComments] = useState<Comment[]>([
    {
      id: 1,
      type: "system",
      text: "Ticket erstellt",
      createdAt: ticket.createdAt,
      user: "System",
      isInternal: false,
    },
    {
      id: 2,
      type: "comment",
      text: "Vielen Dank für Ihre Anfrage. Wir prüfen das und melden uns in Kürze.",
      createdAt: "2026-02-04T10:30:00",
      user: "Support-Team",
      isInternal: false,
    },
  ]);

  const handleAddComment = () => {
    if (!newComment.trim()) return;

    const comment: Comment = {
      id: comments.length + 1,
      type: "comment",
      text: newComment,
      createdAt: new Date().toISOString(),
      user: "Sie",
      isInternal: false,
    };

    setComments([...comments, comment]);
    setNewComment("");
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
                <Text className="text-base text-foreground">{formatDate(ticket.createdAt)}</Text>
              </View>
            </View>

            {/* Kommunikation */}
            <View className="mt-6">
              <Text className="text-lg font-bold text-foreground mb-3">Kommunikation</Text>
              <ScrollView className="max-h-64 mb-4" showsVerticalScrollIndicator={false}>
                {comments.map((comment) => (
                  <View
                    key={comment.id}
                    className={`mb-3 p-3 rounded-lg ${
                      comment.type === "system" ? "bg-surface" : "bg-primary/10"
                    }`}
                  >
                    <View className="flex-row items-center justify-between mb-1">
                      <Text
                        className={`text-xs font-semibold ${
                          comment.type === "system" ? "text-muted" : "text-primary"
                        }`}
                      >
                        {comment.user}
                      </Text>
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
                <TextInput
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="Antwort schreiben..."
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
                    Antwort senden
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

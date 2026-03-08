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
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { formatDate, formatDateTime } from "@/lib/format";
import { router } from "expo-router";
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

export default function PortalTicketsScreen() {
  const colors = useColors();
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [filter, setFilter] = useState<"all" | TicketStatus>("all");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [portalUserId, setPortalUserId] = useState<string | null>(null);

  useEffect(() => {
    Data.supabase.auth.getSession().then(({ data: { session } }: { data: { session: any } }) => {
      if (session?.user?.id) {
        setPortalUserId(session.user.id);
      }
      if (session?.user?.user_metadata?.customer_id) {
        setCustomerId(session.user.user_metadata.customer_id);
      }
    });
  }, []);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["portalTickets", customerId],
    queryFn: () => Data.getPortalTickets(customerId!),
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
              Meine Tickets
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

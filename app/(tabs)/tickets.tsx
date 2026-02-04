import { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  FlatList,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

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
        <Text className="text-xs text-muted">{item.createdAt}</Text>
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
          >
            <IconSymbol name="plus.circle.fill" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Statistik */}
        <View className="flex-row gap-3 mb-4">
          <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
            <Text className="text-2xl font-bold text-error">
              {tickets.filter((t) => t.status === "open").length}
            </Text>
            <Text className="text-sm text-muted">Offen</Text>
          </View>
          <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
            <Text className="text-2xl font-bold text-primary">
              {tickets.filter((t) => t.status === "in_progress").length}
            </Text>
            <Text className="text-sm text-muted">In Arbeit</Text>
          </View>
          <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
            <Text className="text-2xl font-bold text-success">
              {tickets.filter((t) => t.status === "closed").length}
            </Text>
            <Text className="text-sm text-muted">Gelöst</Text>
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
    </ScreenContainer>
  );
}

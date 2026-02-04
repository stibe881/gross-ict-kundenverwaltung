import { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { formatDate } from "@/lib/format";

type NewsletterStatus = "draft" | "scheduled" | "sent";

interface Newsletter {
  id: number;
  subject: string;
  status: NewsletterStatus;
  recipientCount: number;
  sentDate?: string;
  scheduledDate?: string;
  openRate?: number;
  clickRate?: number;
}

const mockNewsletters: Newsletter[] = [
  {
    id: 1,
    subject: "Monatlicher Newsletter Januar 2026",
    status: "sent",
    recipientCount: 245,
    sentDate: "2026-01-15",
    openRate: 42.5,
    clickRate: 12.3,
  },
  {
    id: 2,
    subject: "Neue Produktankündigung",
    status: "scheduled",
    recipientCount: 180,
    scheduledDate: "2026-02-10",
  },
  {
    id: 3,
    subject: "Kundenbefragung Q1 2026",
    status: "draft",
    recipientCount: 0,
  },
];

export default function NewsletterScreen() {
  const colors = useColors();
  const router = useRouter();
  const [newsletters] = useState<Newsletter[]>(mockNewsletters);
  const [filter, setFilter] = useState<"all" | NewsletterStatus>("all");

  const getStatusLabel = (status: NewsletterStatus) => {
    const labels: Record<NewsletterStatus, string> = {
      draft: "Entwurf",
      scheduled: "Geplant",
      sent: "Versendet",
    };
    return labels[status];
  };

  const getStatusColor = (status: NewsletterStatus) => {
    const colorMap: Record<NewsletterStatus, string> = {
      draft: colors.muted,
      scheduled: colors.warning,
      sent: colors.success,
    };
    return colorMap[status];
  };

  const filteredNewsletters =
    filter === "all" ? newsletters : newsletters.filter((n) => n.status === filter);

  const renderNewsletterItem = ({ item }: { item: Newsletter }) => (
    <TouchableOpacity
      className="bg-surface rounded-xl p-4 mb-3 border border-border"
      activeOpacity={0.7}
    >
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1">
          <Text className="text-lg font-semibold text-foreground mb-1">{item.subject}</Text>
          <Text className="text-sm text-muted">
            {item.recipientCount} Empfänger
          </Text>
        </View>
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
      </View>

      {item.status === "sent" && item.sentDate && (
        <View className="mt-2 pt-2 border-t border-border">
          <Text className="text-xs text-muted mb-2">
            Versendet am {formatDate(item.sentDate)}
          </Text>
          <View className="flex-row gap-4">
            <View>
              <Text className="text-xs text-muted">Öffnungsrate</Text>
              <Text className="text-sm font-semibold text-success">
                {item.openRate}%
              </Text>
            </View>
            <View>
              <Text className="text-xs text-muted">Klickrate</Text>
              <Text className="text-sm font-semibold text-primary">
                {item.clickRate}%
              </Text>
            </View>
          </View>
        </View>
      )}

      {item.status === "scheduled" && item.scheduledDate && (
        <View className="mt-2 pt-2 border-t border-border">
          <Text className="text-xs text-muted">
            Geplant für {formatDate(item.scheduledDate)}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <ScreenContainer>
      <View className="flex-1 p-4">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center gap-3">
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
              <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <Text className="text-3xl font-bold text-foreground">Newsletter</Text>
          </View>
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
            <Text className="text-2xl font-bold text-primary">
              {newsletters.length}
            </Text>
            <Text className="text-sm text-muted">Kampagnen</Text>
          </View>
          <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
            <Text className="text-2xl font-bold text-success">
              {newsletters.filter((n) => n.status === "sent").length}
            </Text>
            <Text className="text-sm text-muted">Versendet</Text>
          </View>
          <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
            <Text className="text-2xl font-bold text-warning">
              {newsletters.filter((n) => n.status === "scheduled").length}
            </Text>
            <Text className="text-sm text-muted">Geplant</Text>
          </View>
        </View>

        {/* Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
          <View className="flex-row gap-2">
            {[
              { key: "all", label: "Alle" },
              { key: "draft", label: "Entwürfe" },
              { key: "scheduled", label: "Geplant" },
              { key: "sent", label: "Versendet" },
            ].map((status) => (
              <TouchableOpacity
                key={status.key}
                className={`px-4 py-2 rounded-lg ${
                  filter === status.key ? "bg-primary" : "bg-surface border border-border"
                }`}
                onPress={() => setFilter(status.key as any)}
              >
                <Text
                  className={`font-semibold ${
                    filter === status.key ? "text-background" : "text-foreground"
                  }`}
                >
                  {status.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Newsletter-Liste */}
        {filteredNewsletters.length > 0 ? (
          <FlatList
            data={filteredNewsletters}
            renderItem={renderNewsletterItem}
            keyExtractor={(item) => item.id.toString()}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <IconSymbol name="envelope.fill" size={48} color={colors.muted} />
            <Text className="text-lg text-muted mt-4">Keine Newsletter</Text>
            <Text className="text-sm text-muted text-center mt-2">
              {filter === "all"
                ? "Erstellen Sie Ihre erste Kampagne"
                : `Keine Newsletter mit Status "${getStatusLabel(filter as NewsletterStatus)}"`}
            </Text>
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}

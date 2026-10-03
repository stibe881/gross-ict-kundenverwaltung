import { useState } from "react";
import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { showAlert, showConfirm } from "@/lib/alert";
import { showToast } from "@/components/toast-provider";
import { formatDateTime } from "@/lib/format";

const ENTITY_LABELS: Record<string, string> = {
  customer: "Kunde",
  invoice: "Rechnung",
  ticket: "Ticket",
  quote: "Angebot",
  contract: "Vertrag",
  project: "Projekt",
  expense: "Buchung",
};

const ACTION_META: Record<string, { label: string; color: string; icon: any }> = {
  created: { label: "Erstellt", color: "#22C55E", icon: "plus.circle.fill" },
  updated: { label: "Geändert", color: "#0EA5E9", icon: "pencil" },
  deleted: { label: "Gelöscht", color: "#EF4444", icon: "trash.fill" },
  restored: { label: "Wiederhergestellt", color: "#8B5CF6", icon: "arrow.triangle.2.circlepath" },
};

export default function ActivityLogScreen() {
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { containerStyle, contentPadding } = useResponsiveLayout();
  const [tab, setTab] = useState<"log" | "trash">("log");
  const [restoring, setRestoring] = useState<string | null>(null);

  const { data: log = [], isLoading: loadingLog } = useQuery({
    queryKey: ["auditLog"],
    queryFn: () => Data.getAuditLog(300),
    enabled: tab === "log",
  });
  const { data: trash = [], isLoading: loadingTrash } = useQuery({
    queryKey: ["trashBin"],
    queryFn: Data.getTrash,
    enabled: tab === "trash",
  });

  const handleRestore = (entry: any) => {
    showConfirm(
      "Wiederherstellen",
      `"${entry.entity_label}" (${ENTITY_LABELS[entry.entity_type] || entry.entity_type}) wiederherstellen?`,
      async () => {
        setRestoring(entry.id);
        try {
          await Data.restoreFromTrash(entry.id);
          queryClient.invalidateQueries();
          showToast("Wiederhergestellt");
        } catch (e: any) {
          showAlert("Fehler", "Wiederherstellen fehlgeschlagen: " + e.message);
        } finally {
          setRestoring(null);
        }
      },
      "Wiederherstellen"
    );
  };

  return (
    <ScreenContainer>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View style={{ padding: contentPadding }}>
          <View style={containerStyle}>
            <View className="flex-row items-center gap-3 mb-2">
              <TouchableOpacity onPress={() => router.push("/settings" as any)} activeOpacity={0.7}>
                <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
              </TouchableOpacity>
              <Text className="text-2xl font-bold text-foreground">Aktivitäten & Papierkorb</Text>
            </View>

            {/* Tabs */}
            <View className="flex-row bg-surface border border-border rounded-xl overflow-hidden mb-4">
              {([
                { key: "log", label: "Aktivitäts-Log", icon: "clock.fill" },
                { key: "trash", label: "Papierkorb", icon: "trash" },
              ] as const).map((t) => (
                <TouchableOpacity
                  key={t.key}
                  className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5"
                  style={{ backgroundColor: tab === t.key ? colors.primary : "transparent" }}
                  onPress={() => setTab(t.key)}
                  activeOpacity={0.7}
                >
                  <IconSymbol name={t.icon as any} size={14} color={tab === t.key ? colors.background : colors.muted} />
                  <Text className="text-xs font-semibold" style={{ color: tab === t.key ? colors.background : colors.foreground }}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {tab === "log" ? (
              loadingLog ? (
                <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
              ) : (log as any[]).length === 0 ? (
                <Text className="text-sm text-muted text-center py-10">
                  Noch keine Einträge. Änderungen an Kunden, Rechnungen und Tickets werden ab jetzt hier protokolliert.
                </Text>
              ) : (
                (log as any[]).map((entry: any) => {
                  const meta = ACTION_META[entry.action] || ACTION_META.updated;
                  return (
                    <View key={entry.id} className="flex-row items-start gap-3 bg-surface rounded-xl border border-border p-3 mb-2">
                      <View
                        style={{
                          width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center",
                          backgroundColor: meta.color + "18",
                        }}
                      >
                        <IconSymbol name={meta.icon} size={14} color={meta.color} />
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm text-foreground">{entry.description}</Text>
                        <Text className="text-xs text-muted mt-0.5">
                          {ENTITY_LABELS[entry.entity_type] || entry.entity_type} · {meta.label} · {formatDateTime(entry.created_at)}
                          {entry.user_name ? ` · ${entry.user_name}` : ""}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )
            ) : loadingTrash ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
            ) : (trash as any[]).length === 0 ? (
              <View className="items-center py-10">
                <IconSymbol name="trash" size={36} color={colors.muted} />
                <Text className="text-sm text-muted mt-3">Papierkorb ist leer</Text>
                <Text className="text-xs text-muted mt-1 text-center">
                  Gelöschte Kunden, Rechnungen und Tickets bleiben hier 30 Tage wiederherstellbar.
                </Text>
              </View>
            ) : (
              (trash as any[]).map((entry: any) => (
                <View key={entry.id} className="bg-surface rounded-xl border border-border p-3 mb-2">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 mr-2">
                      <Text className="text-sm font-semibold text-foreground">{entry.entity_label}</Text>
                      <Text className="text-xs text-muted mt-0.5">
                        {ENTITY_LABELS[entry.entity_type] || entry.entity_type} · gelöscht {formatDateTime(entry.created_at)}
                        {entry.deleted_by ? ` · von ${entry.deleted_by}` : ""}
                      </Text>
                    </View>
                    <TouchableOpacity
                      className="bg-primary px-3 py-2 rounded-lg"
                      onPress={() => handleRestore(entry)}
                      disabled={restoring === entry.id}
                      activeOpacity={0.8}
                    >
                      {restoring === entry.id ? (
                        <ActivityIndicator size="small" color={colors.background} />
                      ) : (
                        <Text className="text-background text-xs font-semibold">Wiederherstellen</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}

            <View style={{ height: 24 }} />
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

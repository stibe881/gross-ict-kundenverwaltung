import { useEffect, useState } from "react";
import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { showAlert } from "@/lib/alert";

// Gleiche Kategorien wie in der Mitarbeitenden-Verwaltung
const PUSH_CATEGORIES = [
  { key: "tickets", label: "Tickets", desc: "Neue Tickets, Status, Kommentare", icon: "ticket.fill", color: "#F59E0B" },
  { key: "invoices", label: "Rechnungen (Portal)", desc: "Rechnung vom Kunden geöffnet", icon: "doc.text.fill", color: "#22C55E" },
  { key: "auto_invoices", label: "Auto-Mails & Mahnungen", desc: "Automatischer Versand an Kunden", icon: "paperplane.fill", color: "#EF4444" },
  { key: "quotes", label: "Angebote", desc: "Neue Anfragen, Kunde öffnet Angebot", icon: "doc.on.doc.fill", color: "#0EA5E9" },
  { key: "tasks", label: "Aufgaben", desc: "Aufgaben-Zuweisung, Erinnerungen", icon: "checklist", color: "#8B5CF6" },
  { key: "sticky_notes", label: "Sticky Notes", desc: "Neue Notizen auf dem Whiteboard", icon: "note.text", color: "#EAB308" },
  { key: "portal", label: "Kundenportal", desc: "Kunden-Antworten auf Tickets", icon: "person.2.fill", color: "#14B8A6" },
  { key: "lead_reminders", label: "Lead Terminierungen", desc: "Erinnerungen für Kontakt-Wiedervorlage", icon: "calendar", color: "#F97316" },
  { key: "monitoring_alerts", label: "Überwachung", desc: "Ausfälle von Webseiten & Servern", icon: "wifi", color: "#06B6D4" },
];

export default function NotificationSettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { containerStyle, contentPadding } = useResponsiveLayout();

  const { data: sessionData } = useQuery({
    queryKey: ["currentSession"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });
  const userId = sessionData?.user?.id;

  const { data: userProfile, isLoading } = useQuery({
    queryKey: ["userProfile", userId],
    queryFn: () => Data.getUserProfile(userId as string),
    enabled: !!userId,
  });

  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setPrefs((userProfile?.push_preferences as Record<string, boolean>) || {});
  }, [userProfile]);

  // Umschalten speichert sofort (optimistisch, bei Fehler zurückrollen)
  const toggle = async (key: string) => {
    if (!userId) return;
    const isEnabled = prefs[key] !== false;
    const next = { ...prefs, [key]: !isEnabled };
    setPrefs(next);
    try {
      await Data.updateOwnPushPreferences(userId, next);
      queryClient.invalidateQueries({ queryKey: ["userProfile", userId] });
    } catch (e: any) {
      setPrefs(prefs);
      showAlert("Fehler", "Einstellung konnte nicht gespeichert werden: " + e.message);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View style={{ padding: contentPadding }}>
          <View style={containerStyle}>
            {/* Kopfzeile */}
            <View className="flex-row items-center gap-3 mb-2">
              <TouchableOpacity onPress={() => router.push("/settings" as any)} activeOpacity={0.7}>
                <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
              </TouchableOpacity>
              <Text className="text-2xl font-bold text-foreground">Benachrichtigungen</Text>
            </View>
            <Text className="text-sm text-muted mb-4">
              Wähle, wofür du Push-Benachrichtigungen erhalten möchtest.
            </Text>

            {isLoading ? (
              <View className="items-center py-12">
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                  overflow: "hidden",
                }}
              >
                {PUSH_CATEGORIES.map((cat, idx) => {
                  const isEnabled = prefs[cat.key] !== false;
                  return (
                    <TouchableOpacity
                      key={cat.key}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        gap: 12,
                        borderBottomWidth: idx < PUSH_CATEGORIES.length - 1 ? 1 : 0,
                        borderBottomColor: colors.border,
                      }}
                      activeOpacity={0.7}
                      onPress={() => toggle(cat.key)}
                    >
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: cat.color + "18",
                        }}
                      >
                        <IconSymbol name={cat.icon as any} size={18} color={cat.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>
                          {cat.label}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.muted, marginTop: 1 }} numberOfLines={1}>
                          {cat.desc}
                        </Text>
                      </View>
                      {/* Schalter */}
                      <View
                        style={{
                          width: 46,
                          height: 28,
                          borderRadius: 14,
                          backgroundColor: isEnabled ? "#22C55E" : colors.border,
                          justifyContent: "center",
                          paddingHorizontal: 2,
                        }}
                      >
                        <View
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 12,
                            backgroundColor: "#FFFFFF",
                            alignSelf: isEnabled ? "flex-end" : "flex-start",
                          }}
                        />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <Text className="text-xs text-muted mt-3">
              Änderungen werden sofort gespeichert und gelten für dieses Benutzerkonto auf allen Geräten.
            </Text>

            <View style={{ height: 24 }} />
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

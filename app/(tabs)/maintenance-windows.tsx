import { useState } from "react";
import { ScrollView, Text, View, TouchableOpacity, TextInput, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BackButton } from "@/components/back-button";
import { useColors } from "@/hooks/use-colors";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { showAlert, showConfirm } from "@/lib/alert";
import { showToast } from "@/components/toast-provider";
import { formatDate } from "@/lib/format";

// DD.MM.YYYY HH:MM → ISO (lokale Zeit)
function parseDateTime(input: string): string | null {
  const m = input.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5]));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("de-CH", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function MaintenanceWindowsScreen() {
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { containerStyle, contentPadding } = useResponsiveLayout();

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: windows = [], isLoading } = useQuery({
    queryKey: ["maintenanceWindows"],
    queryFn: () => Data.getMaintenanceWindows(true),
  });
  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: Data.getCustomersWithCounts,
  });

  const customerName = (c: any) =>
    c.company_name || `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Unbenannt";

  const handleSave = async () => {
    if (!title.trim()) { showAlert("Fehler", "Bitte einen Titel angeben."); return; }
    const startIso = parseDateTime(startsAt);
    const endIso = parseDateTime(endsAt);
    if (!startIso || !endIso) {
      showAlert("Fehler", "Bitte Beginn und Ende im Format DD.MM.YYYY HH:MM angeben.");
      return;
    }
    setSaving(true);
    try {
      await Data.createMaintenanceWindow({
        title: title.trim(),
        description: description.trim() || null,
        starts_at: startIso,
        ends_at: endIso,
        customer_ids: selectedCustomers.length ? selectedCustomers : null,
      });
      setTitle(""); setDescription(""); setStartsAt(""); setEndsAt(""); setSelectedCustomers([]);
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["maintenanceWindows"] });
      showToast("Wartungsfenster angekündigt – Portal-Benutzer wurden informiert");
    } catch (e: any) {
      showAlert("Fehler", e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleCustomer = (id: string) => {
    setSelectedCustomers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const now = new Date().toISOString();

  return (
    <ScreenContainer>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View style={{ padding: contentPadding }}>
          <View style={containerStyle}>
            <View className="flex-row items-center gap-3 mb-2">
              <BackButton to="/settings" />
              <Text className="text-2xl font-bold text-foreground">Wartungsfenster</Text>
            </View>
            <Text className="text-sm text-muted mb-4">
              Geplante Wartungen ankündigen. Portal-Benutzer der betroffenen Kunden erhalten eine Push-Mitteilung und sehen die Ankündigung im Kundenportal.
            </Text>

            {!showForm ? (
              <TouchableOpacity
                className="bg-primary py-3 rounded-xl flex-row items-center justify-center gap-2 mb-4"
                onPress={() => setShowForm(true)}
                activeOpacity={0.8}
              >
                <IconSymbol name="plus" size={16} color={colors.background} />
                <Text className="text-background font-semibold">Wartung ankündigen</Text>
              </TouchableOpacity>
            ) : (
              <View className="bg-surface rounded-2xl border border-border p-4 mb-4 gap-3">
                <TextInput
                  value={title} onChangeText={setTitle}
                  placeholder="Titel (z.B. Server-Update Mailsystem)" placeholderTextColor={colors.muted}
                  className="bg-background border border-border rounded-lg px-3 py-2.5 text-foreground"
                />
                <TextInput
                  value={description} onChangeText={setDescription} multiline
                  placeholder="Beschreibung / Auswirkungen (optional)" placeholderTextColor={colors.muted}
                  className="bg-background border border-border rounded-lg px-3 py-2.5 text-foreground"
                />
                <View className="flex-row gap-2">
                  <TextInput
                    value={startsAt} onChangeText={setStartsAt}
                    placeholder="Beginn: DD.MM.YYYY HH:MM" placeholderTextColor={colors.muted}
                    className="flex-1 bg-background border border-border rounded-lg px-3 py-2.5 text-foreground text-sm"
                  />
                  <TextInput
                    value={endsAt} onChangeText={setEndsAt}
                    placeholder="Ende: DD.MM.YYYY HH:MM" placeholderTextColor={colors.muted}
                    className="flex-1 bg-background border border-border rounded-lg px-3 py-2.5 text-foreground text-sm"
                  />
                </View>

                <Text className="text-xs font-semibold text-muted uppercase" style={{ letterSpacing: 1 }}>
                  Betroffene Kunden ({selectedCustomers.length === 0 ? "alle" : selectedCustomers.length})
                </Text>
                <View style={{ maxHeight: 180 }}>
                  <ScrollView nestedScrollEnabled>
                    {customers.map((c: any) => (
                      <TouchableOpacity
                        key={c.id}
                        className="flex-row items-center gap-2 py-1.5"
                        onPress={() => toggleCustomer(c.id)}
                        activeOpacity={0.7}
                      >
                        <View
                          style={{
                            width: 18, height: 18, borderRadius: 5, borderWidth: 2,
                            borderColor: selectedCustomers.includes(c.id) ? colors.primary : colors.border,
                            backgroundColor: selectedCustomers.includes(c.id) ? colors.primary : "transparent",
                            alignItems: "center", justifyContent: "center",
                          }}
                        >
                          {selectedCustomers.includes(c.id) ? (
                            <Text style={{ color: colors.background, fontSize: 11, fontWeight: "700" }}>✓</Text>
                          ) : null}
                        </View>
                        <Text className="text-sm text-foreground">{customerName(c)}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <Text className="text-xs text-muted">Keine Auswahl = Ankündigung gilt für alle Kunden.</Text>

                <View className="flex-row gap-2">
                  <TouchableOpacity className="flex-1 bg-background border border-border py-2.5 rounded-lg" onPress={() => setShowForm(false)}>
                    <Text className="text-center text-sm font-semibold text-foreground">Abbrechen</Text>
                  </TouchableOpacity>
                  <TouchableOpacity className="flex-1 bg-primary py-2.5 rounded-lg" onPress={handleSave} disabled={saving}>
                    {saving ? (
                      <ActivityIndicator size="small" color={colors.background} />
                    ) : (
                      <Text className="text-center text-sm font-semibold text-background">Ankündigen</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {isLoading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
            ) : (windows as any[]).length === 0 ? (
              <View className="items-center py-10">
                <IconSymbol name="wrench.fill" size={36} color={colors.muted} />
                <Text className="text-sm text-muted mt-3">Keine Wartungsfenster geplant</Text>
              </View>
            ) : (
              (windows as any[]).map((w: any) => {
                const past = w.ends_at < now;
                return (
                  <View
                    key={w.id}
                    className="bg-surface rounded-xl border border-border p-4 mb-3"
                    style={{ opacity: past ? 0.55 : 1 }}
                  >
                    <View className="flex-row items-start justify-between mb-1">
                      <Text className="text-base font-bold text-foreground flex-1 mr-2">{w.title}</Text>
                      <TouchableOpacity
                        onPress={() => showConfirm("Löschen", `"${w.title}" entfernen?`, async () => {
                          await Data.deleteMaintenanceWindow(w.id);
                          queryClient.invalidateQueries({ queryKey: ["maintenanceWindows"] });
                        }, "Löschen")}
                        activeOpacity={0.7}
                      >
                        <IconSymbol name="trash.fill" size={16} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                    <Text className="text-sm text-foreground">
                      {fmtDateTime(w.starts_at)} – {fmtDateTime(w.ends_at)}
                    </Text>
                    {w.description ? (
                      <Text className="text-xs text-muted mt-1">{w.description}</Text>
                    ) : null}
                    <Text className="text-xs mt-1" style={{ color: colors.primary }}>
                      {!w.customer_ids || w.customer_ids.length === 0 ? "Alle Kunden" : `${w.customer_ids.length} Kunde(n)`}
                      {past ? " · vorbei" : ""}
                    </Text>
                  </View>
                );
              })
            )}

            <View style={{ height: 24 }} />
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

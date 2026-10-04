import { useState } from "react";
import { ScrollView, Text, View, TouchableOpacity, TextInput, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { showAlert, showConfirm } from "@/lib/alert";
import { showToast } from "@/components/toast-provider";
import { formatDate } from "@/lib/format";

const INTERVALS = [
  { key: "monthly", label: "Monatlich" },
  { key: "quarterly", label: "Quartalsweise" },
  { key: "yearly", label: "Jährlich" },
];

export default function RecurringTicketsScreen() {
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { containerStyle, contentPadding } = useResponsiveLayout();

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [interval, setIntervalKey] = useState("monthly");
  const [nextDate, setNextDate] = useState("");
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["recurringTickets"],
    queryFn: Data.getRecurringTickets,
  });
  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: Data.getCustomersWithCounts,
  });

  const customerName = (c: any) =>
    c?.company_name || `${c?.first_name || ""} ${c?.last_name || ""}`.trim() || "–";
  const selectedCustomer = customers.find((c: any) => c.id === customerId);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["recurringTickets"] });

  const handleSave = async () => {
    if (!title.trim()) { showAlert("Fehler", "Bitte einen Titel angeben."); return; }
    let dbDate = nextDate.trim();
    const parts = dbDate.split(".");
    if (parts.length === 3) dbDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    if (!dbDate) dbDate = new Date().toISOString().split("T")[0];
    setSaving(true);
    try {
      await Data.createRecurringTicket({
        title: title.trim(),
        description: description.trim() || null,
        customer_id: customerId,
        interval,
        next_date: dbDate,
      });
      setTitle(""); setDescription(""); setCustomerId(null); setNextDate(""); setShowForm(false);
      refresh();
      showToast("Wartungsplan gespeichert");
    } catch (e: any) {
      showAlert("Fehler", e.message);
    } finally {
      setSaving(false);
    }
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
              <Text className="text-2xl font-bold text-foreground">Wartungsplan</Text>
            </View>
            <Text className="text-sm text-muted mb-4">
              Wiederkehrende Tickets werden am Stichtag automatisch erstellt (z. B. monatlicher Patchday, quartalsweiser Backup-Check).
            </Text>

            {!showForm ? (
              <TouchableOpacity
                className="bg-primary py-3 rounded-xl flex-row items-center justify-center gap-2 mb-4"
                onPress={() => setShowForm(true)}
                activeOpacity={0.8}
              >
                <IconSymbol name="plus" size={16} color={colors.background} />
                <Text className="text-background font-semibold">Wiederkehrendes Ticket anlegen</Text>
              </TouchableOpacity>
            ) : (
              <View className="bg-surface rounded-2xl border border-border p-4 mb-4 gap-3">
                <TextInput
                  value={title} onChangeText={setTitle}
                  placeholder="Titel (z.B. Patchday Server)" placeholderTextColor={colors.muted}
                  className="bg-background border border-border rounded-lg px-3 py-2.5 text-foreground"
                />
                <TextInput
                  value={description} onChangeText={setDescription} multiline
                  placeholder="Beschreibung / Arbeitsschritte (optional)" placeholderTextColor={colors.muted}
                  className="bg-background border border-border rounded-lg px-3 py-2.5 text-foreground"
                />
                <TouchableOpacity
                  className="bg-background border border-border rounded-lg px-3 py-2.5"
                  onPress={() => setShowCustomerList(!showCustomerList)}
                  activeOpacity={0.7}
                >
                  <Text className={selectedCustomer ? "text-foreground" : "text-muted"}>
                    {selectedCustomer ? customerName(selectedCustomer) : "Kunde wählen (optional)…"}
                  </Text>
                </TouchableOpacity>
                {showCustomerList ? (
                  <View style={{ maxHeight: 180 }} className="bg-background border border-border rounded-lg">
                    <ScrollView nestedScrollEnabled>
                      <TouchableOpacity className="px-3 py-2 border-b border-border" onPress={() => { setCustomerId(null); setShowCustomerList(false); }}>
                        <Text className="text-sm text-muted italic">Kein Kunde (intern)</Text>
                      </TouchableOpacity>
                      {customers.map((c: any) => (
                        <TouchableOpacity key={c.id} className="px-3 py-2 border-b border-border" onPress={() => { setCustomerId(c.id); setShowCustomerList(false); }}>
                          <Text className="text-sm text-foreground">{customerName(c)}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                ) : null}
                <View className="flex-row gap-2">
                  {INTERVALS.map((i) => (
                    <TouchableOpacity
                      key={i.key}
                      className={`flex-1 py-2 rounded-lg ${interval === i.key ? "bg-primary" : "bg-background border border-border"}`}
                      onPress={() => setIntervalKey(i.key)}
                    >
                      <Text className={`text-center text-xs font-semibold ${interval === i.key ? "text-background" : "text-foreground"}`}>{i.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  value={nextDate} onChangeText={setNextDate}
                  placeholder="Erstes Ticket am (DD.MM.YYYY, leer = heute)" placeholderTextColor={colors.muted}
                  className="bg-background border border-border rounded-lg px-3 py-2.5 text-foreground"
                />
                <View className="flex-row gap-2">
                  <TouchableOpacity className="flex-1 bg-background border border-border py-2.5 rounded-lg" onPress={() => setShowForm(false)}>
                    <Text className="text-center text-sm font-semibold text-foreground">Abbrechen</Text>
                  </TouchableOpacity>
                  <TouchableOpacity className="flex-1 bg-primary py-2.5 rounded-lg" onPress={handleSave} disabled={saving}>
                    {saving ? <ActivityIndicator size="small" color={colors.background} /> : (
                      <Text className="text-center text-sm font-semibold text-background">Speichern</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {isLoading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
            ) : (list as any[]).length === 0 ? (
              <View className="items-center py-10">
                <IconSymbol name="arrow.triangle.2.circlepath" size={36} color={colors.muted} />
                <Text className="text-sm text-muted mt-3">Noch keine wiederkehrenden Tickets</Text>
              </View>
            ) : (
              (list as any[]).map((rt: any) => (
                <View key={rt.id} className="bg-surface rounded-xl border border-border p-4 mb-3" style={{ opacity: rt.active ? 1 : 0.55 }}>
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 mr-2">
                      <Text className="text-base font-bold text-foreground">{rt.title}</Text>
                      <Text className="text-xs text-muted mt-0.5">
                        {rt.customer ? customerName(rt.customer) : "Intern"} · {INTERVALS.find((i) => i.key === rt.interval)?.label || rt.interval} · nächstes Ticket {formatDate(rt.next_date)}
                        {!rt.active ? " · pausiert" : ""}
                      </Text>
                    </View>
                    <View className="flex-row gap-3">
                      <TouchableOpacity
                        onPress={() => Data.updateRecurringTicket(rt.id, { active: !rt.active }).then(refresh)}
                        activeOpacity={0.7}
                      >
                        <IconSymbol name={rt.active ? "pause.fill" : "play.fill"} size={17} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => showConfirm("Löschen", `"${rt.title}" entfernen?`, async () => {
                          await Data.deleteRecurringTicket(rt.id);
                          refresh();
                        }, "Löschen")}
                        activeOpacity={0.7}
                      >
                        <IconSymbol name="trash.fill" size={16} color={colors.error} />
                      </TouchableOpacity>
                    </View>
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

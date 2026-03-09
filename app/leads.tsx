import { useState, useEffect } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { LeadFormModal } from "@/components/lead-form-modal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { showAlert, showConfirm } from "@/lib/alert";

type LeadStatus = "new" | "contacted" | "qualified" | "proposal" | "won" | "lost";

export default function LeadsScreen() {
  const router = useRouter();
  const colors = useColors();
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLead, setEditingLead] = useState<any | null>(null);
  const [convertingLead, setConvertingLead] = useState<any | null>(null);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: Data.getLeads,
  });

  const deleteLead = useMutation({
    mutationFn: (id: string) => Data.deleteLead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
  });

  const updateLeadStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => Data.updateLead(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
  });

  const getStatusLabel = (status: LeadStatus) => {
    const labels: Record<LeadStatus, string> = {
      new: "Neu",
      contacted: "Kontaktiert",
      qualified: "Qualifiziert",
      proposal: "Angebot",
      won: "Gewonnen",
      lost: "Verloren",
    };
    return labels[status];
  };

  const getStatusColor = (status: LeadStatus) => {
    const colorMap: Record<LeadStatus, string> = {
      new: colors.primary,
      contacted: "#17A2B8",
      qualified: colors.warning,
      proposal: "#6C757D",
      won: colors.success,
      lost: colors.error,
    };
    return colorMap[status];
  };

  const filteredLeads = priorityFilter === "all"
    ? leads
    : leads.filter((l: any) => (l.priority || "medium") === priorityFilter);

  const groupedLeads = {
    new: filteredLeads.filter((l: any) => l.status === "new"),
    contacted: filteredLeads.filter((l: any) => l.status === "contacted"),
    qualified: filteredLeads.filter((l: any) => l.status === "qualified"),
    proposal: filteredLeads.filter((l: any) => l.status === "proposal"),
  };

  const totalValue = leads.reduce((sum: number, lead: any) => sum + (lead.value || 0), 0);

  const getPriorityLabel = (p: string) => ({ low: "Tief", medium: "Mittel", high: "Hoch" }[p] || "Mittel");
  const getPriorityColor = (p: string) => ({ low: "#6B7280", medium: "#F59E0B", high: "#EF4444" }[p] || "#F59E0B");

  const { width } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && width > 768;

  return (
    <ScreenContainer>
      <ScrollView className="flex-1 p-4">
        <View style={isWide ? { maxWidth: 1200, alignSelf: 'center', width: '100%' } : undefined}>
          {/* Header */}
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center gap-3">
              <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
                <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
              </TouchableOpacity>
              <Text className="text-3xl font-bold text-foreground">Akquise</Text>
            </View>
            <TouchableOpacity
              className="bg-primary w-12 h-12 rounded-full items-center justify-center"
              activeOpacity={0.8}
              onPress={() => setShowAddModal(true)}
            >
              <IconSymbol name="plus.circle.fill" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Prioritätsfilter */}
          <View className="flex-row gap-2 mb-4">
            {[
              { key: "all", label: "Alle", color: colors.foreground },
              { key: "high", label: "⬆ Hoch", color: "#EF4444" },
              { key: "medium", label: "● Mittel", color: "#F59E0B" },
              { key: "low", label: "⬇ Tief", color: "#6B7280" },
            ].map((f) => (
              <TouchableOpacity
                key={f.key}
                className="px-3 py-1.5 rounded-lg border"
                style={{
                  backgroundColor: priorityFilter === f.key ? f.color + '20' : undefined,
                  borderColor: priorityFilter === f.key ? f.color : '#374151',
                }}
                onPress={() => setPriorityFilter(f.key)}
              >
                <Text
                  className="text-xs font-semibold"
                  style={{ color: priorityFilter === f.key ? f.color : '#9CA3AF' }}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Statistik */}
          <View className="flex-row gap-3 mb-4">
            <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
              <Text className="text-2xl font-bold text-foreground">{leads.length}</Text>
              <Text className="text-sm text-muted">Leads</Text>
            </View>
            <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
              <Text className="text-2xl font-bold text-success">
                CHF {totalValue.toLocaleString("de-CH")}
              </Text>
              <Text className="text-sm text-muted">Potenzial</Text>
            </View>
          </View>

          {isLoading ? (
            <View className="flex-1 items-center justify-center py-12">
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <>
              {/* Pipeline-Stages */}
              <View style={isWide ? { flexDirection: 'row', flexWrap: 'wrap', gap: 16 } : { gap: 16 }}>
                {(Object.keys(groupedLeads) as Array<keyof typeof groupedLeads>).map((stage) => (
                  <View key={stage} className="bg-surface rounded-xl p-4 border border-border" style={isWide ? { flex: 1, minWidth: '45%' } : undefined}>
                    <View className="flex-row items-center justify-between mb-3">
                      <Text className="text-lg font-bold text-foreground">
                        {getStatusLabel(stage)}
                      </Text>
                      <View
                        className="px-3 py-1 rounded-full"
                        style={{ backgroundColor: getStatusColor(stage) + "20" }}
                      >
                        <Text
                          className="text-sm font-semibold"
                          style={{ color: getStatusColor(stage) }}
                        >
                          {groupedLeads[stage].length}
                        </Text>
                      </View>
                    </View>

                    {groupedLeads[stage].length > 0 ? (
                      <View className="gap-2">
                        {groupedLeads[stage].map((lead: any) => (
                          <TouchableOpacity
                            key={lead.id}
                            className="bg-background rounded-lg p-3 border border-border"
                            activeOpacity={0.7}
                            onPress={() => setSelectedLead(lead)}
                          >
                            <View className="flex-row items-center justify-between mb-1">
                              <Text className="text-base font-semibold text-foreground">
                                {lead.name || lead.company || "-"}
                              </Text>
                              <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: getPriorityColor(lead.priority) + '20' }}>
                                <Text className="text-xs font-semibold" style={{ color: getPriorityColor(lead.priority) }}>
                                  {getPriorityLabel(lead.priority)}
                                </Text>
                              </View>
                            </View>
                            {lead.name && lead.company ? <Text className="text-sm text-muted mb-2">{lead.company}</Text> : null}
                            <Text className="text-sm font-semibold text-success">
                              CHF {(lead.value || 0).toLocaleString("de-CH")}
                            </Text>
                            <View className="flex-row gap-2 mt-2">
                              <TouchableOpacity
                                className="flex-1 bg-primary/20 py-1 rounded"
                                onPress={() => {
                                  setEditingLead(lead);
                                  setShowAddModal(true);
                                }}
                                activeOpacity={0.7}
                              >
                                <Text className="text-primary text-xs font-semibold text-center">
                                  Bearbeiten
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                className="flex-1 bg-success/20 py-1 rounded"
                                onPress={() => setConvertingLead(lead)}
                                activeOpacity={0.7}
                              >
                                <Text className="text-success text-xs font-semibold text-center">
                                  Als Kunde
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                className="flex-1 bg-error/20 py-1 rounded"
                                onPress={() => {
                                  showConfirm(
                                    "Lead löschen",
                                    `Möchten Sie "${lead.name}" wirklich löschen?`,
                                    () => deleteLead.mutate(lead.id)
                                  );
                                }}
                                activeOpacity={0.7}
                              >
                                <Text className="text-error text-xs font-semibold text-center">
                                  Löschen
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : (
                      <Text className="text-sm text-muted text-center py-2">
                        Keine Leads in dieser Phase
                      </Text>
                    )}
                  </View>
                ))}
              </View>

              {/* Gewonnen/Verloren */}
              <View className="flex-row gap-3 mt-4">
                <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-base font-semibold text-foreground">Gewonnen</Text>
                    <View className="px-2 py-1 rounded-full bg-success">
                      <Text className="text-xs font-semibold text-white">
                        {leads.filter((l: any) => l.status === "won").length}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-sm text-muted">Erfolgreich abgeschlossen</Text>
                </View>

                <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-base font-semibold text-foreground">Verloren</Text>
                    <View className="px-2 py-1 rounded-full bg-error">
                      <Text className="text-xs font-semibold text-white">
                        {leads.filter((l: any) => l.status === "lost").length}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-sm text-muted">Nicht erfolgreich</Text>
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Add/Edit Lead Modal */}
      <LeadFormModal
        visible={showAddModal}
        lead={editingLead}
        onClose={() => {
          setShowAddModal(false);
          setEditingLead(null);
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["leads"] });
        }}
      />

      {/* Convert Lead to Customer Modal */}
      {convertingLead && (
        <ConvertLeadModal
          lead={convertingLead}
          onClose={() => setConvertingLead(null)}
        />
      )}

      {/* Lead Details Modal */}
      {selectedLead && (
        <LeadDetailsModal
          lead={selectedLead}
          onClose={() => {
            setSelectedLead(null);
            queryClient.invalidateQueries({ queryKey: ["leads"] });
          }}
        />
      )}
    </ScreenContainer>
  );
}

// Lead zu Kunde konvertieren Modal
function ConvertLeadModal({
  lead,
  onClose,
}: {
  lead: any;
  onClose: () => void;
}) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const [isConverting, setIsConverting] = useState(false);

  const createCustomer = useMutation({
    mutationFn: (data: any) => Data.createCustomer({
      first_name: data.firstName,
      last_name: data.lastName,
      company_name: data.companyName,
      email: data.email,
      phone: data.phone,
      status: data.status,
      notes: data.notes,
    }),
    onSuccess: async () => {
      // Lead-Status auf "won" setzen
      await Data.updateLead(lead.id, { status: "won" });
      await Data.addLeadActivity({
        lead_id: lead.id,
        type: "system",
        content: "Lead als Kunde erfasst und Status auf 'Gewonnen' gesetzt",
        user_name: "System",
      });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      showAlert("Erfolg", "Lead wurde erfolgreich als Kunde erfasst!");
      onClose();
    },
    onError: (error: any) => {
      showAlert("Fehler", "Fehler beim Erstellen des Kunden: " + error.message);
      setIsConverting(false);
    },
  });

  const handleConvert = () => {
    setIsConverting(true);
    const nameParts = lead.name.split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    createCustomer.mutate({
      firstName,
      lastName,
      companyName: lead.company || "",
      email: lead.email || "",
      phone: lead.phone || "",
      status: "active",
      notes: `Konvertiert aus Lead (Wert: CHF ${(lead.value || 0).toLocaleString("de-CH")})`,
    });
  };

  return (
    <Modal visible={true} animationType="fade" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 items-center justify-center p-4">
        <View className="bg-background rounded-2xl p-6 w-full max-w-md">
          <Text className="text-2xl font-bold text-foreground mb-4">
            Als Kunde erfassen
          </Text>

          <View className="bg-surface rounded-lg p-4 mb-6">
            <Text className="text-sm text-muted mb-2">Lead-Informationen:</Text>
            <Text className="text-base font-semibold text-foreground">
              {lead.name}
            </Text>
            <Text className="text-sm text-muted">{lead.company || "-"}</Text>
            {lead.email && <Text className="text-sm text-muted">{lead.email}</Text>}
            <Text className="text-sm text-success mt-2">
              Potenzial: CHF {(lead.value || 0).toLocaleString("de-CH")}
            </Text>
          </View>

          <Text className="text-sm text-muted mb-6">
            Möchten Sie diesen Lead als Kunde erfassen? Die Daten werden automatisch übernommen.
          </Text>

          <View className="flex-row gap-3">
            <TouchableOpacity
              className="flex-1 bg-surface border border-border py-3 rounded-lg"
              onPress={onClose}
              disabled={isConverting}
              activeOpacity={0.7}
            >
              <Text className="text-foreground font-semibold text-center">Abbrechen</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 bg-success py-3 rounded-lg"
              onPress={handleConvert}
              disabled={isConverting}
              activeOpacity={0.8}
            >
              {isConverting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-background font-semibold text-center">
                  Als Kunde erfassen
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}


// Lead-Details Modal mit Historie
function LeadDetailsModal({
  lead,
  onClose,
}: {
  lead: any;
  onClose: () => void;
}) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const [newActivity, setNewActivity] = useState("");
  const [currentUserName, setCurrentUserName] = useState("Admin");
  const [currentStatus, setCurrentStatus] = useState(lead.status);

  // Echten Benutzernamen laden
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

  const { data: activities = [], refetch: refetchActivities } = useQuery({
    queryKey: ["lead_activities", lead.id],
    queryFn: () => Data.getLeadActivities(lead.id),
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => Data.updateLead(lead.id, { status }),
    onSuccess: async (_, status) => {
      setCurrentStatus(status);
      await Data.addLeadActivity({
        lead_id: lead.id,
        type: "system",
        content: `Status geändert zu: ${getStatusLabel(status as LeadStatus)}`,
        user_name: "System",
      });
      refetchActivities();
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  const handleAddActivity = async () => {
    if (!newActivity.trim()) return;
    try {
      await Data.addLeadActivity({
        lead_id: lead.id,
        type: "activity",
        content: newActivity.trim(),
        user_name: currentUserName,
      });
      setNewActivity("");
      refetchActivities();
    } catch (e: any) {
      showAlert("Fehler", e.message);
    }
  };

  const getPriorityLabel = (p: string) => ({ low: "Tief", medium: "Mittel", high: "Hoch" }[p] || "Mittel");
  const getPriorityColor = (p: string) => ({ low: "#6B7280", medium: "#F59E0B", high: "#EF4444" }[p] || "#F59E0B");

  const getStatusLabel = (status: LeadStatus) => {
    const labels: Record<LeadStatus, string> = {
      new: "Neu",
      contacted: "Kontaktiert",
      qualified: "Qualifiziert",
      proposal: "Angebot",
      won: "Gewonnen",
      lost: "Verloren",
    };
    return labels[status];
  };

  const getStatusColor = (status: LeadStatus) => {
    const colorMap: Record<LeadStatus, string> = {
      new: colors.muted,
      contacted: colors.primary,
      qualified: colors.warning,
      proposal: "#9333EA",
      won: colors.success,
      lost: colors.error,
    };
    return colorMap[status];
  };

  const allStatuses: LeadStatus[] = ["new", "contacted", "qualified", "proposal", "won", "lost"];

  return (
    <Modal visible={true} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-end" style={Platform.OS === 'web' ? { justifyContent: 'center', alignItems: 'center' } : undefined}>
        <View className="bg-background rounded-t-3xl" style={Platform.OS === 'web' ? { maxWidth: 700, width: '100%', borderRadius: 24, maxHeight: '85%' } : { maxHeight: '90%' }}>
          {/* Header */}
          <View className="flex-row items-center justify-between p-4 border-b border-border">
            <Text className="text-2xl font-bold text-foreground">Lead-Details</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView className="p-4" showsVerticalScrollIndicator={false}>
            <View className="gap-4">
              <View>
                <Text className="text-sm text-muted mb-1">Kontaktperson</Text>
                <Text className="text-lg font-semibold text-foreground">{lead.name}</Text>
              </View>

              <View>
                <Text className="text-sm text-muted mb-1">Firma</Text>
                <Text className="text-base text-foreground">{lead.company || "-"}</Text>
              </View>

              {lead.email && (
                <View>
                  <Text className="text-sm text-muted mb-1">E-Mail</Text>
                  <Text className="text-base text-foreground">{lead.email}</Text>
                </View>
              )}

              {lead.phone && (
                <View>
                  <Text className="text-sm text-muted mb-1">Telefon</Text>
                  <Text className="text-base text-foreground">{lead.phone}</Text>
                </View>
              )}

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-sm text-muted mb-1">Status</Text>
                  <View
                    className="px-3 py-2 rounded-lg"
                    style={{ backgroundColor: getStatusColor(currentStatus) + "20" }}
                  >
                    <Text
                      className="text-sm font-semibold text-center"
                      style={{ color: getStatusColor(currentStatus) }}
                    >
                      {getStatusLabel(currentStatus)}
                    </Text>
                  </View>
                </View>
                <View className="flex-1">
                  <Text className="text-sm text-muted mb-1">Priorität</Text>
                  <View
                    className="px-3 py-2 rounded-lg"
                    style={{ backgroundColor: getPriorityColor(lead.priority) + '20' }}
                  >
                    <Text
                      className="text-sm font-semibold text-center"
                      style={{ color: getPriorityColor(lead.priority) }}
                    >
                      {getPriorityLabel(lead.priority)}
                    </Text>
                  </View>
                </View>
                <View className="flex-1">
                  <Text className="text-sm text-muted mb-1">Potenzialwert</Text>
                  <View className="px-3 py-2 rounded-lg bg-success/10">
                    <Text className="text-sm font-semibold text-center text-success">
                      CHF {(lead.value || 0).toLocaleString("de-CH")}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Status ändern */}
              <View>
                <Text className="text-sm text-muted mb-2">Status ändern:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="flex-row gap-2">
                    {allStatuses.map((s) => (
                      <TouchableOpacity
                        key={s}
                        className={`px-3 py-1.5 rounded-md ${currentStatus === s ? "bg-primary" : "bg-surface border border-border"}`}
                        onPress={() => updateStatus.mutate(s)}
                        activeOpacity={0.7}
                      >
                        <Text className={`text-xs font-semibold ${currentStatus === s ? "text-background" : "text-foreground"}`}>
                          {getStatusLabel(s)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </View>

            {/* Historie */}
            <View className="mt-6">
              <Text className="text-lg font-bold text-foreground mb-3">Aktivitätsverlauf</Text>
              <ScrollView className="max-h-64 mb-4" showsVerticalScrollIndicator={false}>
                {activities.length === 0 ? (
                  <Text className="text-sm text-muted text-center py-4">Noch keine Aktivitäten</Text>
                ) : (
                  activities.map((activity: any) => (
                    <View
                      key={activity.id}
                      className={`mb-3 p-3 rounded-lg ${activity.type === "system" ? "bg-surface" : "bg-primary/10"}`}
                    >
                      <View className="flex-row items-center justify-between mb-1">
                        <Text
                          className={`text-xs font-semibold ${activity.type === "system" ? "text-muted" : "text-primary"}`}
                        >
                          {activity.user_name || "System"}
                        </Text>
                        <Text className="text-xs text-muted">
                          {new Date(activity.created_at).toLocaleString("de-CH", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </Text>
                      </View>
                      <Text className="text-sm text-foreground">{activity.content}</Text>
                    </View>
                  ))
                )}
              </ScrollView>

              {/* Aktivität hinzufügen */}
              <View className="gap-2">
                <TextInput
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="Neue Aktivität hinzufügen..."
                  placeholderTextColor={colors.muted}
                  multiline
                  numberOfLines={2}
                  textAlignVertical="top"
                  value={newActivity}
                  onChangeText={setNewActivity}
                />
                <TouchableOpacity
                  className="bg-primary py-2 rounded-lg"
                  onPress={handleAddActivity}
                  activeOpacity={0.8}
                >
                  <Text className="text-background font-semibold text-center">
                    Aktivität hinzufügen
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

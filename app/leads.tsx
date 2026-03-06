import { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  TextInput,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { LeadFormModal } from "@/components/lead-form-modal";
import { useMutation } from "@tanstack/react-query";
import * as Data from "@/lib/data";

type LeadStatus = "new" | "contacted" | "qualified" | "proposal" | "won" | "lost";

interface Lead {
  id: number;
  name: string;
  company: string;
  value: number;
  status: LeadStatus;
}

const mockLeads: Lead[] = [
  { id: 1, name: "Max Mustermann", company: "Musterfirma GmbH", value: 5000, status: "new" },
  { id: 2, name: "Anna Schmidt", company: "Schmidt AG", value: 12000, status: "contacted" },
  { id: 3, name: "Peter Müller", company: "Müller & Co", value: 8500, status: "qualified" },
];

export default function LeadsScreen() {
  const router = useRouter();
  const colors = useColors();
  const [leads, setLeads] = useState<Lead[]>(mockLeads);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

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

  const groupedLeads = {
    new: leads.filter((l) => l.status === "new"),
    contacted: leads.filter((l) => l.status === "contacted"),
    qualified: leads.filter((l) => l.status === "qualified"),
    proposal: leads.filter((l) => l.status === "proposal"),
  };

  const totalValue = leads.reduce((sum, lead) => sum + lead.value, 0);

  return (
    <ScreenContainer>
      <ScrollView className="flex-1 p-4">
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

        {/* Pipeline-Stages */}
        <View className="gap-4">
          {(Object.keys(groupedLeads) as Array<keyof typeof groupedLeads>).map((stage) => (
            <View key={stage} className="bg-surface rounded-xl p-4 border border-border">
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
                  {groupedLeads[stage].map((lead) => (
                    <TouchableOpacity
                      key={lead.id}
                      className="bg-background rounded-lg p-3 border border-border"
                      activeOpacity={0.7}
                      onPress={() => setSelectedLead(lead)}
                    >
                      <Text className="text-base font-semibold text-foreground mb-1">
                        {lead.name}
                      </Text>
                      <Text className="text-sm text-muted mb-2">{lead.company}</Text>
                      <Text className="text-sm font-semibold text-success">
                        CHF {lead.value.toLocaleString("de-CH")}
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
                            Alert.alert(
                              "Lead löschen",
                              `Möchten Sie "${lead.name}" wirklich löschen?`,
                              [
                                { text: "Abbrechen", style: "cancel" },
                                {
                                  text: "Löschen",
                                  style: "destructive",
                                  onPress: () => {
                                    setLeads(leads.filter((l) => l.id !== lead.id));
                                  },
                                },
                              ]
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
                  {leads.filter((l) => l.status === "won").length}
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
                  {leads.filter((l) => l.status === "lost").length}
                </Text>
              </View>
            </View>
            <Text className="text-sm text-muted">Nicht erfolgreich</Text>
          </View>
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
        onSuccess={() => { }}
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
          onClose={() => setSelectedLead(null)}
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
  lead: Lead;
  onClose: () => void;
}) {
  const colors = useColors();
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
    onSuccess: () => {
      alert("Lead wurde erfolgreich als Kunde erfasst!");
      onClose();
    },
    onError: (error: any) => {
      alert("Fehler beim Erstellen des Kunden: " + error.message);
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
      companyName: lead.company,
      email: "",
      phone: "",
      status: "active",
      notes: `Konvertiert aus Lead (Wert: CHF ${lead.value.toLocaleString("de-CH")})`,
    });
  };

  return (
    <Modal
      visible={true}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
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
            <Text className="text-sm text-muted">{lead.company}</Text>
            <Text className="text-sm text-success mt-2">
              Potenzial: CHF {lead.value.toLocaleString("de-CH")}
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
              <Text className="text-foreground font-semibold text-center">
                Abbrechen
              </Text>
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
  lead: Lead;
  onClose: () => void;
}) {
  const colors = useColors();
  const [newActivity, setNewActivity] = useState("");
  const [activities, setActivities] = useState([
    {
      id: 1,
      type: "system" as const,
      text: "Lead erstellt",
      createdAt: "2026-02-01T09:00:00",
      user: "System",
    },
    {
      id: 2,
      type: "activity" as const,
      text: "Erstkontakt per E-Mail",
      createdAt: "2026-02-01T14:30:00",
      user: "Anna Müller",
    },
    {
      id: 3,
      type: "system" as const,
      text: `Status geändert: Neu → Kontaktiert`,
      createdAt: "2026-02-01T14:35:00",
      user: "System",
    },
    {
      id: 4,
      type: "activity" as const,
      text: "Telefonat geführt, Interesse bestätigt",
      createdAt: "2026-02-02T10:15:00",
      user: "Anna Müller",
    },
  ]);

  const handleAddActivity = () => {
    if (!newActivity.trim()) return;

    const activity = {
      id: activities.length + 1,
      type: "activity" as const,
      text: newActivity,
      createdAt: new Date().toISOString(),
      user: "Aktueller Benutzer",
    };

    setActivities([...activities, activity]);
    setNewActivity("");
  };

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

  return (
    <Modal visible={true} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-background rounded-t-3xl" style={{ maxHeight: "90%" }}>
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
                <Text className="text-sm text-muted mb-1">Name</Text>
                <Text className="text-lg font-semibold text-foreground">{lead.name}</Text>
              </View>

              <View>
                <Text className="text-sm text-muted mb-1">Firma</Text>
                <Text className="text-base text-foreground">{lead.company}</Text>
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-sm text-muted mb-1">Status</Text>
                  <View
                    className="px-3 py-2 rounded-lg"
                    style={{ backgroundColor: getStatusColor(lead.status) + "20" }}
                  >
                    <Text
                      className="text-sm font-semibold text-center"
                      style={{ color: getStatusColor(lead.status) }}
                    >
                      {getStatusLabel(lead.status)}
                    </Text>
                  </View>
                </View>
                <View className="flex-1">
                  <Text className="text-sm text-muted mb-1">Potenzialwert</Text>
                  <View className="px-3 py-2 rounded-lg bg-success/10">
                    <Text className="text-sm font-semibold text-center text-success">
                      CHF {lead.value.toLocaleString("de-CH")}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Historie */}
            <View className="mt-6">
              <Text className="text-lg font-bold text-foreground mb-3">Aktivitätsverlauf</Text>
              <ScrollView className="max-h-64 mb-4" showsVerticalScrollIndicator={false}>
                {activities.map((activity) => (
                  <View
                    key={activity.id}
                    className={`mb-3 p-3 rounded-lg ${activity.type === "system" ? "bg-surface" : "bg-primary/10"
                      }`}
                  >
                    <View className="flex-row items-center justify-between mb-1">
                      <Text
                        className={`text-xs font-semibold ${activity.type === "system" ? "text-muted" : "text-primary"
                          }`}
                      >
                        {activity.user}
                      </Text>
                      <Text className="text-xs text-muted">
                        {new Date(activity.createdAt).toLocaleString("de-CH", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>
                    <Text className="text-sm text-foreground">{activity.text}</Text>
                  </View>
                ))}
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

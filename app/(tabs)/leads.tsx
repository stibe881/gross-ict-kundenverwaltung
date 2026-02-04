import { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { LeadFormModal } from "@/components/lead-form-modal";
import { trpc } from "@/lib/trpc";

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
  const colors = useColors();
  const [leads] = useState<Lead[]>(mockLeads);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);

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
          <Text className="text-3xl font-bold text-foreground">Akquise</Text>
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
        onSuccess={() => {}}
      />

      {/* Convert Lead to Customer Modal */}
      {convertingLead && (
        <ConvertLeadModal
          lead={convertingLead}
          onClose={() => setConvertingLead(null)}
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

  const createCustomer = trpc.customers.create.useMutation({
    onSuccess: () => {
      alert("Lead wurde erfolgreich als Kunde erfasst!");
      onClose();
    },
    onError: (error) => {
      alert("Fehler beim Erstellen des Kunden: " + error.message);
      setIsConverting(false);
    },
  });

  const handleConvert = () => {
    setIsConverting(true);
    
    // Lead-Daten in Kunden-Format umwandeln
    const nameParts = lead.name.split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    createCustomer.mutate({
      firstName,
      lastName,
      companyName: lead.company,
      email: "", // Lead hat kein E-Mail-Feld in der aktuellen Struktur
      phone: "", // Lead hat kein Telefon-Feld in der aktuellen Struktur
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

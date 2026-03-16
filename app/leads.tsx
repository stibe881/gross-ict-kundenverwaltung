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
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { LeadFormModal } from "@/components/lead-form-modal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { showAlert, showConfirm } from "@/lib/alert";
import Svg, { Circle, G } from "react-native-svg";

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
  const [sortBy, setSortBy] = useState<string>("date");

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: Data.getLeads,
    refetchInterval: 5000, // Automatischer Refresh alle 5 Sekunden
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

  const sortLeads = (list: any[]) => {
    return [...list].sort((a, b) => {
      switch (sortBy) {
        case "name":
          return (a.name || "").localeCompare(b.name || "", "de");
        case "value":
          return (b.value || 0) - (a.value || 0);
        case "priority": {
          const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
          return (order[a.priority] ?? 1) - (order[b.priority] ?? 1);
        }
        case "date":
        default:
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      }
    });
  };

  const groupedLeads = {
    new: sortLeads(filteredLeads.filter((l: any) => l.status === "new")),
    contacted: sortLeads(filteredLeads.filter((l: any) => l.status === "contacted")),
    qualified: sortLeads(filteredLeads.filter((l: any) => l.status === "qualified")),
    proposal: sortLeads(filteredLeads.filter((l: any) => l.status === "proposal")),
  };

  const totalCounts = {
    new: leads.filter((l: any) => l.status === "new").length,
    contacted: leads.filter((l: any) => l.status === "contacted").length,
    qualified: leads.filter((l: any) => l.status === "qualified").length,
    proposal: leads.filter((l: any) => l.status === "proposal").length,
  };

  const totalValue = leads.reduce((sum: number, lead: any) => sum + (lead.value || 0), 0);

  const getPriorityLabel = (p: string) => ({ low: "Tief", medium: "Mittel", high: "Hoch" }[p] || "Mittel");
  const getPriorityColor = (p: string) => ({ low: "#6B7280", medium: "#F59E0B", high: "#EF4444" }[p] || "#F59E0B");

  const { isWide, containerStyle, contentPadding } = useResponsiveLayout();

  return (
    <ScreenContainer>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: contentPadding }}>
        <View style={containerStyle}>
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
              <IconSymbol name="plus.circle.fill" size={24} color="#111111" />
            </TouchableOpacity>
          </View>

          {/* Prioritätsfilter */}
          <View className="flex-row gap-2 mb-4">
            {[
              { key: "all", label: "Alle", color: colors.foreground },
              { key: "high", label: "↑ Hoch", color: "#EF4444" },
              { key: "medium", label: "● Mittel", color: "#F59E0B" },
              { key: "low", label: "↓ Tief", color: "#6B7280" },
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

          {/* Sortierung */}
          <View className="flex-row gap-2 mb-4">
            {[
              { key: "date", label: "Neueste" },
              { key: "name", label: "A-Z" },
              { key: "value", label: "Wert ↓" },
              { key: "priority", label: "Priorität" },
            ].map((s) => (
              <TouchableOpacity
                key={s.key}
                className="px-3 py-1.5 rounded-lg border"
                style={{
                  backgroundColor: sortBy === s.key ? colors.primary + '20' : undefined,
                  borderColor: sortBy === s.key ? colors.primary : '#374151',
                }}
                onPress={() => setSortBy(s.key)}
              >
                <Text
                  className="text-xs font-semibold"
                  style={{ color: sortBy === s.key ? colors.primary : '#9CA3AF' }}
                >
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Analytics Charts */}
          {!isLoading && leads.length > 0 && (() => {
            const pipelineData = [
              { label: "Neu", count: totalCounts.new, color: colors.muted },
              { label: "Kontaktiert", count: totalCounts.contacted, color: colors.primary },
              { label: "Qualifiziert", count: totalCounts.qualified, color: colors.warning },
              { label: "Angebot", count: totalCounts.proposal, color: "#9333EA" },
            ];
            const pipelineTotal = pipelineData.reduce((s, d) => s + d.count, 0);

            const wonCount = leads.filter((l: any) => l.status === "won").length;
            const lostCount = leads.filter((l: any) => l.status === "lost").length;
            const closedTotal = wonCount + lostCount;
            const winRate = closedTotal > 0 ? Math.round((wonCount / closedTotal) * 100) : 0;
            const wonValue = leads.filter((l: any) => l.status === "won").reduce((s: number, l: any) => s + (l.value || 0), 0);
            const lostValue = leads.filter((l: any) => l.status === "lost").reduce((s: number, l: any) => s + (l.value || 0), 0);

            const resultData = [
              { label: "Gewonnen", count: wonCount, color: colors.success, value: wonValue },
              { label: "Verloren", count: lostCount, color: colors.error, value: lostValue },
            ];

            const renderDonut = (data: { label: string; count: number; color: string }[], total: number, centerText: string, centerSub: string) => {
              const size = 120;
              const strokeWidth = 14;
              const radius = (size - strokeWidth) / 2;
              const circumference = 2 * Math.PI * radius;
              let accumulated = 0;

              return (
                <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                  <Circle cx={size / 2} cy={size / 2} r={radius} stroke="#333" strokeWidth={strokeWidth} fill="none" />
                  <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
                    {data.map((segment, i) => {
                      const pct = total > 0 ? segment.count / total : 0;
                      const dashLength = pct * circumference;
                      const offset = accumulated * circumference;
                      accumulated += pct;
                      if (pct === 0) return null;
                      return (
                        <Circle
                          key={i}
                          cx={size / 2}
                          cy={size / 2}
                          r={radius}
                          stroke={segment.color}
                          strokeWidth={strokeWidth}
                          fill="none"
                          strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                          strokeDashoffset={-offset}
                          strokeLinecap="round"
                        />
                      );
                    })}
                  </G>
                </Svg>
              );
            };

            return (
              <View style={isWide ? { flexDirection: 'row', gap: 16, marginBottom: 16 } : { gap: 16, marginBottom: 16 }}>
                {/* Pipeline Verteilung */}
                <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
                  <Text className="text-sm font-semibold text-foreground mb-3">Pipeline-Verteilung</Text>
                  <View className="flex-row items-center gap-4">
                    <View style={{ position: 'relative', width: 120, height: 120 }}>
                      {renderDonut(pipelineData, pipelineTotal, String(pipelineTotal), 'Aktiv')}
                      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
                        <Text className="text-xl font-bold text-foreground">{pipelineTotal}</Text>
                        <Text className="text-xs text-muted">Aktiv</Text>
                      </View>
                    </View>
                    <View className="flex-1 gap-2">
                      {pipelineData.map((d) => (
                        <View key={d.label} className="flex-row items-center justify-between">
                          <View className="flex-row items-center gap-2">
                            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: d.color }} />
                            <Text className="text-xs text-muted">{d.label}</Text>
                          </View>
                          <Text className="text-xs font-semibold text-foreground">{d.count}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>

                {/* Abschlussquote */}
                <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
                  <Text className="text-sm font-semibold text-foreground mb-3">Abschlussquote</Text>
                  <View className="flex-row items-center gap-4">
                    <View style={{ position: 'relative', width: 120, height: 120 }}>
                      {renderDonut(resultData, closedTotal, `${winRate}%`, 'Gewonnen')}
                      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
                        <Text className="text-xl font-bold" style={{ color: winRate >= 50 ? colors.success : colors.error }}>{winRate}%</Text>
                        <Text className="text-xs text-muted">Quote</Text>
                      </View>
                    </View>
                    <View className="flex-1 gap-3">
                      {resultData.map((d) => (
                        <View key={d.label}>
                          <View className="flex-row items-center gap-2 mb-1">
                            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: d.color }} />
                            <Text className="text-xs text-muted">{d.label}</Text>
                            <Text className="text-xs font-semibold text-foreground">{d.count}</Text>
                          </View>
                          <Text className="text-xs font-semibold" style={{ color: d.color, marginLeft: 18 }}>
                            CHF {(d as any).value.toLocaleString('de-CH')}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              </View>
            );
          })()}
          {/* Website-Anfragen Kachel */}
          {!isLoading && (() => {
            const websiteLeads = sortLeads(leads.filter((l: any) => l.source === 'website' && l.status === 'new'));
            if (websiteLeads.length === 0) return null;
            return (
              <View className="bg-surface rounded-xl p-4 border border-border mb-4" style={{ minHeight: 140, maxHeight: 220 }}>
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center gap-2">
                    <IconSymbol name="globe" size={18} color={colors.primary} />
                    <Text className="text-sm font-semibold text-foreground">Website-Anfragen</Text>
                  </View>
                  <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: colors.primary + '20' }}>
                    <Text className="text-xs font-semibold" style={{ color: colors.primary }}>{websiteLeads.length}</Text>
                  </View>
                </View>
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={websiteLeads.length > 3}>
                  <View className="gap-2">
                    {websiteLeads.map((lead: any) => (
                      <TouchableOpacity
                        key={lead.id}
                        className="flex-row items-center bg-background rounded-lg px-3 py-2 border border-border"
                        activeOpacity={0.7}
                        onPress={() => setSelectedLead(lead)}
                      >
                        <View className="flex-1 mr-2">
                          <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>{lead.company || lead.name || '-'}</Text>
                          {lead.company && lead.name && <Text className="text-xs text-muted" numberOfLines={1}>{lead.name}</Text>}
                        </View>
                        <Text className="text-xs font-semibold text-success mr-3">
                          CHF {(lead.value || 0).toLocaleString('de-CH')}
                        </Text>
                        <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: getPriorityColor(lead.priority) + '20' }}>
                          <Text className="text-[10px] font-semibold" style={{ color: getPriorityColor(lead.priority) }}>
                            {getPriorityLabel(lead.priority)}
                          </Text>
                        </View>
                        <TouchableOpacity
                          className="ml-2 w-7 h-7 rounded-md items-center justify-center"
                          style={{ backgroundColor: '#EF444415' }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          activeOpacity={0.6}
                          onPress={(e) => {
                            e.stopPropagation();
                            showConfirm(
                              "Lead löschen",
                              `Möchten Sie "${lead.company || lead.name}" wirklich löschen?`,
                              async () => {
                                try {
                                  await Data.deleteLead(lead.id);
                                  queryClient.invalidateQueries({ queryKey: ["leads"] });
                                } catch (err: any) {
                                  showAlert("Fehler", err.message);
                                }
                              },
                              "Löschen"
                            );
                          }}
                        >
                          <IconSymbol name="trash" size={14} color="#EF4444" />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            );
          })()}

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
                          {totalCounts[stage]}
                        </Text>
                      </View>
                    </View>

                    {groupedLeads[stage].length > 0 ? (
                      <ScrollView
                        style={groupedLeads[stage].length > 10 ? { maxHeight: 600 } : undefined}
                        nestedScrollEnabled
                        showsVerticalScrollIndicator={groupedLeads[stage].length > 10}
                      >
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
                                  {lead.company || lead.name || "-"}
                                </Text>
                                <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: getPriorityColor(lead.priority) + '20' }}>
                                  <Text className="text-xs font-semibold" style={{ color: getPriorityColor(lead.priority) }}>
                                    {getPriorityLabel(lead.priority)}
                                  </Text>
                                </View>
                              </View>
                              {lead.name && lead.company ? <Text className="text-sm text-muted mb-2">{lead.name}{lead.position ? ` · ${lead.position}` : ''}</Text> : null}
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
                      </ScrollView>
                    ) : (
                      <Text className="text-sm text-muted text-center py-2">
                        Keine Leads in dieser Phase
                      </Text>
                    )}
                  </View>
                ))}
              </View>

              {/* Gewonnen/Verloren */}
              < View className="flex-row gap-3 mt-4" >
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const [newActivity, setNewActivity] = useState("");
  const [currentUserName, setCurrentUserName] = useState("Admin");
  const [currentStatus, setCurrentStatus] = useState(lead.status);
  const [linkedQuoteId, setLinkedQuoteId] = useState<string | null>(lead.quote_id || null);
  const [showQuotePicker, setShowQuotePicker] = useState(false);

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

  // Load lead items (products)
  const { data: leadItems = [] } = useQuery({
    queryKey: ["lead_items", lead.id],
    queryFn: () => Data.getLeadItems(lead.id),
  });

  // Quotes laden für Verknüpfung
  const { data: allQuotes = [] } = useQuery({
    queryKey: ["quotes"],
    queryFn: Data.getAllQuotes,
    enabled: currentStatus === 'proposal' || !!linkedQuoteId,
  });
  const linkedQuote = allQuotes.find((q: any) => q.id === linkedQuoteId);

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
                  <TouchableOpacity onPress={() => Linking.openURL(`mailto:${lead.email}`)} activeOpacity={0.7}>
                    <Text className="text-base text-primary">{lead.email}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {lead.phone && (
                <View>
                  <Text className="text-sm text-muted mb-1">Telefon</Text>
                  <TouchableOpacity onPress={() => Linking.openURL(`tel:${lead.phone}`)} activeOpacity={0.7}>
                    <Text className="text-base text-primary">{lead.phone}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {lead.source && (
                <View>
                  <Text className="text-sm text-muted mb-1">Quelle</Text>
                  <Text className="text-base text-foreground">
                    {{ website: "Website", empfehlung: "Empfehlung", messe: "Messe", kaltakquise: "Kaltakquise", social_media: "Social Media" }[lead.source as string] || lead.source}
                  </Text>
                </View>
              )}

              {(lead.address || lead.zip || lead.city) ? (
                <View>
                  <Text className="text-sm text-muted mb-1">Adresse</Text>
                  <Text className="text-base text-foreground">
                    {[lead.address, [lead.zip, lead.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
                  </Text>
                </View>
              ) : null}

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

              {/* Notizen */}
              {lead.notes && (
                <View className="bg-surface rounded-xl p-4 border border-border">
                  <Text className="text-sm font-semibold text-foreground mb-2"><IconSymbol name="note.text" size={14} color={colors.foreground} /> Notizen</Text>
                  <Text className="text-sm text-foreground leading-5">{lead.notes}</Text>
                </View>
              )}

              {/* Produkte & Potenzial-Aufschlüsselung */}
              {(leadItems.length > 0 || lead.extra_amount) && (
                <View className="bg-surface rounded-xl p-4 border border-border">
                  <Text className="text-sm font-semibold text-foreground mb-2"><IconSymbol name="banknote" size={14} color={colors.foreground} /> Potenzial-Details</Text>
                  {leadItems.length > 0 && (
                    <View className="gap-1 mb-2">
                      {leadItems.map((item: any, idx: number) => (
                        <View key={idx} className="flex-row items-center justify-between py-1">
                          <View className="flex-1 mr-3">
                            <Text className="text-sm text-foreground">{item.description}</Text>
                            <Text className="text-xs text-muted">{item.quantity}× CHF {(item.unit_price || 0).toLocaleString("de-CH", { minimumFractionDigits: 2 })}</Text>
                          </View>
                          <Text className="text-sm font-semibold text-foreground">
                            CHF {((item.quantity || 1) * (item.unit_price || 0)).toLocaleString("de-CH", { minimumFractionDigits: 2 })}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {lead.extra_amount > 0 && (
                    <View className="flex-row items-center justify-between py-1 border-t border-border mt-1 pt-2">
                      <Text className="text-sm text-foreground">
                        {lead.extra_description || "Sonstiges"}
                      </Text>
                      <Text className="text-sm font-semibold text-foreground">
                        CHF {(lead.extra_amount || 0).toLocaleString("de-CH", { minimumFractionDigits: 2 })}
                      </Text>
                    </View>
                  )}
                  <View className="flex-row items-center justify-between border-t border-border mt-2 pt-2">
                    <Text className="text-sm font-bold text-foreground">Gesamt</Text>
                    <Text className="text-sm font-bold text-success">
                      CHF {(lead.value || 0).toLocaleString("de-CH", { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                </View>
              )}

              {/* Verknüpftes Angebot */}
              {(currentStatus === 'proposal' || linkedQuoteId) && (
                <View className="bg-surface rounded-xl p-4 border border-border">
                  <Text className="text-sm font-semibold text-foreground mb-2">Verknüpftes Angebot</Text>
                  {linkedQuote ? (
                    <View className="flex-row items-center justify-between">
                      <TouchableOpacity onPress={() => router.push(`/quote/${linkedQuote.id}` as any)} activeOpacity={0.7}>
                        <Text className="text-base font-semibold text-primary">{linkedQuote.quote_number}</Text>
                        <Text className="text-sm text-muted">{linkedQuote.customer?.company_name || linkedQuote.customer?.first_name} - CHF {(linkedQuote.total || 0).toLocaleString('de-CH')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="px-3 py-1.5 rounded-lg bg-error/20"
                        onPress={async () => {
                          await Data.updateLead(lead.id, { quote_id: null });
                          setLinkedQuoteId(null);
                          queryClient.invalidateQueries({ queryKey: ["leads"] });
                        }}
                      >
                        <Text className="text-xs font-semibold text-error">Entfernen</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View>
                      {showQuotePicker ? (
                        <View className="gap-2">
                          {allQuotes.length === 0 ? (
                            <Text className="text-sm text-muted">Keine Angebote vorhanden</Text>
                          ) : (
                            allQuotes.slice(0, 10).map((q: any) => (
                              <TouchableOpacity
                                key={q.id}
                                className="bg-background rounded-lg p-3 border border-border"
                                onPress={async () => {
                                  await Data.updateLead(lead.id, { quote_id: q.id });
                                  setLinkedQuoteId(q.id);
                                  setShowQuotePicker(false);
                                  await Data.addLeadActivity({
                                    lead_id: lead.id,
                                    type: 'system',
                                    content: `Angebot ${q.quote_number} verknüpft`,
                                    user_name: 'System',
                                  });
                                  refetchActivities();
                                  queryClient.invalidateQueries({ queryKey: ["leads"] });
                                }}
                              >
                                <Text className="text-sm font-semibold text-foreground">{q.quote_number}</Text>
                                <Text className="text-xs text-muted">{q.customer?.company_name || q.customer?.first_name} • CHF {(q.total || 0).toLocaleString('de-CH')}</Text>
                              </TouchableOpacity>
                            ))
                          )}
                          <TouchableOpacity onPress={() => setShowQuotePicker(false)}>
                            <Text className="text-sm text-muted text-center mt-1">Abbrechen</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          className="bg-primary/10 rounded-lg p-3 items-center"
                          onPress={() => setShowQuotePicker(true)}
                        >
                          <Text className="text-sm font-semibold text-primary">Angebot verknüpfen</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              )}

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

import { useState, useEffect, useRef, useCallback } from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
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
  RefreshControl,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BackButton } from "@/components/back-button";
import { useColors } from "@/hooks/use-colors";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { LeadFormModal } from "@/components/lead-form-modal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { showAlert, showConfirm } from "@/lib/alert";
import Svg, { Circle, G } from "react-native-svg";
import { useGlobalRefresh } from "@/hooks/use-global-refresh";
import { scheduleReminderNotification, cancelReminderNotification } from "@/lib/local-notifications";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";

type LeadStatus = "new" | "contacted" | "qualified" | "proposal" | "won" | "lost";

// Zentrale Phasen-Definition fürs Akquise-Dashboard
const STAGE_META: Record<LeadStatus, { label: string; color: string }> = {
  new: { label: "Neu", color: "#C19A6B" },
  contacted: { label: "Kontaktiert", color: "#0EA5E9" },
  qualified: { label: "Qualifiziert", color: "#F59E0B" },
  proposal: { label: "Angebot", color: "#8B5CF6" },
  won: { label: "Gewonnen", color: "#22C55E" },
  lost: { label: "Verloren", color: "#EF4444" },
};
const ACTIVE_STAGES: LeadStatus[] = ["new", "contacted", "qualified", "proposal"];
const STAGE_ORDER: LeadStatus[] = ["new", "contacted", "qualified", "proposal", "won"];
// Einstufung als Icons (statt Emojis), in App-Farben
const RATING_META: Record<string, { icon: string; color: string; label: string }> = {
  hot: { icon: "flame.fill", color: "#EF4444", label: "Heiss" },
  warm: { icon: "sun.max.fill", color: "#F59E0B", label: "Warm" },
  cold: { icon: "snowflake", color: "#38BDF8", label: "Kalt" },
};
const LOST_REASONS = [
  { key: "zu_teuer", label: "Zu teuer" },
  { key: "konkurrenz", label: "Konkurrenz" },
  { key: "kein_bedarf", label: "Kein Bedarf" },
  { key: "keine_antwort", label: "Keine Antwort" },
  { key: "sonstiges", label: "Sonstiges" },
];
const lostReasonLabel = (key: string) => LOST_REASONS.find((r) => r.key === key)?.label || key;

// Automatisches Lead-Scoring: schlägt eine Einstufung vor, wenn keine
// manuelle gesetzt ist (Signale: Website-Mängel, Potenzialwert, Quelle, Phase)
function suggestRating(lead: any): "hot" | "warm" | "cold" {
  let score = 0;
  const wc = lead.web_check;
  if (wc) {
    const issues = [!wc.sslValid, !wc.hasImpressum, !wc.hasPrivacy, !wc.isResponsive].filter(Boolean).length;
    score += Math.min(issues, 2);
  }
  if ((lead.value || 0) >= 3000) score += 2;
  else if ((lead.value || 0) >= 1000) score += 1;
  if (lead.source === "empfehlung" || lead.source === "website") score += 2;
  else if (lead.source === "messe") score += 1;
  if (lead.status === "qualified" || lead.status === "proposal") score += 1;
  return score >= 4 ? "hot" : score >= 2 ? "warm" : "cold";
}

export default function LeadsScreen() {
  const router = useRouter();
  const colors = useColors();
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCallMode, setShowCallMode] = useState(false);
  const [showCrossSell, setShowCrossSell] = useState(false);
  const [editingLead, setEditingLead] = useState<any | null>(null);
  const [convertingLead, setConvertingLead] = useState<any | null>(null);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("date");
  const [mobileStage, setMobileStage] = useState<LeadStatus>("new");
  const [dragOverStage, setDragOverStage] = useState<LeadStatus | null>(null);
  const [showImport, setShowImport] = useState(false);
  const { refreshing, onRefresh } = useGlobalRefresh();
  const { isWide, containerStyle, contentPadding } = useResponsiveLayout();

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: Data.getLeads,
    refetchInterval: 5000,
  });

  // Deep-Link aus Heute-Feed/Push: /leads?leadId=... öffnet den Lead direkt
  const { leadId } = useLocalSearchParams();
  useEffect(() => {
    if (!leadId || !leads.length) return;
    const found = (leads as any[]).find((l: any) => String(l.id) === String(leadId));
    if (found) setSelectedLead(found);
  }, [leadId, leads]);

  const deleteLead = useMutation({
    mutationFn: (id: string) => Data.deleteLead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
  });

  const updateLeadStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => Data.updateLead(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
  });

  const getStatusLabel = (status: LeadStatus) => STAGE_META[status]?.label || status;
  const getStatusColor = (status: LeadStatus) => STAGE_META[status]?.color || colors.muted;
  const getPriorityLabel = (p: string) => ({ low: "Tief", medium: "Mittel", high: "Hoch" }[p] || "Mittel");
  const getPriorityColor = (p: string) => ({ low: "#6B7280", medium: "#F59E0B", high: "#EF4444" }[p] || "#F59E0B");

  const filteredLeads = leads.filter((l: any) => {
    if (priorityFilter !== "all" && (l.priority || "medium") !== priorityFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = l.name && l.name.toLowerCase().includes(q);
      const matchCompany = l.company && l.company.toLowerCase().includes(q);
      const matchEmail = l.email && l.email.toLowerCase().includes(q);
      if (!matchName && !matchCompany && !matchEmail) return false;
    }
    return true;
  });

  const sortLeads = (list: any[]) => {
    return [...list].sort((a, b) => {
      switch (sortBy) {
        case "name":
          return (a.name || a.company || "").localeCompare(b.name || b.company || "", "de");
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

  const byStage = (stage: LeadStatus) => sortLeads(filteredLeads.filter((l: any) => l.status === stage));
  const stageSum = (stage: LeadStatus) =>
    filteredLeads.filter((l: any) => l.status === stage).reduce((s: number, l: any) => s + (l.value || 0), 0);

  // ── KPIs ──
  const activeLeads = filteredLeads.filter((l: any) => ACTIVE_STAGES.includes(l.status));
  const pipelineValue = activeLeads.reduce((s: number, l: any) => s + (l.value || 0), 0);

  // Gewichtete Pipeline: Wert × Abschlusswahrscheinlichkeit aus der Einstufung;
  // ohne manuelle Einstufung zählt der automatische Score-Vorschlag
  const RATING_WEIGHTS: Record<string, number> = { hot: 0.7, warm: 0.4, cold: 0.15 };
  const weightedValue = activeLeads.reduce((sum: number, lead: any) => {
    const w = RATING_WEIGHTS[lead.rating || suggestRating(lead)] ?? 0.3;
    return sum + (lead.value || 0) * w;
  }, 0);

  // Wochenziel: protokollierte Kontakte seit Montag
  const { data: mkSettings = {} } = useQuery({
    queryKey: ["marketingSettings"],
    queryFn: Data.getMarketingSettings,
  });
  const { data: weekStats } = useQuery({
    queryKey: ["weeklyContacts"],
    queryFn: Data.getWeeklyContactStats,
    refetchInterval: 60000,
  });
  const weeklyGoal = parseInt((mkSettings as any).weekly_contact_goal, 10) || 10;
  const weeklyContacts = weekStats?.contacts || 0;

  const wonLeads = filteredLeads.filter((l: any) => l.status === "won");
  const lostLeads = filteredLeads.filter((l: any) => l.status === "lost");
  const closedTotal = wonLeads.length + lostLeads.length;
  const winRate = closedTotal > 0 ? Math.round((wonLeads.length / closedTotal) * 100) : 0;
  const wonValue = wonLeads.reduce((s: number, l: any) => s + (l.value || 0), 0);
  const lostValue = lostLeads.reduce((s: number, l: any) => s + (l.value || 0), 0);

  // "Heute dran": fällige Erinnerungen + überfällige nächste Aktionen aktiver Leads
  const endOfToday = new Date(new Date().setHours(23, 59, 59, 999));
  const todayStr = new Date().toISOString().split("T")[0];
  const dueList = activeLeads
    .map((l: any) => {
      const pending = (l.lead_reminders || [])
        .filter((r: any) => !r.is_processed)
        .sort((a: any, b: any) => new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime());
      const dueReminder = pending.find((r: any) => new Date(r.remind_at) <= endOfToday);
      const actionDue = l.next_action && l.next_action_date && l.next_action_date <= todayStr;
      if (!dueReminder && !actionDue) return null;
      const when = dueReminder ? new Date(dueReminder.remind_at) : new Date(`${l.next_action_date}T09:00:00`);
      return {
        lead: l,
        text: dueReminder ? dueReminder.note || "Wiedervorlage" : l.next_action,
        when,
        overdue: when < new Date(new Date().setHours(0, 0, 0, 0)),
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.when.getTime() - b.when.getTime());

  // Neue Website-Anfragen (Posteingang)
  const websiteInbox = sortLeads(
    filteredLeads.filter((l: any) => l.source === "website" && l.status === "new")
  );

  const nextStage = (status: LeadStatus): LeadStatus | null => {
    const idx = STAGE_ORDER.indexOf(status);
    if (idx < 0 || idx >= STAGE_ORDER.length - 1) return null;
    return STAGE_ORDER[idx + 1];
  };

  const fmtChf = (v: number) => `CHF ${Math.round(v).toLocaleString("de-CH")}`;

  // ── Wiederverwendbare Lead-Karte ──
  const renderLeadCard = (lead: any) => {
    const pending = (lead.lead_reminders || [])
      .filter((r: any) => !r.is_processed)
      .sort((a: any, b: any) => new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime());
    const nextReminder = pending[0];
    const reminderOverdue = nextReminder && new Date(nextReminder.remind_at) < new Date(new Date().setHours(0, 0, 0, 0));
    const actionOverdue = lead.next_action_date && lead.next_action_date < todayStr;
    const target = nextStage(lead.status);
    const stageDays = Math.max(0, Math.floor(
      (Date.now() - new Date(lead.stage_changed_at || lead.created_at || Date.now()).getTime()) / 86400000
    ));
    const ageColor = stageDays >= 30 ? "#EF4444" : stageDays >= 14 ? "#FB923C" : colors.muted;

    const card = (
      <TouchableOpacity
        key={lead.id}
        className="bg-surface rounded-xl border border-border p-3"
        activeOpacity={0.7}
        onPress={() => setSelectedLead(lead)}
      >
        {/* Kopf: Firma + Prioritäts-Punkt */}
        <View className="flex-row items-center justify-between gap-2">
          {(() => {
            const meta = RATING_META[lead.rating || suggestRating(lead)];
            if (!meta) return null;
            // Gedimmt = automatischer Score-Vorschlag (keine manuelle Einstufung)
            return (
              <View style={{ opacity: lead.rating ? 1 : 0.4 }}>
                <IconSymbol name={meta.icon as any} size={13} color={meta.color} />
              </View>
            );
          })()}
          <Text className="text-[14.5px] font-bold text-foreground flex-1" numberOfLines={1}>
            {lead.company || lead.name || "–"}
          </Text>
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: getPriorityColor(lead.priority) }} />
        </View>
        {lead.company && lead.name ? (
          <Text className="text-xs text-muted mt-0.5" numberOfLines={1}>
            {lead.name}{lead.position ? ` · ${lead.position}` : ""}
          </Text>
        ) : null}

        <View className="flex-row items-center justify-between mt-1.5">
          <Text className="text-sm font-bold" style={{ color: "#4ADE80" }}>
            {fmtChf(lead.value || 0)}
          </Text>
          <View className="flex-row items-center gap-2">
            {lead.source ? (
              <Text className="text-[10px] text-muted uppercase">
                {{ website: "Website", empfehlung: "Empfehlung", messe: "Messe", kaltakquise: "Kaltakquise", social_media: "Social Media" }[lead.source as string] || lead.source}
              </Text>
            ) : null}
            <Text className="text-[10px] font-semibold" style={{ color: ageColor }}>
              {stageDays} Tg.
            </Text>
          </View>
        </View>

        {/* Nächster Schritt */}
        {nextReminder ? (
          <View className="flex-row items-center gap-1.5 mt-2 rounded-lg px-2 py-1.5" style={{ backgroundColor: (reminderOverdue ? "#EF4444" : colors.primary) + "15" }}>
            <IconSymbol name="bell.fill" size={11} color={reminderOverdue ? "#EF4444" : colors.primary} />
            <Text className="text-[11px] font-semibold flex-1" style={{ color: reminderOverdue ? "#EF4444" : colors.primary }} numberOfLines={1}>
              {new Date(nextReminder.remind_at).toLocaleDateString("de-CH")}{nextReminder.note ? ` · ${nextReminder.note}` : ""}
            </Text>
          </View>
        ) : lead.next_action ? (
          <View className="flex-row items-center gap-1.5 mt-2">
            <IconSymbol name="calendar" size={11} color={actionOverdue ? "#EF4444" : colors.muted} />
            <Text className="text-[11px] flex-1" style={{ color: actionOverdue ? "#EF4444" : colors.muted }} numberOfLines={1}>
              {lead.next_action}{lead.next_action_date ? ` (bis ${new Date(lead.next_action_date).toLocaleDateString("de-CH")})` : ""}
            </Text>
          </View>
        ) : null}

        {/* Schnellaktionen */}
        <View className="flex-row items-center gap-1.5 mt-2.5 pt-2.5" style={{ borderTopWidth: 1, borderTopColor: colors.border + "60" }}>
          {target ? (
            <TouchableOpacity
              className="flex-row items-center gap-1 px-2.5 py-1.5 rounded-lg flex-1 justify-center"
              style={{ backgroundColor: getStatusColor(target) + "18" }}
              onPress={() => updateLeadStatus.mutate({ id: lead.id, status: target })}
              activeOpacity={0.7}
            >
              <Text className="text-[11px] font-bold" style={{ color: getStatusColor(target) }} numberOfLines={1}>
                → {getStatusLabel(target)}
              </Text>
            </TouchableOpacity>
          ) : null}
          {(lead.phone || lead.mobile) ? (
            <TouchableOpacity
              className="w-8 h-8 rounded-lg items-center justify-center"
              style={{ backgroundColor: "#25D36618" }}
              onPress={() => {
                const digits = String(lead.phone || lead.mobile).replace(/\D/g, "");
                const intl = digits.startsWith("0") ? "41" + digits.slice(1) : digits;
                Linking.openURL(`https://wa.me/${intl}`);
              }}
              activeOpacity={0.7}
            >
              <IconSymbol name="message.fill" size={13} color="#25D366" />
            </TouchableOpacity>
          ) : null}
          {lead.email ? (
            <TouchableOpacity
              className="w-8 h-8 rounded-lg items-center justify-center"
              style={{ backgroundColor: "#0EA5E918" }}
              onPress={() => Linking.openURL(`mailto:${lead.email}`)}
              activeOpacity={0.7}
            >
              <IconSymbol name="envelope.fill" size={13} color="#0EA5E9" />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            className="w-8 h-8 rounded-lg items-center justify-center"
            style={{ backgroundColor: colors.border + "60" }}
            onPress={() => { setEditingLead(lead); setShowAddModal(true); }}
            activeOpacity={0.7}
          >
            <IconSymbol name="pencil" size={13} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity
            className="w-8 h-8 rounded-lg items-center justify-center"
            style={{ backgroundColor: "#22C55E18" }}
            onPress={() => setConvertingLead(lead)}
            activeOpacity={0.7}
          >
            <IconSymbol name="person.crop.circle.badge.plus" size={14} color="#22C55E" />
          </TouchableOpacity>
          <TouchableOpacity
            className="w-8 h-8 rounded-lg items-center justify-center"
            style={{ backgroundColor: "#EF444415" }}
            onPress={() =>
              showConfirm(
                "Lead löschen",
                `Möchten Sie "${lead.company || lead.name}" wirklich löschen?`,
                () => deleteLead.mutate(lead.id),
                "Löschen"
              )
            }
            activeOpacity={0.7}
          >
            <IconSymbol name="trash" size={13} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );

    // Web: Karte per Drag & Drop in andere Spalten ziehen
    if (Platform.OS === "web") {
      return (
        <div
          key={lead.id}
          draggable
          onDragStart={(e: any) => {
            e.dataTransfer.setData("text/plain", lead.id);
            e.dataTransfer.effectAllowed = "move";
          }}
          style={{ cursor: "grab" }}
        >
          {card}
        </div>
      );
    }
    return card;
  };

  // Web: Spalten/Kacheln als Drop-Ziele für den Phasenwechsel
  const asDropTarget = (stage: LeadStatus, node: any, style?: any) => {
    if (Platform.OS !== "web") return <View key={stage} style={style}>{node}</View>;
    return (
      <div
        key={stage}
        style={{ display: "flex", flexDirection: "column", ...(style || {}) }}
        onDragOver={(e: any) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          if (dragOverStage !== stage) setDragOverStage(stage);
        }}
        onDragLeave={() => setDragOverStage((s) => (s === stage ? null : s))}
        onDrop={(e: any) => {
          e.preventDefault();
          setDragOverStage(null);
          const id = e.dataTransfer.getData("text/plain");
          if (!id) return;
          const dragged = (leads as any[]).find((x: any) => String(x.id) === String(id));
          if (dragged && dragged.status !== stage) {
            updateLeadStatus.mutate({ id, status: stage });
          }
        }}
      >
        {node}
      </div>
    );
  };

  // ── KPI-Kachel ──
  const KpiTile = ({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) => (
    <View
      className="bg-surface rounded-xl border border-border px-4 py-3.5"
      style={{ flex: 1, minWidth: isWide ? 170 : "47%" }}
    >
      <Text className="text-[11px] text-muted mb-1">{label}</Text>
      <Text className="text-xl font-bold" style={{ color }}>{value}</Text>
      <Text className="text-[11px] text-muted mt-0.5" numberOfLines={1}>{sub}</Text>
    </View>
  );

  const stageChipsMobile: LeadStatus[] = [...ACTIVE_STAGES, "won", "lost"];

  return (
    <ScreenContainer>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: contentPadding }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={containerStyle}>
          {/* ── Kopfzeile ── */}
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center gap-3 flex-1">
              <BackButton />
              <View>
                <Text className="text-2xl font-bold text-foreground">Akquise</Text>
                <Text className="text-xs text-muted">Ihr Vertriebs-Cockpit</Text>
              </View>
            </View>
            {isWide ? (
              <View className="flex-row items-center gap-2">
                <TouchableOpacity
                  className="flex-row items-center gap-1.5 bg-surface border border-border px-3.5 py-2 rounded-xl"
                  activeOpacity={0.8}
                  onPress={() => setShowImport(true)}
                >
                  <IconSymbol name="tray.fill" size={14} color={colors.muted} />
                  <Text className="text-sm font-semibold text-foreground">Import</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-row items-center gap-1.5 bg-surface border border-border px-3.5 py-2 rounded-xl"
                  activeOpacity={0.8}
                  onPress={() => setShowCallMode(true)}
                >
                  <IconSymbol name="phone.fill" size={14} color="#0EA5E9" />
                  <Text className="text-sm font-semibold text-foreground">Anruf-Modus</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-row items-center gap-1.5 bg-surface border border-border px-3.5 py-2 rounded-xl"
                  activeOpacity={0.8}
                  onPress={() => setShowCrossSell(true)}
                >
                  <IconSymbol name="sparkles" size={14} color="#8B5CF6" />
                  <Text className="text-sm font-semibold text-foreground">KI-Potenzial</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-row items-center gap-1.5 bg-primary px-4 py-2 rounded-xl"
                  activeOpacity={0.8}
                  onPress={() => setShowAddModal(true)}
                >
                  <IconSymbol name="plus" size={15} color={colors.background} />
                  <Text className="text-sm font-bold" style={{ color: colors.background }}>Neuer Lead</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="flex-row items-center gap-2">
                <TouchableOpacity
                  className="bg-surface border border-border w-10 h-10 rounded-full items-center justify-center"
                  activeOpacity={0.8}
                  onPress={() => setShowCallMode(true)}
                >
                  <IconSymbol name="phone.fill" size={17} color="#0EA5E9" />
                </TouchableOpacity>
                <TouchableOpacity
                  className="bg-surface border border-border w-10 h-10 rounded-full items-center justify-center"
                  activeOpacity={0.8}
                  onPress={() => setShowCrossSell(true)}
                >
                  <IconSymbol name="sparkles" size={17} color="#8B5CF6" />
                </TouchableOpacity>
                <TouchableOpacity
                  className="bg-primary w-10 h-10 rounded-full items-center justify-center"
                  activeOpacity={0.8}
                  onPress={() => setShowAddModal(true)}
                >
                  <IconSymbol name="plus" size={22} color={colors.background} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* ── KPI-Zeile ── */}
          <View className="flex-row flex-wrap gap-2.5 mb-4">
            <KpiTile
              label="Pipeline"
              value={fmtChf(pipelineValue)}
              sub={`${activeLeads.length} aktive Leads`}
              color="#C19A6B"
            />
            <KpiTile
              label="Gewichtete Prognose"
              value={fmtChf(weightedValue)}
              sub="nach Einstufung: Heiss 70% · Warm 40% · Kalt 15%"
              color="#4ADE80"
            />
            <KpiTile
              label="Abschlussquote"
              value={closedTotal > 0 ? `${winRate}%` : "–"}
              sub={`${wonLeads.length} gewonnen · ${lostLeads.length} verloren`}
              color={winRate >= 50 ? "#4ADE80" : "#FB923C"}
            />
            <KpiTile
              label="Heute dran"
              value={String(dueList.length)}
              sub="fällige Follow-ups & Aktionen"
              color={dueList.length > 0 ? "#FB923C" : "#4ADE80"}
            />
          </View>

          {/* ── Wochenziel: protokollierte Kontakte seit Montag ── */}
          <View className="bg-surface rounded-xl border border-border px-4 py-3 mb-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-[11px] text-muted">Wochenziel Kontakte (Anrufe, Mails, Aktivitäten)</Text>
              <Text className="text-xs font-bold" style={{ color: weeklyContacts >= weeklyGoal ? "#4ADE80" : colors.foreground }}>
                {weeklyContacts} / {weeklyGoal}
              </Text>
            </View>
            <View className="rounded-full mt-2" style={{ height: 7, backgroundColor: colors.border, overflow: "hidden" }}>
              <View
                className="rounded-full"
                style={{
                  height: 7,
                  width: `${Math.min(100, Math.round((weeklyContacts / Math.max(1, weeklyGoal)) * 100))}%`,
                  backgroundColor: weeklyContacts >= weeklyGoal ? "#22C55E" : colors.primary,
                }}
              />
            </View>
          </View>

          {/* ── Suche & Filter ── */}
          <View className="mb-3 bg-surface rounded-xl flex-row items-center px-3 py-2.5 border border-border gap-2">
            <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
            <TextInput
              className="flex-1 text-foreground text-sm"
              placeholder="Name, Firma oder E-Mail suchen..."
              placeholderTextColor={colors.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <IconSymbol name="xmark.circle.fill" size={16} color={colors.muted} />
              </TouchableOpacity>
            )}
          </View>

          <View className="flex-row flex-wrap items-center gap-2 mb-4">
            {[
              { key: "all", label: "Alle", color: colors.primary },
              { key: "high", label: "Hoch", color: "#EF4444" },
              { key: "medium", label: "Mittel", color: "#F59E0B" },
              { key: "low", label: "Tief", color: "#6B7280" },
            ].map((f) => {
              const active = priorityFilter === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  className="px-3 py-1.5 rounded-full border"
                  style={{
                    backgroundColor: active ? f.color : colors.surface,
                    borderColor: active ? f.color : colors.border,
                  }}
                  onPress={() => setPriorityFilter(f.key)}
                  activeOpacity={0.8}
                >
                  <Text className="text-xs font-semibold" style={{ color: active ? "#fff" : colors.foreground }}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <View style={{ width: 1, height: 18, backgroundColor: colors.border, marginHorizontal: 2 }} />
            <IconSymbol name="arrow.up.arrow.down" size={14} color={colors.muted} />
            {[
              { key: "date", label: "Neueste" },
              { key: "name", label: "A-Z" },
              { key: "value", label: "Wert" },
              { key: "priority", label: "Priorität" },
            ].map((s) => {
              const active = sortBy === s.key;
              return (
                <TouchableOpacity
                  key={s.key}
                  className="px-3 py-1.5 rounded-full border"
                  style={{
                    backgroundColor: active ? colors.primary + "15" : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  }}
                  onPress={() => setSortBy(s.key)}
                  activeOpacity={0.8}
                >
                  <Text className="text-xs font-semibold" style={{ color: active ? colors.primary : colors.foreground }}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {isLoading ? (
            <View className="flex-1 items-center justify-center py-12">
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <>
              {/* ── Heute dran ── */}
              {dueList.length > 0 && (
                <View className="bg-surface rounded-xl border border-border mb-4 overflow-hidden">
                  <View className="flex-row items-center justify-between px-4 py-3" style={{ borderBottomWidth: 1, borderBottomColor: colors.border + "80" }}>
                    <View className="flex-row items-center gap-2">
                      <IconSymbol name="flame.fill" size={15} color="#FB923C" />
                      <Text className="text-sm font-bold text-foreground">Heute dran</Text>
                    </View>
                    <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: "#FB923C20" }}>
                      <Text className="text-xs font-bold" style={{ color: "#FB923C" }}>{dueList.length}</Text>
                    </View>
                  </View>
                  {(dueList as any[]).slice(0, 8).map((d: any, idx: number) => (
                    <TouchableOpacity
                      key={d.lead.id}
                      className="flex-row items-center px-4 py-2.5"
                      style={{ borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: colors.border + "50" }}
                      onPress={() => setSelectedLead(d.lead)}
                      activeOpacity={0.7}
                    >
                      <View className="flex-1 mr-2">
                        <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                          {d.lead.company || d.lead.name}
                        </Text>
                        <Text className="text-xs text-muted" numberOfLines={1}>{d.text}</Text>
                      </View>
                      <Text className="text-xs font-bold mr-2" style={{ color: d.overdue ? "#EF4444" : "#FB923C" }}>
                        {d.overdue ? "überfällig" : d.when.toLocaleDateString("de-CH")}
                      </Text>
                      {(d.lead.phone || d.lead.mobile) ? (
                        <TouchableOpacity
                          className="w-8 h-8 rounded-lg items-center justify-center"
                          style={{ backgroundColor: "#0EA5E918" }}
                          onPress={() => Linking.openURL(`tel:${(d.lead.phone || d.lead.mobile).replace(/\s/g, "")}`)}
                          activeOpacity={0.7}
                        >
                          <IconSymbol name="phone.fill" size={13} color="#0EA5E9" />
                        </TouchableOpacity>
                      ) : null}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* ── Posteingang: neue Website-Anfragen ── */}
              {websiteInbox.length > 0 && (
                <View className="bg-surface rounded-xl border border-border mb-4 overflow-hidden">
                  <View className="flex-row items-center justify-between px-4 py-3" style={{ borderBottomWidth: 1, borderBottomColor: colors.border + "80" }}>
                    <View className="flex-row items-center gap-2">
                      <IconSymbol name="globe" size={15} color={colors.primary} />
                      <Text className="text-sm font-bold text-foreground">Website-Anfragen</Text>
                    </View>
                    <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: colors.primary + "20" }}>
                      <Text className="text-xs font-bold" style={{ color: colors.primary }}>{websiteInbox.length}</Text>
                    </View>
                  </View>
                  {websiteInbox.slice(0, 6).map((lead: any, idx: number) => (
                    <TouchableOpacity
                      key={lead.id}
                      className="flex-row items-center px-4 py-2.5"
                      style={{ borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: colors.border + "50" }}
                      activeOpacity={0.7}
                      onPress={() => setSelectedLead(lead)}
                    >
                      <View className="flex-1 mr-2">
                        <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>{lead.company || lead.name || "–"}</Text>
                        {lead.company && lead.name ? <Text className="text-xs text-muted" numberOfLines={1}>{lead.name}</Text> : null}
                      </View>
                      <Text className="text-xs font-semibold mr-2" style={{ color: "#4ADE80" }}>
                        {fmtChf(lead.value || 0)}
                      </Text>
                      <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: getPriorityColor(lead.priority) + "20" }}>
                        <Text className="text-[10px] font-semibold" style={{ color: getPriorityColor(lead.priority) }}>
                          {getPriorityLabel(lead.priority)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* ── Pipeline ── */}
              {isWide ? (
                /* Desktop: Kanban-Board */
                <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
                  {ACTIVE_STAGES.map((stage) => {
                    const list = byStage(stage);
                    return asDropTarget(stage, (
                      <View
                        className="rounded-2xl"
                        style={{
                          flex: 1,
                          padding: 6,
                          borderWidth: 1.5,
                          borderStyle: "dashed",
                          borderColor: dragOverStage === stage ? getStatusColor(stage) : "transparent",
                        }}
                      >
                        <View className="flex-row items-center justify-between mb-0.5">
                          <View className="flex-row items-center gap-2">
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: getStatusColor(stage) }} />
                            <Text className="text-sm font-bold text-foreground">{getStatusLabel(stage)}</Text>
                          </View>
                          <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: getStatusColor(stage) + "20" }}>
                            <Text className="text-xs font-bold" style={{ color: getStatusColor(stage) }}>{list.length}</Text>
                          </View>
                        </View>
                        <Text className="text-[11px] text-muted mb-2.5 ml-4">{fmtChf(stageSum(stage))}</Text>
                        {list.length > 0 ? (
                          <View className="gap-2">{list.map(renderLeadCard)}</View>
                        ) : (
                          <View className="rounded-xl border border-dashed items-center py-6" style={{ borderColor: colors.border }}>
                            <Text className="text-xs text-muted">Keine Leads — hierher ziehen</Text>
                          </View>
                        )}
                      </View>
                    ), { flex: 1 });
                  })}
                </View>
              ) : (
                /* Mobil: Phasen-Chips + Liste */
                <View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} className="mb-3">
                    {stageChipsMobile.map((stage) => {
                      const count = filteredLeads.filter((l: any) => l.status === stage).length;
                      const active = mobileStage === stage;
                      return (
                        <TouchableOpacity
                          key={stage}
                          className="flex-row items-center gap-1.5 px-3.5 py-2 rounded-full border"
                          style={{
                            backgroundColor: active ? getStatusColor(stage) + "20" : colors.surface,
                            borderColor: active ? getStatusColor(stage) : colors.border,
                          }}
                          onPress={() => setMobileStage(stage)}
                          activeOpacity={0.8}
                        >
                          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: getStatusColor(stage) }} />
                          <Text className="text-xs font-bold" style={{ color: active ? getStatusColor(stage) : colors.foreground }}>
                            {getStatusLabel(stage)} ({count})
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                  <View className="gap-2">
                    {byStage(mobileStage).length > 0 ? (
                      byStage(mobileStage).map(renderLeadCard)
                    ) : (
                      <View className="rounded-xl border border-dashed items-center py-8" style={{ borderColor: colors.border }}>
                        <Text className="text-sm text-muted">Keine Leads in «{getStatusLabel(mobileStage)}»</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* ── Gewonnen / Verloren (Desktop: auch Drop-Ziele) ── */}
              {isWide && (
                <View className="flex-row gap-3 mt-4">
                  {asDropTarget("won", (
                    <View
                      className="bg-surface rounded-xl p-4"
                      style={{ flex: 1, borderWidth: 1.5, borderColor: dragOverStage === "won" ? "#22C55E" : colors.border }}
                    >
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-2">
                          <IconSymbol name="checkmark.circle.fill" size={16} color="#22C55E" />
                          <Text className="text-sm font-bold text-foreground">Gewonnen</Text>
                        </View>
                        <Text className="text-sm font-bold" style={{ color: "#22C55E" }}>{fmtChf(wonValue)}</Text>
                      </View>
                      <View className="gap-1.5 mt-3">
                        {wonLeads.length === 0 ? (
                          <Text className="text-[11px] text-muted">Lead hierher ziehen, um ihn als gewonnen zu markieren</Text>
                        ) : null}
                        {sortLeads(wonLeads).slice(0, 5).map((lead: any) => (
                          <TouchableOpacity key={lead.id} className="flex-row items-center justify-between" onPress={() => setSelectedLead(lead)} activeOpacity={0.7}>
                            <Text className="text-xs text-foreground flex-1 mr-2" numberOfLines={1}>{lead.company || lead.name}</Text>
                            <Text className="text-xs font-semibold" style={{ color: "#22C55E" }}>{fmtChf(lead.value || 0)}</Text>
                          </TouchableOpacity>
                        ))}
                        {wonLeads.length > 5 ? <Text className="text-[11px] text-muted">+{wonLeads.length - 5} weitere</Text> : null}
                      </View>
                    </View>
                  ), { flex: 1 })}
                  {asDropTarget("lost", (
                    <View
                      className="bg-surface rounded-xl p-4"
                      style={{ flex: 1, borderWidth: 1.5, borderColor: dragOverStage === "lost" ? "#EF4444" : colors.border }}
                    >
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-2">
                          <IconSymbol name="xmark.circle.fill" size={16} color="#EF4444" />
                          <Text className="text-sm font-bold text-foreground">Verloren</Text>
                        </View>
                        <Text className="text-sm font-bold" style={{ color: "#EF4444" }}>{fmtChf(lostValue)}</Text>
                      </View>
                      <View className="gap-1.5 mt-3" style={{ opacity: 0.75 }}>
                        {lostLeads.length === 0 ? (
                          <Text className="text-[11px] text-muted">Lead hierher ziehen, um ihn als verloren zu markieren</Text>
                        ) : null}
                        {sortLeads(lostLeads).slice(0, 5).map((lead: any) => (
                          <TouchableOpacity key={lead.id} className="flex-row items-center justify-between" onPress={() => setSelectedLead(lead)} activeOpacity={0.7}>
                            <Text className="text-xs text-foreground flex-1 mr-2" numberOfLines={1}>
                              {lead.company || lead.name}
                              {lead.lost_reason ? `  ·  ${lostReasonLabel(lead.lost_reason)}` : ""}
                            </Text>
                            <Text className="text-xs font-semibold text-muted">{fmtChf(lead.value || 0)}</Text>
                          </TouchableOpacity>
                        ))}
                        {lostLeads.length > 5 ? <Text className="text-[11px] text-muted">+{lostLeads.length - 5} weitere</Text> : null}
                      </View>
                    </View>
                  ), { flex: 1 })}
                </View>
              )}

              {/* ── Auswertung ── */}
              {filteredLeads.length > 0 && (() => {
                const pipelineData = ACTIVE_STAGES.map((stage) => ({
                  label: getStatusLabel(stage),
                  count: filteredLeads.filter((l: any) => l.status === stage).length,
                  color: getStatusColor(stage),
                }));
                const pipelineTotal = pipelineData.reduce((s, d) => s + d.count, 0);
                const resultData = [
                  { label: "Gewonnen", count: wonLeads.length, color: "#22C55E", value: wonValue },
                  { label: "Verloren", count: lostLeads.length, color: "#EF4444", value: lostValue },
                ];

                // Konversions-Trichter: wie viele Leads haben jede Phase erreicht?
                const funnelStages: LeadStatus[] = ["new", "contacted", "qualified", "proposal", "won"];
                const funnelBase = filteredLeads.length;
                const funnel = funnelStages.map((st, i) => ({
                  stage: st,
                  count: filteredLeads.filter((l: any) =>
                    l.status !== "lost" && STAGE_ORDER.indexOf(l.status) >= i
                  ).length + (i === 0 ? lostLeads.length : 0),
                }));

                // Verlustgründe zusammenzählen
                const lostReasonCounts = new Map<string, number>();
                for (const l of lostLeads as any[]) {
                  const key = l.lost_reason || "";
                  if (!key) continue;
                  lostReasonCounts.set(key, (lostReasonCounts.get(key) || 0) + 1);
                }

                const renderDonut = (data: { label: string; count: number; color: string }[], total: number) => {
                  const size = 120;
                  const strokeWidth = 14;
                  const radius = (size - strokeWidth) / 2;
                  const circumference = 2 * Math.PI * radius;
                  let accumulated = 0;
                  return (
                    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                      <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.border} strokeWidth={strokeWidth} fill="none" />
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
                  <View style={isWide ? { flexDirection: "row", gap: 16, marginTop: 16 } : { gap: 16, marginTop: 16 }}>
                    <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
                      <Text className="text-sm font-semibold text-foreground mb-3">Pipeline-Verteilung</Text>
                      <View className="flex-row items-center gap-4">
                        <View style={{ position: "relative", width: 120, height: 120 }}>
                          {renderDonut(pipelineData, pipelineTotal)}
                          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center" }}>
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

                    <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
                      <Text className="text-sm font-semibold text-foreground mb-3">Abschlussquote</Text>
                      <View className="flex-row items-center gap-4">
                        <View style={{ position: "relative", width: 120, height: 120 }}>
                          {renderDonut(resultData, closedTotal)}
                          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center" }}>
                            <Text className="text-xl font-bold" style={{ color: winRate >= 50 ? "#22C55E" : "#EF4444" }}>{winRate}%</Text>
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
                                CHF {(d as any).value.toLocaleString("de-CH")}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                      {lostReasonCounts.size > 0 && (
                        <View className="mt-3 pt-3" style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
                          <Text className="text-[10px] font-bold text-muted uppercase mb-1.5">Verlustgründe</Text>
                          {[...lostReasonCounts.entries()].sort((a, b) => b[1] - a[1]).map(([reason, count]) => (
                            <View key={reason} className="flex-row items-center justify-between py-0.5">
                              <Text className="text-xs text-foreground">{lostReasonLabel(reason)}</Text>
                              <Text className="text-xs font-semibold text-muted">{count}×</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>

                    {/* Konversions-Trichter */}
                    <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
                      <Text className="text-sm font-semibold text-foreground mb-3">Konversions-Trichter</Text>
                      <View className="gap-2.5">
                        {funnel.map((f) => {
                          const pct = funnelBase > 0 ? Math.round((f.count / funnelBase) * 100) : 0;
                          return (
                            <View key={f.stage}>
                              <View className="flex-row items-center justify-between mb-1">
                                <Text className="text-xs text-muted">{getStatusLabel(f.stage)}</Text>
                                <Text className="text-xs font-semibold text-foreground">{f.count} · {pct}%</Text>
                              </View>
                              <View className="rounded-full" style={{ height: 7, backgroundColor: colors.border, overflow: "hidden" }}>
                                <View
                                  className="rounded-full"
                                  style={{ height: 7, width: `${Math.max(pct, f.count > 0 ? 4 : 0)}%`, backgroundColor: getStatusColor(f.stage) }}
                                />
                              </View>
                            </View>
                          );
                        })}
                      </View>
                      <Text className="text-[10px] text-muted mt-2.5">
                        Anteil aller Leads, die die jeweilige Phase erreicht haben
                      </Text>
                    </View>
                  </View>
                );
              })()}
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
      queryClient.invalidateQueries({ queryKey: ["leadDetail"] });
        }}
      />

      {/* Anruf-Modus (Kalt-Akquise) */}
      <CallModeModal visible={showCallMode} onClose={() => setShowCallMode(false)} colors={colors} />

      {/* Cross-Selling-Analyse */}
      <CrossSellModal visible={showCrossSell} onClose={() => setShowCrossSell(false)} colors={colors} />

      {/* CSV-Import (Kaltakquise-Listen) */}
      <ImportLeadsModal
        visible={showImport}
        onClose={() => setShowImport(false)}
        colors={colors}
        existingLeads={leads as any[]}
        onDone={() => queryClient.invalidateQueries({ queryKey: ["leads"] })}
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
      queryClient.invalidateQueries({ queryKey: ["leadDetail"] });
          }}
          onEdit={() => {
            setEditingLead(selectedLead);
            setShowAddModal(true);
            setSelectedLead(null);
          }}
          onConvert={() => {
            setConvertingLead(selectedLead);
            setSelectedLead(null);
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

  const [shouldCreateQuote, setShouldCreateQuote] = useState(false);
  const { data: leadItems = [] } = useQuery({
    queryKey: ["lead_items", lead.id],
    queryFn: () => Data.getLeadItems(lead.id),
  });

  const hasPotential = leadItems.length > 0 || lead.extra_amount > 0;

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
    onSuccess: async (newCustomer) => {
      const targetStatus = shouldCreateQuote ? "proposal" : "won";
      const targetStatusLabel = shouldCreateQuote ? "'Angebot'" : "'Gewonnen'";

      // Lead-Status aktualisieren
      await Data.updateLead(lead.id, { status: targetStatus });
      await Data.addLeadActivity({
        lead_id: lead.id,
        type: "system",
        content: `Lead als Kunde erfasst und Status auf ${targetStatusLabel} gesetzt`,
        user_name: "System",
      });

      if (shouldCreateQuote && hasPotential && newCustomer?.id) {
        try {
          const quoteNumber = await Data.getNextQuoteNumber();
          let subtotal = 0;
          let tax = 0;
          const quoteItems = leadItems.map((item: any) => {
            const lineSub = (item.quantity || 1) * (item.unit_price || 0);
            const vat = item.vat_rate ?? 8.1;
            subtotal += lineSub;
            tax += lineSub * (vat / 100);
            return {
              description: item.description,
              quantity: item.quantity || 1,
              unit_price: item.unit_price || 0,
              vat_rate: vat,
              total: lineSub,
              product_id: item.product_id,
            };
          });
          if (lead.extra_amount) {
            const eSub = lead.extra_amount;
            subtotal += eSub;
            tax += eSub * 0.081;
            quoteItems.push({
              description: lead.extra_description || "Sonstiges",
              quantity: 1,
              unit_price: eSub,
              vat_rate: 8.1,
              product_id: null,
              total: eSub,
            });
          }
          const total = subtotal + tax;

          const validUntil = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

          await Data.createQuote({
            customer_id: newCustomer.id,
            quote_number: quoteNumber,
            status: "draft",
            valid_until: validUntil,
            subtotal,
            tax,
            total,
          }, quoteItems);
          
          await Data.addLeadActivity({
            lead_id: lead.id,
            type: "system",
            content: `Angebot ${quoteNumber} aus Potenzial erstellt`,
            user_name: "System",
          });
        } catch (e: any) {
          console.error("Fehler beim Erstellen des Angebots:", e);
          showAlert("Fehler", "Kunde wurde erstellt, aber das Angebot konnte nicht generiert werden.");
        }
      }

      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leadDetail"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      if (shouldCreateQuote) {
        queryClient.invalidateQueries({ queryKey: ["quotes"] });
      }
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

          {hasPotential && (
            <TouchableOpacity
              className="flex-row items-center bg-surface border border-border p-3 rounded-lg mb-6"
              onPress={() => setShouldCreateQuote(!shouldCreateQuote)}
              activeOpacity={0.7}
            >
              <View className={`w-5 h-5 rounded border items-center justify-center mr-3 ${shouldCreateQuote ? "bg-primary border-primary" : "border-muted"}`}>
                {shouldCreateQuote && <IconSymbol name="checkmark" size={14} color="#FFF" />}
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground">Angebot erstellen</Text>
                <Text className="text-xs text-muted">Aus den Potenzial-Produkten automatisch ein Angebot generieren</Text>
              </View>
            </TouchableOpacity>
          )}

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


function LeadDetailsModal({
  lead: leadProp,
  onClose,
  onEdit,
  onConvert,
}: {
  lead: any;
  onClose: () => void;
  onEdit?: () => void;
  onConvert?: () => void;
}) {
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Immer den frischen Stand aus der Datenbank anzeigen — Änderungen
  // (Notizen aus Website-Check, Verlustgrund, Priorität, ...) erscheinen
  // so sofort, ohne das Fenster neu öffnen zu müssen.
  const { data: freshLead } = useQuery({
    queryKey: ["leadDetail", leadProp.id],
    queryFn: () => Data.getLeadById(leadProp.id),
    initialData: leadProp,
  });
  const lead = freshLead || leadProp;
  const [newActivity, setNewActivity] = useState("");
  const [currentUserName, setCurrentUserName] = useState("Admin");
  const [currentStatus, setCurrentStatus] = useState(lead.status);
  const [linkedQuoteId, setLinkedQuoteId] = useState<string | null>(lead.quote_id || null);
  const [showQuotePicker, setShowQuotePicker] = useState(false);
  const [showAddReminder, setShowAddReminder] = useState(false);
  const [reminderNote, setReminderNote] = useState("");
  const [reminderDateTime, setReminderDateTime] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return d;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [editingReminder, setEditingReminder] = useState<any>(null);

  const [isAdmin, setIsAdmin] = useState(false);

  // Website-Check: bestehende Analyse-Funktion erneut auf den Lead anwenden
  const [webCheckLoading, setWebCheckLoading] = useState(false);
  const [webCheck, setWebCheck] = useState<any | null>(null);

  // Verlustgrund-Abfrage beim Setzen auf "Verloren"
  const [showLostPicker, setShowLostPicker] = useState(false);

  // Erstkontakt (KI): E-Mail-Entwurf oder Telefon-Einstieg
  const [aiMode, setAiMode] = useState<"email" | "call">(lead.email ? "email" : "call");
  const [aiDraft, setAiDraft] = useState<{ subject: string; body: string; script?: any } | null>(null);

  // Gespeicherten Telefon-Einstieg beim Öffnen wiederherstellen
  const callScriptLoaded = useRef(false);
  useEffect(() => {
    if (callScriptLoaded.current || aiDraft) return;
    if ((lead as any).call_script) {
      callScriptLoaded.current = true;
      setAiMode("call");
      setAiDraft({ subject: "", body: "", script: (lead as any).call_script });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(lead as any).call_script]);

  // Änderungen am Telefon-Einstieg automatisch am Lead speichern
  useEffect(() => {
    if (aiMode !== "call" || !aiDraft?.script) return;
    const t = setTimeout(() => {
      Data.saveLeadCallScript(lead.id, aiDraft.script);
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiDraft, aiMode]);

  // Telefon-Leitfaden aus den strukturierten Abschnitten zu Text zusammensetzen
  const composeCallScript = (script: any) =>
    [
      script.greeting,
      script.pitch,
      script.question,
      (script.objections || []).length
        ? "Einwände:\n" + script.objections.map((o: any) => `• «${o.say}» → ${o.answer}`).join("\n")
        : "",
    ].filter(Boolean).join("\n\n");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSending, setAiSending] = useState(false);

  // Termin planen (Outlook-Einladung / ICS)
  const [showPlanMeeting, setShowPlanMeeting] = useState(false);
  const [mtTitle, setMtTitle] = useState("");
  const [mtDate, setMtDate] = useState("");
  const [mtTime, setMtTime] = useState("09:00");
  const [mtDuration, setMtDuration] = useState(60);
  const [mtAttendee, setMtAttendee] = useState<{ email: string; name: string } | null>(null);
  const [mtNote, setMtNote] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [creatingQuote, setCreatingQuote] = useState(false);

  const { data: employees = [] } = useQuery({
    queryKey: ["allEmployees"],
    queryFn: Data.getAllEmployees,
  });

  // Empfohlen von (Quelle Empfehlung)
  const { data: referrer } = useQuery({
    queryKey: ["referrerCustomer", lead.referrer_customer_id],
    queryFn: () => Data.getCustomerById(lead.referrer_customer_id),
    enabled: !!lead.referrer_customer_id,
  });

  const parseMeetingStart = (): Date | null => {
    const dParts = mtDate.trim().split(".");
    const tParts = mtTime.trim().split(":");
    if (dParts.length !== 3 || tParts.length < 2) return null;
    const d = new Date(
      parseInt(dParts[2], 10), parseInt(dParts[1], 10) - 1, parseInt(dParts[0], 10),
      parseInt(tParts[0], 10), parseInt(tParts[1], 10), 0, 0
    );
    return isNaN(d.getTime()) ? null : d;
  };

  const buildIcs = (start: Date) => {
    const end = new Date(start.getTime() + mtDuration * 60000);
    const fmt = (x: Date) => x.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const esc = (s: string) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
    return [
      "BEGIN:VCALENDAR", "PRODID:-//Gross ICT//CRM//DE", "VERSION:2.0", "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${Date.now()}@gross-ict.ch`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:${esc(mtTitle || `Termin: ${lead.company || lead.name}`)}`,
      mtNote ? `DESCRIPTION:${esc(mtNote)}` : "",
      "END:VEVENT", "END:VCALENDAR",
    ].filter(Boolean).join("\r\n");
  };

  const handleSendInvite = async () => {
    const start = parseMeetingStart();
    if (!start) { showAlert("Fehler", "Bitte Datum (TT.MM.JJJJ) und Zeit (HH:MM) prüfen."); return; }
    if (!mtAttendee) { showAlert("Fehler", "Bitte Mitarbeitenden auswählen."); return; }
    setSendingInvite(true);
    try {
      const { data, error } = await Data.supabase.functions.invoke("send-calendar-invite", {
        body: {
          title: mtTitle || `Termin: ${lead.company || lead.name}`,
          description: `${mtNote ? mtNote + "\n\n" : ""}Lead: ${lead.company || lead.name}${lead.phone ? `\nTelefon: ${lead.phone}` : ""}${lead.email ? `\nE-Mail: ${lead.email}` : ""}`,
          location: [lead.address, [lead.zip, lead.city].filter(Boolean).join(" ")].filter(Boolean).join(", "),
          start: start.toISOString(),
          durationMinutes: mtDuration,
          attendeeEmail: mtAttendee.email,
          attendeeName: mtAttendee.name,
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Versand fehlgeschlagen");
      await Data.addLeadActivity({
        lead_id: lead.id,
        type: "system",
        content: `Termineinladung an ${mtAttendee.name || mtAttendee.email} gesendet: ${mtDate} ${mtTime} Uhr`,
        user_name: currentUserName,
      });
      refetchActivities();
      setShowPlanMeeting(false);
      showAlert("Gesendet", `Die Kalendereinladung wurde an ${mtAttendee.email} geschickt — in Outlook einfach annehmen.`);
    } catch (e: any) {
      showAlert("Fehler", e.message);
    } finally {
      setSendingInvite(false);
    }
  };

  const handleDownloadIcs = () => {
    const start = parseMeetingStart();
    if (!start) { showAlert("Fehler", "Bitte Datum (TT.MM.JJJJ) und Zeit (HH:MM) prüfen."); return; }
    if (Platform.OS !== "web") return;
    const blob = new Blob([buildIcs(start)], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "termin.ics";
    a.click();
  };

  const handleGenerateOutreach = async () => {
    setAiLoading(true);
    try {
      const { data, error } = await Data.supabase.functions.invoke("lead-outreach", {
        body: { action: "generate", leadId: lead.id, mode: aiMode },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Generierung fehlgeschlagen");
      setAiDraft({ subject: data.subject || "", body: data.body || "", script: data.script || null });
    } catch (e: any) {
      showAlert("Fehler", e.message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSendOutreach = async () => {
    if (!aiDraft?.subject.trim() || !aiDraft?.body.trim()) {
      showAlert("Fehler", "Betreff und Text dürfen nicht leer sein.");
      return;
    }
    showConfirm(
      "Erstkontakt-Mail senden",
      `Die E-Mail wird an ${lead.email} gesendet.`,
      async () => {
        setAiSending(true);
        try {
          const { data, error } = await Data.supabase.functions.invoke("lead-outreach", {
            body: { action: "send", leadId: lead.id, subject: aiDraft.subject, body: aiDraft.body },
          });
          if (error || data?.error) throw new Error(data?.error || error?.message || "Versand fehlgeschlagen");
          setAiDraft(null);
          refetchActivities();
          showAlert("Gesendet", "Die Erstkontakt-Mail wurde versendet und protokolliert.");
        } catch (e: any) {
          showAlert("Fehler", e.message);
        } finally {
          setAiSending(false);
        }
      },
      "Senden"
    );
  };

  // Telefon-Einstieg in den Notizen festhalten
  const handleSaveCallScript = async () => {
    if (!aiDraft) return;
    const text = (aiDraft.script ? composeCallScript(aiDraft.script) : aiDraft.body).trim();
    if (!text) return;
    try {
      const stamp = new Date().toLocaleDateString("de-CH");
      await Data.updateLead(lead.id, {
        notes: `${lead.notes ? lead.notes + "\n\n" : ""}[${stamp}] Telefon-Einstieg (KI):\n${text}`,
      });
      await Data.addLeadActivity({
        lead_id: lead.id,
        type: "system",
        content: "Telefon-Einstieg (KI) generiert und in Notizen gespeichert",
        user_name: currentUserName,
      });
      refetchActivities();
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leadDetail"] });
      setAiDraft(null);
      showAlert("Gespeichert", "Der Gesprächseinstieg steht jetzt in den Notizen des Leads — auch im Anruf-Modus sichtbar.");
    } catch (e: any) {
      showAlert("Fehler", e.message);
    }
  };

  const handleCreateQuoteFromLead = () => {
    showConfirm(
      "Angebot aus Lead erstellen",
      "Aus den Potenzial-Positionen wird ein Angebotsentwurf erstellt. Der Kunde wird als Interessent (inaktiv) angelegt und erst bei Angebotsannahme automatisch aktiviert.",
      async () => {
        setCreatingQuote(true);
        try {
          const quote = await Data.createQuoteFromLead(lead);
          queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leadDetail"] });
          queryClient.invalidateQueries({ queryKey: ["quotes"] });
          queryClient.invalidateQueries({ queryKey: ["customers"] });
          onClose();
          router.push(`/quote/${quote.id}` as any);
        } catch (e: any) {
          showAlert("Fehler", e.message);
        } finally {
          setCreatingQuote(false);
        }
      },
      "Erstellen"
    );
  };

  const handleSetLost = async (reasonKey: string) => {
    try {
      try {
        await Data.updateLead(lead.id, { status: "lost", lost_reason: reasonKey });
      } catch (_e) {
        // Migration 20261015 fehlt noch → nur Status setzen
        await Data.updateLead(lead.id, { status: "lost" });
      }
      setCurrentStatus("lost");
      setShowLostPicker(false);
      await Data.addLeadActivity({
        lead_id: lead.id,
        type: "system",
        content: `Status geändert zu: Verloren (${lostReasonLabel(reasonKey)})`,
        user_name: "System",
      });
      refetchActivities();
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leadDetail"] });
    } catch (e: any) {
      showAlert("Fehler", e.message);
    }
  };

  const runWebCheck = async () => {
    if (!lead.website) return;
    setWebCheckLoading(true);
    try {
      const { data, error } = await Data.supabase.functions.invoke("analyze-website", {
        body: { url: lead.website },
      });
      if (error) throw new Error(error.message || "Analyse fehlgeschlagen");
      setWebCheck(data);
      // Ergebnis am Lead speichern (für automatischen Recheck & Scoring)
      Data.saveLeadWebCheck(lead.id, data);
    } catch (e: any) {
      showAlert("Fehler", "Die Website konnte nicht analysiert werden: " + e.message);
    } finally {
      setWebCheckLoading(false);
    }
  };

  const applyWebCheck = async () => {
    if (!webCheck) return;
    try {
      const stamp = new Date().toLocaleDateString("de-CH");
      const summary = [
        `[${stamp}] Website neu analysiert:`,
        `SSL ${webCheck.sslValid ? "✓" : "✗"} · Impressum ${webCheck.hasImpressum ? "✓" : "✗"} · Datenschutz ${webCheck.hasPrivacy ? "✓" : "✗"} · Mobil ${webCheck.isResponsive ? "✓" : "✗"}${webCheck.wcagOk !== undefined ? ` · WCAG ${webCheck.wcagOk ? "✓" : "✗"}` : ""}`,
        webCheck.notes || "",
      ].filter(Boolean).join("\n");
      await Data.updateLead(lead.id, {
        notes: `${lead.notes ? lead.notes + "\n\n" : ""}${summary}`,
        ...(webCheck.priority ? { priority: webCheck.priority } : {}),
      });
      await Data.addLeadActivity({
        lead_id: lead.id,
        type: "system",
        content: "Website neu analysiert – Ergebnis in Notizen übernommen",
        user_name: currentUserName,
      });
      refetchActivities();
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leadDetail"] });
      setWebCheck(null);
      showAlert("Übernommen", "Die Analyse wurde in den Notizen gespeichert.");
    } catch (e: any) {
      showAlert("Fehler", e.message);
    }
  };

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

        Data.getUserProfile(session.user.id).then((profile: any) => {
          if (profile?.roles?.includes("admin")) {
            setIsAdmin(true);
          }
        }).catch(console.error);
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
      // Empfehlungs-Tracking: bei Gewinn ans Dankeschön erinnern
      if (status === "won" && lead.referrer_customer_id) {
        try {
          const ref: any = await Data.getCustomerById(lead.referrer_customer_id);
          const refName = ref?.company_name || `${ref?.first_name || ""} ${ref?.last_name || ""}`.trim() || "Empfehler";
          const { data: { session } } = await Data.supabase.auth.getSession();
          await Data.createTask({
            title: `Danke an ${refName} für die Empfehlung (${lead.company || lead.name})`,
            status: "open",
            due_date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
            assigned_to: session?.user?.id || null,
          });
          showAlert("Lead gewonnen 🎉", `Aufgabe erstellt: Danke an ${refName} für die Empfehlung.`);
        } catch (_) { /* Danke-Aufgabe ist Komfort, kein Muss */ }
      }
      refetchActivities();
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leadDetail"] });
    },
  });

  const { data: leadReminders = [], isLoading: remindersLoading, refetch: refetchReminders } = useQuery({
    queryKey: ["lead_reminders", lead.id],
    queryFn: () => Data.getLeadReminders(lead.id),
  });



  const addReminder = useMutation({
    mutationFn: (data: { remind_at: string; note: string }) => Data.createLeadReminder({
      lead_id: lead.id,
      ...data,
    }),
    onSuccess: async (newReminder) => {
      const formatted = reminderDateTime.toLocaleString("de-CH", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      // Lokale iOS-Benachrichtigung planen
      const leadName = lead.company || lead.name || 'Lead';
      await scheduleReminderNotification(String(newReminder.id), leadName, reminderNote.trim(), reminderDateTime);
      await Data.addLeadActivity({
        lead_id: lead.id,
        type: "system",
        content: `Erinnerung hinzugefügt für ${formatted}`,
        user_name: currentUserName,
      });
      refetchReminders();
      refetchActivities();
      setShowAddReminder(false);
      setReminderNote("");
    },
    onError: (e: any) => {
      showAlert("Fehler", "Erinnerung konnte nicht erstellt werden: " + e.message);
    }
  });

  const deleteReminder = useMutation({
    mutationFn: (id: string) => Data.deleteLeadReminder(id),
    onSuccess: (_, id) => {
      // Geplante lokale Benachrichtigung stornieren
      cancelReminderNotification(id);
      refetchReminders();
    },
  });

  const updateReminder = useMutation({
    mutationFn: (data: { id: string; remind_at: string; note: string }) =>
      Data.updateLeadReminder(data.id, { remind_at: data.remind_at, note: data.note }),
    onSuccess: async (_, variables) => {
      const formatted = reminderDateTime.toLocaleString("de-CH", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      // Alte Benachrichtigung ersetzen
      const leadName = lead.company || lead.name || 'Lead';
      await scheduleReminderNotification(variables.id, leadName, variables.note, reminderDateTime);
      await Data.addLeadActivity({
        lead_id: lead.id,
        type: "system",
        content: `Erinnerung aktualisiert für ${formatted}`,
        user_name: currentUserName,
      });
      refetchReminders();
      refetchActivities();
      setShowAddReminder(false);
      setReminderNote("");
      setEditingReminder(null);
    },
    onError: (e: any) => {
      showAlert("Fehler", "Erinnerung konnte nicht aktualisiert werden: " + e.message);
    }
  });

  const handleCreateReminder = () => {
    if (!reminderNote.trim()) {
      showAlert("Fehler", "Bitte eine Notiz eingeben.");
      return;
    }
    if (editingReminder) {
      updateReminder.mutate({
        id: editingReminder.id,
        remind_at: reminderDateTime.toISOString(),
        note: reminderNote.trim(),
      });
    } else {
      addReminder.mutate({
        remind_at: reminderDateTime.toISOString(),
        note: reminderNote.trim(),
      });
    }
  };

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
            <View className="flex-1 mr-2">
              <Text className="text-xl font-bold text-foreground" numberOfLines={1}>
                {lead.company || lead.name || "Lead"}
              </Text>
              <View className="flex-row items-center gap-2 mt-0.5">
                <View className="px-2 py-0.5 rounded" style={{ backgroundColor: getStatusColor(currentStatus) + "20" }}>
                  <Text className="text-[10px] font-bold" style={{ color: getStatusColor(currentStatus) }}>
                    {getStatusLabel(currentStatus).toUpperCase()}
                  </Text>
                </View>
                <Text className="text-xs font-semibold" style={{ color: "#4ADE80" }}>
                  CHF {(lead.value || 0).toLocaleString("de-CH")}
                </Text>
              </View>
            </View>
            <View className="flex-row items-center justify-end gap-4">
              {onEdit && (
                <TouchableOpacity
                  className="bg-surface border border-border px-3 py-1.5 rounded-lg flex-row items-center gap-1.5"
                  onPress={onEdit}
                  activeOpacity={0.7}
                >
                  <IconSymbol name="pencil" size={16} color={colors.foreground} />
                  <Text className="text-sm font-semibold text-foreground">Bearbeiten</Text>
                </TouchableOpacity>
              )}
              {onConvert && lead.status !== "won" && (
                <TouchableOpacity 
                  className="bg-primary/10 px-3 py-1.5 rounded-lg flex-row items-center gap-1.5"
                  onPress={onConvert}
                  activeOpacity={0.7}
                >
                  <IconSymbol name="person.crop.circle.badge.plus" size={16} color={colors.primary} />
                  <Text className="text-sm font-semibold text-primary">Kunde erstellen</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
                <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
              </TouchableOpacity>
            </View>
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

              {lead.website && (
                <View>
                  <Text className="text-sm text-muted mb-1">Website</Text>
                  <View className="flex-row items-center justify-between gap-2">
                    <TouchableOpacity
                      className="flex-1"
                      onPress={() => {
                        const url = lead.website.startsWith('http') ? lead.website : `https://${lead.website}`;
                        Linking.openURL(url);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text className="text-base text-primary" numberOfLines={1}>{lead.website}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg"
                      style={{ backgroundColor: "#8B5CF618", opacity: webCheckLoading ? 0.6 : 1 }}
                      onPress={runWebCheck}
                      disabled={webCheckLoading}
                      activeOpacity={0.8}
                    >
                      {webCheckLoading ? (
                        <ActivityIndicator size="small" color="#8B5CF6" />
                      ) : (
                        <IconSymbol name="sparkles" size={13} color="#8B5CF6" />
                      )}
                      <Text className="text-xs font-bold" style={{ color: "#8B5CF6" }}>Neu analysieren</Text>
                    </TouchableOpacity>
                  </View>

                  {webCheck && (
                    <View className="bg-surface rounded-xl border border-border p-4 mt-3">
                      <Text className="text-sm font-bold text-foreground mb-2">Website-Check</Text>
                      <View className="flex-row flex-wrap gap-2 mb-2">
                        {[
                          { label: "SSL", ok: !!webCheck.sslValid },
                          { label: "Impressum", ok: !!webCheck.hasImpressum },
                          { label: "Datenschutz", ok: !!webCheck.hasPrivacy },
                          { label: "Mobil-optimiert", ok: !!webCheck.isResponsive },
                          ...(webCheck.wcagOk !== undefined ? [{ label: "Barrierefreiheit (WCAG)", ok: !!webCheck.wcagOk }] : []),
                        ].map((c) => (
                          <View
                            key={c.label}
                            className="flex-row items-center gap-1 px-2.5 py-1 rounded-full"
                            style={{ backgroundColor: (c.ok ? "#22C55E" : "#EF4444") + "18" }}
                          >
                            <IconSymbol name={c.ok ? "checkmark.circle.fill" : "xmark.circle.fill"} size={12} color={c.ok ? "#22C55E" : "#EF4444"} />
                            <Text className="text-[11px] font-semibold" style={{ color: c.ok ? "#22C55E" : "#EF4444" }}>{c.label}</Text>
                          </View>
                        ))}
                      </View>
                      {webCheck.notes ? (
                        <Text className="text-xs text-muted" style={{ lineHeight: 18 }}>{webCheck.notes}</Text>
                      ) : null}
                      <View className="flex-row gap-2 mt-3">
                        <TouchableOpacity
                          className="flex-1 py-2 rounded-lg border border-border items-center"
                          onPress={() => setWebCheck(null)}
                          activeOpacity={0.7}
                        >
                          <Text className="text-xs font-semibold text-muted">Verwerfen</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          className="flex-1 py-2 rounded-lg items-center"
                          style={{ backgroundColor: colors.primary }}
                          onPress={applyWebCheck}
                          activeOpacity={0.8}
                        >
                          <Text className="text-xs font-bold" style={{ color: colors.background }}>In Notizen übernehmen</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
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

              {referrer ? (
                <View>
                  <Text className="text-sm text-muted mb-1">Empfohlen von</Text>
                  <TouchableOpacity
                    onPress={() => { onClose(); router.push(`/customer/${lead.referrer_customer_id}` as any); }}
                    activeOpacity={0.7}
                  >
                    <Text className="text-base text-primary">
                      {(referrer as any).company_name || `${(referrer as any).first_name || ""} ${(referrer as any).last_name || ""}`.trim()}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}

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
              {(currentStatus === 'proposal' || currentStatus === 'qualified' || linkedQuoteId) && (
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
      queryClient.invalidateQueries({ queryKey: ["leadDetail"] });
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
      queryClient.invalidateQueries({ queryKey: ["leadDetail"] });
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
                        <View className="gap-2">
                          <TouchableOpacity
                            className="bg-primary/10 rounded-lg p-3 items-center"
                            onPress={() => setShowQuotePicker(true)}
                          >
                            <Text className="text-sm font-semibold text-primary">Angebot verknüpfen</Text>
                          </TouchableOpacity>
                          {(leadItems.length > 0 || lead.extra_amount > 0) ? (
                            <TouchableOpacity
                              className="rounded-lg p-3 items-center"
                              style={{ backgroundColor: "#8B5CF618" }}
                              onPress={handleCreateQuoteFromLead}
                              disabled={creatingQuote}
                              activeOpacity={0.8}
                            >
                              {creatingQuote ? (
                                <ActivityIndicator size="small" color="#8B5CF6" />
                              ) : (
                                <Text className="text-sm font-semibold text-center" style={{ color: "#8B5CF6" }}>
                                  Angebot aus Potenzial erstellen (Kunde als Interessent)
                                </Text>
                              )}
                            </TouchableOpacity>
                          ) : null}
                        </View>
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
                        onPress={() => {
                          if (s === "lost") { setShowLostPicker(true); return; }
                          setShowLostPicker(false);
                          updateStatus.mutate(s);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text className={`text-xs font-semibold ${currentStatus === s ? "text-background" : "text-foreground"}`}>
                          {getStatusLabel(s)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
                {showLostPicker && (
                  <View className="bg-surface rounded-xl border border-border p-3 mt-2">
                    <Text className="text-xs font-semibold text-muted mb-2">Warum ging der Lead verloren?</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {LOST_REASONS.map((r) => (
                        <TouchableOpacity
                          key={r.key}
                          className="px-3 py-1.5 rounded-full border border-border bg-background"
                          onPress={() => handleSetLost(r.key)}
                          activeOpacity={0.8}
                        >
                          <Text className="text-xs font-semibold text-foreground">{r.label}</Text>
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity className="px-3 py-1.5" onPress={() => setShowLostPicker(false)} activeOpacity={0.7}>
                        <Text className="text-xs text-muted">Abbrechen</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                {currentStatus === "lost" && lead.lost_reason ? (
                  <Text className="text-xs text-muted mt-2">Verlustgrund: {lostReasonLabel(lead.lost_reason)}</Text>
                ) : null}
              </View>

              {/* Erstkontakt (KI): E-Mail oder Telefon-Einstieg */}
              <View className="bg-surface rounded-xl border border-border p-4">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <IconSymbol name="sparkles" size={15} color="#8B5CF6" />
                    <Text className="text-sm font-bold text-foreground">Erstkontakt (KI)</Text>
                  </View>
                  {aiDraft ? (
                    <TouchableOpacity onPress={handleGenerateOutreach} disabled={aiLoading} activeOpacity={0.7}>
                      <Text className="text-xs font-semibold" style={{ color: "#8B5CF6" }}>
                        {aiLoading ? "Generiert..." : "Neu generieren"}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Modus: E-Mail oder Telefonat */}
                <View className="flex-row gap-2 mt-3">
                  {[
                    { key: "email" as const, label: "E-Mail", icon: "envelope.fill" },
                    { key: "call" as const, label: "Telefon-Einstieg", icon: "phone.fill" },
                  ].map((m) => {
                    const active = aiMode === m.key;
                    return (
                      <TouchableOpacity
                        key={m.key}
                        className="flex-1 flex-row items-center justify-center gap-1.5 py-2 rounded-lg border"
                        style={{
                          backgroundColor: active ? "#8B5CF618" : colors.background,
                          borderColor: active ? "#8B5CF6" : colors.border,
                        }}
                        onPress={() => {
                          if (aiMode !== m.key) {
                            setAiMode(m.key);
                            // Beim Wechsel auf Telefon: gespeicherten Einstieg wieder anzeigen
                            setAiDraft(
                              m.key === "call" && (lead as any).call_script
                                ? { subject: "", body: "", script: (lead as any).call_script }
                                : null
                            );
                          }
                        }}
                        activeOpacity={0.8}
                      >
                        <IconSymbol name={m.icon as any} size={13} color={active ? "#8B5CF6" : colors.muted} />
                        <Text className="text-xs font-semibold" style={{ color: active ? "#8B5CF6" : colors.foreground }}>
                          {m.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {aiMode === "email" && !lead.email ? (
                  <Text className="text-xs mt-3" style={{ color: colors.warning }}>
                    Für den E-Mail-Versand fehlt die E-Mail-Adresse des Leads — Entwurf erstellen geht trotzdem.
                  </Text>
                ) : null}

                {!aiDraft ? (
                  <TouchableOpacity
                    className="py-3 rounded-xl items-center mt-3"
                    style={{ backgroundColor: "#8B5CF6", opacity: aiLoading ? 0.6 : 1 }}
                    onPress={handleGenerateOutreach}
                    disabled={aiLoading}
                    activeOpacity={0.8}
                  >
                    {aiLoading ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text className="font-bold" style={{ color: "#FFF" }}>
                        {aiMode === "email" ? "Personalisierten Mail-Entwurf erstellen" : "Gesprächseinstieg erstellen"}
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View className="gap-2 mt-3">
                    {aiMode === "email" && (
                      <TextInput
                        value={aiDraft.subject}
                        onChangeText={(v) => setAiDraft({ ...aiDraft, subject: v })}
                        className="bg-background border border-border rounded-lg px-3 py-2 text-foreground"
                        placeholder="Betreff"
                        placeholderTextColor={colors.muted}
                      />
                    )}
                    {aiMode === "call" && aiDraft.script ? (
                      /* Telefon-Leitfaden strukturiert: Schritt für Schritt editierbar */
                      <View className="gap-2.5">
                        {[
                          { key: "greeting", label: "1 · Begrüssung" },
                          { key: "pitch", label: "2 · Aufhänger" },
                          { key: "question", label: "3 · Offene Frage" },
                        ].map((sec) => (
                          <View key={sec.key}>
                            <Text className="text-[10px] font-bold uppercase mb-1" style={{ color: "#8B5CF6", letterSpacing: 0.5 }}>
                              {sec.label}
                            </Text>
                            <TextInput
                              value={aiDraft.script[sec.key] || ""}
                              onChangeText={(v) => setAiDraft({ ...aiDraft, script: { ...aiDraft.script, [sec.key]: v } })}
                              multiline
                              className="bg-background border border-border rounded-lg px-3 py-2 text-foreground"
                              style={{ minHeight: 54, textAlignVertical: "top", fontSize: 14, lineHeight: 20 }}
                              placeholderTextColor={colors.muted}
                            />
                          </View>
                        ))}
                        {(aiDraft.script.objections || []).length > 0 && (
                          <View>
                            <Text className="text-[10px] font-bold uppercase mb-1" style={{ color: "#8B5CF6", letterSpacing: 0.5 }}>
                              Einwände & Antworten
                            </Text>
                            <View className="gap-2">
                              {aiDraft.script.objections.map((o: any, idx: number) => {
                                const updObjection = (field: "say" | "answer", v: string) =>
                                  setAiDraft({
                                    ...aiDraft,
                                    script: {
                                      ...aiDraft.script,
                                      objections: aiDraft.script.objections.map((x: any, i: number) =>
                                        i === idx ? { ...x, [field]: v } : x
                                      ),
                                    },
                                  });
                                return (
                                  <View key={idx} className="bg-background border border-border rounded-lg p-2.5 gap-1.5">
                                    <View className="flex-row items-center gap-1.5">
                                      <IconSymbol name="bubble.left.fill" size={11} color="#FB923C" />
                                      <Text className="text-[10px] font-bold text-muted uppercase">Kunde sagt</Text>
                                    </View>
                                    <TextInput
                                      value={o.say}
                                      onChangeText={(v) => updObjection("say", v)}
                                      multiline
                                      className="text-foreground"
                                      style={{ fontSize: 13.5, fontStyle: "italic", color: "#FB923C", padding: 0, lineHeight: 19 }}
                                      placeholderTextColor={colors.muted}
                                    />
                                    <View className="flex-row items-center gap-1.5 mt-0.5">
                                      <IconSymbol name="arrow.turn.down.right" size={11} color="#22C55E" />
                                      <Text className="text-[10px] font-bold text-muted uppercase">Ihre Antwort</Text>
                                    </View>
                                    <TextInput
                                      value={o.answer}
                                      onChangeText={(v) => updObjection("answer", v)}
                                      multiline
                                      className="text-foreground"
                                      style={{ fontSize: 13.5, padding: 0, lineHeight: 19 }}
                                      placeholderTextColor={colors.muted}
                                    />
                                  </View>
                                );
                              })}
                            </View>
                          </View>
                        )}
                      </View>
                    ) : (
                      <TextInput
                        value={aiDraft.body}
                        onChangeText={(v) => setAiDraft({ ...aiDraft, body: v })}
                        multiline
                        className="bg-background border border-border rounded-lg px-3 py-2 text-foreground"
                        style={{ minHeight: 160, textAlignVertical: "top" }}
                        placeholderTextColor={colors.muted}
                      />
                    )}
                    {aiMode === "email" ? (
                      <TouchableOpacity
                        className="py-2.5 rounded-lg items-center bg-primary"
                        style={{ opacity: lead.email ? 1 : 0.5 }}
                        onPress={handleSendOutreach}
                        disabled={aiSending || !lead.email}
                        activeOpacity={0.8}
                      >
                        {aiSending ? (
                          <ActivityIndicator size="small" color={colors.background} />
                        ) : (
                          <Text className="font-bold text-sm" style={{ color: colors.background }}>
                            {lead.email ? `Senden an ${lead.email}` : "Keine E-Mail-Adresse hinterlegt"}
                          </Text>
                        )}
                      </TouchableOpacity>
                    ) : (
                      <View className="flex-row gap-2">
                        <TouchableOpacity
                          className="flex-1 py-2.5 rounded-lg items-center bg-primary"
                          onPress={handleSaveCallScript}
                          activeOpacity={0.8}
                        >
                          <Text className="font-bold text-sm" style={{ color: colors.background }}>In Notizen speichern</Text>
                        </TouchableOpacity>
                        {(lead.phone || lead.mobile) ? (
                          <TouchableOpacity
                            className="py-2.5 px-4 rounded-lg items-center justify-center"
                            style={{ backgroundColor: "#0EA5E9" }}
                            onPress={() => Linking.openURL(`tel:${String(lead.phone || lead.mobile).replace(/\s/g, "")}`)}
                            activeOpacity={0.8}
                          >
                            <IconSymbol name="phone.fill" size={15} color="#FFF" />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>

            {/* Erinnerungen */}
            <View className="mt-6 border-t border-border pt-6">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-lg font-bold text-foreground">Erinnerungen</Text>
                <TouchableOpacity
                  className="bg-primary/10 px-3 py-1.5 rounded-lg flex-row items-center gap-1"
                  onPress={() => {
                    const tmrw = new Date();
                    tmrw.setDate(tmrw.getDate() + 1);
                    tmrw.setHours(10, 0, 0, 0);
                    setReminderDateTime(tmrw);
                    setReminderNote("");
                    setEditingReminder(null);
                    setShowAddReminder(true);
                  }}
                  activeOpacity={0.7}
                >
                  <IconSymbol name="bell.badge.fill" size={14} color={colors.primary} />
                  <Text className="text-xs font-semibold text-primary">Neue Erinnerung</Text>
                </TouchableOpacity>
              </View>
              
              {showAddReminder && (
                <View className="bg-surface rounded-xl p-4 border border-border mb-4">
                  <Text className="text-sm font-semibold text-foreground mb-3">
                    {editingReminder ? "Erinnerung bearbeiten" : "Erinnerung einstellen"}
                  </Text>

                  {/* Datum & Zeit Picker */}
                  <Text className="text-xs text-muted mb-1">Datum & Zeit</Text>
                  {Platform.OS === 'web' ? (
                    <input
                      type="datetime-local"
                      value={`${reminderDateTime.getFullYear()}-${String(reminderDateTime.getMonth()+1).padStart(2,'0')}-${String(reminderDateTime.getDate()).padStart(2,'0')}T${String(reminderDateTime.getHours()).padStart(2,'0')}:${String(reminderDateTime.getMinutes()).padStart(2,'0')}`}
                      onChange={(e) => {
                        const val = (e.target as HTMLInputElement).value;
                        if (val) setReminderDateTime(new Date(val));
                      }}
                      style={{
                        backgroundColor: colors.background,
                        border: `1px solid ${colors.border}`,
                        borderRadius: 8,
                        padding: '8px 12px',
                        color: colors.foreground,
                        fontSize: 14,
                        width: '100%',
                        marginBottom: 12,
                        boxSizing: 'border-box' as any,
                      }}
                    />
                  ) : (
                    <View className="flex-row gap-2 mb-3">
                      <TouchableOpacity
                        className="flex-1 bg-background border border-border rounded-lg px-3 py-2 flex-row items-center gap-2"
                        onPress={() => setShowDatePicker(true)}
                        activeOpacity={0.7}
                      >
                        <IconSymbol name="calendar" size={16} color={colors.primary} />
                        <Text style={{ color: colors.foreground, fontSize: 14 }}>
                          {reminderDateTime.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="flex-1 bg-background border border-border rounded-lg px-3 py-2 flex-row items-center gap-2"
                        onPress={() => setShowTimePicker(true)}
                        activeOpacity={0.7}
                      >
                        <IconSymbol name="clock" size={16} color={colors.primary} />
                        <Text style={{ color: colors.foreground, fontSize: 14 }}>
                          {reminderDateTime.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {showDatePicker && Platform.OS !== 'web' && (
                    <DateTimePicker
                      value={reminderDateTime}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      locale="de-CH"
                      onChange={(_, date) => {
                        setShowDatePicker(false);
                        if (date) {
                          const updated = new Date(reminderDateTime);
                          updated.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                          setReminderDateTime(updated);
                        }
                      }}
                    />
                  )}
                  {showTimePicker && Platform.OS !== 'web' && (
                    <DateTimePicker
                      value={reminderDateTime}
                      mode="time"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      is24Hour
                      onChange={(_, date) => {
                        setShowTimePicker(false);
                        if (date) {
                          const updated = new Date(reminderDateTime);
                          updated.setHours(date.getHours(), date.getMinutes());
                          setReminderDateTime(updated);
                        }
                      }}
                    />
                  )}

                  <Text className="text-xs text-muted mb-1">Notiz</Text>
                  <TextInput
                    className="bg-background border border-border rounded-lg px-3 py-2 text-foreground mb-3"
                    value={reminderNote}
                    onChangeText={setReminderNote}
                    placeholder="Woran soll erinnert werden?"
                    placeholderTextColor={colors.muted}
                    multiline
                    style={{ minHeight: 60 }}
                  />

                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      className="flex-1 bg-background border border-border py-2 rounded-lg"
                      onPress={() => setShowAddReminder(false)}
                      activeOpacity={0.7}
                    >
                      <Text className="text-foreground font-semibold text-center">Abbrechen</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="flex-1 bg-primary py-2 rounded-lg flex-row justify-center items-center gap-2"
                      onPress={handleCreateReminder}
                      activeOpacity={0.8}
                      disabled={addReminder.isPending || updateReminder.isPending}
                    >
                      {(addReminder.isPending || updateReminder.isPending) ? <ActivityIndicator size="small" color="#fff" /> : <Text className="text-background font-semibold text-center">Speichern</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {remindersLoading ? (
                <View className="py-4 items-center">
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : leadReminders.some((r: any) => !r.is_processed) ? (
                <View className="gap-2">
                  {leadReminders.filter((r: any) => !r.is_processed).map((r: any) => (
                    <View key={r.id} className="bg-surface border border-primary/20 rounded-lg p-3 flex-row items-start">
                      <View className="mt-1 mr-3">
                        <IconSymbol name="bell.fill" size={16} color={colors.primary} />
                      </View>
                      <View className="flex-1 mr-2">
                        <Text className="text-sm font-semibold text-foreground mb-1">
                          {new Date(r.remind_at).toLocaleString("de-CH", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        <Text className="text-sm text-foreground">{r.note}</Text>
                      </View>
                      <View className="flex-row items-center gap-3">
                        <TouchableOpacity
                          onPress={() => {
                            setEditingReminder(r);
                            setReminderNote(r.note);
                            setReminderDateTime(new Date(r.remind_at));
                            setShowAddReminder(true);
                          }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <IconSymbol name="pencil" size={16} color={colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => deleteReminder.mutate(r.id)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <IconSymbol name="trash" size={16} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text className="text-sm text-muted">Keine anstehenden Erinnerungen</Text>
              )}
            </View>

            {/* Termin planen (Outlook-Einladung / Kalenderdatei) */}
            <View className="mt-6 border-t border-border pt-6">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-lg font-bold text-foreground">Termin planen</Text>
                <TouchableOpacity
                  className="bg-primary/10 px-3 py-1.5 rounded-lg flex-row items-center gap-1"
                  onPress={() => {
                    if (!showPlanMeeting) {
                      setMtTitle(`Termin: ${lead.company || lead.name}`);
                      const t = new Date(Date.now() + 86400000);
                      setMtDate(t.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" }));
                    }
                    setShowPlanMeeting(!showPlanMeeting);
                  }}
                  activeOpacity={0.7}
                >
                  <IconSymbol name="calendar" size={14} color={colors.primary} />
                  <Text className="text-xs font-semibold text-primary">Neuer Termin</Text>
                </TouchableOpacity>
              </View>
              {showPlanMeeting && (
                <View className="bg-surface rounded-xl p-4 border border-border gap-2.5">
                  <TextInput
                    className="bg-background border border-border rounded-lg px-3 py-2 text-foreground"
                    value={mtTitle}
                    onChangeText={setMtTitle}
                    placeholder="Titel"
                    placeholderTextColor={colors.muted}
                  />
                  <View className="flex-row gap-2">
                    <TextInput
                      className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground"
                      value={mtDate}
                      onChangeText={setMtDate}
                      placeholder="TT.MM.JJJJ"
                      placeholderTextColor={colors.muted}
                    />
                    <TextInput
                      className="bg-background border border-border rounded-lg px-3 py-2 text-foreground"
                      style={{ width: 90, textAlign: "center" }}
                      value={mtTime}
                      onChangeText={setMtTime}
                      placeholder="HH:MM"
                      placeholderTextColor={colors.muted}
                    />
                  </View>
                  <View className="flex-row items-center gap-2 flex-wrap">
                    <Text className="text-xs text-muted">Dauer:</Text>
                    {[30, 60, 90, 120].map((m) => (
                      <TouchableOpacity
                        key={m}
                        className="px-3 py-1.5 rounded-full border"
                        style={{
                          backgroundColor: mtDuration === m ? colors.primary : colors.background,
                          borderColor: mtDuration === m ? colors.primary : colors.border,
                        }}
                        onPress={() => setMtDuration(m)}
                        activeOpacity={0.8}
                      >
                        <Text className="text-xs font-semibold" style={{ color: mtDuration === m ? colors.background : colors.foreground }}>
                          {m} Min.
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View className="flex-row items-center gap-2 flex-wrap">
                    <Text className="text-xs text-muted">Mitarbeitende:r:</Text>
                    {(employees as any[]).filter((e: any) => e.email).map((emp: any) => {
                      const active = mtAttendee?.email === emp.email;
                      return (
                        <TouchableOpacity
                          key={emp.id}
                          className="px-3 py-1.5 rounded-full border"
                          style={{
                            backgroundColor: active ? colors.primary : colors.background,
                            borderColor: active ? colors.primary : colors.border,
                          }}
                          onPress={() => setMtAttendee({ email: emp.email, name: emp.name || emp.email })}
                          activeOpacity={0.8}
                        >
                          <Text className="text-xs font-semibold" style={{ color: active ? colors.background : colors.foreground }}>
                            {emp.name || emp.email}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <TextInput
                    className="bg-background border border-border rounded-lg px-3 py-2 text-foreground"
                    value={mtNote}
                    onChangeText={setMtNote}
                    placeholder="Notiz (optional)"
                    placeholderTextColor={colors.muted}
                    multiline
                    style={{ minHeight: 50, textAlignVertical: "top" }}
                  />
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      className="flex-1 py-2.5 rounded-lg items-center bg-primary"
                      onPress={handleSendInvite}
                      disabled={sendingInvite}
                      activeOpacity={0.8}
                    >
                      {sendingInvite ? (
                        <ActivityIndicator size="small" color={colors.background} />
                      ) : (
                        <Text className="text-sm font-bold" style={{ color: colors.background }}>Outlook-Einladung senden</Text>
                      )}
                    </TouchableOpacity>
                    {Platform.OS === "web" && (
                      <TouchableOpacity
                        className="py-2.5 px-4 rounded-lg items-center border border-border bg-background"
                        onPress={handleDownloadIcs}
                        activeOpacity={0.8}
                      >
                        <Text className="text-sm font-semibold text-foreground">.ics</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text className="text-[11px] text-muted">
                    Die Einladung geht als Kalender-Anhang an die E-Mail des Mitarbeitenden — in Outlook annehmen genügt, dann steht der Termin im Kalender.
                  </Text>
                </View>
              )}
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
                      <View className="flex-row items-start justify-between">
                        <Text className="text-sm text-foreground flex-1 pr-2">{activity.content}</Text>
                        {isAdmin && (
                          <TouchableOpacity
                            onPress={() => {
                              showConfirm("Aktivität löschen", "Möchten Sie diese Aktivität wirklich löschen?", async () => {
                                try {
                                  await Data.deleteLeadActivity(activity.id);
                                  refetchActivities();
                                } catch(e: any) {
                                  showAlert("Fehler", e.message);
                                }
                              });
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <IconSymbol name="trash" size={14} color={colors.error} />
                          </TouchableOpacity>
                        )}
                      </View>
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


// ── Anruf-Modus: Lead für Lead abtelefonieren, mit Skript und Ergebnis-Knöpfen ──
function CallModeModal({ visible, onClose, colors }: { visible: boolean; onClose: () => void; colors: any }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(0);

  const { data: callList = [] } = useQuery({
    queryKey: ["callModeLeads"],
    queryFn: async () => {
      const { data } = await Data.supabase
        .from("leads")
        .select("*")
        .in("status", ["new", "contacted"])
        .order("next_action_date", { ascending: true, nullsFirst: true })
        .limit(50);
      return (data as any[]) || [];
    },
    enabled: visible,
  });

  const { data: settings = {} } = useQuery({
    queryKey: ["marketingSettings"],
    queryFn: Data.getMarketingSettings,
    enabled: visible,
  });
  const script = (settings as any).call_script || "Kein Anruf-Skript hinterlegt – unter Einstellungen → Kundengewinnung anpassen.";

  const lead = (callList as any[])[index];

  const logResult = async (updates: Record<string, any>, note: string) => {
    if (!lead) return;
    try {
      const stamp = new Date().toLocaleDateString("de-CH");
      await Data.updateLead(lead.id, {
        ...updates,
        notes: `${lead.notes ? lead.notes + "\n" : ""}[${stamp}] ${note}`,
      });
      // Zählt als Kontakt fürs Wochenziel und erscheint in der Historie
      await Data.addLeadActivity({
        lead_id: lead.id,
        type: "activity",
        content: `Anruf-Modus: ${note}`,
        user_name: "Anruf-Modus",
      });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leadDetail"] });
      queryClient.invalidateQueries({ queryKey: ["weeklyContacts"] });
      setDone(done + 1);
      setIndex(index + 1);
    } catch (e: any) {
      showAlert("Fehler", e.message);
    }
  };

  const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().split("T")[0];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "92%" }}>
          <View className="flex-row items-center justify-between p-4 border-b border-border">
            <View className="flex-row items-center gap-2">
              <IconSymbol name="phone.fill" size={17} color="#0EA5E9" />
              <Text className="text-lg font-bold text-foreground">Anruf-Modus</Text>
              <Text className="text-xs text-muted">· {done} erledigt</Text>
            </View>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <IconSymbol name="xmark.circle.fill" size={26} color={colors.muted} />
            </TouchableOpacity>
          </View>

          {!lead ? (
            <View className="items-center py-14 px-6">
              <IconSymbol name="checkmark.circle.fill" size={44} color={colors.success} />
              <Text className="text-base font-bold text-foreground mt-3">Liste abtelefoniert!</Text>
              <Text className="text-sm text-muted text-center mt-1">
                {done > 0 ? `${done} Anrufe protokolliert.` : "Keine Leads mit Status Neu/Kontaktiert vorhanden."}
              </Text>
            </View>
          ) : (
            <ScrollView className="p-4">
              <Text className="text-xs text-muted mb-1">{index + 1} von {(callList as any[]).length}</Text>
              <Text className="text-xl font-bold text-foreground">{lead.company || lead.name}</Text>
              {lead.company ? <Text className="text-sm text-muted">{lead.name}{lead.position ? ` · ${lead.position}` : ""}</Text> : null}

              {(lead.phone || lead.mobile) ? (
                <TouchableOpacity
                  className="flex-row items-center justify-center gap-2 py-3.5 rounded-xl mt-4"
                  style={{ backgroundColor: "#0EA5E9" }}
                  onPress={() => Linking.openURL(`tel:${(lead.phone || lead.mobile).replace(/\s/g, "")}`)}
                  activeOpacity={0.8}
                >
                  <IconSymbol name="phone.fill" size={17} color="#FFF" />
                  <Text className="font-bold" style={{ color: "#FFF" }}>{lead.phone || lead.mobile} anrufen</Text>
                </TouchableOpacity>
              ) : (
                <Text className="text-sm mt-4" style={{ color: colors.warning }}>Keine Telefonnummer hinterlegt</Text>
              )}

              {/* Skript */}
              <View className="bg-surface rounded-xl border border-border p-4 mt-4">
                <Text className="text-xs font-bold text-muted mb-2">LEITFADEN</Text>
                <Text className="text-sm text-foreground" style={{ lineHeight: 21 }}>{script}</Text>
              </View>

              {lead.notes ? (
                <View className="bg-surface rounded-xl border border-border p-4 mt-3">
                  <Text className="text-xs font-bold text-muted mb-2">NOTIZEN</Text>
                  <Text className="text-xs text-muted" style={{ lineHeight: 18 }}>{lead.notes}</Text>
                </View>
              ) : null}

              {/* Ergebnis */}
              <Text className="text-xs font-bold text-muted mt-5 mb-2">ERGEBNIS</Text>
              <View className="flex-row flex-wrap gap-2 mb-2">
                <TouchableOpacity
                  className="flex-1 py-3 rounded-xl items-center"
                  style={{ backgroundColor: colors.success + "20", borderWidth: 1, borderColor: colors.success + "50", minWidth: "45%" }}
                  onPress={() => logResult({ status: "contacted", next_action: "Nachfassen nach Gespräch", next_action_date: inDays(7) }, "Erreicht – Gespräch geführt")}
                  activeOpacity={0.8}
                >
                  <Text className="text-sm font-bold" style={{ color: colors.success }}>✓ Erreicht</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 py-3 rounded-xl items-center"
                  style={{ backgroundColor: colors.warning + "20", borderWidth: 1, borderColor: colors.warning + "50", minWidth: "45%" }}
                  onPress={() => logResult({ next_action: "Erneut anrufen", next_action_date: inDays(2) }, "Nicht erreicht / Mailbox")}
                  activeOpacity={0.8}
                >
                  <Text className="text-sm font-bold" style={{ color: colors.warning }}>☏ Mailbox</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 py-3 rounded-xl items-center"
                  style={{ backgroundColor: colors.primary + "20", borderWidth: 1, borderColor: colors.primary + "50", minWidth: "45%" }}
                  onPress={() => logResult({ status: "contacted", rating: "hot", next_action: "Termin vorbereiten", next_action_date: inDays(1) }, "Termin vereinbart!")}
                  activeOpacity={0.8}
                >
                  <Text className="text-sm font-bold" style={{ color: colors.primary }}>📅 Termin!</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 py-3 rounded-xl items-center"
                  style={{ backgroundColor: colors.error + "15", borderWidth: 1, borderColor: colors.error + "40", minWidth: "45%" }}
                  onPress={() => logResult({ status: "lost" }, "Kein Interesse")}
                  activeOpacity={0.8}
                >
                  <Text className="text-sm font-bold" style={{ color: colors.error }}>✕ Kein Interesse</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity className="py-2.5 items-center" onPress={() => setIndex(index + 1)} activeOpacity={0.7}>
                <Text className="text-sm font-semibold text-muted">Überspringen →</Text>
              </TouchableOpacity>
              <View style={{ height: 32 }} />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── Cross-Selling: KI findet fehlende Leistungen bei Bestandskunden ──
function CrossSellModal({ visible, onClose, colors }: { visible: boolean; onClose: () => void; colors: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<any[] | null>(null);

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const result = await Data.getCrossSellSuggestions();
      setSuggestions(result);
    } catch (e: any) {
      showAlert("Fehler", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "88%" }}>
          <View className="flex-row items-center justify-between p-4 border-b border-border">
            <View className="flex-row items-center gap-2">
              <IconSymbol name="sparkles" size={17} color="#8B5CF6" />
              <Text className="text-lg font-bold text-foreground">Potenzial bei Bestandskunden</Text>
            </View>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <IconSymbol name="xmark.circle.fill" size={26} color={colors.muted} />
            </TouchableOpacity>
          </View>
          <ScrollView className="p-4">
            <Text className="text-xs text-muted mb-3">
              Die KI vergleicht Kunden, Verträge und Ihren Leistungskatalog und schlägt vor, wem welche Leistung fehlt.
            </Text>
            {suggestions === null ? (
              <TouchableOpacity
                className="py-3.5 rounded-xl items-center"
                style={{ backgroundColor: "#8B5CF6", opacity: loading ? 0.6 : 1 }}
                onPress={handleAnalyze}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? <ActivityIndicator size="small" color="#FFF" /> : (
                  <Text className="font-bold" style={{ color: "#FFF" }}>Analyse starten</Text>
                )}
              </TouchableOpacity>
            ) : suggestions.length === 0 ? (
              <Text className="text-sm text-muted text-center py-8">Keine offensichtlichen Lücken gefunden – gut abgedeckt!</Text>
            ) : (
              suggestions.map((sg: any, idx: number) => (
                <TouchableOpacity
                  key={idx}
                  className="bg-surface rounded-xl border border-border p-4 mb-2.5"
                  onPress={() => { onClose(); router.push(`/customer/${sg.customerId}` as any); }}
                  activeOpacity={0.7}
                >
                  <Text className="text-sm font-bold text-foreground">{sg.customer}</Text>
                  <Text className="text-sm mt-1" style={{ color: "#B99CFF" }}>{sg.idea}</Text>
                  <Text className="text-xs text-muted mt-1">{sg.reason}</Text>
                </TouchableOpacity>
              ))
            )}
            {loading && suggestions === null ? (
              <Text className="text-xs text-muted text-center mt-3">Die KI analysiert Ihre Daten – einen Moment...</Text>
            ) : null}
            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── CSV-Import: Firmenlisten (z.B. Branchenverzeichnis-Export) als Leads ──
function ImportLeadsModal({
  visible, onClose, colors, existingLeads, onDone,
}: { visible: boolean; onClose: () => void; colors: any; existingLeads: any[]; onDone: () => void }) {
  const [csvText, setCsvText] = useState("");
  const [importing, setImporting] = useState(false);

  const parseCsv = (text: string) => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return { rows: [] as any[], skipped: 0 };
    // Trennzeichen erkennen
    const head = lines[0];
    const delim = head.includes(";") ? ";" : head.includes("\t") ? "\t" : ",";
    const headers = head.split(delim).map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ""));
    const col = (names: string[]) => headers.findIndex((h) => names.includes(h));
    const idx = {
      company: col(["firma", "company", "firmenname", "unternehmen", "name der firma"]),
      name: col(["name", "kontakt", "kontaktperson", "ansprechpartner", "person"]),
      email: col(["email", "e-mail", "mail"]),
      phone: col(["telefon", "phone", "tel", "telefonnummer"]),
      website: col(["website", "webseite", "url", "web", "homepage"]),
      address: col(["adresse", "strasse", "address", "street"]),
      zip: col(["plz", "zip", "postleitzahl"]),
      city: col(["ort", "city", "stadt", "gemeinde"]),
      notes: col(["notizen", "notes", "bemerkung", "bemerkungen"]),
    };
    if (idx.company < 0 && idx.name < 0) return { rows: [], skipped: 0, badHeader: true } as any;

    const existingEmails = new Set(
      existingLeads.map((l) => (l.email || "").toLowerCase()).filter(Boolean)
    );
    const existingCompanies = new Set(
      existingLeads.map((l) => (l.company || "").toLowerCase()).filter(Boolean)
    );

    const rows: any[] = [];
    let skipped = 0;
    for (const line of lines.slice(1)) {
      const cells = line.split(delim).map((c) => c.trim().replace(/^"|"$/g, ""));
      const get = (i: number) => (i >= 0 && cells[i] ? cells[i] : "");
      const company = get(idx.company);
      const name = get(idx.name);
      if (!company && !name) continue;
      const email = get(idx.email).toLowerCase();
      if ((email && existingEmails.has(email)) || (company && existingCompanies.has(company.toLowerCase()))) {
        skipped++;
        continue;
      }
      rows.push({
        company: company || undefined,
        name: name || company,
        email: email || undefined,
        phone: get(idx.phone) || undefined,
        website: get(idx.website) || undefined,
        address: get(idx.address) || undefined,
        zip: get(idx.zip) || undefined,
        city: get(idx.city) || undefined,
        notes: get(idx.notes) || undefined,
        status: "new",
        priority: "medium",
        source: "kaltakquise",
        value: 0,
      });
    }
    return { rows, skipped };
  };

  const preview = parseCsv(csvText);

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ["text/csv", "text/plain", "*/*"], copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const uri = result.assets[0].uri;
      const text = Platform.OS === "web"
        ? await (await fetch(uri)).text()
        : await FileSystem.readAsStringAsync(uri);
      setCsvText(text);
    } catch (e: any) {
      showAlert("Fehler", "Datei konnte nicht gelesen werden: " + e.message);
    }
  };

  const handleImport = async () => {
    if (!preview.rows.length) return;
    setImporting(true);
    try {
      let created = 0;
      for (const row of preview.rows) {
        try {
          await Data.createLead(row);
          created++;
        } catch (e) {
          console.warn("[import] Lead übersprungen:", row.company || row.name, e);
        }
      }
      onDone();
      onClose();
      setCsvText("");
      showAlert("Import abgeschlossen", `${created} Lead(s) importiert${preview.skipped ? `, ${preview.skipped} Duplikat(e) übersprungen` : ""}.`);
    } catch (e: any) {
      showAlert("Fehler", e.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-end" style={Platform.OS === "web" ? { justifyContent: "center", alignItems: "center" } : undefined}>
        <View className="bg-background rounded-t-3xl" style={Platform.OS === "web" ? { maxWidth: 640, width: "100%", borderRadius: 24, maxHeight: "85%" } : { maxHeight: "90%" }}>
          <View className="flex-row items-center justify-between p-4 border-b border-border">
            <View className="flex-row items-center gap-2">
              <IconSymbol name="tray.fill" size={17} color={colors.primary} />
              <Text className="text-lg font-bold text-foreground">Leads importieren (CSV)</Text>
            </View>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <IconSymbol name="xmark.circle.fill" size={26} color={colors.muted} />
            </TouchableOpacity>
          </View>
          <ScrollView className="p-4" keyboardShouldPersistTaps="handled">
            <Text className="text-xs text-muted mb-3" style={{ lineHeight: 18 }}>
              CSV mit Kopfzeile einfügen oder als Datei wählen. Erkannte Spalten: Firma, Name, E-Mail, Telefon, Website, Adresse, PLZ, Ort, Notizen (Komma, Semikolon oder Tab als Trennzeichen). Bereits vorhandene Leads (gleiche Firma oder E-Mail) werden übersprungen — alle neuen landen als «Neu» mit Quelle «Kaltakquise».
            </Text>
            <TouchableOpacity
              className="flex-row items-center justify-center gap-2 py-2.5 rounded-xl border border-border bg-surface mb-3"
              onPress={handlePickFile}
              activeOpacity={0.8}
            >
              <IconSymbol name="folder.fill" size={15} color={colors.primary} />
              <Text className="text-sm font-semibold text-foreground">CSV-Datei wählen</Text>
            </TouchableOpacity>
            <TextInput
              className="bg-surface border border-border rounded-xl px-3 py-2.5 text-foreground"
              style={{ minHeight: 140, textAlignVertical: "top", fontSize: 12, fontFamily: Platform.OS === "web" ? "monospace" : undefined }}
              value={csvText}
              onChangeText={setCsvText}
              multiline
              placeholder={"Firma;Name;E-Mail;Telefon;Website;PLZ;Ort\nMuster AG;Max Muster;max@muster.ch;041 123 45 67;www.muster.ch;6130;Willisau"}
              placeholderTextColor={colors.muted}
            />
            {csvText.trim().length > 0 && (
              <View className="bg-surface rounded-xl border border-border p-3 mt-3">
                {(preview as any).badHeader ? (
                  <Text className="text-xs" style={{ color: "#EF4444" }}>
                    Keine Spalte «Firma» oder «Name» in der Kopfzeile gefunden.
                  </Text>
                ) : (
                  <Text className="text-xs text-foreground">
                    <Text className="font-bold">{preview.rows.length}</Text> neue Leads erkannt
                    {preview.skipped ? ` · ${preview.skipped} Duplikat(e) werden übersprungen` : ""}
                  </Text>
                )}
                {preview.rows.slice(0, 5).map((r: any, i: number) => (
                  <Text key={i} className="text-[11px] text-muted mt-1" numberOfLines={1}>
                    • {r.company || r.name}{r.city ? ` (${r.city})` : ""}{r.email ? ` · ${r.email}` : ""}
                  </Text>
                ))}
                {preview.rows.length > 5 ? (
                  <Text className="text-[11px] text-muted mt-1">… und {preview.rows.length - 5} weitere</Text>
                ) : null}
              </View>
            )}
            <TouchableOpacity
              className="py-3 rounded-xl items-center bg-primary mt-4"
              style={{ opacity: preview.rows.length && !importing ? 1 : 0.5 }}
              onPress={handleImport}
              disabled={!preview.rows.length || importing}
              activeOpacity={0.8}
            >
              {importing ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <Text className="font-bold" style={{ color: colors.background }}>
                  {preview.rows.length ? `${preview.rows.length} Leads importieren` : "Leads importieren"}
                </Text>
              )}
            </TouchableOpacity>
            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

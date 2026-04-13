import { useState, useEffect } from "react";
import {
  ScrollView, Text, View, TouchableOpacity, ActivityIndicator,
  TextInput, Modal, RefreshControl, Switch, Share,
} from "react-native";

import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useGlobalRefresh } from "@/hooks/use-global-refresh";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { showAlert, showConfirm } from "@/lib/alert";
import { formatDate } from "@/lib/format";
import { NewsletterBuilder } from "@/components/newsletter-builder";
import { NEWSLETTER_TEMPLATES } from "@/lib/newsletter-templates";
const PINK = "#EC4899";

type Tab = "overview" | "brainstorming" | "newsletter" | "campaigns" | "events" | "testimonials" | "content" | "analytics";

// ─── Lookup Tables ─────────────────────────────────────────────────────────────

const CHANNEL_LABELS: Record<string, string> = {
  google_ads: "Google Ads", social_media: "Social Media", print: "Print / Flyer",
  plakat: "Plakatwerbung", inserat: "Inserat / Anzeige", email: "E-Mail",
  outdoor: "Aussenwerbung", referral: "Empfehlung", seo: "SEO", other: "Sonstiges",
};
const CHANNEL_ICONS: Record<string, string> = {
  google_ads: "magnifyingglass.circle.fill", social_media: "shareplay", print: "printer.fill",
  plakat: "photo.fill", inserat: "newspaper.fill", email: "envelope.fill",
  outdoor: "map.fill", referral: "person.2.fill", seo: "globe", other: "ellipsis.circle.fill",
};
const CHANNEL_COLORS: Record<string, string> = {
  google_ads: "#4285F4", social_media: "#EC4899", print: "#F59E0B", plakat: "#D97706",
  inserat: "#7C3AED", email: "#8B5CF6", outdoor: "#14B8A6", referral: "#22C55E",
  seo: "#0EA5E9", other: "#6B7280",
};
const CHANNEL_TIPS: Record<string, { tip: string; checklist: string[]; typicalBudget?: string }> = {
  google_ads: { tip: "Google Ads eignen sich für aktive Suchanfragen. Der Nutzer sucht bereits nach Ihrer Leistung.", checklist: ["Keywords definieren und Suchvolumen prüfen", "Landing Page optimieren", "Conversion-Tracking einrichten", "Anzeigentexte (Titel + Beschreibung) verfassen", "Negativ-Keywords hinterlegen"], typicalBudget: "CHF 300–2'000 / Monat" },
  social_media: { tip: "Social Ads (LinkedIn, Instagram, Facebook) erzielen hohe Reichweite. LinkedIn ist ideal für B2B im IT-Umfeld.", checklist: ["Zielgruppe genau definieren (Branche, Funktion, Grösse)", "Bild-/Video-Kreativelemente erstellen", "Call-to-Action festlegen", "Pixel / Meta-Tracking einrichten", "A/B-Test mit 2 Anzeigenvarianten planen"], typicalBudget: "CHF 200–1'500 / Monat" },
  plakat: { tip: "Plakatwerbung schafft lokale Bekanntheit. Buchung bei APG|SGA mindestens 4 Wochen im Voraus.", checklist: ["Format wählen (F12, F200, Citylite, A2)", "Druckdaten (PDF, 300 DPI, CMYK) bereitstellen", "Standorte / Flächen buchen", "QR-Code für Tracking-URL einfügen", "Kampagnenzeitraum 2 Wochen vor / nach Event planen"], typicalBudget: "CHF 500–3'000 / Belegung" },
  inserat: { tip: "Inserate in Lokalzeitungen oder Fachmagazinen erreichen eine klar definierte Zielgruppe.", checklist: ["Medium und Ausgabe auswählen", "Anzeigenformat und Platzierung reservieren", "Druckdaten oder HTML-Banner liefern", "Erscheinungsdatum rechtzeitig einplanen", "Rabatte für Mehrfachbuchungen anfragen"], typicalBudget: "CHF 400–2'500 / Inserat" },
  print: { tip: "Flyer und Broschüren bieten hohe Kontakttiefe. Ideal für Messen, Direktmailings und Partner.", checklist: ["Auflage und Druckerei festlegen", "Layout und Text fertigstellen", "Druckdaten (PDF, Druckmarken) exportieren", "Verteilstrategie planen (Messe, Direktmail, Auslage)"], typicalBudget: "CHF 200–800 / Auflage" },
  email: { tip: "Direkte E-Mail-Kampagnen erzielen den höchsten ROI bei korrekter Personalisierung.", checklist: ["Empfängerliste segmentieren und bereinigen", "Betreffzeile A/B-testen", "Abmelde-Link einbinden (Datenschutz)", "Versandzeitpunkt optimieren (Di–Do, 09–11 Uhr)"], typicalBudget: "CHF 50–300 / Kampagne" },
  outdoor: { tip: "Digitale Aussenwerbung (LED-Screens) erzielt maximale Sichtbarkeit in Frequenzlagen.", checklist: ["Standorte und Verfügbarkeit prüfen", "Motive nach Spezifikation erstellen", "Technische Spezifikationen anfragen", "Genehmigungen einholen"], typicalBudget: "CHF 800–4'000 / Belegung" },
  referral: { tip: "Empfehlungsprogramme haben die höchste Conversion-Rate. Kunden sind Ihre beste Vertriebskraft.", checklist: ["Prämie für Empfehlende definieren", "Tracking-Links oder Empfehlungscodes erstellen", "E-Mail / Brief an Bestandskunden senden", "Erfolge kommunizieren und belohnen"], typicalBudget: "CHF 0–500 (Prämien)" },
  seo: { tip: "SEO zeigt Ergebnisse nach 3–6 Monaten, bietet aber den tiefsten Cost-per-Lead langfristig.", checklist: ["Keyword-Recherche durchführen", "On-Page Optimierungen umsetzen", "Backlink-Strategie entwickeln", "Google Search Console einrichten"], typicalBudget: "CHF 300–1'500 / Monat" },
  other: { tip: "Definieren Sie Ihr eigenes Kampagnenformat und legen Sie klare KPIs fest.", checklist: ["Ziel und messbare KPIs definieren", "Massnahmen und Zeitplan festlegen", "Budget allokieren", "Erfolgsmessung einrichten"] },
};
const CAMPAIGN_TEMPLATES = [
  { label: "Google Ads", icon: "magnifyingglass.circle.fill", data: { channel: "google_ads", goal: "leads", title: "Google Ads Kampagne 2026", description: "Suchanzeigen auf relevante IT-Keywords. Ziel: qualifizierte Anfragen von KMU in der Schweiz." } },
  { label: "LinkedIn", icon: "shareplay", data: { channel: "social_media", goal: "awareness", title: "LinkedIn B2B Kampagne 2026", description: "Gesponserte Beiträge an IT- und Geschäftsführer in KMU. Zielregion: Deutschschweiz." } },
  { label: "Plakat", icon: "photo.fill", data: { channel: "plakat", goal: "awareness", title: "Plakatierung Region 2026", description: "Lokale Plakatwerbung F200 in Ortszentren. QR-Code verlinkt auf Angebotsseite." } },
  { label: "Newsletter", icon: "envelope.fill", data: { channel: "email", goal: "retention", title: "Kundennewsletter 2026", description: "Monatliche E-Mail-Kampagne an Bestandskunden mit News, Tipps und Angeboten." } },
  { label: "Flyer", icon: "printer.fill", data: { channel: "print", goal: "leads", title: "Messeflyer 2026", description: "A5-Flyer für Messeauftritt. Kurzübersicht Leistungen + QR-Code zur Website." } },
  { label: "Inserat", icon: "newspaper.fill", data: { channel: "inserat", goal: "awareness", title: "Inserat Regionalzeitung 2026", description: "1/4-Seite Inserat in der Lokalzeitung. Fokus auf KMU-Support-Angebote." } },
];
const CAMPAIGN_STATUS_LABEL: Record<string, string> = { planned: "Geplant", active: "Aktiv", paused: "Pausiert", completed: "Abgeschlossen", cancelled: "Abgebrochen" };
const CAMPAIGN_STATUS_COLOR: Record<string, string> = { planned: "#F59E0B", active: "#22C55E", paused: "#6B7280", completed: "#0EA5E9", cancelled: "#EF4444" };
const EVENT_TYPE_LABELS: Record<string, string> = { messe: "Messe", webinar: "Webinar", workshop: "Workshop", networking: "Networking", conference: "Konferenz", other: "Sonstiges" };
const EVENT_TYPE_ICONS: Record<string, string> = { messe: "building.2.fill", webinar: "video.fill", workshop: "wrench.fill", networking: "person.3.fill", conference: "mic.fill", other: "calendar" };
const PLATFORM_LABELS: Record<string, string> = { linkedin: "LinkedIn", instagram: "Instagram", facebook: "Facebook", website: "Website/Blog", email: "E-Mail", youtube: "YouTube", swiss_channels: "CH-Kanäle", other: "Sonstiges" };
const PLATFORM_EMOJIS: Record<string, string> = { linkedin: "💼", instagram: "📸", facebook: "👥", website: "🌐", email: "📧", youtube: "▶️", swiss_channels: "🇨🇭", other: "📋" };
const PLATFORM_COLORS: Record<string, string> = { linkedin: "#0A66C2", instagram: "#E1306C", facebook: "#1877F2", website: "#0EA5E9", email: "#8B5CF6", youtube: "#FF0000", swiss_channels: "#FF0000", other: "#6B7280" };
const CONTENT_STATUS_COLOR: Record<string, string> = { draft: "#6B7280", scheduled: "#F59E0B", published: "#22C55E", cancelled: "#EF4444" };
const CONTENT_STATUS_LABEL: Record<string, string> = { draft: "Entwurf", scheduled: "Geplant", published: "Publiziert", cancelled: "Abgebrochen" };
const SOURCE_COLORS = ["#EC4899", "#8B5CF6", "#0EA5E9", "#22C55E", "#F59E0B", "#14B8A6", "#6B7280", "#EF4444"];

// ─── Generic UI Components ─────────────────────────────────────────────────────

function Badge({ label, color }: { label: string; color: string }) {
  return <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, backgroundColor: color + "22" }}><Text style={{ fontSize: 11, fontWeight: "700", color }}>{label}</Text></View>;
}
function EmptyState({ icon, title, sub, color }: { icon: string; title: string; sub: string; color?: string }) {
  const colors = useColors(); const c = color || PINK;
  return (
    <View style={{ alignItems: "center", paddingVertical: 52 }}>
      <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: c + "18", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <IconSymbol name={icon as any} size={32} color={c} />
      </View>
      <Text style={{ fontSize: 17, fontWeight: "700", color: colors.foreground, marginBottom: 6 }}>{title}</Text>
      <Text style={{ fontSize: 13, color: colors.muted, textAlign: "center", paddingHorizontal: 20 }}>{sub}</Text>
    </View>
  );
}
function SectionButton({ label, onPress, color }: { label: string; onPress: () => void; color?: string }) {
  const c = color || PINK;
  return (
    <TouchableOpacity style={{ backgroundColor: c, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }} activeOpacity={0.85} onPress={onPress}>
      <IconSymbol name="plus.circle.fill" size={18} color="#fff" />
      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{label}</Text>
    </TouchableOpacity>
  );
}
function BottomSheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 24, maxHeight: "92%" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: "700", color: colors.foreground }}>{title}</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}><IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} /></TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}
function FL({ label }: { label: string }) {
  const colors = useColors();
  return <Text style={{ fontSize: 12, fontWeight: "700", color: colors.muted, marginBottom: 6, marginTop: 12, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</Text>;
}
function SI({ value, onChange, placeholder, multiline, keyboardType }: { value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; keyboardType?: any }) {
  const colors = useColors();
  return <TextInput style={{ backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border, color: colors.foreground, padding: 12, fontSize: 14, minHeight: multiline ? 90 : undefined, textAlignVertical: multiline ? "top" : undefined, marginBottom: 2 }} placeholder={placeholder} placeholderTextColor={colors.muted} value={value} onChangeText={onChange} multiline={multiline} keyboardType={keyboardType} />;
}
function Pills({ options, value, onChange, color }: { options: { key: string; label: string }[]; value: string; onChange: (v: string) => void; color?: string }) {
  const colors = useColors(); const c = color || PINK;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 2 }}>
      {options.map((o) => <TouchableOpacity key={o.key} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: value === o.key ? c : colors.surface, borderWidth: 1, borderColor: value === o.key ? c : colors.border }} onPress={() => onChange(o.key)}><Text style={{ fontSize: 12, fontWeight: "600", color: value === o.key ? "#fff" : colors.muted }}>{o.label}</Text></TouchableOpacity>)}
    </ScrollView>
  );
}
function MultiPills({ options, values, onChange, color }: { options: { key: string; label: string }[]; values: string[]; onChange: (v: string[]) => void; color?: string }) {
  const colors = useColors(); const c = color || PINK;
  const toggle = (key: string) => { if (values.includes(key)) onChange(values.filter(v => v !== key)); else onChange([...values, key]); };
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((o) => {
        const active = values.includes(o.key);
        return <TouchableOpacity key={o.key} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: active ? c : colors.surface, borderWidth: 1, borderColor: active ? c : colors.border }} onPress={() => toggle(o.key)}><Text style={{ fontSize: 12, fontWeight: "600", color: active ? "#fff" : colors.muted }}>{o.label}</Text></TouchableOpacity>
      })}
    </View>
  );
}
function SaveBtn({ onPress, loading, label, color }: { onPress: () => void; loading: boolean; label?: string; color?: string }) {
  const c = color || PINK;
  return <TouchableOpacity style={{ backgroundColor: c, borderRadius: 14, padding: 16, alignItems: "center", marginTop: 20, opacity: loading ? 0.7 : 1 }} onPress={onPress} disabled={loading} activeOpacity={0.85}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>{label || "Speichern"}</Text>}</TouchableOpacity>;
}
function MiniStat({ label, val, color }: { label: string; val: any; color: string }) {
  const colors = useColors();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border, alignItems: "center" }}>
      <Text style={{ fontSize: 18, fontWeight: "800", color }} numberOfLines={1}>{val}</Text>
      <Text style={{ fontSize: 10, color: colors.muted, textAlign: "center" }}>{label}</Text>
    </View>
  );
}
function TableRow({ label, val, color }: { label: string; val: any; color: string }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Text style={{ fontSize: 13, color: colors.muted }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: "700", color }}>{val}</Text>
    </View>
  );
}
function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  const colors = useColors();
  return <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, ...style }}>{children}</View>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── OVERVIEW TAB ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function OverviewTab({ stats, isLoading }: { stats: any; isLoading: boolean }) {
  const colors = useColors(); const { isWide } = useResponsiveLayout();
  if (isLoading) return <View style={{ paddingVertical: 60, alignItems: "center" }}><ActivityIndicator size="large" color={PINK} /></View>;
  const kpis = [
    { icon: "megaphone.fill", label: "Aktive Kampagnen", value: stats?.activeCampaigns ?? 0, color: PINK, sub: `${stats?.totalCampaigns ?? 0} gesamt` },
    { icon: "envelope.fill", label: "Newsletter versendet", value: stats?.totalSent?.toLocaleString("de-CH") ?? 0, color: "#8B5CF6", sub: `Ø ${stats?.avgOpenRate ?? 0}% Öffnungsrate` },
    { icon: "calendar", label: "Bevorstehende Events", value: stats?.upcomingEvents ?? 0, color: "#0EA5E9", sub: `${stats?.completedEvents ?? 0} durchgeführt` },
    { icon: "arrow.up.right.circle.fill", label: "Neue Leads (30T)", value: stats?.newLeads30Days ?? 0, color: "#22C55E", sub: `${stats?.totalCampaignLeads ?? 0} via Kampagnen` },
    { icon: "chart.line.uptrend.xyaxis", label: "Marketing ROI", value: `${stats?.roi ?? 0}%`, color: "#F59E0B", sub: `Budget: CHF ${(stats?.totalBudget ?? 0).toLocaleString("de-CH")}` },
    { icon: "star.fill", label: "Kundenstimmen", value: stats?.totalTestimonials ?? 0, color: "#14B8A6", sub: `Ø ${stats?.avgRating ?? 0} ★ · ${stats?.publishedTestimonials ?? 0} publiziert` },
  ];
  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {kpis.map((kpi) => (
          <View key={kpi.label} style={{ flex: 1, minWidth: isWide ? 200 : "47%", backgroundColor: colors.surface, borderRadius: 16, padding: isWide ? 20 : 15, borderWidth: 1, borderColor: colors.border }}>
            <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: kpi.color + "18", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
              <IconSymbol name={kpi.icon as any} size={18} color={kpi.color} />
            </View>
            <Text style={{ fontSize: isWide ? 24 : 22, fontWeight: "800", color: kpi.color }}>{kpi.value}</Text>
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.foreground, marginTop: 2 }}>{kpi.label}</Text>
            <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>{kpi.sub}</Text>
          </View>
        ))}
      </View>
      {stats && stats.totalSpent > 0 && (
        <Card>
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground, marginBottom: 10 }}>💰 Budget & ROI</Text>
          {[
            { label: "Budget gesamt", val: `CHF ${(stats.totalBudget || 0).toLocaleString("de-CH")}`, color: "#8B5CF6" },
            { label: "Ausgegeben", val: `CHF ${(stats.totalSpent || 0).toLocaleString("de-CH")}`, color: PINK },
            { label: "Umsatz generiert", val: `CHF ${(stats.totalRevenue || 0).toLocaleString("de-CH")}`, color: "#22C55E" },
            { label: "ROI gesamt", val: `${stats.roi || 0}%`, color: (stats.roi || 0) >= 0 ? "#22C55E" : "#EF4444" },
          ].map((r) => <TableRow key={r.label} label={r.label} val={r.val} color={r.color} />)}
        </Card>
      )}
      {stats?.channelBreakdown?.length > 0 && (
        <Card>
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground, marginBottom: 12 }}>📡 Aktive Kanäle</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {stats.channelBreakdown.map(({ channel, count }: any) => {
              const color = CHANNEL_COLORS[channel] || "#6B7280";
              return (
                <View key={channel} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: color + "15", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }}>
                  <IconSymbol name={(CHANNEL_ICONS[channel] || "ellipsis.circle.fill") as any} size={13} color={color} />
                  <Text style={{ fontSize: 12, fontWeight: "600", color }}>{CHANNEL_LABELS[channel] || channel} ({count})</Text>
                </View>
              );
            })}
          </View>
        </Card>
      )}
      <View style={{ backgroundColor: PINK + "10", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: PINK + "30", flexDirection: "row", gap: 12 }}>
        <IconSymbol name="lightbulb.fill" size={18} color={PINK} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: PINK, marginBottom: 3 }}>Marketing-Tipp</Text>
          <Text style={{ fontSize: 12, color: "#9CA3AF", lineHeight: 18 }}>Kunden die über 3+ Berührungspunkte erreicht werden, konvertieren bis zu 90% häufiger. Kombinieren Sie Newsletter, Kampagnen und Social Media.</Text>
        </View>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── NEWSLETTER TAB ───────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function NewsletterFormModal({ visible, campaign, onClose, onSuccess }: { visible: boolean; campaign: any; onClose: () => void; onSuccess: () => void }) {
  const colors = useColors();
  const [title, setTitle] = useState(""); const [subject, setSubject] = useState(""); const [content, setContent] = useState(""); const [status, setStatus] = useState("draft"); const [saving, setSaving] = useState(false);
  const [targetCategories, setTargetCategories] = useState<string[]>([]);
  const { data: categories = [] } = useQuery({ queryKey: ["newsletterCategories"], queryFn: Data.getNewsletterCategories });
  const { data: subscribers = [] } = useQuery({ queryKey: ["newsletterSubscribers"], queryFn: Data.getNewsletterSubscribers });
  
  useEffect(() => { if (visible) { 
    setTitle(campaign?.title || ""); setSubject(campaign?.subject || ""); setContent(campaign?.content || ""); setStatus(campaign?.status || "draft"); setTargetCategories(campaign?.target_category_ids || []); 
  } }, [visible, campaign]);
  
  const handleSave = async () => {
    if (!title.trim() || !subject.trim()) { showAlert("Pflichtfelder", "Titel und Betreff sind erforderlich."); return; }
    setSaving(true);
    try {
      const payload = { title, subject, content, status: status === "sent" ? "draft" : status, target_category_ids: targetCategories };
      if (campaign?.id) {
          await Data.updateNewsletterCampaign(campaign.id, payload);
          if (status === "sent") setStatus("draft"); // Prevent accidentally setting to sent via save
      }
      else await Data.createNewsletterCampaign(payload);
      onSuccess(); onClose();
    } catch (e: any) { showAlert("Fehler", e.message); } finally { setSaving(false); }
  };

  const handleSend = async () => {
    if (!title.trim() || !subject.trim()) { showAlert("Pflichtfelder", "Bitte erst Titel und Betreff ausfüllen."); return; }
    
    const activeSubscribers = subscribers.filter((c: any) => c.email && !c.newsletter_opt_out);
    const targetCount = targetCategories.length > 0 
        ? activeSubscribers.filter((s: any) => s.categoryIds?.some((id: string) => targetCategories.includes(id))).length
        : activeSubscribers.length;

    showConfirm("Jetzt versenden", `Möchtest du diesen Newsletter jetzt verbindlich an ca. ${targetCount} Abonnenten versenden?`, async () => {
        setSaving(true);
        try {
           // Speichern & Status auf 'sent' setzen
           const payload = { title, subject, content, status: "sent", target_category_ids: targetCategories };
           let campId = campaign?.id;
           if (campId) {
               await Data.updateNewsletterCampaign(campId, payload);
           } else {
               const newCamp = await Data.createNewsletterCampaign(payload);
               campId = newCamp.id;
           }
           setStatus("sent");
           
           // Edge Function aufrufen
           const res = await Data.sendNewsletterEmail(campId);
           showAlert("Erfolg", `Newsletter wurde erfolgreich an ${res?.sentCount || 0} Abonnenten verschickt!`);
           onSuccess(); 
           onClose();
        } catch(e: any) {
           showAlert("Fehler beim Versand", e.message);
        } finally {
           setSaving(false);
        }
    });
  };
  
  const applyTemplate = (tpl: typeof NEWSLETTER_TEMPLATES[0]) => {
    setTitle(tpl.data.title);
    setSubject(tpl.data.subject);
    setContent(tpl.data.content);
  };

  return (
    <BottomSheet visible={visible} title={campaign?.id ? "Newsletter bearbeiten" : "Neuer Newsletter"} onClose={onClose}>
      {!campaign?.id && (
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.muted, marginBottom: 8, textTransform: "uppercase" }}>VORLAGE WÄHLEN</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
            {NEWSLETTER_TEMPLATES.map((tpl) => (
              <TouchableOpacity key={tpl.label} style={{ alignItems: "center", gap: 5, padding: 10, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, minWidth: 80 }} onPress={() => applyTemplate(tpl)} activeOpacity={0.7}>
                <IconSymbol name={tpl.icon as any} size={22} color="#8B5CF6" />
                <Text style={{ fontSize: 11, fontWeight: "600", color: colors.foreground }}>{tpl.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      <FL label="Titel *" /><SI value={title} onChange={setTitle} placeholder="z.B. April Newsletter 2026" />
      <FL label="Betreff *" /><SI value={subject} onChange={setSubject} placeholder="E-Mail Betreffzeile..." />
      <FL label="Empfänger (Kategorien)" />
      {categories.length > 0 ? (
        <MultiPills values={targetCategories} onChange={setTargetCategories} options={categories.map((c: any) => ({ key: c.id, label: c.name }))} color="#8B5CF6" />
      ) : (
        <Text style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 6 }}>Keine Kategorien vorhanden. Geht an alle aktiven Abonnenten.</Text>
      )}
      <FL label="Inhalt" />
      <View style={{ marginBottom: 12, zIndex: 0, minHeight: 400 }}>
        <NewsletterBuilder value={content} onChange={setContent} />
      </View>
      <FL label="Status" /><Pills value={status} onChange={setStatus} options={[{ key: "draft", label: "Entwurf" }, { key: "scheduled", label: "Geplant" }]} />
      
      <View style={{ flexDirection: "row", gap: 12 }}>
        {status !== "sent" && (
          <View style={{ flex: 1 }}>
            <TouchableOpacity 
               style={{ backgroundColor: "#e6b24a", borderRadius: 14, padding: 16, alignItems: "center", marginTop: 20, opacity: saving ? 0.7 : 1 }}
               onPress={handleSend} disabled={saving} activeOpacity={0.85}
            >
               {saving ? <ActivityIndicator color="#121619" /> : <Text style={{ color: "#121619", fontWeight: "800", fontSize: 16 }}>🚀 Jetzt versenden</Text>}
            </TouchableOpacity>
          </View>
        )}
        <View style={{ flex: 1 }}>
           <SaveBtn onPress={handleSave} loading={saving} label={campaign?.id ? "Speichern" : "Kampagne erstellen"} />
        </View>
      </View>
    </BottomSheet>
  );
}

function NewsletterTab() {
  const colors = useColors(); const queryClient = useQueryClient();
  const [filter, setFilter] = useState("all"); const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState<any>(null);
  const { data: campaigns = [], isLoading } = useQuery({ queryKey: ["newsletterCampaigns"], queryFn: Data.getNewsletterCampaigns });
  const deleteMutation = useMutation({ mutationFn: (id: string) => Data.deleteNewsletterCampaign(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["newsletterCampaigns"] }) });
  const slColor: Record<string, string> = { draft: colors.muted, scheduled: "#F59E0B", sent: "#22C55E" };
  const slLabel: Record<string, string> = { draft: "Entwurf", scheduled: "Geplant", sent: "Versendet" };
  const filtered = filter === "all" ? campaigns : campaigns.filter((c: any) => c.status === filter);
  const sent = campaigns.filter((c: any) => c.status === "sent");
  const totalSent = sent.reduce((s: number, c: any) => s + (c.recipients_count || 0), 0);
  const avgOpen = sent.length > 0 ? Math.round(sent.reduce((s: number, c: any) => s + (c.recipients_count > 0 ? (c.opened_count / c.recipients_count) * 100 : 0), 0) / sent.length) : 0;
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <MiniStat label="Kampagnen" val={campaigns.length} color={PINK} />
        <MiniStat label="Versendet" val={sent.length} color="#22C55E" />
        <MiniStat label="Empfänger" val={totalSent.toLocaleString("de-CH")} color="#8B5CF6" />
        <MiniStat label="Ø Öffnungsrate" val={`${avgOpen}%`} color="#0EA5E9" />
      </View>
      <Pills value={filter} onChange={setFilter} options={[{ key: "all", label: `Alle (${campaigns.length})` }, { key: "draft", label: "Entwurf" }, { key: "scheduled", label: "Geplant" }, { key: "sent", label: "Versendet" }]} />
      <SectionButton label="Neuer Newsletter" onPress={() => { setEditing(null); setShowForm(true); }} />
      {isLoading && <View style={{ paddingVertical: 40, alignItems: "center" }}><ActivityIndicator size="large" color={PINK} /></View>}
      {!isLoading && filtered.length === 0 && <EmptyState icon="envelope.fill" title="Keine Newsletter" sub="Erstellen Sie Ihre erste E-Mail-Kampagne" />}
      {filtered.map((c: any) => (
        <Card key={c.id}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }} numberOfLines={1}>{c.title}</Text>
              <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }} numberOfLines={1}>{c.subject}</Text>
            </View>
            <Badge label={slLabel[c.status] || c.status} color={slColor[c.status] || colors.muted} />
          </View>
          {c.status === "sent" && (
            <View style={{ flexDirection: "row", gap: 10, backgroundColor: colors.background, borderRadius: 10, padding: 10, marginBottom: 10 }}>
              {[{ l: "Empfänger", v: c.recipients_count ?? 0, co: "#8B5CF6" }, { l: "Öffnungsrate", v: `${c.recipients_count > 0 ? Math.round(((c.opened_count ?? 0) / c.recipients_count) * 100) : 0}%`, co: "#0EA5E9" }, { l: "Klickrate", v: `${c.recipients_count > 0 ? Math.round(((c.clicked_count ?? 0) / c.recipients_count) * 100) : 0}%`, co: "#22C55E" }].map((s) => (
                <View key={s.l} style={{ flex: 1, alignItems: "center" }}>
                  <Text style={{ fontSize: 15, fontWeight: "800", color: s.co }}>{s.v}</Text>
                  <Text style={{ fontSize: 10, color: colors.muted }}>{s.l}</Text>
                </View>
              ))}
            </View>
          )}
          <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 10 }}>{c.sent_at ? `Versendet ${formatDate(c.sent_at)}` : c.scheduled_at ? `Geplant ${formatDate(c.scheduled_at)}` : `Erstellt ${formatDate(c.created_at)}`}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity style={{ flex: 1, borderRadius: 10, paddingVertical: 8, backgroundColor: PINK + "18", alignItems: "center" }} onPress={() => { setEditing(c); setShowForm(true); }}><Text style={{ fontSize: 13, fontWeight: "600", color: PINK }}>Bearbeiten</Text></TouchableOpacity>
            <TouchableOpacity style={{ flex: 1, borderRadius: 10, paddingVertical: 8, backgroundColor: colors.error + "18", alignItems: "center" }} onPress={() => showConfirm("Löschen", `"${c.title}" löschen?`, () => deleteMutation.mutate(c.id))}><Text style={{ fontSize: 13, fontWeight: "600", color: colors.error }}>Löschen</Text></TouchableOpacity>
          </View>
        </Card>
      ))}
      {/* Kategorien */}
      <NewsletterCategoriesSection />
      {/* Abonnenten */}
      <NewsletterSubscribersSection />
      <NewsletterFormModal visible={showForm} campaign={editing} onClose={() => setShowForm(false)} onSuccess={() => queryClient.invalidateQueries({ queryKey: ["newsletterCampaigns"] })} />
    </View>
  );
}

function NewsletterCategoriesSection() {
  const colors = useColors(); const [expanded, setExpanded] = useState(false); const [newName, setNewName] = useState("");
  const queryClient = useQueryClient();
  const { data: categories = [], isLoading } = useQuery({ queryKey: ["newsletterCategories"], queryFn: Data.getNewsletterCategories });
  const createMutation = useMutation({ mutationFn: (name: string) => Data.createNewsletterCategory(name), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["newsletterCategories"] }); setNewName(""); } });
  const deleteMutation = useMutation({ mutationFn: (id: string) => Data.deleteNewsletterCategory(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["newsletterCategories"] }) });
  
  return (
    <Card style={{ marginBottom: 16 }}>
      <TouchableOpacity style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }} onPress={() => setExpanded(!expanded)}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <IconSymbol name="folder.fill" size={16} color="#8B5CF6" />
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>Kategorien / Zielgruppen</Text>
          <Badge label={categories.length.toString()} color="#8B5CF6" />
        </View>
        <IconSymbol name={expanded ? "chevron.up" : "chevron.down"} size={16} color={colors.muted} />
      </TouchableOpacity>
      {expanded && (
        <View style={{ marginTop: 14, gap: 10 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}><SI value={newName} onChange={setNewName} placeholder="Neue Kategorie..." /></View>
            <TouchableOpacity style={{ backgroundColor: "#8B5CF6", borderRadius: 10, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" }} onPress={() => { if (newName.trim()) createMutation.mutate(newName); }} disabled={createMutation.isPending}><Text style={{ color: "#fff", fontWeight: "700" }}>Hinzufügen</Text></TouchableOpacity>
          </View>
          {isLoading && <ActivityIndicator size="small" color="#8B5CF6" />}
          {categories.map((c: any) => (
            <View key={c.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: colors.background, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }}>{c.name}</Text>
              <TouchableOpacity onPress={() => showConfirm("Löschen", `Kategorie "${c.name}" wirklich löschen?`, () => deleteMutation.mutate(c.id))}><IconSymbol name="trash" size={15} color={colors.error} /></TouchableOpacity>
            </View>
          ))}
          {categories.length === 0 && !isLoading && <Text style={{ fontSize: 12, color: colors.muted, textAlign: "center", paddingVertical: 10 }}>Bisher keine Kategorien angelegt.</Text>}
        </View>
      )}
    </Card>
  );
}

function NewsletterSubscribersSection() {
  const colors = useColors(); const [search, setSearch] = useState(""); const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();
  const { data: subscribers = [], isLoading } = useQuery({ queryKey: ["newsletterSubscribers"], queryFn: Data.getNewsletterSubscribers });
  const { data: categories = [] } = useQuery({ queryKey: ["newsletterCategories"], queryFn: Data.getNewsletterCategories });
  const updateCatMutation = useMutation({ mutationFn: ({ id, cats }: { id: string, cats: string[] }) => Data.setCustomerNewsletterCategories(id, cats), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["newsletterSubscribers"] }) });
  const toggleOptOutMutation = useMutation({ mutationFn: ({ id, optOut }: { id: string, optOut: boolean }) => Data.setCustomerNewsletterOptOut(id, optOut), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["newsletterSubscribers"] }) });
  
  const filtered = subscribers.filter((s: any) => { const q = search.toLowerCase(); return (s.company_name || "").toLowerCase().includes(q) || (s.email || "").toLowerCase().includes(q); });
  const getName = (s: any) => s.company_name || `${s.first_name || ""} ${s.last_name || ""}`.trim() || "Unbekannt";
  
  return (
    <Card>
      <TouchableOpacity style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }} onPress={() => setExpanded(!expanded)}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <IconSymbol name="person.2.fill" size={16} color={PINK} />
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>Abonnenten</Text>
          <View style={{ backgroundColor: PINK + "20", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ fontSize: 12, fontWeight: "700", color: PINK }}>{subscribers.length}</Text></View>
        </View>
        <IconSymbol name={expanded ? "chevron.up" : "chevron.down"} size={16} color={colors.muted} />
      </TouchableOpacity>
      {expanded && (
        <View style={{ marginTop: 14, gap: 10 }}>
          <View style={{ flexDirection: "row", backgroundColor: colors.background, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: colors.border, alignItems: "center", gap: 8 }}>
            <IconSymbol name="magnifyingglass" size={15} color={colors.muted} />
            <TextInput style={{ flex: 1, fontSize: 13, color: colors.foreground }} placeholder="Suchen..." placeholderTextColor={colors.muted} value={search} onChangeText={setSearch} />
          </View>
          {isLoading && <ActivityIndicator size="small" color={PINK} />}
          {filtered.slice(0, 20).map((s: any) => (
            <View key={s.id} style={{ backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 10, gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, opacity: s.newsletter_opt_out ? 0.5 : 1 }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: s.newsletter_opt_out ? colors.muted + "40" : PINK + "20", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: s.newsletter_opt_out ? colors.muted : PINK }}>{getName(s).charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }} numberOfLines={1}>
                    {getName(s)}
                    {s.newsletter_opt_out && <Text style={{ color: colors.error, fontSize: 11 }}> (Abgemeldet)</Text>}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.muted }} numberOfLines={1}>{s.email}</Text>
                </View>
                <TouchableOpacity 
                   onPress={() => toggleOptOutMutation.mutate({ id: s.id, optOut: !s.newsletter_opt_out })}
                   style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: s.newsletter_opt_out ? PINK + '1A' : colors.error + '1A', borderRadius: 6 }}
                >
                   <Text style={{ fontSize: 11, fontWeight: '700', color: s.newsletter_opt_out ? PINK : colors.error }}>{s.newsletter_opt_out ? "Aktivieren" : "Deaktivieren"}</Text>
                </TouchableOpacity>
              </View>
              {!s.newsletter_opt_out && categories.length > 0 && (
                <View style={{ paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.border }}>
                  <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 6 }}>Kategorien:</Text>
                  <MultiPills values={s.categoryIds || []} onChange={(newCats) => updateCatMutation.mutate({ id: s.id, cats: newCats })} options={categories.map((c: any) => ({ key: c.id, label: c.name }))} color="#8B5CF6" />
                </View>
              )}
            </View>
          ))}
          {filtered.length > 20 && <Text style={{ fontSize: 12, color: colors.muted, textAlign: "center" }}>+ {filtered.length - 20} weitere</Text>}
        </View>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── KAMPAGNEN TAB ────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function CampaignFormModal({ visible, campaign, onClose, onSuccess }: { visible: boolean; campaign: any; onClose: () => void; onSuccess: () => void }) {
  const colors = useColors();
  const [title, setTitle] = useState(""); const [channel, setChannel] = useState("google_ads"); const [status, setStatus] = useState("planned");
  const [budget, setBudget] = useState(""); const [spent, setSpent] = useState(""); const [leadsGenerated, setLeadsGenerated] = useState(""); const [revenueGenerated, setRevenueGenerated] = useState("");
  const [startDate, setStartDate] = useState(""); const [endDate, setEndDate] = useState(""); const [description, setDescription] = useState(""); const [goal, setGoal] = useState("leads");
  const [saving, setSaving] = useState(false); const [showChecklist, setShowChecklist] = useState(false);
  useEffect(() => {
    if (visible) {
      setTitle(campaign?.title || ""); setChannel(campaign?.channel || "google_ads"); setStatus(campaign?.status || "planned");
      setBudget(campaign?.budget?.toString() || ""); setSpent(campaign?.spent?.toString() || "");
      setLeadsGenerated(campaign?.leads_generated?.toString() || ""); setRevenueGenerated(campaign?.revenue_generated?.toString() || "");
      setStartDate(campaign?.start_date || ""); setEndDate(campaign?.end_date || ""); setDescription(campaign?.description || ""); setGoal(campaign?.goal || "leads"); setShowChecklist(false);
    }
  }, [visible, campaign]);
  const applyTemplate = (tpl: typeof CAMPAIGN_TEMPLATES[0]) => { setChannel(tpl.data.channel); setGoal(tpl.data.goal); if (!title) setTitle(tpl.data.title); if (!description) setDescription(tpl.data.description); };
  const handleSave = async () => {
    if (!title.trim()) { showAlert("Pflichtfeld", "Bitte einen Titel angeben."); return; }
    setSaving(true);
    try {
      const p = { title, channel, status, budget: budget ? parseFloat(budget) : null, spent: spent ? parseFloat(spent) : 0, leads_generated: leadsGenerated ? parseInt(leadsGenerated) : 0, revenue_generated: revenueGenerated ? parseFloat(revenueGenerated) : 0, start_date: startDate || null, end_date: endDate || null, description, goal };
      if (campaign?.id) await Data.updateMarketingCampaign(campaign.id, p); else await Data.createMarketingCampaign(p);
      onSuccess(); onClose();
    } catch (e: any) { showAlert("Fehler", e.message); } finally { setSaving(false); }
  };
  const tip = CHANNEL_TIPS[channel]; const chColor = CHANNEL_COLORS[channel] || "#6B7280";
  const channelOptions = Object.entries(CHANNEL_LABELS).map(([k, l]) => ({ key: k, label: l }));
  return (
    <BottomSheet visible={visible} title={campaign?.id ? "Kampagne bearbeiten" : "Neue Kampagne"} onClose={onClose}>
      {!campaign?.id && (
        <View style={{ marginBottom: 4 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.muted, marginBottom: 8, textTransform: "uppercase" }}>SCHNELLSTART: VORLAGE WÄHLEN</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
            {CAMPAIGN_TEMPLATES.map((tpl) => (
              <TouchableOpacity key={tpl.label} style={{ alignItems: "center", gap: 5, padding: 10, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: channel === tpl.data.channel ? (CHANNEL_COLORS[tpl.data.channel] || PINK) : colors.border, minWidth: 68 }} onPress={() => applyTemplate(tpl)} activeOpacity={0.7}>
                <IconSymbol name={tpl.icon as any} size={22} color={CHANNEL_COLORS[tpl.data.channel] || "#6B7280"} />
                <Text style={{ fontSize: 11, fontWeight: "600", color: colors.foreground, textAlign: "center" }}>{tpl.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={{ height: 1, backgroundColor: colors.border, marginTop: 14, marginBottom: 4 }} />
        </View>
      )}
      <FL label="Titel *" /><SI value={title} onChange={setTitle} placeholder="z.B. Google Ads Spring 2026" />
      <FL label="Kanal" /><Pills value={channel} onChange={setChannel} options={channelOptions} />
      {tip && (
        <View style={{ marginTop: 10, backgroundColor: chColor + "12", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: chColor + "30" }}>
          <View style={{ flexDirection: "row", gap: 8 }}><IconSymbol name="lightbulb.fill" size={14} color={chColor} /><Text style={{ flex: 1, fontSize: 12, color: chColor, lineHeight: 18 }}>{tip.tip}</Text></View>
          {tip.typicalBudget && <Text style={{ fontSize: 11, color: chColor, fontWeight: "600", marginTop: 6 }}>💰 Typisches Budget: {tip.typicalBudget}</Text>}
          <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }} onPress={() => setShowChecklist(!showChecklist)}>
            <IconSymbol name="checklist" size={13} color={chColor} />
            <Text style={{ fontSize: 12, color: chColor, fontWeight: "700" }}>{showChecklist ? "Checkliste ausblenden" : `Checkliste (${tip.checklist.length} Punkte)`}</Text>
          </TouchableOpacity>
          {showChecklist && <View style={{ marginTop: 8, gap: 5 }}>
            {tip.checklist.map((item, i) => (
              <View key={i} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: chColor, alignItems: "center", justifyContent: "center", marginTop: 1 }}><Text style={{ fontSize: 9, fontWeight: "800", color: chColor }}>{i + 1}</Text></View>
                <Text style={{ flex: 1, fontSize: 12, color: colors.foreground, lineHeight: 18 }}>{item}</Text>
              </View>
            ))}
          </View>}
        </View>
      )}
      <FL label="Status" /><Pills value={status} onChange={setStatus} options={Object.entries(CAMPAIGN_STATUS_LABEL).map(([k, l]) => ({ key: k, label: l }))} />
      <FL label="Kampagnenziel" /><Pills value={goal} onChange={setGoal} options={[{ key: "awareness", label: "Bekanntheit" }, { key: "leads", label: "Leads" }, { key: "sales", label: "Umsatz" }, { key: "retention", label: "Kundenbindung" }]} />
      <FL label="Budget (CHF)" /><SI value={budget} onChange={setBudget} placeholder={tip?.typicalBudget ? `Empfehlung: ${tip.typicalBudget}` : "0.00"} keyboardType="numeric" />
      <FL label="Bereits ausgegeben (CHF)" /><SI value={spent} onChange={setSpent} placeholder="0.00" keyboardType="numeric" />
      <FL label="Generieter Umsatz (CHF)" /><SI value={revenueGenerated} onChange={setRevenueGenerated} placeholder="0.00" keyboardType="numeric" />
      <FL label="Generierte Leads" /><SI value={leadsGenerated} onChange={setLeadsGenerated} placeholder="0" keyboardType="numeric" />
      <FL label="Startdatum (JJJJ-MM-TT)" /><SI value={startDate} onChange={setStartDate} placeholder="2026-04-01" />
      <FL label="Enddatum (JJJJ-MM-TT)" /><SI value={endDate} onChange={setEndDate} placeholder="2026-06-30" />
      <FL label="Beschreibung / Zielgruppe" /><SI value={description} onChange={setDescription} placeholder="Zielgruppe, Massnahmen, Besonderheiten..." multiline />
      <SaveBtn onPress={handleSave} loading={saving} label={campaign?.id ? "Speichern" : "Kampagne erstellen"} />
    </BottomSheet>
  );
}

function UTMGenerator() {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const [url, setUrl] = useState("https://gross-ict.ch");
  const [source, setSource] = useState(""); const [medium, setMedium] = useState(""); const [campaign, setCampaign] = useState(""); const [content, setContent] = useState(""); const [term, setTerm] = useState("");
  const [copied, setCopied] = useState(false);

  const buildUrl = () => {
    const params: string[] = [];
    if (source) params.push(`utm_source=${encodeURIComponent(source)}`);
    if (medium) params.push(`utm_medium=${encodeURIComponent(medium)}`);
    if (campaign) params.push(`utm_campaign=${encodeURIComponent(campaign)}`);
    if (content) params.push(`utm_content=${encodeURIComponent(content)}`);
    if (term) params.push(`utm_term=${encodeURIComponent(term)}`);
    return params.length > 0 ? `${url}?${params.join("&")}` : url;
  };

  const generatedUrl = buildUrl();
  const isValid = url && source && medium && campaign;

  const handleCopy = async () => {
    if (!isValid) { showAlert("Unvollständig", "Bitte URL, Source, Medium und Campaign ausfüllen."); return; }
    try {
      await Share.share({ message: generatedUrl, url: generatedUrl });
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (_) {}
  };


  return (
    <Card>
      <TouchableOpacity style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }} onPress={() => setExpanded(!expanded)}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: "#0EA5E918", alignItems: "center", justifyContent: "center" }}>
            <IconSymbol name="link.badge.plus" size={16} color="#0EA5E9" />
          </View>
          <View>
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>UTM-Link Generator</Text>
            <Text style={{ fontSize: 11, color: colors.muted }}>Tracking-Links für Kampagnen erstellen</Text>
          </View>
        </View>
        <IconSymbol name={expanded ? "chevron.up" : "chevron.down"} size={16} color={colors.muted} />
      </TouchableOpacity>
      {expanded && (
        <View style={{ marginTop: 14, gap: 8 }}>
          <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 4 }}>UTM-Parameter messen, woher Besucher auf Ihre Website kommen.</Text>
          {[
            { label: "Website URL *", ph: "https://gross-ict.ch", val: url, set: setUrl },
            { label: "Source * (z.B. google, linkedin)", ph: "google", val: source, set: setSource },
            { label: "Medium * (z.B. cpc, email, social)", ph: "cpc", val: medium, set: setMedium },
            { label: "Campaign * (z.B. spring-2026)", ph: "spring-2026", val: campaign, set: setCampaign },
            { label: "Content (zur A/B-Unterscheidung)", ph: "banner-v1", val: content, set: setContent },
            { label: "Term (Keyword bei SEM)", ph: "it-support-schweiz", val: term, set: setTerm },
          ].map((f) => (
            <View key={f.label}>
              <Text style={{ fontSize: 11, fontWeight: "600", color: colors.muted, marginBottom: 4 }}>{f.label}</Text>
              <TextInput style={{ backgroundColor: colors.background, borderRadius: 8, borderWidth: 1, borderColor: colors.border, color: colors.foreground, padding: 10, fontSize: 13 }} placeholder={f.ph} placeholderTextColor={colors.muted} value={f.val} onChangeText={f.set} autoCapitalize="none" />
            </View>
          ))}
          {/* Preview */}
          <View style={{ backgroundColor: colors.background, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: isValid ? "#0EA5E9" : colors.border, marginTop: 4 }}>
            <Text style={{ fontSize: 10, fontWeight: "700", color: isValid ? "#0EA5E9" : colors.muted, marginBottom: 4 }}>GENERIERTER LINK</Text>
            <Text style={{ fontSize: 11, color: isValid ? colors.foreground : colors.muted, lineHeight: 16 }} selectable>{generatedUrl}</Text>
          </View>
          <TouchableOpacity
            style={{ backgroundColor: copied ? "#22C55E" : "#0EA5E9", borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 }}
            onPress={handleCopy} activeOpacity={0.8}
          >
            <IconSymbol name={copied ? "checkmark.circle.fill" : "doc.on.doc.fill"} size={16} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{copied ? "Kopiert!" : "Link kopieren"}</Text>
          </TouchableOpacity>
        </View>
      )}
    </Card>
  );
}

function CampaignsTab() {
  const colors = useColors(); const queryClient = useQueryClient();
  const [filterChannel, setFilterChannel] = useState("all"); const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState<any>(null);
  const { data: campaigns = [], isLoading } = useQuery({ queryKey: ["marketingCampaigns"], queryFn: Data.getMarketingCampaigns });
  const deleteMutation = useMutation({ mutationFn: (id: string) => Data.deleteMarketingCampaign(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["marketingCampaigns"] }) });
  const channelFilters = [{ key: "all", label: "Alle" }, ...Object.entries(CHANNEL_LABELS).map(([k, v]) => ({ key: k, label: v }))];
  const filtered = filterChannel === "all" ? campaigns : campaigns.filter((c: any) => c.channel === filterChannel);
  const totalBudget = campaigns.reduce((s: number, c: any) => s + (c.budget || 0), 0);
  const totalSpent = campaigns.reduce((s: number, c: any) => s + (c.spent || 0), 0);
  const totalRevenue = campaigns.reduce((s: number, c: any) => s + (c.revenue_generated || 0), 0);
  const roi = totalSpent > 0 ? Math.round(((totalRevenue - totalSpent) / totalSpent) * 100) : 0;
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <MiniStat label="Budget" val={`CHF ${totalBudget.toLocaleString("de-CH")}`} color="#8B5CF6" />
        <MiniStat label="Ausgaben" val={`CHF ${totalSpent.toLocaleString("de-CH")}`} color={PINK} />
        <MiniStat label="Umsatz" val={`CHF ${totalRevenue.toLocaleString("de-CH")}`} color="#22C55E" />
        <MiniStat label="ROI" val={`${roi}%`} color={roi >= 0 ? "#22C55E" : "#EF4444"} />
      </View>
      <Pills value={filterChannel} onChange={setFilterChannel} options={channelFilters} />
      <SectionButton label="Neue Kampagne" onPress={() => { setEditing(null); setShowForm(true); }} />
      {isLoading && <View style={{ paddingVertical: 40, alignItems: "center" }}><ActivityIndicator size="large" color={PINK} /></View>}
      {!isLoading && filtered.length === 0 && <EmptyState icon="megaphone.fill" title="Keine Kampagnen" sub="Erfassen Sie Ihre Marketing-Aktivitäten kanalübergreifend" />}
      {filtered.map((c: any) => {
        const chColor = CHANNEL_COLORS[c.channel] || "#6B7280"; const chLabel = CHANNEL_LABELS[c.channel] || c.channel; const chIcon = CHANNEL_ICONS[c.channel] || "ellipsis.circle.fill";
        const cRoi = c.spent > 0 ? Math.round(((c.revenue_generated - c.spent) / c.spent) * 100) : null;
        return (
          <Card key={c.id}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: chColor + "18", alignItems: "center", justifyContent: "center" }}><IconSymbol name={chIcon as any} size={18} color={chColor} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }} numberOfLines={1}>{c.title}</Text>
                <Text style={{ fontSize: 11, fontWeight: "600", color: chColor }}>{chLabel}</Text>
              </View>
              <Badge label={CAMPAIGN_STATUS_LABEL[c.status] || c.status} color={CAMPAIGN_STATUS_COLOR[c.status] || "#6B7280"} />
            </View>
            <View style={{ flexDirection: "row", gap: 8, backgroundColor: colors.background, borderRadius: 10, padding: 10, marginBottom: 10 }}>
              {[{ l: "Budget", v: c.budget ? `CHF ${Number(c.budget).toLocaleString("de-CH")}` : "–", co: "#8B5CF6" }, { l: "Leads", v: c.leads_generated || 0, co: "#22C55E" }, cRoi !== null ? { l: "ROI", v: `${cRoi}%`, co: cRoi >= 0 ? "#22C55E" : "#EF4444" } : { l: "Umsatz", v: c.revenue_generated ? `CHF ${Number(c.revenue_generated).toLocaleString("de-CH")}` : "–", co: "#F59E0B" }].map((m) => (
                <View key={m.l} style={{ flex: 1, alignItems: "center" }}><Text style={{ fontSize: 14, fontWeight: "800", color: m.co }}>{m.v}</Text><Text style={{ fontSize: 10, color: colors.muted }}>{m.l}</Text></View>
              ))}
            </View>
            {c.start_date && <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 8 }}>{formatDate(c.start_date)}{c.end_date ? ` – ${formatDate(c.end_date)}` : ""}</Text>}
            {c.description ? <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 10 }} numberOfLines={2}>{c.description}</Text> : null}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity style={{ flex: 1, borderRadius: 10, paddingVertical: 8, backgroundColor: PINK + "18", alignItems: "center" }} onPress={() => { setEditing(c); setShowForm(true); }}><Text style={{ fontSize: 13, fontWeight: "600", color: PINK }}>Bearbeiten</Text></TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, borderRadius: 10, paddingVertical: 8, backgroundColor: colors.error + "18", alignItems: "center" }} onPress={() => showConfirm("Löschen", `"${c.title}" löschen?`, () => deleteMutation.mutate(c.id))}><Text style={{ fontSize: 13, fontWeight: "600", color: colors.error }}>Löschen</Text></TouchableOpacity>
            </View>
          </Card>
        );
      })}
      {/* UTM Generator */}
      <UTMGenerator />
      <CampaignFormModal visible={showForm} campaign={editing} onClose={() => setShowForm(false)} onSuccess={() => queryClient.invalidateQueries({ queryKey: ["marketingCampaigns"] })} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── EVENTS TAB ───────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function EventFormModal({ visible, event, onClose, onSuccess }: { visible: boolean; event: any; onClose: () => void; onSuccess: () => void }) {
  const [title, setTitle] = useState(""); const [eventType, setEventType] = useState("messe"); const [status, setStatus] = useState("planned");
  const [eventDate, setEventDate] = useState(""); const [location, setLocation] = useState(""); const [description, setDescription] = useState("");
  const [budget, setBudget] = useState(""); const [attendeesExpected, setAttendeesExpected] = useState(""); const [leadsGenerated, setLeadsGenerated] = useState(""); const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (visible) { setTitle(event?.title || ""); setEventType(event?.event_type || "messe"); setStatus(event?.status || "planned"); setEventDate(event?.event_date || ""); setLocation(event?.location || ""); setDescription(event?.description || ""); setBudget(event?.budget?.toString() || ""); setAttendeesExpected(event?.attendees_expected?.toString() || ""); setLeadsGenerated(event?.leads_generated?.toString() || ""); }
  }, [visible, event]);
  const handleSave = async () => {
    if (!title.trim() || !eventDate.trim()) { showAlert("Pflichtfelder", "Titel und Datum sind erforderlich."); return; }
    setSaving(true);
    try {
      const p = { title, event_type: eventType, status, event_date: eventDate, location, description, budget: budget ? parseFloat(budget) : null, attendees_expected: attendeesExpected ? parseInt(attendeesExpected) : 0, leads_generated: leadsGenerated ? parseInt(leadsGenerated) : 0 };
      if (event?.id) await Data.updateMarketingEvent(event.id, p); else await Data.createMarketingEvent(p);
      onSuccess(); onClose();
    } catch (e: any) { showAlert("Fehler", e.message); } finally { setSaving(false); }
  };
  return (
    <BottomSheet visible={visible} title={event?.id ? "Veranstaltung bearbeiten" : "Neue Veranstaltung"} onClose={onClose}>
      <FL label="Titel *" /><SI value={title} onChange={setTitle} placeholder="z.B. IT-Messe Zürich 2026" />
      <FL label="Typ" /><Pills value={eventType} onChange={setEventType} options={Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => ({ key: k, label: v }))} />
      <FL label="Status" /><Pills value={status} onChange={setStatus} options={[{ key: "planned", label: "Geplant" }, { key: "active", label: "Laufend" }, { key: "completed", label: "Abgeschlossen" }, { key: "cancelled", label: "Abgesagt" }]} />
      <FL label="Datum * (JJJJ-MM-TT)" /><SI value={eventDate} onChange={setEventDate} placeholder="2026-05-15" />
      <FL label="Ort" /><SI value={location} onChange={setLocation} placeholder="Zürich, Messe Zürich Halle 5" />
      <FL label="Budget (CHF)" /><SI value={budget} onChange={setBudget} placeholder="0.00" keyboardType="numeric" />
      <FL label="Erwartete Teilnehmer" /><SI value={attendeesExpected} onChange={setAttendeesExpected} placeholder="0" keyboardType="numeric" />
      <FL label="Generierte Leads" /><SI value={leadsGenerated} onChange={setLeadsGenerated} placeholder="0" keyboardType="numeric" />
      <FL label="Beschreibung" /><SI value={description} onChange={setDescription} placeholder="Ziele, Aussteller, Agenda..." multiline />
      <SaveBtn onPress={handleSave} loading={saving} label={event?.id ? "Speichern" : "Veranstaltung erstellen"} />
    </BottomSheet>
  );
}

function EventsTab() {
  const colors = useColors(); const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState<any>(null); const [filterStatus, setFilterStatus] = useState("all");
  const { data: events = [], isLoading } = useQuery({ queryKey: ["marketingEvents"], queryFn: Data.getMarketingEvents });
  const deleteMutation = useMutation({ mutationFn: (id: string) => Data.deleteMarketingEvent(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["marketingEvents"] }) });
  const now = new Date();
  const filterOptions = [{ key: "all", label: "Alle" }, { key: "planned", label: "Geplant" }, { key: "active", label: "Laufend" }, { key: "completed", label: "Abgeschlossen" }, { key: "cancelled", label: "Abgesagt" }];
  const filtered = filterStatus === "all" ? events : events.filter((e: any) => e.status === filterStatus);
  const eventStatusColor: Record<string, string> = { planned: "#F59E0B", active: "#22C55E", completed: "#0EA5E9", cancelled: "#EF4444" };
  const eventStatusLabel: Record<string, string> = { planned: "Geplant", active: "Laufend", completed: "Abgeschlossen", cancelled: "Abgesagt" };
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <MiniStat label="Bevorstehend" val={events.filter((e: any) => e.status === "planned" && new Date(e.event_date) >= now).length} color="#F59E0B" />
        <MiniStat label="Gesamt" val={events.length} color={PINK} />
        <MiniStat label="Leads generiert" val={events.reduce((s: number, e: any) => s + (e.leads_generated || 0), 0)} color="#22C55E" />
      </View>
      <Pills value={filterStatus} onChange={setFilterStatus} options={filterOptions} />
      <SectionButton label="Neue Veranstaltung" onPress={() => { setEditing(null); setShowForm(true); }} />
      {isLoading && <View style={{ paddingVertical: 40, alignItems: "center" }}><ActivityIndicator size="large" color={PINK} /></View>}
      {!isLoading && filtered.length === 0 && <EmptyState icon="calendar" title="Keine Veranstaltungen" sub="Erfassen Sie Messen, Webinare und Events" />}
      {filtered.map((e: any) => {
        const evColor = eventStatusColor[e.status] || "#6B7280"; const evIcon = EVENT_TYPE_ICONS[e.event_type] || "calendar"; const evLabel = EVENT_TYPE_LABELS[e.event_type] || e.event_type;
        const isPast = new Date(e.event_date) < now && e.status === "planned";
        return (
          <Card key={e.id}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: evColor + "18", alignItems: "center", justifyContent: "center" }}><IconSymbol name={evIcon as any} size={18} color={evColor} /></View>
              <View style={{ flex: 1 }}><Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }} numberOfLines={1}>{e.title}</Text><Text style={{ fontSize: 11, color: colors.muted }}>{evLabel}{e.location ? ` · ${e.location}` : ""}</Text></View>
              <Badge label={eventStatusLabel[e.status] || e.status} color={evColor} />
            </View>
            <View style={{ flexDirection: "row", gap: 8, backgroundColor: colors.background, borderRadius: 10, padding: 10, marginBottom: 10 }}>
              {[{ l: "Datum", v: formatDate(e.event_date), co: "#0EA5E9" }, { l: "Teilnehmer", v: e.attendees_expected || "–", co: "#8B5CF6" }, { l: "Leads", v: e.leads_generated || 0, co: "#22C55E" }].map((m) => (
                <View key={m.l} style={{ flex: 1, alignItems: "center" }}><Text style={{ fontSize: 13, fontWeight: "700", color: m.co }}>{m.v}</Text><Text style={{ fontSize: 10, color: colors.muted }}>{m.l}</Text></View>
              ))}
            </View>
            {isPast && <View style={{ backgroundColor: "#F59E0B18", borderRadius: 8, padding: 8, marginBottom: 10, flexDirection: "row", gap: 6, alignItems: "center" }}><IconSymbol name="exclamationmark.triangle.fill" size={13} color="#F59E0B" /><Text style={{ fontSize: 11, color: "#F59E0B", fontWeight: "600", flex: 1 }}>Veranstaltung liegt in der Vergangenheit – bitte Status aktualisieren.</Text></View>}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity style={{ flex: 1, borderRadius: 10, paddingVertical: 8, backgroundColor: PINK + "18", alignItems: "center" }} onPress={() => { setEditing(e); setShowForm(true); }}><Text style={{ fontSize: 13, fontWeight: "600", color: PINK }}>Bearbeiten</Text></TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, borderRadius: 10, paddingVertical: 8, backgroundColor: colors.error + "18", alignItems: "center" }} onPress={() => showConfirm("Löschen", `"${e.title}" löschen?`, () => deleteMutation.mutate(e.id))}><Text style={{ fontSize: 13, fontWeight: "600", color: colors.error }}>Löschen</Text></TouchableOpacity>
            </View>
          </Card>
        );
      })}
      <EventFormModal visible={showForm} event={editing} onClose={() => setShowForm(false)} onSuccess={() => queryClient.invalidateQueries({ queryKey: ["marketingEvents"] })} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── TESTIMONIALS TAB ─────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function TestimonialFormModal({ visible, testimonial, onClose, onSuccess }: { visible: boolean; testimonial: any; onClose: () => void; onSuccess: () => void }) {
  const colors = useColors();
  const [customerName, setCustomerName] = useState(""); const [company, setCompany] = useState(""); const [role, setRole] = useState("");
  const [text, setText] = useState(""); const [rating, setRating] = useState(5); const [isPublished, setIsPublished] = useState(false);
  const [forWebsite, setForWebsite] = useState(false); const [category, setCategory] = useState("allgemein"); const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (visible) { setCustomerName(testimonial?.customer_name || ""); setCompany(testimonial?.company || ""); setRole(testimonial?.role || ""); setText(testimonial?.testimonial_text || ""); setRating(testimonial?.rating ?? 5); setIsPublished(testimonial?.is_published ?? false); setForWebsite(testimonial?.use_for_website ?? false); setCategory(testimonial?.category || "allgemein"); }
  }, [visible, testimonial]);
  const handleSave = async () => {
    if (!customerName.trim() || !text.trim()) { showAlert("Pflichtfelder", "Name und Text sind erforderlich."); return; }
    setSaving(true);
    try {
      const p = { customer_name: customerName, company, role, testimonial_text: text, rating, is_published: isPublished, use_for_website: forWebsite, category };
      if (testimonial?.id) await Data.updateTestimonial(testimonial.id, p); else await Data.createTestimonial(p);
      onSuccess(); onClose();
    } catch (e: any) { showAlert("Fehler", e.message); } finally { setSaving(false); }
  };
  return (
    <BottomSheet visible={visible} title={testimonial?.id ? "Kundenstimme bearbeiten" : "Neue Kundenstimme"} onClose={onClose}>
      <FL label="Name *" /><SI value={customerName} onChange={setCustomerName} placeholder="Max Mustermann" />
      <FL label="Firma" /><SI value={company} onChange={setCompany} placeholder="Musterfirma AG" />
      <FL label="Position" /><SI value={role} onChange={setRole} placeholder="IT-Leiter" />
      <FL label="Kategorie" /><Pills value={category} onChange={setCategory} options={[{ key: "allgemein", label: "Allgemein" }, { key: "support", label: "Support" }, { key: "it-infrastruktur", label: "IT-Infra" }, { key: "beratung", label: "Beratung" }, { key: "software", label: "Software" }]} />
      <FL label="Bewertung" />
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[1, 2, 3, 4, 5].map((n) => (<TouchableOpacity key={n} onPress={() => setRating(n)} style={{ flex: 1, alignItems: "center", padding: 8, borderRadius: 8, backgroundColor: rating >= n ? "#F59E0B18" : colors.background, borderWidth: 1, borderColor: rating >= n ? "#F59E0B" : colors.border }}><Text style={{ fontSize: 20, color: rating >= n ? "#F59E0B" : colors.muted }}>★</Text></TouchableOpacity>))}
      </View>
      <FL label="Bewertungstext *" /><SI value={text} onChange={setText} placeholder="Was schätzen Sie an der Zusammenarbeit?" multiline />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}><Text style={{ fontSize: 14, color: colors.foreground }}>Veröffentlicht</Text><Switch value={isPublished} onValueChange={setIsPublished} trackColor={{ true: PINK }} /></View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}><Text style={{ fontSize: 14, color: colors.foreground }}>Für Website verwenden</Text><Switch value={forWebsite} onValueChange={setForWebsite} trackColor={{ true: "#22C55E" }} /></View>
      <SaveBtn onPress={handleSave} loading={saving} label={testimonial?.id ? "Speichern" : "Kundenstimme erfassen"} />
    </BottomSheet>
  );
}

function TestimonialsTab() {
  const colors = useColors(); const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState<any>(null); const [filter, setFilter] = useState("all");
  const { data: testimonials = [], isLoading } = useQuery({ queryKey: ["testimonials"], queryFn: Data.getTestimonials });
  const deleteMutation = useMutation({ mutationFn: (id: string) => Data.deleteTestimonial(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["testimonials"] }) });
  const togglePublish = useMutation({ mutationFn: ({ id, val }: { id: string; val: boolean }) => Data.updateTestimonial(id, { is_published: val }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["testimonials"] }) });
  const filtered = filter === "all" ? testimonials : filter === "published" ? testimonials.filter((t: any) => t.is_published) : filter === "draft" ? testimonials.filter((t: any) => !t.is_published) : testimonials.filter((t: any) => t.use_for_website);
  const avgRating = testimonials.length > 0 ? (testimonials.reduce((s: number, t: any) => s + (t.rating || 5), 0) / testimonials.length).toFixed(1) : "–";
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <MiniStat label="Gesamt" val={testimonials.length} color={PINK} />
        <MiniStat label="Publiziert" val={testimonials.filter((t: any) => t.is_published).length} color="#22C55E" />
        <MiniStat label="Ø Bewertung" val={`${avgRating}★`} color="#F59E0B" />
      </View>
      <Pills value={filter} onChange={setFilter} options={[{ key: "all", label: "Alle" }, { key: "published", label: "Publiziert" }, { key: "draft", label: "Entwurf" }, { key: "website", label: "Website" }]} />
      <SectionButton label="Neue Kundenstimme" onPress={() => { setEditing(null); setShowForm(true); }} />
      {isLoading && <View style={{ paddingVertical: 40, alignItems: "center" }}><ActivityIndicator size="large" color={PINK} /></View>}
      {!isLoading && filtered.length === 0 && <EmptyState icon="star.fill" title="Keine Kundenstimmen" sub="Erfassen Sie Referenzen und Bewertungen Ihrer Kunden" color="#F59E0B" />}
      {filtered.map((t: any) => (
        <Card key={t.id}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <View style={{ flexDirection: "row", gap: 2 }}>{[1, 2, 3, 4, 5].map((n) => (<Text key={n} style={{ fontSize: 16, color: (t.rating || 5) >= n ? "#F59E0B" : colors.border }}>★</Text>))}</View>
            <View style={{ flexDirection: "row", gap: 6 }}>{t.is_published && <Badge label="Publiziert" color="#22C55E" />}{t.use_for_website && <Badge label="Website" color="#0EA5E9" />}</View>
          </View>
          <Text style={{ fontSize: 13, color: colors.foreground, lineHeight: 20, fontStyle: "italic", marginBottom: 12 }}>„{t.testimonial_text}"</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: PINK + "20", alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 15, fontWeight: "700", color: PINK }}>{t.customer_name.charAt(0).toUpperCase()}</Text></View>
            <View><Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>{t.customer_name}</Text><Text style={{ fontSize: 11, color: colors.muted }}>{[t.role, t.company].filter(Boolean).join(" · ")}</Text></View>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity style={{ flex: 1, borderRadius: 10, paddingVertical: 8, backgroundColor: t.is_published ? "#6B728018" : "#22C55E18", alignItems: "center" }} onPress={() => togglePublish.mutate({ id: t.id, val: !t.is_published })}><Text style={{ fontSize: 12, fontWeight: "600", color: t.is_published ? "#6B7280" : "#22C55E" }}>{t.is_published ? "Depublizieren" : "Publizieren"}</Text></TouchableOpacity>
            <TouchableOpacity style={{ flex: 1, borderRadius: 10, paddingVertical: 8, backgroundColor: PINK + "18", alignItems: "center" }} onPress={() => { setEditing(t); setShowForm(true); }}><Text style={{ fontSize: 12, fontWeight: "600", color: PINK }}>Bearbeiten</Text></TouchableOpacity>
            <TouchableOpacity style={{ width: 38, borderRadius: 10, paddingVertical: 8, backgroundColor: colors.error + "18", alignItems: "center" }} onPress={() => showConfirm("Löschen", `Kundenstimme von "${t.customer_name}" löschen?`, () => deleteMutation.mutate(t.id))}><IconSymbol name="trash" size={15} color={colors.error} /></TouchableOpacity>
          </View>
        </Card>
      ))}
      <TestimonialFormModal visible={showForm} testimonial={editing} onClose={() => setShowForm(false)} onSuccess={() => queryClient.invalidateQueries({ queryKey: ["testimonials"] })} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── CONTENT PLANNER TAB ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function ContentFormModal({ visible, content, onClose, onSuccess }: { visible: boolean; content: any; onClose: () => void; onSuccess: () => void }) {
  const [title, setTitle] = useState(""); const [platform, setPlatform] = useState("linkedin"); const [contentType, setContentType] = useState("post");
  const [status, setStatus] = useState("draft"); const [plannedDate, setPlannedDate] = useState(""); const [contentText, setContentText] = useState("");
  const [hashtags, setHashtags] = useState(""); const [linkUrl, setLinkUrl] = useState(""); const [notes, setNotes] = useState(""); const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (visible) { setTitle(content?.title || ""); setPlatform(content?.platform || "linkedin"); setContentType(content?.content_type || "post"); setStatus(content?.status || "draft"); setPlannedDate(content?.planned_date || ""); setContentText(content?.content || ""); setHashtags(content?.hashtags || ""); setLinkUrl(content?.link_url || ""); setNotes(content?.notes || ""); }
  }, [visible, content]);
  const handleSave = async () => {
    if (!title.trim()) { showAlert("Pflichtfeld", "Titel ist erforderlich."); return; }
    setSaving(true);
    try {
      const p = { title, platform, content_type: contentType, status, planned_date: plannedDate || null, content: contentText, hashtags, link_url: linkUrl, notes };
      if (content?.id) await Data.updateMarketingContent(content.id, p); else await Data.createMarketingContent(p);
      onSuccess(); onClose();
    } catch (e: any) { showAlert("Fehler", e.message); } finally { setSaving(false); }
  };
  const platformOptions = Object.entries(PLATFORM_LABELS).map(([k, v]) => ({ key: k, label: `${PLATFORM_EMOJIS[k] || "📋"} ${v}` }));
  return (
    <BottomSheet visible={visible} title={content?.id ? "Content bearbeiten" : "Neuer Content-Eintrag"} onClose={onClose}>
      <FL label="Titel *" /><SI value={title} onChange={setTitle} placeholder="z.B. IT-Tipps für KMU – LinkedIn-Post" />
      <FL label="Plattform" /><Pills value={platform} onChange={setPlatform} options={platformOptions} color={PLATFORM_COLORS[platform] || PINK} />
      <FL label="Content-Typ" /><Pills value={contentType} onChange={setContentType} options={[{ key: "post", label: "Post" }, { key: "story", label: "Story" }, { key: "article", label: "Artikel" }, { key: "video", label: "Video" }, { key: "newsletter", label: "Newsletter" }, { key: "ad", label: "Werbeanzeige" }]} color={PLATFORM_COLORS[platform] || PINK} />
      <FL label="Status" /><Pills value={status} onChange={setStatus} options={Object.entries(CONTENT_STATUS_LABEL).map(([k, v]) => ({ key: k, label: v }))} color={CONTENT_STATUS_COLOR[status] || PINK} />
      <FL label="Geplantes Datum (JJJJ-MM-TT)" /><SI value={plannedDate} onChange={setPlannedDate} placeholder="2026-05-01" />
      <FL label="Inhalt / Text" /><SI value={contentText} onChange={setContentText} placeholder="Post-Text, Video-Skript oder Artikel-Zusammenfassung..." multiline />
      <FL label="Hashtags" /><SI value={hashtags} onChange={setHashtags} placeholder="#GrossICT #ITSupport #KMU" />
      <FL label="Link / URL" /><SI value={linkUrl} onChange={setLinkUrl} placeholder="https://gross-ict.ch/blog/..." />
      <FL label="Interne Notizen" /><SI value={notes} onChange={setNotes} placeholder="Hinweise für das Team..." multiline />
      <SaveBtn onPress={handleSave} loading={saving} label={content?.id ? "Speichern" : "Content erstellen"} color={PLATFORM_COLORS[platform] || PINK} />
    </BottomSheet>
  );
}

function ContentTab() {
  const colors = useColors(); const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState<any>(null);
  const [filterPlatform, setFilterPlatform] = useState("all"); const [filterStatus, setFilterStatus] = useState("all");
  const { data: items = [], isLoading } = useQuery({ queryKey: ["marketingContent"], queryFn: Data.getMarketingContent });
  const deleteMutation = useMutation({ mutationFn: (id: string) => Data.deleteMarketingContent(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["marketingContent"] }) });
  const togglePublish = useMutation({ mutationFn: ({ id, val }: { id: string; val: boolean }) => Data.updateMarketingContent(id, { status: val ? "published" : "draft", published_at: val ? new Date().toISOString() : null }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["marketingContent"] }) });
  const platformFilters = [{ key: "all", label: "Alle Plattformen" }, ...Object.entries(PLATFORM_LABELS).map(([k, v]) => ({ key: k, label: `${PLATFORM_EMOJIS[k]} ${v}` }))];
  const statusFilters = [{ key: "all", label: "Alle" }, ...Object.entries(CONTENT_STATUS_LABEL).map(([k, v]) => ({ key: k, label: v }))];
  let filtered = filterPlatform === "all" ? items : items.filter((i: any) => i.platform === filterPlatform);
  filtered = filterStatus === "all" ? filtered : filtered.filter((i: any) => i.status === filterStatus);
  const published = items.filter((i: any) => i.status === "published").length;
  const scheduled = items.filter((i: any) => i.status === "scheduled").length;
  const upcoming = items.filter((i: any) => i.status === "scheduled" && i.planned_date).sort((a: any, b: any) => a.planned_date.localeCompare(b.planned_date));
  const platformActiveColor = PLATFORM_COLORS[filterPlatform] || PINK;
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <MiniStat label="Gesamt" val={items.length} color={PINK} />
        <MiniStat label="Geplant" val={scheduled} color="#F59E0B" />
        <MiniStat label="Publiziert" val={published} color="#22C55E" />
      </View>
      {upcoming.length > 0 && (
        <Card style={{ borderLeftWidth: 3, borderLeftColor: "#F59E0B" }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#F59E0B", marginBottom: 8 }}>📅 Nächste geplante Inhalte</Text>
          {upcoming.slice(0, 3).map((item: any) => (
            <View key={item.id} style={{ flexDirection: "row", gap: 10, alignItems: "center", marginBottom: 8 }}>
              <Text style={{ fontSize: 20 }}>{PLATFORM_EMOJIS[item.platform] || "📋"}</Text>
              <View style={{ flex: 1 }}><Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }} numberOfLines={1}>{item.title}</Text><Text style={{ fontSize: 11, color: colors.muted }}>{formatDate(item.planned_date)}</Text></View>
            </View>
          ))}
        </Card>
      )}
      <Pills value={filterPlatform} onChange={setFilterPlatform} options={platformFilters} color={platformActiveColor} />
      <Pills value={filterStatus} onChange={setFilterStatus} options={statusFilters} color={CONTENT_STATUS_COLOR[filterStatus] || PINK} />
      <SectionButton label="Neuer Content-Eintrag" onPress={() => { setEditing(null); setShowForm(true); }} color={platformActiveColor} />
      {isLoading && <View style={{ paddingVertical: 40, alignItems: "center" }}><ActivityIndicator size="large" color={PINK} /></View>}
      {!isLoading && filtered.length === 0 && <EmptyState icon="calendar.badge.plus" title="Kein Content geplant" sub="Planen Sie Ihre Social Media Beiträge, Blog-Artikel und mehr" color={platformActiveColor} />}
      {filtered.map((item: any) => {
        const pColor = PLATFORM_COLORS[item.platform] || "#6B7280"; const sColor = CONTENT_STATUS_COLOR[item.status] || "#6B7280";
        return (
          <Card key={item.id} style={{ borderLeftWidth: 3, borderLeftColor: pColor }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, marginRight: 10 }}>
                <Text style={{ fontSize: 22 }}>{PLATFORM_EMOJIS[item.platform] || "📋"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }} numberOfLines={1}>{item.title}</Text>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: pColor }}>{PLATFORM_LABELS[item.platform] || item.platform} · {item.content_type}</Text>
                </View>
              </View>
              <Badge label={CONTENT_STATUS_LABEL[item.status] || item.status} color={sColor} />
            </View>
            {item.content && <Text style={{ fontSize: 12, color: colors.muted, lineHeight: 18, marginBottom: 8 }} numberOfLines={3}>{item.content}</Text>}
            {item.hashtags && <Text style={{ fontSize: 11, color: pColor, marginBottom: 8 }}>{item.hashtags}</Text>}
            <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 10 }}>{item.planned_date ? `📅 Geplant: ${formatDate(item.planned_date)}` : `Erstellt: ${formatDate(item.created_at)}`}</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity style={{ flex: 1, borderRadius: 10, paddingVertical: 8, backgroundColor: item.status === "published" ? "#6B728018" : "#22C55E18", alignItems: "center" }} onPress={() => togglePublish.mutate({ id: item.id, val: item.status !== "published" })}><Text style={{ fontSize: 12, fontWeight: "600", color: item.status === "published" ? "#6B7280" : "#22C55E" }}>{item.status === "published" ? "Depublizieren" : "Publiziert"}</Text></TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, borderRadius: 10, paddingVertical: 8, backgroundColor: pColor + "18", alignItems: "center" }} onPress={() => { setEditing(item); setShowForm(true); }}><Text style={{ fontSize: 12, fontWeight: "600", color: pColor }}>Bearbeiten</Text></TouchableOpacity>
              <TouchableOpacity style={{ width: 38, borderRadius: 10, paddingVertical: 8, backgroundColor: colors.error + "18", alignItems: "center" }} onPress={() => showConfirm("Löschen", `"${item.title}" löschen?`, () => deleteMutation.mutate(item.id))}><IconSymbol name="trash" size={15} color={colors.error} /></TouchableOpacity>
            </View>
          </Card>
        );
      })}
      <ContentFormModal visible={showForm} content={editing} onClose={() => setShowForm(false)} onSuccess={() => queryClient.invalidateQueries({ queryKey: ["marketingContent"] })} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── GOOGLE ANALYTICS TAB ─────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function GA4SetupGuide({ onSaved }: { onSaved: () => void }) {
  const colors = useColors();
  const [propertyId, setPropertyId] = useState("");
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    if (!propertyId.trim()) { showAlert("Pflichtfeld", "Bitte die GA4 Property ID eingeben."); return; }
    setSaving(true);
    try {
      await Promise.all([Data.setMarketingSetting("ga4_property_id", propertyId.trim()), Data.setMarketingSetting("ga4_enabled", "true")]);
      onSaved();
    } catch (e: any) { showAlert("Fehler", e.message); } finally { setSaving(false); }
  };
  const steps = [
    { num: 1, color: "#4285F4", title: "Service Account erstellen", desc: "Google Cloud Console → IAM & Admin → Dienstkonten → Dienstkonto erstellen. Dann: Schlüssel → JSON erstellen und herunterladen." },
    { num: 2, color: "#22C55E", title: "Google Analytics Data API aktivieren", desc: "Cloud Console → APIs & Dienste → Bibliothek → \u00abGoogle Analytics Data API\u00bb suchen und aktivieren." },
    { num: 3, color: "#F59E0B", title: "GA4 Lesezugriff gewähren", desc: "analytics.google.com → Verwaltung → Kontozugriff → Nutzer hinzufügen: Service Account E-Mail, Rolle: Leser." },
    { num: 4, color: "#8B5CF6", title: "JSON-Key als Supabase Secret hinterlegen", desc: "Supabase Dashboard → Edge Functions → Secrets → Neues Secret:\nName: GA4_SERVICE_ACCOUNT_JSON\nWert: Inhalt der heruntergeladenen JSON-Datei." },
    { num: 5, color: "#14B8A6", title: "Edge Function deployen", desc: "Im Terminal einmalig ausführen:\nnpx supabase functions deploy ga4-analytics" },
  ];
  return (
    <View style={{ gap: 14 }}>
      <View style={{ backgroundColor: "#4285F418", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#4285F430" }}>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center", marginBottom: 10 }}>
          <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: "#4285F420", alignItems: "center", justifyContent: "center" }}><IconSymbol name="chart.bar.fill" size={22} color="#4285F4" /></View>
          <View><Text style={{ fontSize: 17, fontWeight: "800", color: colors.foreground }}>Google Analytics 4</Text><Text style={{ fontSize: 12, color: colors.muted }}>Sichere Verbindung via Supabase Edge Function</Text></View>
        </View>
        <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 20 }}>Die Verbindung nutzt einen Google Service Account. Der private Schlüssel wird sicher als Supabase Secret gespeichert – nie im App-Code oder in der Datenbank.</Text>
      </View>
      <Card>
        <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground, marginBottom: 16 }}>🚀 Setup-Anleitung (einmalig)</Text>
        {steps.map((step) => (
          <View key={step.num} style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: step.color + "20", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Text style={{ fontSize: 13, fontWeight: "800", color: step.color }}>{step.num}</Text></View>
            <View style={{ flex: 1 }}><Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground, marginBottom: 3 }}>{step.title}</Text><Text style={{ fontSize: 12, color: colors.muted, lineHeight: 18 }}>{step.desc}</Text></View>
          </View>
        ))}
        <View style={{ backgroundColor: "#0EA5E918", borderRadius: 10, padding: 12, flexDirection: "row", gap: 8 }}>
          <IconSymbol name="info.circle.fill" size={16} color="#0EA5E9" />
          <Text style={{ flex: 1, fontSize: 12, color: "#0EA5E9", lineHeight: 18 }}>Die Edge Function liegt bereits im Projekt unter{"\n"}<Text style={{ fontWeight: "700" }}>supabase/functions/ga4-analytics/index.ts</Text></Text>
        </View>
      </Card>
      <Card>
        <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground, marginBottom: 4 }}>Property ID eingeben</Text>
        <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 14, lineHeight: 18 }}>GA → Verwaltung → Property → Property-Einstellungen (8–9-stellige Zahl, z.B. 123456789)</Text>
        <Text style={{ fontSize: 12, fontWeight: "700", color: colors.muted, marginBottom: 6 }}>GA4 PROPERTY ID *</Text>
        <TextInput style={{ backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border, color: colors.foreground, padding: 12, fontSize: 16, letterSpacing: 1 }} placeholder="z.B. 123456789" placeholderTextColor={colors.muted} value={propertyId} onChangeText={setPropertyId} keyboardType="numeric" />
        <View style={{ backgroundColor: "#22C55E18", borderRadius: 10, padding: 10, marginTop: 12, flexDirection: "row", gap: 6 }}>
          <IconSymbol name="checkmark.shield.fill" size={14} color="#22C55E" />
          <Text style={{ flex: 1, fontSize: 11, color: "#22C55E", lineHeight: 16 }}>Kein API-Key nötig in der App. Der Service Account JSON-Key liegt sicher als Supabase Secret auf dem Server.</Text>
        </View>
        <TouchableOpacity style={{ backgroundColor: "#4285F4", borderRadius: 14, padding: 16, alignItems: "center", marginTop: 16, opacity: saving ? 0.7 : 1 }} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Speichern \u0026 Verbinden</Text>}
        </TouchableOpacity>
      </Card>
    </View>
  );
}

function GA4Dashboard({ propertyId, onReset }: { propertyId: string; onReset: () => void }) {
  const colors = useColors();
  const { data: ga4, isLoading, error, refetch } = useQuery({
    queryKey: ["ga4Analytics", propertyId],
    queryFn: () => Data.fetchGA4Analytics(propertyId),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <View style={{ paddingVertical: 60, alignItems: "center" }}><ActivityIndicator size="large" color="#4285F4" /><Text style={{ color: colors.muted, marginTop: 12, fontSize: 13 }}>Lade Google Analytics Daten...</Text></View>;
  if (error) return (
    <View style={{ gap: 12 }}>
      <Card style={{ borderLeftWidth: 3, borderLeftColor: "#EF4444" }}>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 8 }}><IconSymbol name="exclamationmark.triangle.fill" size={18} color="#EF4444" /><Text style={{ fontSize: 14, fontWeight: "700", color: "#EF4444" }}>Verbindungsfehler</Text></View>
        <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 19 }}>{(error as any).message}</Text>
        <TouchableOpacity style={{ marginTop: 12, backgroundColor: "#EF444418", borderRadius: 10, padding: 10, alignItems: "center" }} onPress={() => refetch()}><Text style={{ color: "#EF4444", fontWeight: "600" }}>Erneut versuchen</Text></TouchableOpacity>
      </Card>
      <TouchableOpacity onPress={onReset}><Text style={{ fontSize: 13, color: colors.muted, textAlign: "center" }}>Einstellungen zurücksetzen</Text></TouchableOpacity>
    </View>
  );

  const { totals, trend, sources, pages } = ga4 || { totals: {}, trend: [], sources: [], pages: [] };
  const maxTrend = trend.length > 0 ? Math.max(...(trend as any[]).map((d: any) => d.users)) : 1;
  const maxSources = sources.length > 0 ? Math.max(...(sources as any[]).map((s: any) => s.sessions)) : 1;
  const formatDuration = (s: number) => s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  const srcColors = ["#4285F4", "#EC4899", "#22C55E", "#F59E0B", "#8B5CF6", "#14B8A6", "#0EA5E9", "#EF4444"];

  return (
    <View style={{ gap: 14 }}>
      {/* Header */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "#4285F420", alignItems: "center", justifyContent: "center" }}><IconSymbol name="chart.bar.fill" size={14} color="#4285F4" /></View>
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>Letzte 28 Tage</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity style={{ backgroundColor: "#4285F418", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }} onPress={() => refetch()}><Text style={{ fontSize: 12, color: "#4285F4", fontWeight: "600" }}>Aktualisieren</Text></TouchableOpacity>
          <TouchableOpacity style={{ backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: colors.border }} onPress={onReset}><IconSymbol name="gearshape" size={14} color={colors.muted} /></TouchableOpacity>
        </View>
      </View>
      {/* KPI Cards */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {[
          { label: "Aktive Nutzer", val: (totals as any).users?.toLocaleString("de-CH") ?? 0, color: "#4285F4", icon: "person.fill" },
          { label: "Neue Nutzer", val: (totals as any).newUsers?.toLocaleString("de-CH") ?? 0, color: "#22C55E", icon: "person.badge.plus.fill" },
          { label: "Sitzungen", val: (totals as any).sessions?.toLocaleString("de-CH") ?? 0, color: "#8B5CF6", icon: "cursorarrow.click" },
          { label: "Seitenaufrufe", val: (totals as any).pageviews?.toLocaleString("de-CH") ?? 0, color: "#0EA5E9", icon: "doc.text.fill" },
          { label: "Absprungrate", val: `${(totals as any).bounceRate ?? 0}%`, color: "#F59E0B", icon: "arrow.turn.up.left" },
          { label: "Ø Sitzungsdauer", val: formatDuration((totals as any).avgSessionDuration ?? 0), color: "#14B8A6", icon: "clock.fill" },
        ].map((kpi) => (
          <View key={kpi.label} style={{ width: "47%", backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border }}>
            <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: kpi.color + "18", alignItems: "center", justifyContent: "center", marginBottom: 8 }}><IconSymbol name={kpi.icon as any} size={16} color={kpi.color} /></View>
            <Text style={{ fontSize: 20, fontWeight: "800", color: kpi.color }}>{kpi.val}</Text>
            <Text style={{ fontSize: 11, color: colors.muted }}>{kpi.label}</Text>
          </View>
        ))}
      </View>
      {/* Daily Trend Sparkline */}
      {(trend as any[]).length > 0 && (
        <Card>
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground, marginBottom: 14 }}>📈 Nutzer-Trend (28 Tage)</Text>
          <View style={{ flexDirection: "row", alignItems: "flex-end", height: 60, gap: 2 }}>
            {(trend as any[]).map((day: any, i: number) => {
              const h = maxTrend > 0 ? Math.max(4, (day.users / maxTrend) * 60) : 4;
              const isLast = i === trend.length - 1;
              return <View key={day.date} style={{ flex: 1, height: h, borderRadius: 3, backgroundColor: isLast ? "#4285F4" : "#4285F460" }} />;
            })}
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
            <Text style={{ fontSize: 10, color: colors.muted }}>{(trend as any[])[0]?.date?.replace(/(\d{4})(\d{2})(\d{2})/, "$3.$2.")}</Text>
            <Text style={{ fontSize: 10, color: colors.muted }}>Heute</Text>
          </View>
        </Card>
      )}
      {/* Traffic Sources */}
      {(sources as any[]).length > 0 && (
        <Card>
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground, marginBottom: 14 }}>🔗 Traffic-Quellen (30 Tage)</Text>
          {(sources as any[]).map((src: any, i: number) => {
            const pct = maxSources > 0 ? (src.sessions / maxSources) * 100 : 0; const color = srcColors[i % srcColors.length];
            const channelMap: Record<string, string> = { "Direct": "Direkteingabe / Lesezeichen", "Organic Search": "Organische Suche (Google)", "Paid Search": "Google Ads (Bezahlt)", "Referral": "Links von anderen Websites", "Email": "E-Mail Kampagnen", "Organic Social": "Social Media (Organisch)", "Paid Social": "Social Media (Bezahlt)", "Cross-network": "Cross-Network Kampagnen", "Display": "Display-Netzwerk", "Unassigned": "Nicht zuordnungsbar" };
            const channelName = channelMap[src.channel] || src.channel;
            return (
              <View key={src.channel} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 5 }}>
                  <Text style={{ fontSize: 13, color: colors.foreground, fontWeight: "500" }}>{channelName}</Text>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <Text style={{ fontSize: 12, color: colors.muted }}>{src.sessions.toLocaleString("de-CH")} Sitzungen</Text>
                    <Text style={{ fontSize: 12, fontWeight: "700", color }}>{src.users.toLocaleString("de-CH")} Nutzer</Text>
                  </View>
                </View>
                <View style={{ height: 6, backgroundColor: colors.border, borderRadius: 3 }}><View style={{ height: 6, borderRadius: 3, width: `${pct}%` as any, backgroundColor: color }} /></View>
              </View>
            );
          })}
        </Card>
      )}
      {/* Top Pages */}
      {(pages as any[]).length > 0 && (
        <Card>
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground, marginBottom: 14 }}>📄 Top Seiten (30 Tage)</Text>
          {(pages as any[]).map((page: any, i: number) => (
            <View key={page.path} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ fontSize: 14, fontWeight: "800", color: colors.muted, width: 22 }}>{i + 1}</Text>
              <Text style={{ flex: 1, fontSize: 12, color: colors.foreground }} numberOfLines={1}>{page.path}</Text>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#4285F4" }}>{page.pageviews.toLocaleString("de-CH")}</Text>
                <Text style={{ fontSize: 10, color: colors.muted }}>Aufrufe</Text>
              </View>
            </View>
          ))}
        </Card>
      )}
      {/* Lead Sources aus CRM */}
      <LeadSourcesCard />
    </View>
  );
}

function LeadSourcesCard() {
  const colors = useColors();
  const { data: stats } = useQuery({ queryKey: ["fullMarketingStats"], queryFn: Data.getFullMarketingStats });
  const sources = stats?.leadSources || [];
  const max = sources.length > 0 ? Math.max(...sources.map((s: any) => s.total)) : 1;
  const srcLabels: Record<string, string> = { website: "Website", telefon: "Telefon", empfehlung: "Empfehlung", messe: "Messe / Event", email: "E-Mail", social: "Social Media", unbekannt: "Unbekannt" };
  if (sources.length === 0) return null;
  return (
    <Card>
      <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground, marginBottom: 4 }}>🎯 CRM Lead-Quellen (30 Tage)</Text>
      <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 14 }}>{stats?.newLeads30Days ?? 0} neue Leads aus dem CRM</Text>
      {sources.map((src: any, i: number) => {
        const pct = max > 0 ? (src.total / max) * 100 : 0; const color = SOURCE_COLORS[i % SOURCE_COLORS.length];
        return (
          <View key={src.source} style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
              <Text style={{ fontSize: 13, color: colors.foreground }}>{srcLabels[src.source] || src.source}</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color }}>{src.total} Leads</Text>
                <View style={{ backgroundColor: src.convRate >= 30 ? "#22C55E20" : "#F59E0B20", borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 }}><Text style={{ fontSize: 10, fontWeight: "700", color: src.convRate >= 30 ? "#22C55E" : "#F59E0B" }}>{src.convRate}%</Text></View>
              </View>
            </View>
            <View style={{ height: 5, backgroundColor: colors.border, borderRadius: 3 }}><View style={{ height: 5, borderRadius: 3, width: `${pct}%` as any, backgroundColor: color }} /></View>
          </View>
        );
      })}
    </Card>
  );
}

function AnalyticsTab() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading: settingsLoading, refetch: refetchSettings } = useQuery({ queryKey: ["marketingSettings"], queryFn: Data.getMarketingSettings });
  const isConfigured = settings?.ga4_enabled === "true" && !!settings?.ga4_property_id;
  const handleReset = async () => {
    await Promise.all([Data.setMarketingSetting("ga4_enabled", "false"), Data.setMarketingSetting("ga4_property_id", "")]);
    queryClient.invalidateQueries({ queryKey: ["marketingSettings"] });
    queryClient.invalidateQueries({ queryKey: ["ga4Analytics"] });
    refetchSettings();
  };
  if (settingsLoading) return <View style={{ paddingVertical: 60, alignItems: "center" }}><ActivityIndicator size="large" color="#4285F4" /></View>;
  return isConfigured
    ? <GA4Dashboard propertyId={settings!.ga4_property_id} onReset={handleReset} />
    : <GA4SetupGuide onSaved={() => { queryClient.invalidateQueries({ queryKey: ["marketingSettings"] }); refetchSettings(); }} />;
}


// ═══════════════════════════════════════════════════════════════════════════════
// ─── BRAINSTORMING TAB ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function BrainstormingFormModal({ visible, idea, onClose, onSuccess }: { visible: boolean; idea: any; onClose: () => void; onSuccess: () => void }) {
  const colors = useColors();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("campaign");
  const [status, setStatus] = useState("idea");
  const [audience, setAudience] = useState("");
  const [budget, setBudget] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setTitle(idea?.title || "");
      setDescription(idea?.description || "");
      setCategory(idea?.category || "campaign");
      setStatus(idea?.status || "idea");
      setAudience(idea?.target_audience || "");
      setBudget(idea?.estimated_budget?.toString() || "");
    }
  }, [visible, idea]);

  const handleSave = async () => {
    if (!title.trim()) { showAlert("Pflichtfeld", "Bitte einen Titel eingeben."); return; }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(), description: description.trim(), category, status,
        target_audience: audience.trim(), estimated_budget: budget ? parseFloat(budget) : null
      };
      if (idea?.id) await Data.updateMarketingIdea(idea.id, payload);
      else await Data.createMarketingIdea(payload);
      onSuccess();
    } catch (e: any) { showAlert("Fehler", e.message); } finally { setSaving(false); }
  };

  const cats = [
    { key: "campaign", label: "Kampagne" },
    { key: "event", label: "Event" },
    { key: "content", label: "Content" },
    { key: "social_media", label: "Social Media" },
    { key: "newsletter", label: "Newsletter" },
    { key: "other", label: "Sonstiges" }
  ];
  const states = [
    { key: "idea", label: "Idee" },
    { key: "planned", label: "Geplant" },
    { key: "in_progress", label: "In Prüfung" },
    { key: "implemented", label: "Umgesetzt" },
    { key: "rejected", label: "Verworfen" }
  ];

  return (
    <BottomSheet visible={visible} title={idea ? "Idee bearbeiten" : "Neue Brainstorming Idee"} onClose={onClose}>
      <FL label="Kategorie" />
      <Pills options={cats} value={category} onChange={setCategory} color="#eab308" />
      
      <FL label="Titel / Schlagwort *" />
      <SI value={title} onChange={setTitle} placeholder="z.B. Sommerkampagne KMU" />
      
      <FL label="Status" />
      <Pills options={states} value={status} onChange={setStatus} color="#eab308" />

      <FL label="Beschreibung / Details" />
      <SI value={description} onChange={setDescription} multiline placeholder="Worum geht es bei dieser Idee?" />

      <FL label="Zielgruppe" />
      <SI value={audience} onChange={setAudience} placeholder="z.B. Bestehende Kunden, Startups" />

      <FL label="Geschätztes Budget (Optional)" />
      <SI value={budget} onChange={setBudget} keyboardType="numeric" placeholder="in CHF" />

      <SaveBtn onPress={handleSave} loading={saving} color="#eab308" />
    </BottomSheet>
  );
}

function BrainstormingTab() {
  const colors = useColors();
  const { isWide } = useResponsiveLayout();
  const [modalObj, setModalObj] = useState<any>(null);
  
  const { data: ideas, isLoading, refetch } = useQuery({ queryKey: ["marketingIdeas"], queryFn: Data.getMarketingIdeas });

  if (isLoading) return <View style={{ paddingVertical: 60, alignItems: "center" }}><ActivityIndicator size="large" color="#eab308" /></View>;

  const STATUS_COLORS: Record<string, string> = { idea: "#0EA5E9", planned: "#F59E0B", in_progress: "#8B5CF6", implemented: "#22C55E", rejected: "#EF4444" };
  const STATUS_LABELS: Record<string, string> = { idea: "Idee 💡", planned: "Geplant 📅", in_progress: "In Prüfung 🔍", implemented: "Umgesetzt ✅", rejected: "Verworfen ❌" };
  const CAT_LABELS: Record<string, string> = { campaign: "Kampagne", event: "Event", content: "Content", social_media: "Social Media", newsletter: "Newsletter", other: "Sonstiges" };

  return (
    <View style={{ gap: 16 }}>
      <SectionButton label="Neue Idee notieren" onPress={() => setModalObj({})} color="#eab308" />
      
      {!ideas || ideas.length === 0 ? (
        <EmptyState icon="lightbulb.fill" color="#eab308" title="Noch keine Geistesblitze" sub="Sammle hier erste Ideen für kommende Marketing-Aktionen." />
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {ideas.map((idea: any) => (
            <TouchableOpacity key={idea.id} style={{ width: isWide ? "48%" : "100%" }} activeOpacity={0.7} onPress={() => setModalObj(idea)}>
              <Card style={{ flex: 1, borderLeftWidth: 4, borderLeftColor: STATUS_COLORS[idea.status] || colors.muted }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <Badge label={CAT_LABELS[idea.category] || "Idee"} color="#eab308" />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: STATUS_COLORS[idea.status] || colors.muted }}>{STATUS_LABELS[idea.status]}</Text>
                </View>
                <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground, marginBottom: 6 }}>{idea.title}</Text>
                {idea.description ? (
                  <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 12 }} numberOfLines={3}>{idea.description}</Text>
                ) : null}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: "auto", borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 }}>
                  <View style={{ flexDirection: "row", gap: 12 }}>
                     <Text style={{ fontSize: 11, color: colors.muted }}>Von: {idea.creator?.name || "System"}</Text>
                     {idea.target_audience && <Text style={{ fontSize: 11, color: colors.muted }}>Ziel: {idea.target_audience}</Text>}
                  </View>
                  {idea.estimated_budget && <Text style={{ fontSize: 12, fontWeight: "600", color: colors.foreground }}>~ {idea.estimated_budget} CHF</Text>}
                </View>
              </Card>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {modalObj && <BrainstormingFormModal visible={!!modalObj} idea={Object.keys(modalObj).length > 0 ? modalObj : null} onClose={() => setModalObj(null)} onSuccess={() => { setModalObj(null); refetch(); }} />}
    </View>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export default function MarketingScreen() {
  const router = useRouter(); const colors = useColors();
  const { contentPadding, containerStyle } = useResponsiveLayout();
  const { refreshing, onRefresh } = useGlobalRefresh();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const { data: stats, isLoading: statsLoading } = useQuery({ queryKey: ["fullMarketingStats"], queryFn: Data.getFullMarketingStats, refetchInterval: 60000 });
  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "overview", label: "Übersicht", icon: "chart.bar.fill" },
    { id: "brainstorming", label: "Brainstorming", icon: "lightbulb.fill" },
    { id: "newsletter", label: "Newsletter", icon: "envelope.fill" },
    { id: "campaigns", label: "Kampagnen", icon: "megaphone.fill" },
    { id: "events", label: "Veranstaltungen", icon: "calendar" },
    { id: "testimonials", label: "Referenzen", icon: "star.fill" },
    { id: "content", label: "Content-Plan", icon: "calendar.badge.plus" },
    { id: "analytics", label: "Google Analytics", icon: "chart.line.uptrend.xyaxis" },
  ];
  const tabColor: Record<Tab, string> = { overview: PINK, brainstorming: "#eab308", newsletter: "#8B5CF6", campaigns: "#EC4899", events: "#0EA5E9", testimonials: "#F59E0B", content: "#22C55E", analytics: "#4285F4" };
  const activeColor = tabColor[activeTab] || PINK;
  return (
    <ScreenContainer>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: contentPadding, paddingBottom: 120 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={containerStyle}>
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}><IconSymbol name="chevron.left" size={24} color={colors.foreground} /></TouchableOpacity>
              <View>
                <Text style={{ fontSize: 26, fontWeight: "800", color: colors.foreground }}>Marketing</Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 1 }}>Newsletter · Kampagnen · Analytics · Content</Text>
              </View>
            </View>
            <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: activeColor + "18", alignItems: "center", justifyContent: "center" }}>
              <IconSymbol name="megaphone.fill" size={22} color={activeColor} />
            </View>
          </View>
          {/* Tab Bar */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 16 }}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id; const tColor = tabColor[tab.id];
              return (
                <TouchableOpacity key={tab.id} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: isActive ? tColor : colors.surface, borderWidth: 1, borderColor: isActive ? tColor : colors.border }} activeOpacity={0.7} onPress={() => setActiveTab(tab.id)}>
                  <IconSymbol name={tab.icon as any} size={14} color={isActive ? "#fff" : colors.muted} />
                  <Text style={{ fontSize: 13, fontWeight: "600", color: isActive ? "#fff" : colors.muted }}>{tab.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {/* Content */}
          {activeTab === "overview" && <OverviewTab stats={stats} isLoading={statsLoading} />}
          {activeTab === "brainstorming" && <BrainstormingTab />}
          {activeTab === "newsletter" && <NewsletterTab />}
          {activeTab === "campaigns" && <CampaignsTab />}
          {activeTab === "events" && <EventsTab />}
          {activeTab === "testimonials" && <TestimonialsTab />}
          {activeTab === "content" && <ContentTab />}
          {activeTab === "analytics" && <AnalyticsTab />}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

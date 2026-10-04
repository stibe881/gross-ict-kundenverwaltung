import { useState, useEffect, useRef, useCallback } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  Image,
  TextInput,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
} from "react-native";
import { useGlobalRefresh } from "@/hooks/use-global-refresh";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { supabase } from "@/lib/supabase";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { CustomerFormModal } from "@/components/customer-form-modal";
import { InvoiceFormModal } from "@/components/invoice-form-modal-v2";
import { TicketFormModal } from "@/components/ticket-form-modal";
import { LogoutButton } from "@/components/logout-button";
import { QuoteFormModal } from "@/components/quote-form-modal";
import { ProjectFormModal } from "@/components/project-form-modal";
import { TapToPayAwareness } from "@/components/tap-to-pay-awareness";
import { TodayFeed } from "@/components/today-feed";
import { useQuery } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { performGlobalSearch } from "@/lib/global-search";
import { AskCrmModal } from "@/components/ask-crm-modal";

interface DashboardTile {
  id: string;
  title: string;
  subtitle: string;
  icon: any;
  color: string;
  route?: string;
}

export default function DashboardScreen() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const colors = useColors();
  const { refreshing, onRefresh } = useGlobalRefresh();
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [showAskCrm, setShowAskCrm] = useState(false);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<any>(null);

  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web";
  const isWide = isWeb && width > 900;
  const isMedium = isWeb && width > 600 && width <= 900;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["unreadAdminNotifications", (user as any)?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      if (error) throw new Error(error.message);
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Load current user's roles for RBAC
  const { data: userProfile } = useQuery({
    queryKey: ["userProfile", user?.id],
    queryFn: () => Data.getUserProfile(user?.id),
    enabled: !!user?.id,
  });

  // Browser-Benachrichtigungen (nur Web): neue ungelesene Meldungen als Desktop-Notification
  useEffect(() => {
    if (Platform.OS !== "web" || !user) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const WebNotification = (window as any).Notification;
    if (WebNotification.permission === "default") {
      try { WebNotification.requestPermission(); } catch (_) { /* Safari u.ä. */ }
    }
    const check = async () => {
      if (WebNotification.permission !== "granted") return;
      try {
        const lastSeen = window.localStorage.getItem("webNotifLastSeen") || "";
        const { data } = await supabase
          .from("notifications")
          .select("id, title, message, created_at")
          .eq("user_id", (user as any).id)
          .eq("is_read", false)
          .order("created_at", { ascending: false })
          .limit(5);
        const fresh = (data || []).filter((n: any) => !lastSeen || n.created_at > lastSeen);
        for (const n of fresh.slice(0, 3)) {
          new WebNotification(n.title || "Gross ICT CRM", { body: n.message || "", tag: n.id });
        }
        if (data && data.length > 0) {
          window.localStorage.setItem("webNotifLastSeen", data[0].created_at || "");
        }
      } catch (_) { /* Benachrichtigungen sind optional */ }
    };
    check();
    const timer = setInterval(check, 30000);
    return () => clearInterval(timer);
  }, [user]);

  // Live-Kennzahlen für die KPI-Zeile
  const { data: stats } = useQuery({
    queryKey: ["dashboardStats"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const in7 = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const [ticketsRes, openInvRes, paidInvRes, projectsRes] = await Promise.all([
        supabase.from("tickets").select("due_date").in("status", ["open", "in_progress", "waiting"]),
        supabase.from("invoices").select("total, paid_amount, due_date").in("status", ["open", "sent", "overdue"]),
        // Umsatz: im laufenden Monat bezahlte Rechnungen (Zahlzeitpunkt ≈ updated_at)
        supabase.from("invoices").select("total").eq("status", "paid").gte("updated_at", monthStart),
        supabase.from("projects").select("end_date").eq("status", "in_progress"),
      ]);
      const tickets = ticketsRes.data || [];
      const openInv = openInvRes.data || [];
      const paidInv = paidInvRes.data || [];
      const projects = projectsRes.data || [];
      return {
        openTickets: tickets.length,
        overdueTickets: tickets.filter((t: any) => t.due_date && t.due_date < today).length,
        openInvoiceSum: openInv.reduce((sum: number, i: any) => sum + Math.max(0, (i.total || 0) - (i.paid_amount || 0)), 0),
        openInvoiceCount: openInv.length,
        overdueInvoiceCount: openInv.filter((i: any) => i.due_date && i.due_date < today).length,
        monthRevenue: paidInv.reduce((sum: number, i: any) => sum + (i.total || 0), 0),
        monthPaidCount: paidInv.length,
        activeProjects: projects.length,
        projectsEndingSoon: projects.filter((pr: any) => pr.end_date && pr.end_date >= today && pr.end_date <= in7).length,
      };
    },
    enabled: !!user,
    refetchInterval: 60000,
  });

  // Global search with debounce
  // Such-Syntax: "status:offen", "kunde:müller", ">1000" / "<500" (Betrag), kombinierbar mit Freitext
  const performSearch = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const results = await performGlobalSearch(query, colors);
    setSearchResults(results);
    setSearching(false);
  }, [colors]);

  if (loading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  const userName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Admin";

  const hour = new Date().getHours();
  const greeting = hour < 11 ? "Guten Morgen" : hour < 18 ? "Guten Tag" : "Guten Abend";
  const todayLabel = new Date().toLocaleDateString("de-CH", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const handleSearchChange = (text: string) => {
    setGlobalSearch(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!text || text.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(() => performSearch(text), 350);
  };

  // Gleiche Reihenfolge wie die Seitenleiste der Desktop-Ansicht:
  // CRM (Kunden, Akquise, Angebote, Projekte) → Betrieb (Tickets, Verträge,
  // Aufgaben, Überwachung, Wissensdatenbank, Links) → Finanzen (Buchhaltung)
  const tileCategories = [
    {
      label: "CRM",
      tiles: [
        {
          id: "customers",
          title: "Kunden",
          subtitle: "Kundenverwaltung",
          icon: "person.2.fill",
          color: colors.primary,
          route: "/customers",
        },
        {
          id: "leads",
          title: "Akquise",
          subtitle: "Lead-Pipeline",
          icon: "briefcase.fill",
          color: "#17A2B8",
          route: "/leads",
        },
        {
          id: "quotes",
          title: "Angebote",
          subtitle: "Angebote erstellen",
          icon: "doc.text.fill",
          color: "#EC4899",
          route: "/quotes",
        },
        {
          id: "projects",
          title: "Projekte",
          subtitle: "Auftragsverwaltung",
          icon: "folder.fill",
          color: "#14B8A6",
          route: "/projects",
        },
      ],
    },
    {
      label: "Betrieb",
      tiles: [
        {
          id: "tickets",
          title: "Tickets",
          subtitle: "Supportanfragen",
          icon: "ticket.fill",
          color: colors.warning,
          route: "/tickets",
        },
        {
          id: "contracts",
          title: "Verträge",
          subtitle: "Verwaltung",
          icon: "doc.on.doc.fill",
          color: "#6366F1",
          route: "/contracts",
        },
        {
          id: "tasks",
          title: "Aufgaben",
          subtitle: "Interne To-Dos",
          icon: "checklist",
          color: "#8B5CF6",
          route: "/tasks",
        },
        {
          id: "uberwachung",
          title: "Überwachung",
          subtitle: "URL-Monitoring",
          icon: "wifi",
          color: "#06B6D4",
          route: "/uberwachung",
        },
        {
          id: "knowledge-base",
          title: "Wissensdatenbank",
          subtitle: "Anleitungen & FAQs",
          icon: "book.fill",
          color: "#0EA5E9",
          route: "/knowledge-base",
        },
        {
          id: "links",
          title: "Nützliche Links",
          subtitle: "Firmen-Ressourcen",
          icon: "link",
          color: "#8B5CF6",
          route: "/links",
        },
      ],
    },
    {
      label: "Finanzen",
      tiles: [
        {
          id: "accounting",
          title: "Buchhaltung",
          subtitle: "Rechnungen & Zahlungen",
          icon: "chart.bar.fill",
          color: colors.success,
          route: "/accounting",
        },
        // "Kassieren" (Tap to Pay) ist über die Tab-Leiste erreichbar
      ],
    },
    // Konfiguration ist in den neuen Einstellungen-Tab umgezogen
  ];

  const allowedTileIds = Data.getAllowedTileIds(
    userProfile?.roles || []
  );
  const isAdmin = (userProfile?.roles || []).includes("admin");

  const tileAllowed = (id: string) => !allowedTileIds || allowedTileIds.includes(id);

  // Filter tiles by role
  const filteredCategories = tileCategories
    .map((cat) => ({
      ...cat,
      tiles: allowedTileIds
        ? cat.tiles.filter((t) => allowedTileIds.includes(t.id))
        : cat.tiles,
    }))
    .filter((cat) => cat.tiles.length > 0);

  // KPI-Kacheln: nur anzeigen, was die Rolle sehen darf
  const monthName = new Date().toLocaleDateString("de-CH", { month: "long" });
  const fmtChf = (v?: number) => `CHF ${Math.round(v || 0).toLocaleString("de-CH")}`;
  const kpiCards = [
    { id: "tickets", label: "Offene Tickets", value: stats ? String(stats.openTickets) : "–", sub: `${stats?.overdueTickets || 0} überfällig`, color: "#FB923C", route: "/tickets?filter=open" },
    { id: "accounting", label: "Offene Rechnungen", value: stats ? fmtChf(stats.openInvoiceSum) : "–", sub: `${stats?.openInvoiceCount || 0} Rechnungen · ${stats?.overdueInvoiceCount || 0} überfällig`, color: "#F87171", route: "/accounting?tab=invoices&filter=unpaid" },
    { id: "accounting", label: `Umsatz ${monthName}`, value: stats ? fmtChf(stats.monthRevenue) : "–", sub: `${stats?.monthPaidCount || 0} Zahlungen eingegangen`, color: "#4ADE80", route: "/accounting?tab=overview" },
    { id: "projects", label: "Aktive Projekte", value: stats ? String(stats.activeProjects) : "–", sub: `${stats?.projectsEndingSoon || 0} enden diese Woche`, color: "#22D3EE", route: "/projects?filter=in_progress" },
  ].filter((k) => tileAllowed(k.id));

  // Tile column count based on screen width
  const tileColumns = isWide ? 4 : isMedium ? 3 : 2;
  const tileGap = isWide ? 16 : 12;
  const useGrid = isWide || isMedium;

  // ── Desktop-Web: Dashboard im Mockup-Layout (Topbar, KPI-Zeile, zwei Spalten) ──
  if (isWide) {
    const newMenuItems = [
      { id: "tickets", label: "Neues Ticket", icon: "ticket.fill", open: () => setShowTicketModal(true) },
      { id: "accounting", label: "Neue Rechnung", icon: "doc.text.fill", open: () => setShowInvoiceModal(true) },
      { id: "quotes", label: "Neues Angebot", icon: "doc.on.doc.fill", open: () => setShowQuoteModal(true) },
      { id: "customers", label: "Neuer Kunde", icon: "person.2.fill", open: () => setShowCustomerModal(true) },
      { id: "projects", label: "Neues Projekt", icon: "folder.fill", open: () => setShowProjectModal(true) },
    ].filter((m) => tileAllowed(m.id));

    return (
      <ScreenContainer>
        {/* Inhalt */}
        <ScrollView
          contentContainerStyle={{ padding: 28, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={{ maxWidth: 1200, alignSelf: "center", width: "100%" }}>
            <Text style={{ fontSize: 22, fontWeight: "700", color: colors.foreground }}>
              {greeting}, {userName}
            </Text>
            <Text style={{ fontSize: 13, color: colors.muted, marginTop: 3 }}>{todayLabel}</Text>

            {/* KPI-Zeile im Mockup-Design */}
            {kpiCards.length > 0 && (
              <View style={{ flexDirection: "row", gap: 14, marginTop: 22, marginBottom: 22 }}>
                {kpiCards.map((kpi) => (
                  <TouchableOpacity
                    key={kpi.label}
                    style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingVertical: 16, paddingHorizontal: 18 }}
                    activeOpacity={0.7}
                    onPress={() => router.push(kpi.route as any)}
                  >
                    <Text style={{ fontSize: 12, color: colors.muted, fontWeight: "600" }}>{kpi.label}</Text>
                    <Text style={{ fontSize: 26, fontWeight: "700", color: kpi.color, marginTop: 4 }} numberOfLines={1}>
                      {kpi.value}
                    </Text>
                    <Text style={{ fontSize: 11.5, color: colors.muted, marginTop: 2 }} numberOfLines={1}>{kpi.sub}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Zwei Spalten: Heute wichtig | Meine Woche + Schnellaktionen */}
            <View style={{ flexDirection: "row", gap: 16, alignItems: "flex-start" }}>
              <View style={{ flex: 3, minWidth: 0 }}>
                <TodayFeed allowed={tileAllowed} isWide={isWide} rolesKey={(userProfile?.roles || []).join(",")} />
              </View>
              <View style={{ flex: 2, minWidth: 0 }}>
                {user?.id ? <MyWeekCard userId={(user as any).id} colors={colors} isWide={isWide} /> : null}
                <View style={{ backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 18 }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground, marginBottom: 12 }}>Schnellaktionen</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                    {newMenuItems.map((m) => (
                      <TouchableOpacity
                        key={`qa-${m.label}`}
                        style={{ flexBasis: "47%", flexGrow: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11 }}
                        onPress={m.open}
                        activeOpacity={0.7}
                      >
                        <IconSymbol name={m.icon as any} size={14} color={colors.primary} />
                        <Text style={{ fontSize: 12.5, fontWeight: "600", color: colors.foreground }} numberOfLines={1}>
                          {m.label.replace("Neues ", "").replace("Neuer ", "").replace("Neue ", "")}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Modals */}
        <CustomerFormModal visible={showCustomerModal} onClose={() => setShowCustomerModal(false)} onSuccess={() => { }} />
        <TicketFormModal visible={showTicketModal} onClose={() => setShowTicketModal(false)} onSuccess={() => { }} />
        <InvoiceFormModal visible={showInvoiceModal} onClose={() => setShowInvoiceModal(false)} onSuccess={() => { }} />
        <QuoteFormModal visible={showQuoteModal} onClose={() => setShowQuoteModal(false)} onSuccess={() => { }} />
        <ProjectFormModal visible={showProjectModal} onClose={() => setShowProjectModal(false)} onSuccess={() => { }} />
        <AskCrmModal visible={showAskCrm} onClose={() => setShowAskCrm(false)} colors={colors} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <TapToPayAwareness />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: isWide ? 32 : 16,
          paddingBottom: 100,
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View
          style={
            isWide
              ? { maxWidth: 1200, alignSelf: "center", width: "100%" }
              : undefined
          }
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: isWide ? 28 : 16,
              paddingTop: isWide ? 8 : 0,
            }}
          >
            <View style={{ flex: 1, paddingBottom: 4 }}>
              <Image
                source={require("@/assets/images/android-icon-foreground.png")}
                style={{ width: isWide ? 200 : 150, height: isWide ? 44 : 34, marginLeft: -12 }}
                resizeMode="contain"
              />
              <Text
                style={{
                  fontSize: isWide ? 17 : 15,
                  fontWeight: "700",
                  color: colors.foreground,
                  marginTop: 4,
                }}
              >
                {greeting}, {userName}
              </Text>
              <Text style={{ fontSize: 12, color: colors.muted, marginTop: 1 }}>
                {todayLabel}
              </Text>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <TouchableOpacity
                onPress={() => router.push("/admin-notifications")}
                style={{ position: "relative" }}
                activeOpacity={0.7}
              >
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <IconSymbol
                    name="bell.fill"
                    size={19}
                    color={colors.foreground}
                  />
                </View>
                {unreadCount > 0 && (
                  <View
                    style={{
                      position: "absolute",
                      top: -2,
                      right: -2,
                      backgroundColor: colors.error,
                      borderRadius: 10,
                      minWidth: 20,
                      height: 20,
                      alignItems: "center",
                      justifyContent: "center",
                      paddingHorizontal: 4,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: "#FFFFFF",
                      }}
                    >
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              <LogoutButton />
            </View>
          </View>

          {/* Global Search */}
          <View style={{ marginBottom: isWide ? 20 : 14, position: "relative", zIndex: 100 }}>
            <View style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              paddingHorizontal: 12,
              paddingVertical: 10,
              flexDirection: "row",
              alignItems: "center",
              borderWidth: 1,
              borderColor: globalSearch ? colors.primary + "60" : colors.border,
            }}>
              <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
              <TextInput
                style={{ flex: 1, marginLeft: 10, fontSize: 15, color: colors.foreground }}
                placeholder="Kunden, Tickets, Rechnungen suchen..."
                placeholderTextColor={colors.muted}
                value={globalSearch}
                onChangeText={handleSearchChange}
              />
              {globalSearch.length > 0 && (
                <TouchableOpacity onPress={() => { setGlobalSearch(""); setSearchResults([]); }}>
                  <IconSymbol name="xmark.circle.fill" size={18} color={colors.muted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Search Results Dropdown */}
            {(searchResults.length > 0 || (searching && globalSearch.length >= 2)) && (
              <View style={{
                position: "absolute", top: 52, left: 0, right: 0,
                backgroundColor: colors.surface,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                overflow: "hidden",
                ...(Platform.OS === "web" ? { boxShadow: "0 8px 32px rgba(0,0,0,0.18)" } as any : {
                  shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
                }),
                maxHeight: 350,
              }}>
                {searching ? (
                  <View style={{ padding: 20, alignItems: "center" }}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                ) : searchResults.length === 0 ? (
                  <View style={{ padding: 20, alignItems: "center" }}>
                    <Text style={{ color: colors.muted, fontSize: 14 }}>Keine Ergebnisse</Text>
                  </View>
                ) : (
                  <ScrollView style={{ maxHeight: 340 }} nestedScrollEnabled>
                    {searchResults.map((result, idx) => (
                      <TouchableOpacity
                        key={`${result.type}-${result.id}`}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          padding: 14,
                          borderBottomWidth: idx < searchResults.length - 1 ? 1 : 0,
                          borderBottomColor: colors.border,
                          gap: 12,
                        }}
                        activeOpacity={0.7}
                        onPress={() => {
                          setGlobalSearch("");
                          setSearchResults([]);
                          router.push(result.route as any);
                        }}
                      >
                        <View style={{
                          width: 36, height: 36, borderRadius: 10,
                          backgroundColor: result.color + "18",
                          alignItems: "center", justifyContent: "center",
                        }}>
                          <IconSymbol name={result.icon} size={18} color={result.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }} numberOfLines={1}>{result.title}</Text>
                          <Text style={{ fontSize: 12, color: colors.muted, marginTop: 1 }} numberOfLines={1}>{result.subtitle}</Text>
                        </View>
                        <IconSymbol name="chevron.right" size={14} color={colors.muted} />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}

            {/* Frag dein CRM */}
            <TouchableOpacity
              style={{
                flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
                marginTop: 8, paddingVertical: 8, borderRadius: 12,
                backgroundColor: "#8B5CF612", borderWidth: 1, borderColor: "#8B5CF630",
              }}
              activeOpacity={0.7}
              onPress={() => setShowAskCrm(true)}
            >
              <IconSymbol name="sparkles" size={14} color="#8B5CF6" />
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#8B5CF6" }}>
                Frag dein CRM – z.B. «Welche Kunden haben offene Rechnungen über 500 Franken?»
              </Text>
            </TouchableOpacity>
          </View>

          {/* KPI-Kacheln: gleiche Infos wie die Desktop-Ansicht, als 2x2-Raster */}
          {kpiCards.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: isWide ? 24 : 18 }}>
              {kpiCards.map((kpi) => (
                <TouchableOpacity
                  key={kpi.label}
                  style={{
                    flexBasis: "47%",
                    flexGrow: 1,
                    backgroundColor: colors.surface,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: colors.border,
                    paddingVertical: 13,
                    paddingHorizontal: 14,
                  }}
                  activeOpacity={0.7}
                  onPress={() => router.push(kpi.route as any)}
                >
                  <Text style={{ fontSize: 11, color: colors.muted, fontWeight: "600" }} numberOfLines={1}>
                    {kpi.label}
                  </Text>
                  <Text style={{ fontSize: 21, fontWeight: "700", color: kpi.color, marginTop: 3 }} numberOfLines={1}>
                    {kpi.value}
                  </Text>
                  <Text style={{ fontSize: 10.5, color: colors.muted, marginTop: 2 }} numberOfLines={1}>
                    {kpi.sub}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Heute-Feed: was jetzt Aufmerksamkeit braucht */}
          <TodayFeed allowed={tileAllowed} isWide={isWide} rolesKey={(userProfile?.roles || []).join(",")} />

          {/* Meine Woche: mir zugewiesene offene Arbeit */}
          {user?.id ? <MyWeekCard userId={(user as any).id} colors={colors} isWide={isWide} /> : null}

          {/* Quick Actions Bar - nur Web/Desktop, mobil hat FAB */}
          {isWeb && <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: isWide ? 28 : 18 }}
            contentContainerStyle={{ gap: 10 }}
          >
            {[
              {
                label: "Neuer Kunde",
                icon: "person.fill.badge.plus",
                onPress: () => setShowCustomerModal(true),
              },
              {
                label: "Neues Ticket",
                icon: "ticket.fill",
                onPress: () => setShowTicketModal(true),
              },
              {
                label: "Neue Rechnung",
                icon: "doc.text.fill",
                onPress: () => setShowInvoiceModal(true),
              },
              {
                label: "Neues Angebot",
                icon: "doc.text.fill",
                onPress: () => setShowQuoteModal(true),
              },
              {
                label: "Neues Projekt",
                icon: "folder.fill",
                onPress: () => setShowProjectModal(true),
              },
            ].map((action) => (
              <TouchableOpacity
                key={action.label}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                }}
                activeOpacity={0.7}
                onPress={action.onPress}
              >
                <IconSymbol
                  name={action.icon as any}
                  size={16}
                  color={colors.primary}
                />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: colors.foreground,
                  }}
                >
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>}

          {/* Module – Desktop/Tablet: Kachel-Grid, Mobil: gruppierte Listen */}
          {filteredCategories.map((category) => (
            <View key={category.label} style={{ marginBottom: isWide ? 28 : 18 }}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: colors.muted,
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                  marginBottom: 10,
                }}
              >
                {category.label}
              </Text>

              {useGrid ? (
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: tileGap,
                  }}
                >
                  {category.tiles.map((tile) => {
                    const tileWidth = `${100 / tileColumns - 1.5}%`;
                    return (
                      <TouchableOpacity
                        key={tile.id}
                        style={{
                          width: tileWidth as any,
                          flexGrow: 1,
                          backgroundColor: colors.surface,
                          borderRadius: 16,
                          padding: isWide ? 24 : 18,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                        onPress={() => {
                          if (tile.route) {
                            router.push(tile.route as any);
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <View
                          style={{
                            width: isWide ? 48 : 40,
                            height: isWide ? 48 : 40,
                            borderRadius: 14,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: tile.color + "18",
                            marginBottom: isWide ? 16 : 12,
                          }}
                        >
                          <IconSymbol
                            name={tile.icon as any}
                            size={isWide ? 24 : 20}
                            color={tile.color}
                          />
                        </View>
                        <Text
                          style={{
                            fontSize: isWide ? 17 : 15,
                            fontWeight: "700",
                            color: colors.foreground,
                            marginBottom: 2,
                          }}
                        >
                          {tile.title}
                        </Text>
                        <Text
                          style={{
                            fontSize: isWide ? 13 : 12,
                            color: colors.muted,
                          }}
                        >
                          {tile.subtitle}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                /* Mobil: eine Karte pro Kategorie mit Zeilen – kompakt und scannbar */
                <View
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: colors.border,
                    overflow: "hidden",
                  }}
                >
                  {category.tiles.map((tile, idx) => (
                    <TouchableOpacity
                      key={tile.id}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        gap: 12,
                        borderBottomWidth: idx < category.tiles.length - 1 ? 1 : 0,
                        borderBottomColor: colors.border,
                      }}
                      onPress={() => {
                        if (tile.route) {
                          router.push(tile.route as any);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: tile.color + "18",
                        }}
                      >
                        <IconSymbol name={tile.icon as any} size={18} color={tile.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>
                          {tile.title}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.muted, marginTop: 1 }} numberOfLines={1}>
                          {tile.subtitle}
                        </Text>
                      </View>
                      <IconSymbol name="chevron.right" size={14} color={colors.muted} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ))}

          {/* Letzte Aktivitäten (nur Admin) */}
          {isAdmin && <RecentActivities userId={user?.id} colors={colors} isWide={isWide} />}
        </View>
      </ScrollView>

      {/* FAB Overlay — Mobile only */}
      {!isWeb && showFabMenu && (
        <TouchableOpacity
          className="absolute inset-0 bg-black/40"
          activeOpacity={1}
          onPress={() => setShowFabMenu(false)}
        >
          <View className="absolute bottom-24 right-6 gap-3">
            {[
              {
                label: "Neuer Kunde",
                icon: "person.fill.badge.plus",
                onPress: () => {
                  setShowFabMenu(false);
                  setShowCustomerModal(true);
                },
              },
              {
                label: "Neues Ticket",
                icon: "ticket.fill",
                onPress: () => {
                  setShowFabMenu(false);
                  setShowTicketModal(true);
                },
              },
              {
                label: "Neue Rechnung",
                icon: "doc.text.fill",
                onPress: () => {
                  setShowFabMenu(false);
                  setShowInvoiceModal(true);
                },
              },
              {
                label: "Neues Angebot",
                icon: "doc.text.fill",
                onPress: () => {
                  setShowFabMenu(false);
                  setShowQuoteModal(true);
                },
              },
              {
                label: "Neues Projekt",
                icon: "folder.fill",
                onPress: () => {
                  setShowFabMenu(false);
                  setShowProjectModal(true);
                },
              },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                className="flex-row items-center justify-end gap-3"
                activeOpacity={0.7}
                onPress={item.onPress}
              >
                <View
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: 8,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    style={{
                      color: colors.foreground,
                      fontWeight: "600",
                      fontSize: 14,
                    }}
                  >
                    {item.label}
                  </Text>
                </View>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: colors.primary,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <IconSymbol
                    name={item.icon as any}
                    size={20}
                    color={colors.background}
                  />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      )}

      {/* FAB Button — Mobile only */}
      {!isWeb && (
        <TouchableOpacity
          style={{
            position: "absolute",
            bottom: 24,
            right: 24,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
            elevation: 8,
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
          }}
          activeOpacity={0.8}
          onPress={() => setShowFabMenu(!showFabMenu)}
        >
          <IconSymbol
            name={showFabMenu ? "xmark" : "plus"}
            size={28}
            color={colors.background}
          />
        </TouchableOpacity>
      )}

      {/* Modals */}
      <CustomerFormModal
        visible={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        onSuccess={() => { }}
      />
      <TicketFormModal
        visible={showTicketModal}
        onClose={() => setShowTicketModal(false)}
        onSuccess={() => { }}
      />
      <InvoiceFormModal
        visible={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        onSuccess={() => { }}
      />
      <QuoteFormModal
        visible={showQuoteModal}
        onClose={() => setShowQuoteModal(false)}
        onSuccess={() => { }}
      />
      <ProjectFormModal
        visible={showProjectModal}
        onClose={() => setShowProjectModal(false)}
        onSuccess={() => { }}
      />
      <AskCrmModal visible={showAskCrm} onClose={() => setShowAskCrm(false)} colors={colors} />
    </ScreenContainer>
  );
}

function RecentActivities({ userId, colors, isWide }: { userId?: string; colors: any; isWide: boolean }) {
  const { data: activities = [] } = useQuery({
    queryKey: ["recentActivities", userId],
    queryFn: async () => {
      const items: Array<{ id: string; title: string; message: string; created_at: string; type: string; is_read: boolean }> = [];

      // 1. Push-Notifications aus DB
      try {
        const { data: notifs } = await supabase
          .from("notifications")
          .select("id, title, message, created_at, is_read")
          .eq("user_id", userId!)
          .order("created_at", { ascending: false })
          .limit(5);
        if (notifs) {
          items.push(...notifs.map(n => ({ ...n, type: "notification" } as any)));
        }
      } catch (e: any) { console.error("[Activities] Notifications error:", e.message); }

      // 2. Neueste Rechnungen
      try {
        const { data: invoices } = await supabase
          .from("invoices")
          .select("id, invoice_number, total, status, created_at, customer:customers(company_name, first_name, last_name)")
          .order("created_at", { ascending: false })
          .limit(5);
        if (invoices) {
          items.push(...invoices.map((inv: any) => {
            const customerName = inv.customer?.company_name || `${inv.customer?.first_name || ""} ${inv.customer?.last_name || ""}`.trim() || "Unbekannt";
            const statusLabel = inv.status === "paid" ? "bezahlt" : inv.status === "overdue" ? "überfällig" : "erstellt";
            return {
              id: `inv-${inv.id}`,
              title: `Rechnung ${inv.invoice_number}`,
              message: `${customerName} — CHF ${(inv.total || 0).toFixed(2)} (${statusLabel})`,
              created_at: inv.created_at,
              type: "invoice",
              is_read: true,
            };
          }));
        }
      } catch (e: any) { console.error("[Activities] Invoices error:", e.message); }

      // 3. Neueste Tickets
      try {
        const { data: tickets } = await supabase
          .from("tickets")
          .select("id, title, status, created_at")
          .order("created_at", { ascending: false })
          .limit(5);
        if (tickets) {
          items.push(...tickets.map((t: any) => ({
            id: `tkt-${t.id}`,
            title: `Ticket: ${t.title}`,
            message: `Status: ${t.status === "open" ? "Offen" : t.status === "in_progress" ? "In Bearbeitung" : t.status === "closed" ? "Geschlossen" : t.status}`,
            created_at: t.created_at,
            type: "ticket",
            is_read: true,
          })));
        }
      } catch (e: any) { console.error("[Activities] Tickets error:", e.message); }

      // 4. Neueste Kunden
      try {
        const { data: customers } = await supabase
          .from("customers")
          .select("id, company_name, first_name, last_name, created_at")
          .order("created_at", { ascending: false })
          .limit(3);
        if (customers) {
          items.push(...customers.map((c: any) => ({
            id: `cust-${c.id}`,
            title: "Neuer Kunde",
            message: c.company_name || `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Unbekannt",
            created_at: c.created_at,
            type: "customer",
            is_read: true,
          })));
        }
      } catch (e: any) { console.error("[Activities] Customers error:", e.message); }

      // Sortiere nach Datum (neueste zuerst) und limit auf 8
      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return items.slice(0, 8);
    },
    enabled: !!userId,
    refetchInterval: 30000,
  });

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Gerade eben";
    if (mins < 60) return `Vor ${mins} Min.`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `Vor ${hrs} Std.`;
    const days = Math.floor(hrs / 24);
    return `Vor ${days} Tag${days > 1 ? "en" : ""}`;
  };

  if (activities.length === 0) return null;

  return (
    <View style={{ marginTop: isWide ? 12 : 8 }}>
      <Text style={{ fontSize: 11, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>
        Letzte Aktivitäten
      </Text>
      <View style={{ backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
        {activities.map((item: any, index: number) => {
          const dotColor = item.type === "notification" ? (item.is_read ? colors.muted : colors.primary)
            : item.type === "invoice" ? "#22c55e"
              : item.type === "ticket" ? "#f59e0b"
                : item.type === "customer" ? "#8b5cf6"
                  : colors.muted;
          return (
            <View key={item.id} style={{ flexDirection: "row", alignItems: "flex-start", padding: 12, borderBottomWidth: index < activities.length - 1 ? 1 : 0, borderBottomColor: colors.border, gap: 10 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dotColor, marginTop: 5 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }} numberOfLines={1}>{item.title}</Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }} numberOfLines={2}>{item.message}</Text>
              </View>
              <Text style={{ fontSize: 11, color: colors.muted }}>{timeAgo(item.created_at)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Meine Woche: dem angemeldeten Benutzer zugewiesene offene Arbeit ──
function MyWeekCard({ userId, colors, isWide }: { userId: string; colors: any; isWide: boolean }) {
  const router = useRouter();
  const { data } = useQuery({
    queryKey: ["myWeek", userId],
    queryFn: () => Data.getMyWeek(userId),
    refetchInterval: 120000,
  });

  const tickets = data?.tickets || [];
  const tasks = data?.tasks || [];
  const leads = data?.leads || [];
  const isEmpty = tickets.length === 0 && tasks.length === 0 && leads.length === 0;

  const fmtShort = (d?: string | null) => {
    if (!d) return "";
    const p = String(d).split("T")[0].split("-");
    return p.length === 3 ? ` · ${p[2]}.${p[1]}.` : "";
  };

  const Row = ({ icon, color, title, subtitle, onPress }: any) => (
    <TouchableOpacity
      style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border + "40" }}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: color + "18", alignItems: "center", justifyContent: "center" }}>
        <IconSymbol name={icon} size={14} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }} numberOfLines={1}>{title}</Text>
        <Text style={{ fontSize: 11, color: colors.muted }} numberOfLines={1}>{subtitle}</Text>
      </View>
      <IconSymbol name="chevron.right" size={12} color={colors.muted} />
    </TouchableOpacity>
  );

  return (
    <View style={{ marginBottom: isWide ? 24 : 18 }}>
      <Text style={{ fontSize: 11, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>
        Meine Woche
      </Text>
      <View style={{ backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 6 }}>
        {isEmpty ? (
          <Text style={{ fontSize: 13, color: colors.muted, paddingVertical: 10 }}>
            Ihnen sind aktuell keine Tickets, Aufgaben oder Follow-ups zugewiesen.
          </Text>
        ) : null}
        {tickets.map((t: any) => (
          <Row
            key={`t-${t.id}`} icon="ticket.fill" color="#F59E0B"
            title={t.title}
            subtitle={`Mir zugewiesen · ${t.status === "open" ? "Offen" : t.status === "in_progress" ? "In Bearbeitung" : "Wartend"}${fmtShort(t.due_date)}`}
            onPress={() => router.push(`/tickets?ticketId=${t.id}` as any)}
          />
        ))}
        {tasks.map((t: any) => (
          <Row
            key={`a-${t.id}`} icon="checklist" color="#8B5CF6"
            title={t.title}
            subtitle={`Aufgabe${fmtShort(t.due_date)}`}
            onPress={() => router.push("/tasks" as any)}
          />
        ))}
        {leads.map((l: any) => (
          <Row
            key={`l-${l.id}`} icon="flag.fill" color="#0EA5E9"
            title={l.company || l.name}
            subtitle={`Follow-up: ${l.next_action || "fällig"}${fmtShort(l.next_action_date)}`}
            onPress={() => router.push(`/leads?leadId=${l.id}` as any)}
          />
        ))}
      </View>
    </View>
  );
}

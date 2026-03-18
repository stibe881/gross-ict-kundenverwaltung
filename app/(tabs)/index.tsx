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
} from "react-native";
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
import { useQuery } from "@tanstack/react-query";
import * as Data from "@/lib/data";

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
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
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

  // Global search with debounce
  const performSearch = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const results: any[] = [];
    const q = `%${query}%`;
    try {
      // Customers
      const { data: customers } = await supabase
        .from("customers")
        .select("id, company_name, first_name, last_name, email")
        .or(`company_name.ilike.${q},first_name.ilike.${q},last_name.ilike.${q},email.ilike.${q}`)
        .limit(5);
      if (customers) {
        results.push(...customers.map((c: any) => ({
          id: c.id, type: "customer", icon: "person.2.fill", color: colors.primary,
          title: c.company_name || `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Unbekannt",
          subtitle: c.email || "Kunde",
          route: `/customer/${c.id}`,
        })));
      }
      // Tickets
      const { data: tickets } = await supabase
        .from("tickets")
        .select("id, title, status")
        .ilike("title", q)
        .limit(5);
      if (tickets) {
        results.push(...tickets.map((t: any) => ({
          id: t.id, type: "ticket", icon: "ticket.fill", color: colors.warning,
          title: t.title,
          subtitle: `Ticket · ${t.status === "open" ? "Offen" : t.status === "in_progress" ? "In Bearbeitung" : t.status === "closed" ? "Geschlossen" : t.status}`,
          route: "/tickets",
        })));
      }
      // Invoices
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, invoice_number, status, total")
        .ilike("invoice_number", q)
        .limit(5);
      if (invoices) {
        results.push(...invoices.map((inv: any) => ({
          id: inv.id, type: "invoice", icon: "doc.text.fill", color: colors.success,
          title: inv.invoice_number,
          subtitle: `Rechnung · CHF ${(inv.total || 0).toFixed(2)}`,
          route: `/invoice/${inv.id}`,
        })));
      }
      // Quotes
      const { data: quotes } = await supabase
        .from("quotes")
        .select("id, quote_number, status, total")
        .ilike("quote_number", q)
        .limit(5);
      if (quotes) {
        results.push(...quotes.map((qa: any) => ({
          id: qa.id, type: "quote", icon: "doc.text.fill", color: "#EC4899",
          title: qa.quote_number,
          subtitle: `Angebot · CHF ${(qa.total || 0).toFixed(2)}`,
          route: `/quote/${qa.id}`,
        })));
      }
    } catch (e) {
      console.warn("[Search] Error:", e);
    }
    setSearchResults(results);
    setSearching(false);
  }, [colors]);

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
        {
          id: "quotes",
          title: "Angebote",
          subtitle: "Offerten erstellen",
          icon: "doc.text.fill",
          color: "#EC4899",
          route: "/quotes",
        },
        {
          id: "contracts",
          title: "Verträge",
          subtitle: "Verwaltung",
          icon: "doc.text.fill",
          color: "#6366F1",
          route: "/contracts",
        },
      ],
    },
    {
      label: "Support & Kommunikation",
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
        {
          id: "newsletter",
          title: "Newsletter",
          subtitle: "Bald verfügbar",
          icon: "envelope.fill",
          color: "#A855F7",
          route: "/newsletter",
        },
      ],
    },
    {
      label: "Projektmanagement",
      tiles: [
        {
          id: "projects",
          title: "Projekte",
          subtitle: "Auftragsverwaltung",
          icon: "folder.fill",
          color: "#14B8A6",
          route: "/projects",
        },
        {
          id: "tasks",
          title: "Aufgaben",
          subtitle: "Interne To-Dos",
          icon: "checklist",
          color: "#8B5CF6",
          route: "/tasks",
        },
      ],
    },
    {
      label: "Konfiguration",
      tiles: [
        {
          id: "products",
          title: "Produkte",
          subtitle: "Leistungskatalog",
          icon: "cube.box.fill",
          color: "#F97316",
          route: "/products",
        },
        {
          id: "dunning",
          title: "Rechnungen",
          subtitle: "Mahnwesen & Einstellungen",
          icon: "doc.text.fill",
          color: "#DC2626",
          route: "/dunning-settings",
        },
        {
          id: "business-card",
          title: "Visitenkarte",
          subtitle: "Apple Wallet",
          icon: "person.crop.rectangle.fill",
          color: "#0EA5E9",
          route: "/business-card",
        },
        {
          id: "users",
          title: "Benutzer & Rollen",
          subtitle: "Mitarbeitende",
          icon: "person.2.fill",
          color: "#6366F1",
          route: "/users",
        },
      ],
    },
  ];

  const allowedTileIds = Data.getAllowedTileIds(
    userProfile?.roles || []
  );

  // Filter tiles by role
  const filteredCategories = tileCategories
    .map((cat) => ({
      ...cat,
      tiles: allowedTileIds
        ? cat.tiles.filter((t) => allowedTileIds.includes(t.id))
        : cat.tiles,
    }))
    .filter((cat) => cat.tiles.length > 0);

  // Tile column count based on screen width
  const tileColumns = isWide ? 4 : isMedium ? 3 : 2;
  const tileGap = isWide ? 16 : 12;

  return (
    <ScreenContainer>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: isWide ? 32 : 16,
          paddingBottom: 100,
        }}
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
              marginBottom: isWide ? 32 : 20,
              paddingTop: isWide ? 8 : 0,
            }}
          >
            <View style={{ flex: 1 }}>
              {isWeb ? (
                <Image
                  source={require("@/assets/images/android-icon-foreground.png")}
                  style={{ width: isWide ? 220 : 180, height: isWide ? 48 : 40 }}
                  resizeMode="contain"
                />
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 }}>
                  <Image
                    source={require("@/assets/images/icon.png")}
                    style={{ width: 32, height: 32, borderRadius: 8 }}
                    resizeMode="contain"
                  />
                  <Text
                    style={{
                      fontSize: 22,
                      fontWeight: "800",
                      color: colors.foreground,
                      letterSpacing: -0.5,
                    }}
                  >
                    Gross • ICT
                  </Text>
                </View>
              )}
              <Text
                style={{
                  fontSize: isWide ? 16 : 14,
                  color: colors.muted,
                  marginTop: 6,
                }}
              >
                Willkommen, {userName}
              </Text>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
              <TouchableOpacity
                onPress={() => router.push("/admin-notifications")}
                style={{ position: "relative" }}
                activeOpacity={0.7}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <IconSymbol
                    name="bell.fill"
                    size={20}
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
          <View style={{ marginBottom: isWide ? 24 : 16, position: "relative", zIndex: 100 }}>
            <View style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              padding: 12,
              flexDirection: "row",
              alignItems: "center",
              borderWidth: 1,
              borderColor: globalSearch ? colors.primary + "60" : colors.border,
            }}>
              <IconSymbol name="magnifyingglass" size={20} color={colors.muted} />
              <TextInput
                style={{ flex: 1, marginLeft: 10, fontSize: 15, color: colors.foreground }}
                placeholder="Kunden, Tickets, Rechnungen suchen..."
                placeholderTextColor={colors.muted}
                value={globalSearch}
                onChangeText={handleSearchChange}
              />
              {globalSearch.length > 0 && (
                <TouchableOpacity onPress={() => { setGlobalSearch(""); setSearchResults([]); }}>
                  <IconSymbol name="xmark.circle.fill" size={20} color={colors.muted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Search Results Dropdown */}
            {(searchResults.length > 0 || (searching && globalSearch.length >= 2)) && (
              <View style={{
                position: "absolute", top: 56, left: 0, right: 0,
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
          </View>

          {/* Quick Actions Bar - nur Web/Desktop, mobil hat FAB */}
          {isWeb && <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: isWide ? 32 : 20 }}
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

          {/* Categorized Tiles */}
          {filteredCategories.map((category) => (
            <View key={category.label} style={{ marginBottom: isWide ? 28 : 20 }}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: colors.muted,
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                  marginBottom: 12,
                }}
              >
                {category.label}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: tileGap,
                }}
              >
                {category.tiles.map((tile) => {
                  // Calculate tile width for responsive grid
                  const tileWidth = isWide
                    ? `${100 / tileColumns - 1.5}%`
                    : isMedium
                      ? `${100 / tileColumns - 1.5}%`
                      : "47%";

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
            </View>
          ))}


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
    </ScreenContainer>
  );
}

function getRoleLabel(role?: string): string {
  const roleLabels: Record<string, string> = {
    admin: "Administrator",
    manager: "Manager",
    accountant: "Buchhalter",
    sales: "Vertrieb",
    support: "Support",
  };
  return roleLabels[role || ""] || "Unbekannt";
}

function RecentActivities({ userId, colors, isWide }: { userId?: string; colors: any; isWide: boolean }) {
  const { data: activities = [] } = useQuery({
    queryKey: ["recentActivities", userId],
    queryFn: async () => {
      console.log("[Activities] v2 - Fetching business data...");
      const items: Array<{ id: string; title: string; message: string; created_at: string; type: string; is_read: boolean }> = [];

      // 1. Push-Notifications aus DB
      try {
        const { data: notifs, error: nErr } = await supabase
          .from("notifications")
          .select("id, title, message, created_at, is_read")
          .eq("user_id", userId!)
          .order("created_at", { ascending: false })
          .limit(5);
        console.log("[Activities] Notifications:", notifs?.length || 0, nErr?.message || "ok");
        if (notifs) {
          items.push(...notifs.map(n => ({ ...n, type: "notification" })));
        }
      } catch (e: any) { console.error("[Activities] Notifications error:", e.message); }

      // 2. Neueste Rechnungen
      try {
        const { data: invoices, error: iErr } = await supabase
          .from("invoices")
          .select("id, invoice_number, total, status, created_at, customer:customers(company_name, first_name, last_name)")
          .order("created_at", { ascending: false })
          .limit(5);
        console.log("[Activities] Invoices:", invoices?.length || 0, iErr?.message || "ok");
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
        const { data: tickets, error: tErr } = await supabase
          .from("tickets")
          .select("id, title, status, created_at")
          .order("created_at", { ascending: false })
          .limit(5);
        console.log("[Activities] Tickets:", tickets?.length || 0, tErr?.message || "ok");
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
        const { data: customers, error: cErr } = await supabase
          .from("customers")
          .select("id, company_name, first_name, last_name, created_at")
          .order("created_at", { ascending: false })
          .limit(3);
        console.log("[Activities] Customers:", customers?.length || 0, cErr?.message || "ok");
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
      console.log("[Activities] Total items:", items.length);
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

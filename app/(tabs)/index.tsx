import { useState, useEffect } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  Image,
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
          id: "newsletter",
          title: "Newsletter",
          subtitle: "Bald verfügbar",
          icon: "envelope.fill",
          color: "#8B5CF6",
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
      ],
    },
  ];

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

          {/* Quick Actions Bar */}
          <ScrollView
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
          </ScrollView>

          {/* Categorized Tiles */}
          {tileCategories.map((category) => (
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

          {/* Letzte Aktivitäten */}
          <RecentActivities userId={user?.id} colors={colors} isWide={isWide} />
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
                    color="#111111"
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
            color="#111111"
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

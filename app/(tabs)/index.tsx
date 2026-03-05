import { useState, useEffect } from "react";
import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator } from "react-native";
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


interface DashboardTile {
  id: string;
  title: string;
  value: string;
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  const tiles: DashboardTile[] = [
    {
      id: "customers",
      title: "Kunden",
      value: "Verwalten",
      icon: "person.2.fill",
      color: colors.primary,
      route: "/customers",
    },
    {
      id: "leads",
      title: "Akquise",
      value: "Pipeline",
      icon: "briefcase.fill",
      color: "#17A2B8",
      route: "/leads",
    },
    {
      id: "tickets",
      title: "Tickets",
      value: "Support",
      icon: "ticket.fill",
      color: colors.warning,
      route: "/tickets",
    },
    {
      id: "accounting",
      title: "Buchhaltung",
      value: "Rechnungen",
      icon: "chart.bar.fill",
      color: colors.success,
      route: "/accounting",
    },
    {
      id: "contracts",
      title: "Verträge",
      value: "Verwaltung",
      icon: "doc.text.fill",
      color: "#6366F1",
      route: "/contracts",
    },
    {
      id: "newsletter",
      title: "Newsletter",
      value: "Kampagnen",
      icon: "envelope.fill",
      color: "#8B5CF6",
      route: "/newsletter",
    },
    {
      id: "quotes",
      title: "Angebote",
      value: "Offerten",
      icon: "doc.text.fill",
      color: "#EC4899",
      route: "/quotes",
    },
  ];

  // Admin-spezifische Kacheln
  const adminTiles: DashboardTile[] = [
    {
      id: "users",
      title: "Benutzerverwaltung",
      value: "Admin",
      icon: "gear",
      color: "#EF4444",
      route: "/users",
    },
  ];

  // Kombiniere Kacheln basierend auf Benutzerrolle
  const allTiles = (user as any)?.role === "admin" ? [...tiles, ...adminTiles] : tiles;

  return (
    <ScreenContainer>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        {/* Header */}
        <View className="mb-6">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-3xl font-bold text-foreground">Dashboard</Text>
            <LogoutButton />
          </View>
          <Text className="text-base text-muted mt-1">
            Willkommen zurück
          </Text>
        </View>

        {/* Kacheln Grid */}
        <View className="gap-4">
          {allTiles.map((tile) => (
            <TouchableOpacity
              key={tile.id}
              className="bg-surface rounded-2xl p-6 border border-border"
              style={{ opacity: 1 }}
              onPress={() => {
                if (tile.route) {
                  router.push(tile.route as any);
                }
              }}
              activeOpacity={0.7}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-lg font-semibold text-foreground mb-1">
                    {tile.title}
                  </Text>
                  <Text className="text-sm text-muted">{tile.value}</Text>
                </View>
                <View
                  className="w-12 h-12 rounded-full items-center justify-center"
                  style={{ backgroundColor: tile.color + "20" }}
                >
                  <IconSymbol name={tile.icon} size={24} color={tile.color} />
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Schnellzugriff */}
        <View className="mt-8">
          <Text className="text-xl font-bold text-foreground mb-4">Schnellzugriff</Text>
          <View className="gap-3">
            <TouchableOpacity
              className="bg-primary px-4 py-3 rounded-lg flex-row items-center"
              activeOpacity={0.8}
              onPress={() => setShowCustomerModal(true)}
            >
              <IconSymbol name="plus.circle.fill" size={20} color="#FFFFFF" />
              <Text className="text-background font-semibold ml-2">Neuer Kunde</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-surface px-4 py-3 rounded-lg flex-row items-center border border-border"
              activeOpacity={0.8}
              onPress={() => setShowTicketModal(true)}
            >
              <IconSymbol name="plus.circle.fill" size={20} color={colors.primary} />
              <Text className="text-foreground font-semibold ml-2">Neues Ticket</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-surface px-4 py-3 rounded-lg flex-row items-center border border-border"
              activeOpacity={0.8}
              onPress={() => setShowInvoiceModal(true)}
            >
              <IconSymbol name="plus.circle.fill" size={20} color={colors.primary} />
              <Text className="text-foreground font-semibold ml-2">Neue Rechnung</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-surface px-4 py-3 rounded-lg flex-row items-center border border-border"
              activeOpacity={0.8}
              onPress={() => setShowQuoteModal(true)}
            >
              <IconSymbol name="plus.circle.fill" size={20} color={colors.primary} />
              <Text className="text-foreground font-semibold ml-2">Neues Angebot</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

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

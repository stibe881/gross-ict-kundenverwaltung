import { useState, useEffect } from "react";
import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, Animated } from "react-native";
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
  const [showFabMenu, setShowFabMenu] = useState(false);

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

  const tileCategories = [
    {
      label: "CRM",
      tiles: [
        { id: "customers", title: "Kunden", value: "Verwalten", icon: "person.2.fill", color: colors.primary, route: "/customers" },
        { id: "leads", title: "Akquise", value: "Pipeline", icon: "briefcase.fill", color: "#17A2B8", route: "/leads" },
      ],
    },
    {
      label: "Finanzen",
      tiles: [
        { id: "accounting", title: "Buchhaltung", value: "Rechnungen", icon: "chart.bar.fill", color: colors.success, route: "/accounting" },
        { id: "quotes", title: "Angebote", value: "Offerten", icon: "doc.text.fill", color: "#EC4899", route: "/quotes" },
        { id: "contracts", title: "Verträge", value: "Verwaltung", icon: "doc.text.fill", color: "#6366F1", route: "/contracts" },
      ],
    },
    {
      label: "Support & Kommunikation",
      tiles: [
        { id: "tickets", title: "Tickets", value: "Support", icon: "ticket.fill", color: colors.warning, route: "/tickets" },
        { id: "newsletter", title: "Newsletter", value: "Kampagnen", icon: "envelope.fill", color: "#8B5CF6", route: "/newsletter" },
      ],
    },
  ];

  // Admin-spezifische Kacheln
  if ((user as any)?.role === "admin") {
    tileCategories.push({
      label: "Administration",
      tiles: [
        { id: "users", title: "Benutzerverwaltung", value: "Admin", icon: "gear", color: "#EF4444", route: "/users" },
      ],
    });
  }

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

        {/* Kategorisierte Kacheln */}
        {tileCategories.map((category) => (
          <View key={category.label} className="mb-6">
            <Text className="text-sm font-bold text-muted uppercase tracking-wider mb-3">
              {category.label}
            </Text>
            <View className="flex-row flex-wrap gap-3">
              {category.tiles.map((tile) => (
                <TouchableOpacity
                  key={tile.id}
                  className="bg-surface rounded-2xl p-5 border border-border"
                  style={{ width: '48%', flexGrow: 1 }}
                  onPress={() => {
                    if (tile.route) {
                      router.push(tile.route as any);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View
                    className="w-10 h-10 rounded-xl items-center justify-center mb-3"
                    style={{ backgroundColor: tile.color + "20" }}
                  >
                    <IconSymbol name={tile.icon as any} size={20} color={tile.color} />
                  </View>
                  <Text className="text-base font-semibold text-foreground">{tile.title}</Text>
                  <Text className="text-xs text-muted mt-1">{tile.value}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* FAB Overlay */}
      {showFabMenu && (
        <TouchableOpacity
          className="absolute inset-0 bg-black/40"
          activeOpacity={1}
          onPress={() => setShowFabMenu(false)}
        >
          <View className="absolute bottom-24 right-6 gap-3">
            {[
              { label: "Neuer Kunde", icon: "person.fill.badge.plus", onPress: () => { setShowFabMenu(false); setShowCustomerModal(true); } },
              { label: "Neues Ticket", icon: "ticket.fill", onPress: () => { setShowFabMenu(false); setShowTicketModal(true); } },
              { label: "Neue Rechnung", icon: "doc.text.fill", onPress: () => { setShowFabMenu(false); setShowInvoiceModal(true); } },
              { label: "Neues Angebot", icon: "doc.text.fill", onPress: () => { setShowFabMenu(false); setShowQuoteModal(true); } },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                className="flex-row items-center justify-end gap-3"
                activeOpacity={0.7}
                onPress={item.onPress}
              >
                <View className="bg-surface rounded-lg px-4 py-2.5 border border-border shadow-lg">
                  <Text className="text-foreground font-semibold text-sm">{item.label}</Text>
                </View>
                <View
                  className="w-11 h-11 rounded-full items-center justify-center shadow-lg"
                  style={{ backgroundColor: colors.primary }}
                >
                  <IconSymbol name={item.icon as any} size={20} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      )}

      {/* FAB Button */}
      <TouchableOpacity
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full items-center justify-center shadow-lg"
        style={{ backgroundColor: colors.primary, elevation: 8 }}
        activeOpacity={0.8}
        onPress={() => setShowFabMenu(!showFabMenu)}
      >
        <IconSymbol
          name={showFabMenu ? "xmark" : "plus"}
          size={28}
          color="#FFFFFF"
        />
      </TouchableOpacity>

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

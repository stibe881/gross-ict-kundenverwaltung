import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { formatDate, formatCurrency } from "@/lib/format";
import { CustomerPortalManagement } from "@/components/customer-portal-management";
import { trpc } from "@/lib/trpc";

type Tab = "stammdaten" | "kommunikation" | "vertraege" | "rechnungen" | "tickets" | "portal";

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams();
  const colors = useColors();
  const [activeTab, setActiveTab] = useState<Tab>("stammdaten");
  const [loading, setLoading] = useState(false);
  const [portalEnabled, setPortalEnabled] = useState(false);

  // Kundendaten aus Supabase laden
  const { data: customer, isLoading } = trpc.customers.getById.useQuery({
    id: id as string,
  });

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "stammdaten", label: "Stammdaten", icon: "person.2.fill" },
    { key: "kommunikation", label: "Kommunikation", icon: "envelope.fill" },
    { key: "vertraege", label: "Verträge", icon: "doc.text.fill" },
    { key: "rechnungen", label: "Rechnungen", icon: "chart.bar.fill" },
    { key: "tickets", label: "Tickets", icon: "ticket.fill" },
    { key: "portal", label: "Portal", icon: "person.2.fill" },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case "stammdaten":
        return (
          <View className="gap-4">
            <View className="bg-surface p-4 rounded-lg border border-border">
              <Text className="text-sm font-semibold text-muted mb-2">
                Firma
              </Text>
              <Text className="text-base text-foreground">
                {customer?.companyName || "Keine Firma"}
              </Text>
            </View>

            <View className="bg-surface p-4 rounded-lg border border-border">
              <Text className="text-sm font-semibold text-muted mb-2">
                Kontaktperson
              </Text>
              <Text className="text-base text-foreground">
                {`${customer?.firstName || ""} ${customer?.lastName || ""}`.trim() || "Kein Name"}
              </Text>
            </View>

            <View className="bg-surface p-4 rounded-lg border border-border">
              <Text className="text-sm font-semibold text-muted mb-2">
                E-Mail
              </Text>
              <Text className="text-base text-foreground">
                {customer?.email || "Keine E-Mail"}
              </Text>
            </View>

            <View className="bg-surface p-4 rounded-lg border border-border">
              <Text className="text-sm font-semibold text-muted mb-2">
                Telefon
              </Text>
              <Text className="text-base text-foreground">
                {customer?.phone || "Kein Telefon"}
              </Text>
            </View>

            <View className="bg-surface p-4 rounded-lg border border-border">
              <Text className="text-sm font-semibold text-muted mb-2">
                Adresse
              </Text>
              <Text className="text-base text-foreground">
                {[customer?.address, customer?.postalCode, customer?.city].filter(Boolean).join(", ") || "Keine Adresse"}
              </Text>
            </View>

            <View className="bg-surface p-4 rounded-lg border border-border">
              <Text className="text-sm font-semibold text-muted mb-2">
                Notizen
              </Text>
              <Text className="text-base text-foreground">
                {customer?.notes || "Keine Notizen"}
              </Text>
            </View>

            <View className="bg-surface p-4 rounded-lg border border-border">
              <Text className="text-sm font-semibold text-muted mb-2">
                Kunde seit
              </Text>
              <Text className="text-base text-foreground">
                {customer?.createdAt ? formatDate(customer.createdAt) : "Unbekannt"}
              </Text>
            </View>
          </View>
        );

      case "kommunikation":
        return (
          <View className="flex-1 items-center justify-center py-12">
            <IconSymbol name="envelope.fill" size={48} color={colors.muted} />
            <Text className="text-lg text-muted mt-4 mb-2">Keine Kommunikation vorhanden</Text>
            <Text className="text-sm text-muted text-center mb-4">
              Die Kommunikationshistorie wird hier angezeigt
            </Text>
            <TouchableOpacity
              className="bg-primary py-3 px-6 rounded-lg"
              activeOpacity={0.8}
            >
              <Text className="text-background font-semibold text-center">
                Neue Kommunikation erfassen
              </Text>
            </TouchableOpacity>
          </View>
        );

      case "vertraege":
        return (
          <View className="flex-1 items-center justify-center py-12">
            <IconSymbol name="doc.text.fill" size={48} color={colors.muted} />
            <Text className="text-lg text-muted mt-4">Keine Verträge vorhanden</Text>
            <Text className="text-sm text-muted text-center mt-2">
              Verträge werden hier angezeigt
            </Text>
          </View>
        );

      case "rechnungen":
        return (
          <View className="flex-1 items-center justify-center py-12">
            <IconSymbol name="chart.bar.fill" size={48} color={colors.muted} />
            <Text className="text-lg text-muted mt-4">Keine Rechnungen vorhanden</Text>
            <Text className="text-sm text-muted text-center mt-2">
              Rechnungen werden hier angezeigt
            </Text>
          </View>
        );

      case "tickets":
        return (
          <View className="gap-4">
            {/* Beispiel-Tickets */}
            {[
              {
                id: 1,
                title: "Passwort zurücksetzen",
                status: "open",
                priority: "high",
                createdAt: "2024-02-03",
              },
              {
                id: 2,
                title: "Frage zur Rechnung",
                status: "in_progress",
                priority: "medium",
                createdAt: "2024-01-30",
              },
              {
                id: 3,
                title: "Technisches Problem",
                status: "closed",
                priority: "low",
                createdAt: "2024-01-25",
              },
            ].map((ticket) => (
              <View
                key={ticket.id}
                className="bg-surface p-4 rounded-lg border border-border"
              >
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-base font-semibold text-foreground">
                    {ticket.title}
                  </Text>
                  <View
                    className={`px-3 py-1 rounded-full ${ticket.priority === "high"
                      ? "bg-error/20"
                      : ticket.priority === "medium"
                        ? "bg-warning/20"
                        : "bg-success/20"
                      }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${ticket.priority === "high"
                        ? "text-error"
                        : ticket.priority === "medium"
                          ? "text-warning"
                          : "text-success"
                        }`}
                    >
                      {ticket.priority === "high"
                        ? "Hoch"
                        : ticket.priority === "medium"
                          ? "Mittel"
                          : "Niedrig"}
                    </Text>
                  </View>
                </View>
                <View className="flex-row items-center gap-2">
                  <View
                    className={`px-3 py-1 rounded-full ${ticket.status === "open"
                      ? "bg-warning/20"
                      : ticket.status === "in_progress"
                        ? "bg-primary/20"
                        : "bg-success/20"
                      }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${ticket.status === "open"
                        ? "text-warning"
                        : ticket.status === "in_progress"
                          ? "text-primary"
                          : "text-success"
                        }`}
                    >
                      {ticket.status === "open"
                        ? "Offen"
                        : ticket.status === "in_progress"
                          ? "In Bearbeitung"
                          : "Geschlossen"}
                    </Text>
                  </View>
                  <Text className="text-sm text-muted">
                    {formatDate(ticket.createdAt)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        );

      case "portal":
        return (
          <CustomerPortalManagement
            customerId={id as string}
            portalEnabled={portalEnabled}
            onPortalToggle={setPortalEnabled}
          />
        );

      default:
        return null;
    }
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="p-4 border-b border-border">
        <View className="flex-row items-center gap-3 mb-4">
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <IconSymbol
              name="chevron.left"
              size={24}
              color={colors.foreground}
            />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-2xl font-bold text-foreground">
              {customer?.companyName || `${customer?.firstName || ""} ${customer?.lastName || ""}`.trim() || "Kunde"}
            </Text>
            <Text className="text-sm text-muted">{customer?.email || "Keine E-Mail"}</Text>
          </View>
        </View>

        {/* Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="flex-row gap-2"
        >
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg ${activeTab === tab.key
                ? "bg-primary"
                : "bg-surface border border-border"
                }`}
              activeOpacity={0.7}
            >
              <Text
                className={`text-sm font-semibold ${activeTab === tab.key ? "text-background" : "text-foreground"
                  }`}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView className="flex-1 p-4">
        {loading ? (
          <View className="flex-1 items-center justify-center py-12">
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          renderTabContent()
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

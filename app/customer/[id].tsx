import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { showAlert, showConfirm } from "@/lib/alert";
import { useLocalSearchParams, router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { formatDate, formatCurrency } from "@/lib/format";
import { CustomerPortalManagement } from "@/components/customer-portal-management";

type Tab = "stammdaten" | "kommunikation" | "vertraege" | "rechnungen" | "tickets" | "portal";

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams();
  const colors = useColors();
  const [activeTab, setActiveTab] = useState<Tab>("stammdaten");
  const [portalEnabled, setPortalEnabled] = useState(false);

  // Kundendaten aus Supabase laden
  const { data: customer, isLoading: loading } = trpc.customers.getById.useQuery(
    { id: id as string },
    { enabled: !!id }
  );

  // Kunde löschen
  const deleteCustomer = trpc.customers.delete.useMutation({
    onSuccess: () => {
      showAlert("Erfolg", "Kunde wurde erfolgreich gelöscht");
      router.back();
    },
    onError: (error) => {
      showAlert("Fehler", `Kunde konnte nicht gelöscht werden: ${error.message}`);
    },
  });

  // Kundenstatus ändern
  const utils = trpc.useUtils();
  const updateCustomer = trpc.customers.update.useMutation({
    onSuccess: () => {
      utils.customers.getById.invalidate({ id: id as string });
      utils.customers.list.invalidate();
      showAlert("Erfolg", "Kundenstatus wurde geändert");
    },
    onError: (error) => {
      showAlert("Fehler", `Status konnte nicht geändert werden: ${error.message}`);
    },
  });

  const handleToggleStatus = () => {
    const newStatus = customer?.status === "active" ? "inactive" : "active";
    const label = newStatus === "active" ? "aktivieren" : "deaktivieren";
    showConfirm(
      "Status ändern",
      `Möchten Sie diesen Kunden wirklich ${label}?`,
      () => updateCustomer.mutate({ id: id as string, status: newStatus }),
      newStatus === "active" ? "Aktivieren" : "Deaktivieren"
    );
  };

  const handleDelete = () => {
    const displayName =
      customer?.company_name ||
      `${customer?.first_name || ""} ${customer?.last_name || ""}`.trim() ||
      "Dieser Kunde";
    showConfirm(
      "Kunde löschen",
      `Möchten Sie "${displayName}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`,
      () => deleteCustomer.mutate({ id: id as string }),
      "Löschen"
    );
  };

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
            {/* Status */}
            <TouchableOpacity
              onPress={handleToggleStatus}
              activeOpacity={0.7}
              className="bg-surface p-4 rounded-lg border border-border flex-row items-center justify-between"
            >
              <View>
                <Text className="text-sm font-semibold text-muted mb-2">
                  Status
                </Text>
                <View className={`px-3 py-1 rounded-full self-start ${customer?.status === "active" ? "bg-success" : "bg-muted"}`}>
                  <Text className="text-xs font-semibold text-white">
                    {customer?.status === "active" ? "Aktiv" : "Inaktiv"}
                  </Text>
                </View>
              </View>
              <IconSymbol name="chevron.right" size={16} color={colors.muted} />
            </TouchableOpacity>

            {customer?.company_name ? (
              <View className="bg-surface p-4 rounded-lg border border-border">
                <Text className="text-sm font-semibold text-muted mb-2">
                  Firma
                </Text>
                <Text className="text-base text-foreground">
                  {customer.company_name}
                </Text>
              </View>
            ) : null}

            {(customer?.first_name || customer?.last_name) ? (
              <View className="bg-surface p-4 rounded-lg border border-border">
                <Text className="text-sm font-semibold text-muted mb-2">
                  Kontaktperson
                </Text>
                <Text className="text-base text-foreground">
                  {`${customer?.first_name || ""} ${customer?.last_name || ""}`.trim()}
                </Text>
              </View>
            ) : null}

            {customer?.email ? (
              <View className="bg-surface p-4 rounded-lg border border-border">
                <Text className="text-sm font-semibold text-muted mb-2">
                  E-Mail
                </Text>
                <Text className="text-base text-foreground">
                  {customer.email}
                </Text>
              </View>
            ) : null}

            {customer?.phone ? (
              <View className="bg-surface p-4 rounded-lg border border-border">
                <Text className="text-sm font-semibold text-muted mb-2">
                  Telefon
                </Text>
                <Text className="text-base text-foreground">
                  {customer.phone}
                </Text>
              </View>
            ) : null}

            {customer?.address ? (
              <View className="bg-surface p-4 rounded-lg border border-border">
                <Text className="text-sm font-semibold text-muted mb-2">
                  Adresse
                </Text>
                <Text className="text-base text-foreground">
                  {customer.address}
                  {customer.postal_code || customer.city
                    ? `\n${customer.postal_code || ""} ${customer.city || ""}`.trim()
                    : ""}
                  {customer.country ? `\n${customer.country}` : ""}
                </Text>
              </View>
            ) : null}

            {customer?.notes ? (
              <View className="bg-surface p-4 rounded-lg border border-border">
                <Text className="text-sm font-semibold text-muted mb-2">
                  Notizen
                </Text>
                <Text className="text-base text-foreground">
                  {customer.notes}
                </Text>
              </View>
            ) : null}

            {customer?.created_at ? (
              <View className="bg-surface p-4 rounded-lg border border-border">
                <Text className="text-sm font-semibold text-muted mb-2">
                  Kunde seit
                </Text>
                <Text className="text-base text-foreground">
                  {formatDate(customer.created_at)}
                </Text>
              </View>
            ) : null}
          </View>
        );

      case "kommunikation":
        return (
          <View className="gap-4">
            <View className="flex-1 items-center justify-center py-12">
              <IconSymbol name="envelope.fill" size={48} color={colors.muted} />
              <Text className="text-lg text-muted mt-4 mb-2">Keine Kommunikation</Text>
              <Text className="text-sm text-muted text-center">
                Für diesen Kunden wurden noch keine Kommunikationen erfasst.
              </Text>
            </View>

            <TouchableOpacity
              className="bg-primary py-3 rounded-lg"
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
          <View className="gap-4">
            <View className="flex-1 items-center justify-center py-12">
              <IconSymbol name="doc.text.fill" size={48} color={colors.muted} />
              <Text className="text-lg text-muted mt-4 mb-2">Keine Verträge</Text>
              <Text className="text-sm text-muted text-center">
                Für diesen Kunden wurden noch keine Verträge erfasst.
              </Text>
            </View>
          </View>
        );

      case "rechnungen":
        return (
          <View className="gap-4">
            <View className="flex-1 items-center justify-center py-12">
              <IconSymbol name="chart.bar.fill" size={48} color={colors.muted} />
              <Text className="text-lg text-muted mt-4 mb-2">Keine Rechnungen</Text>
              <Text className="text-sm text-muted text-center">
                Für diesen Kunden wurden noch keine Rechnungen erstellt.
              </Text>
            </View>
          </View>
        );

      case "tickets":
        return (
          <View className="gap-4">
            <View className="flex-1 items-center justify-center py-12">
              <IconSymbol name="ticket.fill" size={48} color={colors.muted} />
              <Text className="text-lg text-muted mt-4 mb-2">Keine Tickets</Text>
              <Text className="text-sm text-muted text-center">
                Für diesen Kunden wurden noch keine Tickets erstellt.
              </Text>
            </View>
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
              {customer?.company_name || `${customer?.first_name || ""} ${customer?.last_name || ""}`.trim() || "Kunde"}
            </Text>
            {customer?.company_name && (customer?.first_name || customer?.last_name) ? (
              <Text className="text-sm text-muted">
                {`${customer?.first_name || ""} ${customer?.last_name || ""}`.trim()}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={handleDelete}
            activeOpacity={0.6}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <IconSymbol name="trash.fill" size={22} color={colors.error || "#EF4444"} />
          </TouchableOpacity>
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

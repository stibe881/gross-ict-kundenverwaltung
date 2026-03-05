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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { formatDate, formatCurrency } from "@/lib/format";
import { CustomerPortalManagement } from "@/components/customer-portal-management";

type Tab = "stammdaten" | "kommunikation" | "vertraege" | "rechnungen" | "tickets" | "portal";

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams();
  const colors = useColors();
  const [activeTab, setActiveTab] = useState<Tab>("stammdaten");
  const [portalEnabled, setPortalEnabled] = useState(false);

  // Kundendaten aus Supabase laden
  const { data: customer, isLoading: loading } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => Data.getCustomerById(id as string),
    enabled: !!id,
  });

  // Kunde löschen
  const queryClient = useQueryClient();
  const deleteCustomer = useMutation({
    mutationFn: (custId: string) => Data.deleteCustomer(custId),
    onSuccess: () => {
      showAlert("Erfolg", "Kunde wurde erfolgreich gelöscht");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      router.back();
    },
    onError: (error: any) => {
      showAlert("Fehler", `Kunde konnte nicht gelöscht werden: ${error.message}`);
    },
  });

  // Kundenstatus ändern
  const updateCustomer = useMutation({
    mutationFn: ({ custId, ...data }: any) => Data.updateCustomer(custId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", id] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      showAlert("Erfolg", "Kundenstatus wurde geändert");
    },
    onError: (error: any) => {
      showAlert("Fehler", `Status konnte nicht geändert werden: ${error.message}`);
    },
  });

  const handleToggleStatus = () => {
    const newStatus = customer?.status === "active" ? "inactive" : "active";
    const label = newStatus === "active" ? "aktivieren" : "deaktivieren";
    showConfirm(
      "Status ändern",
      `Möchten Sie diesen Kunden wirklich ${label}?`,
      () => updateCustomer.mutate({ custId: id as string, status: newStatus }),
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
      () => deleteCustomer.mutate(id as string),
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

  // Daten für Tabs vorladen
  const { data: contracts, isLoading: contractsLoading } = useQuery({
    queryKey: ["contracts", id],
    queryFn: () => Data.getCustomerContracts(id as string),
    enabled: !!id,
  });
  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ["invoices", "customer", id],
    queryFn: () => Data.getCustomerInvoices(id as string),
    enabled: !!id,
  });
  const { data: tickets, isLoading: ticketsLoading } = useQuery({
    queryKey: ["tickets", "customer", id],
    queryFn: () => Data.getCustomerTickets(id as string),
    enabled: !!id,
  });

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

      case "vertraege": {

        if (contractsLoading) {
          return (
            <View className="flex-1 items-center justify-center py-12">
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          );
        }

        if (!contracts || contracts.length === 0) {
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
        }

        return (
          <View className="gap-3">
            {contracts.map((contract: any) => (
              <TouchableOpacity
                key={contract.id}
                className="bg-surface p-4 rounded-xl border border-border"
                activeOpacity={0.7}
                onPress={() => router.push("/contracts" as any)}
              >
                <View className="flex-row items-start justify-between mb-2">
                  <Text className="text-lg font-semibold text-foreground flex-1">
                    {contract.title}
                  </Text>
                  <View
                    className={`px-2 py-1 rounded-lg ${contract.status === "active"
                      ? "bg-success/20"
                      : contract.status === "cancelled"
                        ? "bg-error/20"
                        : "bg-warning/20"
                      }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${contract.status === "active"
                        ? "text-success"
                        : contract.status === "cancelled"
                          ? "text-error"
                          : "text-warning"
                        }`}
                    >
                      {contract.status === "active"
                        ? "Aktiv"
                        : contract.status === "cancelled"
                          ? "Gekündigt"
                          : "Abgelaufen"}
                    </Text>
                  </View>
                </View>
                {contract.description ? (
                  <Text className="text-sm text-muted mb-2">
                    {contract.description}
                  </Text>
                ) : null}
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-muted">
                    {formatDate(contract.start_date)} – {formatDate(contract.end_date)}
                  </Text>
                  <Text className="text-base font-bold text-primary">
                    {formatCurrency(contract.amount)}/Jahr
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        );
      }

      case "rechnungen": {

        if (invoicesLoading) {
          return (
            <View className="flex-1 items-center justify-center py-12">
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          );
        }

        if (!invoices || invoices.length === 0) {
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
        }

        const statusColors: Record<string, { bg: string; text: string; label: string }> = {
          draft: { bg: "bg-muted/20", text: "text-muted", label: "Entwurf" },
          open: { bg: "bg-primary/20", text: "text-primary", label: "Offen" },
          paid: { bg: "bg-success/20", text: "text-success", label: "Bezahlt" },
          overdue: { bg: "bg-error/20", text: "text-error", label: "Überfällig" },
          cancelled: { bg: "bg-muted/20", text: "text-muted", label: "Storniert" },
        };

        return (
          <View className="gap-3">
            {invoices.map((invoice: any) => {
              const status = statusColors[invoice.status] || statusColors.open;
              return (
                <TouchableOpacity
                  key={invoice.id}
                  className="bg-surface p-4 rounded-xl border border-border"
                  activeOpacity={0.7}
                  onPress={() => router.push(`/invoice/${invoice.id}`)}
                >
                  <View className="flex-row items-start justify-between mb-2">
                    <View>
                      <Text className="text-lg font-semibold text-foreground">
                        {invoice.invoice_number}
                      </Text>
                      <Text className="text-sm text-muted">
                        {formatDate(invoice.invoice_date)}
                      </Text>
                    </View>
                    <View className={`px-2 py-1 rounded-lg ${status.bg}`}>
                      <Text className={`text-xs font-semibold ${status.text}`}>
                        {status.label}
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm text-muted">
                      Fällig: {formatDate(invoice.due_date)}
                    </Text>
                    <Text className="text-xl font-bold text-primary">
                      {formatCurrency(invoice.total)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      }

      case "tickets": {

        if (ticketsLoading) {
          return (
            <View className="flex-1 items-center justify-center py-12">
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          );
        }

        if (!tickets || tickets.length === 0) {
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
        }

        const priorityColors: Record<string, string> = {
          low: "text-success",
          medium: "text-warning",
          high: "text-error",
        };
        const priorityLabels: Record<string, string> = {
          low: "Niedrig",
          medium: "Mittel",
          high: "Hoch",
        };

        return (
          <View className="gap-3">
            {tickets.map((ticket: any) => (
              <View
                key={ticket.id}
                className="bg-surface p-4 rounded-xl border border-border"
              >
                <View className="flex-row items-start justify-between mb-2">
                  <Text className="text-lg font-semibold text-foreground flex-1">
                    {ticket.title}
                  </Text>
                  <View
                    className={`px-2 py-1 rounded-lg ${ticket.status === "open"
                      ? "bg-primary/20"
                      : ticket.status === "in_progress"
                        ? "bg-warning/20"
                        : "bg-success/20"
                      }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${ticket.status === "open"
                        ? "text-primary"
                        : ticket.status === "in_progress"
                          ? "text-warning"
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
                </View>
                {ticket.description ? (
                  <Text className="text-sm text-muted mb-2" numberOfLines={2}>
                    {ticket.description}
                  </Text>
                ) : null}
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-muted">
                    {formatDate(ticket.created_at)}
                  </Text>
                  <Text className={`text-sm font-semibold ${priorityColors[ticket.priority] || "text-muted"}`}>
                    Priorität: {priorityLabels[ticket.priority] || ticket.priority}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        );
      }

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

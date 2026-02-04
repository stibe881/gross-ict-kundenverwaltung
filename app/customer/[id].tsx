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

type Tab = "stammdaten" | "kommunikation" | "vertraege" | "rechnungen" | "tickets";

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams();
  const colors = useColors();
  const [activeTab, setActiveTab] = useState<Tab>("stammdaten");
  const [loading, setLoading] = useState(false);

  // TODO: Kundendaten aus Supabase laden
  const customer = {
    id: id as string,
    name: "Max Mustermann",
    company: "Musterfirma GmbH",
    email: "max@musterfirma.ch",
    phone: "+41 44 123 45 67",
    address: "Musterstrasse 123, 8000 Zürich",
    notes: "Wichtiger Kunde seit 2020",
    createdAt: "2020-01-15",
  };

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "stammdaten", label: "Stammdaten", icon: "person.2.fill" },
    { key: "kommunikation", label: "Kommunikation", icon: "envelope.fill" },
    { key: "vertraege", label: "Verträge", icon: "doc.text.fill" },
    { key: "rechnungen", label: "Rechnungen", icon: "chart.bar.fill" },
    { key: "tickets", label: "Tickets", icon: "ticket.fill" },
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
                {customer.company}
              </Text>
            </View>

            <View className="bg-surface p-4 rounded-lg border border-border">
              <Text className="text-sm font-semibold text-muted mb-2">
                Kontaktperson
              </Text>
              <Text className="text-base text-foreground">
                {customer.name}
              </Text>
            </View>

            <View className="bg-surface p-4 rounded-lg border border-border">
              <Text className="text-sm font-semibold text-muted mb-2">
                E-Mail
              </Text>
              <Text className="text-base text-foreground">
                {customer.email}
              </Text>
            </View>

            <View className="bg-surface p-4 rounded-lg border border-border">
              <Text className="text-sm font-semibold text-muted mb-2">
                Telefon
              </Text>
              <Text className="text-base text-foreground">
                {customer.phone}
              </Text>
            </View>

            <View className="bg-surface p-4 rounded-lg border border-border">
              <Text className="text-sm font-semibold text-muted mb-2">
                Adresse
              </Text>
              <Text className="text-base text-foreground">
                {customer.address}
              </Text>
            </View>

            <View className="bg-surface p-4 rounded-lg border border-border">
              <Text className="text-sm font-semibold text-muted mb-2">
                Notizen
              </Text>
              <Text className="text-base text-foreground">
                {customer.notes}
              </Text>
            </View>

            <View className="bg-surface p-4 rounded-lg border border-border">
              <Text className="text-sm font-semibold text-muted mb-2">
                Kunde seit
              </Text>
              <Text className="text-base text-foreground">
                {formatDate(customer.createdAt)}
              </Text>
            </View>
          </View>
        );

      case "kommunikation":
        return (
          <View className="gap-4">
            {/* Beispiel-Kommunikationshistorie */}
            {[
              {
                id: 1,
                type: "E-Mail",
                subject: "Angebot für Projekt X",
                date: "2024-02-01",
                notes: "Angebot versendet, Rückmeldung ausstehend",
              },
              {
                id: 2,
                type: "Anruf",
                subject: "Rückfrage zu Rechnung",
                date: "2024-01-28",
                notes: "Kunde hatte Fragen zur letzten Rechnung, geklärt",
              },
              {
                id: 3,
                type: "Meeting",
                subject: "Jahresgespräch 2024",
                date: "2024-01-15",
                notes: "Ziele für 2024 besprochen, sehr positiv",
              },
            ].map((comm) => (
              <View
                key={comm.id}
                className="bg-surface p-4 rounded-lg border border-border"
              >
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center gap-2">
                    <View className="bg-primary/20 px-3 py-1 rounded-full">
                      <Text className="text-xs font-semibold text-primary">
                        {comm.type}
                      </Text>
                    </View>
                    <Text className="text-sm text-muted">
                      {formatDate(comm.date)}
                    </Text>
                  </View>
                </View>
                <Text className="text-base font-semibold text-foreground mb-1">
                  {comm.subject}
                </Text>
                <Text className="text-sm text-muted">{comm.notes}</Text>
              </View>
            ))}

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
            {/* Beispiel-Verträge */}
            {[
              {
                id: 1,
                title: "Wartungsvertrag 2024",
                startDate: "2024-01-01",
                endDate: "2024-12-31",
                amount: 12000,
                status: "active",
              },
              {
                id: 2,
                title: "Hosting-Vertrag",
                startDate: "2023-06-01",
                endDate: "2025-05-31",
                amount: 2400,
                status: "active",
              },
            ].map((contract) => (
              <View
                key={contract.id}
                className="bg-surface p-4 rounded-lg border border-border"
              >
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-base font-semibold text-foreground">
                    {contract.title}
                  </Text>
                  <View className="bg-success/20 px-3 py-1 rounded-full">
                    <Text className="text-xs font-semibold text-success">
                      Aktiv
                    </Text>
                  </View>
                </View>
                <Text className="text-sm text-muted mb-1">
                  Laufzeit: {formatDate(contract.startDate)} -{" "}
                  {formatDate(contract.endDate)}
                </Text>
                <Text className="text-sm font-semibold text-foreground">
                  {formatCurrency(contract.amount)} / Jahr
                </Text>
              </View>
            ))}
          </View>
        );

      case "rechnungen":
        return (
          <View className="gap-4">
            {/* Beispiel-Rechnungen */}
            {[
              {
                id: 1,
                number: "RE-2024-001",
                date: "2024-02-01",
                amount: 5250,
                status: "open",
              },
              {
                id: 2,
                number: "RE-2024-002",
                date: "2024-01-15",
                amount: 3800,
                status: "paid",
              },
              {
                id: 3,
                number: "RE-2023-045",
                date: "2023-12-20",
                amount: 7200,
                status: "paid",
              },
            ].map((invoice) => (
              <View
                key={invoice.id}
                className="bg-surface p-4 rounded-lg border border-border"
              >
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-base font-semibold text-foreground">
                    {invoice.number}
                  </Text>
                  <View
                    className={`px-3 py-1 rounded-full ${
                      invoice.status === "paid"
                        ? "bg-success/20"
                        : "bg-warning/20"
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        invoice.status === "paid"
                          ? "text-success"
                          : "text-warning"
                      }`}
                    >
                      {invoice.status === "paid" ? "Bezahlt" : "Offen"}
                    </Text>
                  </View>
                </View>
                <Text className="text-sm text-muted mb-1">
                  {formatDate(invoice.date)}
                </Text>
                <Text className="text-lg font-bold text-foreground">
                  {formatCurrency(invoice.amount)}
                </Text>
              </View>
            ))}
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
                    className={`px-3 py-1 rounded-full ${
                      ticket.priority === "high"
                        ? "bg-error/20"
                        : ticket.priority === "medium"
                        ? "bg-warning/20"
                        : "bg-success/20"
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        ticket.priority === "high"
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
                    className={`px-3 py-1 rounded-full ${
                      ticket.status === "open"
                        ? "bg-warning/20"
                        : ticket.status === "in_progress"
                        ? "bg-primary/20"
                        : "bg-success/20"
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        ticket.status === "open"
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
              {customer.company}
            </Text>
            <Text className="text-sm text-muted">{customer.name}</Text>
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
              className={`px-4 py-2 rounded-lg ${
                activeTab === tab.key
                  ? "bg-primary"
                  : "bg-surface border border-border"
              }`}
              activeOpacity={0.7}
            >
              <Text
                className={`text-sm font-semibold ${
                  activeTab === tab.key ? "text-background" : "text-foreground"
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

import { useState, useCallback } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { InvoiceFormModal } from "@/components/invoice-form-modal-v2";
import { useQuery } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/format";
import { router as expoRouter } from "expo-router";

export default function AccountingScreen() {
  const colors = useColors();
  const [activeTab, setActiveTab] = useState<"overview" | "invoices" | "expenses">("overview");
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Rechnungen laden
  const { data: invoices, isLoading, refetch } = useQuery({
    queryKey: ["invoices"],
    queryFn: Data.getAllInvoices,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "open": return "Offen";
      case "paid": return "Bezahlt";
      case "overdue": return "Überfällig";
      case "cancelled": return "Storniert";
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-warning";
      case "paid": return "bg-success";
      case "overdue": return "bg-error";
      case "cancelled": return "bg-muted";
      default: return "bg-muted";
    }
  };

  // Statistiken berechnen
  const totalOpen = invoices?.filter((i: any) => i.status === "open").reduce((sum: number, i: any) => sum + (i.total || 0), 0) || 0;
  const totalPaid = invoices?.filter((i: any) => i.status === "paid").reduce((sum: number, i: any) => sum + (i.total || 0), 0) || 0;
  const totalAll = invoices?.reduce((sum: number, i: any) => sum + (i.total || 0), 0) || 0;

  return (
    <ScreenContainer>
      <ScrollView
        className="flex-1 p-4"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-3xl font-bold text-foreground">Buchhaltung</Text>
          <TouchableOpacity
            className="bg-primary w-12 h-12 rounded-full items-center justify-center"
            activeOpacity={0.8}
            onPress={() => setShowInvoiceModal(true)}
          >
            <IconSymbol name="plus.circle.fill" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Tab Navigation */}
        <View className="flex-row gap-2 mb-4">
          {(["overview", "invoices", "expenses"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              className={`flex-1 py-3 rounded-lg ${activeTab === tab ? "bg-primary" : "bg-surface border border-border"
                }`}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                className={`text-center font-semibold ${activeTab === tab ? "text-background" : "text-foreground"
                  }`}
              >
                {tab === "overview" ? "Übersicht" : tab === "invoices" ? "Rechnungen" : "Ausgaben"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Übersicht */}
        {activeTab === "overview" && (
          <View className="gap-4">
            <View className="flex-row gap-3">
              <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
                <Text className="text-sm text-muted mb-1">Umsatz (gesamt)</Text>
                <Text className="text-2xl font-bold text-success">{formatCurrency(totalAll)}</Text>
              </View>
              <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
                <Text className="text-sm text-muted mb-1">Bezahlt</Text>
                <Text className="text-2xl font-bold text-primary">{formatCurrency(totalPaid)}</Text>
              </View>
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
                <Text className="text-sm text-muted mb-1">Offene Posten</Text>
                <Text className="text-2xl font-bold text-warning">{formatCurrency(totalOpen)}</Text>
              </View>
              <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
                <Text className="text-sm text-muted mb-1">Rechnungen</Text>
                <Text className="text-2xl font-bold text-foreground">{invoices?.length || 0}</Text>
              </View>
            </View>

            <View className="mt-4">
              <Text className="text-lg font-bold text-foreground mb-3">Schnellaktionen</Text>
              <TouchableOpacity
                className="bg-primary py-4 rounded-lg flex-row items-center justify-center"
                activeOpacity={0.8}
                onPress={() => setShowInvoiceModal(true)}
              >
                <IconSymbol name="plus.circle.fill" size={20} color="#FFFFFF" />
                <Text className="text-background font-semibold ml-2">Neue Rechnung</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Rechnungen */}
        {activeTab === "invoices" && (
          <View>
            {isLoading ? (
              <View className="flex-1 items-center justify-center py-12">
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : invoices && invoices.length > 0 ? (
              <View className="gap-3">
                <TouchableOpacity
                  className="bg-primary py-3 rounded-lg flex-row items-center justify-center mb-2"
                  activeOpacity={0.8}
                  onPress={() => setShowInvoiceModal(true)}
                >
                  <IconSymbol name="plus.circle.fill" size={20} color="#FFFFFF" />
                  <Text className="text-background font-semibold ml-2">Neue Rechnung</Text>
                </TouchableOpacity>

                {invoices.map((invoice: any) => {
                  const customerName = invoice.customer?.company_name ||
                    `${invoice.customer?.first_name || ""} ${invoice.customer?.last_name || ""}`.trim() ||
                    "Unbekannt";
                  return (
                    <TouchableOpacity
                      key={invoice.id}
                      className="bg-surface rounded-xl p-4 border border-border"
                      activeOpacity={0.7}
                      onPress={() => expoRouter.push(`/invoice/${invoice.id}` as any)}
                    >
                      <View className="flex-row items-center justify-between mb-2">
                        <Text className="text-base font-bold text-foreground">
                          {invoice.invoice_number}
                        </Text>
                        <View className={`px-3 py-1 rounded-full ${getStatusColor(invoice.status)}`}>
                          <Text className="text-xs font-semibold text-white">
                            {getStatusLabel(invoice.status)}
                          </Text>
                        </View>
                      </View>
                      <Text className="text-sm text-foreground mb-1">{customerName}</Text>
                      <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-border">
                        <Text className="text-xs text-muted">
                          {formatDate(invoice.invoice_date)} · Fällig: {formatDate(invoice.due_date)}
                        </Text>
                        <Text className="text-base font-bold text-primary">
                          {formatCurrency(invoice.total)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View className="flex-1 items-center justify-center py-12">
                <IconSymbol name="doc.text.fill" size={48} color={colors.muted} />
                <Text className="text-lg text-muted mt-4 mb-2">Keine Rechnungen</Text>
                <Text className="text-sm text-muted text-center mb-6">
                  Erstellen Sie Ihre erste Rechnung
                </Text>
                <TouchableOpacity
                  className="bg-primary px-6 py-3 rounded-lg"
                  activeOpacity={0.8}
                  onPress={() => setShowInvoiceModal(true)}
                >
                  <Text className="text-background font-semibold">Rechnung erstellen</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Ausgaben */}
        {activeTab === "expenses" && (
          <View className="flex-1 items-center justify-center py-12">
            <IconSymbol name="chart.bar.fill" size={48} color={colors.muted} />
            <Text className="text-lg text-muted mt-4 mb-2">Keine Ausgaben</Text>
            <Text className="text-sm text-muted text-center mb-6">
              Erfassen Sie Ihre erste Ausgabe
            </Text>
            <TouchableOpacity
              className="bg-primary px-6 py-3 rounded-lg"
              activeOpacity={0.8}
            >
              <Text className="text-background font-semibold">Ausgabe erfassen</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Invoice Form Modal */}
      <InvoiceFormModal
        visible={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        onSuccess={() => refetch()}
      />
    </ScreenContainer>
  );
}

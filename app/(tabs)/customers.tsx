import { useState, useCallback } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from "react-native";
import { showAlert, showConfirm } from "@/lib/alert";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { CustomerFormModal } from "@/components/customer-form-modal";

export default function CustomersScreen() {
  const router = useRouter();
  const colors = useColors();
  const { isWide, containerStyle, contentPadding } = useResponsiveLayout();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // Kunden laden
  const { data: customers, isLoading, refetch } = useQuery({
    queryKey: ["customers"],
    queryFn: Data.getCustomersWithCounts,
  });
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Kunde löschen
  const deleteCustomer = useMutation({
    mutationFn: (id: string) => Data.deleteCustomer(id),
    onSuccess: () => {
      showAlert("Erfolg", "Kunde wurde erfolgreich gelöscht");
      refetch();
    },
    onError: (error: any) => {
      showAlert("Fehler", `Kunde konnte nicht gelöscht werden: ${error.message}`);
    },
  });

  const handleDelete = (customerId: string, displayName: string) => {
    showConfirm(
      "Kunde löschen",
      `Möchten Sie "${displayName}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`,
      () => deleteCustomer.mutate(customerId),
      "Löschen"
    );
  };

  // Gefilterte Kunden basierend auf Suche
  const getDisplayName = (c: any) =>
    c.company_name || `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Unbenannt";

  const filteredCustomers = customers
    ?.filter((customer: any) => {
      const query = searchQuery.toLowerCase();
      return (
        customer.first_name?.toLowerCase().includes(query) ||
        customer.last_name?.toLowerCase().includes(query) ||
        customer.company_name?.toLowerCase().includes(query) ||
        customer.email?.toLowerCase().includes(query)
      );
    })
    .sort((a: any, b: any) => getDisplayName(a).localeCompare(getDisplayName(b), "de"));

  const renderCustomerItem = ({ item }: { item: any }) => {
    const displayName =
      item.company_name ||
      `${item.first_name || ""} ${item.last_name || ""}`.trim() ||
      "Unbenannt";

    const counts = item._counts;

    return (
      <TouchableOpacity
        className="bg-surface rounded-xl p-4 mb-3 border border-border"
        activeOpacity={0.7}
        onPress={() => {
          // Navigation zu Kundendetails
          router.push(`/customer/${item.id}` as any);
        }}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-lg font-semibold text-foreground mb-1">
              {displayName}
            </Text>
            {item.email && (
              <Text className="text-sm text-muted mb-1">{item.email}</Text>
            )}
            {item.phone && (
              <View className="flex-row items-center mt-1">
                <IconSymbol name="phone.fill" size={14} color={colors.muted} />
                <Text className="text-sm text-muted ml-1">{item.phone}</Text>
              </View>
            )}
          </View>
          <View className="flex-row items-center gap-3">
            <View
              className={`px-3 py-1 rounded-full ${item.status === "active" ? "bg-success" : "bg-muted"
                }`}
            >
              <Text className="text-xs font-semibold text-white">
                {item.status === "active" ? "Aktiv" : "Inaktiv"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                handleDelete(item.id, displayName);
              }}
              activeOpacity={0.6}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <IconSymbol name="trash.fill" size={18} color={colors.error || "#EF4444"} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Indikatoren: Verträge, Tickets, Rechnungen */}
        {counts && (counts.activeContracts > 0 || counts.openTickets > 0 || counts.openInvoices > 0) && (
          <View className="flex-row items-center gap-2 mt-3 pt-3 border-t border-border">
            {counts.activeContracts > 0 && (
              <View className="flex-row items-center bg-success/15 px-2 py-1 rounded-lg">
                <Text className="text-xs">📄</Text>
                <Text className="text-xs font-semibold text-success ml-1">
                  {counts.activeContracts} {counts.activeContracts === 1 ? "Vertrag" : "Verträge"}
                </Text>
              </View>
            )}
            {counts.openTickets > 0 && (
              <View className="flex-row items-center bg-warning/15 px-2 py-1 rounded-lg">
                <Text className="text-xs">🎫</Text>
                <Text className="text-xs font-semibold text-warning ml-1">
                  {counts.openTickets} {counts.openTickets === 1 ? "Ticket" : "Tickets"}
                </Text>
              </View>
            )}
            {counts.openInvoices > 0 && (
              <View className="flex-row items-center bg-error/15 px-2 py-1 rounded-lg">
                <Text className="text-xs">💰</Text>
                <Text className="text-xs font-semibold text-error ml-1">
                  {counts.openInvoices} {counts.openInvoices === 1 ? "Rechnung" : "Rechnungen"}
                </Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer>
      <View className="flex-1" style={{ padding: contentPadding }}>
        <View style={containerStyle}>
          {/* Header */}
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center gap-3">
              <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
                <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
              </TouchableOpacity>
              <Text className="text-3xl font-bold text-foreground">Kunden</Text>
            </View>
            <TouchableOpacity
              className="bg-primary w-12 h-12 rounded-full items-center justify-center"
              activeOpacity={0.8}
              onPress={() => setShowAddModal(true)}
            >
              <IconSymbol name="plus.circle.fill" size={24} color="#111111" />
            </TouchableOpacity>
          </View>

          {/* Suchleiste */}
          <View className="bg-surface rounded-xl p-3 mb-4 flex-row items-center border border-border">
            <IconSymbol name="magnifyingglass" size={20} color={colors.muted} />
            <TextInput
              className="flex-1 ml-2 text-base text-foreground"
              placeholder="Kunde suchen..."
              placeholderTextColor={colors.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Statistik-Karten */}
          <View className="flex-row gap-3 mb-4">
            <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
              <Text className="text-2xl font-bold text-foreground">
                {customers?.length || 0}
              </Text>
              <Text className="text-sm text-muted">Gesamt</Text>
            </View>
            <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
              <Text className="text-2xl font-bold text-success">
                {customers?.filter((c) => c.status === "active").length || 0}
              </Text>
              <Text className="text-sm text-muted">Aktiv</Text>
            </View>
          </View>

          {/* Kundenliste */}
          {isLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : filteredCustomers && filteredCustomers.length > 0 ? (
            <FlatList
              data={filteredCustomers}
              renderItem={renderCustomerItem}
              keyExtractor={(item) => item.id.toString()}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={colors.primary}
                  colors={[colors.primary]}
                />
              }
            />
          ) : (
            <View className="flex-1 items-center justify-center">
              <Text className="text-lg text-muted mb-2">Keine Kunden gefunden</Text>
              <Text className="text-sm text-muted text-center">
                {searchQuery
                  ? "Versuchen Sie einen anderen Suchbegriff"
                  : "Fügen Sie Ihren ersten Kunden hinzu"}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Add Customer Modal */}
      <CustomerFormModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => refetch()}
      />
    </ScreenContainer>
  );
}


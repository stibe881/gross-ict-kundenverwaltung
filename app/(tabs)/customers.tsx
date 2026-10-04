import { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Image,
} from "react-native";
import { showAlert, showConfirm } from "@/lib/alert";
import { showToast } from "@/components/toast-provider";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useIsReadOnly } from "@/hooks/use-is-read-only";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { exportCsv } from "@/lib/export";
import { CustomerFormModal } from "@/components/customer-form-modal";
import { useGlobalRefresh } from "@/hooks/use-global-refresh";

export default function CustomersScreen() {
  const router = useRouter();
  const colors = useColors();
    const isReadOnly = useIsReadOnly();
  const { isWide, containerStyle, contentPadding } = useResponsiveLayout();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("active");

  // Kunden laden
  const { data: customers, isLoading, refetch } = useQuery({
    queryKey: ["customers"],
    queryFn: Data.getCustomersWithCounts,
  });
  const { refreshing, onRefresh } = useGlobalRefresh();

  // Kunde löschen
  const deleteCustomer = useMutation({
    mutationFn: (id: string) => Data.deleteCustomer(id),
    onSuccess: () => {
      showToast("Kunde wurde gelöscht");
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
      const matchesSearch =
        customer.first_name?.toLowerCase().includes(query) ||
        customer.last_name?.toLowerCase().includes(query) ||
        customer.company_name?.toLowerCase().includes(query) ||
        customer.email?.toLowerCase().includes(query);
      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "active" && customer.status === "active") ||
        (filterStatus === "inactive" && customer.status !== "active");
      return matchesSearch && matchesStatus;
    })
    .sort((a: any, b: any) => getDisplayName(a).localeCompare(getDisplayName(b), "de"));

  const renderCustomerItem = ({ item }: { item: any }) => {
    const displayName =
      item.company_name ||
      `${item.first_name || ""} ${item.last_name || ""}`.trim() ||
      "Unbenannt";

    const counts = item._counts;
    // Konvention wie im Kundenformular: Firmenname gesetzt = Firmenkunde
    const isCompany = !!item.company_name;

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
          {/* Logo / Initial */}
          <View className="flex-row items-center flex-1">
            {item.logo_url ? (
              <Image
                source={{ uri: item.logo_url }}
                style={{ width: 40, height: 40, borderRadius: 8, marginRight: 12 }}
                resizeMode="contain"
              />
            ) : (
              <View
                className="w-10 h-10 rounded-lg items-center justify-center mr-3"
                style={{ backgroundColor: colors.primary }}
              >
                <Text className="text-base font-bold" style={{ color: colors.background }}>
                  {displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
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

        {/* Indikatoren: Kundentyp, Verträge, Tickets, Rechnungen */}
        <View className="flex-row items-center gap-2 mt-3 pt-3 border-t border-border">
            <View
              className="flex-row items-center px-2 py-1 rounded-lg"
              style={{ backgroundColor: colors.primary + "20" }}
            >
              <IconSymbol name={isCompany ? "building.2.fill" : "person.fill"} size={12} color={colors.primary} />
              <Text className="text-xs font-semibold ml-1" style={{ color: colors.primary }}>
                {isCompany ? "Firmenkunde" : "Privatkunde"}
              </Text>
            </View>
            {counts && counts.activeContracts > 0 && (
              <View className="flex-row items-center bg-success/15 px-2 py-1 rounded-lg">
                <IconSymbol name="doc.text" size={12} color={colors.success} />
                <Text className="text-xs font-semibold text-success ml-1">
                  {counts.activeContracts} {counts.activeContracts === 1 ? "Vertrag" : "Verträge"}
                </Text>
              </View>
            )}
            {counts && counts.openTickets > 0 && (
              <View className="flex-row items-center bg-warning/15 px-2 py-1 rounded-lg">
                <IconSymbol name="ticket" size={12} color={colors.warning} />
                <Text className="text-xs font-semibold text-warning ml-1">
                  {counts.openTickets} {counts.openTickets === 1 ? "Ticket" : "Tickets"}
                </Text>
              </View>
            )}
            {counts && counts.openInvoices > 0 && (
              <View className="flex-row items-center bg-error/15 px-2 py-1 rounded-lg">
                <IconSymbol name="banknote" size={12} color={colors.error} />
                <Text className="text-xs font-semibold text-error ml-1">
                  {counts.openInvoices} {counts.openInvoices === 1 ? "Rechnung" : "Rechnungen"}
                </Text>
              </View>
            )}
          </View>
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
            <View className="flex-row items-center gap-2">
              <TouchableOpacity
                className="bg-surface border border-border w-12 h-12 rounded-full items-center justify-center"
                activeOpacity={0.8}
                onPress={() =>
                  exportCsv("Kunden.csv", filteredCustomers || [], [
                    { key: "company_name", label: "Firma" },
                    { key: "first_name", label: "Vorname" },
                    { key: "last_name", label: "Nachname" },
                    { key: "email", label: "E-Mail" },
                    { key: "phone", label: "Telefon" },
                    { key: "address", label: "Adresse" },
                    { key: "postal_code", label: "PLZ" },
                    { key: "city", label: "Ort" },
                    { key: "status", label: "Status" },
                  ]).catch(() => {})
                }
              >
                <IconSymbol name="square.and.arrow.up" size={20} color={colors.primary} />
              </TouchableOpacity>
              {!isReadOnly && (
              <TouchableOpacity
                className="bg-primary w-12 h-12 rounded-full items-center justify-center"
                activeOpacity={0.8}
                onPress={() => setShowAddModal(true)}
              >
                <IconSymbol name="plus.circle.fill" size={24} color={colors.background} />
              </TouchableOpacity>
              )}
            </View>
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

          {/* Filter */}
          <View className="flex-row gap-2 mb-4">
            {([
              { key: "all", label: "Alle" },
              { key: "active", label: "Aktiv" },
              { key: "inactive", label: "Inaktiv" },
            ] as const).map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                onPress={() => setFilterStatus(key)}
                style={{
                  backgroundColor: filterStatus === key ? colors.primary : colors.surface,
                  borderColor: colors.border,
                }}
                className="px-4 py-1.5 rounded-full border"
              >
                <Text
                  style={{
                    color: filterStatus === key ? "#fff" : colors.foreground,
                    fontSize: 13,
                    fontWeight: "600",
                  }}
                >
                  {label}
                  {key === "all" && customers ? ` (${customers.length})` : ""}
                  {key === "active" && customers ? ` (${customers.filter((c: any) => c.status === "active").length})` : ""}
                  {key === "inactive" && customers ? ` (${customers.filter((c: any) => c.status !== "active").length})` : ""}
                </Text>
              </TouchableOpacity>
            ))}
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


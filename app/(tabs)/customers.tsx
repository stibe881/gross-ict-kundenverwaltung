import { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { CustomerFormModal } from "@/components/customer-form-modal";

export default function CustomersScreen() {
  const router = useRouter();
  const colors = useColors();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // Kunden laden
  const { data: customers, isLoading, refetch } = trpc.customers.list.useQuery();

  // Gefilterte Kunden basierend auf Suche
  const filteredCustomers = customers?.filter((customer) => {
    const query = searchQuery.toLowerCase();
    return (
      customer.firstName?.toLowerCase().includes(query) ||
      customer.lastName?.toLowerCase().includes(query) ||
      customer.companyName?.toLowerCase().includes(query) ||
      customer.email?.toLowerCase().includes(query)
    );
  });

  const renderCustomerItem = ({ item }: { item: any }) => {
    const displayName =
      item.companyName ||
      `${item.firstName || ""} ${item.lastName || ""}`.trim() ||
      "Unbenannt";

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
          <View
            className={`px-3 py-1 rounded-full ${
              item.status === "active" ? "bg-success" : "bg-muted"
            }`}
          >
            <Text className="text-xs font-semibold text-white">
              {item.status === "active" ? "Aktiv" : "Inaktiv"}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer>
      <View className="flex-1 p-4">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-3xl font-bold text-foreground">Kunden</Text>
          <TouchableOpacity
            className="bg-primary w-12 h-12 rounded-full items-center justify-center"
            activeOpacity={0.8}
            onPress={() => setShowAddModal(true)}
          >
            <IconSymbol name="plus.circle.fill" size={24} color="#FFFFFF" />
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

      {/* Add Customer Modal */}
      <CustomerFormModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => refetch()}
      />
    </ScreenContainer>
  );
}

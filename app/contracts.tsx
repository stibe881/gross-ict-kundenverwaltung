import { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { formatDate, formatCurrency } from "@/lib/format";

type ContractStatus = "active" | "cancelled" | "expired";

interface Contract {
  id: number;
  title: string;
  customer: string;
  customerId: number;
  amount: number;
  startDate: string;
  endDate: string;
  status: ContractStatus;
  noticePeriod: number; // in Monaten
}

const mockContracts: Contract[] = [
  {
    id: 1,
    title: "Wartungsvertrag Standard",
    customer: "Musterfirma GmbH",
    customerId: 1,
    amount: 1200,
    startDate: "2024-01-01",
    endDate: "2025-12-31",
    status: "active",
    noticePeriod: 3,
  },
  {
    id: 2,
    title: "Software-Lizenz Premium",
    customer: "Schmidt AG",
    customerId: 2,
    amount: 2500,
    startDate: "2025-06-01",
    endDate: "2026-05-31",
    status: "active",
    noticePeriod: 1,
  },
  {
    id: 3,
    title: "Support-Vertrag",
    customer: "Müller & Co",
    customerId: 3,
    amount: 800,
    startDate: "2023-01-01",
    endDate: "2024-12-31",
    status: "expired",
    noticePeriod: 6,
  },
];

export default function ContractsScreen() {
  const colors = useColors();
  const router = useRouter();
  const [contracts] = useState<Contract[]>(mockContracts);
  const [filter, setFilter] = useState<"all" | ContractStatus>("all");

  const getStatusLabel = (status: ContractStatus) => {
    const labels: Record<ContractStatus, string> = {
      active: "Aktiv",
      cancelled: "Gekündigt",
      expired: "Abgelaufen",
    };
    return labels[status];
  };

  const getStatusColor = (status: ContractStatus) => {
    const colorMap: Record<ContractStatus, string> = {
      active: colors.success,
      cancelled: colors.warning,
      expired: colors.error,
    };
    return colorMap[status];
  };

  const filteredContracts =
    filter === "all" ? contracts : contracts.filter((c) => c.status === filter);

  const renderContractItem = ({ item }: { item: Contract }) => (
    <TouchableOpacity
      className="bg-surface rounded-xl p-4 mb-3 border border-border"
      activeOpacity={0.7}
    >
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1">
          <Text className="text-lg font-semibold text-foreground mb-1">{item.title}</Text>
          <Text className="text-sm text-muted">{item.customer}</Text>
        </View>
        <View
          className="px-3 py-1 rounded-full ml-2"
          style={{ backgroundColor: getStatusColor(item.status) + "20" }}
        >
          <Text
            className="text-xs font-semibold"
            style={{ color: getStatusColor(item.status) }}
          >
            {getStatusLabel(item.status)}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center justify-between mt-2">
        <View>
          <Text className="text-xs text-muted">Laufzeit</Text>
          <Text className="text-sm text-foreground">
            {formatDate(item.startDate)} - {formatDate(item.endDate)}
          </Text>
        </View>
        <View>
          <Text className="text-xs text-muted text-right">Betrag</Text>
          <Text className="text-sm font-semibold text-success">
            {formatCurrency(item.amount)}/Jahr
          </Text>
        </View>
      </View>

      <View className="mt-2">
        <Text className="text-xs text-muted">
          Kündigungsfrist: {item.noticePeriod} {item.noticePeriod === 1 ? "Monat" : "Monate"}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <ScreenContainer>
      <View className="flex-1 p-4">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center gap-3">
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
              <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <Text className="text-3xl font-bold text-foreground">Verträge</Text>
          </View>
          <TouchableOpacity
            className="bg-primary w-12 h-12 rounded-full items-center justify-center"
            activeOpacity={0.8}
          >
            <IconSymbol name="plus.circle.fill" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Statistik */}
        <View className="flex-row gap-3 mb-4">
          <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
            <Text className="text-2xl font-bold text-success">
              {contracts.filter((c) => c.status === "active").length}
            </Text>
            <Text className="text-sm text-muted">Aktiv</Text>
          </View>
          <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
            <Text className="text-2xl font-bold text-warning">
              {contracts.filter((c) => c.status === "cancelled").length}
            </Text>
            <Text className="text-sm text-muted">Gekündigt</Text>
          </View>
          <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
            <Text className="text-2xl font-bold text-error">
              {contracts.filter((c) => c.status === "expired").length}
            </Text>
            <Text className="text-sm text-muted">Abgelaufen</Text>
          </View>
        </View>

        {/* Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
          <View className="flex-row gap-2">
            {["all", "active", "cancelled", "expired"].map((status) => (
              <TouchableOpacity
                key={status}
                className={`px-4 py-2 rounded-lg ${
                  filter === status ? "bg-primary" : "bg-surface border border-border"
                }`}
                onPress={() => setFilter(status as any)}
              >
                <Text
                  className={`font-semibold ${
                    filter === status ? "text-background" : "text-foreground"
                  }`}
                >
                  {status === "all"
                    ? "Alle"
                    : getStatusLabel(status as ContractStatus)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Vertragsliste */}
        {filteredContracts.length > 0 ? (
          <FlatList
            data={filteredContracts}
            renderItem={renderContractItem}
            keyExtractor={(item) => item.id.toString()}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <IconSymbol name="doc.text.fill" size={48} color={colors.muted} />
            <Text className="text-lg text-muted mt-4">Keine Verträge</Text>
            <Text className="text-sm text-muted text-center mt-2">
              {filter === "all"
                ? "Erstellen Sie Ihren ersten Vertrag"
                : `Keine Verträge mit Status "${getStatusLabel(filter as ContractStatus)}"`}
            </Text>
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}

import { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { formatDate, formatCurrency } from "@/lib/format";
import { ContractFormModal } from "@/components/contract-form-modal";
import { trpc } from "@/lib/trpc";

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
  const [filter, setFilter] = useState<"all" | ContractStatus>("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

  // Echte Daten laden
  const { data: contracts = [], refetch } = trpc.contracts.list.useQuery();

  // Refresh beim Fokusieren des Screens (falls ein neuer Vertrag erstellt wurde)
  // Einfache Lösung: onSuccess im Modal triggert refetch

  const getStatusLabel = (status: ContractStatus) => {
    const labels: Record<string, string> = {
      active: "Aktiv",
      cancelled: "Gekündigt",
      expired: "Abgelaufen",
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: ContractStatus) => {
    const colorMap: Record<string, string> = {
      active: colors.success,
      cancelled: colors.warning,
      expired: colors.error,
    };
    return colorMap[status] || colors.muted;
  };

  const filteredContracts =
    filter === "all" ? contracts : contracts.filter((c: any) => c.status === filter);

  const renderContractItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      className="bg-surface rounded-xl p-4 mb-3 border border-border"
      activeOpacity={0.7}
      onPress={() => setSelectedContract(item)}
    >
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1">
          <Text className="text-lg font-semibold text-foreground mb-1">{item.title}</Text>
          {/* Customer Name müsste idealerweise mitgeladen werden oder Contract enthält customer objekt */}
          {/* Da das Backend aktuell nur IDs liefert, zeigen wir ggf. nur title an oder erweitern Backend Logic später */}
          {/* Workaround: Wenn customer joined ist */}
          <Text className="text-sm text-muted">
            {/* Hier müsste der Kundenname stehen. Falls nicht im Objekt, ggf. weglassen oder CustomerID anzeigen */}
            Kunde ID: {item.customerId}
          </Text>
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
            {formatCurrency(item.annualAmount || item.amount)}/Jahr
          </Text>
        </View>
      </View>

      {item.noticePeriodMonths && (
        <View className="mt-2">
          <Text className="text-xs text-muted">
            Kündigungsfrist: {item.noticePeriodMonths} {item.noticePeriodMonths === 1 ? "Monat" : "Monate"}
          </Text>
        </View>
      )}
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
            onPress={() => setShowAddModal(true)}
          >
            <IconSymbol name="plus.circle.fill" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Statistik */}
        <View className="flex-row gap-3 mb-4">
          <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
            <Text className="text-2xl font-bold text-success">
              {contracts.filter((c: any) => c.status === "active").length}
            </Text>
            <Text className="text-sm text-muted">Aktiv</Text>
          </View>
          <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
            <Text className="text-2xl font-bold text-warning">
              {contracts.filter((c: any) => c.status === "cancelled").length}
            </Text>
            <Text className="text-sm text-muted">Gekündigt</Text>
          </View>
          <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
            <Text className="text-2xl font-bold text-error">
              {contracts.filter((c: any) => c.status === "expired").length}
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
                className={`px-4 py-2 rounded-lg ${filter === status ? "bg-primary" : "bg-surface border border-border"
                  }`}
                onPress={() => setFilter(status as any)}
              >
                <Text
                  className={`font-semibold ${filter === status ? "text-background" : "text-foreground"
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

      {/* Vertragsformular Modal */}
      <ContractFormModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => refetch()}
      />

      {/* Vertrags-Details Modal */}
      {selectedContract && (
        <ContractDetailsModal
          contract={selectedContract}
          onClose={() => setSelectedContract(null)}
          getStatusLabel={getStatusLabel}
          getStatusColor={getStatusColor}
        />
      )}
    </ScreenContainer>
  );
}

// Vertrags-Details Modal mit Historie
function ContractDetailsModal({
  contract,
  onClose,
  getStatusLabel,
  getStatusColor,
}: {
  contract: Contract;
  onClose: () => void;
  getStatusLabel: (status: ContractStatus) => string;
  getStatusColor: (status: ContractStatus) => string;
}) {
  const colors = useColors();
  const [history] = useState([
    {
      id: 1,
      type: "system" as const,
      text: "Vertrag erstellt",
      createdAt: contract.startDate,
      user: "System",
    },
    {
      id: 2,
      type: "activity" as const,
      text: "Vertrag vom Kunden unterzeichnet",
      createdAt: contract.startDate,
      user: "Admin User",
    },
  ]);

  return (
    <Modal visible={true} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-background rounded-t-3xl" style={{ maxHeight: "90%" }}>
          {/* Header */}
          <View className="flex-row items-center justify-between p-4 border-b border-border">
            <Text className="text-2xl font-bold text-foreground">Vertragsdetails</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView className="p-4" showsVerticalScrollIndicator={false}>
            <View className="gap-4">
              {/* Titel & Status */}
              <View>
                <View className="flex-row items-start justify-between mb-2">
                  <View className="flex-1">
                    <Text className="text-xl font-bold text-foreground mb-1">
                      {contract.title}
                    </Text>
                    <Text className="text-base text-muted">
                      {typeof contract.customer === 'object'
                        ? (contract.customer.company_name || `${contract.customer.first_name} ${contract.customer.last_name}` || "Unbekannter Kunde")
                        : contract.customer}
                    </Text>
                  </View>
                  <View
                    className="px-3 py-1 rounded-full"
                    style={{ backgroundColor: getStatusColor(contract.status) + "20" }}
                  >
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: getStatusColor(contract.status) }}
                    >
                      {getStatusLabel(contract.status)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Laufzeit & Betrag */}
              <View className="bg-surface rounded-xl p-4 border border-border">
                <View className="gap-3">
                  <View>
                    <Text className="text-sm text-muted mb-1">Laufzeit</Text>
                    <Text className="text-base text-foreground">
                      {formatDate(contract.startDate)} - {formatDate(contract.endDate)}
                    </Text>
                  </View>
                  <View>
                    <Text className="text-sm text-muted mb-1">Jahresbetrag</Text>
                    <Text className="text-lg font-bold text-success">
                      {formatCurrency(contract.amount)}
                    </Text>
                  </View>
                  <View>
                    <Text className="text-sm text-muted mb-1">Kündigungsfrist</Text>
                    <Text className="text-base text-foreground">
                      {contract.noticePeriod} {contract.noticePeriod === 1 ? "Monat" : "Monate"}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Historie */}
              <View>
                <Text className="text-lg font-bold text-foreground mb-3">Vertragshistorie</Text>
                {history.map((item) => (
                  <View
                    key={item.id}
                    className={`mb-3 p-3 rounded-lg ${item.type === "system" ? "bg-surface" : "bg-primary/10"
                      }`}
                  >
                    <View className="flex-row items-center justify-between mb-1">
                      <Text
                        className={`text-xs font-semibold ${item.type === "system" ? "text-muted" : "text-primary"
                          }`}
                      >
                        {item.user}
                      </Text>
                      <Text className="text-xs text-muted">
                        {formatDate(item.createdAt)}
                      </Text>
                    </View>
                    <Text className="text-sm text-foreground">{item.text}</Text>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View className="p-4 border-t border-border flex-row gap-3">
            <TouchableOpacity
              className="flex-1 bg-surface border border-border py-3 rounded-lg"
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text className="text-foreground font-semibold text-center">Schließen</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 bg-primary py-3 rounded-lg"
              activeOpacity={0.8}
            >
              <Text className="text-background font-semibold text-center">Bearbeiten</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

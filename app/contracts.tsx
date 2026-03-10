import { useState, useCallback } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Modal,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { formatDate, formatCurrency } from "@/lib/format";
import { ContractFormModal } from "@/components/contract-form-modal";
import { ContractTemplateFormModal } from "@/components/contract-template-form-modal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { showAlert, showConfirm } from "@/lib/alert";

type ContractStatus = "active" | "cancelled" | "expired";

export default function ContractsScreen() {
  const colors = useColors();
  const { containerStyle, contentPadding } = useResponsiveLayout();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | ContractStatus>("all");

  // Verträge aus DB laden
  const { data: contracts = [], isLoading: contractsLoading } = useQuery({
    queryKey: ["contracts"],
    queryFn: Data.getContracts,
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [editingContract, setEditingContract] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"contracts" | "templates">("contracts");

  // Vorlagen laden
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ["contract_templates"],
    queryFn: Data.getContractTemplates,
  });

  // Vorlage erstellen
  const createTemplateMutation = useMutation({
    mutationFn: (data: any) => Data.createContractTemplate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract_templates"] });
      setShowTemplateModal(false);
      setEditingTemplate(null);
    },
    onError: (err: any) => showAlert("Fehler", err.message),
  });

  // Vorlage aktualisieren
  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => Data.updateContractTemplate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract_templates"] });
      setShowTemplateModal(false);
      setEditingTemplate(null);
    },
    onError: (err: any) => showAlert("Fehler", err.message),
  });

  // Vorlage löschen
  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) => Data.deleteContractTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract_templates"] });
    },
    onError: (err: any) => showAlert("Fehler", err.message),
  });

  const handleTemplateSubmit = (data: any) => {
    if (editingTemplate) {
      updateTemplateMutation.mutate({ id: editingTemplate.id, data });
    } else {
      createTemplateMutation.mutate(data);
    }
  };

  const handleDeleteTemplate = (template: any) => {
    showConfirm(
      "Vorlage löschen",
      `Möchten Sie die Vorlage "${template.name}" wirklich löschen?`,
      () => deleteTemplateMutation.mutate(template.id),
      "Löschen"
    );
  };

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

  const filteredContracts: any[] =
    filter === "all" ? contracts : contracts.filter((c) => c.status === filter);

  const renderContractItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      className="bg-surface rounded-xl p-4 mb-3 border border-border"
      activeOpacity={0.7}
      onPress={() => setSelectedContract(item)}
    >
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1">
          <Text className="text-lg font-semibold text-foreground mb-1">{item.title}</Text>
          <Text className="text-sm text-muted">{item.customer_name}</Text>
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
            {formatDate(item.start_date)} - {formatDate(item.end_date)}
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
          Kündigungsfrist: {item.notice_period_months} {item.notice_period_months === 1 ? "Monat" : "Monate"}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderTemplateItem = ({ item }: { item: any }) => (
    <View className="bg-surface rounded-xl p-4 mb-3 border border-border">
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1">
          <Text className="text-lg font-semibold text-foreground mb-1">{item.name}</Text>
          {item.description && (
            <Text className="text-sm text-muted">{item.description}</Text>
          )}
        </View>
        <View className="flex-row gap-2">
          <TouchableOpacity
            className="bg-primary/20 px-3 py-2 rounded-lg"
            activeOpacity={0.7}
            onPress={() => {
              setEditingTemplate(item);
              setShowTemplateModal(true);
            }}
          >
            <Text className="text-primary text-xs font-semibold">Bearbeiten</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="bg-error/20 px-3 py-2 rounded-lg"
            activeOpacity={0.7}
            onPress={() => handleDeleteTemplate(item)}
          >
            <Text className="text-error text-xs font-semibold">Löschen</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View className="flex-row gap-4 mt-2">
        {item.default_amount && (
          <View>
            <Text className="text-xs text-muted">Betrag</Text>
            <Text className="text-sm text-foreground">{formatCurrency(item.default_amount)}/Jahr</Text>
          </View>
        )}
        <View>
          <Text className="text-xs text-muted">Laufzeit</Text>
          <Text className="text-sm text-foreground">{item.default_duration_months} Monate</Text>
        </View>
        <View>
          <Text className="text-xs text-muted">Kündigungsfrist</Text>
          <Text className="text-sm text-foreground">{item.default_notice_period_months} Monate</Text>
        </View>
      </View>
    </View>
  );

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
              <Text className="text-3xl font-bold text-foreground">Verträge</Text>
            </View>
            <TouchableOpacity
              className="bg-primary w-12 h-12 rounded-full items-center justify-center"
              activeOpacity={0.8}
              onPress={() => setShowPlusMenu(true)}
            >
              <IconSymbol name="plus.circle.fill" size={24} color="#111111" />
            </TouchableOpacity>
          </View>

          {/* Tab Switcher */}
          <View className="flex-row gap-2 mb-4">
            <TouchableOpacity
              className={`flex-1 py-3 rounded-lg ${activeTab === "contracts" ? "bg-primary" : "bg-surface border border-border"}`}
              onPress={() => setActiveTab("contracts")}
            >
              <Text className={`font-semibold text-center ${activeTab === "contracts" ? "text-background" : "text-foreground"}`}>
                Verträge
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-1 py-3 rounded-lg ${activeTab === "templates" ? "bg-primary" : "bg-surface border border-border"}`}
              onPress={() => setActiveTab("templates")}
            >
              <Text className={`font-semibold text-center ${activeTab === "templates" ? "text-background" : "text-foreground"}`}>
                Vorlagen {templates?.length ? `(${templates.length})` : ""}
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab === "contracts" ? (
            <>
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
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4" style={{ flexGrow: 0 }}>
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
                        {status === "all" ? "Alle" : getStatusLabel(status as ContractStatus)}
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
                </View>
              )}
            </>
          ) : (
            <>
              {/* Vorlagenliste */}
              {templatesLoading ? (
                <View className="flex-1 items-center justify-center">
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : templates && templates.length > 0 ? (
                <FlatList
                  data={templates}
                  renderItem={renderTemplateItem}
                  keyExtractor={(item) => item.id}
                  showsVerticalScrollIndicator={false}
                />
              ) : (
                <View className="flex-1 items-center justify-center">
                  <IconSymbol name="doc.text.fill" size={48} color={colors.muted} />
                  <Text className="text-lg text-muted mt-4">Keine Vorlagen</Text>
                  <Text className="text-sm text-muted text-center mt-2">
                    Erstellen Sie Vorlagen wie Wartungsvertrag, Hostingvertrag oder Domainvertrag
                  </Text>
                  <TouchableOpacity
                    className="bg-primary px-6 py-3 rounded-lg mt-4"
                    onPress={() => {
                      setEditingTemplate(null);
                      setShowTemplateModal(true);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text className="text-background font-semibold">Vorlage erstellen</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>
      </View>

      {/* Plus-Menü */}
      <Modal
        visible={showPlusMenu}
        animationType="fade"
        transparent
        onRequestClose={() => setShowPlusMenu(false)}
      >
        <TouchableOpacity
          className="flex-1 bg-black/50 justify-end"
          activeOpacity={1}
          onPress={() => setShowPlusMenu(false)}
        >
          <View className="bg-background rounded-t-3xl p-4">
            <View className="w-10 h-1 bg-border rounded-full self-center mb-4" />
            <Text className="text-xl font-bold text-foreground mb-4">Neu erstellen</Text>
            <View className="gap-3">
              <TouchableOpacity
                className="bg-surface border border-border rounded-xl p-4 flex-row items-center"
                activeOpacity={0.7}
                onPress={() => {
                  setShowPlusMenu(false);
                  setShowAddModal(true);
                }}
              >
                <View
                  className="w-12 h-12 rounded-full items-center justify-center mr-4"
                  style={{ backgroundColor: colors.primary + "20" }}
                >
                  <IconSymbol name="doc.text.fill" size={24} color={colors.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-lg font-semibold text-foreground">Neuer Vertrag</Text>
                  <Text className="text-sm text-muted">Vertrag für einen Kunden erstellen</Text>
                </View>
                <IconSymbol name="chevron.right" size={20} color={colors.muted} />
              </TouchableOpacity>

              <TouchableOpacity
                className="bg-surface border border-border rounded-xl p-4 flex-row items-center"
                activeOpacity={0.7}
                onPress={() => {
                  setShowPlusMenu(false);
                  setEditingTemplate(null);
                  setShowTemplateModal(true);
                }}
              >
                <View
                  className="w-12 h-12 rounded-full items-center justify-center mr-4"
                  style={{ backgroundColor: "#8B5CF6" + "20" }}
                >
                  <IconSymbol name="doc.on.doc.fill" size={24} color="#8B5CF6" />
                </View>
                <View className="flex-1">
                  <Text className="text-lg font-semibold text-foreground">Neue Vorlage</Text>
                  <Text className="text-sm text-muted">Vertragsvorlage zum Wiederverwenden</Text>
                </View>
                <IconSymbol name="chevron.right" size={20} color={colors.muted} />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Vertragsformular Modal */}
      <ContractFormModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["contracts"] });
          queryClient.invalidateQueries({ queryKey: ["customers"] });
        }}
      />

      {/* Vorlagen-Formular Modal */}
      <ContractTemplateFormModal
        visible={showTemplateModal}
        template={editingTemplate}
        onClose={() => {
          setShowTemplateModal(false);
          setEditingTemplate(null);
        }}
        onSubmit={handleTemplateSubmit}
      />

      {/* Vertrags-Details Modal */}
      {selectedContract && (
        <ContractDetailsModal
          contract={selectedContract}
          onClose={() => setSelectedContract(null)}
          onEdit={(c: any) => {
            setSelectedContract(null);
            setEditingContract(c);
          }}
          onDelete={(c: any) => {
            showConfirm(
              "Vertrag löschen",
              `Möchten Sie den Vertrag "${c.title}" wirklich löschen?`,
              async () => {
                try {
                  await Data.deleteContract(c.id);
                  setSelectedContract(null);
                  queryClient.invalidateQueries({ queryKey: ["contracts"] });
                  showAlert("Erfolg", "Vertrag wurde gelöscht");
                } catch (e: any) {
                  showAlert("Fehler", e.message);
                }
              },
              "Löschen"
            );
          }}
          getStatusLabel={getStatusLabel}
          getStatusColor={getStatusColor}
        />
      )}

      {/* Vertrag bearbeiten */}
      {editingContract && (
        <ContractFormModal
          visible={true}
          contract={editingContract}
          onClose={() => setEditingContract(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["contracts"] });
            queryClient.invalidateQueries({ queryKey: ["customers"] });
            setEditingContract(null);
          }}
        />
      )}
    </ScreenContainer>
  );
}

// Vertrags-Details Modal mit Historie
function ContractDetailsModal({
  contract,
  onClose,
  onEdit,
  onDelete,
  getStatusLabel,
  getStatusColor,
}: {
  contract: any;
  onClose: () => void;
  onEdit?: (contract: any) => void;
  onDelete?: (contract: any) => void;
  getStatusLabel: (status: ContractStatus) => string;
  getStatusColor: (status: ContractStatus) => string;
}) {
  const colors = useColors();
  const [history] = useState([
    {
      id: 1,
      type: "system" as const,
      text: "Vertrag erstellt",
      createdAt: contract.start_date || contract.created_at,
      user: "System",
    },
    {
      id: 2,
      type: "activity" as const,
      text: "Vertrag vom Kunden unterzeichnet",
      createdAt: contract.start_date || contract.created_at,
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
              <View>
                <View className="flex-row items-start justify-between mb-2">
                  <View className="flex-1">
                    <Text className="text-xl font-bold text-foreground mb-1">
                      {contract.title}
                    </Text>
                    <Text className="text-base text-muted">{contract.customer_name}</Text>
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

              <View className="bg-surface rounded-xl p-4 border border-border">
                <View className="gap-3">
                  <View>
                    <Text className="text-sm text-muted mb-1">Laufzeit</Text>
                    <Text className="text-base text-foreground">
                      {formatDate(contract.start_date)} - {formatDate(contract.end_date)}
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
                      {contract.notice_period_months} {contract.notice_period_months === 1 ? "Monat" : "Monate"}
                    </Text>
                  </View>
                </View>
              </View>

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
          <View className="p-4 border-t border-border gap-2">
            <View className="flex-row gap-3">
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
                onPress={() => onEdit?.(contract)}
              >
                <Text className="text-background font-semibold text-center">Bearbeiten</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              className="bg-error/10 border border-error/30 py-3 rounded-lg"
              activeOpacity={0.8}
              onPress={() => onDelete?.(contract)}
            >
              <Text className="text-error font-semibold text-center">Vertrag löschen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

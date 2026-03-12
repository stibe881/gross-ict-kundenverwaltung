import { useState, useCallback } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Modal,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
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

  const getStatusLabel = (item: any) => {
    if (item.status === "cancelled" || item.cancellation_date) return "Gekündigt";
    if (item.signature_date) return "Unterzeichnet";
    if (item.status === "pending_signature" || item.status === "active") return "Warten auf Unterschrift";
    if (item.status === "expired") return "Abgelaufen";
    return "Unbekannt";
  };

  const getStatusColor = (item: any) => {
    if (item.status === "cancelled" || item.cancellation_date) return colors.error;
    if (item.signature_date) return colors.success;
    if (item.status === "pending_signature" || item.status === "active") return "#f59e0b";
    if (item.status === "expired") return colors.error;
    return colors.muted;
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
          style={{ backgroundColor: getStatusColor(item) + "20" }}
        >
          <Text
            className="text-xs font-semibold"
            style={{ color: getStatusColor(item) }}
          >
            {getStatusLabel(item)}
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

// Vertrags-Details Modal mit Signing
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
  getStatusLabel: (item: any) => string;
  getStatusColor: (item: any) => string;
}) {
  const colors = useColors();
  const [sending, setSending] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelDate, setCancelDate] = useState("");
  const [cancelDoc, setCancelDoc] = useState<any>(null);
  const [cancelling, setCancelling] = useState(false);

  const queryClient = useQueryClient();

  const handleSendForSignature = async () => {
    if (!contract.customer_id) {
      showAlert("Fehler", "Kein Kunde zugewiesen.");
      return;
    }
    showConfirm(
      "Zur Unterschrift senden",
      `Vertrag "${contract.title}" per E-Mail an den Kunden senden?`,
      async () => {
        setSending(true);
        try {
          const { supabase } = await import("@/lib/supabase");
          const { data, error } = await supabase.functions.invoke("send-contract-email", {
            body: { contractId: contract.id },
          });
          if (error) {
            const ctx = (error as any).context;
            const detail = (ctx && typeof ctx === "object" && ctx.error) ? ctx.error
              : (ctx && typeof ctx === "string") ? ctx
                : error.message;
            throw new Error(detail);
          }
          if (data?.error) throw new Error(data.error);
          showAlert("Erfolg", "Vertrag wurde per E-Mail zur Unterschrift gesendet.");
          queryClient.invalidateQueries({ queryKey: ["contracts"] });
        } catch (err: any) {
          showAlert("Fehler", err.message || "E-Mail konnte nicht gesendet werden");
        } finally {
          setSending(false);
        }
      },
      "Senden"
    );
  };

  const handleCancelSubmit = async () => {
    if (!cancelDate) {
      showAlert("Fehler", "Bitte wählen Sie ein Kündigungsdatum (z.B. 31.12.2026)");
      return;
    }
    setCancelling(true);
    try {
      let docUrl = undefined;
      if (cancelDoc) {
        docUrl = await Data.uploadCancellationDocument(contract.id, cancelDoc.uri, cancelDoc.name);
      }

      const parts = cancelDate.split(".");
      const dbDate = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : cancelDate;

      await Data.updateContract(contract.id, {
        status: "cancelled",
        cancellation_date: dbDate,
        cancellation_document_url: docUrl || null,
      });

      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      showAlert("Erfolg", "Vertrag wurde erfolgreich gekündigt");
      setShowCancelModal(false);
      onClose();
    } catch (err: any) {
      showAlert("Fehler", err.message);
    } finally {
      setCancelling(false);
    }
  };

  const pickCancelDoc = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        setCancelDoc(res.assets[0]);
      }
    } catch (e) {
      console.warn(e);
    }
  };

  const isSigned = !!contract.signature_date;
  const isPending = contract.status === "pending_signature" || (!isSigned && contract.status === "active");
  const isCancelled = contract.status === "cancelled" || !!contract.cancellation_date;

  const statusLabel = getStatusLabel(contract);
  const statusColor = getStatusColor(contract);

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
                    style={{ backgroundColor: statusColor + "20" }}
                  >
                    <Text className="text-sm font-semibold" style={{ color: statusColor }}>
                      {statusLabel}
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
                  {contract.cancellation_date && (
                    <View className="mt-2 p-3 bg-warning/10 rounded-lg border border-warning/20">
                      <Text className="text-sm font-semibold text-warning mb-1">Kündigungsdatum</Text>
                      <Text className="text-base text-warning">
                        {new Date(contract.cancellation_date).toLocaleDateString("de-CH")}
                      </Text>
                      {contract.cancellation_document_url && (
                        <TouchableOpacity
                          onPress={() => Linking.openURL(contract.cancellation_document_url!)}
                          className="flex-row items-center gap-2 mt-2 bg-background p-2 rounded border border-border"
                        >
                          <IconSymbol name="doc.text.fill" size={16} color={colors.primary} />
                          <Text className="text-primary text-sm font-semibold">Kündigungsschreiben öffnen</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              </View>

              {/* Signatur-Status */}
              <View className="bg-surface rounded-xl p-4 border border-border">
                <Text className="text-lg font-bold text-foreground mb-3">Digitale Unterschrift</Text>
                {isSigned ? (
                  <View className="gap-2">
                    <View className="flex-row items-center gap-2">
                      <IconSymbol name="checkmark.seal.fill" size={20} color="#22c55e" />
                      <Text className="text-sm font-semibold text-success">Digital unterzeichnet</Text>
                    </View>
                    <View className="flex-row justify-between py-1">
                      <Text className="text-sm text-muted">Unterzeichnet von</Text>
                      <Text className="text-sm font-semibold text-foreground">{contract.signature_name}</Text>
                    </View>
                    <View className="flex-row justify-between py-1">
                      <Text className="text-sm text-muted">Datum</Text>
                      <Text className="text-sm text-foreground">
                        {new Date(contract.signature_date).toLocaleDateString("de-CH")}
                      </Text>
                    </View>
                    {contract.signature_ip && (
                      <View className="flex-row justify-between py-1">
                        <Text className="text-sm text-muted">IP-Adresse</Text>
                        <Text className="text-sm text-muted">{contract.signature_ip}</Text>
                      </View>
                    )}
                  </View>
                ) : isPending ? (
                  <View className="gap-2">
                    <View className="flex-row items-center gap-2">
                      <IconSymbol name="clock.fill" size={20} color="#f59e0b" />
                      <Text className="text-sm font-semibold text-warning">Warte auf Unterschrift</Text>
                    </View>
                    <Text className="text-xs text-muted mt-1">
                      Der Vertrag wurde per E-Mail an den Kunden gesendet und wartet auf Unterschrift.
                    </Text>
                  </View>
                ) : (
                  <View className="gap-2">
                    <View className="flex-row items-center gap-2">
                      <IconSymbol name="pencil.and.outline" size={20} color={colors.muted} />
                      <Text className="text-sm text-muted">Noch nicht unterschrieben</Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View className="p-4 border-t border-border gap-2">
            {!isSigned && !isCancelled && (
              <TouchableOpacity
                className="bg-success py-3 rounded-lg flex-row items-center justify-center"
                activeOpacity={0.8}
                onPress={handleSendForSignature}
                disabled={sending}
              >
                <IconSymbol name="paperplane.fill" size={18} color="#FFFFFF" />
                <Text className="text-white font-semibold ml-2">
                  {sending ? "Wird gesendet..." : "Zur Unterschrift senden"}
                </Text>
              </TouchableOpacity>
            )}
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
            <View className="flex-row gap-3">
              {!isCancelled && (
                <TouchableOpacity
                  className="flex-1 border border-warning/50 py-3 rounded-lg"
                  activeOpacity={0.8}
                  onPress={() => setShowCancelModal(true)}
                >
                  <Text className="text-warning font-semibold text-center">Kündigen</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                className="flex-1 bg-error/10 border border-error/30 py-3 rounded-lg"
                activeOpacity={0.8}
                onPress={() => onDelete?.(contract)}
              >
                <Text className="text-error font-semibold text-center">Löschen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* Kündigung Modal */}
      <Modal visible={showCancelModal} animationType="slide" transparent onRequestClose={() => setShowCancelModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 bg-black/60 justify-center p-4">
          <View className="bg-background rounded-2xl p-6 shadow-lg border border-border mx-2">
            <View className="mb-4">
              <Text className="text-xl font-bold text-foreground">Vertrag kündigen</Text>
              <Text className="text-sm text-muted mt-1">Geben Sie das Datum der Kündigung an und hängen Sie optional das Schreiben des Kunden an.</Text>
            </View>

            <View className="gap-4">
              {/* Kündigungsdatum */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">Kündigungsdatum *</Text>
                <TextInput
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="TT.MM.JJJJ"
                  placeholderTextColor={colors.muted}
                  value={cancelDate}
                  onChangeText={setCancelDate}
                />
              </View>

              {/* Dokument */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">Kündigungsschreiben (optional)</Text>
                <TouchableOpacity
                  className="bg-surface border border-dashed border-border rounded-lg px-4 py-4 items-center justify-center flex-row gap-2"
                  onPress={pickCancelDoc}
                  activeOpacity={0.7}
                >
                  <IconSymbol name={cancelDoc ? "doc.text.fill" : "doc.badge.plus"} size={24} color={cancelDoc ? colors.success : colors.muted} />
                  <Text className={cancelDoc ? "text-success font-semibold" : "text-muted"}>
                    {cancelDoc ? cancelDoc.name : "Kündigungsschreiben auswählen (PDF)"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Aktionen */}
            <View className="flex-row gap-3 mt-6">
              <TouchableOpacity
                className="flex-1 bg-surface border border-border py-3 rounded-lg"
                activeOpacity={0.8}
                onPress={() => {
                  setShowCancelModal(false);
                  setCancelDate("");
                  setCancelDoc(null);
                }}
              >
                <Text className="text-foreground font-semibold text-center">Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-warning py-3 rounded-lg flex-row items-center justify-center"
                activeOpacity={0.8}
                onPress={handleCancelSubmit}
                disabled={cancelling}
              >
                <Text className="text-background font-bold text-center">
                  {cancelling ? "Speichern..." : "Kündigen"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Modal>
  );
}


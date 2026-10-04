import { useState, useCallback, useMemo, useEffect } from "react";
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
  RefreshControl,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useIsReadOnly } from "@/hooks/use-is-read-only";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { formatDate, formatCurrency } from "@/lib/format";
import { ContractFormModal } from "@/components/contract-form-modal";
import { ContractTemplateFormModal } from "@/components/contract-template-form-modal";
import { useGlobalRefresh } from "@/hooks/use-global-refresh";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { showAlert, showConfirm } from "@/lib/alert";
import { showToast } from "@/components/toast-provider";
import { downloadContractPDF } from "@/lib/pdf-utils";

type ContractStatus = "active" | "cancelled" | "expired";

const getBillingCycleLabel = (cycle: string | null | undefined) =>
  ({ monthly: "Monatlich", quarterly: "Quartalsweise", semi_annual: "Halbjährlich", yearly: "Jährlich" }[cycle || "yearly"] || "Jährlich");

export default function ContractsScreen() {
  const colors = useColors();
    const isReadOnly = useIsReadOnly();
  const { containerStyle, contentPadding } = useResponsiveLayout();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { refreshing, onRefresh } = useGlobalRefresh();
  const [filter, setFilter] = useState<"all" | ContractStatus | "signed" | "pending">("all");
  const [sortBy, setSortBy] = useState<"newest" | "next_invoice" | "expiry" | "customer" | "amount">("newest");
  const [searchQuery, setSearchQuery] = useState("");

  // Verträge aus DB laden
  const { data: contracts = [], isLoading: contractsLoading } = useQuery({
    queryKey: ["contracts"],
    queryFn: Data.getContracts,
  });

  // Deep-Link aus Heute-Feed/Push: /contracts?contractId=... öffnet den Vertrag direkt
  const { contractId } = useLocalSearchParams();
  useEffect(() => {
    if (!contractId || !contracts.length) return;
    const found = (contracts as any[]).find((c: any) => String(c.id) === String(contractId));
    if (found) setSelectedContract(found);
  }, [contractId, contracts]);
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

  const getFilterLabel = (status: string) => {
    switch (status) {
      case "active": return "Aktiv";
      case "cancelled": return "Gekündigt";
      case "expired": return "Abgelaufen";
      case "signed": return "Unterzeichnet";
      case "pending": return "Warten auf Unterschrift";
      default: return "Unbekannt";
    }
  };

  const getStatusColor = (item: any) => {
    if (item.status === "cancelled" || item.cancellation_date) return colors.error;
    if (item.signature_date) return colors.success;
    if (item.status === "pending_signature" || item.status === "active") return "#f59e0b";
    if (item.status === "expired") return colors.error;
    return colors.muted;
  };

  // Farben für die Filter-Chips
  const FILTER_COLORS: Record<string, string> = {
    active: "#3B82F6",
    signed: "#10B981",
    pending: "#F59E0B",
    cancelled: "#EF4444",
    expired: "#6B7280",
  };

  const filterCounts = useMemo(() => {
    const c: Record<string, number> = { all: contracts.length, active: 0, signed: 0, pending: 0, cancelled: 0, expired: 0 };
    contracts.forEach((ct: any) => {
      if (ct.status === "active") c.active++;
      if (ct.signature_date) c.signed++;
      if (!ct.signature_date && (ct.status === "pending_signature" || ct.status === "active")) c.pending++;
      if (ct.status === "cancelled") c.cancelled++;
      if (ct.status === "expired") c.expired++;
    });
    return c;
  }, [contracts]);

  const activeYearlyTotal = useMemo(
    () => contracts.filter((c: any) => c.status === "active").reduce((sum: number, c: any) => sum + ((c.amount || 0) - (c.internal_costs || 0)), 0),
    [contracts]
  );

  const filteredContracts: any[] = useMemo(() => {
    const filtered = (filter === "all" ? contracts : contracts.filter((c) => {
      if (filter === "signed") return !!c.signature_date;
      if (filter === "pending") return !c.signature_date && (c.status === "pending_signature" || c.status === "active");
      return c.status === filter;
    })).filter((c) => {
      if (!searchQuery.trim()) return true;
      const search = searchQuery.toLowerCase();
      return (
        (c.title || "").toLowerCase().includes(search) ||
        (c.customer_name || "").toLowerCase().includes(search)
      );
    });

    const sorted = [...filtered];
    switch (sortBy) {
      case "next_invoice":
        // Verträge ohne nächstes Rechnungsdatum ans Ende
        sorted.sort((a, b) => {
          const da = a.recurring_enabled && a.next_invoice_date ? a.next_invoice_date : null;
          const db = b.recurring_enabled && b.next_invoice_date ? b.next_invoice_date : null;
          if (da && db) return da.localeCompare(db);
          if (da) return -1;
          if (db) return 1;
          return 0;
        });
        break;
      case "expiry":
        // Nächstes Ablaufdatum zuerst; unbefristete Verträge (ohne end_date) ans Ende
        sorted.sort((a, b) => {
          const da = a.end_date || null;
          const db = b.end_date || null;
          if (da && db) return da.localeCompare(db);
          if (da) return -1;
          if (db) return 1;
          return 0;
        });
        break;
      case "customer":
        sorted.sort((a, b) => (a.customer_name || "").localeCompare(b.customer_name || "", "de"));
        break;
      case "amount":
        sorted.sort((a, b) => (b.amount || 0) - (a.amount || 0));
        break;
      default:
        // "newest": Reihenfolge aus der DB (created_at desc) beibehalten
        break;
    }
    return sorted;
  }, [contracts, filter, sortBy, searchQuery]);

  const renderContractItem = useCallback(({ item }: { item: any }) => {
    const statusColor = getStatusColor(item);
    return (
      <TouchableOpacity
        className="bg-surface rounded-xl mb-3 border border-border overflow-hidden"
        style={{ flexDirection: "row" }}
        activeOpacity={0.7}
        onPress={() => setSelectedContract(item)}
      >
        {/* Farbiger Status-Streifen links */}
        <View style={{ width: 4, backgroundColor: statusColor }} />

        <View className="flex-1 p-3.5">
          {/* Kopfzeile: Nummer + Intern + Status */}
          <View className="flex-row items-center mb-1.5">
            {item.contract_number && (
              <Text className="text-[11px] font-semibold text-muted">{item.contract_number}</Text>
            )}
            {item.is_internal && (
              <View className="ml-2 px-1.5 py-0.5 rounded" style={{ backgroundColor: colors.primary + "18" }}>
                <Text className="text-[10px] font-bold" style={{ color: colors.primary }}>INTERN</Text>
              </View>
            )}
            <View className="flex-1" />
            <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: statusColor + "18" }}>
              <Text className="text-[10px] font-bold" style={{ color: statusColor }}>
                {getStatusLabel(item)}
              </Text>
            </View>
          </View>

          {/* Kunde + Titel */}
          <Text className="text-base font-bold text-foreground" numberOfLines={1}>
            {item.customer_name || item.employee_name || "–"}
          </Text>
          <Text className="text-xs text-muted mt-0.5" numberOfLines={1}>{item.title}</Text>

          {/* Laufzeit + Betrag */}
          <View className="flex-row items-end justify-between mt-2">
            <View className="flex-row items-center flex-1 mr-2">
              <IconSymbol name="calendar" size={11} color={colors.muted} />
              <Text className="text-[11px] text-muted ml-1" numberOfLines={1}>
                {item.is_internal ? `Ab ${formatDate(item.start_date)}` : `${formatDate(item.start_date)} – ${formatDate(item.end_date)}`}
                {!item.is_internal && item.notice_period_months
                  ? ` · Frist ${item.notice_period_months} Mt.`
                  : ""}
              </Text>
            </View>
            {!item.is_internal && (
              <Text className="text-sm font-bold text-success">
                {formatCurrency(item.amount)}/Jahr
              </Text>
            )}
          </View>

          {/* Nächste Rechnung */}
          {item.recurring_enabled && item.next_invoice_date && item.status === "active" && (
            <View className="flex-row items-center gap-1.5 mt-2 pt-2 border-t border-border">
              <IconSymbol name="arrow.clockwise" size={12} color={colors.primary} />
              <Text className="text-[11px] text-muted">Nächste Rechnung</Text>
              <Text className="text-[11px] font-bold" style={{ color: colors.primary }}>
                {formatDate(item.next_invoice_date)}
              </Text>
              <Text className="text-[11px] text-muted">· {getBillingCycleLabel(item.billing_cycle)}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [colors, getStatusColor, getStatusLabel]);

  const renderTemplateItem = useCallback(({ item }: { item: any }) => (
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
  ), [colors, setEditingTemplate, setShowTemplateModal, handleDeleteTemplate, formatCurrency]);

  const renderHeader = useCallback(() => (
    <View>
      {/* Kopfzeile */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center gap-3 flex-1">
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <View>
            <Text className="text-2xl font-bold text-foreground">Verträge</Text>
            <Text className="text-xs text-muted">
              {filterCounts.active} aktiv · {formatCurrency(activeYearlyTotal)}/Jahr
            </Text>
          </View>
        </View>
        {!isReadOnly && (
        <TouchableOpacity
          className="bg-primary w-10 h-10 rounded-full items-center justify-center"
          activeOpacity={0.8}
          onPress={() => setShowPlusMenu(true)}
        >
          <IconSymbol name="plus" size={22} color={colors.background} />
        </TouchableOpacity>
        )}
      </View>

      {/* Tab Switcher */}
      <View className="flex-row bg-surface border border-border rounded-xl overflow-hidden mb-4">
        {([["contracts", `Verträge (${contracts.length})`], ["templates", `Vorlagen${templates?.length ? ` (${templates.length})` : ""}`]] as const).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            className="flex-1 py-2.5"
            style={{ backgroundColor: activeTab === key ? colors.primary : "transparent" }}
            onPress={() => setActiveTab(key)}
            activeOpacity={0.8}
          >
            <Text className="font-semibold text-center text-sm" style={{ color: activeTab === key ? colors.background : colors.foreground }}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === "contracts" && (
        <>
          {/* Filter-Chips mit Zählern */}
          <View className="mb-2">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
              {["all", "active", "signed", "pending", "cancelled", "expired"].map((status) => {
                const active = filter === status;
                const chipColor = status === "all" ? colors.primary : FILTER_COLORS[status] || colors.primary;
                return (
                  <TouchableOpacity
                    key={status}
                    className="flex-row items-center px-3 py-1.5 rounded-full border"
                    style={{
                      backgroundColor: active ? chipColor : colors.surface,
                      borderColor: active ? chipColor : colors.border,
                    }}
                    onPress={() => setFilter(status as any)}
                    activeOpacity={0.8}
                  >
                    <Text className="text-xs font-semibold" style={{ color: active ? "#fff" : colors.foreground }}>
                      {status === "all" ? "Alle" : getFilterLabel(status)}
                    </Text>
                    <Text className="text-xs font-bold ml-1.5" style={{ color: active ? "#fff" : chipColor }}>
                      {filterCounts[status] || 0}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Sortierung */}
          <View className="mb-3">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingBottom: 4 }}>
              <View className="flex-row items-center gap-2">
                <IconSymbol name="arrow.up.arrow.down" size={14} color={colors.muted} />
                {([
                  ["newest", "Neueste"],
                  ["next_invoice", "Nächste Rechnung"],
                  ["expiry", "Läuft ab"],
                  ["customer", "Kunde"],
                  ["amount", "Betrag"],
                ] as const).map(([key, label]) => (
                  <TouchableOpacity
                    key={key}
                    className="px-3 py-1 rounded-full border"
                    style={{
                      backgroundColor: sortBy === key ? colors.primary + "15" : colors.surface,
                      borderColor: sortBy === key ? colors.primary : colors.border,
                    }}
                    onPress={() => setSortBy(key)}
                    activeOpacity={0.8}
                  >
                    <Text
                      className="text-xs font-semibold"
                      style={{ color: sortBy === key ? colors.primary : colors.foreground }}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </>
      )}
    </View>
  ), [colors, router, activeTab, contracts, templates, filter, sortBy, filterCounts, activeYearlyTotal, setActiveTab, setFilter, setSortBy, setShowPlusMenu]);

  const renderEmptyComponent = useCallback(() => {
    if (activeTab === "contracts") {
      return (
        <View className="flex-1 items-center justify-center py-20">
          <IconSymbol name="doc.text.fill" size={48} color={colors.muted} />
          <Text className="text-base font-semibold text-foreground mt-4">
            {searchQuery || filter !== "all" ? "Keine Verträge gefunden" : "Noch keine Verträge"}
          </Text>
          <Text className="text-sm text-muted mt-1 text-center">
            {searchQuery || filter !== "all" ? "Suche oder Filter anpassen." : "Erstelle deinen ersten Vertrag."}
          </Text>
        </View>
      );
    } else {
      if (templatesLoading) {
        return (
          <View className="flex-1 items-center justify-center py-20">
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        );
      }
      return (
        <View className="flex-1 items-center justify-center py-20">
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
      );
    }
  }, [activeTab, templatesLoading, colors, searchQuery, filter, setEditingTemplate, setShowTemplateModal]);

  return (
    <ScreenContainer>
      <View className="flex-1" style={{ padding: contentPadding }}>
        <View style={[containerStyle, { flex: 1 }]}>
          {renderHeader()}
          {/* Suchfeld – außerhalb von renderHeader, damit es stabil im Komponentenbaum bleibt
              und die Tastatur nicht nach jedem Zeichen schließt (React Native Re-mount-Problem) */}
          {activeTab === "contracts" && (
            <View className="mb-4">
              <View className="flex-row items-center bg-surface border border-border rounded-xl px-4 py-2">
                <IconSymbol name="magnifyingglass" size={20} color={colors.muted} />
                <TextInput
                  className="flex-1 ml-2 text-foreground h-10"
                  placeholder="Suchen..."
                  placeholderTextColor={colors.muted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <IconSymbol name="xmark.circle.fill" size={20} color={colors.muted} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
          <FlatList
            data={activeTab === "contracts" ? filteredContracts : templates}
            renderItem={activeTab === "contracts" ? renderContractItem : renderTemplateItem}
            keyExtractor={(item) => item.id.toString()}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={renderEmptyComponent}
            contentContainerStyle={{ flexGrow: 1 }}
            className="flex-1"
          />
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
                  await Data.logContractActivity(c.id, "deleted", `Vertrag "${c.title}" wurde gelöscht`);
                  await Data.deleteContract(c.id);
                  setSelectedContract(null);
                  queryClient.invalidateQueries({ queryKey: ["contracts"] });
                  showToast("Vertrag wurde gelöscht");
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

  const { data: activities = [] } = useQuery({
    queryKey: ["contract_activities", contract.id],
    queryFn: () => Data.getContractActivities(contract.id),
  });

  const handleSendForSignature = async () => {
    if (!contract.customer_id && !(contract.is_internal && contract.employee_id)) {
      showAlert("Fehler", contract.is_internal ? "Kein Mitarbeiter zugewiesen." : "Kein Kunde zugewiesen.");
      return;
    }
    const recipientLabel = contract.is_internal ? "den Mitarbeiter" : "den Kunden";
    showConfirm(
      "Zur Unterschrift senden",
      `Vertrag "${contract.title}" per E-Mail an ${recipientLabel} senden?`,
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
          showToast("Vertrag wurde per E-Mail zur Unterschrift gesendet.");
          queryClient.invalidateQueries({ queryKey: ["contracts"] });
          queryClient.invalidateQueries({ queryKey: ["contract_activities", contract.id] });
          await Data.logContractActivity(contract.id, "sent", `Vertrag per E-Mail an ${recipientLabel} gesendet`);
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
      await Data.logContractActivity(contract.id, "cancelled", `Vertrag gekündigt zum ${cancelDate}`);
      showToast("Vertrag wurde erfolgreich gekündigt");
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
  const isPending = contract.status === "pending_signature";
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
                    {contract.contract_number && (
                      <View
                        className="flex-row items-center gap-1 mb-1 self-start px-2 py-0.5 rounded"
                        style={{ backgroundColor: colors.primary + "15" }}
                      >
                        <IconSymbol name="doc.text" size={12} color={colors.primary} />
                        <Text
                          className="text-xs font-bold font-mono"
                          style={{ color: colors.primary }}
                        >
                          {contract.contract_number}
                        </Text>
                      </View>
                    )}
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
                    <Text className="text-sm text-muted mb-1">{contract.is_internal ? "Startdatum" : "Laufzeit"}</Text>
                    <Text className="text-base text-foreground">
                      {contract.is_internal ? formatDate(contract.start_date) : `${formatDate(contract.start_date)} - ${formatDate(contract.end_date)}`}
                    </Text>
                  </View>
                  {!contract.is_internal && (
                  <View>
                    <Text className="text-sm text-muted mb-1">Jahresbetrag</Text>
                    <Text className="text-lg font-bold text-success">
                      {formatCurrency(contract.amount)}
                    </Text>
                  </View>
                  )}
                  {!contract.is_internal && (
                  <View>
                    <Text className="text-sm text-muted mb-1">Kündigungsfrist</Text>
                    <Text className="text-base text-foreground">
                      {contract.notice_period_months} {contract.notice_period_months === 1 ? "Monat" : "Monate"}
                    </Text>
                  </View>
                  )}
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

            {/* Domain-Übersicht */}
            {contract.domains && contract.domains.length > 0 && (
              <View className="bg-surface rounded-xl p-4 border border-border">
                <Text className="text-lg font-bold text-foreground mb-3">Domains</Text>
                <View style={{ gap: 0 }}>
                  <View style={{ flexDirection: 'row', paddingBottom: 6, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <Text style={{ flex: 2, fontSize: 11, fontWeight: '600', color: colors.muted }}>Domain</Text>
                    <Text style={{ flex: 1, fontSize: 11, fontWeight: '600', color: colors.muted, textAlign: 'right' }}>Betrag/J.</Text>
                    <Text style={{ flex: 1, fontSize: 11, fontWeight: '600', color: colors.muted, textAlign: 'right' }}>Eigenkost.</Text>
                  </View>
                  {contract.domains.map((d: any, idx: number) => (
                    <View key={idx} style={{ flexDirection: 'row', paddingVertical: 5, borderBottomWidth: idx < contract.domains.length - 1 ? 1 : 0, borderBottomColor: colors.border + '60' }}>
                      <Text style={{ flex: 2, fontSize: 13, color: colors.foreground, fontFamily: 'monospace' }} numberOfLines={1}>{d.name || '-'}</Text>
                      <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: colors.primary, textAlign: 'right' }}>
                        {formatCurrency(d.annual_amount || 0)}
                      </Text>
                      <Text style={{ flex: 1, fontSize: 13, color: colors.muted, textAlign: 'right' }}>
                        {formatCurrency(d.internal_costs || 0)}
                      </Text>
                    </View>
                  ))}
                  <View style={{ flexDirection: 'row', paddingTop: 8, marginTop: 4, borderTopWidth: 2, borderTopColor: colors.border }}>
                    <Text style={{ flex: 2, fontSize: 12, fontWeight: '700', color: colors.foreground }}>Total</Text>
                    <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: colors.primary, textAlign: 'right' }}>
                      {formatCurrency(contract.domains.reduce((s: number, d: any) => s + (d.annual_amount || 0), 0))}
                    </Text>
                    <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: colors.muted, textAlign: 'right' }}>
                      {formatCurrency(contract.domains.reduce((s: number, d: any) => s + (d.internal_costs || 0), 0))}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* M365 Lizenzen-Übersicht */}
            {contract.m365_licenses && contract.m365_licenses.length > 0 && (
              <View className="bg-surface rounded-xl p-4 border border-border">
                <Text className="text-lg font-bold text-foreground mb-3">M365 Lizenzen</Text>
                <View style={{ gap: 0 }}>
                  <View style={{ flexDirection: 'row', paddingBottom: 6, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <Text style={{ flex: 2, fontSize: 11, fontWeight: '600', color: colors.muted }}>Lizenz (Variante)</Text>
                    <Text style={{ flex: 1, fontSize: 11, fontWeight: '600', color: colors.muted, textAlign: 'center' }}>Anzahl</Text>
                  </View>
                  {contract.m365_licenses.map((l: any, idx: number) => (
                    <View key={idx} style={{ flexDirection: 'row', paddingVertical: 5, borderBottomWidth: idx < contract.m365_licenses.length - 1 ? 1 : 0, borderBottomColor: colors.border + '60' }}>
                      <Text style={{ flex: 2, fontSize: 13, color: colors.foreground, paddingRight: 4 }}>
                        {l.baseName} {l.baseName !== 'Microsoft 365 Apps for Business' && <Text style={{ color: colors.muted, fontSize: 11 }}>({l.withTeams ? 'mit Teams' : 'ohne Teams'})</Text>}
                      </Text>
                      <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: colors.primary, textAlign: 'center' }}>
                        {l.quantity}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

              {/* Regelmässige Rechnungen Info */}
              {contract.recurring_enabled && (
                <View className="bg-surface rounded-xl p-4 border border-border">
                  <Text className="text-lg font-bold text-foreground mb-3">Regelmässige Rechnungen</Text>
                  <View className="gap-3">
                    <View className="flex-row justify-between">
                      <Text className="text-sm text-muted">Abrechnungszyklus</Text>
                      <Text className="text-sm font-semibold text-foreground">
                        {{ "monthly": "Monatlich", "quarterly": "Quartalsweise", "semi_annual": "Halbjährlich", "yearly": "Jährlich" }[contract.billing_cycle as string] || "Jährlich"}
                      </Text>
                    </View>
                    {contract.next_invoice_date && (
                      <View className="flex-row justify-between">
                        <Text className="text-sm text-muted">Nächste Rechnung am</Text>
                        <Text className="text-sm font-semibold text-foreground">
                          {formatDate(contract.next_invoice_date)}
                        </Text>
                      </View>
                    )}
                    {contract.payment_terms && (
                      <View className="flex-row justify-between">
                        <Text className="text-sm text-muted">Zahlungsfrist</Text>
                        <Text className="text-sm font-semibold text-foreground">
                          {contract.payment_terms}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Beschreibung, Leistungsumfang, Zusatzvereinbarungen */}
              {(contract.description || contract.scope_of_services || contract.special_agreements) && (
                <View className="bg-surface rounded-xl p-4 border border-border">
                  <View className="gap-3">
                    {contract.description ? (
                      <View>
                        <Text className="text-sm text-muted mb-1">Beschreibung</Text>
                        <Text className="text-base text-foreground">{contract.description}</Text>
                      </View>
                    ) : null}
                    {contract.scope_of_services ? (
                      <View>
                        <Text className="text-sm text-muted mb-1">Leistungsumfang</Text>
                        <Text className="text-base text-foreground">{contract.scope_of_services}</Text>
                      </View>
                    ) : null}
                    {contract.special_agreements ? (
                      <View>
                        <Text className="text-sm text-muted mb-1">Zusatzvereinbarungen</Text>
                        <Text className="text-base text-foreground">{contract.special_agreements}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              )}

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
                      <IconSymbol name="paperplane" size={20} color={colors.muted} />
                      <Text className="text-sm text-muted">Noch nicht gesendet</Text>
                    </View>
                    <Text className="text-xs text-muted mt-1">
                      Dieser Vertrag wurde noch nicht zur Unterschrift an den Kunden gesendet.
                    </Text>
                  </View>
                )}
              </View>

              {/* Aktivitätsverlauf */}
              <View className="bg-surface rounded-xl p-4 border border-border">
                <Text className="text-lg font-bold text-foreground mb-3">Aktivitätsverlauf</Text>
                {activities.length === 0 ? (
                  <Text className="text-sm text-muted">Noch keine Aktivitäten vorhanden.</Text>
                ) : (
                  <View className="gap-0">
                    {activities.map((a: any, idx: number) => {
                      const iconMap: Record<string, { name: string; color: string }> = {
                        created: { name: "plus.circle.fill", color: "#22c55e" },
                        edited: { name: "pencil.circle.fill", color: "#3b82f6" },
                        sent: { name: "paperplane.fill", color: "#8b5cf6" },
                        signed: { name: "checkmark.seal.fill", color: "#22c55e" },
                        cancelled: { name: "xmark.circle.fill", color: "#f59e0b" },
                        deleted: { name: "trash.fill", color: "#ef4444" },
                        viewed: { name: "eye.fill", color: "#6366f1" },
                      };
                      const icon = iconMap[a.type] || { name: "clock.fill", color: colors.muted };
                      const isLast = idx === activities.length - 1;
                      return (
                        <View key={a.id} className="flex-row">
                          <View className="items-center mr-3" style={{ width: 24 }}>
                            <IconSymbol name={icon.name as any} size={18} color={icon.color} />
                            {!isLast && (
                              <View style={{ width: 2, flex: 1, backgroundColor: colors.border, marginVertical: 2 }} />
                            )}
                          </View>
                          <View className="flex-1 pb-3">
                            <Text className="text-sm text-foreground">{a.description}</Text>
                            <Text className="text-xs text-muted mt-1">
                              {new Date(a.created_at).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                              {a.user_name && a.user_name !== "System" ? ` · ${a.user_name}` : ""}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
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
            <TouchableOpacity
              className="bg-primary/20 border border-primary/30 py-3 rounded-lg flex-row items-center justify-center"
              activeOpacity={0.8}
              onPress={() => downloadContractPDF(contract)}
            >
              <IconSymbol name="arrow.down.doc.fill" size={18} color={colors.primary} />
              <Text className="text-primary font-semibold ml-2">PDF herunterladen</Text>
            </TouchableOpacity>
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


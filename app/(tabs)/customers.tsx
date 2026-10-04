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
  Modal,
  Platform,
  useWindowDimensions,
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
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width > 900;
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
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
      const matchesTag = !tagFilter || (customer.tags || []).includes(tagFilter);
      return matchesSearch && matchesStatus && matchesTag;
    })
    .sort((a: any, b: any) => getDisplayName(a).localeCompare(getDisplayName(b), "de"));

  // Alle verwendeten Tags für die Filterzeile
  const allTags: string[] = Array.from(
    new Set((customers || []).flatMap((c: any) => c.tags || []))
  ).sort() as string[];

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
            {(item.tags || []).length > 0 && (
              <View className="flex-row flex-wrap gap-1 mt-1.5">
                {(item.tags as string[]).map((tag) => (
                  <View key={tag} style={{ backgroundColor: "#8B5CF618", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>
                    <Text style={{ fontSize: 10, fontWeight: "700", color: "#8B5CF6" }}>#{tag}</Text>
                  </View>
                ))}
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
                onPress={() => setShowCampaignModal(true)}
              >
                <IconSymbol name="megaphone.fill" size={19} color="#8B5CF6" />
              </TouchableOpacity>
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

          {/* Tag-Filter */}
          {allTags.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} className="mb-4">
              <View className="flex-row gap-2">
                {allTags.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => setTagFilter(tagFilter === tag ? null : tag)}
                    style={{
                      backgroundColor: tagFilter === tag ? "#8B5CF6" : colors.surface,
                      borderColor: tagFilter === tag ? "#8B5CF6" : colors.border,
                    }}
                    className="px-3 py-1.5 rounded-full border"
                  >
                    <Text style={{ color: tagFilter === tag ? "#fff" : colors.foreground, fontSize: 12, fontWeight: "600" }}>
                      #{tag}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          ) : null}

          {/* Kundenliste */}
          {isLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : filteredCustomers && filteredCustomers.length > 0 ? (
            isDesktop ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: "hidden", marginBottom: 24 }}>
                  {/* Kopfzeile */}
                  <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <Text style={{ flex: 3, fontSize: 10.5, fontWeight: "700", letterSpacing: 1, color: colors.muted }}>KUNDE</Text>
                    <Text style={{ flex: 1.6, fontSize: 10.5, fontWeight: "700", letterSpacing: 1, color: colors.muted }}>TAGS</Text>
                    <Text style={{ flex: 1.2, fontSize: 10.5, fontWeight: "700", letterSpacing: 1, color: colors.muted }}>ORT</Text>
                    <Text style={{ flex: 1.6, fontSize: 10.5, fontWeight: "700", letterSpacing: 1, color: colors.muted }}>VERTRÄGE / TICKETS</Text>
                    <Text style={{ flex: 1.2, fontSize: 10.5, fontWeight: "700", letterSpacing: 1, color: colors.muted }}>OFFEN</Text>
                    <Text style={{ width: 90, fontSize: 10.5, fontWeight: "700", letterSpacing: 1, color: colors.muted, textAlign: "right" }}>STATUS</Text>
                  </View>
                  {filteredCustomers.map((item: any) => {
                    const name = getDisplayName(item);
                    const counts = item._counts || {};
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border + "50" }}
                        onPress={() => router.push(`/customer/${item.id}` as any)}
                        activeOpacity={0.6}
                      >
                        <View style={{ flex: 3, flexDirection: "row", alignItems: "center", gap: 11, minWidth: 0 }}>
                          {item.logo_url ? (
                            <Image source={{ uri: item.logo_url }} style={{ width: 34, height: 34, borderRadius: 9 }} resizeMode="contain" />
                          ) : (
                            <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
                              <Text style={{ fontWeight: "700", fontSize: 14, color: colors.background }}>{name.charAt(0).toUpperCase()}</Text>
                            </View>
                          )}
                          <View style={{ minWidth: 0, flex: 1 }}>
                            <Text style={{ fontSize: 13.5, fontWeight: "600", color: colors.foreground }} numberOfLines={1}>{name}</Text>
                            {item.email ? <Text style={{ fontSize: 11.5, color: colors.muted }} numberOfLines={1}>{item.email}</Text> : null}
                          </View>
                        </View>
                        <View style={{ flex: 1.6, flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                          {(item.tags || []).length > 0 ? (item.tags as string[]).slice(0, 3).map((tag) => (
                            <View key={tag} style={{ backgroundColor: "#8B5CF618", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>
                              <Text style={{ fontSize: 10, fontWeight: "700", color: "#8B5CF6" }}>#{tag}</Text>
                            </View>
                          )) : <Text style={{ fontSize: 12, color: colors.muted }}>–</Text>}
                        </View>
                        <Text style={{ flex: 1.2, fontSize: 13, color: colors.foreground }} numberOfLines={1}>{item.city || "–"}</Text>
                        <Text style={{ flex: 1.6, fontSize: 12.5, color: colors.muted }}>
                          {counts.activeContracts || 0} Verträge · {counts.openTickets || 0} Tickets
                        </Text>
                        <View style={{ flex: 1.2 }}>
                          {counts.openInvoices > 0 ? (
                            <Text style={{ fontSize: 12.5, fontWeight: "600", color: colors.error }}>
                              {counts.openInvoices} Rechnung{counts.openInvoices === 1 ? "" : "en"}
                            </Text>
                          ) : (
                            <Text style={{ fontSize: 12.5, color: colors.muted }}>–</Text>
                          )}
                        </View>
                        <View style={{ width: 90, alignItems: "flex-end" }}>
                          <View style={{ backgroundColor: item.status === "active" ? "#4ADE8020" : colors.muted + "25", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 99 }}>
                            <Text style={{ fontSize: 11, fontWeight: "700", color: item.status === "active" ? "#22C55E" : colors.muted }}>
                              {item.status === "active" ? "AKTIV" : "INAKTIV"}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            ) : (
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
            )
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
      <CampaignModal visible={showCampaignModal} onClose={() => setShowCampaignModal(false)} colors={colors} />
    </ScreenContainer>
  );
}

// ── E-Mail-Kampagne light: Info-Mail an gefilterte Kundengruppe ──
function CampaignModal({ visible, onClose, colors }: { visible: boolean; onClose: () => void; colors: any }) {
  const [tag, setTag] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [resultMsg, setResultMsg] = useState("");

  const { data: allTags = [] } = useQuery({ queryKey: ["customerTags"], queryFn: Data.getAllCustomerTags, enabled: visible });
  const { data: recipients = [] } = useQuery({
    queryKey: ["campaignRecipients", tag],
    queryFn: () => Data.getCampaignRecipients({ tag: tag || undefined, status: "active" }),
    enabled: visible,
  });
  const { data: pastCampaigns = [] } = useQuery({ queryKey: ["campaigns"], queryFn: Data.getCampaigns, enabled: visible });

  const handleSend = () => {
    if (!subject.trim() || !body.trim() || recipients.length === 0) {
      showAlert("Fehler", "Bitte Betreff, Text und mindestens einen Empfänger.");
      return;
    }
    showConfirm(
      "Kampagne senden",
      `Diese Info-Mail wird an ${recipients.length} Kunden gesendet (mit Abmelde-Link). Fortfahren?`,
      async () => {
        setSending(true);
        setResultMsg("");
        try {
          const res = await Data.sendCampaign(
            subject.trim(),
            body.trim(),
            (recipients as any[]).map((c: any) => ({
              id: c.id,
              email: c.email,
              name: c.company_name || `${c.first_name || ""} ${c.last_name || ""}`.trim(),
            }))
          );
          setResultMsg(`Gesendet an ${res?.sent ?? 0} Empfänger${res?.failed?.length ? `, ${res.failed.length} fehlgeschlagen` : ""}.`);
          setSubject(""); setBody("");
        } catch (e: any) {
          showAlert("Fehler", e.message);
        } finally {
          setSending(false);
        }
      },
      "Senden"
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "90%" }}>
          <View className="flex-row items-center justify-between p-4 border-b border-border">
            <View className="flex-row items-center gap-2">
              <IconSymbol name="megaphone.fill" size={18} color="#8B5CF6" />
              <Text className="text-lg font-bold text-foreground">Info-Mail an Kunden</Text>
            </View>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <IconSymbol name="xmark.circle.fill" size={26} color={colors.muted} />
            </TouchableOpacity>
          </View>
          <ScrollView className="p-4" keyboardShouldPersistTaps="handled">
            {(allTags as string[]).length > 0 ? (
              <>
                <Text className="text-xs font-semibold text-muted mb-1.5">Empfänger eingrenzen (Tag)</Text>
                <View className="flex-row flex-wrap gap-2 mb-3">
                  <TouchableOpacity
                    onPress={() => setTag(null)}
                    className="px-3 py-1.5 rounded-full border"
                    style={{ backgroundColor: !tag ? "#8B5CF6" : colors.surface, borderColor: !tag ? "#8B5CF6" : colors.border }}
                  >
                    <Text style={{ color: !tag ? "#fff" : colors.foreground, fontSize: 12, fontWeight: "600" }}>Alle aktiven</Text>
                  </TouchableOpacity>
                  {(allTags as string[]).map((t) => (
                    <TouchableOpacity
                      key={t}
                      onPress={() => setTag(tag === t ? null : t)}
                      className="px-3 py-1.5 rounded-full border"
                      style={{ backgroundColor: tag === t ? "#8B5CF6" : colors.surface, borderColor: tag === t ? "#8B5CF6" : colors.border }}
                    >
                      <Text style={{ color: tag === t ? "#fff" : colors.foreground, fontSize: 12, fontWeight: "600" }}>#{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : null}

            <Text className="text-sm font-semibold mb-3" style={{ color: colors.primary }}>
              {recipients.length} Empfänger (aktive Kunden mit E-Mail, ohne Abgemeldete)
            </Text>

            <Text className="text-xs font-semibold text-muted mb-1.5">Betreff</Text>
            <TextInput
              value={subject} onChangeText={setSubject}
              placeholder="z.B. Wartungsfenster am Samstag" placeholderTextColor={colors.muted}
              className="bg-surface border border-border rounded-lg px-3 py-2.5 text-foreground mb-3"
            />
            <Text className="text-xs font-semibold text-muted mb-1.5">Nachricht</Text>
            <TextInput
              value={body} onChangeText={setBody} multiline
              placeholder="Ihre Nachricht an die Kunden..." placeholderTextColor={colors.muted}
              className="bg-surface border border-border rounded-lg px-3 py-2.5 text-foreground mb-3"
              style={{ minHeight: 120, textAlignVertical: "top" }}
            />
            <TouchableOpacity
              className="py-3 rounded-xl items-center mb-2"
              style={{ backgroundColor: "#8B5CF6", opacity: sending || !subject.trim() || !body.trim() || recipients.length === 0 ? 0.5 : 1 }}
              onPress={handleSend}
              disabled={sending || !subject.trim() || !body.trim() || recipients.length === 0}
              activeOpacity={0.8}
            >
              {sending ? <ActivityIndicator size="small" color="#FFF" /> : (
                <Text className="font-bold" style={{ color: "#FFF" }}>An {recipients.length} Kunden senden</Text>
              )}
            </TouchableOpacity>
            {sending ? (
              <Text className="text-xs text-muted text-center mb-2">Versand läuft – bei vielen Empfängern kann das eine Weile dauern...</Text>
            ) : null}
            {resultMsg ? (
              <Text className="text-sm font-semibold text-center mb-2" style={{ color: colors.success }}>{resultMsg}</Text>
            ) : null}

            {(pastCampaigns as any[]).length > 0 ? (
              <>
                <Text className="text-xs font-semibold text-muted mt-3 mb-1.5">Bisherige Kampagnen</Text>
                {(pastCampaigns as any[]).map((c: any) => (
                  <View key={c.id} className="bg-surface border border-border rounded-lg px-3 py-2 mb-1.5">
                    <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>{c.subject}</Text>
                    <Text className="text-xs text-muted">
                      {new Date(c.created_at).toLocaleDateString("de-CH")} · {c.recipient_count} Empfänger
                    </Text>
                  </View>
                ))}
              </>
            ) : null}
            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}


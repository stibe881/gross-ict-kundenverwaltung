import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { sendTicketNotification } from "@/lib/push-notifications";
import { ContractFormModal } from "@/components/contract-form-modal";

interface TicketFormModalProps {
  visible: boolean;
  ticket?: any;
  onClose: () => void;
  onSuccess?: (newTicket?: any) => void;
}

export function TicketFormModal({
  visible,
  ticket,
  onClose,
  onSuccess,
}: TicketFormModalProps) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    title: ticket?.title || "",
    description: ticket?.description || "",
    priority: ticket?.priority || "medium",
    customerId: ticket?.customer_id || ticket?.customerId || null,
  });
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<any[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedContract, setSelectedContract] = useState<any>(null);

  const { data: customerContracts = [], isLoading: isLoadingContracts } = useQuery({
    queryKey: ["customerContracts", formData.customerId],
    queryFn: () => Data.getCustomerContracts(formData.customerId as string),
    enabled: !!formData.customerId,
  });

  // Tickets Anhänge laden
  const { data: existingAttachments = [], refetch: refetchAttachments } = useQuery({
    queryKey: ["ticketAttachments", ticket?.id],
    queryFn: () => Data.getTicketAttachments(ticket.id),
    enabled: !!ticket?.id,
  });

  // Global Drag & Drop Handler (Web only)
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;

    const handleDragOver = (e: any) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(true);
    };

    const handleDragLeave = (e: any) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);
    };

    const handleDrop = (e: any) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const newFiles = Array.from(files).map((file: any) => ({
          uri: URL.createObjectURL(file),
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          file: file,
        }));
        setPendingFiles((prev) => [...prev, ...newFiles]);
      }
    };

    window.addEventListener('dragenter', handleDragOver);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragOver);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [visible]);

  // Handler für Kamera (nur Mobile sinnvoll, aber geht per Web-Fallback)
  const handleTakePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        setPendingFiles((prev) => [...prev, {
          uri: asset.uri,
          name: asset.fileName || `Foto_${Date.now()}.jpg`,
          type: asset.mimeType || "image/jpeg",
          size: asset.fileSize,
        }]);
      }
    } catch (_e) {
      Alert.alert("Fehler", "Kamera konnte nicht gestartet werden.");
    }
  };

  // Handler für Datei-Explorer
  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        setPendingFiles((prev) => [...prev, {
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || "application/octet-stream",
          size: asset.size,
          file: asset.file, // For web native File object
        }]);
      }
    } catch (_e) {
      // Ignored
    }
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingAttachment = async (attachment: any) => {
    try {
      await Data.deleteTicketAttachment(attachment.id, attachment.file_path);
      refetchAttachments();
    } catch (e: any) {
      Alert.alert("Fehler", "Konnte den Anhang nicht löschen: " + e.message);
    }
  };

  // Kunden laden
  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: Data.getCustomersWithCounts,
  });

  const selectedCustomer = customers?.find((c: any) => c.id === formData.customerId);

  const getCustomerName = (c: any) => c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email || 'Unbekannt';

  const handleSubmit = async () => {
    if (!formData.title || !formData.description) {
      alert("Bitte füllen Sie Titel und Beschreibung aus");
      return;
    }

    setIsUploading(true);
    try {
      const ticketData = {
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        customer_id: formData.customerId || undefined,
        status: "open",
      };

      let newTicket = null;
      if (ticket?.id) {
        await Data.updateTicket(ticket.id, ticketData);
      } else {
        newTicket = await Data.createTicket(ticketData);
      }

      // Upload pending files
      const finalTicketId = ticket?.id || newTicket?.id;
      if (finalTicketId && pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          await Data.uploadTicketAttachment(finalTicketId, file);
        }
        setPendingFiles([]);
      }

      // Invalidate queries to refresh
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["ticketAttachments", finalTicketId] });

      // Sende Push-Benachrichtigung für neues Ticket
      if (!ticket && selectedCustomer) {
        sendTicketNotification(
          formData.title,
          getCustomerName(selectedCustomer)
        ).catch(console.error);
      }

      onSuccess?.(newTicket);
      onClose();
    } catch (error: any) {
      Alert.alert("Fehler", error.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 bg-black/50 justify-end">
        <View
          className="bg-background rounded-t-3xl"
          style={{ maxHeight: "90%" }}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between p-4 border-b border-border">
            <Text className="text-2xl font-bold text-foreground">
              {ticket ? "Ticket bearbeiten" : "Neues Ticket"}
            </Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Form */}
          <ScrollView className="p-4" showsVerticalScrollIndicator={false}>
            <View className="gap-4">
              {/* Titel */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Titel *
                </Text>
                <TextInput
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="z.B. Problem mit Login"
                  placeholderTextColor={colors.muted}
                  value={formData.title}
                  onChangeText={(text) =>
                    setFormData({ ...formData, title: text })
                  }
                />
              </View>

              {/* Beschreibung */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Beschreibung *
                </Text>
                <TextInput
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="Detaillierte Beschreibung des Problems"
                  placeholderTextColor={colors.muted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  value={formData.description}
                  onChangeText={(text) =>
                    setFormData({ ...formData, description: text })
                  }
                />
              </View>

              {/* Priorität */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Priorität
                </Text>
                <TouchableOpacity
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: 1, borderColor: colors.border,
                    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
                    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                  }}
                  onPress={() => setShowPriorityPicker(!showPriorityPicker)}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{
                      width: 10, height: 10, borderRadius: 5,
                      backgroundColor: formData.priority === "low" ? colors.success : formData.priority === "high" ? colors.error : colors.warning,
                    }} />
                    <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>
                      {formData.priority === "low" ? "Niedrig" : formData.priority === "high" ? "Hoch" : "Mittel"}
                    </Text>
                  </View>
                  <IconSymbol name="chevron.down" size={14} color={colors.muted} />
                </TouchableOpacity>
                {showPriorityPicker && (
                  <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, marginTop: 4, overflow: "hidden" }}>
                    {[
                      { label: "Niedrig", value: "low", color: colors.success },
                      { label: "Mittel", value: "medium", color: colors.warning },
                      { label: "Hoch", value: "high", color: colors.error },
                    ].map((priority) => (
                      <TouchableOpacity
                        key={priority.value}
                        style={{
                          paddingHorizontal: 14, paddingVertical: 12,
                          borderBottomWidth: 1, borderBottomColor: colors.border,
                          flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                          backgroundColor: formData.priority === priority.value ? priority.color + "10" : "transparent",
                        }}
                        onPress={() => {
                          setFormData({ ...formData, priority: priority.value });
                          setShowPriorityPicker(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: priority.color }} />
                          <Text style={{ fontSize: 14, color: colors.foreground, fontWeight: formData.priority === priority.value ? "700" : "400" }}>
                            {priority.label}
                          </Text>
                        </View>
                        {formData.priority === priority.value && (
                          <IconSymbol name="checkmark" size={14} color={priority.color} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Kunde auswählen - Autocomplete */}
              <View style={{ zIndex: 10 }}>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Kunde (optional)
                </Text>
                <View
                  className="flex-row items-center rounded-lg border"
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: formData.customerId ? colors.primary : colors.border,
                  }}
                >
                  <IconSymbol name="magnifyingglass" size={16} color={colors.muted} style={{ marginLeft: 12 }} />
                  <TextInput
                    value={customerSearch}
                    onChangeText={(text) => {
                      setCustomerSearch(text);
                      setShowCustomerPicker(true);
                      if (!text.trim()) setFormData({ ...formData, customerId: null });
                    }}
                    onFocus={() => setShowCustomerPicker(true)}
                    placeholder="Kunde suchen..."
                    placeholderTextColor={colors.muted}
                    style={{ flex: 1, color: colors.foreground, paddingVertical: 12, paddingHorizontal: 8, fontSize: 14 }}
                  />
                  {formData.customerId ? (
                    <TouchableOpacity
                      onPress={() => { setFormData({ ...formData, customerId: null }); setCustomerSearch(""); setShowCustomerPicker(true); }}
                      style={{ paddingRight: 12 }}
                    >
                      <IconSymbol name="xmark.circle.fill" size={18} color={colors.muted} />
                    </TouchableOpacity>
                  ) : null}
                </View>
                {showCustomerPicker && !formData.customerId && (() => {
                  const filtered = (customers || []).filter((c: any) => {
                    if (!customerSearch.trim()) return true;
                    const term = customerSearch.toLowerCase();
                    return getCustomerName(c).toLowerCase().includes(term) || (c.email || "").toLowerCase().includes(term);
                  });
                  return (
                    <View className="rounded-lg border mt-1" style={{ backgroundColor: colors.surface, borderColor: colors.border, maxHeight: 180 }}>
                      <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
                        <TouchableOpacity
                          className="px-3 py-2.5 border-b"
                          style={{ borderColor: colors.border + '40' }}
                          activeOpacity={0.6}
                          onPress={() => { setFormData({ ...formData, customerId: null }); setCustomerSearch(""); setShowCustomerPicker(false); }}
                        >
                          <Text className="text-sm" style={{ color: colors.muted }}>Kein Kunde</Text>
                        </TouchableOpacity>
                        {filtered.slice(0, 20).map((c: any) => (
                          <TouchableOpacity
                            key={c.id}
                            className="px-3 py-2.5 border-b"
                            style={{ borderColor: colors.border + '40' }}
                            activeOpacity={0.6}
                            onPress={() => { setFormData({ ...formData, customerId: c.id }); setCustomerSearch(getCustomerName(c)); setShowCustomerPicker(false); }}
                          >
                            <Text className="text-sm font-semibold" style={{ color: colors.foreground }} numberOfLines={1}>{getCustomerName(c)}</Text>
                            {c.email && <Text className="text-xs" style={{ color: colors.muted }} numberOfLines={1}>{c.email}</Text>}
                          </TouchableOpacity>
                        ))}
                        {filtered.length === 0 && (
                          <View className="px-3 py-3"><Text className="text-sm text-muted text-center">Kein Kunde gefunden</Text></View>
                        )}
                      </ScrollView>
                    </View>
                  );
                })()}
                {selectedCustomer && (
                  <View className="flex-row items-center gap-2 mt-2 px-3 py-2 rounded-lg" style={{ backgroundColor: colors.primary + '15' }}>
                    <IconSymbol name="checkmark" size={14} color={colors.primary} />
                    <Text className="text-sm font-semibold" style={{ color: colors.primary }}>{getCustomerName(selectedCustomer)}</Text>
                  </View>
                )}

                {/* Verträge anzeigen */}
                {formData.customerId && (
                  <View style={{ marginTop: 12 }}>
                    <Text className="text-xs font-semibold text-muted mb-2 uppercase tracking-wider">
                      Vorhandene Verträge
                    </Text>
                    {isLoadingContracts ? (
                      <ActivityIndicator size="small" color={colors.primary} style={{ alignSelf: 'flex-start', marginVertical: 8 }} />
                    ) : customerContracts.length > 0 ? (
                      <View style={{ gap: 8 }}>
                        {customerContracts.map((contract: any) => (
                          <TouchableOpacity
                            key={contract.id}
                            style={{
                              backgroundColor: colors.surface,
                              borderWidth: 1,
                              borderColor: colors.border,
                              borderRadius: 8,
                              padding: 12,
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between"
                            }}
                            onPress={() => setSelectedContract(contract)}
                            activeOpacity={0.7}
                          >
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                              <IconSymbol name="doc.text.fill" size={16} color={colors.primary} />
                              <View>
                                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }}>
                                  {contract.title}
                                </Text>
                                <Text style={{ fontSize: 11, color: colors.muted }}>
                                  {contract.status === "active" ? "Aktiv" : contract.status === "expired" ? "Abgelaufen" : "Gekündigt"}
                                </Text>
                              </View>
                            </View>
                            <IconSymbol name="chevron.right" size={14} color={colors.muted} />
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : (
                      <Text style={{ fontSize: 13, color: colors.muted, fontStyle: 'italic' }}>
                        Keine Verträge für diesen Kunden gefunden.
                      </Text>
                    )}
                  </View>
                )}
              </View>

              {/* Dateianhänge */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Dateianhänge
                </Text>
                <View className={`border-2 rounded-lg p-4 ${isDragActive ? "border-primary bg-primary/10 border-dashed" : "border-border bg-surface"}`}>
                  <View className="flex-row gap-3 mb-4">
                    {Platform.OS !== 'web' && (
                      <TouchableOpacity
                        className="flex-1 bg-secondary rounded-lg flex-row items-center justify-center py-3 gap-2"
                        onPress={handleTakePhoto}
                      >
                        <IconSymbol name="camera" size={20} color={colors.primary} />
                        <Text className="text-primary font-medium">Foto</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      className="flex-1 bg-secondary rounded-lg flex-row items-center justify-center py-3 gap-2"
                      onPress={handlePickFile}
                    >
                      <IconSymbol name="doc" size={20} color={colors.primary} />
                      <Text className="text-primary font-medium">Datei</Text>
                    </TouchableOpacity>
                  </View>
                  {Platform.OS === 'web' && (
                    <Text className="text-center text-muted mb-4">
                      Oder Dateien per Drag & Drop hier ablegen
                    </Text>
                  )}

                  {/* Bereit zum Hochladen */}
                  {pendingFiles.length > 0 && (
                    <View className="mb-3 gap-2">
                      <Text className="text-xs font-semibold text-muted uppercase">Wird hochgeladen</Text>
                      {pendingFiles.map((file, index) => (
                        <View key={index} className="flex-row items-center bg-background rounded p-2 border border-border border-dashed">
                          <IconSymbol name="arrow.up.doc.fill" size={16} color={colors.primary} />
                          <Text className="flex-1 text-sm text-foreground ml-2" numberOfLines={1}>{file.name}</Text>
                          <TouchableOpacity onPress={() => removePendingFile(index)} className="p-1">
                            <IconSymbol name="xmark" size={16} color={colors.error} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Gespeicherte Dateien */}
                  {existingAttachments.length > 0 && (
                    <View className="gap-2">
                      <Text className="text-xs font-semibold text-muted uppercase">Gespeichert</Text>
                      {existingAttachments.map((file: any) => (
                        <View key={file.id} className="flex-row items-center bg-background rounded p-2 border border-border">
                          <IconSymbol name="doc.fill" size={16} color={colors.muted} />
                          <Text className="flex-1 text-sm text-foreground ml-2" numberOfLines={1}>{file.file_name}</Text>
                          <TouchableOpacity onPress={() => removeExistingAttachment(file)} className="p-1">
                            <IconSymbol name="trash" size={16} color={colors.error} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Footer Buttons */}
          <View className="p-4 border-t border-border flex-row gap-3">
            <TouchableOpacity
              className="flex-1 bg-surface border border-border py-3 rounded-lg"
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text className="text-foreground font-semibold text-center">
                Abbrechen
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 bg-primary py-3 rounded-lg flex-row justify-center items-center gap-2"
              onPress={handleSubmit}
              activeOpacity={0.8}
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text className="text-background font-semibold text-center">Lädt...</Text>
                </>
              ) : (
                <Text className="text-background font-semibold text-center">
                  {ticket ? "Aktualisieren" : "Erstellen"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Contract Modal */}
      {selectedContract && (
        <ContractFormModal
          visible={!!selectedContract}
          contract={selectedContract}
          onClose={() => setSelectedContract(null)}
        />
      )}
    </Modal>
  );
}

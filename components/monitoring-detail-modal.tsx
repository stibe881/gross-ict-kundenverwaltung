import { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useQuery } from "@tanstack/react-query";
import * as Data from "@/lib/data";

interface MonitoringDetailModalProps {
  visible: boolean;
  onClose: () => void;
  urlEntry: any;
}

function StatusBadge({ status }: { status: "up" | "down" | "unknown" }) {
  const colors = useColors();
  const config = {
    up: { label: "Online", bg: "#16A34A18", text: "#16A34A", dot: "#16A34A" },
    down: { label: "Offline", bg: "#DC262618", text: "#DC2626", dot: "#DC2626" },
    unknown: { label: "Unbekannt", bg: colors.surface, text: colors.muted, dot: colors.muted },
  }[status];

  return (
    <View style={{
      flexDirection: "row", alignItems: "center", gap: 6,
      backgroundColor: config.bg, borderRadius: 20,
      paddingHorizontal: 10, paddingVertical: 5,
    }}>
      <View style={{
        width: 7, height: 7, borderRadius: 4,
        backgroundColor: config.dot,
        ...(status === "up" ? {
          shadowColor: config.dot,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 3,
        } : {}),
      }} />
      <Text style={{ fontSize: 12, fontWeight: "600", color: config.text }}>{config.label}</Text>
    </View>
  );
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return "Gerade eben";
  if (diffMins < 60) return `Vor ${diffMins} Minuten`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Vor ${diffHours} Stunden`;
  
  return date.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function MonitoringDetailModal({ visible, onClose, urlEntry }: MonitoringDetailModalProps) {
  const colors = useColors();

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["monitoringLogs", urlEntry?.id],
    queryFn: () => Data.getMonitoringLogs(urlEntry.id),
    enabled: visible && !!urlEntry?.id,
  });

  if (!urlEntry) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1, justifyContent: "flex-end" }}
      >
        <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "90%", minHeight: "50%" }}>
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: "bold", color: colors.foreground, marginBottom: 4 }} numberOfLines={1}>
                {urlEntry.name}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <StatusBadge status={urlEntry.last_status || "unknown"} />
                <Text style={{ fontSize: 13, color: colors.primary }} numberOfLines={1}>{urlEntry.url}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={{ padding: 4 }}>
              <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Details & Verlauf */}
          <ScrollView style={{ padding: 20 }}>
            {/* Details Section */}
            <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground, marginBottom: 12 }}>
              Details
            </Text>
            <View style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 16,
                marginBottom: 24,
                gap: 12
            }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <Text style={{ fontSize: 13, color: colors.muted, width: "40%" }}>Status Überwachung</Text>
                    <Text style={{ fontSize: 13, fontWeight: "500", color: urlEntry.is_active ? "#16A34A" : colors.muted, flex: 1, textAlign: "right" }}>
                        {urlEntry.is_active ? "Aktiv" : "Pausiert"}
                    </Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <Text style={{ fontSize: 13, color: colors.muted, width: "40%" }}>Letzte Prüfung</Text>
                    <Text style={{ fontSize: 13, fontWeight: "500", color: colors.foreground, flex: 1, textAlign: "right" }}>
                        {urlEntry.last_checked_at ? new Date(urlEntry.last_checked_at).toLocaleString('de-CH') : "Noch nicht geprüft"}
                    </Text>
                </View>
                {urlEntry.last_response_time != null && (
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <Text style={{ fontSize: 13, color: colors.muted, width: "40%" }}>Antwortzeit</Text>
                        <Text style={{ fontSize: 13, fontWeight: "500", color: colors.foreground, flex: 1, textAlign: "right" }}>
                            {urlEntry.last_response_time} ms
                        </Text>
                    </View>
                )}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <Text style={{ fontSize: 13, color: colors.muted, width: "40%" }}>SSL-Zertifikat</Text>
                    <Text style={{ fontSize: 13, fontWeight: "500", color: urlEntry.ssl_valid == null ? colors.muted : (urlEntry.ssl_valid ? "#16A34A" : colors.error), flex: 1, textAlign: "right" }}>
                        {urlEntry.ssl_valid == null ? "Wird bei nächster Prüfung ermittelt" : (urlEntry.ssl_valid ? "Gültig" : "Fehlerhaft")}
                    </Text>
                </View>
                {urlEntry.ssl_expiry && (
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <Text style={{ fontSize: 13, color: colors.muted, width: "40%" }}>SSL läuft ab am</Text>
                        <Text style={{ fontSize: 13, fontWeight: "500", color: colors.foreground, flex: 1, textAlign: "right" }}>
                            {new Date(urlEntry.ssl_expiry).toLocaleDateString('de-CH')}
                        </Text>
                    </View>
                )}
                {urlEntry.ssl_issuer && (
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <Text style={{ fontSize: 13, color: colors.muted, width: "40%" }}>SSL Aussteller</Text>
                        <Text style={{ fontSize: 13, fontWeight: "500", color: colors.foreground, flex: 1, textAlign: "right" }}>
                            {urlEntry.ssl_issuer}
                        </Text>
                    </View>
                )}
                {urlEntry.notes && (
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                        <Text style={{ fontSize: 13, color: colors.muted, width: "30%" }}>Notizen</Text>
                        <Text style={{ fontSize: 13, color: colors.foreground, flex: 1, textAlign: "right" }}>
                            {urlEntry.notes}
                        </Text>
                    </View>
                )}
            </View>

            <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground, marginBottom: 16 }}>
              Verlauf der Überprüfungen
            </Text>

            {isLoading ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 20 }} />
            ) : logs.length === 0 ? (
              <Text style={{ color: colors.muted, textAlign: "center", marginTop: 20 }}>Noch keine Einträge vorhanden.</Text>
            ) : (
              <View style={{ gap: 12, paddingBottom: 40 }}>
                {logs.map((log: any) => (
                  <View key={log.id} style={{ 
                    flexDirection: "row", 
                    alignItems: "center", 
                    justifyContent: "space-between",
                    backgroundColor: colors.surface,
                    padding: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border
                  }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <View style={{ 
                        width: 36, height: 36, borderRadius: 18, 
                        backgroundColor: log.status === 'up' ? '#16A34A15' : '#DC262615',
                        alignItems: "center", justifyContent: "center"
                      }}>
                        <IconSymbol 
                          name={log.status === 'up' ? 'checkmark' : 'xmark'} 
                          size={16} 
                          color={log.status === 'up' ? '#16A34A' : '#DC2626'} 
                        />
                      </View>
                      <View>
                        <Text style={{ fontSize: 14, fontWeight: "500", color: colors.foreground }}>
                          {log.status === 'up' ? 'Erreichbar' : 'Fehlgeschlagen'}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.muted }}>
                          {formatRelativeTime(log.checked_at)}
                        </Text>
                      </View>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      {log.status_code != null && (
                        <Text style={{ fontSize: 13, fontWeight: "500", color: log.status === 'up' ? colors.foreground : '#DC2626' }}>
                          HTTP {log.status_code}
                        </Text>
                      )}
                      {log.response_time != null && (
                        <Text style={{ fontSize: 12, color: colors.muted }}>
                          {log.response_time} ms
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { showAlert } from "@/lib/alert";

interface MonitoringDetailModalProps {
  visible: boolean;
  onClose: () => void;
  urlEntry: any;
  onEdit?: (entry: any) => void;
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
  const absoluteTime = date.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
  const absoluteDate = date.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return `Gerade eben (${absoluteTime})`;
  if (diffMins < 60) return `Vor ${diffMins} Minuten (${absoluteTime})`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Vor ${diffHours} Stunden (${absoluteTime})`;
  
  return `${absoluteDate}, ${absoluteTime}`;
}

export function MonitoringDetailModal({ visible, onClose, urlEntry }: MonitoringDetailModalProps) {
  const colors = useColors();

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["monitoringLogs", urlEntry?.id],
    queryFn: () => Data.getMonitoringLogs(urlEntry.id),
    enabled: visible && !!urlEntry?.id,
  });

  const queryClient = useQueryClient();
  const [isMuting, setIsMuting] = useState(false);

  const handleMute = async (hours: number | null) => {
      setIsMuting(true);
      try {
          let muted_until: string | null = null;
          if (hours) {
              const date = new Date();
              date.setHours(date.getHours() + hours);
              muted_until = date.toISOString();
          }
          await Data.updateMonitoringUrl(urlEntry.id, { muted_until });
          queryClient.invalidateQueries({ queryKey: ["monitoringUrls"] });
          showAlert("Erfolg", hours ? `Alarme für ${hours} Stunden pausiert.` : "Wartungsmodus beendet.");
          onClose();
      } catch (e: any) {
          showAlert("Fehler", e.message);
      } finally {
          setIsMuting(false);
      }
  };

  const uptimePercentage = logs.length > 0 
    ? ((logs.filter((l: any) => l.status === 'up').length / logs.length) * 100).toFixed(1)
    : null;

  const validLogs = [...logs].filter((l: any) => l.response_time != null).reverse();
  const maxResponseTime = validLogs.length > 0 ? Math.max(100, ...validLogs.map((l: any) => l.response_time)) : 100;

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
                {urlEntry.last_status === 'down' && urlEntry.last_error && (
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                        <Text style={{ fontSize: 13, color: colors.error, width: "30%" }}>Fehlermeldung</Text>
                        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.error, flex: 1, textAlign: "right" }}>
                            {urlEntry.last_error}
                        </Text>
                    </View>
                )}
                {urlEntry.last_status === 'down' && urlEntry.down_since && (
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 4 }}>
                        <Text style={{ fontSize: 13, color: colors.muted, width: "40%" }}>Offline seit</Text>
                        <Text style={{ fontSize: 13, fontWeight: "500", color: colors.error, flex: 1, textAlign: "right" }}>
                            {new Date(urlEntry.down_since).toLocaleString('de-CH')}
                            {urlEntry.escalation_level > 0 && ` (Eskalation Stufe ${urlEntry.escalation_level})`}
                        </Text>
                    </View>
                )}
                {uptimePercentage != null && (
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <Text style={{ fontSize: 13, color: colors.muted, width: "40%" }}>Uptime (Letzte 365 Tage)</Text>
                        <Text style={{ fontSize: 13, fontWeight: "500", color: parseFloat(uptimePercentage) > 99 ? "#16A34A" : (parseFloat(uptimePercentage) > 95 ? "#F59E0B" : colors.error), flex: 1, textAlign: "right" }}>
                            {uptimePercentage}%
                        </Text>
                    </View>
                )}
                {urlEntry.domain_expiry && (
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                        <Text style={{ fontSize: 13, color: colors.muted, width: "40%" }}>Domain Ablaufdatum</Text>
                        <Text style={{ fontSize: 13, fontWeight: "500", color: (() => {
                            const daysLeft = (new Date(urlEntry.domain_expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
                            if (daysLeft < 14) return colors.error;
                            if (daysLeft < 30) return "#F59E0B";
                            return colors.foreground;
                        })(), flex: 1, textAlign: "right" }}>
                            {new Date(urlEntry.domain_expiry).toLocaleDateString('de-CH')}
                        </Text>
                    </View>
                )}
                {(() => {
                    let sslColor = urlEntry.ssl_valid == null ? colors.muted : (urlEntry.ssl_valid ? "#16A34A" : colors.error);
                    let sslText = urlEntry.ssl_valid == null ? "Wird durch automatischen Hintergrund-Check ermittelt" : (urlEntry.ssl_valid ? "Gültig" : "Fehlerhaft");
                    
                    if (urlEntry.ssl_valid && urlEntry.ssl_expiry) {
                        const daysLeft = (new Date(urlEntry.ssl_expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
                        if (daysLeft < 14 && daysLeft > 0) {
                            sslColor = "#F59E0B"; // Orange
                            sslText = "Läuft bald ab";
                        } else if (daysLeft <= 0) {
                            sslColor = colors.error;
                            sslText = "Abgelaufen";
                        }
                    }

                    return (
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <Text style={{ fontSize: 13, color: colors.muted, width: "40%" }}>SSL-Zertifikat</Text>
                            <Text style={{ fontSize: 13, fontWeight: "500", color: sslColor, flex: 1, textAlign: "right" }}>
                                {sslText}
                            </Text>
                        </View>
                    );
                })()}
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
                {urlEntry.server_info && (
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                        <Text style={{ fontSize: 13, color: colors.muted, width: "30%" }}>Server Info</Text>
                        <Text style={{ fontSize: 13, color: colors.foreground, flex: 1, textAlign: "right" }}>
                            {urlEntry.server_info}
                        </Text>
                    </View>
                )}
                {urlEntry.security_warnings && urlEntry.security_warnings.length > 0 && (
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 4 }}>
                        <Text style={{ fontSize: 13, color: colors.muted, width: "30%" }}>Sicherheits-Warnungen</Text>
                        <View style={{ flex: 1, alignItems: "flex-end" }}>
                            {urlEntry.security_warnings.map((w: string, i: number) => (
                                <Text key={i} style={{ fontSize: 13, color: colors.error, fontWeight: "500", textAlign: "right", marginBottom: 2 }}>
                                    ⚠️ {w}
                                </Text>
                            ))}
                        </View>
                    </View>
                )}
                {urlEntry.dns_a_records && urlEntry.dns_a_records.length > 0 && (
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 4 }}>
                        <Text style={{ fontSize: 13, color: colors.muted, width: "30%" }}>IP-Adressen (A)</Text>
                        <Text style={{ fontSize: 13, color: colors.foreground, flex: 1, textAlign: "right" }}>
                            {urlEntry.dns_a_records.join(", ")}
                        </Text>
                    </View>
                )}
                {urlEntry.dns_mx_records && urlEntry.dns_mx_records.length > 0 && (
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 4 }}>
                        <Text style={{ fontSize: 13, color: colors.muted, width: "30%" }}>Mailserver (MX)</Text>
                        <Text style={{ fontSize: 13, color: colors.foreground, flex: 1, textAlign: "right" }}>
                            {urlEntry.dns_mx_records.join(", ")}
                        </Text>
                    </View>
                )}
                {urlEntry.dns_warnings && urlEntry.dns_warnings.length > 0 && (
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 4 }}>
                        <Text style={{ fontSize: 13, color: colors.muted, width: "30%" }}>DNS Warnungen</Text>
                        <View style={{ flex: 1, alignItems: "flex-end" }}>
                            {urlEntry.dns_warnings.map((w: string, i: number) => (
                                <Text key={i} style={{ fontSize: 13, color: "#F59E0B", fontWeight: "500", textAlign: "right", marginBottom: 2 }}>
                                    ⚠️ {w}
                                </Text>
                            ))}
                        </View>
                    </View>
                )}
                {urlEntry.blacklist_status && urlEntry.blacklist_status.length > 0 && (
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 4 }}>
                        <Text style={{ fontSize: 13, color: colors.muted, width: "30%" }}>Blacklists</Text>
                        <View style={{ flex: 1, alignItems: "flex-end" }}>
                            {urlEntry.blacklist_status.map((b: any, i: number) => (
                                <Text key={i} style={{ fontSize: 13, color: colors.error, fontWeight: "500", textAlign: "right", marginBottom: 2 }}>
                                    ⚠️ {b.ip} auf {b.type} ({b.result})
                                </Text>
                            ))}
                        </View>
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

            {/* Wartungsmodus */}
            <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground, marginBottom: 12 }}>
              Wartungsmodus (Benachrichtigungen pausieren)
            </Text>
            <View style={{ marginBottom: 24, gap: 10 }}>
                {urlEntry.muted_until && new Date(urlEntry.muted_until).getTime() > Date.now() ? (
                    <View style={{ backgroundColor: "#F59E0B15", padding: 16, borderRadius: 12, borderWidth: 1, borderColor: "#F59E0B40" }}>
                        <Text style={{ color: "#F59E0B", fontWeight: "600", marginBottom: 8 }}>
                            Wartungsmodus aktiv bis {new Date(urlEntry.muted_until).toLocaleString('de-CH')}
                        </Text>
                        <TouchableOpacity onPress={() => handleMute(null)} disabled={isMuting} style={{ backgroundColor: colors.background, padding: 10, borderRadius: 8, alignItems: "center" }}>
                            <Text style={{ color: colors.foreground, fontWeight: "500" }}>Wartung beenden</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={{ flexDirection: "row", gap: 10 }}>
                        <TouchableOpacity onPress={() => handleMute(2)} disabled={isMuting} style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 12, borderRadius: 10, alignItems: "center" }}>
                            <Text style={{ color: colors.foreground, fontWeight: "500" }}>2 Stunden</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleMute(24)} disabled={isMuting} style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 12, borderRadius: 10, alignItems: "center" }}>
                            <Text style={{ color: colors.foreground, fontWeight: "500" }}>24 Stunden</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Chart */}
            <View style={{ marginBottom: 24, backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground }}>Antwortzeiten (letzte Checks)</Text>
                    {validLogs.length > 0 && (
                        <Text style={{ fontSize: 12, color: colors.muted }}>Max: {Math.round(maxResponseTime)} ms</Text>
                    )}
                </View>
                <View style={{ height: 120, flexDirection: "row", alignItems: "flex-end", gap: 6 }}>
                    {validLogs.length > 0 ? validLogs.map((l: any, i: number) => {
                        const heightPercent = Math.max(4, (l.response_time / maxResponseTime) * 100);
                        const isError = l.status === 'down';
                        const isSlow = l.response_time > 1000 && !isError;
                        const barColor = isError ? colors.error : isSlow ? "#F59E0B" : colors.primary;
                        const isLatest = i === validLogs.length - 1;
                        return (
                            <View key={i} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                                <View style={{ 
                                    width: "100%", 
                                    height: `${heightPercent}%`, 
                                    backgroundColor: barColor, 
                                    opacity: isLatest ? 1 : 0.6, 
                                    borderTopLeftRadius: 4, 
                                    borderTopRightRadius: 4,
                                    borderBottomLeftRadius: 2,
                                    borderBottomRightRadius: 2
                                }} />
                            </View>
                        );
                    }) : (
                        <Text style={{ color: colors.muted, width: "100%", textAlign: "center", alignSelf: "center" }}>Keine Daten für Chart</Text>
                    )}
                </View>
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

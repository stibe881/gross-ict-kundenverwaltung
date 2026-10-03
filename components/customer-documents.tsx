import { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Linking } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import * as Data from "@/lib/data";
import { showAlert, showConfirm } from "@/lib/alert";
import { showToast } from "@/components/toast-provider";

function fileIcon(name: string): { icon: any; color: string } {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["pdf"].includes(ext)) return { icon: "doc.text.fill", color: "#EF4444" };
  if (["png", "jpg", "jpeg", "heic", "gif", "webp"].includes(ext)) return { icon: "photo.fill", color: "#0EA5E9" };
  if (["xls", "xlsx", "csv"].includes(ext)) return { icon: "chart.bar.fill", color: "#22C55E" };
  if (["doc", "docx", "txt"].includes(ext)) return { icon: "doc.text", color: "#3B82F6" };
  return { icon: "folder.fill", color: "#8B5CF6" };
}

function fmtSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Dateiname ohne Zeitstempel-Präfix anzeigen
function displayName(name: string): string {
  return name.replace(/^\d{13}_/, "");
}

export function CustomerDocuments({ customerId }: { customerId: string }) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const { data: files = [], isLoading } = useQuery({
    queryKey: ["customerDocuments", customerId],
    queryFn: () => Data.listCustomerDocuments(customerId),
    enabled: !!customerId,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["customerDocuments", customerId] });

  const handleUpload = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.length) return;
      setUploading(true);
      for (const asset of res.assets) {
        await Data.uploadCustomerDocument(customerId, asset.uri, asset.name || "Dokument");
      }
      refresh();
      showToast("Dokument hochgeladen");
    } catch (e: any) {
      showAlert("Fehler", "Upload fehlgeschlagen: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleOpen = async (name: string) => {
    try {
      const url = await Data.getCustomerDocumentUrl(customerId, name);
      await Linking.openURL(url);
    } catch (e: any) {
      showAlert("Fehler", e.message);
    }
  };

  const handleDelete = (name: string) => {
    showConfirm(
      "Dokument löschen",
      `"${displayName(name)}" wirklich löschen?`,
      async () => {
        try {
          await Data.deleteCustomerDocument(customerId, name);
          refresh();
          showToast("Dokument gelöscht");
        } catch (e: any) {
          showAlert("Fehler", e.message);
        }
      },
      "Löschen"
    );
  };

  return (
    <View className="gap-3">
      <TouchableOpacity
        className="flex-row items-center justify-center gap-2 bg-primary py-3 rounded-xl"
        onPress={handleUpload}
        disabled={uploading}
        activeOpacity={0.8}
      >
        {uploading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <IconSymbol name="square.and.arrow.up" size={16} color="#fff" />
        )}
        <Text className="text-background font-semibold">
          {uploading ? "Wird hochgeladen…" : "Dokument hochladen"}
        </Text>
      </TouchableOpacity>

      {isLoading ? (
        <View className="items-center py-8"><ActivityIndicator color={colors.primary} /></View>
      ) : files.length === 0 ? (
        <View className="items-center py-10">
          <IconSymbol name="folder" size={40} color={colors.muted} />
          <Text className="text-base font-semibold text-foreground mt-3">Keine Dokumente</Text>
          <Text className="text-sm text-muted mt-1 text-center">
            Lade Offerten, Fotos oder Konfigurationen für diesen Kunden hoch.
          </Text>
        </View>
      ) : (
        <View className="bg-surface rounded-xl border border-border overflow-hidden">
          {files.map((f: any, idx: number) => {
            const { icon, color } = fileIcon(f.name);
            return (
              <TouchableOpacity
                key={f.name}
                className="flex-row items-center px-3.5 py-3 gap-3"
                style={{ borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: colors.border }}
                activeOpacity={0.7}
                onPress={() => handleOpen(f.name)}
                onLongPress={() => handleDelete(f.name)}
              >
                <View
                  style={{
                    width: 36, height: 36, borderRadius: 10,
                    alignItems: "center", justifyContent: "center",
                    backgroundColor: color + "18",
                  }}
                >
                  <IconSymbol name={icon} size={17} color={color} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                    {displayName(f.name)}
                  </Text>
                  <Text className="text-[11px] text-muted">
                    {f.created_at ? new Date(f.created_at).toLocaleDateString("de-CH") : ""}
                    {f.metadata?.size ? ` · ${fmtSize(f.metadata.size)}` : ""}
                  </Text>
                </View>
                <IconSymbol name="chevron.right" size={13} color={colors.muted} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      {files.length > 0 && (
        <Text className="text-[10px] text-muted text-center">
          Tippen zum Öffnen · gedrückt halten zum Löschen
        </Text>
      )}
    </View>
  );
}

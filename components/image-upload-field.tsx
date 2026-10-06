import { useState } from "react";
import { ActivityIndicator, Image, Platform, Text, TouchableOpacity, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { showAlert } from "@/lib/alert";
import * as Data from "@/lib/data";

/**
 * Bild-Upload-Feld für Website-Inhalte (Partner-Logos, Referenz-Bilder):
 * Bild aus der Galerie wählen → Upload in den öffentlichen Storage-Bucket
 * "website-bilder" → die fertige URL landet via onChange im Formular.
 */
export function ImageUploadField({
  label,
  value,
  folder,
  onChange,
}: {
  label: string;
  value: string;
  folder: string;
  onChange: (url: string) => void;
}) {
  const colors = useColors();
  const [uploading, setUploading] = useState(false);

  const pick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.85,
        base64: Platform.OS === "web", // Web: base64 für zuverlässigen Upload
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const uri =
        Platform.OS === "web" && asset.base64
          ? `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}`
          : asset.uri;

      setUploading(true);
      const url = await Data.uploadWebsiteImage(folder, uri, asset.mimeType || undefined);
      onChange(url);
    } catch (e: any) {
      showAlert("Fehler", e?.message || "Bild konnte nicht hochgeladen werden.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted, marginBottom: 5 }}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        {value ? (
          <Image
            source={{ uri: value }}
            style={{ width: 54, height: 54, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background }}
            resizeMode="cover"
          />
        ) : (
          <View style={{ width: 54, height: 54, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
            <IconSymbol name="photo.fill" size={22} color={colors.muted} />
          </View>
        )}
        <TouchableOpacity
          onPress={pick}
          disabled={uploading}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 999,
            paddingHorizontal: 14,
            paddingVertical: 9,
            opacity: uploading ? 0.6 : 1,
          }}
        >
          {uploading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <IconSymbol name="square.and.arrow.up" size={15} color={colors.foreground} />
          )}
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>
            {uploading ? "Lädt hoch…" : value ? "Bild ersetzen" : "Bild wählen"}
          </Text>
        </TouchableOpacity>
        {!!value && !uploading && (
          <TouchableOpacity onPress={() => onChange("")} style={{ padding: 8 }}>
            <IconSymbol name="xmark.circle.fill" size={18} color={colors.muted} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

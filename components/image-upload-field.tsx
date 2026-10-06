import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Platform, Text, TouchableOpacity, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { showAlert } from "@/lib/alert";
import * as Data from "@/lib/data";

/**
 * Bild-Upload-Feld für Website-Inhalte (Partner-Logos, Referenz-Bilder):
 * Dropzone — klicken öffnet die Galerie, am Web-Browser kann man Bilder auch
 * direkt per Drag-and-drop hineinziehen. Upload in den öffentlichen
 * Storage-Bucket "website-bilder"; die fertige URL landet via onChange im
 * Formular.
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
  const [dragActive, setDragActive] = useState(false);
  const dropRef = useRef<View>(null);

  // Alte Einträge enthalten Website-Pfade wie /img/referenzen/kunde.webp —
  // für die Vorschau im CRM auf die Live-Domain auflösen.
  const previewUri = !value
    ? ""
    : value.startsWith("http") || value.startsWith("data:")
      ? value
      : `https://gross-ict.ch${value.startsWith("/") ? "" : "/"}${value}`;

  const upload = async (uri: string, mimeType?: string) => {
    try {
      setUploading(true);
      const url = await Data.uploadWebsiteImage(folder, uri, mimeType);
      onChange(url);
    } catch (e: any) {
      showAlert("Fehler", e?.message || "Bild konnte nicht hochgeladen werden.");
    } finally {
      setUploading(false);
    }
  };

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
      await upload(uri, asset.mimeType || undefined);
    } catch (e: any) {
      showAlert("Fehler", e?.message || "Bild konnte nicht geladen werden.");
    }
  };

  // Web: Drag-and-drop direkt auf die Dropzone (View ist dort ein DOM-Element)
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const node = dropRef.current as unknown as HTMLElement | null;
    if (!node || typeof node.addEventListener !== "function") return;

    const onDragOver = (e: DragEvent) => { e.preventDefault(); setDragActive(true); };
    const onDragLeave = () => setDragActive(false);
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        showAlert("Fehler", "Bitte eine Bilddatei hineinziehen (JPG, PNG, WebP …).");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => upload(String(reader.result), file.type);
      reader.onerror = () => showAlert("Fehler", "Bild konnte nicht gelesen werden.");
      reader.readAsDataURL(file);
    };

    node.addEventListener("dragover", onDragOver);
    node.addEventListener("dragleave", onDragLeave);
    node.addEventListener("drop", onDrop);
    return () => {
      node.removeEventListener("dragover", onDragOver);
      node.removeEventListener("dragleave", onDragLeave);
      node.removeEventListener("drop", onDrop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder]);

  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted, marginBottom: 5 }}>{label}</Text>
      <View ref={dropRef}>
        <TouchableOpacity
          onPress={pick}
          disabled={uploading}
          activeOpacity={0.75}
          style={{
            borderWidth: 1.5,
            borderStyle: "dashed",
            borderColor: dragActive ? colors.primary : colors.border,
            backgroundColor: dragActive ? colors.primary + "14" : colors.background,
            borderRadius: 14,
            paddingVertical: value ? 12 : 22,
            paddingHorizontal: 14,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: value ? "row" : "column",
            gap: value ? 14 : 8,
            opacity: uploading ? 0.65 : 1,
          }}
        >
          {uploading ? (
            <>
              <ActivityIndicator color={colors.primary} />
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted }}>Lädt hoch…</Text>
            </>
          ) : value ? (
            <>
              <Image
                source={{ uri: previewUri }}
                style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: "#FFF", borderWidth: 1, borderColor: colors.border }}
                resizeMode="contain"
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13.5, fontWeight: "700", color: colors.foreground }}>Bild hochgeladen</Text>
                <Text style={{ fontSize: 12.5, color: colors.muted, marginTop: 2 }}>
                  {Platform.OS === "web"
                    ? "Zum Ersetzen klicken oder ein neues Bild hineinziehen"
                    : "Zum Ersetzen tippen"}
                </Text>
              </View>
            </>
          ) : (
            <>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: colors.primary + "1E",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <IconSymbol name="photo.fill" size={20} color={colors.primary} />
              </View>
              <Text style={{ fontSize: 13.5, fontWeight: "700", color: colors.foreground }}>
                {Platform.OS === "web" ? "Bild hierher ziehen oder klicken" : "Bild auswählen"}
              </Text>
              <Text style={{ fontSize: 12, color: colors.muted }}>JPG, PNG oder WebP</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      {!!value && !uploading && (
        <TouchableOpacity onPress={() => onChange("")} style={{ alignSelf: "flex-start", paddingVertical: 6 }}>
          <Text style={{ fontSize: 12.5, fontWeight: "600", color: "#EF4444" }}>Bild entfernen</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

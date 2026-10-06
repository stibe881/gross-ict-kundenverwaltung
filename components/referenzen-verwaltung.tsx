import { useState } from "react";
import { ScrollView, Text, View, TouchableOpacity, TextInput, ActivityIndicator, Switch } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BackButton } from "@/components/back-button";
import { useColors } from "@/hooks/use-colors";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { showAlert, showConfirm } from "@/lib/alert";
import { showToast } from "@/components/toast-provider";
import { ImageUploadField } from "@/components/image-upload-field";

const EMPTY = { branche: "",
  name: "",
  titel: "",
  beschreibung: "",
  url: "",
  url_label: "",
  tags: "",
  bild_url: "",
  umgebung_bild_url: "",
  sort_order: "",
};

export function ReferenzenVerwaltung({ bereich }: { bereich: "web" | "ict" }) {
  const titel = bereich === "ict" ? "ICT-Referenzen" : "Website-Referenzen";
  const colors = useColors();
  const queryClient = useQueryClient();
  const { containerStyle } = useResponsiveLayout();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  const { data: refs = [], isLoading } = useQuery({
    queryKey: ["websiteReferences", bereich],
    queryFn: () => Data.getWebsiteReferences(bereich),
  });

  const set = (key: keyof typeof EMPTY, value: string) => setForm((f) => ({ ...f, [key]: value }));

  // Bereits verwendete Branchen und Tags als Auswahl-Chips anbieten
  const brancheOptions = Array.from(new Set(
    refs.map((r) => (r.tags || []).find((t) => t.startsWith("Branche:"))?.replace("Branche:", "").trim())
      .filter((b): b is string => !!b)
  ));
  const tagOptions = Array.from(new Set(
    refs.flatMap((r) => (r.tags || []).filter((t) => !t.startsWith("Branche:")).map((t) => t.trim()))
      .filter(Boolean)
  ));
  const currentTags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
  const toggleTag = (t: string) => {
    const next = currentTags.includes(t) ? currentTags.filter((x) => x !== t) : [...currentTags, t];
    set("tags", next.join(", "));
  };

  const chipRow = (options: string[], isActive: (o: string) => boolean, onPick: (o: string) => void) =>
    options.length === 0 ? null : (
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: -6, marginBottom: 12 }}>
        {options.map((o) => {
          const active = isActive(o);
          return (
            <TouchableOpacity
              key={o}
              onPress={() => onPick(o)}
              style={{
                paddingHorizontal: 11,
                paddingVertical: 6,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
                backgroundColor: active ? colors.primary + "22" : colors.background,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "600", color: active ? colors.primary : colors.muted }}>{o}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );

  const openNew = () => {
    setEditingId(null);
    setForm({ ...EMPTY, sort_order: String((refs.length + 1) * 10) });
    setShowForm(true);
  };

  const openEdit = (r: Data.WebsiteReference) => {
    setEditingId(r.id);
    setForm({
      name: r.name,
      titel: r.titel, branche: (r.tags || []).find(t => t.startsWith("Branche:"))?.replace("Branche:", "").trim() || "",
      beschreibung: r.beschreibung || "",
      url: r.url || "",
      url_label: r.url_label || "",
      tags: (r.tags || []).filter(t => !t.startsWith("Branche:")).join(", "), 
      bild_url: r.bild_url || "",
      umgebung_bild_url: r.umgebung_bild_url || "",
      sort_order: String(r.sort_order ?? 0),
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.titel.trim() || !form.branche.trim()) {
      showAlert("Fehler", "Bitte mindestens Kundenname, Projekttitel und Branche angeben.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim().toUpperCase(),
        titel: form.titel.trim(),
        beschreibung: form.beschreibung.trim() || null,
        url: form.url.trim() || null,
        url_label: form.url_label.trim() || form.url.trim().replace(/^https?:\/\//, "").replace(/\/$/, "") || null,
        tags: [("Branche:" + form.branche.trim()), ...form.tags.split(",").map((t) => t.trim()).filter(Boolean)],
        bild_url: form.bild_url.trim() || null,
        umgebung_bild_url: form.umgebung_bild_url.trim() || null,
        sort_order: Number(form.sort_order) || 0,
        bereich,
      };
      if (editingId) {
        await Data.updateWebsiteReference(editingId, payload);
        showToast("Referenz aktualisiert — erscheint innert ca. 5 Minuten auf der Website");
      } else {
        await Data.createWebsiteReference(payload);
        showToast("Referenz erfasst — erscheint innert ca. 5 Minuten auf der Website");
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ ...EMPTY });
      queryClient.invalidateQueries({ queryKey: ["websiteReferences", bereich] });
    } catch (e: any) {
      showAlert("Fehler", e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (r: Data.WebsiteReference) => {
    try {
      await Data.updateWebsiteReference(r.id, { active: !r.active });
      queryClient.invalidateQueries({ queryKey: ["websiteReferences", bereich] });
    } catch (e: any) {
      showAlert("Fehler", e.message);
    }
  };

  const handleDelete = (r: Data.WebsiteReference) => {
    showConfirm(
      "Referenz löschen",
      `«${r.name}» wird von der Website entfernt. Fortfahren?`,
      async () => {
        try {
          await Data.deleteWebsiteReference(r.id);
          queryClient.invalidateQueries({ queryKey: ["websiteReferences", bereich] });
          showToast("Referenz gelöscht");
        } catch (e: any) {
          showAlert("Fehler", e.message);
        }
      },
    );
  };

  const input = (label: string, key: keyof typeof EMPTY, props: any = {}) => (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted, marginBottom: 5 }}>{label}</Text>
      <TextInput
        value={form[key]}
        onChangeText={(v) => set(key, v)}
        placeholderTextColor={colors.muted}
        style={{
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          color: colors.text,
          fontSize: 15,
        }}
        {...props}
      />
    </View>
  );

  return (
    <ScreenContainer>
      <ScrollView style={containerStyle} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        <BackButton to="/settings" />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <Text style={{ fontSize: 24, fontWeight: "800", color: colors.text }}>{titel}</Text>
          <TouchableOpacity
            onPress={openNew}
            style={{ backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            <IconSymbol name="plus" size={15} color="#1C1D27" />
            <Text style={{ fontSize: 13, fontWeight: "800", color: "#1C1D27" }}>Neu</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ fontSize: 13.5, color: colors.muted, marginBottom: 16 }}>
          {bereich === "ict"
            ? "Diese Referenzen zeigt gross-ict.ch unter ICT Services (Seite «ICT Referenzen»)."
            : "Diese Referenzen zeigt gross-ict.ch unter Web- & Appdesign."}{" "}Änderungen erscheinen nach dem nächsten Webseite-Update.
        </Text>

        {showForm && (
          <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16, marginBottom: 18 }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 12 }}>
              {editingId ? "Referenz bearbeiten" : "Neue Referenz"}
            </Text>
            {input("Kundenname *", "name", { placeholder: "z.B. MUSTER AG", autoCapitalize: "characters" })}
            {input("Projekttitel *", "titel", { placeholder: "z.B. Unternehmenswebseite" })}
            {input("Beschreibung", "beschreibung", { placeholder: "1–2 Sätze zum Projekt", multiline: true, numberOfLines: 3 })}
            {input("Branche *", "branche", { placeholder: "z.B. IT, Handwerk, Medizin" })}
            {chipRow(brancheOptions, (o) => form.branche.trim() === o, (o) => set("branche", o))}
            {input("Webseite (URL)", "url", { placeholder: "https://…", autoCapitalize: "none", keyboardType: "url" })}
            {input("Link-Anzeigetext", "url_label", { placeholder: "leer = aus URL abgeleitet", autoCapitalize: "none" })}
            {input("Tags (mit Komma getrennt)", "tags", { placeholder: "Webdesign, Frontend" })}
            {chipRow(tagOptions, (o) => currentTags.includes(o), toggleTag)}
            <ImageUploadField
              label="Bild"
              value={form.bild_url}
              folder="referenzen"
              onChange={(url) => set("bild_url", url)}
            />

            {input("Sortierung (klein = weiter oben)", "sort_order", { keyboardType: "number-pad" })}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 12, alignItems: "center", opacity: saving ? 0.6 : 1 }}
              >
                <Text style={{ fontSize: 14, fontWeight: "800", color: "#1C1D27" }}>{saving ? "Speichert…" : "Speichern"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setShowForm(false); setEditingId(null); }}
                style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingVertical: 12, alignItems: "center" }}
              >
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>Abbrechen</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
        ) : refs.length === 0 ? (
          <Text style={{ color: colors.muted, textAlign: "center", marginTop: 30 }}>
            Noch keine Referenzen erfasst.
          </Text>
        ) : (
          refs.map((r) => (
            <View
              key={r.id}
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
                padding: 14,
                marginBottom: 10,
                opacity: r.active ? 1 : 0.55,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: "800", color: colors.primary, letterSpacing: 1 }}>{r.name}</Text>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text, marginTop: 2 }}>{r.titel}</Text>
                  {!!r.url_label && (
                    <Text style={{ fontSize: 12.5, color: colors.muted, marginTop: 2 }}>
                      {r.url_label} · Sortierung {r.sort_order}{r.active ? "" : " · ausgeblendet"}
                    </Text>
                  )}
                  {(r.tags || []).length > 0 && (
                    <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{(r.tags || []).join(" · ")}</Text>
                  )}
                </View>
                <Switch
                  value={r.active}
                  onValueChange={() => toggleActive(r)}
                  trackColor={{ true: colors.primary, false: colors.border }}
                />
                <TouchableOpacity onPress={() => openEdit(r)} hitSlop={8}>
                  <IconSymbol name="pencil" size={18} color={colors.muted} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(r)} hitSlop={8}>
                  <IconSymbol name="trash.fill" size={17} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </ScreenContainer>
  );
}


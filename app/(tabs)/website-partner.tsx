import { useState } from "react";
import { ScrollView, Text, View, TouchableOpacity, TextInput, Image } from "react-native";
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

export default function WebsitePartnerScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const { containerStyle } = useResponsiveLayout();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<{ name: string; logoUrl: string; bereich: "web" | "ict" }>({ name: "", logoUrl: "", bereich: "ict" });
  const [saving, setSaving] = useState(false);

  const { data: partners = [] } = useQuery({
    queryKey: ["websitePartners"],
    queryFn: Data.getWebsitePartners,
  });

  const openNew = () => {
    setEditingId(null);
    setForm({ name: "", logoUrl: "", bereich: "ict" });
    setShowForm(true);
  };

  const openEdit = (p: Data.WebsitePartner) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      logoUrl: p.logoUrl,
      bereich: p.bereich || "ict",
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.logoUrl.trim()) {
      showAlert("Fehler", "Bitte Name angeben und ein Logo hochladen.");
      return;
    }
    setSaving(true);
    try {
      let updatedPartners = [...partners];
      if (editingId) {
        updatedPartners = updatedPartners.map(p => 
          p.id === editingId ? { ...p, name: form.name.trim(), logoUrl: form.logoUrl.trim(), bereich: form.bereich } : p
        );
      } else {
        updatedPartners.push({
          id: Math.random().toString(36).substring(2, 9),
          name: form.name.trim(),
          logoUrl: form.logoUrl.trim(),
          bereich: form.bereich,
        });
      }
      
      await Data.setWebsitePartners(updatedPartners);
      showToast("Partner gespeichert");
      
      setShowForm(false);
      setEditingId(null);
      setForm({ name: "", logoUrl: "", bereich: "ict" });
      queryClient.invalidateQueries({ queryKey: ["websitePartners"] });
    } catch (e: any) {
      showAlert("Fehler", e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    showConfirm(
      "Partner löschen",
      "Soll dieser Partner entfernt werden?",
      async () => {
        try {
          const updated = partners.filter(p => p.id !== id);
          await Data.setWebsitePartners(updated);
          queryClient.invalidateQueries({ queryKey: ["websitePartners"] });
          showToast("Partner gelöscht");
        } catch (e: any) {
          showAlert("Fehler", e.message);
        }
      }
    );
  };

  const input = (label: string, key: "name" | "logoUrl", placeholder: string) => (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted, marginBottom: 5 }}>{label}</Text>
      <TextInput
        value={form[key]}
        onChangeText={(v) => setForm(f => ({ ...f, [key]: v }))}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
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
      />
    </View>
  );

  return (
    <ScreenContainer>
      <ScrollView style={containerStyle} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        <BackButton />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24, marginTop: 10 }}>
          <Text style={{ fontSize: 24, fontWeight: "800", color: colors.foreground }}>Partner</Text>
          <TouchableOpacity
            onPress={openNew}
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.primary,
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 20,
              gap: 8,
            }}
          >
            <IconSymbol name="plus" size={16} color={colors.background} />
            <Text style={{ color: colors.background, fontWeight: "700", fontSize: 14 }}>Neu</Text>
          </TouchableOpacity>
        </View>

        {showForm && (
          <View style={{ backgroundColor: colors.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground, marginBottom: 16 }}>
              {editingId ? "Partner bearbeiten" : "Neuer Partner"}
            </Text>
            {input("Name", "name", "z.B. Lenovo")}
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted, marginBottom: 5 }}>Bereich</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {([["ict", "ICT Partner"], ["web", "Web Partner"]] as const).map(([value, label]) => (
                  <TouchableOpacity
                    key={value}
                    onPress={() => setForm(f => ({ ...f, bereich: value }))}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 10,
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor: form.bereich === value ? colors.primary : colors.border,
                      backgroundColor: form.bereich === value ? colors.primary + "22" : colors.background,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "700", color: form.bereich === value ? colors.primary : colors.muted }}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <ImageUploadField
              label="Logo"
              value={form.logoUrl}
              folder="partner"
              onChange={(url) => setForm(f => ({ ...f, logoUrl: url }))}
            />
            
            <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
              <TouchableOpacity
                onPress={() => setShowForm(false)}
                style={{ flex: 1, backgroundColor: colors.border, padding: 12, borderRadius: 10, alignItems: "center" }}
              >
                <Text style={{ color: colors.foreground, fontWeight: "600" }}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                style={{ flex: 1, backgroundColor: colors.primary, padding: 12, borderRadius: 10, alignItems: "center", opacity: saving ? 0.7 : 1 }}
              >
                <Text style={{ color: colors.background, fontWeight: "700" }}>{saving ? "Speichert..." : "Speichern"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {partners.map(p => (
          <View key={p.id} style={{ backgroundColor: colors.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 12, flexDirection: "row", alignItems: "center" }}>
            <View style={{ width: 40, height: 40, backgroundColor: colors.background, borderRadius: 8, alignItems: "center", justifyContent: "center", marginRight: 16, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
              {p.logoUrl.startsWith("http") ? (
                <Image source={{ uri: p.logoUrl }} style={{ width: 36, height: 36 }} resizeMode="contain" />
              ) : (
                <IconSymbol name="building.2.fill" size={20} color={colors.muted} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>{p.name}</Text>
              <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                {p.bereich === "web" ? "Web Partner" : p.bereich === "ict" ? "ICT Partner" : "Beide Bereiche"}
              </Text>
            </View>
            <TouchableOpacity onPress={() => openEdit(p)} style={{ padding: 10 }}>
              <IconSymbol name="pencil" size={18} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(p.id)} style={{ padding: 10 }}>
              <IconSymbol name="trash" size={18} color="#EF4444" />
            </TouchableOpacity>
          </View>
        ))}

        {partners.length === 0 && !showForm && (
          <Text style={{ textAlign: "center", color: colors.muted, marginTop: 40, fontSize: 15 }}>Keine Partner erfasst.</Text>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

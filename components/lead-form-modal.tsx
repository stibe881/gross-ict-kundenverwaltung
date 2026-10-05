import { useState, useEffect, useMemo } from "react";
import {
  Alert,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import * as Data from "@/lib/data";
import { showAlert } from "@/lib/alert";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

interface LeadFormModalProps {
  visible: boolean;
  lead?: any;
  onClose: () => void;
  onSuccess?: () => void;
}

type SelectedProduct = {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
};

export function LeadFormModal({
  visible,
  lead,
  onClose,
  onSuccess,
}: LeadFormModalProps) {
  const colors = useColors();
  const [saving, setSaving] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisUrl, setAnalysisUrl] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    website: "",
    address: "",
    zip: "",
    city: "",
    status: "new",
    priority: "medium",
    source: "",
    notes: "",
    position: "",
    extraAmount: "",
    extraDescription: "",
    reminderDate: "",
    reminderNote: "",
    rating: "",
    nextAction: "",
    nextActionDate: "",
  });

  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);

  // Load products
  const { data: allProducts = [] } = useQuery({
    queryKey: ["products"],
    queryFn: Data.getAllProducts,
    enabled: visible,
  });

  // Calculate total value from products + extra
  const productsTotal = useMemo(
    () => selectedProducts.reduce((sum, p) => sum + p.quantity * p.unit_price, 0),
    [selectedProducts]
  );
  const extraAmount = parseFloat(formData.extraAmount) || 0;
  const totalValue = productsTotal + extraAmount;

  // Load form data when editing
  useEffect(() => {
    if (!visible) return;

    if (lead) {
      setFormData({
        name: lead.name || "",
        company: lead.company || "",
        email: lead.email || "",
        phone: lead.phone || "",
        website: lead.website || "",
        address: lead.address || "",
        zip: lead.zip || "",
        city: lead.city || "",
        status: lead.status || "new",
        priority: lead.priority || "medium",
        source: lead.source || "",
        notes: lead.notes || "",
        position: lead.position || "",
        extraAmount: lead.extra_amount?.toString() || "",
        extraDescription: lead.extra_description || "",
        reminderDate: "",
        reminderNote: "",
        rating: lead.rating || "",
        nextAction: lead.next_action || "",
        nextActionDate: lead.next_action_date
          ? new Date(lead.next_action_date).toLocaleDateString("de-CH")
          : "",
      });
      // Load existing items
      Data.getLeadItems(lead.id).then((items) => {
        setSelectedProducts(
          items.map((item: any) => ({
            product_id: item.product_id || "",
            name: item.description || "",
            quantity: item.quantity || 1,
            unit_price: item.unit_price || 0,
          }))
        );
      }).catch(() => setSelectedProducts([]));
    } else {
      setFormData({
        name: "",
        company: "",
        email: "",
        phone: "",
        website: "",
        address: "",
        zip: "",
        city: "",
        status: "new",
        priority: "medium",
        source: "",
        notes: "",
        position: "",
        extraAmount: "",
        extraDescription: "",
        reminderDate: "",
        reminderNote: "",
        rating: "",
        nextAction: "",
        nextActionDate: "",
      });
      setSelectedProducts([]);
      setStep(1);
      setAnalysisUrl("");
    }
  }, [lead, visible]);

  const analyzeWebsite = async () => {
    if (!analysisUrl.trim()) return;
    setAnalyzing(true);
    
    const fallbackProceed = () => {
      setFormData(prev => ({ ...prev, website: analysisUrl.trim() }));
      setAnalyzing(false);
      setStep(2);
    };

    try {
      const { data, error } = await supabase.functions.invoke('analyze-website', {
        body: { url: analysisUrl.trim() },
      });
      
      if (!error && data) {
        const proceedWithLead = () => {
          setFormData(prev => ({
            ...prev,
            website: data.url || analysisUrl.trim(),
            company: data.title || prev.company,
            email: data.email || prev.email,
            phone: data.phone || prev.phone,
            address: data.address || prev.address,
            zip: data.zip || prev.zip,
            city: data.city || prev.city,
            priority: data.priority || prev.priority,
            notes: data.notes || prev.notes,
          }));
          setAnalyzing(false);
          setStep(2);
        };

        if (data.duplicateWarning) {
          if (Platform.OS === 'web') {
            const proceed = window.confirm(`${data.duplicateWarning}\n\nMöchten Sie diesen Lead trotzdem erfassen?`);
            if (proceed) {
              proceedWithLead();
            } else {
              setAnalyzing(false);
            }
          } else {
            Alert.alert(
              "Duplikat gefunden",
              `${data.duplicateWarning}\n\nMöchten Sie diesen Lead trotzdem erfassen?`,
              [
                { text: "Abbrechen", style: "cancel", onPress: () => setAnalyzing(false) },
                { text: "Trotzdem erfassen", style: "destructive", onPress: proceedWithLead }
              ]
            );
          }
        } else {
          proceedWithLead();
        }
      } else {
        fallbackProceed();
      }
    } catch (e) {
      fallbackProceed();
    }
  };

  // Analyse direkt aus dem Website-Feld (auch beim Bearbeiten): füllt nur leere Felder
  const analyzeFromField = async () => {
    const url = formData.website.trim();
    if (!url) {
      showAlert("Hinweis", "Bitte zuerst eine Website eintragen.");
      return;
    }
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-website", {
        body: { url },
      });
      if (error || !data) throw new Error(error?.message || "Analyse fehlgeschlagen");
      setFormData((prev) => ({
        ...prev,
        website: data.url || url,
        company: prev.company || data.title || "",
        email: prev.email || data.email || "",
        phone: prev.phone || data.phone || "",
        address: prev.address || data.address || "",
        zip: prev.zip || data.zip || "",
        city: prev.city || data.city || "",
        priority: data.priority || prev.priority,
        notes: data.notes
          ? (prev.notes ? `${prev.notes}\n\n${data.notes}` : data.notes)
          : prev.notes,
      }));
      showAlert("Analyse abgeschlossen", "Leere Felder wurden ergänzt, der Website-Check steht in den Notizen.");
    } catch (e: any) {
      showAlert("Fehler", "Die Website konnte nicht analysiert werden: " + e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const addProduct = (product: any) => {
    const existing = selectedProducts.find((p) => p.product_id === product.id);
    if (existing) {
      setSelectedProducts(
        selectedProducts.map((p) =>
          p.product_id === product.id ? { ...p, quantity: p.quantity + 1 } : p
        )
      );
    } else {
      setSelectedProducts([
        ...selectedProducts,
        {
          product_id: product.id,
          name: product.name,
          quantity: 1,
          unit_price: product.price || 0,
        },
      ]);
    }
  };

  const removeProduct = (productId: string) => {
    setSelectedProducts(selectedProducts.filter((p) => p.product_id !== productId));
  };

  const updateProductQty = (productId: string, qty: number) => {
    if (qty < 1) return;
    setSelectedProducts(
      selectedProducts.map((p) =>
        p.product_id === productId ? { ...p, quantity: qty } : p
      )
    );
  };

  const filteredProducts = allProducts.filter((p: any) =>
    p.name?.toLowerCase().includes(productSearch.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!formData.name && !formData.company) {
      showAlert("Fehler", "Bitte geben Sie mindestens einen Namen oder eine Firma ein.");
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        name: formData.name,
        company: formData.company || undefined,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        website: formData.website || undefined,
        address: formData.address || undefined,
        zip: formData.zip || undefined,
        city: formData.city || undefined,
        position: formData.position || undefined,
        value: totalValue,
        extra_amount: extraAmount || undefined,
        extra_description: formData.extraDescription || undefined,
        status: formData.status,
        priority: formData.priority,
        source: formData.source || undefined,
        notes: formData.notes || undefined,
        rating: formData.rating || null,
        next_action: formData.nextAction || null,
        next_action_date: (() => {
          const v = formData.nextActionDate.trim();
          if (!v) return null;
          const parts = v.split(".");
          if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
          return v;
        })(),
      };

      const items = selectedProducts.map((p) => ({
        description: p.name,
        quantity: p.quantity,
        unit_price: p.unit_price,
        product_id: p.product_id,
      }));

      if (lead) {
        await Data.updateLead(lead.id, payload, items);
        
        // Add reminder if specified
        if (formData.reminderDate && formData.reminderNote) {
          const parts = formData.reminderDate.split(".");
          const dbDate = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : formData.reminderDate;
          const remindAt = new Date(`${dbDate}T08:00:00`);
          if (!isNaN(remindAt.getTime())) {
            await Data.createLeadReminder({
              lead_id: lead.id,
              remind_at: remindAt.toISOString(),
              note: formData.reminderNote,
            });
          }
        }
      } else {
        const newLead = await Data.createLead(payload, items);
        await Data.addLeadActivity({
          lead_id: newLead.id,
          type: "system",
          content: "Lead erstellt",
          user_name: "System",
        });

        // Add reminder if specified
        if (formData.reminderDate && formData.reminderNote) {
          const parts = formData.reminderDate.split(".");
          const dbDate = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : formData.reminderDate;
          const remindAt = new Date(`${dbDate}T08:00:00`);
          if (!isNaN(remindAt.getTime())) {
            await Data.createLeadReminder({
              lead_id: newLead.id,
              remind_at: remindAt.toISOString(),
              note: formData.reminderNote,
            });
            await Data.addLeadActivity({
              lead_id: newLead.id,
              type: "system",
              content: `Erinnerung hinzugefügt für ${formData.reminderDate}`,
              user_name: "System",
            });
          }
        }
      }

      onSuccess?.();
      onClose();
    } catch (e: any) {
      showAlert("Fehler", e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 bg-black/50 justify-end" style={Platform.OS === 'web' ? { justifyContent: 'center', alignItems: 'center' } : undefined}>
        <View
          className="bg-background rounded-t-3xl"
          style={Platform.OS === 'web' ? { maxWidth: 700, width: '100%', borderRadius: 24, maxHeight: '90%' } : { maxHeight: "90%" }}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between p-4 border-b border-border">
            <Text className="text-2xl font-bold text-foreground">
              {lead ? "Lead bearbeiten" : "Neuer Lead"}
            </Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
            </TouchableOpacity>
          </View>

          {step === 1 && !lead ? (
            <View className="p-6 gap-5" style={{ minHeight: 380 }}>
              <View className="items-center">
                <View
                  className="items-center justify-center mb-3"
                  style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#8B5CF618" }}
                >
                  <IconSymbol name="globe" size={30} color="#8B5CF6" />
                </View>
                <Text className="text-lg font-bold text-foreground mb-1 text-center">
                  Mit Website-Analyse starten
                </Text>
                <Text className="text-sm text-muted text-center" style={{ lineHeight: 20 }}>
                  Website eingeben — die KI prüft SSL, Impressum, Datenschutz und Mobil-Optimierung, füllt Firmendaten automatisch aus und liefert einen Gesprächsaufhänger.
                </Text>
              </View>

              <TextInput
                className="bg-surface border border-border rounded-xl px-4 py-3.5 text-foreground text-center"
                style={{ fontSize: 16 }}
                placeholder="www.beispiel.ch"
                placeholderTextColor={colors.muted}
                value={analysisUrl}
                onChangeText={setAnalysisUrl}
                autoCapitalize="none"
                keyboardType="url"
                autoFocus={Platform.OS === "web"}
              />

              <View className="flex-row gap-3 mt-auto">
                <TouchableOpacity
                  className="flex-1 bg-surface border border-border py-3 rounded-lg"
                  onPress={() => setStep(2)}
                  disabled={analyzing}
                  activeOpacity={0.7}
                >
                  <Text className="text-foreground font-semibold text-center">
                    Überspringen
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-primary py-3 rounded-lg"
                  onPress={analyzeWebsite}
                  disabled={analyzing || !analysisUrl.trim()}
                  activeOpacity={0.8}
                >
                  {analyzing ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text className="text-background font-semibold text-center">
                      Analysieren & Weiter
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <ScrollView
            className="p-4"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View className="gap-4 pb-4">
              {/* ── Firma & Adresse ── */}
              <View className="bg-surface rounded-xl border border-border p-4 gap-3">
                <View className="flex-row items-center gap-2">
                  <IconSymbol name="building.2.fill" size={15} color={colors.primary} />
                  <Text className="text-sm font-bold text-foreground">Firma & Adresse</Text>
                </View>
                <TextInput
                  className="bg-background border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="Firma (z.B. Muster AG)"
                  placeholderTextColor={colors.muted}
                  value={formData.company}
                  onChangeText={(text) => setFormData({ ...formData, company: text })}
                />
                <TextInput
                  className="bg-background border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="Strasse und Nr."
                  placeholderTextColor={colors.muted}
                  value={formData.address}
                  onChangeText={(text) => setFormData({ ...formData, address: text })}
                />
                <View className="flex-row gap-3">
                  <TextInput
                    className="bg-background border border-border rounded-lg px-4 py-3 text-foreground"
                    style={{ width: 100 }}
                    placeholder="PLZ"
                    placeholderTextColor={colors.muted}
                    keyboardType="number-pad"
                    value={formData.zip}
                    onChangeText={async (text) => {
                      setFormData(prev => ({ ...prev, zip: text }));
                      if (text.length === 4 && /^\d{4}$/.test(text)) {
                        try {
                          const res = await fetch(`https://api.zippopotam.us/CH/${text}`);
                          if (res.ok) {
                            const json = await res.json();
                            const city = json?.places?.[0]?.['place name'];
                            if (city) setFormData(prev => ({ ...prev, city }));
                          }
                        } catch (_) { }
                      }
                    }}
                  />
                  <TextInput
                    className="flex-1 bg-background border border-border rounded-lg px-4 py-3 text-foreground"
                    placeholder="Ort"
                    placeholderTextColor={colors.muted}
                    value={formData.city}
                    onChangeText={(text) => setFormData({ ...formData, city: text })}
                  />
                </View>
                <View className="flex-row gap-2">
                  <TextInput
                    className="flex-1 bg-background border border-border rounded-lg px-4 py-3 text-foreground"
                    placeholder="Website (www.muster.ch)"
                    placeholderTextColor={colors.muted}
                    autoCapitalize="none"
                    keyboardType="url"
                    value={formData.website}
                    onChangeText={(text) => setFormData({ ...formData, website: text })}
                  />
                  <TouchableOpacity
                    className="px-3 rounded-lg items-center justify-center flex-row gap-1.5"
                    style={{ backgroundColor: "#8B5CF618", opacity: analyzing ? 0.6 : 1 }}
                    onPress={analyzeFromField}
                    disabled={analyzing}
                    activeOpacity={0.8}
                  >
                    {analyzing ? (
                      <ActivityIndicator size="small" color="#8B5CF6" />
                    ) : (
                      <IconSymbol name="sparkles" size={14} color="#8B5CF6" />
                    )}
                    <Text className="text-xs font-bold" style={{ color: "#8B5CF6" }}>Analysieren</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* ── Kontaktperson ── */}
              <View className="bg-surface rounded-xl border border-border p-4 gap-3">
                <View className="flex-row items-center gap-2">
                  <IconSymbol name="person.fill" size={15} color={colors.primary} />
                  <Text className="text-sm font-bold text-foreground">Kontaktperson</Text>
                </View>
                <View className="flex-row gap-3">
                  <TextInput
                    className="flex-1 bg-background border border-border rounded-lg px-4 py-3 text-foreground"
                    placeholder="Name (Max Muster)"
                    placeholderTextColor={colors.muted}
                    value={formData.name}
                    onChangeText={(text) => setFormData({ ...formData, name: text })}
                  />
                  <TextInput
                    className="flex-1 bg-background border border-border rounded-lg px-4 py-3 text-foreground"
                    placeholder="Position"
                    placeholderTextColor={colors.muted}
                    value={formData.position}
                    onChangeText={(text) => setFormData({ ...formData, position: text })}
                  />
                </View>
                <View className="flex-row gap-3">
                  <TextInput
                    className="flex-1 bg-background border border-border rounded-lg px-4 py-3 text-foreground"
                    placeholder="E-Mail"
                    placeholderTextColor={colors.muted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={formData.email}
                    onChangeText={(text) => setFormData({ ...formData, email: text })}
                  />
                  <TextInput
                    className="flex-1 bg-background border border-border rounded-lg px-4 py-3 text-foreground"
                    placeholder="Telefon"
                    placeholderTextColor={colors.muted}
                    keyboardType="phone-pad"
                    value={formData.phone}
                    onChangeText={(text) => setFormData({ ...formData, phone: text })}
                  />
                </View>
              </View>

              {/* ── Einstufung & Pipeline ── */}
              <View className="bg-surface rounded-xl border border-border p-4 gap-3.5">
                <View className="flex-row items-center gap-2">
                  <IconSymbol name="tag.fill" size={15} color={colors.primary} />
                  <Text className="text-sm font-bold text-foreground">Einstufung & Pipeline</Text>
                </View>

                <View>
                  <Text className="text-xs font-semibold text-muted mb-1.5">QUELLE</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {[
                      { key: "", label: "Keine" },
                      { key: "website", label: "Website" },
                      { key: "empfehlung", label: "Empfehlung" },
                      { key: "messe", label: "Messe" },
                      { key: "kaltakquise", label: "Kaltakquise" },
                      { key: "social_media", label: "Social Media" },
                    ].map((sourceOption) => (
                      <TouchableOpacity
                        key={sourceOption.key}
                        className={`px-3 py-1.5 rounded-full border ${formData.source === sourceOption.key ? "bg-primary border-primary" : "bg-background border-border"}`}
                        onPress={() => setFormData({ ...formData, source: sourceOption.key })}
                      >
                        <Text className={`text-xs font-semibold ${formData.source === sourceOption.key ? "text-background" : "text-foreground"}`}>
                          {sourceOption.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View>
                  <Text className="text-xs font-semibold text-muted mb-1.5">EINSTUFUNG</Text>
                  <View className="flex-row gap-2">
                    {[
                      { key: "", label: "Keine" },
                      { key: "hot", label: "🔥 Heiss" },
                      { key: "warm", label: "🌤 Warm" },
                      { key: "cold", label: "❄️ Kalt" },
                    ].map((r) => (
                      <TouchableOpacity
                        key={r.key}
                        className={`px-3 py-1.5 rounded-full border ${formData.rating === r.key ? "bg-primary border-primary" : "bg-background border-border"}`}
                        onPress={() => setFormData({ ...formData, rating: r.key })}
                      >
                        <Text className={`text-xs font-semibold ${formData.rating === r.key ? "text-background" : "text-foreground"}`}>
                          {r.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View>
                  <Text className="text-xs font-semibold text-muted mb-1.5">PRIORITÄT</Text>
                  <View className="flex-row gap-2">
                    {[
                      { key: "low", label: "Tief", color: "#6B7280" },
                      { key: "medium", label: "Mittel", color: "#F59E0B" },
                      { key: "high", label: "Hoch", color: "#EF4444" },
                    ].map((p) => (
                      <TouchableOpacity
                        key={p.key}
                        className="flex-1 py-2 rounded-lg border"
                        style={{
                          backgroundColor: formData.priority === p.key ? p.color + "20" : colors.background,
                          borderColor: formData.priority === p.key ? p.color : colors.border,
                        }}
                        onPress={() => setFormData({ ...formData, priority: p.key })}
                      >
                        <Text
                          className="text-xs font-semibold text-center"
                          style={{ color: formData.priority === p.key ? p.color : colors.muted }}
                        >
                          {p.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View>
                  <Text className="text-xs font-semibold text-muted mb-1.5">STATUS (PIPELINE-PHASE)</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {[
                      { key: "new", label: "Neu" },
                      { key: "contacted", label: "Kontaktiert" },
                      { key: "qualified", label: "Qualifiziert" },
                      { key: "proposal", label: "Angebot" },
                      { key: "won", label: "Gewonnen" },
                      { key: "lost", label: "Verloren" },
                    ].map((statusOption) => (
                      <TouchableOpacity
                        key={statusOption.key}
                        className={`px-3 py-1.5 rounded-full border ${formData.status === statusOption.key ? "bg-primary border-primary" : "bg-background border-border"}`}
                        onPress={() => setFormData({ ...formData, status: statusOption.key })}
                      >
                        <Text className={`text-xs font-semibold ${formData.status === statusOption.key ? "text-background" : "text-foreground"}`}>
                          {statusOption.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {/* ── Nächste Aktion & Wiedervorlage ── */}
              <View className="bg-surface rounded-xl border border-border p-4 gap-3">
                <View className="flex-row items-center gap-2">
                  <IconSymbol name="calendar" size={15} color={colors.primary} />
                  <Text className="text-sm font-bold text-foreground">Nächste Aktion & Wiedervorlage</Text>
                </View>
                <View className="flex-row gap-3">
                  <TextInput
                    className="flex-1 bg-background border border-border rounded-lg px-4 py-3 text-foreground"
                    value={formData.nextAction}
                    onChangeText={(v) => setFormData({ ...formData, nextAction: v })}
                    placeholder="Nächste Aktion (z.B. Anrufen)"
                    placeholderTextColor={colors.muted}
                  />
                  <TextInput
                    className="bg-background border border-border rounded-lg px-4 py-3 text-foreground"
                    style={{ width: 130 }}
                    value={formData.nextActionDate}
                    onChangeText={(v) => setFormData({ ...formData, nextActionDate: v })}
                    placeholder="TT.MM.JJJJ"
                    placeholderTextColor={colors.muted}
                  />
                </View>
                <View className="flex-row gap-3">
                  <TextInput
                    className="flex-1 bg-background border border-border rounded-lg px-4 py-3 text-foreground"
                    placeholder="Erinnerung: Grund / Notiz"
                    placeholderTextColor={colors.muted}
                    value={formData.reminderNote}
                    onChangeText={(text) => setFormData({ ...formData, reminderNote: text })}
                  />
                  <TextInput
                    className="bg-background border border-border rounded-lg px-4 py-3 text-foreground"
                    style={{ width: 130 }}
                    placeholder="TT.MM.JJJJ"
                    placeholderTextColor={colors.muted}
                    value={formData.reminderDate}
                    onChangeText={(text) => setFormData({ ...formData, reminderDate: text })}
                  />
                </View>
                <Text className="text-xs text-muted">
                  Überfällige Aktionen erscheinen im Heute-Feed. Erinnerung (Datum + Notiz) erstellt eine Wiedervorlage mit Benachrichtigung.
                </Text>
              </View>

              {/* ── Potenzial ── */}
              <View className="bg-surface rounded-xl p-4 border border-border">
                <View className="flex-row items-center gap-2 mb-3">
                  <IconSymbol name="banknote" size={15} color={colors.primary} />
                  <Text className="text-sm font-bold text-foreground">Potenzial</Text>
                </View>

                {/* Produkte */}
                <View className="mb-3">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-xs font-semibold text-muted">PRODUKTE</Text>
                    <TouchableOpacity
                      className="flex-row items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10"
                      onPress={() => setShowProductPicker(true)}
                      activeOpacity={0.7}
                    >
                      <IconSymbol name="plus" size={14} color={colors.primary} />
                      <Text className="text-xs font-semibold" style={{ color: colors.primary }}>
                        Hinzufügen
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {selectedProducts.length > 0 ? (
                    <View className="gap-2">
                      {selectedProducts.map((product) => (
                        <View
                          key={product.product_id}
                          className="flex-row items-center bg-background rounded-lg p-3 border border-border"
                        >
                          <View className="flex-1 mr-2">
                            <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                              {product.name}
                            </Text>
                            <Text className="text-xs text-muted">
                              CHF {product.unit_price.toLocaleString("de-CH", { minimumFractionDigits: 2 })} / Stk.
                            </Text>
                          </View>
                          <View className="flex-row items-center gap-2">
                            <TouchableOpacity
                              className="w-7 h-7 rounded-md bg-surface border border-border items-center justify-center"
                              onPress={() => updateProductQty(product.product_id, product.quantity - 1)}
                            >
                              <Text className="text-foreground font-bold">−</Text>
                            </TouchableOpacity>
                            <Text className="text-sm font-semibold text-foreground w-6 text-center">
                              {product.quantity}
                            </Text>
                            <TouchableOpacity
                              className="w-7 h-7 rounded-md bg-surface border border-border items-center justify-center"
                              onPress={() => updateProductQty(product.product_id, product.quantity + 1)}
                            >
                              <Text className="text-foreground font-bold">+</Text>
                            </TouchableOpacity>
                            <Text className="text-sm font-semibold text-foreground ml-2" style={{ minWidth: 70, textAlign: "right" }}>
                              CHF {(product.quantity * product.unit_price).toLocaleString("de-CH", { minimumFractionDigits: 2 })}
                            </Text>
                            <TouchableOpacity
                              className="ml-2 w-7 h-7 rounded-md items-center justify-center"
                              style={{ backgroundColor: colors.error + '15' }}
                              onPress={() => removeProduct(product.product_id)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              activeOpacity={0.6}
                            >
                              <IconSymbol name="xmark" size={14} color={colors.error} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                      <View className="flex-row justify-end">
                        <Text className="text-xs text-muted">
                          Produkte: CHF {productsTotal.toLocaleString("de-CH", { minimumFractionDigits: 2 })}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <Text className="text-sm text-muted italic">
                      Keine Produkte ausgewählt
                    </Text>
                  )}
                </View>

                {/* Freier Betrag */}
                <View className="border-t border-border pt-3">
                  <Text className="text-xs font-semibold text-muted mb-2">FREIER BETRAG</Text>
                  <View className="flex-row gap-3">
                    <View style={{ width: 130 }}>
                      <TextInput
                        className="bg-background border border-border rounded-lg px-4 py-3 text-foreground"
                        placeholder="0.00"
                        placeholderTextColor={colors.muted}
                        keyboardType="decimal-pad"
                        value={formData.extraAmount}
                        onChangeText={(text) => setFormData({ ...formData, extraAmount: text })}
                      />
                    </View>
                    <View className="flex-1">
                      <TextInput
                        className="bg-background border border-border rounded-lg px-4 py-3 text-foreground"
                        placeholder="Beschreibung (z.B. Beratung)"
                        placeholderTextColor={colors.muted}
                        value={formData.extraDescription}
                        onChangeText={(text) => setFormData({ ...formData, extraDescription: text })}
                      />
                    </View>
                  </View>
                </View>

                {/* Total */}
                <View className="border-t border-border mt-3 pt-3 flex-row items-center justify-between">
                  <Text className="text-sm font-bold text-foreground">Gesamtpotenzial</Text>
                  <Text className="text-lg font-bold text-success">
                    CHF {totalValue.toLocaleString("de-CH", { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              </View>

              {/* ── Notizen ── */}
              <View className="bg-surface rounded-xl border border-border p-4 gap-3">
                <View className="flex-row items-center gap-2">
                  <IconSymbol name="note.text" size={15} color={colors.primary} />
                  <Text className="text-sm font-bold text-foreground">Notizen</Text>
                </View>
                <TextInput
                  className="bg-background border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="Zusätzliche Informationen..."
                  placeholderTextColor={colors.muted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  style={{ minHeight: 90 }}
                  value={formData.notes}
                  onChangeText={(text) => setFormData({ ...formData, notes: text })}
                />
              </View>
            </View>
          </ScrollView>

            {/* Footer Buttons */}
            <View className="p-4 border-t border-border flex-row gap-3">
              <TouchableOpacity
                className="flex-1 bg-surface border border-border py-3 rounded-lg"
                onPress={onClose}
                disabled={saving}
                activeOpacity={0.7}
              >
                <Text className="text-foreground font-semibold text-center">
                  Abbrechen
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-primary py-3 rounded-lg"
                onPress={handleSubmit}
                disabled={saving}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="text-background font-semibold text-center">
                    {lead ? "Aktualisieren" : "Speichern"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </>)}
        </View>
      </KeyboardAvoidingView>

      {/* Product Picker Modal */}
      <Modal visible={showProductPicker} animationType="fade" transparent onRequestClose={() => setShowProductPicker(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 bg-black/50 items-center justify-center p-4">
          <View className="bg-background rounded-2xl w-full max-w-md" style={{ maxHeight: "70%" }}>
            <View className="flex-row items-center justify-between p-4 border-b border-border">
              <Text className="text-lg font-bold text-foreground">Produkt wählen</Text>
              <TouchableOpacity onPress={() => { setShowProductPicker(false); setProductSearch(""); }}>
                <IconSymbol name="xmark.circle.fill" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <View className="p-3">
              <TextInput
                className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                placeholder="Produkt suchen..."
                placeholderTextColor={colors.muted}
                value={productSearch}
                onChangeText={setProductSearch}
                autoFocus
              />
            </View>

            <ScrollView className="px-3 pb-3" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {filteredProducts.length === 0 ? (
                <Text className="text-sm text-muted text-center py-6">
                  Keine Produkte gefunden
                </Text>
              ) : (
                filteredProducts.map((product: any) => {
                  const isSelected = selectedProducts.some((p) => p.product_id === product.id);
                  return (
                    <TouchableOpacity
                      key={product.id}
                      className="flex-row items-center justify-between p-3 rounded-lg mb-1"
                      style={{
                        backgroundColor: isSelected ? colors.primary + "15" : undefined,
                      }}
                      onPress={() => addProduct(product)}
                      activeOpacity={0.7}
                    >
                      <View className="flex-1 mr-3">
                        <Text className="text-sm font-semibold text-foreground">{product.name}</Text>
                        {product.description ? (
                          <Text className="text-xs text-muted" numberOfLines={1}>{product.description}</Text>
                        ) : null}
                      </View>
                      <Text className="text-sm font-semibold" style={{ color: colors.success }}>
                        CHF {(product.price || 0).toLocaleString("de-CH", { minimumFractionDigits: 2 })}
                      </Text>
                      {isSelected && (
                        <View className="ml-2 w-5 h-5 rounded-full bg-primary items-center justify-center">
                          <Text className="text-xs text-white font-bold">✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Modal>
  );
}

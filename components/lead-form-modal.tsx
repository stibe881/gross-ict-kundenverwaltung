import { useState, useEffect, useMemo } from "react";
import {
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
      });
      setSelectedProducts([]);
      setStep(1);
      setAnalysisUrl("");
    }
  }, [lead, visible]);

  const analyzeWebsite = async () => {
    if (!analysisUrl.trim()) return;
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-website', {
        body: { url: analysisUrl.trim() },
      });
      if (!error && data) {
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
      } else {
        setFormData(prev => ({ ...prev, website: analysisUrl.trim() }));
      }
    } catch (e) {
      setFormData(prev => ({ ...prev, website: analysisUrl.trim() }));
    } finally {
      setAnalyzing(false);
      setStep(2);
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
            <View className="p-6 gap-6" style={{ minHeight: 350 }}>
              <View>
                <Text className="text-lg font-semibold text-foreground mb-2">
                  Website analysieren (Optional)
                </Text>
                <Text className="text-sm text-muted">
                  Geben Sie die Website des potenziellen Kunden ein. Unser System analysiert diese auf Sicherheit, Rechtskonformität und Modernität und füllt den Lead automatisch aus.
                </Text>
              </View>
              
              <TextInput
                className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                placeholder="www.beispiel.ch"
                placeholderTextColor={colors.muted}
                value={analysisUrl}
                onChangeText={setAnalysisUrl}
                autoCapitalize="none"
                keyboardType="url"
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
              {/* Name + Firma */}
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground mb-2">
                    Kontaktperson
                  </Text>
                  <TextInput
                    className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                    placeholder="Max Muster"
                    placeholderTextColor={colors.muted}
                    value={formData.name}
                    onChangeText={(text) =>
                      setFormData({ ...formData, name: text })
                    }
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground mb-2">
                    Position
                  </Text>
                  <TextInput
                    className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                    placeholder="z.B. Geschäftsführer"
                    placeholderTextColor={colors.muted}
                    value={formData.position}
                    onChangeText={(text) =>
                      setFormData({ ...formData, position: text })
                    }
                  />
                </View>
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground mb-2">
                    Firma
                  </Text>
                  <TextInput
                    className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                    placeholder="Muster AG"
                    placeholderTextColor={colors.muted}
                    value={formData.company}
                    onChangeText={(text) =>
                      setFormData({ ...formData, company: text })
                    }
                  />
                </View>
              </View>

              {/* E-Mail + Telefon */}
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground mb-2">
                    E-Mail
                  </Text>
                  <TextInput
                    className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                    placeholder="max@muster.ch"
                    placeholderTextColor={colors.muted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={formData.email}
                    onChangeText={(text) =>
                      setFormData({ ...formData, email: text })
                    }
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground mb-2">
                    Telefon
                  </Text>
                  <TextInput
                    className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                    placeholder="+41 79 123 45 67"
                    placeholderTextColor={colors.muted}
                    keyboardType="phone-pad"
                    value={formData.phone}
                    onChangeText={(text) =>
                      setFormData({ ...formData, phone: text })
                    }
                  />
                </View>
              </View>

              {/* Website */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Website
                </Text>
                <TextInput
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="www.muster.ch"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  value={formData.website}
                  onChangeText={(text) =>
                    setFormData({ ...formData, website: text })
                  }
                />
              </View>

              {/* Adresse */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Adresse
                </Text>
                <TextInput
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="Musterstrasse 1"
                  placeholderTextColor={colors.muted}
                  value={formData.address}
                  onChangeText={(text) =>
                    setFormData({ ...formData, address: text })
                  }
                />
              </View>
              <View className="flex-row gap-3">
                <View style={{ width: 100 }}>
                  <Text className="text-sm font-semibold text-foreground mb-2">
                    PLZ
                  </Text>
                  <TextInput
                    className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                    placeholder="8000"
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
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground mb-2">
                    Ort
                  </Text>
                  <TextInput
                    className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                    placeholder="Zürich"
                    placeholderTextColor={colors.muted}
                    value={formData.city}
                    onChangeText={(text) =>
                      setFormData({ ...formData, city: text })
                    }
                  />
                </View>
              </View>

              {/* ── POTENZIAL SECTION ── */}
              <View className="bg-surface rounded-xl p-4 border border-border">
                <Text className="text-base font-bold text-foreground mb-3">
                  <IconSymbol name="banknote" size={16} color={colors.foreground} /> Potenzial
                </Text>

                {/* Produkte */}
                <View className="mb-3">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-sm font-semibold text-foreground">
                      Produkte
                    </Text>
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
                  <Text className="text-sm font-semibold text-foreground mb-2">
                    Freier Betrag
                  </Text>
                  <View className="flex-row gap-3">
                    <View style={{ width: 130 }}>
                      <TextInput
                        className="bg-background border border-border rounded-lg px-4 py-3 text-foreground"
                        placeholder="0.00"
                        placeholderTextColor={colors.muted}
                        keyboardType="decimal-pad"
                        value={formData.extraAmount}
                        onChangeText={(text) =>
                          setFormData({ ...formData, extraAmount: text })
                        }
                      />
                    </View>
                    <View className="flex-1">
                      <TextInput
                        className="bg-background border border-border rounded-lg px-4 py-3 text-foreground"
                        placeholder="Beschreibung (z.B. Beratung)"
                        placeholderTextColor={colors.muted}
                        value={formData.extraDescription}
                        onChangeText={(text) =>
                          setFormData({ ...formData, extraDescription: text })
                        }
                      />
                    </View>
                  </View>
                </View>

                {/* Total */}
                <View className="border-t border-border mt-3 pt-3 flex-row items-center justify-between">
                  <Text className="text-sm font-bold text-foreground">
                    Gesamtpotenzial
                  </Text>
                  <Text className="text-lg font-bold text-success">
                    CHF {totalValue.toLocaleString("de-CH", { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              </View>

              {/* Quelle */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Quelle
                </Text>
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
                      className={`px-3 py-1.5 rounded-lg border ${formData.source === sourceOption.key
                        ? "bg-primary border-primary"
                        : "bg-surface border-border"
                        }`}
                      onPress={() =>
                        setFormData({ ...formData, source: sourceOption.key })
                      }
                    >
                      <Text
                        className={`text-xs font-semibold ${formData.source === sourceOption.key
                          ? "text-background"
                          : "text-foreground"
                          }`}
                      >
                        {sourceOption.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Priorität */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Priorität
                </Text>
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
                        backgroundColor: formData.priority === p.key ? p.color + "20" : undefined,
                        borderColor: formData.priority === p.key ? p.color : "#374151",
                      }}
                      onPress={() => setFormData({ ...formData, priority: p.key })}
                    >
                      <Text
                        className="text-xs font-semibold text-center"
                        style={{ color: formData.priority === p.key ? p.color : "#9CA3AF" }}
                      >
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Status */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Status
                </Text>
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
                      className={`px-3 py-1.5 rounded-lg border ${formData.status === statusOption.key
                        ? "bg-primary border-primary"
                        : "bg-surface border-border"
                        }`}
                      onPress={() =>
                        setFormData({ ...formData, status: statusOption.key })
                      }
                    >
                      <Text
                        className={`text-xs font-semibold ${formData.status === statusOption.key
                          ? "text-background"
                          : "text-foreground"
                          }`}
                      >
                        {statusOption.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Terminierung / Wiedervorlage */}
              <View className="bg-surface rounded-xl p-4 border border-border mt-2">
                <Text className="text-base font-bold text-foreground mb-3">
                  <IconSymbol name="calendar" size={16} color={colors.foreground} /> Terminierung (optional)
                </Text>
                <View className="flex-row gap-3">
                  <View style={{ width: 140 }}>
                    <Text className="text-sm font-semibold text-foreground mb-2">
                      Datum
                    </Text>
                    <TextInput
                      className="bg-background border border-border rounded-lg px-4 py-3 text-foreground"
                      placeholder="TT.MM.JJJJ"
                      placeholderTextColor={colors.muted}
                      value={formData.reminderDate}
                      onChangeText={(text) =>
                        setFormData({ ...formData, reminderDate: text })
                      }
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-foreground mb-2">
                      Grund / Notiz
                    </Text>
                    <TextInput
                      className="bg-background border border-border rounded-lg px-4 py-3 text-foreground"
                      placeholder="z.B. Nochmals anrufen"
                      placeholderTextColor={colors.muted}
                      value={formData.reminderNote}
                      onChangeText={(text) =>
                        setFormData({ ...formData, reminderNote: text })
                      }
                    />
                  </View>
                </View>
                <Text className="text-xs text-muted mt-2">
                  Füllen Sie beide Felder aus, um eine automatische Wiedervorlage für diesen Lead zu erstellen.
                </Text>
              </View>

              {/* Notizen */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Notizen
                </Text>
                <TextInput
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="Zusätzliche Informationen..."
                  placeholderTextColor={colors.muted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  value={formData.notes}
                  onChangeText={(text) =>
                    setFormData({ ...formData, notes: text })
                  }
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

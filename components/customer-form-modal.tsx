import { useState } from "react";
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
  Image,
} from "react-native";
import { showAlert } from "@/lib/alert";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useMutation } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import * as ImagePicker from "expo-image-picker";

interface CustomerFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editCustomer?: any; // if provided, we are editing
}

interface ContactEntry {
  id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  position: string;
  is_primary: boolean;
}

const emptyContact = (): ContactEntry => ({
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  position: "",
  is_primary: false,
});

export function CustomerFormModal({
  visible,
  onClose,
  onSuccess,
  editCustomer,
}: CustomerFormModalProps) {
  const colors = useColors();
  const isEditing = !!editCustomer;

  const [formData, setFormData] = useState({
    firstName: editCustomer?.first_name || "",
    lastName: editCustomer?.last_name || "",
    companyName: editCustomer?.company_name || "",
    position: editCustomer?.position || "",
    email: editCustomer?.email || "",
    phone: editCustomer?.phone || "",
    address: editCustomer?.address || "",
    city: editCustomer?.city || "",
    postalCode: editCustomer?.postal_code || "",
    country: editCustomer?.country || "Schweiz",
  });
  const [logoUri, setLogoUri] = useState<string | null>(editCustomer?.logo_url || null);
  const [logoChanged, setLogoChanged] = useState(false);
  const [contacts, setContacts] = useState<ContactEntry[]>([]);
  const [showContacts, setShowContacts] = useState(false);

  // Reset form when modal opens with edit data
  const handleOpen = () => {
    if (editCustomer) {
      setFormData({
        firstName: editCustomer.first_name || "",
        lastName: editCustomer.last_name || "",
        companyName: editCustomer.company_name || "",
        position: editCustomer.position || "",
        email: editCustomer.email || "",
        phone: editCustomer.phone || "",
        address: editCustomer.address || "",
        city: editCustomer.city || "",
        postalCode: editCustomer.postal_code || "",
        country: editCustomer.country || "Schweiz",
      });
      setLogoUri(editCustomer.logo_url || null);
      setLogoChanged(false);
    }
  };

  const createCustomer = useMutation({
    mutationFn: async (data: any) => {
      const customerData = {
        first_name: data.firstName,
        last_name: data.lastName,
        company_name: data.companyName,
        position: data.position,
        email: data.email,
        phone: data.phone,
        address: data.address,
        city: data.city,
        postal_code: data.postalCode,
        country: data.country,
      };

      let result;
      if (isEditing) {
        result = await Data.updateCustomer(editCustomer.id, customerData);
      } else {
        result = await Data.createCustomer(customerData);
      }

      // Upload logo if changed
      if (logoChanged && result?.id) {
        if (logoUri) {
          try {
            await Data.uploadCustomerLogo(result.id, logoUri);
          } catch (e: any) {
            showAlert("Logo-Fehler", `Logo konnte nicht hochgeladen werden: ${e.message}`);
          }
        } else {
          // Logo was removed
          try {
            await Data.updateCustomer(result.id, { logo_url: null });
          } catch (e: any) {
            console.warn("Logo removal failed:", e.message);
          }
        }
      }

      // Create contacts
      if (contacts.length > 0 && result?.id) {
        for (const contact of contacts) {
          if (contact.first_name || contact.last_name || contact.email) {
            try {
              await Data.createCustomerContact({
                customer_id: result.id,
                ...contact,
              });
            } catch (e: any) {
              console.warn("Contact creation failed:", e.message);
            }
          }
        }
      }

      return result;
    },
    onSuccess: () => {
      showAlert("Erfolg", isEditing ? "Kunde wurde aktualisiert" : "Kunde wurde erstellt");
      onSuccess?.();
      onClose();
      resetForm();
    },
    onError: (error: any) => {
      showAlert("Fehler", `Kunde konnte nicht gespeichert werden: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({
      firstName: "",
      lastName: "",
      companyName: "",
      position: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      postalCode: "",
      country: "Schweiz",
    });
    setLogoUri(null);
    setLogoChanged(false);
    setContacts([]);
    setShowContacts(false);
  };

  const pickLogo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: Platform.OS === "web", // Only request base64 on web
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        // Web: use base64 data URI for reliable upload
        // Native: use file URI (fetch().blob() works natively)
        if (Platform.OS === "web" && asset.base64) {
          const mimeType = asset.mimeType || "image/jpeg";
          setLogoUri(`data:${mimeType};base64,${asset.base64}`);
        } else {
          setLogoUri(asset.uri);
        }
        setLogoChanged(true);
      }
    } catch (e) {
      showAlert("Fehler", "Bild konnte nicht geladen werden");
    }
  };

  const handleSubmit = () => {
    if (!formData.email || (!formData.firstName && !formData.companyName)) {
      showAlert("Fehler", "Bitte füllen Sie mindestens E-Mail und Name/Firma aus");
      return;
    }
    createCustomer.mutate(formData);
  };

  const addContact = () => {
    setContacts([...contacts, emptyContact()]);
    setShowContacts(true);
  };

  const updateContact = (index: number, field: keyof ContactEntry, value: any) => {
    const updated = [...contacts];
    (updated[index] as any)[field] = value;
    setContacts(updated);
  };

  const removeContact = (index: number) => {
    setContacts(contacts.filter((_, i) => i !== index));
  };

  const renderInput = (label: string, value: string, onChange: (t: string) => void, options?: {
    placeholder?: string; keyboard?: any; autoCapitalize?: any; multiline?: boolean;
  }) => (
    <View>
      <Text className="text-sm font-semibold text-foreground mb-2">{label}</Text>
      <TextInput
        className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
        placeholder={options?.placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={options?.keyboard}
        autoCapitalize={options?.autoCapitalize}
        multiline={options?.multiline}
        value={value}
        onChangeText={onChange}
      />
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      onShow={handleOpen}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 justify-end"
      >
        <View className="bg-background rounded-t-3xl" style={{ maxHeight: "90%" }}>
          {/* Header */}
          <View className="flex-row items-center justify-between p-4 border-b border-border">
            <Text className="text-2xl font-bold text-foreground">
              {isEditing ? "Kunde bearbeiten" : "Neuer Kunde"}
            </Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Form */}
          <ScrollView className="p-4" showsVerticalScrollIndicator={false}>
            <View className="gap-4">

              {/* Logo Upload */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">Firmenlogo</Text>
                <TouchableOpacity
                  className="flex-row items-center gap-3"
                  onPress={pickLogo}
                  activeOpacity={0.7}
                >
                  {logoUri ? (
                    <Image
                      source={{ uri: logoUri }}
                      style={{ width: 64, height: 64, borderRadius: 12 }}
                      resizeMode="contain"
                    />
                  ) : (
                    <View
                      className="w-16 h-16 rounded-xl items-center justify-center border-2 border-dashed"
                      style={{ borderColor: colors.border }}
                    >
                      <IconSymbol name="camera.fill" size={24} color={colors.muted} />
                    </View>
                  )}
                  <View className="flex-1">
                    <Text className="text-sm text-foreground font-medium">
                      {logoUri ? "Logo ändern" : "Logo hochladen"}
                    </Text>
                    <Text className="text-xs text-muted">Tippe um ein Bild auszuwählen</Text>
                  </View>
                  {logoUri && (
                    <TouchableOpacity
                      onPress={() => { setLogoUri(null); setLogoChanged(true); }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <IconSymbol name="trash.fill" size={16} color={colors.error} />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              </View>

              {/* Firmenname */}
              {renderInput("Firmenname", formData.companyName,
                (text) => setFormData({ ...formData, companyName: text }),
                { placeholder: "z.B. Musterfirma GmbH" }
              )}

              {/* Vorname & Nachname */}
              <View className="flex-row gap-3">
                <View className="flex-1">
                  {renderInput("Vorname", formData.firstName,
                    (text) => setFormData({ ...formData, firstName: text }),
                    { placeholder: "Max" }
                  )}
                </View>
                <View className="flex-1">
                  {renderInput("Nachname", formData.lastName,
                    (text) => setFormData({ ...formData, lastName: text }),
                    { placeholder: "Mustermann" }
                  )}
                </View>
              </View>

              {/* Position */}
              {renderInput("Position", formData.position,
                (text) => setFormData({ ...formData, position: text }),
                { placeholder: "z.B. Geschäftsführer, IT-Leiter" }
              )}

              {/* E-Mail */}
              {renderInput("E-Mail *", formData.email,
                (text) => setFormData({ ...formData, email: text }),
                { placeholder: "max@musterfirma.ch", keyboard: "email-address", autoCapitalize: "none" }
              )}

              {/* Telefon */}
              {renderInput("Telefon", formData.phone,
                (text) => setFormData({ ...formData, phone: text }),
                { placeholder: "+41 44 123 45 67", keyboard: "phone-pad" }
              )}

              {/* Adresse */}
              {renderInput("Adresse", formData.address,
                (text) => setFormData({ ...formData, address: text }),
                { placeholder: "Musterstrasse 123" }
              )}

              {/* PLZ & Ort */}
              <View className="flex-row gap-3">
                <View style={{ width: 100 }}>
                  {renderInput("PLZ", formData.postalCode,
                    (text) => setFormData({ ...formData, postalCode: text }),
                    { placeholder: "8000", keyboard: "number-pad" }
                  )}
                </View>
                <View className="flex-1">
                  {renderInput("Ort", formData.city,
                    (text) => setFormData({ ...formData, city: text }),
                    { placeholder: "Zürich" }
                  )}
                </View>
              </View>

              {/* Land */}
              {renderInput("Land", formData.country,
                (text) => setFormData({ ...formData, country: text }),
                { placeholder: "Schweiz" }
              )}

              {/* ── Kontakte ── */}
              <View className="border-t border-border pt-4 mt-2">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-base font-bold text-foreground">Ansprechpartner</Text>
                  <TouchableOpacity
                    className="flex-row items-center gap-1 bg-primary px-3 py-1.5 rounded-lg"
                    onPress={addContact}
                    activeOpacity={0.8}
                  >
                    <Text className="text-xs font-semibold" style={{ color: "#111" }}>+ Kontakt</Text>
                  </TouchableOpacity>
                </View>

                {contacts.length === 0 && (
                  <Text className="text-sm text-muted text-center py-4">
                    Noch keine Ansprechpartner hinzugefügt
                  </Text>
                )}

                {contacts.map((contact, index) => (
                  <View
                    key={index}
                    className="bg-surface rounded-xl border border-border p-4 mb-3"
                  >
                    <View className="flex-row items-center justify-between mb-3">
                      <Text className="text-sm font-semibold text-foreground">
                        Kontakt {index + 1}
                      </Text>
                      <TouchableOpacity onPress={() => removeContact(index)}>
                        <IconSymbol name="trash.fill" size={16} color={colors.error} />
                      </TouchableOpacity>
                    </View>

                    <View className="gap-3">
                      <View className="flex-row gap-3">
                        <View className="flex-1">
                          <TextInput
                            className="bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                            placeholder="Vorname"
                            placeholderTextColor={colors.muted}
                            value={contact.first_name}
                            onChangeText={(t) => updateContact(index, "first_name", t)}
                          />
                        </View>
                        <View className="flex-1">
                          <TextInput
                            className="bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                            placeholder="Nachname"
                            placeholderTextColor={colors.muted}
                            value={contact.last_name}
                            onChangeText={(t) => updateContact(index, "last_name", t)}
                          />
                        </View>
                      </View>
                      <TextInput
                        className="bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                        placeholder="Position (z.B. CEO, IT-Leiter)"
                        placeholderTextColor={colors.muted}
                        value={contact.position}
                        onChangeText={(t) => updateContact(index, "position", t)}
                      />
                      <TextInput
                        className="bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                        placeholder="E-Mail"
                        placeholderTextColor={colors.muted}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={contact.email}
                        onChangeText={(t) => updateContact(index, "email", t)}
                      />
                      <TextInput
                        className="bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                        placeholder="Telefon"
                        placeholderTextColor={colors.muted}
                        keyboardType="phone-pad"
                        value={contact.phone}
                        onChangeText={(t) => updateContact(index, "phone", t)}
                      />
                      <TouchableOpacity
                        className="flex-row items-center gap-2"
                        onPress={() => updateContact(index, "is_primary", !contact.is_primary)}
                      >
                        <View
                          className="w-5 h-5 rounded border items-center justify-center"
                          style={{
                            backgroundColor: contact.is_primary ? colors.primary : "transparent",
                            borderColor: contact.is_primary ? colors.primary : colors.border,
                          }}
                        >
                          {contact.is_primary && (
                            <IconSymbol name="checkmark" size={12} color="#111" />
                          )}
                        </View>
                        <Text className="text-sm text-foreground">Hauptansprechpartner</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>

              <View style={{ height: 20 }} />
            </View>
          </ScrollView>

          {/* Footer Buttons */}
          <View className="p-4 border-t border-border flex-row gap-3">
            <TouchableOpacity
              className="flex-1 bg-surface border border-border py-3 rounded-lg"
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text className="text-foreground font-semibold text-center">Abbrechen</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 bg-primary py-3 rounded-lg"
              onPress={handleSubmit}
              disabled={createCustomer.isPending}
              activeOpacity={0.8}
            >
              {createCustomer.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-background font-semibold text-center">Speichern</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

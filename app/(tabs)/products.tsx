import { useState, useEffect } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  FlatList,
  Modal,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { formatCurrency, VAT_RATES } from "@/lib/format";

export default function ProductsScreen() {
  const colors = useColors();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  // Produkte laden
  const { data: products, isLoading, refetch } = trpc.products.list.useQuery();

  const renderProductItem = ({ item }: { item: any }) => {
    return (
      <TouchableOpacity
        className="bg-surface rounded-xl p-4 mb-3 border border-border"
        activeOpacity={0.7}
        onPress={() => {
          setEditingProduct(item);
          setShowAddModal(true);
        }}
      >
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-1">
            <Text className="text-lg font-semibold text-foreground mb-1">
              {item.name}
            </Text>
            {item.description && (
              <Text className="text-sm text-muted mb-2">{item.description}</Text>
            )}
          </View>
          <View
            className={`px-2 py-1 rounded-lg ${item.type === "product" ? "bg-primary/20" : "bg-success/20"
              }`}
          >
            <Text
              className={`text-xs font-semibold ${item.type === "product" ? "text-primary" : "text-success"
                }`}
            >
              {item.type === "product" ? "Artikel" : "Dienstleistung"}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-xl font-bold text-primary">
              {formatCurrency(parseFloat(item.price))}
            </Text>
            <Text className="text-xs text-muted">
              {item.unit || "Stück"} | MwSt: {item.vat_rate}%
            </Text>
          </View>
          <TouchableOpacity
            className="bg-primary px-4 py-2 rounded-lg"
            activeOpacity={0.8}
            onPress={() => {
              setEditingProduct(item);
              setShowAddModal(true);
            }}
          >
            <Text className="text-background text-sm font-semibold">
              Bearbeiten
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer>
      <View className="flex-1 p-4">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-3xl font-bold text-foreground">Produkte</Text>
          <TouchableOpacity
            className="bg-primary w-12 h-12 rounded-full items-center justify-center"
            activeOpacity={0.8}
            onPress={() => {
              setEditingProduct(null);
              setShowAddModal(true);
            }}
          >
            <IconSymbol name="plus.circle.fill" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Statistik */}
        <View className="flex-row gap-3 mb-4">
          <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
            <Text className="text-2xl font-bold text-foreground">
              {products?.length || 0}
            </Text>
            <Text className="text-sm text-muted">Gesamt</Text>
          </View>
          <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
            <Text className="text-2xl font-bold text-primary">
              {products?.filter((p) => p.type === "product").length || 0}
            </Text>
            <Text className="text-sm text-muted">Artikel</Text>
          </View>
          <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
            <Text className="text-2xl font-bold text-success">
              {products?.filter((p) => p.type === "service").length || 0}
            </Text>
            <Text className="text-sm text-muted">Dienstleistungen</Text>
          </View>
        </View>

        {/* Produktliste */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : products && products.length > 0 ? (
          <FlatList
            data={products}
            renderItem={renderProductItem}
            keyExtractor={(item) => item.id.toString()}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <IconSymbol name="cube.box.fill" size={64} color={colors.muted} />
            <Text className="text-lg text-muted mt-4 mb-2">Keine Produkte</Text>
            <Text className="text-sm text-muted text-center mb-6">
              Erstellen Sie Ihr erstes Produkt
            </Text>
            <TouchableOpacity
              className="bg-primary px-6 py-3 rounded-lg"
              activeOpacity={0.8}
              onPress={() => {
                setEditingProduct(null);
                setShowAddModal(true);
              }}
            >
              <Text className="text-background font-semibold">
                Produkt erstellen
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Add/Edit Product Modal */}
      <ProductFormModal
        visible={showAddModal}
        product={editingProduct}
        onClose={() => {
          setShowAddModal(false);
          setEditingProduct(null);
        }}
        onSuccess={() => refetch()}
      />
    </ScreenContainer>
  );
}

// Produkt-Formular-Modal
function ProductFormModal({
  visible,
  product,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  product: any;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const colors = useColors();
  const [formData, setFormData] = useState({
    type: product?.type || "product",
    name: product?.name || "",
    description: product?.description || "",
    unitPrice: product?.price ? String(product.price) : "",
    unit: product?.unit || "Stück",
    vatRate: product?.vat_rate ? Number(product.vat_rate).toFixed(2) : "8.10",
  });

  // Formular zurücksetzen wenn ein anderes Produkt ausgewählt wird
  useEffect(() => {
    if (visible) {
      setFormData({
        type: product?.type || "product",
        name: product?.name || "",
        description: product?.description || "",
        unitPrice: product?.price ? String(product.price) : "",
        unit: product?.unit || "Stück",
        vatRate: product?.vat_rate ? Number(product.vat_rate).toFixed(2) : "8.10",
      });
    }
  }, [visible, product?.id]);

  const createProduct = trpc.products.create.useMutation({
    onSuccess: () => {
      onSuccess?.();
      onClose();
    },
  });

  const updateProduct = trpc.products.update.useMutation({
    onSuccess: () => {
      console.log("[products] Update success!");
      onSuccess?.();
      onClose();
    },
    onError: (err) => {
      console.error("[products] Update error:", err.message);
      alert("Fehler beim Speichern: " + err.message);
    },
  });

  const handleSubmit = () => {
    if (!formData.name || !formData.unitPrice) {
      alert("Bitte füllen Sie mindestens Name und Preis aus");
      return;
    }

    console.log("[products] handleSubmit - product:", product?.id, "formData:", JSON.stringify(formData));

    if (product) {
      const payload = {
        id: product.id,
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.unitPrice) || 0,
        vatRate: isNaN(parseFloat(formData.vatRate)) ? 8.1 : parseFloat(formData.vatRate),
        unit: formData.unit,
        type: formData.type as "product" | "service",
      };
      console.log("[products] Sending update:", JSON.stringify(payload));
      updateProduct.mutate(payload);
    } else {
      createProduct.mutate({
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.unitPrice) || 0,
        vatRate: isNaN(parseFloat(formData.vatRate)) ? 8.1 : parseFloat(formData.vatRate),
        unit: formData.unit,
        type: formData.type as "product" | "service",
      });
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 justify-end">
        <View
          className="bg-background rounded-t-3xl"
          style={{ maxHeight: "90%" }}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between p-4 border-b border-border">
            <Text className="text-2xl font-bold text-foreground">
              {product ? "Produkt bearbeiten" : "Neues Produkt"}
            </Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Form */}
          <ScrollView className="p-4" showsVerticalScrollIndicator={false}>
            <View className="gap-4">
              {/* Typ */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Typ *
                </Text>
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    className={`flex-1 py-3 rounded-lg ${formData.type === "product"
                      ? "bg-primary"
                      : "bg-surface border border-border"
                      }`}
                    onPress={() => setFormData({ ...formData, type: "product" })}
                    activeOpacity={0.7}
                  >
                    <Text
                      className={`text-center font-semibold ${formData.type === "product"
                        ? "text-background"
                        : "text-foreground"
                        }`}
                    >
                      Artikel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className={`flex-1 py-3 rounded-lg ${formData.type === "service"
                      ? "bg-primary"
                      : "bg-surface border border-border"
                      }`}
                    onPress={() => setFormData({ ...formData, type: "service" })}
                    activeOpacity={0.7}
                  >
                    <Text
                      className={`text-center font-semibold ${formData.type === "service"
                        ? "text-background"
                        : "text-foreground"
                        }`}
                    >
                      Dienstleistung
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Name */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Name *
                </Text>
                <TextInput
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="z.B. Webdesign, Beratung, Produkt XY"
                  placeholderTextColor={colors.muted}
                  value={formData.name}
                  onChangeText={(text) =>
                    setFormData({ ...formData, name: text })
                  }
                />
              </View>

              {/* Beschreibung */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Beschreibung
                </Text>
                <TextInput
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="Optionale Beschreibung"
                  placeholderTextColor={colors.muted}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  value={formData.description}
                  onChangeText={(text) =>
                    setFormData({ ...formData, description: text })
                  }
                />
              </View>

              {/* Preis & Einheit */}
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground mb-2">
                    Preis (CHF) *
                  </Text>
                  <TextInput
                    className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                    placeholder="100.00"
                    placeholderTextColor={colors.muted}
                    keyboardType="decimal-pad"
                    value={formData.unitPrice}
                    onChangeText={(text) =>
                      setFormData({ ...formData, unitPrice: text })
                    }
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground mb-2">
                    Einheit
                  </Text>
                  <TextInput
                    className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                    placeholder="Stück, Stunden, kg"
                    placeholderTextColor={colors.muted}
                    value={formData.unit}
                    onChangeText={(text) =>
                      setFormData({ ...formData, unit: text })
                    }
                  />
                </View>
              </View>

              {/* MwSt-Satz */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  MwSt-Satz
                </Text>
                <View className="flex-row gap-2">
                  {[
                    { label: "8.1%", value: "8.10" },
                    { label: "2.6%", value: "2.60" },
                    { label: "0%", value: "0.00" },
                  ].map((rate) => (
                    <TouchableOpacity
                      key={rate.value}
                      className={`flex-1 py-3 rounded-lg ${formData.vatRate === rate.value
                        ? "bg-primary"
                        : "bg-surface border border-border"
                        }`}
                      onPress={() =>
                        setFormData({ ...formData, vatRate: rate.value })
                      }
                      activeOpacity={0.7}
                    >
                      <Text
                        className={`text-center font-semibold ${formData.vatRate === rate.value
                          ? "text-background"
                          : "text-foreground"
                          }`}
                      >
                        {rate.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Footer Buttons */}
          <View className="p-4 border-t border-border flex-row gap-3">
            <TouchableOpacity
              className="flex-1 bg-surface border border-border py-3 rounded-lg"
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text className="text-foreground font-semibold text-center">
                Abbrechen
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 bg-primary py-3 rounded-lg"
              onPress={handleSubmit}
              disabled={createProduct.isPending || updateProduct.isPending}
              activeOpacity={0.8}
            >
              {createProduct.isPending || updateProduct.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-background font-semibold text-center">
                  {product ? "Speichern" : "Erstellen"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

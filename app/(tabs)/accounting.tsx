import { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { InvoiceFormModal } from "@/components/invoice-form-modal-v2";

export default function AccountingScreen() {
  const colors = useColors();
  const [activeTab, setActiveTab] = useState<"overview" | "invoices" | "expenses">("overview");
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  return (
    <ScreenContainer>
      <ScrollView className="flex-1 p-4">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-3xl font-bold text-foreground">Buchhaltung</Text>
          <TouchableOpacity
            className="bg-primary w-12 h-12 rounded-full items-center justify-center"
            activeOpacity={0.8}
            onPress={() => setShowInvoiceModal(true)}
          >
            <IconSymbol name="plus.circle.fill" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Tab Navigation */}
        <View className="flex-row gap-2 mb-4">
          <TouchableOpacity
            className={`flex-1 py-3 rounded-lg ${
              activeTab === "overview" ? "bg-primary" : "bg-surface border border-border"
            }`}
            onPress={() => setActiveTab("overview")}
          >
            <Text
              className={`text-center font-semibold ${
                activeTab === "overview" ? "text-background" : "text-foreground"
              }`}
            >
              Übersicht
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 py-3 rounded-lg ${
              activeTab === "invoices" ? "bg-primary" : "bg-surface border border-border"
            }`}
            onPress={() => setActiveTab("invoices")}
          >
            <Text
              className={`text-center font-semibold ${
                activeTab === "invoices" ? "text-background" : "text-foreground"
              }`}
            >
              Rechnungen
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 py-3 rounded-lg ${
              activeTab === "expenses" ? "bg-primary" : "bg-surface border border-border"
            }`}
            onPress={() => setActiveTab("expenses")}
          >
            <Text
              className={`text-center font-semibold ${
                activeTab === "expenses" ? "text-background" : "text-foreground"
              }`}
            >
              Ausgaben
            </Text>
          </TouchableOpacity>
        </View>

        {/* Übersicht */}
        {activeTab === "overview" && (
          <View className="gap-4">
            {/* Statistik-Karten */}
            <View className="flex-row gap-3">
              <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
                <Text className="text-sm text-muted mb-1">Umsatz (Monat)</Text>
                <Text className="text-2xl font-bold text-success">CHF 0.00</Text>
              </View>
              <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
                <Text className="text-sm text-muted mb-1">Ausgaben</Text>
                <Text className="text-2xl font-bold text-error">CHF 0.00</Text>
              </View>
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
                <Text className="text-sm text-muted mb-1">Offene Posten</Text>
                <Text className="text-2xl font-bold text-warning">CHF 0.00</Text>
              </View>
              <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
                <Text className="text-sm text-muted mb-1">Gewinn</Text>
                <Text className="text-2xl font-bold text-primary">CHF 0.00</Text>
              </View>
            </View>

            {/* Schnellaktionen */}
            <View className="mt-4">
              <Text className="text-lg font-bold text-foreground mb-3">Schnellaktionen</Text>
              <View className="gap-3">
                <TouchableOpacity
                  className="bg-primary py-4 rounded-lg flex-row items-center justify-center"
                  activeOpacity={0.8}
                  onPress={() => setShowInvoiceModal(true)}
                >
                  <IconSymbol name="plus.circle.fill" size={20} color="#FFFFFF" />
                  <Text className="text-background font-semibold ml-2">Neue Rechnung</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="bg-surface py-4 rounded-lg flex-row items-center justify-center border border-border"
                  activeOpacity={0.8}
                >
                  <IconSymbol name="plus.circle.fill" size={20} color={colors.primary} />
                  <Text className="text-foreground font-semibold ml-2">Neue Ausgabe</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="bg-surface py-4 rounded-lg flex-row items-center justify-center border border-border"
                  activeOpacity={0.8}
                >
                  <IconSymbol name="doc.text.fill" size={20} color={colors.primary} />
                  <Text className="text-foreground font-semibold ml-2">Berichte anzeigen</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Rechnungen */}
        {activeTab === "invoices" && (
          <View className="flex-1 items-center justify-center py-12">
            <IconSymbol name="doc.text.fill" size={48} color={colors.muted} />
            <Text className="text-lg text-muted mt-4 mb-2">Keine Rechnungen</Text>
            <Text className="text-sm text-muted text-center mb-6">
              Erstellen Sie Ihre erste Rechnung
            </Text>
            <TouchableOpacity
              className="bg-primary px-6 py-3 rounded-lg"
              activeOpacity={0.8}
              onPress={() => setShowInvoiceModal(true)}
            >
              <Text className="text-background font-semibold">Rechnung erstellen</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Ausgaben */}
        {activeTab === "expenses" && (
          <View className="flex-1 items-center justify-center py-12">
            <IconSymbol name="chart.bar.fill" size={48} color={colors.muted} />
            <Text className="text-lg text-muted mt-4 mb-2">Keine Ausgaben</Text>
            <Text className="text-sm text-muted text-center mb-6">
              Erfassen Sie Ihre erste Ausgabe
            </Text>
            <TouchableOpacity
              className="bg-primary px-6 py-3 rounded-lg"
              activeOpacity={0.8}
            >
              <Text className="text-background font-semibold">Ausgabe erfassen</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Invoice Form Modal */}
      <InvoiceFormModal
        visible={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        onSuccess={() => {}}
      />
    </ScreenContainer>
  );
}

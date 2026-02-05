import { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/format";
import { InvoiceFormModal } from "@/components/invoice-form-modal-v2";
import { InvoicePreviewModal } from "@/components/invoice-preview-modal";

export default function AccountingScreen() {
  const colors = useColors();
  const [activeTab, setActiveTab] = useState<"overview" | "invoices" | "expenses">("overview");
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const { data: invoices, refetch } = trpc.invoices.list.useQuery();
  const deleteInvoice = trpc.invoices.delete.useMutation({
    onSuccess: () => refetch()
  });

  const handleDeleteInvoice = (id: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm("Rechnung wirklich löschen?")) {
        deleteInvoice.mutate({ id });
      }
    } else {
      Alert.alert("Löschen", "Rechnung wirklich löschen?", [
        { text: "Abbrechen", style: "cancel" },
        { text: "Löschen", style: "destructive", onPress: () => deleteInvoice.mutate({ id }) }
      ]);
    }
  };

  const handleEditInvoice = (invoice: any) => {
    setSelectedInvoice(invoice);
    setShowInvoiceModal(true);
  };

  const handleCloseModal = () => {
    setShowInvoiceModal(false);
    setSelectedInvoice(null);
  };

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
            className={`flex-1 py-3 rounded-lg ${activeTab === "overview" ? "bg-primary" : "bg-surface border border-border"
              }`}
            onPress={() => setActiveTab("overview")}
          >
            <Text
              className={`text-center font-semibold ${activeTab === "overview" ? "text-background" : "text-foreground"
                }`}
            >
              Übersicht
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 py-3 rounded-lg ${activeTab === "invoices" ? "bg-primary" : "bg-surface border border-border"
              }`}
            onPress={() => setActiveTab("invoices")}
          >
            <Text
              className={`text-center font-semibold ${activeTab === "invoices" ? "text-background" : "text-foreground"
                }`}
            >
              Rechnungen
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 py-3 rounded-lg ${activeTab === "expenses" ? "bg-primary" : "bg-surface border border-border"
              }`}
            onPress={() => setActiveTab("expenses")}
          >
            <Text
              className={`text-center font-semibold ${activeTab === "expenses" ? "text-background" : "text-foreground"
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
          <View>
            <View className="bg-surface rounded-xl p-4 mb-4">
              <Text className="text-sm text-muted mb-3">
                💡 Tipp: Rechnungen können als PDF heruntergeladen oder per E-Mail versendet werden.
              </Text>

              {/* Button für Beispiel-Rechnung erstmal entfernt/versteckt bis PDF Generator fertig ist */}
            </View>

            {invoices && invoices.length > 0 ? (
              invoices.map((invoice: any) => (
                <View
                  key={invoice.id}
                  className="bg-surface rounded-xl p-4 mb-3 border border-border"
                >
                  <View className="flex-row justify-between items-start mb-2">
                    <TouchableOpacity
                      className="flex-1"
                      activeOpacity={0.7}
                      onPress={() => handleEditInvoice(invoice)}
                    >
                      <View>
                        <Text className="text-lg font-semibold text-foreground">{invoice.invoiceNumber || "Entwurf"}</Text>
                        <Text className="text-sm text-muted">Kunde ID: {invoice.customerId}</Text>
                      </View>
                    </TouchableOpacity>
                    <View className={`px-3 py-1 rounded-full ${invoice.status === 'paid' ? 'bg-success/20' : 'bg-warning/20'}`}>
                      <Text className={`text-xs font-semibold ${invoice.status === 'paid' ? 'text-success' : 'text-warning'}`}>
                        {invoice.status === 'paid' ? 'Bezahlt' : 'Offen'}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row justify-between items-center mt-2">
                    <Text className="text-sm text-muted">{new Date(invoice.invoiceDate).toLocaleDateString()}</Text>
                    <Text className="text-lg font-bold text-foreground">{formatCurrency(invoice.totalGross || 0)}</Text>
                  </View>

                  <View className="flex-row gap-2 mt-3 pt-3 border-t border-border">
                    <TouchableOpacity
                      className="flex-1 bg-primary/10 py-2 rounded-lg flex-row items-center justify-center"
                      onPress={() => {
                        setSelectedInvoice(invoice);
                        setShowPreviewModal(true);
                      }}
                    >
                      <IconSymbol name="printer" size={16} color={colors.primary} />
                      <Text className="text-primary font-semibold ml-2">Vorschau</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      className="flex-1 bg-error/10 py-2 rounded-lg flex-row items-center justify-center"
                      onPress={() => handleDeleteInvoice(invoice.id)}
                    >
                      <IconSymbol name="trash" size={16} color={colors.error} />
                      <Text className="text-error font-semibold ml-2">Löschen</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
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
        onClose={handleCloseModal}
        onSuccess={() => refetch()}
        invoice={selectedInvoice}
      />

      {/* Invoice Preview Modal */}
      <InvoicePreviewModal
        visible={showPreviewModal}
        onClose={() => {
          setShowPreviewModal(false);
          setSelectedInvoice(null);
        }}
        invoice={selectedInvoice}
      />
    </ScreenContainer >
  );
}

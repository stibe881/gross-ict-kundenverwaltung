import { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Alert,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { InvoiceFormModal } from "@/components/invoice-form-modal-v2";
import { pdf } from "@react-pdf/renderer";
import { InvoicePDF } from "@/lib/invoice-pdf";

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
          <View>
            <View className="bg-surface rounded-xl p-4 mb-4">
              <Text className="text-sm text-muted mb-3">
                💡 Tipp: Rechnungen können als PDF heruntergeladen oder per E-Mail versendet werden.
              </Text>
              <TouchableOpacity
                className="bg-primary py-3 rounded-lg flex-row items-center justify-center"
                activeOpacity={0.8}
                onPress={async () => {
                  try {
                    // Erstelle Beispiel-Rechnung als PDF
                    const invoiceData = {
                      invoice_number: "RE-2026-001",
                      invoice_date: new Date().toISOString(),
                      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                      customer_name: "Muster AG",
                      customer_address: "Musterstrasse 123",
                      customer_city: "Zürich",
                      customer_zip: "8000",
                      items: [
                        {
                          description: "Webseiten-Entwicklung",
                          quantity: 40,
                          unit_price: 120,
                          vat_rate: 8.1,
                        },
                        {
                          description: "Hosting (12 Monate)",
                          quantity: 1,
                          unit_price: 600,
                          vat_rate: 8.1,
                        },
                      ],
                      notes: "Zahlbar innert 30 Tagen netto. Vielen Dank für Ihr Vertrauen!",
                    };

                    // Generiere PDF
                    const blob = await pdf(<InvoicePDF data={invoiceData} />).toBlob();
                    
                    // Download PDF
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `Rechnung-${invoiceData.invoice_number}.pdf`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);

                    Alert.alert("Erfolg", "Rechnung wurde als PDF heruntergeladen");
                  } catch (error) {
                    console.error("PDF-Fehler:", error);
                    Alert.alert("Fehler", "PDF-Generierung fehlgeschlagen");
                  }
                }}>
                <IconSymbol name="arrow.down.doc.fill" size={20} color="#FFFFFF" />
                <Text className="text-background font-semibold ml-2">Rechnung als PDF herunterladen</Text>
              </TouchableOpacity>

              {/* HTML-Version (Fallback) */}
              <TouchableOpacity
                className="bg-muted px-4 py-3 rounded-lg flex-row items-center justify-center"
                activeOpacity={0.8}
                onPress={async () => {
                  try {
                    // Erstelle Beispiel-Rechnung als HTML (Fallback)
                    const htmlContent = `
                      <!DOCTYPE html>
                      <html>
                      <head>
                        <meta charset="UTF-8">
                        <title>Rechnung RE-2026-001</title>
                        <style>
                          body { font-family: Arial, sans-serif; margin: 40px; }
                          .header { text-align: right; margin-bottom: 40px; }
                          .invoice-title { font-size: 24px; font-weight: bold; margin-bottom: 20px; }
                          .info { margin-bottom: 30px; }
                          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
                          th { background-color: #f5f5f5; }
                          .total { font-weight: bold; font-size: 18px; text-align: right; margin-top: 20px; }
                        </style>
                      </head>
                      <body>
                        <div class="header">
                          <strong>Gross ICT</strong><br>
                          Musterstrasse 123<br>
                          8000 Zürich<br>
                          Schweiz
                        </div>
                        <div class="invoice-title">Rechnung RE-2026-001</div>
                        <div class="info">
                          <strong>Kunde:</strong><br>
                          Muster AG<br>
                          Beispielweg 456<br>
                          9000 St. Gallen
                        </div>
                        <div class="info">
                          <strong>Rechnungsdatum:</strong> 04.02.2026<br>
                          <strong>Fällig am:</strong> 04.03.2026
                        </div>
                        <table>
                          <thead>
                            <tr>
                              <th>Position</th>
                              <th>Menge</th>
                              <th>Einzelpreis</th>
                              <th>Gesamt</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td>IT-Support Paket</td>
                              <td>1</td>
                              <td>CHF 500.00</td>
                              <td>CHF 500.00</td>
                            </tr>
                            <tr>
                              <td>Server-Wartung</td>
                              <td>2</td>
                              <td>CHF 250.00</td>
                              <td>CHF 500.00</td>
                            </tr>
                          </tbody>
                        </table>
                        <div class="total">
                          Gesamtbetrag: CHF 1'000.00
                        </div>
                      </body>
                      </html>
                    `;

                    // Erstelle Blob und Download-Link
                    const blob = new Blob([htmlContent], { type: 'text/html' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = 'Rechnung-RE-2026-001.html';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);

                    Alert.alert("Erfolg", "Beispiel-Rechnung wurde heruntergeladen");
                  } catch (error) {
                    Alert.alert("Fehler", "Download fehlgeschlagen");
                  }
                }}
              >
                <IconSymbol name="arrow.down.doc.fill" size={20} color="#FFFFFF" />
                <Text className="text-background font-semibold ml-2">Beispiel-Rechnung herunterladen</Text>
              </TouchableOpacity>
            </View>

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

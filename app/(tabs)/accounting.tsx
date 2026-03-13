import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  Platform,
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { InvoiceFormModal } from "@/components/invoice-form-modal-v2";
import { ExpenseFormModal } from "@/components/expense-form-modal";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { ImageViewerModal } from "@/components/image-viewer-modal";
import { formatCurrency, formatDate, getInvoiceTotal } from "@/lib/format";
import { router as expoRouter } from "expo-router";
import { showConfirm, showAlert } from "@/lib/alert";
import { downloadAnnualReportPDF } from "@/lib/pdf-annual-report";
import { exportAnnualZIP } from "@/lib/export-annual-report";
import { generateQuittungBase64 } from "@/lib/pdf-quittung";
import { ScenarioBookingModal } from "@/components/scenario-booking-modal";
import * as FileSystem from "expo-file-system/legacy";

type TabKey =
  | "overview"
  | "invoices"
  | "expenses"
  | "vat"
  | "annual"
  | "documents";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "overview", label: "Übersicht", icon: "chart.pie.fill" },
  { key: "invoices", label: "Rechnungen", icon: "doc.text.fill" },
  { key: "expenses", label: "Ausgaben", icon: "cart.fill" },
  { key: "annual", label: "Jahresabschluss", icon: "calendar" },
  { key: "vat", label: "MwSt", icon: "percent" },
  { key: "documents", label: "Dokumente", icon: "folder.fill" },
];

export default function AccountingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colors = useColors();
  const { isWide, containerStyle, contentPadding } = useResponsiveLayout();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);

  // Scanned Receipt Data
  const [scannedReceipt, setScannedReceipt] = useState<{
    uri: string;
    name: string;
    type: string;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isYearClosed, setIsYearClosed] = useState(false);
  const [exportProgress, setExportProgress] = useState<string>("");
  const [showScenarioModal, setShowScenarioModal] = useState(false);

  // Scenario Calculator State
  const [scenarioVolume, setScenarioVolume] = useState("10000");
  const [scenarioExecutor, setScenarioExecutor] = useState<
    "inhaber" | "angestellter"
  >("angestellter");

  const {
    data: invoices,
    isLoading: loadingInvoices,
    refetch: refetchInvoices,
  } = useQuery({
    queryKey: ["invoices"],
    queryFn: Data.getAllInvoices,
  });

  const {
    data: expenses,
    isLoading: loadingExpenses,
    refetch: refetchExpenses,
  } = useQuery({
    queryKey: ["expenses"],
    queryFn: Data.getAllExpenses,
  });

  // Fetch Year Status
  useEffect(() => {
    Data.getAccountingYear(selectedYear).then(res => {
      setIsYearClosed(!!res?.is_closed);
    });
  }, [selectedYear]);

  // Handle incoming AI scan intent
  useEffect(() => {
    if (params.action === "scan" && params.uri) {
      // Decode URI params
      const uri = Array.isArray(params.uri) ? params.uri[0] : params.uri;
      const name = Array.isArray(params.name)
        ? params.name[0]
        : params.name || `Beleg_${Date.now()}.jpg`;
      const type = Array.isArray(params.type)
        ? params.type[0]
        : params.type || "image/jpeg";

      setScannedReceipt({
        uri: decodeURIComponent(uri),
        name: decodeURIComponent(name),
        type: decodeURIComponent(type),
      });
      setActiveTab("expenses");
      setEditingExpense(null);
      setShowExpenseModal(true);

      // Clear the url params so it doesn't re-trigger on unmount/remount
      router.setParams({
        action: undefined,
        uri: undefined,
        name: undefined,
        type: undefined,
      });
    }
  }, [params]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchInvoices(), refetchExpenses()]);
    setRefreshing(false);
  }, [refetchInvoices, refetchExpenses]);

  // Filter by year
  const yearInvoices = useMemo(
    () =>
      invoices?.filter(
        (i: any) => new Date(i.invoice_date).getFullYear() === selectedYear,
      ) || [],
    [invoices, selectedYear],
  );

  const yearExpenses = useMemo(
    () =>
      expenses?.filter(
        (e: any) => new Date(e.expense_date).getFullYear() === selectedYear,
      ) || [],
    [expenses, selectedYear],
  );

  // Stats
  const totalRevenue = yearInvoices.reduce((s: number, i: any) => {
    if (i.paid_amount && i.paid_amount > 0) return s + i.paid_amount;
    if (i.status === "paid") return s + getInvoiceTotal(i);
    return s;
  }, 0);

  const totalOpen = yearInvoices
    .filter((i: any) => i.status === "open")
    .reduce((s: number, i: any) => {
      return s + Math.max(0, getInvoiceTotal(i) - (i.paid_amount || 0));
    }, 0);

  const totalOverdue = yearInvoices
    .filter((i: any) => i.status === "overdue")
    .reduce((s: number, i: any) => {
      return s + Math.max(0, getInvoiceTotal(i) - (i.paid_amount || 0));
    }, 0);
  const totalExpenses = yearExpenses.reduce(
    (s: number, e: any) => s + (e.amount || 0),
    0,
  );
  const deductibleExpenses = yearExpenses
    .filter((e: any) => e.is_deductible)
    .reduce((s: number, e: any) => s + (e.amount || 0), 0);
  const profit = totalRevenue - totalExpenses;

  // Umsatz-Schwelle MwSt (CHF 100'000)
  const MWST_THRESHOLD = 100000;
  const totalAllRevenue = yearInvoices.reduce(
    (s: number, i: any) => s + getInvoiceTotal(i),
    0,
  );
  const revenuePercent = Math.min(
    (totalAllRevenue / MWST_THRESHOLD) * 100,
    100,
  );

  // Expenses by category
  const expensesByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    yearExpenses.forEach((e: any) => {
      map[e.category] = (map[e.category] || 0) + (e.amount || 0);
    });
    return Object.entries(map)
      .map(([cat, amount]) => ({
        category: cat,
        label:
          Data.EXPENSE_CATEGORIES.find((c) => c.value === cat)?.label || cat,
        amount,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [yearExpenses]);

  // Umsatz by month
  const revenueByMonth = useMemo(() => {
    const months = [
      "Jan",
      "Feb",
      "Mär",
      "Apr",
      "Mai",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Okt",
      "Nov",
      "Dez",
    ];
    return months.map((label, idx) => {
      const rev = yearInvoices
        .filter(
          (i: any) =>
            i.status === "paid" && new Date(i.invoice_date).getMonth() === idx,
        )
        .reduce((s: number, i: any) => s + getInvoiceTotal(i), 0);
      const exp = yearExpenses
        .filter((e: any) => new Date(e.expense_date).getMonth() === idx)
        .reduce((s: number, e: any) => s + (e.amount || 0), 0);
      return { label, revenue: rev, expenses: exp };
    });
  }, [yearInvoices, yearExpenses]);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "open":
        return "Offen";
      case "paid":
        return "Bezahlt";
      case "overdue":
        return "Überfällig";
      case "cancelled":
        return "Storniert";
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-warning";
      case "paid":
        return "bg-success";
      case "overdue":
        return "bg-error";
      case "cancelled":
        return "bg-muted";
      default:
        return "bg-muted";
    }
  };

  const handleDeleteExpense = (expense: any) => {
    if (isYearClosed) {
      showAlert("Gesperrt", "Dieses Jahr ist bereits abgeschlossen.");
      return;
    }
    showConfirm(
      "Ausgabe löschen",
      `"${expense.description}" wirklich löschen?`,
      async () => {
        try {
          await Data.deleteExpense(expense.id);
          refetchExpenses();
        } catch (err: any) {
          Alert.alert("Fehler", err.message);
        }
      },
      "Löschen",
    );
  };

  const handleCloseYear = () => {
    showConfirm(
      "Jahr abschliessen",
      `Möchten Sie das Jahr ${selectedYear} wirklich abschliessen? Alle Buchungen (Rechnungen & Ausgaben) werden schreibgeschützt und können nicht mehr verändert werden.`,
      async () => {
        try {
          await Data.closeAccountingYear(selectedYear);
          setIsYearClosed(true);
          showAlert("Erfolg", `Das Jahr ${selectedYear} wurde erfolgreich abgeschlossen und archiviert.`);
        } catch (err: any) {
          showAlert("Fehler", err.message);
        }
      },
      "Abschliessen",
    );
  };

  const handleSubmitScenarioBooking = async (data: any) => {
    const vol = parseFloat(scenarioVolume) || 0;
    const lohn = vol * 0.7;

    // Verbuchen im aktuell ausgewählten Jahr
    const bookingDate = new Date();
    bookingDate.setFullYear(selectedYear);
    
    // Falls das Jahr in der Zukunft liegt oder heute im aktuellen Jahr ist, nimm das heutige Datum (angepasst ans Jahr).
    // Wenn das Jahr in der Vergangenheit liegt, nimm den 31.12. des Jahres.
    if (selectedYear < new Date().getFullYear()) {
         bookingDate.setMonth(11, 31); // 31. Dez
    }

    const base64 = await generateQuittungBase64({
        freelancerName: data.freelancerName,
        freelancerAddress: data.freelancerAddress,
        freelancerIban: data.freelancerIban,
        projectDescription: `Erbrachte Leistungen für das Projekt - ${data.customerName} - ${data.projectName}`,
        amount: lohn,
        date: bookingDate.toISOString()
    });

    let uri = `data:application/pdf;base64,${base64}`;
    if (Platform.OS !== "web") {
        const filePath = `${FileSystem.cacheDirectory}Quittung_${Date.now()}.pdf`;
        await FileSystem.writeAsStringAsync(filePath, base64, { encoding: FileSystem.EncodingType.Base64 });
        uri = filePath;
    }

    const receiptFile = {
        uri,
        name: `Abrechnung_${data.freelancerName.replace(/ /g, '_')}.pdf`,
        type: "application/pdf"
    };

    const uploadRes = await Data.uploadExpenseReceipt(receiptFile);

    const payload: any = {
        date: bookingDate.toISOString().slice(0, 10),
        amount: lohn,
        description: `Leistungsbezug: ${data.freelancerName}`,
        category: "salary",
        supplier: data.freelancerName,
        payment_method: "bank",
        tax_rate: 0,
        is_deductible: true,
        notes: `Automatische Verbuchung aus Szenario-Modell.\nIBAN: ${data.freelancerIban}\nKunde: ${data.customerId}\nProjekt: ${data.projectId}`,
        receipt_path: uploadRes.filePath,
        receipt_url: uploadRes.publicUrl
    };

    await Data.createExpense(payload);
    await refetchExpenses();
    setShowScenarioModal(false);
    showAlert("Erfolg", "Leistung erfolgreich verbucht und Beleg hochgeladen.");
  };

  const getCategoryIcon = (cat: string) => {
    const icons: Record<string, string> = {
      material: "shippingbox.fill",
      software: "desktopcomputer",
      office: "building.2.fill",
      vehicle: "car.fill",
      insurance: "shield.fill",
      telecom: "phone.fill",
      travel: "airplane",
      education: "book.fill",
      marketing: "megaphone.fill",
      accounting: "doc.text.fill",
      equipment: "wrench.and.screwdriver.fill",
      salary: "dollarsign.circle.fill",
      other: "ellipsis.circle.fill",
    };
    return icons[cat] || "ellipsis.circle.fill";
  };

  const renderYearSelector = () => (
    <View className="flex-row items-center justify-center gap-4 mb-4">
      <TouchableOpacity
        onPress={() => setSelectedYear(selectedYear - 1)}
        activeOpacity={0.7}
      >
        <IconSymbol name="chevron.left" size={20} color={colors.primary} />
      </TouchableOpacity>
      <Text className="text-lg font-bold text-foreground">{selectedYear}</Text>
      <TouchableOpacity
        onPress={() => setSelectedYear(selectedYear + 1)}
        activeOpacity={0.7}
      >
        <IconSymbol name="chevron.right" size={20} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );

  const renderOverview = () => (
    <View className="gap-4">
      {renderYearSelector()}

      {/* Gewinn/Verlust Hero */}
      <View
        className="rounded-xl p-5 border border-border"
        style={{
          backgroundColor:
            profit >= 0 ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
        }}
      >
        <Text className="text-sm text-muted mb-1">
          Gewinn / Verlust ({selectedYear})
        </Text>
        <Text
          className="text-3xl font-bold"
          style={{ color: profit >= 0 ? "#22c55e" : "#ef4444" }}
        >
          {formatCurrency(profit)}
        </Text>
        <View className="flex-row mt-3 gap-6">
          <View>
            <Text className="text-xs text-muted">Einnahmen</Text>
            <Text className="text-sm font-semibold text-success">
              {formatCurrency(totalRevenue)}
            </Text>
          </View>
          <View>
            <Text className="text-xs text-muted">Ausgaben</Text>
            <Text className="text-sm font-semibold text-error">
              {formatCurrency(totalExpenses)}
            </Text>
          </View>
        </View>
      </View>

      {/* Quick Stats */}
      <View className="flex-row gap-3">
        <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
          <Text className="text-xs text-muted mb-1">Offene Posten</Text>
          <Text className="text-xl font-bold text-warning">
            {formatCurrency(totalOpen)}
          </Text>
        </View>
        <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
          <Text className="text-xs text-muted mb-1">Überfällig</Text>
          <Text className="text-xl font-bold text-error">
            {formatCurrency(totalOverdue)}
          </Text>
        </View>
      </View>

      <View className="flex-row gap-3">
        <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
          <Text className="text-xs text-muted mb-1">Rechnungen</Text>
          <Text className="text-xl font-bold text-foreground">
            {yearInvoices.length}
          </Text>
        </View>
        <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
          <Text className="text-xs text-muted mb-1">Abzugsfähig</Text>
          <Text className="text-xl font-bold text-primary">
            {formatCurrency(deductibleExpenses)}
          </Text>
        </View>
      </View>

      {/* Ausgaben nach Kategorie */}
      {expensesByCategory.length > 0 && (
        <View className="bg-surface rounded-xl p-4 border border-border">
          <Text className="text-sm font-bold text-foreground mb-3">
            Ausgaben nach Kategorie
          </Text>
          {expensesByCategory.map((cat) => (
            <View
              key={cat.category}
              className="flex-row items-center justify-between py-2 border-b border-border"
            >
              <View className="flex-row items-center gap-2 flex-1">
                <IconSymbol
                  name={getCategoryIcon(cat.category) as any}
                  size={16}
                  color={colors.primary}
                />
                <Text className="text-sm text-foreground" numberOfLines={1}>
                  {cat.label}
                </Text>
              </View>
              <Text className="text-sm font-semibold text-foreground">
                {formatCurrency(cat.amount)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const renderInvoices = () => (
    <View>
      {loadingInvoices ? (
        <View className="flex-1 items-center justify-center py-12">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : invoices && invoices.length > 0 ? (
        <View className="gap-3">
          <TouchableOpacity
            className={`py-3 rounded-lg flex-row items-center justify-center mb-2 ${isYearClosed ? "bg-muted" : "bg-primary"}`}
            activeOpacity={0.8}
            onPress={() => {
              if (isYearClosed) {
                showAlert("Gesperrt", "Dieses Jahr ist bereits abgeschlossen und kann nicht mehr verändert werden.");
                return;
              }
              setShowInvoiceModal(true);
            }}
          >
            <IconSymbol name="plus.circle.fill" size={20} color="#FFFFFF" />
            <Text className="text-background font-semibold ml-2">
              Neue Rechnung
            </Text>
          </TouchableOpacity>

          {invoices.map((invoice: any) => {
            const customerName =
              invoice.customer?.company_name ||
              `${invoice.customer?.first_name || ""} ${invoice.customer?.last_name || ""}`.trim() ||
              "Unbekannt";
            return (
              <TouchableOpacity
                key={invoice.id}
                className="bg-surface rounded-xl p-4 border border-border"
                activeOpacity={0.7}
                onPress={() => {
                    if (isYearClosed) {
                        showAlert("Hinweis", "Dieses Jahr ist abgeschlossen (Nur-Lese-Modus).");
                        // We still push to view it, but usually the invoice view might need to know about lock state. 
                        // For now, allow viewing.
                    }
                    expoRouter.push(`/invoice/${invoice.id}` as any);
                }}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-base font-bold text-foreground">
                    {invoice.invoice_number}
                  </Text>
                  <View
                    className={`px-3 py-1 rounded-full ${getStatusColor(invoice.status)}`}
                  >
                    <Text className="text-xs font-semibold text-white">
                      {getStatusLabel(invoice.status)}
                    </Text>
                  </View>
                </View>
                <Text className="text-sm text-foreground mb-1">
                  {customerName}
                </Text>
                <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-border">
                  <Text className="text-xs text-muted">
                    {formatDate(invoice.invoice_date)} · Fällig:{" "}
                    {formatDate(invoice.due_date)}
                  </Text>
                  <Text className="text-base font-bold text-primary">
                    {formatCurrency(getInvoiceTotal(invoice))}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <View className="flex-1 items-center justify-center py-12">
          <IconSymbol name="doc.text.fill" size={48} color={colors.muted} />
          <Text className="text-lg text-muted mt-4 mb-2">Keine Rechnungen</Text>
          <TouchableOpacity
            className="bg-primary px-6 py-3 rounded-lg"
            activeOpacity={0.8}
            onPress={() => setShowInvoiceModal(true)}
          >
            <Text className="text-background font-semibold">
              Rechnung erstellen
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderExpenses = () => (
    <View>
      {loadingExpenses ? (
        <View className="flex-1 items-center justify-center py-12">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View className="gap-3">
          <TouchableOpacity
            className={`py-3 rounded-lg flex-row items-center justify-center mb-2 ${isYearClosed ? "bg-muted" : "bg-primary"}`}
            activeOpacity={0.8}
            onPress={() => {
              if (isYearClosed) {
                 showAlert("Gesperrt", "Dieses Jahr ist bereits abgeschlossen.");
                 return;
              }
              setEditingExpense(null);
              setShowExpenseModal(true);
            }}
          >
            <IconSymbol name="plus.circle.fill" size={20} color="#FFFFFF" />
            <Text className="text-background font-semibold ml-2">
              Neue Ausgabe
            </Text>
          </TouchableOpacity>

          {yearExpenses.length > 0 ? (
            <>
              {/* Summe */}
              <View className="bg-surface rounded-xl p-4 border border-border flex-row justify-between items-center">
                <Text className="text-sm text-muted">
                  Total Ausgaben ({selectedYear})
                </Text>
                <Text className="text-lg font-bold text-error">
                  {formatCurrency(totalExpenses)}
                </Text>
              </View>

              {renderYearSelector()}

              {yearExpenses.map((expense: any) => (
                <TouchableOpacity
                  key={expense.id}
                  className="bg-surface rounded-xl p-4 border border-border"
                  activeOpacity={0.7}
                  onPress={() => {
                    if (isYearClosed) {
                       showAlert("Gesperrt", "Dieses Jahr ist bereits abgeschlossen und kann nicht bearbeitet werden.");
                       return;
                    }
                    setEditingExpense(expense);
                    setShowExpenseModal(true);
                  }}
                  onLongPress={() => handleDeleteExpense(expense)}
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center gap-2 flex-1">
                      <View className="w-8 h-8 rounded-lg bg-error/20 items-center justify-center">
                        <IconSymbol
                          name={getCategoryIcon(expense.category) as any}
                          size={14}
                          color={colors.error || "#ef4444"}
                        />
                      </View>
                      <View className="flex-1">
                        <View className="flex-row items-center gap-1">
                          <Text
                            className="text-sm font-semibold text-foreground"
                            numberOfLines={1}
                          >
                            {expense.description}
                          </Text>
                          {expense.receipt_url && (
                            <IconSymbol
                              name="paperclip"
                              size={14}
                              color={colors.primary}
                            />
                          )}
                        </View>
                        <Text className="text-xs text-muted">
                          {Data.EXPENSE_CATEGORIES.find(
                            (c) => c.value === expense.category,
                          )?.label || expense.category}
                          {expense.supplier ? ` · ${expense.supplier}` : ""}
                        </Text>
                      </View>
                    </View>
                    <View className="items-end">
                      <Text className="text-base font-bold text-error">
                        -{formatCurrency(expense.amount)}
                      </Text>
                      <Text className="text-xs text-muted">
                        {formatDate(expense.expense_date)}
                      </Text>
                    </View>
                  </View>
                  {expense.tax_amount > 0 && (
                    <Text className="text-xs text-muted mt-1">
                      Vorsteuer: {formatCurrency(expense.tax_amount)} (
                      {expense.tax_rate}%)
                      {expense.is_deductible ? " · Abzugsfähig" : ""}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </>
          ) : (
            <View className="items-center justify-center py-12">
              <IconSymbol name="cart.fill" size={48} color={colors.muted} />
              <Text className="text-lg text-muted mt-4 mb-2">
                Keine Ausgaben
              </Text>
              <Text className="text-sm text-muted text-center mb-4">
                Erfassen Sie Geschäftsausgaben für die Steuererklärung
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );

  const renderVat = () => (
    <View className="gap-4">
      {renderYearSelector()}

      {/* MwSt-Status */}
      <View
        className="bg-surface rounded-xl p-5 border border-border"
        style={{ borderColor: "#22c55e" }}
      >
        <View className="flex-row items-center gap-2 mb-3">
          <View
            className="w-8 h-8 rounded-full items-center justify-center"
            style={{ backgroundColor: "rgba(34,197,94,0.15)" }}
          >
            <IconSymbol
              name="checkmark.shield.fill"
              size={16}
              color="#22c55e"
            />
          </View>
          <Text className="text-base font-bold text-foreground">
            MwSt-befreit
          </Text>
        </View>
        <Text className="text-sm text-muted leading-5">
          Ihre Einzelfirma ist von der MwSt befreit, da der Jahresumsatz unter
          CHF 100'000 liegt. Sie stellen Rechnungen ohne MwSt und weisen keine
          Steuer aus.
        </Text>
      </View>

      {/* Umsatz-Fortschritt */}
      <View className="bg-surface rounded-xl p-5 border border-border">
        <Text className="text-sm font-bold text-foreground mb-2">
          Umsatz-Schwelle {selectedYear}
        </Text>
        <Text className="text-xs text-muted mb-3">
          Ab CHF 100'000 Jahresumsatz wird die MwSt-Registrierung obligatorisch.
        </Text>

        <View className="flex-row items-end justify-between mb-2">
          <Text className="text-2xl font-bold text-foreground">
            {formatCurrency(totalAllRevenue)}
          </Text>
          <Text className="text-sm text-muted">
            / {formatCurrency(MWST_THRESHOLD)}
          </Text>
        </View>

        {/* Progress bar */}
        <View
          className="h-3 rounded-full overflow-hidden"
          style={{ backgroundColor: colors.border }}
        >
          <View
            className="h-3 rounded-full"
            style={{
              width: `${revenuePercent}%`,
              backgroundColor: revenuePercent > 80 ? "#f59e0b" : "#22c55e",
            }}
          />
        </View>
        <Text className="text-xs text-muted mt-2">
          {revenuePercent.toFixed(1)}% der Schwelle erreicht · Noch{" "}
          {formatCurrency(Math.max(0, MWST_THRESHOLD - totalAllRevenue))} bis
          zur MwSt-Pflicht
        </Text>
      </View>

      {/* Monatsübersicht */}
      <View className="bg-surface rounded-xl p-4 border border-border">
        <Text className="text-sm font-bold text-foreground mb-3">
          Umsatz nach Monat
        </Text>
        {revenueByMonth.map((m) => (
          <View
            key={m.label}
            className="flex-row items-center justify-between py-2 border-b border-border"
          >
            <Text className="text-xs text-muted w-10">{m.label}</Text>
            <View
              className="flex-1 mx-3 h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: colors.border }}
            >
              <View
                className="h-2 rounded-full"
                style={{
                  width: `${totalAllRevenue > 0 ? (m.revenue / totalAllRevenue) * 100 : 0}%`,
                  backgroundColor: colors.primary,
                  minWidth: m.revenue > 0 ? 4 : 0,
                }}
              />
            </View>
            <Text className="text-xs font-semibold text-foreground w-20 text-right">
              {m.revenue > 0 ? formatCurrency(m.revenue) : "–"}
            </Text>
          </View>
        ))}
      </View>

      {/* Info */}
      <View className="bg-surface rounded-xl p-4 border border-border">
        <Text className="text-xs text-muted leading-5">
          ℹ️ Als nicht MwSt-pflichtige Einzelfirma dürfen Sie keine MwSt auf
          Ihren Rechnungen ausweisen. Sobald Ihr Jahresumsatz CHF 100'000
          übersteigt, müssen Sie sich innerhalb von 30 Tagen bei der ESTV
          anmelden.
        </Text>
      </View>
    </View>
  );

  const renderAnnual = () => {
    const allRevenue = yearInvoices.reduce(
      (s: number, i: any) => s + getInvoiceTotal(i),
      0,
    );
    const paidRevenue = totalRevenue;

    // --- Lohn & Sachaufwand ---
    const salaryExpense = yearExpenses
      .filter((e: any) => e.category === "salary")
      .reduce((s: number, e: any) => s + (e.amount || 0), 0);
    const sachaufwand = totalExpenses - salaryExpense;

    const agBeitrage = salaryExpense * 0.064; // 6.4% AG-Beiträge
    const uvgPremie = salaryExpense * 0.01; // 1.0% UVG

    const totalTrueExpenses =
      sachaufwand + salaryExpense + agBeitrage + uvgPremie;
    const trueProfit = paidRevenue - totalTrueExpenses;

    const anBeitrageUndQuellensteuer = salaryExpense * 0.15; // ca 15% Einbehaltene Quellensteuer & AN-Beiträge

    const summaryText = [
      `JAHRESABSCHLUSS ${selectedYear}`,
      `Gross ICT — Einzelfirma, Kanton Luzern`,
      ``,
      `EINNAHMEN`,
      `Rechnungen total: ${formatCurrency(allRevenue)}`,
      `Davon bezahlt: ${formatCurrency(paidRevenue)}`,
      `Davon offen: ${formatCurrency(totalOpen)}`,
      ``,
      `AUSGABEN (SACHAUFWAND)`,
      ...expensesByCategory
        .filter((c) => c.category !== "salary")
        .map((c) => `${c.label}: ${formatCurrency(c.amount)}`),
      `Sachaufwand Total: ${formatCurrency(sachaufwand)}`,
      ``,
      `PERSONALAUFWAND`,
      `Lohnaufwand (Brutto): ${formatCurrency(salaryExpense)}`,
      `AG-Beiträge (ca. 6.4%): ${formatCurrency(agBeitrage)}`,
      `UVG-Prämie (ca. 1.0%): ${formatCurrency(uvgPremie)}`,
      `Personal Total: ${formatCurrency(salaryExpense + agBeitrage + uvgPremie)}`,
      ``,
      `ERGEBNIS`,
      `Total Ausgaben: ${formatCurrency(totalTrueExpenses)}`,
      `Gewinn vor Steuern: ${formatCurrency(trueProfit)}`,
      ``,
      `MWST-STATUS: Befreit (Umsatz unter CHF 100'000)`,
    ].join("\n");

    return (
      <View className="gap-4">
        {renderYearSelector()}

        <View className="bg-surface rounded-xl p-5 border border-border">
          <Text className="text-base font-bold text-foreground mb-1">
            Jahresabschluss {selectedYear}
          </Text>
          <Text className="text-xs text-muted mb-4">
            Einzelfirma · Kanton Luzern
          </Text>

          {/* Einnahmen */}
          <Text className="text-xs text-muted uppercase tracking-wider mb-2 mt-2">
            Einnahmen
          </Text>
          <View className="flex-row justify-between py-2 border-b border-border">
            <Text className="text-sm text-foreground">
              Rechnungen (bezahlt)
            </Text>
            <Text className="text-sm font-semibold text-success">
              {formatCurrency(paidRevenue)}
            </Text>
          </View>
          <View className="flex-row justify-between py-2 border-b border-border">
            <Text className="text-sm text-foreground">Offene Forderungen</Text>
            <Text className="text-sm text-warning">
              {formatCurrency(totalOpen)}
            </Text>
          </View>

          {/* Sachaufwand */}
          <Text className="text-xs text-muted uppercase tracking-wider mb-2 mt-4">
            Sachaufwand
          </Text>
          {expensesByCategory
            .filter((c) => c.category !== "salary")
            .map((cat) => (
              <View
                key={cat.category}
                className="flex-row justify-between py-2 border-b border-border"
              >
                <Text className="text-sm text-foreground">{cat.label}</Text>
                <Text className="text-sm text-error">
                  {formatCurrency(cat.amount)}
                </Text>
              </View>
            ))}
          <View className="flex-row justify-between py-2 border-b border-border">
            <Text className="text-sm font-semibold text-foreground">
              Sachaufwand Total
            </Text>
            <Text className="text-sm font-semibold text-error">
              {formatCurrency(sachaufwand)}
            </Text>
          </View>

          {/* Personalaufwand */}
          <Text className="text-xs text-muted uppercase tracking-wider mb-2 mt-4">
            Personalaufwand
          </Text>
          <View className="flex-row justify-between py-2 border-b border-border">
            <Text className="text-sm text-foreground">
              Lohnaufwand (Brutto)
            </Text>
            <Text className="text-sm text-error">
              {formatCurrency(salaryExpense)}
            </Text>
          </View>
          <View className="flex-row justify-between py-2 border-b border-border">
            <Text className="text-sm text-foreground">
              AG-Beiträge Sozialvers. (ca. 6.4%)
            </Text>
            <Text className="text-sm text-error">
              {formatCurrency(agBeitrage)}
            </Text>
          </View>
          <View className="flex-row justify-between py-2 border-b border-border">
            <Text className="text-sm text-foreground">
              UVG-Prämie (ca. 1.0%)
            </Text>
            <Text className="text-sm text-error">
              {formatCurrency(uvgPremie)}
            </Text>
          </View>
          <View className="flex-row justify-between py-2 border-b border-border">
            <Text className="text-sm font-semibold text-foreground">
              Personalaufwand Total
            </Text>
            <Text className="text-sm font-semibold text-error">
              {formatCurrency(salaryExpense + agBeitrage + uvgPremie)}
            </Text>
          </View>

          <View className="flex-row justify-between py-2 border-b border-border mt-2">
            <Text className="text-sm font-bold text-foreground">
              Total Ausgaben (Sach- & Personalaufwand)
            </Text>
            <Text className="text-sm font-bold text-error">
              {formatCurrency(totalTrueExpenses)}
            </Text>
          </View>

          {/* Ergebnis */}
          <Text className="text-xs text-muted uppercase tracking-wider mb-2 mt-4">
            Ergebnis
          </Text>
          <View className="flex-row justify-between py-3 border-b border-border">
            <Text className="text-base font-bold text-foreground">
              Gewinn vor Steuern / Marge
            </Text>
            <Text
              className="text-base font-bold"
              style={{ color: trueProfit >= 0 ? "#22c55e" : "#ef4444" }}
            >
              {formatCurrency(trueProfit)}
            </Text>
          </View>

          {/* Sozialabgaben & Steuern */}
          {trueProfit > 0 && (
            <>
              <Text className="text-xs text-muted uppercase tracking-wider mb-2 mt-4">
                Abzüge & Rücklagen
              </Text>

              {salaryExpense > 0 && (
                <View className="flex-row justify-between py-2 border-b border-border bg-error/10 px-2 rounded-sm -mx-2 mb-2">
                  <View>
                    <Text className="text-sm text-foreground font-semibold">
                      Einbehalt: Quellensteuer & AN-Beiträge
                    </Text>
                    <Text className="text-xs text-error mt-0.5 font-medium">
                      Betrag zwingend an Ausgleichskasse überweisen!
                    </Text>
                  </View>
                  <Text className="text-sm font-bold text-error">
                    {formatCurrency(anBeitrageUndQuellensteuer)}
                  </Text>
                </View>
              )}

              <View className="flex-row justify-between py-2 border-b border-border">
                <Text className="text-sm text-foreground">
                  AHV/IV/EO Inhaber (10.6%)
                </Text>
                <Text className="text-sm text-error">
                  {formatCurrency(trueProfit * 0.106)}
                </Text>
              </View>
              <View className="flex-row justify-between py-2 border-b border-border">
                <Text className="text-sm text-foreground">
                  FAK Luzern Inhaber (1.4%)
                </Text>
                <Text className="text-sm text-error">
                  {formatCurrency(trueProfit * 0.014)}
                </Text>
              </View>
              <View className="flex-row justify-between py-2 border-b border-border">
                <Text className="text-sm text-foreground">
                  Einkommenssteuer (ca. 15%)
                </Text>
                <Text className="text-sm text-error">
                  {formatCurrency(trueProfit * 0.15)}
                </Text>
              </View>
              <View className="flex-row justify-between py-2 border-b border-border">
                <Text className="text-sm font-semibold text-foreground">
                  Total Abzüge Inhaber (ca. 27%)
                </Text>
                <Text className="text-sm font-semibold text-error">
                  {formatCurrency(trueProfit * 0.27)}
                </Text>
              </View>
              <View
                className="flex-row justify-between py-3 mt-1"
                style={{
                  backgroundColor: "rgba(34,197,94,0.05)",
                  borderRadius: 8,
                  paddingHorizontal: 8,
                }}
              >
                <Text className="text-base font-bold text-foreground">
                  Nettoeinkommen Inhaber (ca.)
                </Text>
                <Text className="text-base font-bold text-success">
                  {formatCurrency(trueProfit * 0.73)}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Szenario Calculator */}
        <View className="bg-surface rounded-xl p-5 border border-border">
          <View className="flex-row items-center gap-2 mb-4">
            <IconSymbol
              name="plus.forwardslash.minus"
              size={20}
              color={colors.primary}
            />
            <Text className="text-base font-bold text-foreground">
              Szenario-Modell: Projekt-Marge
            </Text>
          </View>

          <Text className="text-sm text-muted mb-4">
            Berechnen Sie die verbleibende Marge für Gross ICT, wenn Aufträge an
            Freelancer bzw. externe Personen ausgelagert werden.
          </Text>

          <View className="mb-4">
            <Text className="text-xs font-semibold text-foreground mb-2">
              AUFTRAGSVOLUMEN (CHF)
            </Text>
            <TextInput
              value={scenarioVolume}
              onChangeText={setScenarioVolume}
              keyboardType="numeric"
              className="bg-background border border-border rounded-lg p-3 text-foreground"
              placeholder="10000"
              placeholderTextColor={colors.muted}
            />
          </View>

          <View className="mb-4">
            <Text className="text-xs font-semibold text-foreground mb-2">
              AUSFÜHRENDE PERSON
            </Text>
            <View className="flex-row gap-2">
              <TouchableOpacity
                className={`flex-1 py-3 px-4 rounded-lg items-center justify-center border ${scenarioExecutor === "inhaber" ? "bg-primary border-primary" : "bg-background border-border"}`}
                onPress={() => setScenarioExecutor("inhaber")}
              >
                <Text
                  className={`font-semibold ${scenarioExecutor === "inhaber" ? "text-background" : "text-foreground"}`}
                >
                  Inhaber
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 py-3 px-4 rounded-lg items-center justify-center border ${scenarioExecutor === "angestellter" ? "bg-primary border-primary" : "bg-background border-border"}`}
                onPress={() => setScenarioExecutor("angestellter")}
              >
                <Text
                  className={`font-semibold ${scenarioExecutor === "angestellter" ? "text-background" : "text-foreground"}`}
                >
                  Angestellter
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Scenario Result */}
          <View className="bg-background border border-border rounded-lg p-4 mt-2">
            {(() => {
              const vol = parseFloat(scenarioVolume) || 0;
              const isEmployee = scenarioExecutor === "angestellter";

              const lohn = isEmployee ? vol * 0.7 : 0;
              const agBeitrag = isEmployee ? lohn * 0.064 : 0;
              const uvg = isEmployee ? lohn * 0.01 : 0;

              const totalMarge = vol - lohn - agBeitrag - uvg;

              const ownerAhv = totalMarge > 0 ? totalMarge * 0.106 : 0;
              const ownerFak = totalMarge > 0 ? totalMarge * 0.014 : 0;
              const ownerSteuer = totalMarge > 0 ? totalMarge * 0.15 : 0;
              const ownerDeductions = ownerAhv + ownerFak + ownerSteuer;
              const nettoMarge = totalMarge - ownerDeductions;

              const vermittlung = isEmployee ? vol * 0.1 : 0;
              const restMarge = isEmployee ? nettoMarge - vermittlung : 0;

              return (
                <View className="gap-2">
                  {isEmployee && (
                    <>
                      <View className="flex-row justify-between mb-2">
                        <Text className="text-sm text-foreground font-semibold">
                          Projekt-Volumen
                        </Text>
                        <Text className="text-sm font-semibold">
                          {formatCurrency(vol)}
                        </Text>
                      </View>
                      <View className="flex-row justify-between">
                        <Text className="text-sm text-muted">
                          Auszahlung Angestellter (70%)
                        </Text>
                        <Text className="text-sm text-error">
                          -{formatCurrency(lohn)}
                        </Text>
                      </View>
                      <View className="flex-row justify-between">
                        <Text className="text-sm text-muted">
                          AG-Beiträge & UVG (versteckt)
                        </Text>
                        <Text className="text-sm text-error">
                          -{formatCurrency(agBeitrag + uvg)}
                        </Text>
                      </View>
                      <View className="flex-row justify-between mt-2 pt-2 border-t border-border border-dashed">
                        <Text className="text-sm text-foreground">
                          Brutto-Marge Gross ICT
                        </Text>
                        <Text className="text-sm font-semibold">
                          {formatCurrency(totalMarge)}
                        </Text>
                      </View>
                      <View className="flex-row justify-between mt-1">
                        <Text className="text-xs text-muted ml-2">
                          ↳ AHV/IV/EO Inhaber (10.6%)
                        </Text>
                        <Text className="text-xs text-error">
                          -{formatCurrency(ownerAhv)}
                        </Text>
                      </View>
                      <View className="flex-row justify-between mt-1">
                        <Text className="text-xs text-muted ml-2">
                          ↳ FAK Luzern Inhaber (1.4%)
                        </Text>
                        <Text className="text-xs text-error">
                          -{formatCurrency(ownerFak)}
                        </Text>
                      </View>
                      <View className="flex-row justify-between mt-1 mb-1">
                        <Text className="text-xs text-muted ml-2">
                          ↳ Einkommenssteuer (ca. 15%)
                        </Text>
                        <Text className="text-xs text-error">
                          -{formatCurrency(ownerSteuer)}
                        </Text>
                      </View>
                      <View className="flex-row justify-between pt-1 border-t border-border border-dotted">
                        <Text className="text-sm font-semibold text-foreground">
                          Netto-Marge Gross ICT
                        </Text>
                        <Text className="text-sm text-success font-bold">
                          {formatCurrency(nettoMarge)}
                        </Text>
                      </View>
                      <View className="flex-row justify-between mt-1">
                        <Text className="text-xs text-muted ml-2">
                          ↳ Davon Vermittlungs-Fee (10% v. Vol.)
                        </Text>
                        <Text className="text-xs text-muted">
                          {formatCurrency(vermittlung)}
                        </Text>
                      </View>
                      <View className="flex-row justify-between mt-1">
                        <Text className="text-xs text-muted ml-2">
                          ↳ Davon Unternehmens-Reserve
                        </Text>
                        <Text className="text-xs text-muted">
                          {formatCurrency(restMarge)}
                        </Text>
                      </View>
                      <TouchableOpacity
                        className="bg-primary/10 border border-primary/30 py-3 rounded-lg flex-row items-center justify-center mt-4"
                        activeOpacity={0.8}
                        onPress={() => {
                          if (isYearClosed) {
                            showAlert("Gesperrt", "Dieses Jahr ist abgeschlossen.");
                            return;
                          }
                          setShowScenarioModal(true);
                        }}
                      >
                        <IconSymbol name="plus.circle.fill" size={18} color={colors.primary} />
                        <Text className="text-primary font-semibold ml-2">
                          Als Ausgabe verbuchen
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {!isEmployee && (
                    <>
                      <View className="flex-row justify-between">
                        <Text className="text-sm text-muted">Lohnkosten</Text>
                        <Text className="text-sm text-muted">0.00 CHF</Text>
                      </View>
                      <View className="flex-row justify-between mt-2 pt-2 border-t border-border border-dashed">
                        <Text className="text-sm font-bold text-foreground">
                          Brutto-Marge Gross ICT
                        </Text>
                        <Text className="text-sm font-bold">
                          {formatCurrency(vol)}
                        </Text>
                      </View>
                      <View className="flex-row justify-between mt-1">
                        <Text className="text-xs text-muted ml-2">
                          ↳ AHV/IV/EO Inhaber (10.6%)
                        </Text>
                        <Text className="text-xs text-error">
                          -{formatCurrency(vol * 0.106)}
                        </Text>
                      </View>
                      <View className="flex-row justify-between mt-1">
                        <Text className="text-xs text-muted ml-2">
                          ↳ FAK Luzern Inhaber (1.4%)
                        </Text>
                        <Text className="text-xs text-error">
                          -{formatCurrency(vol * 0.014)}
                        </Text>
                      </View>
                      <View className="flex-row justify-between mt-1 mb-1">
                        <Text className="text-xs text-muted ml-2">
                          ↳ Einkommenssteuer (ca. 15%)
                        </Text>
                        <Text className="text-xs text-error">
                          -{formatCurrency(vol * 0.15)}
                        </Text>
                      </View>
                      <View className="flex-row justify-between pt-1 border-t border-border border-dotted">
                        <Text className="text-sm font-semibold text-foreground">
                          Netto-Marge Gross ICT
                        </Text>
                        <Text className="text-sm text-success font-bold">
                          {formatCurrency(vol * 0.73)}
                        </Text>
                      </View>
                      <Text className="text-xs text-muted mt-2 text-center text-balance">
                        Inhaber führt aus. Die Brutto-Marge ist der
                        Unternehmensgewinn (wird anschliessend nach
                        Jahresabschluss-Logik mit ca. 27% versteuert).
                      </Text>
                    </>
                  )}
                </View>
              );
            })()}
          </View>
        </View>

        {/* Export & Archive Actions */}
        <View className="gap-3 mt-2">
          {/* PDF Export */}
          <TouchableOpacity
            className="bg-surface border border-border py-3 rounded-lg flex-row items-center justify-center p-2"
            activeOpacity={0.7}
            onPress={async () => {
              try {
                await downloadAnnualReportPDF({
                  year:
                    typeof selectedYear === "number"
                      ? selectedYear
                      : parseInt(selectedYear),
                  paidRevenue,
                  totalOpen,
                  sachaufwand,
                  salaryExpense,
                  agBeitrage,
                  uvgPremie,
                  trueProfit,
                  anBeitrageUndQuellensteuer,
                  expensesByCategory,
                });
              } catch (error: any) {
                Alert.alert("Fehler", "PDF konnte nicht erstellt werden: " + error.message);
              }
            }}
          >
            <IconSymbol name="doc.text" size={18} color={colors.foreground} />
            <Text className="text-foreground font-semibold ml-2">
              Übersicht exportieren (PDF)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`py-3 rounded-lg flex-row items-center justify-center p-2 ${exportProgress ? "bg-muted" : "bg-primary"}`}
            activeOpacity={0.8}
            onPress={async () => {
              if (exportProgress) return;
              try {
                await exportAnnualZIP(
                  typeof selectedYear === "number" ? selectedYear : parseInt(selectedYear),
                  yearInvoices,
                  yearExpenses,
                  {
                    year: typeof selectedYear === "number" ? selectedYear : parseInt(selectedYear),
                    paidRevenue,
                    totalOpen,
                    sachaufwand,
                    salaryExpense,
                    agBeitrage,
                    uvgPremie,
                    trueProfit,
                    anBeitrageUndQuellensteuer,
                    expensesByCategory,
                  },
                  (msg) => setExportProgress(msg)
                );
              } catch (err: any) {
                showAlert("Export Fehler", err.message);
              } finally {
                setExportProgress("");
              }
            }}
          >
            {exportProgress ? (
                <ActivityIndicator color={colors.foreground} size="small" />
            ) : (
                <IconSymbol name="arrow.down.doc.fill" size={18} color="#FFFFFF" />
            )}
            <Text className={`font-semibold ml-2 text-center ${exportProgress ? "text-foreground" : "text-background"}`}>
              {exportProgress ? exportProgress : `Vollständiger Export\n(ZIP inkl. Belege & Journal)`}
            </Text>
          </TouchableOpacity>

          {/* Lock Year */}
          {!isYearClosed ? (
            <TouchableOpacity
              className="bg-error/10 border border-error/30 py-3 rounded-lg flex-row items-center justify-center p-2 mt-4"
              activeOpacity={0.7}
              onPress={handleCloseYear}
            >
              <IconSymbol name="lock.fill" size={18} color={colors.error || "#ef4444"} />
              <Text className="text-error font-semibold ml-2">
                Jahresabschluss abschliessen
              </Text>
            </TouchableOpacity>
          ) : (
            <View className="bg-success/10 border border-success/30 py-3 rounded-lg flex-row items-center justify-center p-2 mt-4">
              <IconSymbol name="checkmark.seal.fill" size={18} color={colors.success || "#22c55e"} />
              <Text className="text-success font-semibold ml-2">
                Jahr ist abgeschlossen und archiviert
              </Text>
            </View>
          )}
        </View>

        <View className="bg-surface rounded-xl p-4 border border-border">
          <Text className="text-xs text-muted leading-5">
            ℹ️ Die Gewinnsteuer für Einzelfirmen im Kanton Luzern wird zusammen
            mit der persönlichen Einkommenssteuer veranlagt. Der Gewinn fliesst
            in Ihr steuerbares Einkommen ein. Abzugsfähige Geschäftsausgaben
            reduzieren den steuerbaren Gewinn.
          </Text>
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: contentPadding }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View style={containerStyle}>
          {/* Header */}
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center gap-3">
              <TouchableOpacity
                onPress={() => router.back()}
                activeOpacity={0.7}
              >
                <IconSymbol
                  name="chevron.left"
                  size={24}
                  color={colors.foreground}
                />
              </TouchableOpacity>
              <Text className="text-3xl font-bold text-foreground">
                Buchhaltung
              </Text>
            </View>
            <TouchableOpacity
              className={`w-12 h-12 rounded-full items-center justify-center ${isYearClosed && (activeTab === "expenses" || activeTab === "invoices") ? "bg-muted" : "bg-primary"}`}
              activeOpacity={0.8}
              onPress={() => {
                if (isYearClosed && (activeTab === "expenses" || activeTab === "invoices")) {
                  showAlert("Gesperrt", "Dieses Jahr ist abgeschlossen.");
                  return;
                }
                if (activeTab === "expenses") {
                  setEditingExpense(null);
                  setShowExpenseModal(true);
                } else if (activeTab === "invoices") {
                  setShowInvoiceModal(true);
                }
              }}
            >
              <IconSymbol name="plus.circle.fill" size={24} color="#111111" />
            </TouchableOpacity>
          </View>

          {/* Tab Navigation */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-4"
            contentContainerStyle={{ gap: 8 }}
          >
            {TABS.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                className={`py-2 px-4 rounded-lg flex-row items-center gap-2 ${activeTab === tab.key ? "bg-primary" : "bg-surface border border-border"}`}
                onPress={() => setActiveTab(tab.key)}
              >
                <IconSymbol
                  name={tab.icon as any}
                  size={14}
                  color={activeTab === tab.key ? "#111" : colors.muted}
                />
                <Text
                  className={`text-sm font-semibold ${activeTab === tab.key ? "text-background" : "text-foreground"}`}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Content */}
          {activeTab === "overview" && renderOverview()}
          {activeTab === "invoices" && renderInvoices()}
          {activeTab === "expenses" && renderExpenses()}
          {activeTab === "vat" && renderVat()}
          {activeTab === "annual" && renderAnnual()}
          {activeTab === "documents" && <DocumentsTab colors={colors} />}
        </View>
      </ScrollView>

      <InvoiceFormModal
        visible={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        onSuccess={() => refetchInvoices()}
      />
      <ExpenseFormModal
        visible={showExpenseModal}
        onClose={() => {
          setShowExpenseModal(false);
          setEditingExpense(null);
          setScannedReceipt(null);
        }}
        onSuccess={() => refetchExpenses()}
        expense={editingExpense}
        initialScanReceipt={scannedReceipt}
      />

      <ScenarioBookingModal
        visible={showScenarioModal}
        amount={(parseFloat(scenarioVolume) || 0) * 0.7}
        projectVol={parseFloat(scenarioVolume) || 0}
        onClose={() => setShowScenarioModal(false)}
        onSubmit={handleSubmitScenarioBooking}
      />
    </ScreenContainer>
  );
}

// ── Dokumente Tab ──
function DocumentsTab({ colors }: { colors: any }) {
  const isWeb = Platform.OS === "web";
  const queryClient = useQueryClient();
  const [viewerData, setViewerData] = useState<{
    url: string | null;
    title: string;
  }>({ url: null, title: "" });
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<
    { id: string | null; name: string }[]
  >([{ id: null, name: "Dokumente" }]);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<any>(null);

  const { data: folders = [], isLoading: foldersLoading } = useQuery({
    queryKey: ["documentFolders", currentFolderId],
    queryFn: () => Data.getDocumentFolders(currentFolderId),
  });

  const { data: documents = [], isLoading: docsLoading } = useQuery({
    queryKey: ["documents", currentFolderId],
    queryFn: () =>
      currentFolderId
        ? Data.getDocuments(currentFolderId)
        : Promise.resolve([]),
    enabled: !!currentFolderId,
  });

  const navigateToFolder = (folderId: string, folderName: string) => {
    setCurrentFolderId(folderId);
    setFolderPath((prev) => [...prev, { id: folderId, name: folderName }]);
  };

  const navigateBack = (index: number) => {
    const newPath = folderPath.slice(0, index + 1);
    setFolderPath(newPath);
    setCurrentFolderId(newPath[newPath.length - 1].id);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await Data.createDocumentFolder(newFolderName.trim(), currentFolderId);
      queryClient.invalidateQueries({
        queryKey: ["documentFolders", currentFolderId],
      });
      setShowNewFolder(false);
      setNewFolderName("");
    } catch (err: any) {
      showAlert("Fehler", err.message);
    }
  };

  const handleDeleteFolder = (folder: any) => {
    showConfirm(
      "Ordner löschen",
      `"${folder.name}" und alle Dateien darin löschen?`,
      async () => {
        try {
          await Data.deleteDocumentFolder(folder.id);
          queryClient.invalidateQueries({
            queryKey: ["documentFolders", currentFolderId],
          });
        } catch (err: any) {
          showAlert("Fehler", err.message);
        }
      },
      "Löschen",
    );
  };

  const handleDeleteDocument = (doc: any) => {
    showConfirm(
      "Datei löschen",
      `"${doc.file_name}" löschen?`,
      async () => {
        try {
          await Data.deleteDocument(doc.id, doc.file_path);
          queryClient.invalidateQueries({
            queryKey: ["documents", currentFolderId],
          });
        } catch (err: any) {
          showAlert("Fehler", err.message);
        }
      },
      "Löschen",
    );
  };

  const handleFileUpload = async (files: FileList | any[]) => {
    if (!currentFolderId) {
      showAlert("Hinweis", "Bitte wählen Sie zuerst einen Ordner.");
      return;
    }
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const uri =
          Platform.OS === "web" ? URL.createObjectURL(file) : file.uri;
        await Data.uploadDocument(
          currentFolderId,
          uri,
          file.name || `Datei_${Date.now()}`
        );
      }
      queryClient.invalidateQueries({
        queryKey: ["documents", currentFolderId],
      });
      showAlert("Erfolg", "Datei(en) hochgeladen.");
    } catch (err: any) {
      showAlert("Fehler", err.message);
    } finally {
      setUploading(false);
    }
  };

  const handlePickFile = async () => {
    if (Platform.OS === "web") {
      fileInputRef.current?.click();
    } else {
      try {
        const ImagePicker = await import("expo-image-picker");
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.All,
          allowsMultipleSelection: true,
          quality: 0.8,
        });
        if (!result.canceled && result.assets) {
          await handleFileUpload(
            result.assets.map((a: any) => ({
              name: a.fileName || `Bild_${Date.now()}.jpg`,
              type: a.mimeType || "image/jpeg",
              uri: a.uri,
              size: a.fileSize || 0,
            })),
          );
        }
      } catch (_e) {
        showAlert("Fehler", "Dateiauswahl fehlgeschlagen");
      }
    }
  };

  const handleTakePhoto = async () => {
    try {
      const ImagePicker = await import("expo-image-picker");
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        showAlert("Berechtigung", "Kamera-Zugriff verweigert.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      if (!result.canceled && result.assets?.[0]) {
        const a = result.assets[0];
        await handleFileUpload([
          {
            name: a.fileName || `Foto_${Date.now()}.jpg`,
            type: a.mimeType || "image/jpeg",
            uri: a.uri,
            size: a.fileSize || 0,
          },
        ]);
      }
    } catch (_e) {
      showAlert("Fehler", "Kamera fehlgeschlagen");
    }
  };

  const handleOpenDocument = async (doc: any) => {
    try {
      const url = await Data.getDocumentDownloadUrl(doc.file_path);
      if (url) {
        setViewerData({ url, title: doc.file_name });
      }
    } catch (_e) {
      showAlert("Fehler", "Datei konnte nicht geöffnet werden.");
    }
  };

  const fmtSize = (b: number) =>
    b < 1024
      ? `${b} B`
      : b < 1048576
        ? `${(b / 1024).toFixed(1)} KB`
        : `${(b / 1048576).toFixed(1)} MB`;

  return (
    <View className="gap-3">
      {/* Breadcrumb */}
      <View className="flex-row items-center gap-1 flex-wrap">
        {folderPath.map((item, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => navigateBack(i)}
            className="flex-row items-center"
            activeOpacity={0.7}
          >
            {i > 0 && (
              <IconSymbol name="chevron.right" size={12} color={colors.muted} />
            )}
            <Text
              className={`text-sm ${i === folderPath.length - 1 ? "font-bold text-foreground" : "text-primary"} ml-1`}
            >
              {item.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Actions */}
      <View className="flex-row gap-2 flex-wrap">
        <TouchableOpacity
          className="bg-primary px-4 py-2.5 rounded-lg flex-row items-center gap-2"
          activeOpacity={0.8}
          onPress={() => setShowNewFolder(true)}
        >
          <IconSymbol name="folder.badge.plus" size={16} color="#111" />
          <Text className="text-background font-semibold text-sm">
            Neuer Ordner
          </Text>
        </TouchableOpacity>
        {currentFolderId && (
          <>
            <TouchableOpacity
              className="bg-success px-4 py-2.5 rounded-lg flex-row items-center gap-2"
              activeOpacity={0.8}
              onPress={handlePickFile}
              disabled={uploading}
            >
              <IconSymbol name="doc.badge.plus" size={16} color="#fff" />
              <Text className="text-white font-semibold text-sm">
                {uploading ? "..." : isWeb ? "Datei wählen" : "Mediathek"}
              </Text>
            </TouchableOpacity>
            {!isWeb && (
              <TouchableOpacity
                className="px-4 py-2.5 rounded-lg flex-row items-center gap-2"
                style={{ backgroundColor: "#3b82f6" }}
                activeOpacity={0.8}
                onPress={handleTakePhoto}
              >
                <IconSymbol name="camera.fill" size={16} color="#fff" />
                <Text className="text-white font-semibold text-sm">Foto</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      {/* Web file input */}
      {isWeb && (
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: "none" } as any}
          onChange={(e: any) => {
            if (e.target.files) handleFileUpload(e.target.files);
          }}
        />
      )}

      {/* Web Drag & Drop */}
      {isWeb && currentFolderId && (
        <View
          className="border-2 border-dashed rounded-xl p-6 items-center justify-center"
          style={{ borderColor: colors.border }}
          // @ts-ignore
          onDragOver={(e: any) => {
            e.preventDefault();
          }}
          onDrop={(e: any) => {
            e.preventDefault();
            if (e.dataTransfer?.files) handleFileUpload(e.dataTransfer.files);
          }}
        >
          <IconSymbol
            name="square.and.arrow.down"
            size={28}
            color={colors.muted}
          />
          <Text className="text-sm text-muted mt-2">
            Dateien hierher ziehen
          </Text>
        </View>
      )}

      {/* New folder form */}
      {showNewFolder && (
        <View className="bg-surface rounded-xl p-4 border border-border flex-row items-center gap-3">
          <TextInput
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground"
            style={{ color: colors.foreground }}
            placeholder="Ordnername"
            placeholderTextColor={colors.muted}
            value={newFolderName}
            onChangeText={setNewFolderName}
            autoFocus
            onSubmitEditing={handleCreateFolder}
          />
          <TouchableOpacity
            className="bg-primary px-4 py-2 rounded-lg"
            onPress={handleCreateFolder}
          >
            <Text className="text-background font-semibold">OK</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setShowNewFolder(false);
              setNewFolderName("");
            }}
          >
            <IconSymbol name="xmark" size={18} color={colors.muted} />
          </TouchableOpacity>
        </View>
      )}

      {foldersLoading || docsLoading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <>
          {folders.map((f: any) => (
            <TouchableOpacity
              key={f.id}
              className="bg-surface rounded-xl p-4 border border-border flex-row items-center justify-between"
              activeOpacity={0.7}
              onPress={() => navigateToFolder(f.id, f.name)}
              onLongPress={() => handleDeleteFolder(f)}
            >
              <View className="flex-row items-center gap-3">
                <View
                  className="w-10 h-10 rounded-lg items-center justify-center"
                  style={{ backgroundColor: colors.primary + "20" }}
                >
                  <IconSymbol
                    name="folder.fill"
                    size={20}
                    color={colors.primary}
                  />
                </View>
                <Text className="text-base font-semibold text-foreground">
                  {f.name}
                </Text>
              </View>
              <IconSymbol name="chevron.right" size={16} color={colors.muted} />
            </TouchableOpacity>
          ))}

          {currentFolderId &&
            documents.map((d: any) => (
              <TouchableOpacity
                key={d.id}
                className="bg-surface rounded-xl p-4 border border-border flex-row items-center justify-between"
                activeOpacity={0.7}
                onPress={() => handleOpenDocument(d)}
                onLongPress={() => handleDeleteDocument(d)}
              >
                <View className="flex-row items-center gap-3 flex-1">
                  <View
                    className="w-10 h-10 rounded-lg items-center justify-center"
                    style={{ backgroundColor: "#8B5CF620" }}
                  >
                    <IconSymbol name="doc.fill" size={18} color="#8B5CF6" />
                  </View>
                  <View className="flex-1">
                    <Text
                      className="text-sm font-semibold text-foreground"
                      numberOfLines={1}
                    >
                      {d.file_name}
                    </Text>
                    <Text className="text-xs text-muted">
                      {fmtSize(d.file_size)} ·{" "}
                      {new Date(d.created_at).toLocaleDateString("de-CH")}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => handleDeleteDocument(d)}>
                  <IconSymbol name="trash" size={16} color={colors.error} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}

          {!currentFolderId && folders.length === 0 && (
            <View className="items-center justify-center py-12">
              <IconSymbol name="folder.fill" size={48} color={colors.muted} />
              <Text className="text-lg text-muted mt-4">Keine Ordner</Text>
              <Text className="text-sm text-muted text-center mt-2">
                Erstellen Sie Ordner um Belege und Dokumente zu organisieren.
              </Text>
            </View>
          )}

          {currentFolderId &&
            documents.length === 0 &&
            folders.length === 0 && (
              <View className="items-center justify-center py-8">
                <IconSymbol name="doc.fill" size={36} color={colors.muted} />
                <Text className="text-base text-muted mt-3">
                  Ordner ist leer
                </Text>
                <Text className="text-sm text-muted mt-1">
                  {isWeb
                    ? 'Dateien hierher ziehen oder "Datei wählen"'
                    : '"Mediathek" oder "Foto" antippen'}
                </Text>
              </View>
            )}
        </>
      )}

      {/* Fullscreen Document Viewer */}
      <ImageViewerModal
        visible={!!viewerData.url}
        url={viewerData.url}
        title={viewerData.title}
        onClose={() => setViewerData({ url: null, title: "" })}
      />
    </View>
  );
}

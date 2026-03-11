import { useState, useCallback, useMemo } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { InvoiceFormModal } from "@/components/invoice-form-modal-v2";
import { ExpenseFormModal } from "@/components/expense-form-modal";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { formatCurrency, formatDate, getInvoiceTotal } from "@/lib/format";
import { router as expoRouter } from "expo-router";
import { showConfirm } from "@/lib/alert";

type TabKey = "overview" | "invoices" | "expenses" | "vat" | "annual";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "overview", label: "Übersicht", icon: "chart.pie.fill" },
  { key: "invoices", label: "Rechnungen", icon: "doc.text.fill" },
  { key: "expenses", label: "Ausgaben", icon: "cart.fill" },
  { key: "vat", label: "MwSt", icon: "percent" },
  { key: "annual", label: "Jahresabschluss", icon: "calendar" },
];

export default function AccountingScreen() {
  const router = useRouter();
  const colors = useColors();
  const { isWide, containerStyle, contentPadding } = useResponsiveLayout();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const { data: invoices, isLoading: loadingInvoices, refetch: refetchInvoices } = useQuery({
    queryKey: ["invoices"],
    queryFn: Data.getAllInvoices,
  });

  const { data: expenses, isLoading: loadingExpenses, refetch: refetchExpenses } = useQuery({
    queryKey: ["expenses"],
    queryFn: Data.getAllExpenses,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchInvoices(), refetchExpenses()]);
    setRefreshing(false);
  }, [refetchInvoices, refetchExpenses]);

  // Filter by year
  const yearInvoices = useMemo(() =>
    invoices?.filter((i: any) => new Date(i.invoice_date).getFullYear() === selectedYear) || [],
    [invoices, selectedYear]
  );

  const yearExpenses = useMemo(() =>
    expenses?.filter((e: any) => new Date(e.expense_date).getFullYear() === selectedYear) || [],
    [expenses, selectedYear]
  );

  // Stats
  const totalRevenue = yearInvoices.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + getInvoiceTotal(i), 0);
  const totalOpen = yearInvoices.filter((i: any) => i.status === "open").reduce((s: number, i: any) => s + getInvoiceTotal(i), 0);
  const totalOverdue = yearInvoices.filter((i: any) => i.status === "overdue").reduce((s: number, i: any) => s + getInvoiceTotal(i), 0);
  const totalExpenses = yearExpenses.reduce((s: number, e: any) => s + (e.amount || 0), 0);
  const deductibleExpenses = yearExpenses.filter((e: any) => e.is_deductible).reduce((s: number, e: any) => s + (e.amount || 0), 0);
  const profit = totalRevenue - totalExpenses;

  // Umsatz-Schwelle MwSt (CHF 100'000)
  const MWST_THRESHOLD = 100000;
  const totalAllRevenue = yearInvoices.reduce((s: number, i: any) => s + getInvoiceTotal(i), 0);
  const revenuePercent = Math.min((totalAllRevenue / MWST_THRESHOLD) * 100, 100);

  // Expenses by category
  const expensesByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    yearExpenses.forEach((e: any) => {
      map[e.category] = (map[e.category] || 0) + (e.amount || 0);
    });
    return Object.entries(map)
      .map(([cat, amount]) => ({
        category: cat,
        label: Data.EXPENSE_CATEGORIES.find((c) => c.value === cat)?.label || cat,
        amount,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [yearExpenses]);

  // Umsatz by month
  const revenueByMonth = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    return months.map((label, idx) => {
      const rev = yearInvoices
        .filter((i: any) => i.status === "paid" && new Date(i.invoice_date).getMonth() === idx)
        .reduce((s: number, i: any) => s + getInvoiceTotal(i), 0);
      const exp = yearExpenses
        .filter((e: any) => new Date(e.expense_date).getMonth() === idx)
        .reduce((s: number, e: any) => s + (e.amount || 0), 0);
      return { label, revenue: rev, expenses: exp };
    });
  }, [yearInvoices, yearExpenses]);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "open": return "Offen";
      case "paid": return "Bezahlt";
      case "overdue": return "Überfällig";
      case "cancelled": return "Storniert";
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-warning";
      case "paid": return "bg-success";
      case "overdue": return "bg-error";
      case "cancelled": return "bg-muted";
      default: return "bg-muted";
    }
  };

  const handleDeleteExpense = (expense: any) => {
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
      "Löschen"
    );
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
      other: "ellipsis.circle.fill",
    };
    return icons[cat] || "ellipsis.circle.fill";
  };

  const renderYearSelector = () => (
    <View className="flex-row items-center justify-center gap-4 mb-4">
      <TouchableOpacity onPress={() => setSelectedYear(selectedYear - 1)} activeOpacity={0.7}>
        <IconSymbol name="chevron.left" size={20} color={colors.primary} />
      </TouchableOpacity>
      <Text className="text-lg font-bold text-foreground">{selectedYear}</Text>
      <TouchableOpacity onPress={() => setSelectedYear(selectedYear + 1)} activeOpacity={0.7}>
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
        style={{ backgroundColor: profit >= 0 ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)" }}
      >
        <Text className="text-sm text-muted mb-1">Gewinn / Verlust ({selectedYear})</Text>
        <Text
          className="text-3xl font-bold"
          style={{ color: profit >= 0 ? "#22c55e" : "#ef4444" }}
        >
          {formatCurrency(profit)}
        </Text>
        <View className="flex-row mt-3 gap-6">
          <View>
            <Text className="text-xs text-muted">Einnahmen</Text>
            <Text className="text-sm font-semibold text-success">{formatCurrency(totalRevenue)}</Text>
          </View>
          <View>
            <Text className="text-xs text-muted">Ausgaben</Text>
            <Text className="text-sm font-semibold text-error">{formatCurrency(totalExpenses)}</Text>
          </View>
        </View>
      </View>

      {/* Quick Stats */}
      <View className="flex-row gap-3">
        <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
          <Text className="text-xs text-muted mb-1">Offene Posten</Text>
          <Text className="text-xl font-bold text-warning">{formatCurrency(totalOpen)}</Text>
        </View>
        <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
          <Text className="text-xs text-muted mb-1">Überfällig</Text>
          <Text className="text-xl font-bold text-error">{formatCurrency(totalOverdue)}</Text>
        </View>
      </View>

      <View className="flex-row gap-3">
        <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
          <Text className="text-xs text-muted mb-1">Rechnungen</Text>
          <Text className="text-xl font-bold text-foreground">{yearInvoices.length}</Text>
        </View>
        <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
          <Text className="text-xs text-muted mb-1">Abzugsfähig</Text>
          <Text className="text-xl font-bold text-primary">{formatCurrency(deductibleExpenses)}</Text>
        </View>
      </View>

      {/* Ausgaben nach Kategorie */}
      {expensesByCategory.length > 0 && (
        <View className="bg-surface rounded-xl p-4 border border-border">
          <Text className="text-sm font-bold text-foreground mb-3">Ausgaben nach Kategorie</Text>
          {expensesByCategory.map((cat) => (
            <View key={cat.category} className="flex-row items-center justify-between py-2 border-b border-border">
              <View className="flex-row items-center gap-2 flex-1">
                <IconSymbol name={getCategoryIcon(cat.category) as any} size={16} color={colors.primary} />
                <Text className="text-sm text-foreground" numberOfLines={1}>{cat.label}</Text>
              </View>
              <Text className="text-sm font-semibold text-foreground">{formatCurrency(cat.amount)}</Text>
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
            className="bg-primary py-3 rounded-lg flex-row items-center justify-center mb-2"
            activeOpacity={0.8}
            onPress={() => setShowInvoiceModal(true)}
          >
            <IconSymbol name="plus.circle.fill" size={20} color="#FFFFFF" />
            <Text className="text-background font-semibold ml-2">Neue Rechnung</Text>
          </TouchableOpacity>

          {invoices.map((invoice: any) => {
            const customerName = invoice.customer?.company_name ||
              `${invoice.customer?.first_name || ""} ${invoice.customer?.last_name || ""}`.trim() ||
              "Unbekannt";
            return (
              <TouchableOpacity
                key={invoice.id}
                className="bg-surface rounded-xl p-4 border border-border"
                activeOpacity={0.7}
                onPress={() => expoRouter.push(`/invoice/${invoice.id}` as any)}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-base font-bold text-foreground">
                    {invoice.invoice_number}
                  </Text>
                  <View className={`px-3 py-1 rounded-full ${getStatusColor(invoice.status)}`}>
                    <Text className="text-xs font-semibold text-white">
                      {getStatusLabel(invoice.status)}
                    </Text>
                  </View>
                </View>
                <Text className="text-sm text-foreground mb-1">{customerName}</Text>
                <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-border">
                  <Text className="text-xs text-muted">
                    {formatDate(invoice.invoice_date)} · Fällig: {formatDate(invoice.due_date)}
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
          <TouchableOpacity className="bg-primary px-6 py-3 rounded-lg" activeOpacity={0.8} onPress={() => setShowInvoiceModal(true)}>
            <Text className="text-background font-semibold">Rechnung erstellen</Text>
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
            className="bg-primary py-3 rounded-lg flex-row items-center justify-center mb-2"
            activeOpacity={0.8}
            onPress={() => { setEditingExpense(null); setShowExpenseModal(true); }}
          >
            <IconSymbol name="plus.circle.fill" size={20} color="#FFFFFF" />
            <Text className="text-background font-semibold ml-2">Neue Ausgabe</Text>
          </TouchableOpacity>

          {yearExpenses.length > 0 ? (
            <>
              {/* Summe */}
              <View className="bg-surface rounded-xl p-4 border border-border flex-row justify-between items-center">
                <Text className="text-sm text-muted">Total Ausgaben ({selectedYear})</Text>
                <Text className="text-lg font-bold text-error">{formatCurrency(totalExpenses)}</Text>
              </View>

              {renderYearSelector()}

              {yearExpenses.map((expense: any) => (
                <TouchableOpacity
                  key={expense.id}
                  className="bg-surface rounded-xl p-4 border border-border"
                  activeOpacity={0.7}
                  onPress={() => { setEditingExpense(expense); setShowExpenseModal(true); }}
                  onLongPress={() => handleDeleteExpense(expense)}
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center gap-2 flex-1">
                      <View className="w-8 h-8 rounded-lg bg-error/20 items-center justify-center">
                        <IconSymbol name={getCategoryIcon(expense.category) as any} size={14} color={colors.error || "#ef4444"} />
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                          {expense.description}
                        </Text>
                        <Text className="text-xs text-muted">
                          {Data.EXPENSE_CATEGORIES.find((c) => c.value === expense.category)?.label || expense.category}
                          {expense.supplier ? ` · ${expense.supplier}` : ""}
                        </Text>
                      </View>
                    </View>
                    <View className="items-end">
                      <Text className="text-base font-bold text-error">
                        -{formatCurrency(expense.amount)}
                      </Text>
                      <Text className="text-xs text-muted">{formatDate(expense.expense_date)}</Text>
                    </View>
                  </View>
                  {expense.tax_amount > 0 && (
                    <Text className="text-xs text-muted mt-1">
                      Vorsteuer: {formatCurrency(expense.tax_amount)} ({expense.tax_rate}%)
                      {expense.is_deductible ? " · Abzugsfähig" : ""}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </>
          ) : (
            <View className="items-center justify-center py-12">
              <IconSymbol name="cart.fill" size={48} color={colors.muted} />
              <Text className="text-lg text-muted mt-4 mb-2">Keine Ausgaben</Text>
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
      <View className="bg-surface rounded-xl p-5 border border-border" style={{ borderColor: "#22c55e" }}>
        <View className="flex-row items-center gap-2 mb-3">
          <View className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: "rgba(34,197,94,0.15)" }}>
            <IconSymbol name="checkmark.shield.fill" size={16} color="#22c55e" />
          </View>
          <Text className="text-base font-bold text-foreground">MwSt-befreit</Text>
        </View>
        <Text className="text-sm text-muted leading-5">
          Ihre Einzelfirma ist von der MwSt befreit, da der Jahresumsatz unter CHF 100'000 liegt.
          Sie stellen Rechnungen ohne MwSt und weisen keine Steuer aus.
        </Text>
      </View>

      {/* Umsatz-Fortschritt */}
      <View className="bg-surface rounded-xl p-5 border border-border">
        <Text className="text-sm font-bold text-foreground mb-2">Umsatz-Schwelle {selectedYear}</Text>
        <Text className="text-xs text-muted mb-3">
          Ab CHF 100'000 Jahresumsatz wird die MwSt-Registrierung obligatorisch.
        </Text>

        <View className="flex-row items-end justify-between mb-2">
          <Text className="text-2xl font-bold text-foreground">{formatCurrency(totalAllRevenue)}</Text>
          <Text className="text-sm text-muted">/ {formatCurrency(MWST_THRESHOLD)}</Text>
        </View>

        {/* Progress bar */}
        <View className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: colors.border }}>
          <View
            className="h-3 rounded-full"
            style={{
              width: `${revenuePercent}%`,
              backgroundColor: revenuePercent > 80 ? "#f59e0b" : "#22c55e",
            }}
          />
        </View>
        <Text className="text-xs text-muted mt-2">
          {revenuePercent.toFixed(1)}% der Schwelle erreicht · Noch {formatCurrency(Math.max(0, MWST_THRESHOLD - totalAllRevenue))} bis zur MwSt-Pflicht
        </Text>
      </View>

      {/* Monatsübersicht */}
      <View className="bg-surface rounded-xl p-4 border border-border">
        <Text className="text-sm font-bold text-foreground mb-3">Umsatz nach Monat</Text>
        {revenueByMonth.map((m) => (
          <View key={m.label} className="flex-row items-center justify-between py-2 border-b border-border">
            <Text className="text-xs text-muted w-10">{m.label}</Text>
            <View className="flex-1 mx-3 h-2 rounded-full overflow-hidden" style={{ backgroundColor: colors.border }}>
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
          ℹ️ Als nicht MwSt-pflichtige Einzelfirma dürfen Sie keine MwSt auf Ihren Rechnungen ausweisen.
          Sobald Ihr Jahresumsatz CHF 100'000 übersteigt, müssen Sie sich innerhalb von 30 Tagen bei der ESTV anmelden.
        </Text>
      </View>
    </View>
  );

  const renderAnnual = () => {
    const allRevenue = yearInvoices.reduce((s: number, i: any) => s + getInvoiceTotal(i), 0);
    const paidRevenue = totalRevenue;

    const summaryText = [
      `JAHRESABSCHLUSS ${selectedYear}`,
      `Gross ICT — Einzelfirma, Kanton Luzern`,
      ``,
      `EINNAHMEN`,
      `Rechnungen total: ${formatCurrency(allRevenue)}`,
      `Davon bezahlt: ${formatCurrency(paidRevenue)}`,
      `Davon offen: ${formatCurrency(totalOpen)}`,
      ``,
      `AUSGABEN`,
      ...expensesByCategory.map((c) => `${c.label}: ${formatCurrency(c.amount)}`),
      `Total Ausgaben: ${formatCurrency(totalExpenses)}`,
      `Davon abzugsfähig: ${formatCurrency(deductibleExpenses)}`,
      ``,
      `ERGEBNIS`,
      `Gewinn vor Steuern: ${formatCurrency(profit)}`,
      ``,
      `MWST-STATUS: Befreit (Umsatz unter CHF 100'000)`,
    ].join("\n");

    return (
      <View className="gap-4">
        {renderYearSelector()}

        <View className="bg-surface rounded-xl p-5 border border-border">
          <Text className="text-base font-bold text-foreground mb-1">Jahresabschluss {selectedYear}</Text>
          <Text className="text-xs text-muted mb-4">Einzelfirma · Kanton Luzern</Text>

          {/* Einnahmen */}
          <Text className="text-xs text-muted uppercase tracking-wider mb-2 mt-2">Einnahmen</Text>
          <View className="flex-row justify-between py-2 border-b border-border">
            <Text className="text-sm text-foreground">Rechnungen (bezahlt)</Text>
            <Text className="text-sm font-semibold text-success">{formatCurrency(paidRevenue)}</Text>
          </View>
          <View className="flex-row justify-between py-2 border-b border-border">
            <Text className="text-sm text-foreground">Offene Forderungen</Text>
            <Text className="text-sm text-warning">{formatCurrency(totalOpen)}</Text>
          </View>

          {/* Ausgaben */}
          <Text className="text-xs text-muted uppercase tracking-wider mb-2 mt-4">Ausgaben</Text>
          {expensesByCategory.map((cat) => (
            <View key={cat.category} className="flex-row justify-between py-2 border-b border-border">
              <Text className="text-sm text-foreground">{cat.label}</Text>
              <Text className="text-sm text-error">{formatCurrency(cat.amount)}</Text>
            </View>
          ))}
          <View className="flex-row justify-between py-2 border-b border-border">
            <Text className="text-sm font-semibold text-foreground">Total Ausgaben</Text>
            <Text className="text-sm font-semibold text-error">{formatCurrency(totalExpenses)}</Text>
          </View>

          {/* Ergebnis */}
          <Text className="text-xs text-muted uppercase tracking-wider mb-2 mt-4">Ergebnis</Text>
          <View className="flex-row justify-between py-3 border-b border-border">
            <Text className="text-base font-bold text-foreground">Gewinn vor Steuern</Text>
            <Text
              className="text-base font-bold"
              style={{ color: profit >= 0 ? "#22c55e" : "#ef4444" }}
            >
              {formatCurrency(profit)}
            </Text>
          </View>

          {/* Sozialabgaben & Steuern */}
          {profit > 0 && (
            <>
              <Text className="text-xs text-muted uppercase tracking-wider mb-2 mt-4">Abzüge & Rücklagen</Text>
              <View className="flex-row justify-between py-2 border-b border-border">
                <Text className="text-sm text-foreground">AHV/IV/EO (10.6%)</Text>
                <Text className="text-sm text-error">{formatCurrency(profit * 0.106)}</Text>
              </View>
              <View className="flex-row justify-between py-2 border-b border-border">
                <Text className="text-sm text-foreground">FAK Luzern (1.4%)</Text>
                <Text className="text-sm text-error">{formatCurrency(profit * 0.014)}</Text>
              </View>
              <View className="flex-row justify-between py-2 border-b border-border">
                <Text className="text-sm text-foreground">Einkommenssteuer (ca. 15%)</Text>
                <Text className="text-sm text-error">{formatCurrency(profit * 0.15)}</Text>
              </View>
              <View className="flex-row justify-between py-2 border-b border-border">
                <Text className="text-sm font-semibold text-foreground">Total Abzüge (ca. 27%)</Text>
                <Text className="text-sm font-semibold text-error">{formatCurrency(profit * 0.27)}</Text>
              </View>
              <View className="flex-row justify-between py-3 mt-1" style={{ backgroundColor: "rgba(34,197,94,0.05)", borderRadius: 8, paddingHorizontal: 8 }}>
                <Text className="text-base font-bold text-foreground">Nettoeinkommen (ca.)</Text>
                <Text className="text-base font-bold text-success">{formatCurrency(profit * 0.73)}</Text>
              </View>
            </>
          )}
        </View>

        {/* Export */}
        <TouchableOpacity
          className="bg-primary py-3 rounded-lg flex-row items-center justify-center"
          activeOpacity={0.8}
          onPress={() => {
            try {
              const { Clipboard } = require("react-native");
              if (Clipboard?.setString) {
                Clipboard.setString(summaryText);
                Alert.alert("Kopiert", "Jahresabschluss in die Zwischenablage kopiert.");
              } else {
                Alert.alert("Export", summaryText);
              }
            } catch (_e) {
              Alert.alert("Export", summaryText);
            }
          }}
        >
          <IconSymbol name="doc.on.doc.fill" size={18} color="#FFFFFF" />
          <Text className="text-background font-semibold ml-2">Für Steuerberater kopieren</Text>
        </TouchableOpacity>

        <View className="bg-surface rounded-xl p-4 border border-border">
          <Text className="text-xs text-muted leading-5">
            ℹ️ Die Gewinnsteuer für Einzelfirmen im Kanton Luzern wird zusammen mit der persönlichen
            Einkommenssteuer veranlagt. Der Gewinn fliesst in Ihr steuerbares Einkommen ein.
            Abzugsfähige Geschäftsausgaben reduzieren den steuerbaren Gewinn.
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
              <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
                <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
              </TouchableOpacity>
              <Text className="text-3xl font-bold text-foreground">Buchhaltung</Text>
            </View>
            <TouchableOpacity
              className="bg-primary w-12 h-12 rounded-full items-center justify-center"
              activeOpacity={0.8}
              onPress={() => {
                if (activeTab === "expenses") {
                  setEditingExpense(null);
                  setShowExpenseModal(true);
                } else {
                  setShowInvoiceModal(true);
                }
              }}
            >
              <IconSymbol name="plus.circle.fill" size={24} color="#111111" />
            </TouchableOpacity>
          </View>

          {/* Tab Navigation */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4" contentContainerStyle={{ gap: 8 }}>
            {TABS.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                className={`py-2 px-4 rounded-lg flex-row items-center gap-2 ${activeTab === tab.key ? "bg-primary" : "bg-surface border border-border"}`}
                onPress={() => setActiveTab(tab.key)}
              >
                <IconSymbol name={tab.icon as any} size={14} color={activeTab === tab.key ? "#111" : colors.muted} />
                <Text className={`text-sm font-semibold ${activeTab === tab.key ? "text-background" : "text-foreground"}`}>
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
        </View>
      </ScrollView>

      <InvoiceFormModal
        visible={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        onSuccess={() => refetchInvoices()}
      />
      <ExpenseFormModal
        visible={showExpenseModal}
        onClose={() => { setShowExpenseModal(false); setEditingExpense(null); }}
        onSuccess={() => refetchExpenses()}
        expense={editingExpense}
      />
    </ScreenContainer>
  );
}

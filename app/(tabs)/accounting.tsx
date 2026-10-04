import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
  Linking,
  Switch,
  TextInput,
  Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BackButton } from "@/components/back-button";
import { useColors } from "@/hooks/use-colors";
import { useIsReadOnly } from "@/hooks/use-is-read-only";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { InvoiceFormModal } from "@/components/invoice-form-modal-v2";
import { BankReconciliationModal } from "@/components/bank-reconciliation-modal";
import { ExpenseFormModal } from "@/components/expense-form-modal";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { ImageViewerModal } from "@/components/image-viewer-modal";
import { formatCurrency, formatDate, getInvoiceTotal } from "@/lib/format";
import { router as expoRouter } from "expo-router";
import { showConfirm, showAlert } from "@/lib/alert";
import { showToast } from "@/components/toast-provider";
import { downloadAnnualReportPDF } from "@/lib/pdf-annual-report";
import { exportAnnualZIP } from "@/lib/export-annual-report";
import { exportCsv } from "@/lib/export";
import { generateInvoicePDFBase64 } from "@/lib/pdf-utils";
import { generateQuittungBase64 } from "@/lib/pdf-quittung";
import { ScenarioBookingModal } from "@/components/scenario-booking-modal";
import * as FileSystem from "expo-file-system/legacy";

type TabKey =
  | "overview"
  | "budget"
  | "invoices"
  | "expenses"
  | "vat"
  | "annual"
  | "scenario"
  | "documents";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "overview", label: "Übersicht", icon: "chart.pie.fill" },
  { key: "budget", label: "Budget", icon: "chart.bar.doc.horizontal.fill" },
  { key: "invoices", label: "Rechnungen", icon: "doc.text.fill" },
  { key: "expenses", label: "Ein-/Ausgaben", icon: "cart.fill" },
  { key: "annual", label: "Jahresabschluss", icon: "calendar" },
  { key: "scenario", label: "Projekt-Marge", icon: "plus.forwardslash.minus" },
  { key: "vat", label: "MwSt", icon: "percent" },
  { key: "documents", label: "Dokumente", icon: "folder.fill" },
];

export default function AccountingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colors = useColors();
  const isReadOnly = useIsReadOnly();
  const { isWide, containerStyle, contentPadding } = useResponsiveLayout();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [showDunningCenter, setShowDunningCenter] = useState(false);
  const { data: invoiceSettings } = useQuery({ queryKey: ["invoiceSettings"], queryFn: Data.getInvoiceSettings });
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<string>("all");
  const [expenseEmployeeFilter, setExpenseEmployeeFilter] = useState<string>("all");
  const [expenseSearchQuery, setExpenseSearchQuery] = useState("");
  const [customExpenseCategories, setCustomExpenseCategories] = useState<{value: string; label: string}[]>([]);
  const builtinValues = new Set<string>(Data.EXPENSE_CATEGORIES.map((c) => c.value));
  const builtinLabels = new Set(Data.EXPENSE_CATEGORIES.map((c) => c.label.toLowerCase()));
  const allExpenseCategories = [
    ...Data.EXPENSE_CATEGORIES,
    ...customExpenseCategories.filter(
      (c) => !builtinValues.has(c.value) && !builtinLabels.has(c.label.toLowerCase())
    ),
  ].sort((a, b) => a.label.localeCompare(b.label));
  const [initialIsIncome, setInitialIsIncome] = useState(false);

  // Invoice Filters & Sorting
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<"all" | "unpaid" | "gesendet" | "geoeffnet" | "paid" | "overdue" | "cancelled" | "unsent" | "draft">("unpaid");

  // Deep-Link von der Dashboard-Kachel: Tab Rechnungen mit gewünschtem Filter öffnen
  useEffect(() => {
    const tab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
    if (tab === "invoices" || tab === "overview") {
      setActiveTab(tab as TabKey);
      const f = Array.isArray(params.filter) ? params.filter[0] : params.filter;
      if (f) setInvoiceStatusFilter(f as any);
      router.setParams({ tab: undefined, filter: undefined } as any);
    }
  }, [params.tab]);
  const [invoiceSort, setInvoiceSort] = useState<"date_desc" | "date_asc" | "amount_desc" | "amount_asc" | "number_desc" | "due_date_asc" | "due_date_desc">("due_date_asc");
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState("");

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
  const [scenarioHosting, setScenarioHosting] = useState("");
  const [scenarioDomain, setScenarioDomain] = useState("");
  const [scenarioOtherCosts, setScenarioOtherCosts] = useState("");
  const [deductHosting, setDeductHosting] = useState(true);
  const [deductDomain, setDeductDomain] = useState(true);
  const [deductOtherCosts, setDeductOtherCosts] = useState(true);
  const [scenarioExecutor, setScenarioExecutor] = useState<
    "inhaber" | "angestellter"
  >("angestellter");

  const scenarioRawVol = parseFloat(scenarioVolume) || 0;
  const scenarioHostC = parseFloat(scenarioHosting) || 0;
  const scenarioDomC = parseFloat(scenarioDomain) || 0;
  const scenarioOthC = parseFloat(scenarioOtherCosts) || 0;

  const scenarioDeductions = 
    (deductHosting ? scenarioHostC : 0) + 
    (deductDomain ? scenarioDomC : 0) + 
    (deductOtherCosts ? scenarioOthC : 0);

  const scenarioCalculatedVol = Math.max(0, scenarioRawVol - scenarioDeductions);
  const scenarioLohn = scenarioExecutor === "angestellter" ? scenarioCalculatedVol * 0.75 : 0;

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

  const {
    data: employees,
  } = useQuery({
    queryKey: ["employees"],
    queryFn: Data.getAllEmployees,
  });

  const {
    data: quotes,
  } = useQuery({
    queryKey: ["quotes"],
    queryFn: Data.getAllQuotes,
  });

  const knownSuppliers = useMemo(() => {
    if (!expenses) return [];
    const unique = Array.from(new Set(expenses.map((e: any) => e.supplier).filter(Boolean)));
    return unique.sort() as string[];
  }, [expenses]);

  const knownDescriptions = useMemo(() => {
    if (!expenses) return [];
    const unique = Array.from(new Set(expenses.map((e: any) => e.description).filter(Boolean)));
    return unique.sort() as string[];
  }, [expenses]);

  // Fetch Year Status
  useEffect(() => {
    Data.getAccountingYear(selectedYear).then(res => {
      setIsYearClosed(!!res?.is_closed);
    });
  }, [selectedYear]);

  // Load custom expense categories
  useEffect(() => {
    Data.getMarketingSettings().then(s => {
      try { setCustomExpenseCategories(JSON.parse(s.custom_expense_categories || "[]")); } catch { setCustomExpenseCategories([]); }
    }).catch(() => {});
  }, []);

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

  const yearInvoices = useMemo(
    () =>
      invoices?.filter(
        (i: any) => new Date(i.invoice_date).getFullYear() === selectedYear,
      ) || [],
    [invoices, selectedYear],
  );

  const isInvoiceOverdue = useCallback((i: any) => {
    if (i.dunning_stopped) return false;
    if (i.status === "overdue") return true;
    if (!["open", "sent"].includes(i.status)) return false;
    if (!i.due_date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(i.due_date) < today;
  }, []);

  const processedInvoices = useMemo(() => {
    let result = [...yearInvoices];

    // Filter
    if (invoiceStatusFilter !== "all") {
      if (invoiceStatusFilter === "unpaid") {
        result = result.filter(i => i.status !== "paid" && i.status !== "cancelled");
      } else if (invoiceStatusFilter === "overdue") {
        result = result.filter(isInvoiceOverdue);
      } else if (invoiceStatusFilter === "gesendet") {
        // DB status 'open' = versendet, aber noch nicht geöffnet
        result = result.filter(i => i.status === "open" && !isInvoiceOverdue(i));
      } else if (invoiceStatusFilter === "geoeffnet") {
        // DB status 'sent' = vom Kunden geöffnet
        result = result.filter(i => i.status === "sent" && !isInvoiceOverdue(i));
      } else if (invoiceStatusFilter === "unsent") {
        result = result.filter(i => i.status === "draft");
      } else {
        result = result.filter(i => i.status === invoiceStatusFilter);
      }
    }

    // Sort
    result.sort((a, b) => {
      if (invoiceSort === "date_desc") {
        return new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime();
      } else if (invoiceSort === "date_asc") {
        return new Date(a.invoice_date).getTime() - new Date(b.invoice_date).getTime();
      } else if (invoiceSort === "amount_desc") {
        return getInvoiceTotal(b) - getInvoiceTotal(a);
      } else if (invoiceSort === "amount_asc") {
        return getInvoiceTotal(a) - getInvoiceTotal(b);
      } else if (invoiceSort === "number_desc") {
        return (b.invoice_number || "").localeCompare(a.invoice_number || "");
      } else if (invoiceSort === "due_date_asc") {
        const dateA = a.due_date ? new Date(a.due_date).getTime() : new Date(a.invoice_date).getTime();
        const dateB = b.due_date ? new Date(b.due_date).getTime() : new Date(b.invoice_date).getTime();
        return dateA - dateB;
      } else if (invoiceSort === "due_date_desc") {
        const dateA = a.due_date ? new Date(a.due_date).getTime() : new Date(a.invoice_date).getTime();
        const dateB = b.due_date ? new Date(b.due_date).getTime() : new Date(b.invoice_date).getTime();
        return dateB - dateA;
      }
      return 0;
    });

    // Search filter
    if (invoiceSearchQuery.trim()) {
      const q = invoiceSearchQuery.toLowerCase();
      result = result.filter(i =>
        (i.invoice_number && i.invoice_number.toLowerCase().includes(q)) ||
        (i.customer?.company_name && i.customer.company_name.toLowerCase().includes(q)) ||
        (i.customer?.first_name && i.customer.first_name.toLowerCase().includes(q)) ||
        (i.customer?.last_name && i.customer.last_name.toLowerCase().includes(q)) ||
        ((i as any).description && (i as any).description.toLowerCase().includes(q))
      );
    }

    return result;
  }, [yearInvoices, invoiceStatusFilter, invoiceSort, invoiceSearchQuery]);

  // Zähler für die Status-Chips im Rechnungen-Tab (gleiche Logik wie der Filter)
  const invoiceFilterCounts = useMemo(() => {
    const c: Record<string, number> = {
      all: yearInvoices.length,
      unpaid: 0, unsent: 0, gesendet: 0, geoeffnet: 0, paid: 0, overdue: 0, cancelled: 0,
    };
    yearInvoices.forEach((i: any) => {
      if (i.status !== "paid" && i.status !== "cancelled") c.unpaid++;
      if (i.status === "draft") c.unsent++;
      if (i.status === "open" && !isInvoiceOverdue(i)) c.gesendet++;
      if (i.status === "sent" && !isInvoiceOverdue(i)) c.geoeffnet++;
      if (i.status === "paid") c.paid++;
      if (isInvoiceOverdue(i)) c.overdue++;
      if (i.status === "cancelled") c.cancelled++;
    });
    return c;
  }, [yearInvoices, isInvoiceOverdue]);

  const yearExpenses = useMemo(
    () =>
      expenses?.filter(
        (e: any) => new Date(e.expense_date).getFullYear() === selectedYear,
      ) || [],
    [expenses, selectedYear],
  );

  const processedExpenses = useMemo(() => {
    let result = [...yearExpenses];
    if (expenseCategoryFilter !== "all") {
      result = result.filter(e => e.category === expenseCategoryFilter);
    }
    if (expenseEmployeeFilter !== "all") {
      result = result.filter(e => e.user_id === expenseEmployeeFilter);
    }
    if (expenseSearchQuery.trim()) {
      const q = expenseSearchQuery.toLowerCase();
      result = result.filter(e => 
        (e.description && e.description.toLowerCase().includes(q)) ||
        (e.supplier && e.supplier.toLowerCase().includes(q)) ||
        (e.notes && e.notes.toLowerCase().includes(q)) ||
        (e.category && e.category.toLowerCase().includes(q))
      );
    }
    return result;
  }, [yearExpenses, expenseCategoryFilter, expenseEmployeeFilter, expenseSearchQuery]);

  // Stats
  const invoicesRevenue = yearInvoices.reduce((s: number, i: any) => {
    if (i.paid_amount && i.paid_amount > 0) return s + i.paid_amount;
    if (i.status === "paid") return s + getInvoiceTotal(i);
    return s;
  }, 0);

  const extraIncomes = yearExpenses
    .filter((e: any) => (e.amount || 0) < 0)
    .reduce((s: number, e: any) => s + Math.abs(e.amount || 0), 0);

  const totalRevenue = invoicesRevenue + extraIncomes;

  const totalOpen = yearInvoices
    .filter((i: any) => (i.status === "open" || i.status === "sent") && !isInvoiceOverdue(i))
    .reduce((s: number, i: any) => {
      return s + Math.max(0, getInvoiceTotal(i) - (i.paid_amount || 0));
    }, 0);

  const totalOverdue = yearInvoices
    .filter(isInvoiceOverdue)
    .reduce((s: number, i: any) => {
      return s + Math.max(0, getInvoiceTotal(i) - (i.paid_amount || 0));
    }, 0);
  const totalUnsent = yearInvoices
    .filter((i: any) => i.status === "draft")
    .reduce((s: number, i: any) => {
      return s + getInvoiceTotal(i);
    }, 0);
  // Gefilterte Summe (nur für die Anzeige im Ausgaben-Tab)
  const totalExpenses = processedExpenses
    .filter((e: any) => (e.amount || 0) > 0)
    .reduce((s: number, e: any) => s + (e.amount || 0), 0);
  // ALLE Ausgaben des Jahres — unabhängig von Tab-Filtern und vom
  // "Geschäftsausgabe"-Schalter (für Gewinn/Verlust = Kontostand-Sicht)
  const totalExpensesAll = yearExpenses
    .filter((e: any) => (e.amount || 0) > 0)
    .reduce((s: number, e: any) => s + (e.amount || 0), 0);
  const deductibleExpenses = yearExpenses
    .filter((e: any) => e.is_deductible && (e.amount || 0) > 0)
    .reduce((s: number, e: any) => s + (e.amount || 0), 0);

  const { sentQuotesBase, sentQuotesOptional } = useMemo(() => {
    const sentQuotes = (quotes || []).filter((q: any) => q.status === "sent");
    const base = sentQuotes.reduce((s: number, q: any) => s + (q.total || 0), 0);
    const optional = sentQuotes.reduce((s: number, q: any) =>
      s + (q.items || [])
        .filter((i: any) => i.optional)
        .reduce((os: number, i: any) => os + (i.total || 0), 0)
    , 0);
    return { sentQuotesBase: base, sentQuotesOptional: optional };
  }, [quotes]);

  const totalSentQuotes = sentQuotesBase + sentQuotesOptional;

  const profit = totalRevenue - totalExpensesAll;
  const grossNetIncome = totalRevenue - deductibleExpenses;
  
  // Bereits bezahlte Akonto-Rechnungen (Kategorie Sozialversicherungen) extrahieren
  const paidSocialSecurity = yearExpenses
    .filter((e: any) => e.category === "social_security" && e.is_deductible && (e.amount || 0) > 0)
    .reduce((s: number, e: any) => s + (e.amount || 0), 0);
    
  // Für die Berechnung der pauschalen Abzüge schlagen wir die bereits bezahlten Beträge wieder auf, 
  // da die Abzüge sich auf den Gewinn VOR Sozialversicherungsaufwand beziehen.
  const grossNetIncomeBeforeSS = grossNetIncome + paidSocialSecurity;
  
  // AHV-Gesamtschuld berechnen auf Gewinn VOR AHV-Akonto
  // (10.6% ≈ 10% Selbständigen-Satz AHV/IV/EO + Verwaltungskosten der Ausgleichskasse)
  const ownerAhvIvEoTotal = grossNetIncomeBeforeSS > 0 ? grossNetIncomeBeforeSS * 0.106 : 0;
  // Netto-AHV-Effekt: positiv = noch geschuldet, negativ = Überzahlung (Rückerstattung)
  const ahvNetEffect = ownerAhvIvEoTotal - paidSocialSecurity;
  const ownerAhvIvEoRemaining = Math.max(0, ahvNetEffect);
  const ahvOverpayment = Math.max(0, -ahvNetEffect); // Zu viel bezahlt → kommt zurück

  // FAK wird wie die AHV auf dem Einkommen VOR Sozialversicherungsaufwand
  // berechnet – sonst hängt die Schätzung davon ab, wie viel Akonto schon bezahlt ist
  const ownerFak = grossNetIncomeBeforeSS > 0 ? grossNetIncomeBeforeSS * 0.014 : 0;
  // Steuerbares Einkommen ≈ Gewinn vor Sozialabgaben abzüglich gesamter AHV und FAK
  // (beide sind abzugsfähig – unabhängig davon, ob schon per Akonto bezahlt)
  const taxableIncome = Math.max(0, grossNetIncomeBeforeSS - ownerAhvIvEoTotal - ownerFak);
  const ownerEinkommenssteuer = taxableIncome * 0.15;
  
  // Gesamtabzüge = noch ausstehende AHV + FAK + Steuern
  const ownerTotalAbzuege = ownerAhvIvEoRemaining + ownerFak + ownerEinkommenssteuer;
  
  // netIncome = Gewinn nach Ausgaben minus noch ausstehende Abzüge + eventuelle AHV-Überzahlung
  const netIncome = grossNetIncome - ownerTotalAbzuege + ahvOverpayment;

  // Umsatz-Schwelle MwSt (CHF 100'000)
  const MWST_THRESHOLD = 100000;
  const totalAllRevenue = totalRevenue;
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
          allExpenseCategories.find((c) => c.value === cat)?.label || cat,
        amount,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [yearExpenses, allExpenseCategories]);

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
        .filter((i: any) => new Date(i.invoice_date).getMonth() === idx)
        .reduce((s: number, i: any) => {
          if (i.paid_amount && i.paid_amount > 0) return s + i.paid_amount;
          if (i.status === "paid") return s + getInvoiceTotal(i);
          return s;
        }, 0) +
        yearExpenses
          .filter((e: any) => new Date(e.expense_date).getMonth() === idx && (e.amount || 0) < 0)
          .reduce((s: number, e: any) => s + Math.abs(e.amount || 0), 0);
          
      const exp = yearExpenses
        .filter((e: any) => new Date(e.expense_date).getMonth() === idx && (e.amount || 0) > 0)
        .reduce((s: number, e: any) => s + (e.amount || 0), 0);
      return { label, revenue: rev, expenses: exp };
    });
  }, [yearInvoices, yearExpenses]);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "draft":
        return "Ungesendet";
      case "open":
        return "Gesendet";  // versendet, aber noch nicht vom Kunden geöffnet
      case "sent":
        return "Geöffnet";  // vom Kunden geöffnet
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

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "open":     return "#f59e0b"; // amber — gesendet, ausstehend
      case "sent":     return "#3b82f6"; // blue — geöffnet
      case "paid":     return "#22c55e"; // green/success
      case "overdue":  return "#ef4444"; // red/error
      case "draft":    return "#6b7280"; // gray
      case "cancelled": return "#6b7280";
      default:         return "#6b7280";
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
    const lohn = scenarioLohn;
    const anAhv = lohn * 0.053;
    const anAlv = lohn * 0.011;
    const nettolohn = lohn - anAhv - anAlv;

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
        amount: nettolohn,
        description: `Leistungsbezug: ${data.freelancerName}`,
        category: "salary",
        supplier: data.freelancerName,
        payment_method: "bank",
        tax_rate: 0,
        is_deductible: true,
        notes: `Automatische Verbuchung aus Szenario-Modell.\nNetto-Auszahlung (Basis-Brutto: ${formatCurrency(lohn)} CHF).\nIBAN: ${data.freelancerIban}\nKunde: ${data.customerId}\nProjekt: ${data.projectId}`,
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
      // Custom categories (these match the internal 'value' generated for them)
      app_verkauf: "cart.fill",
      handelsregister: "building.columns.fill",
      merchandies: "tshirt.fill",
      sonstiges: "ellipsis.circle.fill",
      sozialverscicherungen: "cross.case.fill",
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

  // ─── renderBudget ──────────────────────────────────────────────────────────
  const renderBudget = () => <BudgetTab
    selectedYear={selectedYear}
    renderYearSelector={renderYearSelector}
    totalRevenue={totalRevenue}
    yearExpenses={yearExpenses}
    profit={netIncome}
    colors={colors}
  />;

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
              {formatCurrency(totalExpensesAll)}
            </Text>
          </View>
        </View>
        <Text className="text-xs text-muted mt-2">
          Alle Ein- und Ausgänge {selectedYear} — unabhängig vom Schalter «Geschäftsausgabe»
        </Text>
      </View>

      {/* Reingewinn / Nettoeinkommen Inhaber */}
      <View
        className="rounded-xl p-5 border border-border"
        style={{
          backgroundColor:
            netIncome >= 0 ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
        }}
      >
        <Text className="text-sm text-muted mb-1">
          Reingewinn (Nettoeinkommen Inhaber)
        </Text>
        <Text
          className="text-3xl font-bold"
          style={{ color: netIncome >= 0 ? "#16a34a" : "#dc2626" }}
        >
          {formatCurrency(netIncome)}
        </Text>
        <Text className="text-xs text-muted mt-2 mb-3">
          Einnahmen abzgl. abzugsfähiger Ausgaben & Sozialabgaben/Steuern
        </Text>
        {grossNetIncome > 0 && (
          <View className="border-t border-border pt-3 gap-1">
            <View className="flex-row justify-between">
              <Text className="text-xs text-muted">Gewinn vor Abzügen</Text>
              <Text className="text-xs text-foreground font-semibold">{formatCurrency(grossNetIncome)}</Text>
            </View>
            <View className="flex-row justify-between mt-1">
              <Text className="text-xs text-muted">↳ AHV/IV/EO (noch ausstehend)</Text>
              <Text className="text-xs text-error">-{formatCurrency(ownerAhvIvEoRemaining)}</Text>
            </View>
            {paidSocialSecurity > 0 && (
              <View className="flex-row justify-between">
                <Text className="text-xs ml-3" style={{ color: "#6b7280", fontStyle: "italic" }}>
                  ℹ︎ Gesamtschuld {formatCurrency(ownerAhvIvEoTotal)}, {formatCurrency(paidSocialSecurity)} per Akonto bezahlt
                </Text>
              </View>
            )}
            {ahvOverpayment > 0 && (
              <View className="flex-row justify-between mt-1">
                <Text className="text-xs text-muted">↳ AHV-Überzahlung (Rückerstattung)</Text>
                <Text className="text-xs text-success">+{formatCurrency(ahvOverpayment)}</Text>
              </View>
            )}
            <View className="flex-row justify-between mt-1">
              <Text className="text-xs text-muted">↳ FAK Luzern (1.4%)</Text>
              <Text className="text-xs text-error">-{formatCurrency(ownerFak)}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-xs text-muted">↳ Einkommenssteuer (ca. 15%)</Text>
              <Text className="text-xs text-error">-{formatCurrency(ownerEinkommenssteuer)}</Text>
            </View>
            <View className="flex-row justify-between border-t border-border pt-1 mt-1">
              <Text className="text-xs text-muted font-semibold">Total Abzüge</Text>
              <Text className="text-xs text-error font-semibold">-{formatCurrency(ownerTotalAbzuege)}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Quick Stats */}
      <View className="flex-row gap-3">
        <TouchableOpacity 
          className="flex-1 bg-surface rounded-xl p-4 border border-border"
          activeOpacity={0.7}
          onPress={() => {
            setInvoiceStatusFilter("unpaid");
            setActiveTab("invoices");
          }}
        >
          <Text className="text-xs text-muted mb-1">Offene Posten</Text>
          <Text className="text-xl font-bold text-warning">
            {formatCurrency(totalOpen)}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          className="flex-1 bg-surface rounded-xl p-4 border border-border"
          activeOpacity={0.7}
          onPress={() => {
            setInvoiceStatusFilter("overdue");
            setActiveTab("invoices");
          }}
        >
          <Text className="text-xs text-muted mb-1">Überfällig</Text>
          <Text className="text-xl font-bold text-error">
            {formatCurrency(totalOverdue)}
          </Text>
        </TouchableOpacity>
      </View>

      <View className="flex-row gap-3">
        <TouchableOpacity 
          className="flex-1 bg-surface rounded-xl p-4 border border-border"
          activeOpacity={0.7}
          onPress={() => {
            setInvoiceStatusFilter("unsent");
            setActiveTab("invoices");
          }}
        >
          <Text className="text-xs text-muted mb-1">Ungesendet</Text>
          <Text className="text-xl font-bold text-foreground">
            {formatCurrency(totalUnsent)}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          className="flex-1 bg-surface rounded-xl p-4 border border-border"
          activeOpacity={0.7}
          onPress={() => expoRouter.push("/quotes" as any)}
        >
          <Text className="text-xs text-muted mb-1">Offene Angebote</Text>
          <Text className="text-xl font-bold text-primary">
            {formatCurrency(sentQuotesBase)}
          </Text>
          {sentQuotesOptional > 0 && (
            <Text className="text-xs text-muted mt-0.5">
              Inkl. Opt: {formatCurrency(sentQuotesBase + sentQuotesOptional)}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Ausgaben nach Kategorie */}
      {expensesByCategory.length > 0 && (
        <View className="bg-surface rounded-xl p-4 border border-border">
          <Text className="text-sm font-bold text-foreground mb-3">
            Ausgaben nach Kategorie
          </Text>
          {expensesByCategory.map((cat) => (
            <TouchableOpacity
              key={cat.category}
              className="flex-row items-center justify-between py-2 border-b border-border"
              activeOpacity={0.6}
              onPress={() => {
                setExpenseCategoryFilter(cat.category);
                setActiveTab("expenses");
              }}
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
              <View className="flex-row items-center gap-2">
                <Text className="text-sm font-semibold text-foreground">
                  {formatCurrency(cat.amount)}
                </Text>
                <IconSymbol name="chevron.right" size={14} color={colors.muted} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Kunden-Profitabilität */}
      <CustomerProfitabilityCard selectedYear={selectedYear} colors={colors} />

      {/* Umsatz-Forecast 3 Monate */}
      <ForecastCard colors={colors} />

      {/* Liquiditätsvorschau 90 Tage */}
      <LiquidityCard colors={colors} />

      {/* Debitoren: Zahlungsmoral */}
      <DebtorCard colors={colors} />
    </View>
  );

  const INVOICE_FILTERS: { label: string; value: string; color: string }[] = [
    { label: "Noch nicht bezahlt", value: "unpaid", color: "#F59E0B" },
    { label: "Alle", value: "all", color: colors.primary },
    { label: "Überfällig", value: "overdue", color: "#EF4444" },
    { label: "Ungesendet", value: "unsent", color: "#6B7280" },
    { label: "Gesendet", value: "gesendet", color: "#F59E0B" },
    { label: "Geöffnet", value: "geoeffnet", color: "#3B82F6" },
    { label: "Bezahlt", value: "paid", color: "#22C55E" },
    { label: "Storniert", value: "cancelled", color: "#9CA3AF" },
  ];

  const renderInvoices = () => {
    const filteredTotal = processedInvoices.reduce((s: number, i: any) => s + getInvoiceTotal(i), 0);
    return (
    <View>
      {loadingInvoices ? (
        <View className="flex-1 items-center justify-center py-12">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : invoices && invoices.length > 0 ? (
        <View className="gap-3">
          {renderYearSelector()}

          {/* Zusammenfassung + Neue Rechnung */}
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-base font-bold text-foreground">
                {processedInvoices.length} {processedInvoices.length === 1 ? "Rechnung" : "Rechnungen"}
              </Text>
              <Text className="text-xs text-muted">{formatCurrency(filteredTotal)} in dieser Ansicht</Text>
            </View>
            {!isReadOnly && (
            <TouchableOpacity
              className={`flex-row items-center gap-1.5 px-4 py-2.5 rounded-xl ${isYearClosed ? "bg-muted" : "bg-primary"}`}
              activeOpacity={0.8}
              onPress={() => {
                if (isYearClosed) {
                  showAlert("Gesperrt", "Dieses Jahr ist bereits abgeschlossen und kann nicht mehr verändert werden.");
                  return;
                }
                setShowInvoiceModal(true);
              }}
            >
              <IconSymbol name="plus" size={16} color="#FFFFFF" />
              <Text className="text-background font-semibold text-sm">Neue Rechnung</Text>
            </TouchableOpacity>
            )}
          </View>

          {/* Bankabgleich + Export */}
          <View className="flex-row gap-3">
            <TouchableOpacity
              className="flex-1 flex-row items-center justify-center gap-2 bg-surface border border-border py-2.5 rounded-xl"
              activeOpacity={0.7}
              onPress={() => setShowBankModal(true)}
            >
              <IconSymbol name="building.columns.fill" size={15} color={colors.primary} />
              <Text className="text-sm font-semibold" style={{ color: colors.primary }}>
                Bankabgleich
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-row items-center justify-center gap-2 bg-surface border border-border py-2.5 px-3 rounded-xl"
              activeOpacity={0.7}
              onPress={() => setShowDunningCenter(true)}
            >
              <IconSymbol name="bell.fill" size={15} color="#EF4444" />
              <Text className="text-sm font-semibold" style={{ color: "#EF4444" }}>Mahnen</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-row items-center justify-center gap-2 bg-surface border border-border py-2.5 px-4 rounded-xl"
              activeOpacity={0.7}
              onPress={() =>
                exportCsv(
                  `Rechnungen_${selectedYear}.csv`,
                  processedInvoices,
                  [
                    { key: "invoice_number", label: "Nummer" },
                    { key: "invoice_date", label: "Datum" },
                    { key: "due_date", label: "Fällig" },
                    { key: "customer", label: "Kunde", map: (i: any) => i.customer?.company_name || `${i.customer?.first_name || ""} ${i.customer?.last_name || ""}`.trim() },
                    { key: "status", label: "Status" },
                    { key: "total", label: "Betrag", map: (i: any) => getInvoiceTotal(i).toFixed(2) },
                  ]
                ).catch((e: any) => showAlert("Fehler", e.message))
              }
            >
              <IconSymbol name="square.and.arrow.up" size={15} color={colors.primary} />
              <Text className="text-sm font-semibold" style={{ color: colors.primary }}>CSV</Text>
            </TouchableOpacity>
          </View>

          {/* Suche */}
          <View className="flex-row items-center bg-surface border border-border rounded-xl px-3 py-2.5 gap-2">
            <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
            <TextInput
              value={invoiceSearchQuery}
              onChangeText={setInvoiceSearchQuery}
              placeholder="Rechnung oder Kunde suchen..."
              placeholderTextColor={colors.muted}
              style={{ flex: 1, color: colors.foreground, fontSize: 14 }}
            />
            {invoiceSearchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setInvoiceSearchQuery("")}>
                <IconSymbol name="xmark.circle.fill" size={16} color={colors.muted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Status-Chips mit Zählern */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
            {INVOICE_FILTERS.map((opt) => {
              const active = invoiceStatusFilter === opt.value;
              const count = invoiceFilterCounts[opt.value] || 0;
              if (opt.value === "overdue" && count === 0) return null;
              if (opt.value === "cancelled" && count === 0) return null;
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setInvoiceStatusFilter(opt.value as any)}
                  activeOpacity={0.8}
                  className="flex-row items-center px-3 py-1.5 rounded-full border"
                  style={{
                    backgroundColor: active ? opt.color : colors.surface,
                    borderColor: active ? opt.color : colors.border,
                  }}
                >
                  <Text className="text-xs font-semibold" style={{ color: active ? "#fff" : colors.foreground }}>
                    {opt.label}
                  </Text>
                  <Text className="text-xs font-bold ml-1.5" style={{ color: active ? "#fff" : opt.color }}>
                    {count}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Sortierung */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 16, alignItems: "center" }}>
            <IconSymbol name="arrow.up.arrow.down" size={13} color={colors.muted} />
            {[
              { label: "Nächste Fälligkeit", value: "due_date_asc" },
              { label: "Neueste", value: "date_desc" },
              { label: "Älteste", value: "date_asc" },
              { label: "Höchster Betrag", value: "amount_desc" },
              { label: "Niedrigster Betrag", value: "amount_asc" },
              { label: "Nr. absteigend", value: "number_desc" },
            ].map((sort) => {
              const active = invoiceSort === sort.value;
              return (
                <TouchableOpacity
                  key={sort.value}
                  onPress={() => setInvoiceSort(sort.value as any)}
                  activeOpacity={0.8}
                  className="px-3 py-1 rounded-full border"
                  style={{
                    backgroundColor: active ? colors.primary + "15" : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  }}
                >
                  <Text className="text-xs font-semibold" style={{ color: active ? colors.primary : colors.foreground }}>
                    {sort.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {processedInvoices.length === 0 && (
             <View className="items-center py-10">
               <IconSymbol name="doc.text" size={40} color={colors.muted} />
               <Text className="text-base font-semibold text-foreground mt-3">Keine Rechnungen gefunden</Text>
               <Text className="text-sm text-muted mt-1">Suche oder Filter anpassen.</Text>
             </View>
          )}

          {processedInvoices.map((invoice: any) => {
            const customerName =
              invoice.customer?.company_name ||
              `${invoice.customer?.first_name || ""} ${invoice.customer?.last_name || ""}`.trim() ||
              "Unbekannt";
            const overdue = isInvoiceOverdue(invoice);
            const statusColor = overdue ? "#EF4444" : getStatusColor(invoice.status);
            const restbetrag = Math.max(0, getInvoiceTotal(invoice) - (invoice.paid_amount || 0));
            return (
              <TouchableOpacity
                key={invoice.id}
                className="bg-surface rounded-xl border border-border overflow-hidden"
                style={{ flexDirection: "row" }}
                activeOpacity={0.7}
                onPress={() => {
                    if (isYearClosed) {
                        showAlert("Hinweis", "Dieses Jahr ist abgeschlossen (Nur-Lese-Modus).");
                    }
                    expoRouter.push(`/invoice/${invoice.id}` as any);
                }}
              >
                {/* Farbiger Status-Streifen links */}
                <View style={{ width: 4, backgroundColor: statusColor }} />
                <View className="flex-1 p-3.5">
                  <View className="flex-row items-center mb-1.5">
                    <Text className="text-[11px] font-semibold text-muted">{invoice.invoice_number}</Text>
                    <View className="flex-1" />
                    <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: statusColor + "18" }}>
                      <Text className="text-[10px] font-bold" style={{ color: statusColor }}>
                        {overdue ? "Überfällig" : getStatusLabel(invoice.status)}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-base font-bold text-foreground" numberOfLines={1}>
                    {customerName}
                  </Text>
                  <View className="flex-row items-end justify-between mt-2">
                    <View className="flex-row items-center flex-1 mr-2">
                      {overdue && (
                        <IconSymbol name="exclamationmark.triangle.fill" size={11} color="#EF4444" style={{ marginRight: 4 }} />
                      )}
                      <Text className="text-[11px]" style={{ color: overdue ? "#EF4444" : colors.muted, fontWeight: overdue ? "700" : "400" }}>
                        {invoice.status === 'draft' ? "Ungesendet" : `${formatDate(invoice.invoice_date)} · Fällig ${formatDate(invoice.due_date)}`}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-base font-bold text-foreground">
                        {formatCurrency(getInvoiceTotal(invoice))}
                      </Text>
                      {(invoice.paid_amount || 0) > 0 && invoice.status !== 'paid' && (
                        <Text className="text-[11px] font-semibold text-warning mt-0.5">
                          Rest: {formatCurrency(restbetrag)}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <View className="flex-1 items-center justify-center py-16">
          <IconSymbol name="doc.text.fill" size={48} color={colors.muted} />
          <Text className="text-base font-semibold text-foreground mt-4">Noch keine Rechnungen</Text>
          <Text className="text-sm text-muted mt-1">Erstelle deine erste Rechnung.</Text>
          <TouchableOpacity
            className="bg-primary px-6 py-3 rounded-xl mt-5"
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
  };

  const renderExpenses = () => {
    const filteredIncome = processedExpenses
      .filter((e: any) => (e.amount || 0) < 0)
      .reduce((s: number, e: any) => s + Math.abs(e.amount || 0), 0);
    const filteredExpense = processedExpenses
      .filter((e: any) => (e.amount || 0) > 0)
      .reduce((s: number, e: any) => s + (e.amount || 0), 0);
    const filteredSaldo = filteredIncome - filteredExpense;
    return (
    <View>
      {loadingExpenses ? (
        <View className="flex-1 items-center justify-center py-12">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View className="gap-3">
          {renderYearSelector()}

          {/* Zusammenfassung + Neue Ein-/Ausgabe */}
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-base font-bold text-foreground">
                {processedExpenses.length} {processedExpenses.length === 1 ? "Buchung" : "Buchungen"}
              </Text>
              <Text className="text-xs text-muted">in dieser Ansicht</Text>
            </View>
            <TouchableOpacity
              className={`flex-row items-center gap-1.5 px-4 py-2.5 rounded-xl ${isYearClosed ? "bg-muted" : "bg-primary"}`}
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
              <IconSymbol name="plus" size={16} color="#FFFFFF" />
              <Text className="text-background font-semibold text-sm">Neue Buchung</Text>
            </TouchableOpacity>
          </View>

          {/* Wiederkehrende Ausgaben */}
          <RecurringExpensesCard colors={colors} />

          {yearExpenses.length > 0 ? (
            <>
              {/* Kennzahlen der gefilterten Ansicht */}
              <View className="flex-row gap-2">
                <View className="flex-1 bg-surface rounded-xl border border-border p-3 items-center">
                  <Text className="text-lg font-bold text-success">{formatCurrency(filteredIncome)}</Text>
                  <Text className="text-[10px] font-semibold text-muted uppercase">Einnahmen</Text>
                </View>
                <View className="flex-1 bg-surface rounded-xl border border-border p-3 items-center">
                  <Text className="text-lg font-bold text-error">{formatCurrency(filteredExpense)}</Text>
                  <Text className="text-[10px] font-semibold text-muted uppercase">Ausgaben</Text>
                </View>
                <View className="flex-1 bg-surface rounded-xl border border-border p-3 items-center">
                  <Text className="text-lg font-bold" style={{ color: filteredSaldo >= 0 ? "#22C55E" : "#EF4444" }}>
                    {formatCurrency(filteredSaldo)}
                  </Text>
                  <Text className="text-[10px] font-semibold text-muted uppercase">Saldo</Text>
                </View>
              </View>

              {/* Suche */}
              <View className="flex-row items-center bg-surface border border-border rounded-xl px-3 py-2.5 gap-2">
                <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
                <TextInput
                  value={expenseSearchQuery}
                  onChangeText={setExpenseSearchQuery}
                  placeholder="Beschreibung oder Lieferant suchen..."
                  placeholderTextColor={colors.muted}
                  style={{ flex: 1, color: colors.foreground, fontSize: 14 }}
                />
                {expenseSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setExpenseSearchQuery("")}>
                    <IconSymbol name="xmark.circle.fill" size={16} color={colors.muted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Kategorie-Filter */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, alignItems: "center", paddingRight: 16 }}>
                <IconSymbol name="tag.fill" size={13} color={colors.muted} />
                {[{ value: "all", label: "Alle" }, ...allExpenseCategories].map((cat) => {
                  const active = expenseCategoryFilter === cat.value;
                  return (
                    <TouchableOpacity
                      key={cat.value}
                      onPress={() => setExpenseCategoryFilter(cat.value)}
                      activeOpacity={0.8}
                      className="px-3 py-1.5 rounded-full border"
                      style={{
                        backgroundColor: active ? colors.primary : colors.surface,
                        borderColor: active ? colors.primary : colors.border,
                      }}
                    >
                      <Text className="text-xs font-semibold" style={{ color: active ? "#fff" : colors.foreground }}>{cat.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Mitarbeiter-Filter */}
              {(employees?.length || 0) > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, alignItems: "center", paddingRight: 16 }}>
                  <IconSymbol name="person.2.fill" size={13} color={colors.muted} />
                  {[{ id: "all", name: "Alle" }, ...(employees || [])].map((emp: any) => {
                    const active = expenseEmployeeFilter === emp.id;
                    return (
                      <TouchableOpacity
                        key={emp.id}
                        onPress={() => setExpenseEmployeeFilter(emp.id)}
                        activeOpacity={0.8}
                        className="px-3 py-1.5 rounded-full border"
                        style={{
                          backgroundColor: active ? colors.primary : colors.surface,
                          borderColor: active ? colors.primary : colors.border,
                        }}
                      >
                        <Text className="text-xs font-semibold" style={{ color: active ? "#fff" : colors.foreground }}>{emp.name || emp.email}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              {processedExpenses.length === 0 && (
                <View className="items-center py-10">
                  <IconSymbol name="cart.fill" size={40} color={colors.muted} />
                  <Text className="text-base font-semibold text-foreground mt-3">Keine Buchungen gefunden</Text>
                  <Text className="text-sm text-muted mt-1">Suche oder Filter anpassen.</Text>
                </View>
              )}

              {processedExpenses.map((expense: any) => (
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
                      <View className={`w-8 h-8 rounded-lg ${expense.amount < 0 ? 'bg-success/20' : 'bg-error/20'} items-center justify-center`}>
                        <IconSymbol
                          name={getCategoryIcon(expense.category) as any}
                          size={14}
                          color={expense.amount < 0 ? "#22c55e" : (colors.error || "#ef4444")}
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
                          {allExpenseCategories.find(
                            (c) => c.value === expense.category,
                          )?.label || expense.category}
                          {expense.supplier ? ` · ${expense.supplier}` : ""}
                          {expense.user?.name ? ` · Erfasst von: ${expense.user.name}` : ""}
                        </Text>
                      </View>
                    </View>
                    <View className="items-end">
                      <Text className={`text-base font-bold ${expense.amount < 0 ? 'text-success' : 'text-error'}`}>
                        {expense.amount < 0 ? '+' : '-'}{formatCurrency(Math.abs(expense.amount || 0))}
                      </Text>
                      <Text className="text-xs text-muted">
                        {formatDate(expense.expense_date)}
                      </Text>
                    </View>
                  </View>
                  {Math.abs(expense.tax_amount || 0) > 0 && (
                    <Text className="text-xs text-muted mt-1">
                      {expense.amount < 0 ? "Umsatzsteuer" : "Vorsteuer"}: {formatCurrency(Math.abs(expense.tax_amount))} (
                      {expense.tax_rate}%)
                      {expense.is_deductible && expense.amount > 0 ? " · Abzugsfähig" : ""}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </>
          ) : (
            <View className="items-center justify-center py-12">
              <IconSymbol name="cart.fill" size={48} color={colors.muted} />
              <Text className="text-base font-semibold text-foreground mt-4">
                Noch keine Ein-/Ausgaben
              </Text>
              <Text className="text-sm text-muted text-center mt-1">
                Erfasse Geschäftsausgaben und Einnahmen für die Steuerabrechnung.
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
    );
  };

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
    const sachaufwand = totalExpensesAll - salaryExpense;

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

  const renderScenario = () => (
    <View className="gap-4">
      {renderYearSelector()}

      <View className="bg-surface rounded-xl p-5 border border-border">
        <View className="flex-row items-center gap-2 mb-4">
          <IconSymbol name="plus.forwardslash.minus" size={20} color={colors.primary} />
          <Text className="text-base font-bold text-foreground">Szenario-Modell: Projekt-Marge</Text>
        </View>

        <Text className="text-sm text-muted mb-4">
          Berechnen Sie die verbleibende Marge für Gross ICT, wenn Aufträge an Freelancer bzw. externe Personen ausgelagert werden.
        </Text>

        <View className="mb-4">
          <Text className="text-xs font-semibold text-foreground mb-2">AUFTRAGSVOLUMEN (CHF)</Text>
          <TextInput value={scenarioVolume} onChangeText={setScenarioVolume} keyboardType="numeric" className="bg-background border border-border rounded-lg p-3 text-foreground" placeholder="10000" placeholderTextColor={colors.muted} />
        </View>

        <View className="mb-4 gap-3">
          <Text className="text-xs font-semibold text-foreground">WEITERE KOSTEN (CHF)</Text>
          <View className="flex-row items-center gap-2">
            <View className="flex-1"><TextInput value={scenarioHosting} onChangeText={setScenarioHosting} keyboardType="numeric" className="bg-background border border-border rounded-lg p-3 text-foreground" placeholder="Hosting Kosten" placeholderTextColor={colors.muted} /></View>
            <View className="flex-row items-center gap-2 bg-background p-2 px-3 rounded-lg border border-border"><Text className="text-xs text-foreground">Abziehen?</Text><Switch value={deductHosting} onValueChange={setDeductHosting} trackColor={{ false: colors.border, true: colors.primary }} /></View>
          </View>
          <View className="flex-row items-center gap-2">
            <View className="flex-1"><TextInput value={scenarioDomain} onChangeText={setScenarioDomain} keyboardType="numeric" className="bg-background border border-border rounded-lg p-3 text-foreground" placeholder="Domain Kosten" placeholderTextColor={colors.muted} /></View>
            <View className="flex-row items-center gap-2 bg-background p-2 px-3 rounded-lg border border-border"><Text className="text-xs text-foreground">Abziehen?</Text><Switch value={deductDomain} onValueChange={setDeductDomain} trackColor={{ false: colors.border, true: colors.primary }} /></View>
          </View>
          <View className="flex-row items-center gap-2">
            <View className="flex-1"><TextInput value={scenarioOtherCosts} onChangeText={setScenarioOtherCosts} keyboardType="numeric" className="bg-background border border-border rounded-lg p-3 text-foreground" placeholder="Sonstige Kosten" placeholderTextColor={colors.muted} /></View>
            <View className="flex-row items-center gap-2 bg-background p-2 px-3 rounded-lg border border-border"><Text className="text-xs text-foreground">Abziehen?</Text><Switch value={deductOtherCosts} onValueChange={setDeductOtherCosts} trackColor={{ false: colors.border, true: colors.primary }} /></View>
          </View>
        </View>

        <View className="mb-4">
          <Text className="text-xs font-semibold text-foreground mb-2">AUSFÜHRENDE PERSON</Text>
          <View className="flex-row gap-2">
            <TouchableOpacity className={`flex-1 py-3 px-4 rounded-lg items-center justify-center border ${scenarioExecutor === "inhaber" ? "bg-primary border-primary" : "bg-background border-border"}`} onPress={() => setScenarioExecutor("inhaber")}>
              <Text className={`font-semibold ${scenarioExecutor === "inhaber" ? "text-background" : "text-foreground"}`}>Inhaber</Text>
            </TouchableOpacity>
            <TouchableOpacity className={`flex-1 py-3 px-4 rounded-lg items-center justify-center border ${scenarioExecutor === "angestellter" ? "bg-primary border-primary" : "bg-background border-border"}`} onPress={() => setScenarioExecutor("angestellter")}>
              <Text className={`font-semibold ${scenarioExecutor === "angestellter" ? "text-background" : "text-foreground"}`}>Angestellter</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Scenario Result */}
        <View className="bg-background border border-border rounded-lg p-4 mt-2">
          {(() => {
            const vol = scenarioCalculatedVol;
            const isEmployee = scenarioExecutor === "angestellter";
            const lohn = scenarioLohn;
            const agBeitrag = isEmployee ? lohn * 0.064 : 0;
            const agFak = isEmployee ? lohn * 0.014 : 0;
            const uvg = isEmployee ? lohn * 0.01 : 0;
            const anAhv = isEmployee ? lohn * 0.053 : 0;
            const anAlv = isEmployee ? lohn * 0.011 : 0;
            const anBeitrag = anAhv + anAlv;
            const nettoLohn = isEmployee ? lohn - anBeitrag : 0;
            const baseMarge = vol - lohn - agBeitrag - agFak - uvg;
            const totalMarge = baseMarge + scenarioDeductions;
            const ownerAhv = baseMarge > 0 ? baseMarge * 0.106 : 0;
            const ownerFak = baseMarge > 0 ? baseMarge * 0.014 : 0;
            const ownerSteuer = baseMarge > 0 ? baseMarge * 0.15 : 0;
            const ownerDeductions = ownerAhv + ownerFak + ownerSteuer;
            const nettoMarge = totalMarge - ownerDeductions;
            const vermittlung = isEmployee ? vol * 0.1 : 0;
            const restMarge = isEmployee ? nettoMarge - vermittlung : 0;
            return (
              <View className="gap-2">
                {scenarioDeductions > 0 && (
                  <View className="flex-row justify-between mb-2 pb-2 border-b border-border border-dashed">
                    <Text className="text-sm text-muted">Aktivierte Abzüge</Text>
                    <Text className="text-sm text-muted">-{formatCurrency(scenarioDeductions)}</Text>
                  </View>
                )}
                {isEmployee && (
                  <>
                    <View className="flex-row justify-between mb-2"><Text className="text-sm text-foreground font-semibold">Berechnetes Projekt-Volumen</Text><Text className="text-sm font-semibold">{formatCurrency(vol)}</Text></View>
                    <View className="flex-row justify-between"><Text className="text-sm text-muted">Brutto-Lohn Angestellter (75%)</Text><Text className="text-sm text-error">-{formatCurrency(lohn)}</Text></View>
                    <View className="flex-row justify-between"><Text className="text-xs text-muted ml-2">↳ AN-Beitrag AHV/IV/EO (5.3%)</Text><Text className="text-xs text-error">-{formatCurrency(anAhv)}</Text></View>
                    <View className="flex-row justify-between mt-1"><Text className="text-xs text-muted ml-2">↳ AN-Beitrag ALV (1.1%)</Text><Text className="text-xs text-error">-{formatCurrency(anAlv)}</Text></View>
                    <View className="flex-row justify-between pt-1 mt-1 border-t border-border border-dotted mb-3"><Text className="text-xs font-semibold text-foreground ml-2">= Netto-Lohn / Auszahlung (ca.)</Text><Text className="text-xs font-bold text-success">{formatCurrency(nettoLohn)}</Text></View>
                    <View className="flex-row justify-between mt-3 mb-1"><Text className="text-sm font-semibold text-foreground">Arbeitgeber-Zusatzkosten (ca.)</Text><Text className="text-sm font-semibold text-error">-{formatCurrency(agBeitrag + agFak + uvg)}</Text></View>
                    <View className="flex-row justify-between"><Text className="text-xs text-muted ml-2">↳ AG-Beitrag AHV/IV/ALV (6.4%)</Text><Text className="text-xs text-error">-{formatCurrency(agBeitrag)}</Text></View>
                    <View className="flex-row justify-between mt-1"><Text className="text-xs text-muted ml-2">↳ FAK Luzern (1.4%)</Text><Text className="text-xs text-error">-{formatCurrency(agFak)}</Text></View>
                    <View className="flex-row justify-between mt-1"><Text className="text-xs text-muted ml-2">↳ UVG / Unfallvers. (ca. 1.0%)</Text><Text className="text-xs text-error">-{formatCurrency(uvg)}</Text></View>
                    <View className="flex-row justify-between mt-2 pt-2 border-t border-border border-dashed"><Text className="text-sm text-foreground">Brutto-Marge Gross ICT</Text><Text className="text-sm font-semibold">{formatCurrency(totalMarge)}</Text></View>
                    <View className="flex-row justify-between mt-1"><Text className="text-xs text-muted ml-2">↳ AHV/IV/EO Inhaber (10.6%)</Text><Text className="text-xs text-error">-{formatCurrency(ownerAhv)}</Text></View>
                    <View className="flex-row justify-between mt-1"><Text className="text-xs text-muted ml-2">↳ FAK Luzern Inhaber (1.4%)</Text><Text className="text-xs text-error">-{formatCurrency(ownerFak)}</Text></View>
                    <View className="flex-row justify-between mt-1 mb-1"><Text className="text-xs text-muted ml-2">↳ Einkommenssteuer (ca. 15%)</Text><Text className="text-xs text-error">-{formatCurrency(ownerSteuer)}</Text></View>
                    <View className="flex-row justify-between pt-1 border-t border-border border-dotted"><Text className="text-sm font-semibold text-foreground">Netto-Marge Gross ICT</Text><Text className="text-sm text-success font-bold">{formatCurrency(nettoMarge)}</Text></View>
                    <View className="flex-row justify-between mt-1"><Text className="text-xs text-muted ml-2">↳ Davon Vermittlungs-Fee (10% v. Vol.)</Text><Text className="text-xs text-muted">{formatCurrency(vermittlung)}</Text></View>
                    <View className="flex-row justify-between mt-1"><Text className="text-xs text-muted ml-2">↳ Davon Unternehmens-Reserve</Text><Text className="text-xs text-muted">{formatCurrency(restMarge)}</Text></View>
                    <TouchableOpacity className="bg-primary/10 border border-primary/30 py-3 rounded-lg flex-row items-center justify-center mt-4" activeOpacity={0.8} onPress={() => { if (isYearClosed) { showAlert("Gesperrt", "Dieses Jahr ist abgeschlossen."); return; } setShowScenarioModal(true); }}>
                      <IconSymbol name="plus.circle.fill" size={18} color={colors.primary} />
                      <Text className="text-primary font-semibold ml-2">Als Ausgabe verbuchen</Text>
                    </TouchableOpacity>
                  </>
                )}
                {!isEmployee && (
                  <>
                    <View className="flex-row justify-between"><Text className="text-sm text-muted">Lohnkosten</Text><Text className="text-sm text-muted">0.00 CHF</Text></View>
                    <View className="flex-row justify-between mt-2 pt-2 border-t border-border border-dashed"><Text className="text-sm font-bold text-foreground">Brutto-Marge Gross ICT</Text><Text className="text-sm font-bold">{formatCurrency(scenarioRawVol)}</Text></View>
                    <View className="flex-row justify-between mt-1"><Text className="text-xs text-muted ml-2">↳ AHV/IV/EO Inhaber (10.6%)</Text><Text className="text-xs text-error">-{formatCurrency(vol * 0.106)}</Text></View>
                    <View className="flex-row justify-between mt-1"><Text className="text-xs text-muted ml-2">↳ FAK Luzern Inhaber (1.4%)</Text><Text className="text-xs text-error">-{formatCurrency(vol * 0.014)}</Text></View>
                    <View className="flex-row justify-between mt-1 mb-1"><Text className="text-xs text-muted ml-2">↳ Einkommenssteuer (ca. 15%)</Text><Text className="text-xs text-error">-{formatCurrency(vol * 0.15)}</Text></View>
                    <View className="flex-row justify-between pt-1 border-t border-border border-dotted"><Text className="text-sm font-semibold text-foreground">Netto-Marge Gross ICT</Text><Text className="text-sm text-success font-bold">{formatCurrency(vol * 0.73)}</Text></View>
                    <Text className="text-xs text-muted mt-2 text-center text-balance">Inhaber führt aus. Die Brutto-Marge ist der Unternehmensgewinn (wird anschliessend nach Jahresabschluss-Logik mit ca. 27% versteuert).</Text>
                  </>
                )}
              </View>
            );
          })()}
        </View>
      </View>
    </View>
  );

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
          <View className="flex-row items-center justify-between mb-4" style={{ zIndex: 100 }}>
            <View className="flex-row items-center gap-3">
              <BackButton />
              <Text className="text-3xl font-bold text-foreground">
                Buchhaltung
              </Text>
            </View>
            <View>
              <TouchableOpacity
                className="w-12 h-12 rounded-full items-center justify-center bg-primary"
                activeOpacity={0.8}
                onPress={() => setShowPlusMenu(!showPlusMenu)}
              >
                <IconSymbol name="plus.circle.fill" size={24} color={colors.background} />
              </TouchableOpacity>
              {showPlusMenu && (
                <View className="absolute right-0 top-14 bg-surface border border-border rounded-xl shadow-lg z-50" style={{ minWidth: 200, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 }}>
                  <TouchableOpacity className="flex-row items-center gap-3 px-4 py-3 border-b border-border" activeOpacity={0.7} onPress={() => { setShowPlusMenu(false); if (isYearClosed) { showAlert("Gesperrt", "Dieses Jahr ist abgeschlossen."); return; } setShowInvoiceModal(true); }}>
                    <IconSymbol name="doc.text.fill" size={18} color={colors.primary} />
                    <Text className="text-sm font-semibold text-foreground">Neue Rechnung</Text>
                  </TouchableOpacity>
                  <TouchableOpacity className="flex-row items-center gap-3 px-4 py-3 border-b border-border" activeOpacity={0.7} onPress={() => { setShowPlusMenu(false); if (isYearClosed) { showAlert("Gesperrt", "Dieses Jahr ist abgeschlossen."); return; } setEditingExpense(null); setInitialIsIncome(true); setShowExpenseModal(true); }}>
                    <IconSymbol name="arrow.down.circle.fill" size={18} color={colors.success || "#22c55e"} />
                    <Text className="text-sm font-semibold text-foreground">Neue Eingabe</Text>
                  </TouchableOpacity>
                  <TouchableOpacity className="flex-row items-center gap-3 px-4 py-3 border-b border-border" activeOpacity={0.7} onPress={() => { setShowPlusMenu(false); if (isYearClosed) { showAlert("Gesperrt", "Dieses Jahr ist abgeschlossen."); return; } setEditingExpense(null); setInitialIsIncome(false); setShowExpenseModal(true); }}>
                    <IconSymbol name="arrow.up.circle.fill" size={18} color={colors.error || "#ef4444"} />
                    <Text className="text-sm font-semibold text-foreground">Neue Ausgabe</Text>
                  </TouchableOpacity>
                  <TouchableOpacity className="flex-row items-center gap-3 px-4 py-3" activeOpacity={0.7} onPress={() => { setShowPlusMenu(false); router.push("/tap-to-pay"); }}>
                    <IconSymbol name="wave.3.right" size={18} color={colors.primary} />
                    <Text className="text-sm font-semibold text-foreground">Tap to Pay kassieren</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
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
                  color={activeTab === tab.key ? colors.background : colors.muted}
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
          {activeTab === "budget" && renderBudget()}
          {activeTab === "invoices" && renderInvoices()}
          {activeTab === "expenses" && renderExpenses()}
          {activeTab === "vat" && renderVat()}
          {activeTab === "annual" && renderAnnual()}
          {activeTab === "scenario" && renderScenario()}
          {activeTab === "documents" && <DocumentsTab colors={colors} />}
        </View>
      </ScrollView>

      <InvoiceFormModal
        visible={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        onSuccess={() => refetchInvoices()}
      />
      <DunningCenterModal
        visible={showDunningCenter}
        onClose={() => setShowDunningCenter(false)}
        invoiceSettings={invoiceSettings}
        colors={colors}
        onDone={() => { queryClient.invalidateQueries({ queryKey: ["invoices"] }); }}
      />
      <BankReconciliationModal
        visible={showBankModal}
        onClose={() => { setShowBankModal(false); refetchInvoices(); }}
        unpaidInvoices={yearInvoices.filter((i: any) => i.status !== "paid" && i.status !== "cancelled" && i.status !== "draft")}
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
        knownSuppliers={knownSuppliers}
        knownDescriptions={knownDescriptions}
        initialIsIncome={initialIsIncome}
      />

      <ScenarioBookingModal
        visible={showScenarioModal}
        amount={scenarioLohn}
        projectVol={scenarioRawVol}
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
          <IconSymbol name="folder.badge.plus" size={16} color={colors.background} />
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

// ═══════════════════════════════════════════════════════════════════════════════
// ─── BUDGET TAB ───────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function BudgetTab({
  selectedYear,
  renderYearSelector,
  totalRevenue,
  yearExpenses,
  profit,
  colors,
}: {
  selectedYear: number;
  renderYearSelector: () => React.ReactNode;
  totalRevenue: number;
  yearExpenses: any[];
  profit: number;
  colors: any;
}) {
  const queryClient = useQueryClient();

  const { data: budgets = [], isLoading, refetch } = useQuery({
    queryKey: ["accountingBudgets", selectedYear],
    queryFn: () => Data.getBudgets(selectedYear),
  });

  const { data: mktSettings } = useQuery({
    queryKey: ["marketingSettings"],
    queryFn: Data.getMarketingSettings,
  });

  const [customCategories, setCustomCategories] = useState<{value: string; label: string}[]>([]);
  useEffect(() => {
    try { setCustomCategories(JSON.parse(mktSettings?.custom_expense_categories || "[]")); } catch { setCustomCategories([]); }
  }, [mktSettings]);

  const allCategories = [...Data.EXPENSE_CATEGORIES, ...customCategories].sort((a, b) => a.label.localeCompare(b.label));

  // Inline editing state: { category: string; value: string } | null
  const [editing, setEditing] = useState<{ category: string; value: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const getBudget = (cat: string) => budgets.find(b => b.category === cat)?.budget_amount || 0;
  const getActual = (cat: string) => yearExpenses.filter((e: any) => e.category === cat && (e.amount || 0) > 0).reduce((s: number, e: any) => s + (e.amount || 0), 0);

  // Income budget
  const incomeBudget = budgets.find(b => b.category === "income")?.budget_amount || 0;
  const [editingIncome, setEditingIncome] = useState(false);
  const [incomeInput, setIncomeInput] = useState("");

  // Profit budget
  const profitBudget = budgets.find(b => b.category === "profit")?.budget_amount || 0;
  const [editingProfit, setEditingProfit] = useState(false);
  const [profitInput, setProfitInput] = useState("");
  const [showAllCats, setShowAllCats] = useState(false);

  const handleSave = async (cat: string, val: string) => {
    setSaving(true);
    try {
      await Data.upsertBudget(selectedYear, cat, parseFloat(val.replace(/[^0-9.]/g, "")) || 0);
      await refetch();
      setEditing(null);
      setEditingIncome(false);
      setEditingProfit(false);
    } catch (e: any) { Alert.alert("Fehler", e.message); } finally { setSaving(false); }
  };

  // Totals
  const totalBudgeted = allCategories.reduce((s, c) => s + getBudget(c.value), 0);
  const totalActual   = yearExpenses.filter((e: any) => (e.amount || 0) > 0).reduce((s: number, e: any) => s + (e.amount || 0), 0);
  const budgetPct     = totalBudgeted > 0 ? Math.min(100, Math.round((totalActual / totalBudgeted) * 100)) : 0;
  const budgetColor   = budgetPct >= 90 ? "#EF4444" : budgetPct >= 70 ? "#F59E0B" : "#22C55E";

  const ProgressBar = ({ pct, color }: { pct: number; color: string }) => (
    <View style={{ height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: "hidden", marginTop: 4 }}>
      <View style={{ height: 6, width: `${pct}%` as any, backgroundColor: color, borderRadius: 3 }} />
    </View>
  );

  if (isLoading) return <View style={{ paddingVertical: 60, alignItems: "center" }}><ActivityIndicator size="large" color={colors.primary} /></View>;

  return (
    <View style={{ gap: 16 }}>
      {renderYearSelector()}

      {/* Hero summary */}
      <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.border, gap: 14 }}>
        <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>📊 Budgetübersicht {selectedYear}</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View>
            <Text style={{ fontSize: 11, color: colors.muted }}>Budget Ausgaben</Text>
            <Text style={{ fontSize: 22, fontWeight: "800", color: "#8B5CF6" }}>{formatCurrency(totalBudgeted)}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 11, color: colors.muted }}>Tatsächliche Ausgaben</Text>
            <Text style={{ fontSize: 22, fontWeight: "800", color: budgetColor }}>{formatCurrency(totalActual)}</Text>
          </View>
        </View>
        <ProgressBar pct={budgetPct} color={budgetColor} />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 11, color: budgetColor, fontWeight: "700" }}>{budgetPct}% verbraucht</Text>
          <Text style={{ fontSize: 11, color: colors.muted }}>Rest: {formatCurrency(Math.max(0, totalBudgeted - totalActual))}</Text>
        </View>
      </View>

      {/* Ziele: Umsatz + Reingewinn in einer Karte */}
      <View style={{ backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>🎯 Umsatzziel</Text>
          <TouchableOpacity onPress={() => { setIncomeInput(incomeBudget > 0 ? incomeBudget.toString() : ""); setEditingIncome(true); }} activeOpacity={0.7}>
            <IconSymbol name="pencil" size={14} color={colors.primary} />
          </TouchableOpacity>
        </View>
        {editingIncome ? (
          <View style={{ padding: 14, gap: 8 }}>
            <TextInput
              style={{ backgroundColor: colors.background, borderRadius: 8, borderWidth: 1, borderColor: colors.primary, color: colors.foreground, padding: 10, fontSize: 16, fontWeight: "700" }}
              placeholder="z.B. 120000" placeholderTextColor={colors.muted}
              value={incomeInput} onChangeText={setIncomeInput} keyboardType="numeric" autoFocus
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 8, padding: 10, alignItems: "center" }} onPress={() => handleSave("income", incomeInput)} disabled={saving} activeOpacity={0.8}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: "#fff", fontWeight: "700" }}>Speichern</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, backgroundColor: colors.border, borderRadius: 8, padding: 10, alignItems: "center" }} onPress={() => setEditingIncome(false)}>
                <Text style={{ color: colors.foreground, fontWeight: "600" }}>Abbrechen</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={{ padding: 14, gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 11, color: colors.muted }}>Ziel</Text>
              <Text style={{ fontSize: 15, fontWeight: "800", color: "#22C55E" }}>{incomeBudget > 0 ? formatCurrency(incomeBudget) : "–"}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 11, color: colors.muted }}>Tatsächlich</Text>
              <Text style={{ fontSize: 15, fontWeight: "800", color: colors.foreground }}>{formatCurrency(totalRevenue)}</Text>
            </View>
            {incomeBudget > 0 && (
              <>
                <ProgressBar pct={Math.min(100, Math.round((totalRevenue / incomeBudget) * 100))} color={totalRevenue >= incomeBudget ? "#22C55E" : "#F59E0B"} />
                <Text style={{ fontSize: 11, color: totalRevenue >= incomeBudget ? "#22C55E" : colors.muted, fontWeight: "700", textAlign: "right" }}>
                  {Math.round((totalRevenue / incomeBudget) * 100)}% erreicht
                </Text>
              </>
            )}
          </View>
        )}

        {/* Trennlinie zwischen den beiden Zielen */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>💰 Reingewinnziel</Text>
          <TouchableOpacity onPress={() => { setProfitInput(profitBudget > 0 ? profitBudget.toString() : ""); setEditingProfit(true); }} activeOpacity={0.7}>
            <IconSymbol name="pencil" size={14} color={colors.primary} />
          </TouchableOpacity>
        </View>
        {editingProfit ? (
          <View style={{ padding: 14, gap: 8 }}>
            <TextInput
              style={{ backgroundColor: colors.background, borderRadius: 8, borderWidth: 1, borderColor: colors.primary, color: colors.foreground, padding: 10, fontSize: 16, fontWeight: "700" }}
              placeholder="z.B. 50000" placeholderTextColor={colors.muted}
              value={profitInput} onChangeText={setProfitInput} keyboardType="numeric" autoFocus
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 8, padding: 10, alignItems: "center" }} onPress={() => handleSave("profit", profitInput)} disabled={saving} activeOpacity={0.8}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: "#fff", fontWeight: "700" }}>Speichern</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, backgroundColor: colors.border, borderRadius: 8, padding: 10, alignItems: "center" }} onPress={() => setEditingProfit(false)}>
                <Text style={{ color: colors.foreground, fontWeight: "600" }}>Abbrechen</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={{ padding: 14, gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 11, color: colors.muted }}>Ziel</Text>
              <Text style={{ fontSize: 15, fontWeight: "800", color: "#8B5CF6" }}>{profitBudget > 0 ? formatCurrency(profitBudget) : "–"}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 11, color: colors.muted }}>Tatsächlich</Text>
              <Text style={{ fontSize: 15, fontWeight: "800", color: profit >= 0 ? "#22C55E" : "#EF4444" }}>{formatCurrency(profit)}</Text>
            </View>
            {profitBudget > 0 && (
              <>
                <ProgressBar pct={Math.max(0, Math.min(100, Math.round((profit / profitBudget) * 100)))} color={profit >= profitBudget ? "#22C55E" : "#F59E0B"} />
                <Text style={{ fontSize: 11, color: profit >= profitBudget ? "#22C55E" : colors.muted, fontWeight: "700", textAlign: "right" }}>
                  {Math.max(0, Math.round((profit / profitBudget) * 100))}% erreicht
                </Text>
              </>
            )}
          </View>
        )}
      </View>

      {/* Per-category expense budgets – aktive Kategorien zuerst, Rest einklappbar */}
      {(() => {
        const activeCats = allCategories
          .filter((c) => getBudget(c.value) > 0 || getActual(c.value) > 0)
          .sort((a, b) => getActual(b.value) - getActual(a.value));
        const inactiveCats = allCategories.filter((c) => getBudget(c.value) === 0 && getActual(c.value) === 0);
        const visibleCats = showAllCats ? [...activeCats, ...inactiveCats] : activeCats;
        return (
      <View style={{ backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
        <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>💸 Ausgaben-Budget pro Kategorie</Text>
          <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>Tippen Sie auf eine Zeile zum Bearbeiten</Text>
        </View>
        {visibleCats.length === 0 && (
          <Text style={{ fontSize: 12, color: colors.muted, padding: 14 }}>
            Noch keine Budgets oder Ausgaben – unten alle Kategorien einblenden.
          </Text>
        )}
        {visibleCats.map((cat, idx) => {
          const budget = getBudget(cat.value);
          const actual = getActual(cat.value);
          const pct    = budget > 0 ? Math.min(100, Math.round((actual / budget) * 100)) : 0;
          const barColor = pct >= 90 ? "#EF4444" : pct >= 70 ? "#F59E0B" : "#8B5CF6";
          const isEditingThis = editing?.category === cat.value;

          return (
            <View key={cat.value} style={{ borderBottomWidth: idx < visibleCats.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
              {isEditingThis ? (
                <View style={{ padding: 12, gap: 8, backgroundColor: colors.primary + "08" }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>{cat.label}</Text>
                  <TextInput
                    style={{ backgroundColor: colors.background, borderRadius: 8, borderWidth: 1, borderColor: colors.primary, color: colors.foreground, padding: 10, fontSize: 16, fontWeight: "700" }}
                    placeholder="Budget in CHF" placeholderTextColor={colors.muted}
                    value={editing.value} onChangeText={v => setEditing({ ...editing, value: v.replace(/[^0-9.]/g, "") })}
                    keyboardType="numeric" autoFocus
                  />
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 8, padding: 10, alignItems: "center" }} onPress={() => handleSave(cat.value, editing.value)} disabled={saving} activeOpacity={0.8}>
                      {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: "#fff", fontWeight: "700" }}>Speichern</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity style={{ flex: 1, backgroundColor: colors.border, borderRadius: 8, padding: 10, alignItems: "center" }} onPress={() => setEditing(null)}>
                      <Text style={{ color: colors.foreground, fontWeight: "600" }}>Abbrechen</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={{ padding: 12, gap: 4 }}
                  onPress={() => setEditing({ category: cat.value, value: budget > 0 ? budget.toString() : "" })}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground, flex: 1 }} numberOfLines={1}>{cat.label}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ fontSize: 13, fontWeight: "700", color: budget > 0 ? barColor : colors.muted }}>
                          {formatCurrency(actual)}{budget > 0 ? ` / ${formatCurrency(budget)}` : ""}
                        </Text>
                      </View>
                      <IconSymbol name="pencil" size={14} color={colors.primary} />
                    </View>
                  </View>
                  {budget > 0 && <ProgressBar pct={pct} color={barColor} />}
                  {budget === 0 && <Text style={{ fontSize: 10, color: colors.muted }}>Kein Budget gesetzt – tippen zum Festlegen</Text>}
                </TouchableOpacity>
              )}
            </View>
          );
        })}
        {inactiveCats.length > 0 && (
          <TouchableOpacity
            style={{ padding: 12, alignItems: "center", borderTopWidth: visibleCats.length > 0 ? 1 : 0, borderTopColor: colors.border }}
            onPress={() => setShowAllCats(!showAllCats)}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>
              {showAllCats
                ? "Weniger anzeigen"
                : `${inactiveCats.length} weitere Kategorien ohne Budget anzeigen`}
            </Text>
          </TouchableOpacity>
        )}
      </View>
        );
      })()}
    </View>
  );
}

// ─── Kunden-Profitabilität ────────────────────────────────────────────────────
function CustomerProfitabilityCard({ selectedYear, colors }: { selectedYear: number; colors: any }) {
  const [expanded, setExpanded] = useState(false);
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["customerProfitability", selectedYear],
    queryFn: () => Data.getCustomerProfitability(selectedYear),
  });

  if (!isLoading && rows.length === 0) return null;
  const visible = expanded ? rows : rows.slice(0, 5);

  return (
    <View className="bg-surface rounded-xl border border-border overflow-hidden">
      <View className="p-4 border-b border-border">
        <Text className="text-base font-bold text-foreground">Kunden-Profitabilität {selectedYear}</Text>
        <Text className="text-xs text-muted mt-1">
          Umsatz abzüglich interner Vertragskosten und im Vertrag abgedeckter Ticket-Aufwände
        </Text>
      </View>
      {isLoading ? (
        <View className="items-center py-6"><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <>
          {visible.map((r: any, idx: number) => (
            <View
              key={r.customerId}
              className="flex-row items-center px-4 py-3"
              style={{ borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: colors.border }}
            >
              <Text className="text-xs font-bold text-muted" style={{ width: 22 }}>{idx + 1}.</Text>
              <View className="flex-1 mr-2">
                <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>{r.name}</Text>
                <Text className="text-[11px] text-muted" numberOfLines={1}>
                  Umsatz {formatCurrency(r.revenue)} · Kosten {formatCurrency(r.costs)}
                  {r.coveredEffort > 0 ? ` (davon Aufwände ${formatCurrency(r.coveredEffort)})` : ""}
                </Text>
              </View>
              <Text className="text-sm font-bold" style={{ color: r.margin >= 0 ? "#22C55E" : "#EF4444" }}>
                {formatCurrency(r.margin)}
              </Text>
            </View>
          ))}
          {rows.length > 5 && (
            <TouchableOpacity
              className="items-center py-3 border-t border-border"
              onPress={() => setExpanded(!expanded)}
              activeOpacity={0.7}
            >
              <Text className="text-xs font-bold" style={{ color: colors.primary }}>
                {expanded ? "Weniger anzeigen" : `Alle ${rows.length} Kunden anzeigen`}
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

// ── Liquiditätsvorschau: erwartete Zu-/Abflüsse der nächsten 90 Tage ──
function LiquidityCard({ colors }: { colors: any }) {
  const { data: invoices = [] } = useQuery({ queryKey: ["invoices"], queryFn: Data.getAllInvoices });
  const { data: contracts = [] } = useQuery({ queryKey: ["contracts"], queryFn: Data.getContracts });
  const { data: recurring = [] } = useQuery({ queryKey: ["recurringExpenses"], queryFn: Data.getRecurringExpenses });

  const buckets = useMemo(() => {
    const now = new Date();
    const horizon = new Date(Date.now() + 90 * 86400000);
    // Drei Monats-Buckets ab aktuellem Monat
    const list: { label: string; year: number; month: number; incoming: number; outgoing: number }[] = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      list.push({
        label: d.toLocaleDateString("de-CH", { month: "long", year: "numeric" }),
        year: d.getFullYear(),
        month: d.getMonth(),
        incoming: 0,
        outgoing: 0,
      });
    }
    const addTo = (date: Date, amount: number, type: "incoming" | "outgoing") => {
      // Überfälliges zählt zum aktuellen Monat
      const clamped = date < now ? now : date;
      if (clamped > horizon) return;
      const b = list.find((x) => x.year === clamped.getFullYear() && x.month === clamped.getMonth());
      if (b) b[type] += amount;
    };

    // Offene Rechnungen nach Fälligkeit
    for (const inv of invoices as any[]) {
      if (!["open", "sent", "overdue"].includes(inv.status)) continue;
      const due = inv.due_date ? new Date(inv.due_date) : now;
      addTo(due, getInvoiceTotal(inv), "incoming");
    }

    // Kommende Vertragsrechnungen
    for (const c of contracts as any[]) {
      if (c.status !== "active" || !c.recurring_enabled || !c.next_invoice_date) continue;
      const months = c.billing_cycle === "monthly" ? 1 : c.billing_cycle === "quarterly" ? 3 : c.billing_cycle === "semi_annual" ? 6 : 12;
      const perCycle = ((Number(c.annual_amount || c.amount) || 0) / 12) * months;
      let d = new Date(c.next_invoice_date);
      let guard = 0;
      while (d <= horizon && guard < 6) {
        addTo(d, perCycle, "incoming");
        d = new Date(d);
        d.setMonth(d.getMonth() + months);
        guard++;
      }
    }

    // Wiederkehrende Ausgaben
    for (const r of recurring as any[]) {
      if (!r.active) continue;
      const months = r.interval === "yearly" ? 12 : 1;
      let d = new Date(r.next_date);
      let guard = 0;
      while (d <= horizon && guard < 6) {
        addTo(d, Number(r.amount) || 0, "outgoing");
        d = new Date(d);
        d.setMonth(d.getMonth() + months);
        guard++;
      }
    }
    return list;
  }, [invoices, contracts, recurring]);

  const maxVal = Math.max(1, ...buckets.map((b) => Math.max(b.incoming, b.outgoing)));
  const totalIn = buckets.reduce((s, b) => s + b.incoming, 0);
  const totalOut = buckets.reduce((s, b) => s + b.outgoing, 0);

  return (
    <View className="bg-surface rounded-2xl border border-border p-4 mt-3">
      <View className="flex-row items-center gap-2 mb-1">
        <IconSymbol name="chart.bar.fill" size={16} color={colors.primary} />
        <Text className="text-base font-bold text-foreground">Liquiditätsvorschau 90 Tage</Text>
      </View>
      <Text className="text-xs text-muted mb-3">
        Erwartet: {formatCurrency(totalIn)} Eingänge · {formatCurrency(totalOut)} wiederkehrende Ausgaben · Saldo {formatCurrency(totalIn - totalOut)}
      </Text>
      {buckets.map((b) => (
        <View key={b.label} className="mb-3">
          <View className="flex-row justify-between mb-1">
            <Text className="text-xs font-semibold text-foreground">{b.label}</Text>
            <Text className="text-xs text-muted">
              +{formatCurrency(b.incoming)} / −{formatCurrency(b.outgoing)}
            </Text>
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.border + "60", overflow: "hidden", marginBottom: 3 }}>
            <View style={{ width: `${Math.min(100, (b.incoming / maxVal) * 100)}%`, height: "100%", backgroundColor: "#22C55E" }} />
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.border + "60", overflow: "hidden" }}>
            <View style={{ width: `${Math.min(100, (b.outgoing / maxVal) * 100)}%`, height: "100%", backgroundColor: "#EF4444" }} />
          </View>
        </View>
      ))}
      <Text className="text-xs text-muted">
        Basis: offene Rechnungen (Fälligkeit), kommende Vertragsrechnungen und aktive wiederkehrende Ausgaben.
      </Text>
    </View>
  );
}

// ── Wiederkehrende Ausgaben: Verwaltung (automatische Verbuchung per Cron) ──
function RecurringExpensesCard({ colors }: { colors: any }) {
  const queryClient = useQueryClient();
  const { data: recurring = [] } = useQuery({ queryKey: ["recurringExpenses"], queryFn: Data.getRecurringExpenses });
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState("");
  const [amount, setAmount] = useState("");
  const [interval, setIntervalKey] = useState<"monthly" | "yearly">("monthly");
  const [nextDate, setNextDate] = useState("");
  const [saving, setSaving] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["recurringExpenses"] });

  const handleSave = async () => {
    const amt = parseFloat(amount);
    if (!desc.trim() || !amt || amt <= 0) {
      showAlert("Fehler", "Bitte Beschreibung und Betrag angeben.");
      return;
    }
    // DD.MM.YYYY → YYYY-MM-DD
    let dbDate = nextDate.trim();
    const parts = dbDate.split(".");
    if (parts.length === 3) dbDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    if (!dbDate) dbDate = new Date().toISOString().split("T")[0];
    setSaving(true);
    try {
      await Data.createRecurringExpense({
        description: desc.trim(),
        category: cat.trim() || null,
        amount: amt,
        interval,
        next_date: dbDate,
      });
      setDesc(""); setCat(""); setAmount(""); setNextDate(""); setShowForm(false);
      refresh();
      showToast("Wiederkehrende Ausgabe gespeichert");
    } catch (e: any) {
      showAlert("Fehler", e.message);
    } finally {
      setSaving(false);
    }
  };

  const monthlyTotal = (recurring as any[])
    .filter((r) => r.active)
    .reduce((s, r) => s + (r.interval === "yearly" ? (Number(r.amount) || 0) / 12 : Number(r.amount) || 0), 0);

  return (
    <View className="bg-surface rounded-2xl border border-border p-4">
      <TouchableOpacity className="flex-row items-center justify-between" onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
        <View className="flex-row items-center gap-2">
          <IconSymbol name="arrow.triangle.2.circlepath" size={16} color={colors.primary} />
          <Text className="text-base font-bold text-foreground">Wiederkehrende Ausgaben</Text>
          <Text className="text-xs text-muted">({(recurring as any[]).length})</Text>
        </View>
        <IconSymbol name={expanded ? "chevron.up" : "chevron.down"} size={14} color={colors.muted} />
      </TouchableOpacity>
      <Text className="text-xs text-muted mt-1">
        ≈ {formatCurrency(monthlyTotal)} pro Monat · werden am Stichtag automatisch verbucht
      </Text>

      {expanded ? (
        <View className="mt-3">
          {(recurring as any[]).map((r) => (
            <View key={r.id} className="flex-row items-center gap-2 py-2 border-t border-border">
              <TouchableOpacity
                onPress={() => Data.updateRecurringExpense(r.id, { active: !r.active }).then(refresh)}
                activeOpacity={0.7}
                style={{
                  width: 18, height: 18, borderRadius: 5, borderWidth: 2,
                  borderColor: r.active ? "#22C55E" : colors.border,
                  backgroundColor: r.active ? "#22C55E" : "transparent",
                  alignItems: "center", justifyContent: "center",
                }}
              >
                {r.active ? <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>✓</Text> : null}
              </TouchableOpacity>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                  {r.description}{r.category ? ` · ${r.category}` : ""}
                </Text>
                <Text className="text-xs text-muted">
                  {r.interval === "yearly" ? "Jährlich" : "Monatlich"} · nächste Buchung {formatDate(r.next_date)}
                  {!r.active ? " · pausiert" : ""}
                </Text>
              </View>
              <Text className="text-sm font-bold text-foreground">{formatCurrency(Number(r.amount))}</Text>
              <TouchableOpacity
                onPress={() => showConfirm("Löschen", `"${r.description}" entfernen?`, () => Data.deleteRecurringExpense(r.id).then(refresh), "Löschen")}
                activeOpacity={0.7}
                className="p-1"
              >
                <IconSymbol name="trash.fill" size={15} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))}

          {showForm ? (
            <View className="mt-2 pt-2 border-t border-border gap-2">
              <TextInput
                value={desc} onChangeText={setDesc}
                placeholder="Beschreibung (z.B. Microsoft 365)" placeholderTextColor={colors.muted}
                className="bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
              />
              <View className="flex-row gap-2">
                <TextInput
                  value={cat} onChangeText={setCat}
                  placeholder="Kategorie" placeholderTextColor={colors.muted}
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                />
                <TextInput
                  value={amount} onChangeText={setAmount} keyboardType="decimal-pad"
                  placeholder="Betrag CHF" placeholderTextColor={colors.muted}
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                />
              </View>
              <View className="flex-row gap-2">
                <TouchableOpacity
                  className={`flex-1 py-2 rounded-lg ${interval === "monthly" ? "bg-primary" : "bg-background border border-border"}`}
                  onPress={() => setIntervalKey("monthly")}
                >
                  <Text className={`text-center text-xs font-semibold ${interval === "monthly" ? "text-background" : "text-foreground"}`}>Monatlich</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className={`flex-1 py-2 rounded-lg ${interval === "yearly" ? "bg-primary" : "bg-background border border-border"}`}
                  onPress={() => setIntervalKey("yearly")}
                >
                  <Text className={`text-center text-xs font-semibold ${interval === "yearly" ? "text-background" : "text-foreground"}`}>Jährlich</Text>
                </TouchableOpacity>
                <TextInput
                  value={nextDate} onChangeText={setNextDate}
                  placeholder="Ab (DD.MM.YYYY)" placeholderTextColor={colors.muted}
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                />
              </View>
              <View className="flex-row gap-2">
                <TouchableOpacity className="flex-1 bg-surface border border-border py-2 rounded-lg" onPress={() => setShowForm(false)}>
                  <Text className="text-center text-xs font-semibold text-foreground">Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity className="flex-1 bg-primary py-2 rounded-lg" onPress={handleSave} disabled={saving}>
                  <Text className="text-center text-xs font-semibold text-background">{saving ? "Speichert…" : "Speichern"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity className="mt-2 pt-2 border-t border-border" onPress={() => setShowForm(true)} activeOpacity={0.7}>
              <Text className="text-xs font-bold" style={{ color: colors.primary }}>+ Wiederkehrende Ausgabe hinzufügen</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}
    </View>
  );
}

// ── Debitoren: Zahlungsmoral pro Kunde ──
function DebtorCard({ colors }: { colors: any }) {
  const [expanded, setExpanded] = useState(false);
  const { data: debtors = [] } = useQuery({ queryKey: ["debtorStats"], queryFn: Data.getDebtorStats });

  const relevant = (debtors as any[]).filter((d) => d.openAmount > 0 || d.paidCount > 0);
  if (!relevant.length) return null;
  const shown = expanded ? relevant : relevant.slice(0, 5);
  const totalOpen = relevant.reduce((s, d) => s + d.openAmount, 0);

  return (
    <View className="bg-surface rounded-2xl border border-border p-4 mt-3">
      <View className="flex-row items-center gap-2 mb-1">
        <IconSymbol name="person.2.fill" size={16} color={colors.primary} />
        <Text className="text-base font-bold text-foreground">Debitoren & Zahlungsmoral</Text>
      </View>
      <Text className="text-xs text-muted mb-3">
        Offen gesamt: {formatCurrency(totalOpen)} · Zahlungsdauer = Rechnungsdatum bis Zahlungseingang
      </Text>
      {shown.map((d: any) => (
        <View key={d.customerId} className="flex-row items-center py-2 border-t border-border">
          <View className="flex-1 mr-2">
            <View className="flex-row items-center gap-2">
              <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>{d.name}</Text>
              {d.latePct !== null && d.latePct >= 50 && d.paidCount >= 2 ? (
                <View className="px-1.5 py-0.5 rounded" style={{ backgroundColor: "#EF444420" }}>
                  <Text className="text-[9px] font-bold" style={{ color: "#EF4444" }}>ZAHLT SPÄT</Text>
                </View>
              ) : null}
            </View>
            <Text className="text-xs text-muted">
              {d.avgDays !== null ? `Ø ${d.avgDays} Tage` : "noch keine Zahlung"}
              {d.latePct !== null ? ` · ${d.latePct}% zu spät` : ""}
              {d.overdueCount > 0 ? ` · ${d.overdueCount} überfällig` : ""}
            </Text>
          </View>
          <Text className="text-sm font-bold" style={{ color: d.openAmount > 0 ? colors.warning : colors.success }}>
            {formatCurrency(d.openAmount)}
          </Text>
        </View>
      ))}
      {relevant.length > 5 ? (
        <TouchableOpacity className="pt-2" onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
          <Text className="text-xs font-bold text-center" style={{ color: colors.primary }}>
            {expanded ? "Weniger anzeigen" : `Alle ${relevant.length} Kunden anzeigen`}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ── Mahn-Center: fällige Mahnungen gesammelt versenden ──
function DunningCenterModal({
  visible, onClose, invoiceSettings, colors, onDone,
}: { visible: boolean; onClose: () => void; invoiceSettings: any; colors: any; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState("");

  const { data: dunnable = [], refetch } = useQuery({
    queryKey: ["dunnableInvoices"],
    queryFn: Data.getDunnableInvoices,
    enabled: visible,
  });

  useEffect(() => {
    if (visible) {
      // Standard: alle fälligen vorausgewählt
      setSelected(new Set((dunnable as any[]).filter((i) => i.dunningDue && i.customer?.email).map((i) => i.id)));
    }
  }, [visible, dunnable]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const levelLabel = (l: number) =>
    l === 0 ? "Erinnerung" : l === 1 ? "1. Mahnung" : l === 2 ? "2. Mahnung" : "3. Mahnung";

  const handleSend = async () => {
    const toSend = (dunnable as any[]).filter((i) => selected.has(i.id));
    if (!toSend.length) return;
    setSending(true);
    let ok = 0, failed = 0;
    for (let idx = 0; idx < toSend.length; idx++) {
      const inv = toSend[idx];
      setProgress(`${idx + 1}/${toSend.length}: ${inv.invoice_number}…`);
      try {
        const level = inv.recommendedLevel;
        const pdfBase64 = await generateInvoicePDFBase64({ ...inv, dunning_level: level, is_dunning_document: true } as any, invoiceSettings);
        const { data, error } = await Data.supabase.functions.invoke("send-reminder-email", {
          body: { id: inv.id, pdfBase64, level },
        });
        if (error || data?.error) throw new Error(data?.error || error?.message);
        ok++;
      } catch (e) {
        console.error("[Mahn-Center]", inv.invoice_number, e);
        failed++;
      }
    }
    setSending(false);
    setProgress("");
    refetch();
    onDone();
    queryClient.invalidateQueries({ queryKey: ["dunnableInvoices"] });
    showAlert("Mahnlauf abgeschlossen", `${ok} Mahnung(en) versendet${failed ? `, ${failed} fehlgeschlagen` : ""}.`);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-background rounded-t-3xl" style={{ maxHeight: "90%" }}>
          <View className="flex-row items-center justify-between p-4 border-b border-border">
            <Text className="text-xl font-bold text-foreground">Mahn-Center</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <IconSymbol name="xmark.circle.fill" size={26} color={colors.muted} />
            </TouchableOpacity>
          </View>
          <ScrollView className="p-4" showsVerticalScrollIndicator={false}>
            {(dunnable as any[]).length === 0 ? (
              <View className="items-center py-10">
                <IconSymbol name="checkmark.circle.fill" size={40} color={colors.success} />
                <Text className="text-base font-semibold text-foreground mt-3">Nichts zu mahnen</Text>
                <Text className="text-sm text-muted mt-1">Keine überfälligen Rechnungen vorhanden.</Text>
              </View>
            ) : (
              (dunnable as any[]).map((inv) => {
                const name = inv.customer?.company_name || `${inv.customer?.first_name || ""} ${inv.customer?.last_name || ""}`.trim();
                const rest = Math.max(0, (inv.total || 0) - (inv.paid_amount || 0));
                const noEmail = !inv.customer?.email;
                return (
                  <TouchableOpacity
                    key={inv.id}
                    className="flex-row items-center gap-3 py-2.5 border-b border-border"
                    onPress={() => !noEmail && toggle(inv.id)}
                    activeOpacity={0.7}
                    style={{ opacity: noEmail ? 0.5 : 1 }}
                  >
                    <View
                      style={{
                        width: 20, height: 20, borderRadius: 6, borderWidth: 2,
                        borderColor: selected.has(inv.id) ? colors.primary : colors.border,
                        backgroundColor: selected.has(inv.id) ? colors.primary : "transparent",
                        alignItems: "center", justifyContent: "center",
                      }}
                    >
                      {selected.has(inv.id) ? <Text style={{ color: colors.background, fontSize: 11, fontWeight: "700" }}>✓</Text> : null}
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-foreground">{inv.invoice_number} · {name}</Text>
                      <Text className="text-xs text-muted">
                        fällig {formatDate(inv.due_date)} · offen {formatCurrency(rest)} · bisher: {inv.dunning_level ? levelLabel(inv.dunning_level - 0) + " gesendet" : "noch nie gemahnt"}
                        {noEmail ? " · keine E-Mail!" : ""}
                      </Text>
                      <Text className="text-xs font-semibold" style={{ color: inv.dunningDue ? "#EF4444" : colors.muted }}>
                        Empfehlung: {levelLabel(inv.recommendedLevel)}{!inv.dunningDue ? ` (erst ${inv.daysSinceLastAction} Tage seit letzter Aktion)` : ""}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
            <View style={{ height: 12 }} />
          </ScrollView>
          <View className="p-4 border-t border-border">
            {sending ? (
              <View className="flex-row items-center justify-center gap-2 py-3">
                <ActivityIndicator color={colors.primary} />
                <Text className="text-sm text-foreground">{progress}</Text>
              </View>
            ) : (
              <TouchableOpacity
                className="bg-primary py-3 rounded-xl"
                onPress={handleSend}
                disabled={selected.size === 0}
                style={{ opacity: selected.size === 0 ? 0.5 : 1 }}
                activeOpacity={0.8}
              >
                <Text className="text-background font-semibold text-center">
                  {selected.size} Mahnung(en) mit empfohlener Stufe senden
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}


// ── Umsatz-Forecast: Verträge + gewichtete Pipeline + offene Angebote, 3 Monate ──
function ForecastCard({ colors }: { colors: any }) {
  const { data: forecast = [] } = useQuery({
    queryKey: ["revenueForecast"],
    queryFn: Data.getForecast,
  });
  if (!(forecast as any[]).length) return null;
  const max = Math.max(...(forecast as any[]).map((m: any) => m.contract + m.pipeline + m.quotes), 1);
  const SEGMENTS: { key: "contract" | "pipeline" | "quotes"; label: string; color: string }[] = [
    { key: "contract", label: "Verträge (sicher)", color: "#4ADE80" },
    { key: "quotes", label: "Offene Angebote (50%)", color: "#F59E0B" },
    { key: "pipeline", label: "Pipeline (gewichtet)", color: "#8B5CF6" },
  ];
  return (
    <View className="bg-surface rounded-2xl border border-border p-4 mb-4">
      <Text className="text-base font-bold text-foreground mb-1">Umsatz-Forecast 3 Monate</Text>
      <Text className="text-xs text-muted mb-3">
        Vertragsumsatz (auf Monat normalisiert) + offene Angebote zu 50% + gewichtete Lead-Pipeline, je auf 3 Monate verteilt.
      </Text>
      {(forecast as any[]).map((m: any) => {
        const total = m.contract + m.pipeline + m.quotes;
        return (
          <View key={m.label} style={{ marginBottom: 10 }}>
            <View className="flex-row justify-between mb-1">
              <Text className="text-sm font-semibold text-foreground">{m.label}</Text>
              <Text className="text-sm font-bold text-foreground">CHF {total.toLocaleString("de-CH")}</Text>
            </View>
            <View style={{ flexDirection: "row", height: 12, borderRadius: 6, overflow: "hidden", backgroundColor: colors.border + "40" }}>
              {SEGMENTS.map((seg) => (
                m[seg.key] > 0 ? (
                  <View key={seg.key} style={{ width: `${(m[seg.key] / max) * 100}%`, backgroundColor: seg.color }} />
                ) : null
              ))}
            </View>
          </View>
        );
      })}
      <View className="flex-row flex-wrap gap-3 mt-1">
        {SEGMENTS.map((seg) => (
          <View key={seg.key} className="flex-row items-center gap-1.5">
            <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: seg.color }} />
            <Text className="text-xs text-muted">{seg.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  StripeTerminalProvider,
  useStripeTerminal,
} from "@stripe/stripe-terminal-react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { formatCurrency } from "@/lib/format";
import * as Data from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { showAppleTapToPayEducation } from "@/lib/tap-to-pay-education";
import { scheduleLocalNotification } from "@/lib/push-notifications";

type Step = "idle" | "paying" | "success" | "error";

const EDUCATION_SHOWN_KEY = "ttp_education_shown";

async function invokeTerminal(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("stripe-terminal", { body });
  if (error) {
    let details = "";
    try {
      const ctx = (error as any)?.context;
      if (ctx && typeof ctx.json === "function") {
        const errBody = await ctx.json();
        details = errBody?.error || "";
      }
    } catch (_) { /* ignore */ }
    throw new Error(details || error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

function TapToPayInner() {
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Nur berechtigte Benutzer (Admin/Finanzen) dürfen Tap to Pay nutzen und die
  // Apple-AGB akzeptieren (Apple-Anforderungen 3.8 / 3.8.1)
  const { data: session } = useQuery({
    queryKey: ["currentSession"],
    queryFn: async () => (await supabase.auth.getSession()).data.session,
  });
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["userProfile", session?.user?.id],
    queryFn: () => Data.getUserProfile(session?.user?.id as string),
    enabled: !!session?.user?.id,
  });
  const isAuthorized = !!profile?.roles?.some((r: string) => r === "admin" || r === "finanzen");
  const params = useLocalSearchParams<{
    invoiceId?: string;
    invoiceNumber?: string;
    customerName?: string;
    amount?: string;
  }>();

  const [amount, setAmount] = useState(params.amount ? String(params.amount) : "");
  const [note, setNote] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [statusText, setStatusText] = useState("");
  const [errorText, setErrorText] = useState("");
  const [paidAmount, setPaidAmount] = useState(0);
  const [lastReceipt, setLastReceipt] = useState<{ amount: number; description: string; success: boolean; date: Date } | null>(null);
  // Reader-Status für die Statusanzeige (Apple-Anforderung 1.5 / 3.9.1 / 5.6)
  const [readerStatus, setReaderStatus] = useState<"connecting" | "ready" | "failed">("connecting");
  const [configProgress, setConfigProgress] = useState<number | null>(null);
  const [showFallbackEducation, setShowFallbackEducation] = useState(false);
  const initializedRef = useRef(false);
  const warmupStartedRef = useRef(false);
  const currentIntentRef = useRef<string | null>(null);

  const {
    initialize,
    easyConnect,
    connectedReader,
    retrievePaymentIntent,
    processPaymentIntent,
  } = useStripeTerminal({
    onDidRequestReaderDisplayMessage: (message) => {
      setStatusText(String(message));
    },
    // Konfigurations-Fortschritt des Tap-to-Pay-Readers (Apple-Anforderung 3.9.1)
    onDidReportReaderSoftwareUpdateProgress: (progress) => {
      const pct = Math.round(parseFloat(String(progress)) * 100);
      if (!isNaN(pct)) setConfigProgress(pct);
    },
  });

  // Händler-Anleitung anzeigen: Apple-Education (iOS 18+) mit eigenem Fallback
  // (Apple-Anforderungen 4.1–4.3)
  const showEducation = useCallback(async () => {
    const shownByApple = await showAppleTapToPayEducation();
    if (!shownByApple) setShowFallbackEducation(true);
  }, []);

  // Tap to Pay beim Öffnen des Screens im Hintergrund vorbereiten
  // (Apple-Anforderungen 1.5 und 5.6: Reader "warm-up", UI < 1s)
  const warmUp = useCallback(async () => {
    if (!isAuthorized) return;
    if (warmupStartedRef.current) return;
    warmupStartedRef.current = true;
    try {
      if (!initializedRef.current) {
        const { error: initError } = await initialize();
        if (initError) throw new Error(initError.message);
        initializedRef.current = true;
      }
      const { locationId } = await invokeTerminal({ action: "location" });
      const { error: connectError } = await easyConnect({
        discoveryMethod: "tapToPay",
        locationId,
        merchantDisplayName: "Gross ICT",
        autoReconnectOnUnexpectedDisconnect: true,
      });
      if (connectError) throw new Error(connectError.message);
      setReaderStatus("ready");
      setConfigProgress(null);

      // Nach der ersten Aktivierung (Apple-AGB akzeptiert) einmalig die
      // Händler-Anleitung anzeigen (Apple-Anforderung 4.2)
      try {
        const educationShown = await AsyncStorage.getItem(EDUCATION_SHOWN_KEY);
        if (!educationShown) {
          await showEducation();
          await AsyncStorage.setItem(EDUCATION_SHOWN_KEY, "1");
        }
      } catch (_) { /* ignore */ }
    } catch (e: any) {
      console.log("[TapToPay] Warm-up fehlgeschlagen:", e?.message);
      setReaderStatus("failed");
      setConfigProgress(null);
    }
  }, [initialize, easyConnect, showEducation]);

  useEffect(() => {
    warmUp();
  }, [warmUp, isAuthorized]);

  const parseAmountChf = () => {
    const value = parseFloat(amount.replace(",", "."));
    if (!value || isNaN(value) || value <= 0) return null;
    return Math.round(value * 100) / 100;
  };

  const startPayment = useCallback(async () => {
    const chf = parseAmountChf();
    if (!chf || chf < 0.5) {
      setErrorText("Bitte einen gültigen Betrag eingeben (mind. CHF 0.50).");
      setStep("error");
      return;
    }
    const rappen = Math.round(chf * 100);
    const description = params.invoiceNumber
      ? `Rechnung ${params.invoiceNumber}`
      : note.trim() || "Tap to Pay Zahlung";
    setStep("paying");
    setErrorText("");
    currentIntentRef.current = null;

    try {
      // Falls der Warm-up fehlschlug oder noch läuft: jetzt verbinden
      // (mit Initialisierungs-Hinweis, Apple-Anforderung 5.7)
      if (!connectedReader) {
        setStatusText("Tap to Pay wird vorbereitet…");
        if (!initializedRef.current) {
          const { error: initError } = await initialize();
          if (initError) throw new Error(initError.message);
          initializedRef.current = true;
        }
        const { locationId } = await invokeTerminal({ action: "location" });
        const { error: connectError } = await easyConnect({
          discoveryMethod: "tapToPay",
          locationId,
          merchantDisplayName: "Gross ICT",
          autoReconnectOnUnexpectedDisconnect: true,
        });
        if (connectError) throw new Error(connectError.message);
        setReaderStatus("ready");
      }

      setStatusText("Zahlung wird erstellt…");
      const intent = await invokeTerminal({
        action: "create_payment_intent",
        amount: rappen,
        description,
        invoice_id: params.invoiceId || undefined,
      });
      currentIntentRef.current = intent.id;

      const { paymentIntent, error: retrieveError } = await retrievePaymentIntent(intent.clientSecret);
      if (retrieveError || !paymentIntent) throw new Error(retrieveError?.message || "PaymentIntent konnte nicht geladen werden");

      // Karte/Handy dranhalten → Zahlung verarbeiten (collect + confirm)
      setStatusText("Karte oder Handy an das iPhone halten…");
      const { paymentIntent: processed, error: processError } = await processPaymentIntent({
        paymentIntent,
      });
      if (processError) throw new Error(processError.message);
      if (!processed || processed.status !== "succeeded") {
        throw new Error(`Zahlung nicht abgeschlossen (Status: ${processed?.status || "unbekannt"})`);
      }

      // Erfolg: Rechnung verbuchen
      currentIntentRef.current = null;
      if (params.invoiceId) {
        try {
          await Data.addPayment(String(params.invoiceId), chf);
          queryClient.invalidateQueries({ queryKey: ["invoices"] });
          queryClient.invalidateQueries({ queryKey: ["invoice", params.invoiceId] });
        } catch (bookErr: any) {
          console.warn("Zahlung erhalten, aber Verbuchung fehlgeschlagen:", bookErr?.message);
        }
      }
      setPaidAmount(chf);
      setLastReceipt({ amount: chf, description, success: true, date: new Date() });
      setStep("success");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e: any) {
      if (currentIntentRef.current) {
        invokeTerminal({ action: "cancel_payment_intent", payment_intent_id: currentIntentRef.current }).catch(() => {});
        currentIntentRef.current = null;
      }
      setErrorText(e?.message || "Unbekannter Fehler");
      setLastReceipt({ amount: chf, description, success: false, date: new Date() });
      setStep("error");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      // Ergebnis auch ausserhalb der App sichtbar machen, falls sie vor dem
      // Resultat geschlossen wurde (Apple-Anforderung 5.12)
      scheduleLocalNotification(
        "Zahlung nicht erfolgreich",
        `Die Tap-to-Pay-Zahlung über ${formatCurrency(chf)} wurde nicht abgeschlossen.`,
        1
      ).catch(() => {});
    }
  }, [amount, note, connectedReader, params.invoiceId, params.invoiceNumber]);

  // Digitale Quittung teilen — SMS/E-Mail/AirDrop via iOS-Share-Sheet
  // (Apple-Anforderung 5.10, gilt für erfolgreiche UND abgelehnte Zahlungen)
  const shareReceipt = useCallback(async () => {
    if (!lastReceipt) return;
    const dateStr = lastReceipt.date.toLocaleDateString("de-CH", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
    const lines = [
      "Gross ICT — Zahlungsbeleg",
      "──────────────────────",
      `Datum: ${dateStr}`,
      `Beschreibung: ${lastReceipt.description}`,
      `Betrag: ${formatCurrency(lastReceipt.amount)}`,
      `Status: ${lastReceipt.success ? "Bezahlt (kontaktlos via Tap to Pay auf dem iPhone)" : "Nicht erfolgreich"}`,
      "──────────────────────",
      "Gross ICT · gross-ict.ch",
    ];
    try {
      await Share.share({ message: lines.join("\n") });
    } catch (_) { /* Abbruch durch Benutzer */ }
  }, [lastReceipt]);

  const resetForNext = () => {
    setStep("idle");
    setStatusText("");
    setErrorText("");
    if (!params.invoiceId) setAmount("");
  };

  const readerStatusView = (() => {
    if (connectedReader || readerStatus === "ready") {
      return (
        <View className="flex-row items-center gap-2">
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#22c55e" }} />
          <Text className="text-xs text-muted">Tap to Pay ist bereit</Text>
        </View>
      );
    }
    if (readerStatus === "connecting") {
      return (
        <View className="flex-row items-center gap-2">
          <ActivityIndicator size="small" color={colors.muted} />
          <Text className="text-xs text-muted">
            Tap to Pay wird vorbereitet…{configProgress !== null ? ` ${configProgress}%` : ""}
          </Text>
        </View>
      );
    }
    return (
      <TouchableOpacity className="flex-row items-center gap-2" onPress={() => { warmupStartedRef.current = false; setReaderStatus("connecting"); warmUp(); }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#ef4444" }} />
        <Text className="text-xs" style={{ color: colors.error }}>Noch nicht aktiviert — tippen zum Aktivieren</Text>
      </TouchableOpacity>
    );
  })();

  return (
    <ScreenContainer>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
        <ScrollView className="flex-1 p-4" keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
          {/* Header */}
          <View className="flex-row items-center justify-between mb-6">
            <View className="flex-row items-center gap-3">
              <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
                <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
              </TouchableOpacity>
              <Text className="text-3xl font-bold text-foreground">Kassieren</Text>
            </View>
            {/* Anleitung jederzeit abrufbar (Apple-Anforderung 4.3) */}
            <TouchableOpacity onPress={showEducation} activeOpacity={0.7} className="p-2">
              <IconSymbol name="questionmark.circle" size={24} color={colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Nicht berechtigte Benutzer: Hinweis statt Zahlungs-UI (Apple 3.8.1) */}
          {!profileLoading && !isAuthorized && (
            <View className="flex-1 items-center justify-center gap-4 py-20 px-6">
              <IconSymbol name="lock.fill" size={40} color={colors.muted} />
              <Text className="text-lg font-bold text-foreground text-center">
                Tap to Pay ist nicht freigeschaltet
              </Text>
              <Text className="text-sm text-muted text-center">
                Die Aktivierung und Nutzung von Tap to Pay auf dem iPhone ist Administratoren
                und der Rolle Finanzen vorbehalten. Bitte wende dich an einen Administrator,
                um Tap to Pay zu aktivieren.
              </Text>
            </View>
          )}

          {isAuthorized && step === "idle" && (
            <View className="gap-4">
              <View className="items-center">{readerStatusView}</View>

              {params.invoiceId && (
                <View className="bg-primary/10 border border-primary/30 rounded-xl p-4">
                  <Text className="text-sm font-semibold" style={{ color: colors.primary }}>
                    Rechnung {params.invoiceNumber || ""}
                  </Text>
                  {params.customerName ? (
                    <Text className="text-sm text-muted mt-1">{params.customerName}</Text>
                  ) : null}
                  <Text className="text-xs text-muted mt-1">
                    Nach erfolgreicher Zahlung wird die Rechnung automatisch als bezahlt verbucht.
                  </Text>
                </View>
              )}

              <View className="bg-surface rounded-xl p-6 border border-border items-center">
                <Text className="text-sm text-muted mb-2">Betrag (CHF)</Text>
                <TextInput
                  className="text-5xl font-bold text-foreground text-center"
                  style={{ minWidth: 180 }}
                  placeholder="0.00"
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={setAmount}
                  editable={!params.invoiceId}
                  autoFocus={!params.invoiceId}
                />
              </View>

              {!params.invoiceId && (
                <View>
                  <Text className="text-sm font-semibold text-foreground mb-2">Beschreibung (optional)</Text>
                  <TextInput
                    className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                    placeholder="z.B. Support vor Ort"
                    placeholderTextColor={colors.muted}
                    value={note}
                    onChangeText={setNote}
                  />
                </View>
              )}

              {/* Button-Text und SF-Symbol gemäss Apple-Vorgaben 5.4/5.5 */}
              <TouchableOpacity
                className="bg-primary py-4 rounded-xl flex-row items-center justify-center gap-2 mt-2"
                activeOpacity={0.8}
                onPress={startPayment}
              >
                <IconSymbol name="wave.3.right.circle.fill" size={24} color={colors.background} />
                <Text className="text-background font-bold text-lg">Tap to Pay auf dem iPhone</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={showEducation} activeOpacity={0.7}>
                <Text className="text-xs text-center mt-1" style={{ color: colors.primary, textDecorationLine: "underline" }}>
                  So funktioniert Tap to Pay
                </Text>
              </TouchableOpacity>

              <Text className="text-xs text-muted text-center">
                Der Kunde hält seine Karte oder sein Handy an dein iPhone.{"\n"}
                Akzeptiert: Visa, Mastercard, Amex, Apple Pay und andere Wallets.
              </Text>
            </View>
          )}

          {step === "paying" && (
            <View className="flex-1 items-center justify-center gap-6 py-20">
              <View
                className="w-24 h-24 rounded-full items-center justify-center"
                style={{ backgroundColor: colors.primary + "15" }}
              >
                <IconSymbol name="wave.3.right.circle.fill" size={52} color={colors.primary} />
              </View>
              <Text className="text-3xl font-bold text-foreground">
                {formatCurrency(parseAmountChf() || 0)}
              </Text>
              <View className="flex-row items-center gap-3">
                <ActivityIndicator color={colors.primary} />
                <Text className="text-base text-muted">{statusText}</Text>
              </View>
            </View>
          )}

          {step === "success" && (
            <View className="flex-1 items-center justify-center gap-6 py-20">
              <View
                className="w-24 h-24 rounded-full items-center justify-center"
                style={{ backgroundColor: "#22c55e20" }}
              >
                <IconSymbol name="checkmark.circle.fill" size={56} color="#22c55e" />
              </View>
              <View className="items-center gap-1">
                <Text className="text-3xl font-bold text-success">{formatCurrency(paidAmount)}</Text>
                <Text className="text-lg text-foreground">Zahlung erfolgreich</Text>
                {params.invoiceId && (
                  <Text className="text-sm text-muted">Rechnung {params.invoiceNumber} wurde verbucht.</Text>
                )}
              </View>
              <View className="gap-3 w-full px-8">
                <TouchableOpacity
                  className="bg-surface border border-border py-3 rounded-xl flex-row items-center justify-center gap-2"
                  activeOpacity={0.8}
                  onPress={shareReceipt}
                >
                  <IconSymbol name="square.and.arrow.up" size={18} color={colors.primary} />
                  <Text className="font-semibold" style={{ color: colors.primary }}>Quittung senden</Text>
                </TouchableOpacity>
                {!params.invoiceId && (
                  <TouchableOpacity
                    className="bg-primary py-3 rounded-xl"
                    activeOpacity={0.8}
                    onPress={resetForNext}
                  >
                    <Text className="text-background font-semibold text-center">Neue Zahlung</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  className="bg-surface border border-border py-3 rounded-xl"
                  activeOpacity={0.8}
                  onPress={() => router.back()}
                >
                  <Text className="text-foreground font-semibold text-center">Fertig</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {step === "error" && (
            <View className="flex-1 items-center justify-center gap-6 py-20">
              <View
                className="w-24 h-24 rounded-full items-center justify-center"
                style={{ backgroundColor: "#ef444420" }}
              >
                <IconSymbol name="xmark.circle.fill" size={56} color="#ef4444" />
              </View>
              <View className="items-center gap-1 px-6">
                <Text className="text-lg font-bold text-error">Zahlung fehlgeschlagen</Text>
                <Text className="text-sm text-muted text-center">{errorText}</Text>
              </View>
              <View className="gap-3 w-full px-8">
                <TouchableOpacity
                  className="bg-primary py-3 rounded-xl"
                  activeOpacity={0.8}
                  onPress={resetForNext}
                >
                  <Text className="text-background font-semibold text-center">Erneut versuchen</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="bg-surface border border-border py-3 rounded-xl flex-row items-center justify-center gap-2"
                  activeOpacity={0.8}
                  onPress={shareReceipt}
                >
                  <IconSymbol name="square.and.arrow.up" size={18} color={colors.muted} />
                  <Text className="text-muted font-semibold">Beleg senden</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="bg-surface border border-border py-3 rounded-xl"
                  activeOpacity={0.8}
                  onPress={() => router.back()}
                >
                  <Text className="text-foreground font-semibold text-center">Abbrechen</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Fallback-Anleitung für iOS < 18 (Apple-Education nicht verfügbar) */}
      <Modal visible={showFallbackEducation} animationType="slide" transparent onRequestClose={() => setShowFallbackEducation(false)}>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-background rounded-t-3xl p-6" style={{ maxHeight: "85%" }}>
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-xl font-bold text-foreground">So funktioniert Tap to Pay</Text>
              <TouchableOpacity onPress={() => setShowFallbackEducation(false)} activeOpacity={0.7}>
                <IconSymbol name="xmark.circle.fill" size={26} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="gap-4 pb-6">
                <View className="items-center py-4">
                  <IconSymbol name="wave.3.right.circle.fill" size={64} color={colors.primary} />
                </View>
                <View className="gap-3">
                  <View className="flex-row gap-3">
                    <Text className="text-lg font-bold" style={{ color: colors.primary }}>1.</Text>
                    <Text className="text-sm text-foreground flex-1">
                      Betrag eingeben und auf «Tap to Pay auf dem iPhone» tippen.
                    </Text>
                  </View>
                  <View className="flex-row gap-3">
                    <Text className="text-lg font-bold" style={{ color: colors.primary }}>2.</Text>
                    <Text className="text-sm text-foreground flex-1">
                      <Text className="font-semibold">Kontaktlose Karte:</Text> Der Kunde hält seine Karte flach oben an das iPhone (an die NFC-Antenne) und lässt sie liegen, bis die Bestätigung erscheint.
                    </Text>
                  </View>
                  <View className="flex-row gap-3">
                    <Text className="text-lg font-bold" style={{ color: colors.primary }}>3.</Text>
                    <Text className="text-sm text-foreground flex-1">
                      <Text className="font-semibold">Apple Pay & andere Wallets:</Text> Der Kunde hält sein iPhone oder seine Apple Watch (bzw. sein Android-Handy) an die Oberseite deines iPhones.
                    </Text>
                  </View>
                  <View className="flex-row gap-3">
                    <Text className="text-lg font-bold" style={{ color: colors.primary }}>4.</Text>
                    <Text className="text-sm text-foreground flex-1">
                      <Text className="font-semibold">PIN-Eingabe:</Text> Bei höheren Beträgen kann der Kunde aufgefordert werden, seine Karten-PIN direkt auf deinem iPhone einzugeben. Auf dem PIN-Bildschirm stehen Bedienungshilfen (z.B. grössere Tasten, VoiceOver) zur Verfügung.
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  className="bg-primary py-3 rounded-xl mt-2"
                  activeOpacity={0.8}
                  onPress={() => setShowFallbackEducation(false)}
                >
                  <Text className="text-background font-semibold text-center">Verstanden</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

export default function TapToPayScreen() {
  // Der Token-Provider holt bei Bedarf einen frischen Connection Token vom Server
  const fetchConnectionToken = useCallback(async () => {
    const data = await invokeTerminal({ action: "connection_token" });
    return data.secret as string;
  }, []);

  return (
    <StripeTerminalProvider logLevel="none" tokenProvider={fetchConnectionToken}>
      <TapToPayInner />
    </StripeTerminalProvider>
  );
}

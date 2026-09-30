import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { formatCurrency } from "@/lib/format";
import * as Data from "@/lib/data";
import { supabase } from "@/lib/supabase";

type Step = "idle" | "paying" | "success" | "error";

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
  const initializedRef = useRef(false);
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
  });

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
    setStep("paying");
    setErrorText("");
    currentIntentRef.current = null;

    try {
      // 1. Terminal SDK initialisieren (einmalig)
      if (!initializedRef.current) {
        setStatusText("Initialisiere…");
        const { error: initError } = await initialize();
        if (initError) throw new Error(initError.message);
        initializedRef.current = true;
      }

      // 2. Mit dem Tap-to-Pay-Reader (das iPhone selbst) verbinden
      if (!connectedReader) {
        setStatusText("Tap to Pay wird vorbereitet…");
        const { locationId } = await invokeTerminal({ action: "location" });
        const { error: connectError } = await easyConnect({
          discoveryMethod: "tapToPay",
          locationId,
          merchantDisplayName: "Gross ICT",
          autoReconnectOnUnexpectedDisconnect: true,
        });
        if (connectError) throw new Error(connectError.message);
      }

      // 3. PaymentIntent serverseitig erstellen
      setStatusText("Zahlung wird erstellt…");
      const description = params.invoiceNumber
        ? `Rechnung ${params.invoiceNumber}`
        : note.trim() || "Tap to Pay Zahlung";
      const intent = await invokeTerminal({
        action: "create_payment_intent",
        amount: rappen,
        description,
        invoice_id: params.invoiceId || undefined,
      });
      currentIntentRef.current = intent.id;

      const { paymentIntent, error: retrieveError } = await retrievePaymentIntent(intent.clientSecret);
      if (retrieveError || !paymentIntent) throw new Error(retrieveError?.message || "PaymentIntent konnte nicht geladen werden");

      // 4. Karte/Handy dranhalten → Zahlung verarbeiten (collect + confirm)
      setStatusText("Karte oder Handy an das iPhone halten…");
      const { paymentIntent: processed, error: processError } = await processPaymentIntent({
        paymentIntent,
      });
      if (processError) throw new Error(processError.message);
      if (!processed || processed.status !== "succeeded") {
        throw new Error(`Zahlung nicht abgeschlossen (Status: ${processed?.status || "unbekannt"})`);
      }

      // 5. Erfolg: Rechnung verbuchen
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
      setStep("success");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e: any) {
      // Nicht abgeschlossenen PaymentIntent aufräumen
      if (currentIntentRef.current) {
        invokeTerminal({ action: "cancel_payment_intent", payment_intent_id: currentIntentRef.current }).catch(() => {});
        currentIntentRef.current = null;
      }
      setErrorText(e?.message || "Unbekannter Fehler");
      setStep("error");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  }, [amount, note, connectedReader, params.invoiceId, params.invoiceNumber]);

  const resetForNext = () => {
    setStep("idle");
    setStatusText("");
    setErrorText("");
    if (!params.invoiceId) setAmount("");
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
        <ScrollView className="flex-1 p-4" keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
          {/* Header */}
          <View className="flex-row items-center gap-3 mb-6">
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
              <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <Text className="text-3xl font-bold text-foreground">Kassieren</Text>
          </View>

          {step === "idle" && (
            <View className="gap-4">
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

              <TouchableOpacity
                className="bg-primary py-4 rounded-xl flex-row items-center justify-center gap-2 mt-2"
                activeOpacity={0.8}
                onPress={startPayment}
              >
                <IconSymbol name="wave.3.right" size={22} color={colors.background} />
                <Text className="text-background font-bold text-lg">Zahlung starten</Text>
              </TouchableOpacity>

              <Text className="text-xs text-muted text-center mt-2">
                Der Kunde hält seine Karte oder sein Handy an dein iPhone.{"\n"}
                Akzeptiert: Visa, Mastercard, Amex, Apple Pay, Google Pay.
              </Text>
            </View>
          )}

          {step === "paying" && (
            <View className="flex-1 items-center justify-center gap-6 py-20">
              <View
                className="w-24 h-24 rounded-full items-center justify-center"
                style={{ backgroundColor: colors.primary + "15" }}
              >
                <IconSymbol name="wave.3.right" size={48} color={colors.primary} />
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

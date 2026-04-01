import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { Alert, Platform } from "react-native";
import { supabase } from "./supabase";

// ──────────────────────────────────────────────────────────────
// Shared: PDF aus Base64 öffnen (Web: neuer Tab, Native: Share)
// ──────────────────────────────────────────────────────────────

async function openPDFFromBase64(base64: string, filename: string): Promise<void> {
  if (Platform.OS === "web") {
    // Web: Base64 → Blob → Neuer Tab (Drucken + Download möglich)
    const byteChars = atob(base64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteNumbers[i] = byteChars.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: "application/pdf" });
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, "_blank");
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    return;
  }

  // Native: Base64 → Datei → Teilen (Drucken möglich via Share-Dialog)
  const fileUri = FileSystem.cacheDirectory + filename;
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  await Sharing.shareAsync(fileUri, {
    UTI: "com.adobe.pdf",
    mimeType: "application/pdf",
  });
}

// ──────────────────────────────────────────────────────────────
// Server-side PDF generieren via Edge Function
// ──────────────────────────────────────────────────────────────

async function fetchPDFFromEdgeFunction(params: string): Promise<string> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
  const url = `${supabaseUrl}/functions/v1/contract-page?${params}`;

  // Get the current session token for authorization
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Unbekannter Fehler" }));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  if (!data.pdf) {
    throw new Error("Kein PDF in der Antwort erhalten");
  }
  return data.pdf;
}

// ──────────────────────────────────────────────────────────────
// VERTRAG PDF
// ──────────────────────────────────────────────────────────────

export async function downloadContractPDF(contract: { id: string; title: string }): Promise<void> {
  try {
    const base64 = await fetchPDFFromEdgeFunction(
      `id=${encodeURIComponent(contract.id)}&action=generate-pdf`
    );
    const safeTitle = contract.title.replace(/[^a-zA-Z0-9äöüÄÖÜ_\- ]/g, "").replace(/\s+/g, "_");
    await openPDFFromBase64(base64, `Vertrag_${safeTitle}.pdf`);
  } catch (err: any) {
    console.error("[PDF] Contract PDF error:", err);
    Alert.alert("Fehler", "PDF konnte nicht erstellt werden: " + err.message);
  }
}

// ──────────────────────────────────────────────────────────────
// RECHNUNG PDF
// ──────────────────────────────────────────────────────────────

export async function downloadInvoicePDF(invoice: { id: string; invoice_number: string }, _settings?: any): Promise<void> {
  try {
    const base64 = await fetchPDFFromEdgeFunction(
      `id=${encodeURIComponent(invoice.id)}&action=generate-invoice-pdf`
    );
    await openPDFFromBase64(base64, `Rechnung_${invoice.invoice_number}.pdf`);
  } catch (err: any) {
    console.error("[PDF] Invoice PDF error:", err);
    Alert.alert("Fehler", "Rechnungs-PDF konnte nicht erstellt werden: " + err.message);
  }
}

export async function generateInvoicePDFBase64(invoice: { id: string }, _settings?: any): Promise<string | null> {
  try {
    return await fetchPDFFromEdgeFunction(
      `id=${encodeURIComponent(invoice.id)}&action=generate-invoice-pdf`
    );
  } catch (err: any) {
    console.error("[PDF] generateInvoicePDFBase64 error:", err);
    return null;
  }
}

// ──────────────────────────────────────────────────────────────
// ANGEBOT PDF
// ──────────────────────────────────────────────────────────────

export async function downloadQuotePDF(quote: { id: string; quote_number: string }): Promise<void> {
  try {
    const base64 = await fetchPDFFromEdgeFunction(
      `id=${encodeURIComponent(quote.id)}&action=generate-quote-pdf`
    );
    await openPDFFromBase64(base64, `Angebot_${quote.quote_number}.pdf`);
  } catch (err: any) {
    console.error("[PDF] Quote PDF error:", err);
    Alert.alert("Fehler", "Angebots-PDF konnte nicht erstellt werden: " + err.message);
  }
}

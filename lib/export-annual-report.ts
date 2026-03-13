import * as fflate from "fflate";
import { Platform } from "react-native";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { 
    AnnualReportData, 
    generateAnnualReportBase64 
} from "./pdf-annual-report";
import { 
    generateBuchungsjournalBase64, 
    BuchungsjournalData, 
    JournalEntry 
} from "./pdf-buchungsjournal";
import { getInvoiceTotal } from "./format";
import { decode, encode } from "base64-arraybuffer";

export async function exportAnnualZIP(
    year: number,
    invoices: any[],
    expenses: any[],
    annualData: AnnualReportData,
    onProgress?: (msg: string) => void
) {
    if (onProgress) onProgress("Initialisiere Export...");
    const zipData: Record<string, Uint8Array> = {};

    // 1. Generate Summary PDF
    if (onProgress) onProgress("Erstelle Jahresübersicht (PDF)...");
    const summaryBase64 = generateAnnualReportBase64(annualData);
    if (summaryBase64) {
        zipData[`01_Jahresuebersicht_${year}.pdf`] = new Uint8Array(decode(summaryBase64));
    }

    // 2. Build Journal Data
    if (onProgress) onProgress("Erstelle Buchungsjournal (PDF)...");
    const entries: JournalEntry[] = [];
    let totalIncome = 0;
    let totalExpense = 0;

    // Add Invoices
    for (const inv of invoices) {
        // Only include paid invoices for simple accounting
        if (inv.status === "paid" || inv.paid_amount > 0) {
            const amt = inv.paid_amount > 0 ? inv.paid_amount : getInvoiceTotal(inv);
            totalIncome += amt;
            const customerName = inv.customer?.company_name || 
                `${inv.customer?.first_name || ""} ${inv.customer?.last_name || ""}`.trim() || 
                "Kunde";

            entries.push({
                id: inv.id,
                date: inv.invoice_date,
                type: "Einnahme",
                description: `Rechnung ${inv.invoice_number} - ${customerName}`,
                categoryOrStatus: "Bezahlt",
                amount: amt,
                hasReceipt: false
            });
        }
    }

    // Add Expenses
    for (const exp of expenses) {
        totalExpense += exp.amount || 0;
        entries.push({
            id: exp.id,
            date: exp.expense_date,
            type: "Ausgabe",
            description: exp.description || "Unbekannte Ausgabe",
            categoryOrStatus: exp.category || "Unbekannt",
            amount: exp.amount || 0,
            hasReceipt: !!exp.receipt_url
        });
    }

    // Sort chronologically
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const journalData: BuchungsjournalData = {
        year,
        entries,
        totalIncome,
        totalExpense
    };

    const journalBase64 = generateBuchungsjournalBase64(journalData);
    if (journalBase64) {
        zipData[`02_Buchungsjournal_${year}.pdf`] = new Uint8Array(decode(journalBase64));
    }

    // 3. Download Receipts
    const expensesWithReceipts = expenses.filter(e => !!e.receipt_url);
    if (expensesWithReceipts.length > 0) {
        let count = 0;

        for (const exp of expensesWithReceipts) {
            count++;
            if (onProgress) onProgress(`Lade Belege herunter... ${count}/${expensesWithReceipts.length}`);
            
            try {
                // Determine extension from URL or fallback
                const url = exp.receipt_url as string;
                let ext = "pdf";
                if (url.toLowerCase().includes(".jpg") || url.toLowerCase().includes(".jpeg")) ext = "jpg";
                if (url.toLowerCase().includes(".png")) ext = "png";

                // Sanitize description for filename
                const safeDesc = (exp.description || "Beleg").replace(/[^a-z0-9]/gi, '_').substring(0, 30);
                const filename = `${exp.expense_date}_${safeDesc}.${ext}`;

                // Fetch data
                // Note: fetch() blob doesn't work well in Native RN Supabase sometimes, 
                // but for simple public URLs, arrayBuffer usually works.
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();

                zipData[`03_Belege/${filename}`] = new Uint8Array(arrayBuffer);
            } catch (err) {
                console.error("Failed to download receipt:", exp.receipt_url, err);
                // We add a text file as a placeholder if it failed
                const encoder = new TextEncoder();
                zipData[`03_Belege/FEHLER_${exp.expense_date}_${exp.id}.txt`] = encoder.encode(
                    "Beleg konnte nicht heruntergeladen werden: " + exp.receipt_url
                );
            }
        }
    }

    // 4. Generate ZIP & Share
    if (onProgress) onProgress("Archiv wird gepackt...");
    const zipName = `Jahresabschluss_GrossICT_${year}.zip`;
    
    // Compress synchronously but ideally in a timeout to avoid blocking UI fully, or just synchronously
    const zippedBuffer = fflate.zipSync(zipData, { level: 6 });

    if (Platform.OS === "web") {
        const blob = new Blob([zippedBuffer as any], { type: "application/zip" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = zipName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } else {
        // We use the backing buffer. Since zipSync creates a fresh Uint8Array, .buffer is exactly its size.
        const base64Zip = encode(zippedBuffer.buffer as ArrayBuffer);
        const fileUri = FileSystem.cacheDirectory + zipName;
        await FileSystem.writeAsStringAsync(fileUri, base64Zip, { 
            encoding: FileSystem.EncodingType.Base64 
        });
        
        await Sharing.shareAsync(fileUri, {
            mimeType: "application/zip",
            dialogTitle: `Jahresabschluss ${year} Export`,
        });
    }

    if (onProgress) onProgress("Fertig!");
}

import { jsPDF } from "jspdf";
import { LOGO_BASE64 } from "./logo-base64";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { Alert, Platform } from "react-native";

export interface JournalEntry {
  id: string;
  date: string;
  type: "Einnahme" | "Ausgabe";
  description: string;
  categoryOrStatus: string;
  amount: number;
  hasReceipt: boolean;
}

export interface BuchungsjournalData {
  year: number;
  entries: JournalEntry[];
  totalIncome: number;
  totalExpense: number;
}

function fmtCHF(amount: number | null | undefined): string {
  if (amount == null) return "0.00";
  return amount.toLocaleString("de-CH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(dateString: string | Date): string {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

export function generateBuchungsjournalJSPDF(data: BuchungsjournalData): any {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  
  const cGold = [212, 164, 50] as [number, number, number];
  const cDarkBg = [26, 26, 46] as [number, number, number];
  const cTextDark = [26, 26, 46] as [number, number, number];
  const cTextMuted = [100, 116, 139] as [number, number, number];
  const cTextLight = [148, 163, 184] as [number, number, number];
  const cBoxBg = [248, 250, 251] as [number, number, number];
  const cBorder = [226, 232, 240] as [number, number, number];

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 25;
  let y = 0;
  let isFirstPage = true;

  const drawHeader = () => {
    // 1. Accent Bar
    doc.setFillColor(...cGold);
    doc.rect(0, 0, pageWidth, 5, "F");
    y = 25;

    if (isFirstPage) {
      // 2. Logo & Doc Type
      if (LOGO_BASE64) {
        try {
          doc.addImage(LOGO_BASE64, "JPEG", marginX, y, 30, 11);
        } catch {
          doc.setFontSize(16);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(...cDarkBg);
          doc.text("Gross · ICT", marginX, y + 8);
        }
      } else {
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...cDarkBg);
        doc.text("Gross · ICT", marginX, y + 8);
      }

      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...cGold);
      doc.text(`BUCHUNGSJOURNAL ${data.year}`, pageWidth - marginX, y + 8, { align: "right" });

      y += 15;

      // 3. Company Bar
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...cTextMuted);
      
      const companyDetails = "Gross ICT · Neuhushof 3 · 6144 Zell LU · Schweiz | info@gross-ict.ch · CHE-295.539.183 MWST";
      doc.text(companyDetails, pageWidth - marginX, y, { align: "right" });

      y += 8;
      doc.setDrawColor(...cBorder);
      doc.setLineWidth(0.5);
      doc.line(pageWidth - marginX - 120, y, pageWidth - marginX, y);
      
      y += 15;
    }

    // 4. Table Header
    doc.setFillColor(...cBoxBg);
    doc.rect(marginX, y, pageWidth - marginX * 2, 8, "F");
    doc.setDrawColor(...cBorder);
    doc.setLineWidth(0.5);
    doc.line(marginX, y + 8, pageWidth - marginX, y + 8);
    
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...cTextMuted);
    
    const colDate = marginX + 2;
    const colDesc = marginX + 25;
    const colCat = marginX + 85;
    const colInc = marginX + 125;
    const colExp = pageWidth - marginX - 2;

    doc.text("DATUM", colDate, y + 5);
    doc.text("BESCHREIBUNG", colDesc, y + 5);
    doc.text("KATEGORIE", colCat, y + 5);
    doc.text("EINNAHME (CHF)", colInc, y + 5, { align: "right" });
    doc.text("AUSGABE (CHF)", colExp, y + 5, { align: "right" });
    
    y += 10;
    isFirstPage = false;
  };

  const drawFooter = () => {
    const fh = 25;
    const fy = pageHeight - fh;
    
    doc.setFillColor(...cDarkBg);
    doc.rect(0, fy, pageWidth, fh, "F");

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...cTextLight);
    doc.text(`Gross ICT - Buchungsjournal ${data.year} · Generiert am ${fmtDate(new Date())}`, pageWidth / 2, fy + 12, { align: "center" });
  };

  drawHeader();

  // 5. Table Rows
  const colDate = marginX + 2;
  const colDesc = marginX + 25;
  const colCat = marginX + 85;
  const colInc = marginX + 125;
  const colExp = pageWidth - marginX - 2;

  if (data.entries.length === 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...cTextMuted);
    doc.text("Keine Buchungen gefunden.", pageWidth / 2, y + 10, { align: "center" });
    y += 20;
  } else {
    for (let i = 0; i < data.entries.length; i++) {
      const entry = data.entries[i];
      
      // Wrapping description
      let title = entry.description;
      if (entry.hasReceipt) title += " [BELEG]";
      const descLines = doc.splitTextToSize(title, 55);
      const catLines = doc.splitTextToSize(entry.categoryOrStatus, 35);
      
      const rowH = Math.max(descLines.length, catLines.length) * 4 + 4;

      if (y + rowH > pageHeight - 40) {
        drawFooter();
        doc.addPage();
        y = 0;
        drawHeader();
      }

      if (i % 2 !== 0) {
        doc.setFillColor(253, 253, 253);
        doc.rect(marginX, y - 2, pageWidth - marginX * 2, rowH, "F");
      }

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      
      // Date
      doc.setTextColor(...cTextMuted);
      doc.text(fmtDate(entry.date), colDate, y + 2);

      // Description
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...cTextDark);
      for (let l = 0; l < descLines.length; l++) {
        doc.text(descLines[l], colDesc, y + 2 + (l * 4));
      }

      // Category
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...cTextMuted);
      for (let l = 0; l < catLines.length; l++) {
        doc.text(catLines[l], colCat, y + 2 + (l * 4));
      }

      // Amounts
      doc.setFont("helvetica", "bold");
      if (entry.type === "Einnahme") {
        doc.setTextColor(22, 101, 52); // #166534
        doc.text(fmtCHF(entry.amount), colInc, y + 2, { align: "right" });
      } else {
        doc.setTextColor(185, 28, 28); // #b91c1c
        doc.text(fmtCHF(entry.amount), colExp, y + 2, { align: "right" });
      }

      y += rowH;
      
      doc.setDrawColor(241, 245, 249); // #f1f5f9
      doc.setLineWidth(0.25);
      doc.line(marginX, y - 2, pageWidth - marginX, y - 2);
    }
  }

  y += 5;

  // 6. Totals Box
  if (y + 40 > pageHeight - 40) {
    drawFooter();
    doc.addPage();
    y = 0;
    drawHeader();
  }

  const totalsW = 80;
  const totalsX = pageWidth - marginX - totalsW;

  doc.setDrawColor(...cBorder);
  doc.setLineWidth(0.5);
  doc.roundedRect(totalsX, y, totalsW, 25, 2, 2, "S");

  doc.setFontSize(9);
  
  // Total Income
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...cTextMuted);
  doc.text("Total Einnahmen:", totalsX + 5, y + 6);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(22, 101, 52);
  doc.text(fmtCHF(data.totalIncome), totalsX + totalsW - 5, y + 6, { align: "right" });
  
  // Total Expense
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...cTextMuted);
  doc.text("Total Ausgaben:", totalsX + 5, y + 13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(185, 28, 28);
  doc.text(fmtCHF(data.totalExpense), totalsX + totalsW - 5, y + 13, { align: "right" });

  doc.setDrawColor(...cBorder);
  doc.setLineWidth(0.5);
  doc.line(totalsX, y + 16, totalsX + totalsW, y + 16);

  // Cashflow
  doc.setFillColor(241, 245, 249);
  doc.rect(totalsX + 0.25, y + 16.25, totalsW - 0.5, 8.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...cDarkBg);
  doc.text("Cashflow / Gewinn:", totalsX + 5, y + 22);
  const profit = data.totalIncome - data.totalExpense;
  doc.setTextColor(profit >= 0 ? 22 : 185, profit >= 0 ? 101 : 28, profit >= 0 ? 52 : 28);
  doc.text(fmtCHF(profit), totalsX + totalsW - 5, y + 22, { align: "right" });

  y += 35;

  // 7. Notes
  if (y + 15 > pageHeight - 40) {
    drawFooter();
    doc.addPage();
    y = 0;
    drawHeader();
  }
  doc.setFillColor(...cBoxBg);
  doc.rect(marginX, y, pageWidth - marginX * 2, 15, "F");
  doc.setFillColor(...cTextLight);
  doc.rect(marginX, y, 1.5, 15, "F");

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...cTextMuted);
  doc.text("Hinweis zur gesetzlichen Aufbewahrungspflicht:", marginX + 5, y + 6);
  doc.setFont("helvetica", "normal");
  doc.text(`Dieses Journal dient als chronologische Aufzeichnung sämtlicher Geschäftsvorfälle des Jahres ${data.year}. Die zugehörigen Originalbelege sind bei der Aufbewahrung untrennbar mit diesem Journal zu verknüpfen (Belegsammlung).`, marginX + 5, y + 11, { maxWidth: pageWidth - marginX * 2 - 10 });

  drawFooter();

  return doc;
}

export function generateBuchungsjournalBase64(data: BuchungsjournalData): string {
  const doc = generateBuchungsjournalJSPDF(data);
  const dataUri = doc.output("datauristring");
  return dataUri.split("base64,")[1];
}

export async function downloadBuchungsjournalPDF(data: BuchungsjournalData) {
  try {
    const doc = generateBuchungsjournalJSPDF(data);
    const fileName = `Buchungsjournal_${data.year}.pdf`;

    if (Platform.OS === "web") {
      doc.save(fileName);
    } else {
      const pdfBase64 = doc.output("datauristring").split("base64,")[1];
      const fileUri = FileSystem.cacheDirectory + fileName;
      await FileSystem.writeAsStringAsync(fileUri, pdfBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await Sharing.shareAsync(fileUri, {
        UTI: "com.adobe.pdf",
        mimeType: "application/pdf",
        dialogTitle: `Buchungsjournal ${data.year} teilen`,
      });
    }
  } catch (error: any) {
    Alert.alert("Fehler beim Export", error?.message || "PDF konnte nicht generiert werden.");
  }
}

import { LOGO_BASE64 } from "./logo-base64";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { Alert, Platform } from "react-native";
import { jsPDF } from "./jspdf-import";

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

export interface AnnualReportData {
  year: number;
  paidRevenue: number;
  totalOpen: number;
  sachaufwand: number;
  salaryExpense: number;
  agBeitrage: number;
  uvgPremie: number;
  trueProfit: number;
  anBeitrageUndQuellensteuer: number;
  expensesByCategory: Array<{ label: string; amount: number; category: string }>;
}

export function generateAnnualReportJSPDF(data: AnnualReportData): any {
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

  // 1. Accent Bar
  doc.setFillColor(...cGold);
  doc.rect(0, 0, pageWidth, 5, "F");
  
  y = 25;

  // 2. Logo & Doc Type
  if (LOGO_BASE64) {
    try {
      doc.addImage(LOGO_BASE64, "JPEG", marginX, y, 40, 15);
    } catch {
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...cDarkBg);
      doc.text("Gross · ICT", marginX, y + 10);
    }
  } else {
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...cDarkBg);
    doc.text("Gross · ICT", marginX, y + 10);
  }

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...cGold);
  doc.text(`JAHRESABSCHLUSS ${data.year}`, pageWidth - marginX, y + 12, { align: "right" });

  y += 20;

  // 3. Company Bar
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...cTextMuted);
  
  doc.setFont("helvetica", "bold");
  doc.text("Gross ICT  ·  Neuhushof 3  ·  6144 Zell LU  ·  Schweiz", pageWidth - marginX, y, { align: "right" });
  
  doc.setFont("helvetica", "normal");
  doc.text("Stefan Gross  ·  +41 41 562 34 16  ·  info@gross-ict.ch", pageWidth - marginX, y + 5, { align: "right" });

  y += 10;
  doc.setDrawColor(...cBorder);
  doc.setLineWidth(0.5);
  doc.line(pageWidth - marginX - 100, y, pageWidth - marginX, y);
  
  y += 15;

  // 4. Addresses & Meta
  const metaBoxW = 75;
  const metaBoxX = pageWidth - marginX - metaBoxW;
  
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...cTextLight);
  doc.text("ZWECKPFLICHTIGER", marginX, y);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...cTextDark);
  
  let addrY = y + 5;
  doc.text("Gross ICT", marginX, addrY); addrY += 5;
  doc.text("Neuhushof 3", marginX, addrY); addrY += 5;
  doc.text("6144 Zell LU", marginX, addrY); addrY += 5;
  doc.text("Schweiz", marginX, addrY); addrY += 5;

  doc.setFillColor(...cBoxBg);
  doc.setDrawColor(...cBorder);
  doc.roundedRect(metaBoxX, y - 4, metaBoxW, 25, 2, 2, "FD");

  doc.setFontSize(9);
  let metaY = y + 3;
  const mLabelX = metaBoxX + 5;
  const mValueX = metaBoxX + metaBoxW - 5;

  doc.setFont("helvetica", "normal"); doc.setTextColor(...cTextMuted);
  doc.text("Geschäftsjahr", mLabelX, metaY);
  doc.setFont("helvetica", "bold"); doc.setTextColor(...cTextDark);
  doc.text(String(data.year), mValueX, metaY, { align: "right" });
  metaY += 6;

  doc.setFont("helvetica", "normal"); doc.setTextColor(...cTextMuted);
  doc.text("Erstellt am", mLabelX, metaY);
  doc.setFont("helvetica", "bold"); doc.setTextColor(...cTextDark);
  doc.text(fmtDate(new Date()), mValueX, metaY, { align: "right" });

  y = Math.max(addrY, y + 30) + 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...cTextMuted);
  const introText = `Diese Jahresübersicht fasst die finanzielle Leistung von Gross ICT für das Geschäftsjahr ${data.year} zusammen. Alle Beträge verstehen sich in Schweizer Franken (CHF).`;
  const introLines = doc.splitTextToSize(introText, pageWidth - marginX * 2);
  doc.text(introLines, marginX, y);
  y += introLines.length * 5 + 10;

  // --- Helper for drawing table headers ---
  const drawSectionHeader = (title: string, currentY: number) => {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...cGold);
    doc.text(title.toUpperCase(), marginX, currentY);
    currentY += 2;
    doc.setDrawColor(...cGold);
    doc.setLineWidth(1);
    doc.line(marginX, currentY, pageWidth - marginX, currentY);
    return currentY + 6;
  };

  // --- Helper for drawing table rows ---
  const drawRow = (label: string, amount: number, currentY: number, isTotal: boolean = false, isProfit: boolean = false) => {
    if (isProfit) {
      doc.setFillColor(241, 245, 249); // #f1f5f9
      doc.rect(marginX, currentY - 5, pageWidth - marginX * 2, 10, "F");
      doc.setDrawColor(148, 163, 184); // #94a3b8
      doc.setLineWidth(0.5);
      doc.line(marginX, currentY - 5, pageWidth - marginX, currentY - 5);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...cTextDark);
      doc.text(label, marginX + 3, currentY + 1);
      
      const profitColor = amount >= 0 ? [34, 197, 94] : [239, 68, 68];
      doc.setTextColor(profitColor[0], profitColor[1], profitColor[2]);
      doc.text(fmtCHF(amount) + " CHF", pageWidth - marginX - 3, currentY + 1, { align: "right" });
      return currentY + 10;
    }

    if (isTotal) {
      doc.setFillColor(...cBoxBg);
      doc.rect(marginX, currentY - 4, pageWidth - marginX * 2, 8, "F");
      doc.setDrawColor(...cBorder);
      doc.setLineWidth(0.5);
      doc.line(marginX, currentY - 4, pageWidth - marginX, currentY - 4);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...cTextDark);
      doc.text(label, marginX + 3, currentY + 1);
      doc.text(fmtCHF(amount) + " CHF", pageWidth - marginX - 3, currentY + 1, { align: "right" });
      return currentY + 8;
    }

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...cTextDark);
    doc.text(label, marginX, currentY);
    doc.text(fmtCHF(amount) + " CHF", pageWidth - marginX, currentY, { align: "right" });
    currentY += 3;
    doc.setDrawColor(...cBorder);
    doc.setLineWidth(0.25);
    doc.line(marginX, currentY, pageWidth - marginX, currentY);
    return currentY + 5;
  };

  // 5. REVENUE
  y = drawSectionHeader("Einnahmen", y);
  y = drawRow("Bezahlte Rechnungen / Einnahmen", data.paidRevenue, y);
  if (data.totalOpen > 0) y = drawRow(`Noch offen in ${data.year}`, data.totalOpen, y);
  y = drawRow("Total Ertrag", data.paidRevenue + data.totalOpen, y, true);
  y += 10;

  // 6. EXPENSES
  y = drawSectionHeader("Betriebsaufwand (Sachaufwand)", y);
  const sachaufwands = data.expensesByCategory.filter(c => c.category !== "salary");
  if (sachaufwands.length === 0) {
    y = drawRow("Keine Sachaufwendungen", 0, y);
  } else {
    for (const s of sachaufwands) {
      if (y > pageHeight - 30) { doc.addPage(); y = 20; }
      y = drawRow(s.label, s.amount, y);
    }
  }
  y = drawRow("Total Sachaufwand", data.sachaufwand, y, true);
  y += 10;

  // 7. PERSONAL
  if (y > pageHeight - 50) { doc.addPage(); y = 20; }
  y = drawSectionHeader("Personalaufwand (Inkl. Freelancer)", y);
  y = drawRow("Löhne / Honorare", data.salaryExpense, y);
  y = drawRow("AG-Beiträge AHV/IV/EO/ALV & FAK", data.agBeitrage, y);
  y = drawRow("UVG / KTG Prämien", data.uvgPremie, y);
  y = drawRow("Total Personalaufwand", data.salaryExpense + data.agBeitrage + data.uvgPremie, y, true);
  y += 10;

  const totalExpenses = data.sachaufwand + data.salaryExpense + data.agBeitrage + data.uvgPremie;
  y = drawRow("Gewinn vor Steuern / Rückstellungen", (data.paidRevenue + data.totalOpen) - totalExpenses, y, false, true);
  y += 15;

  // 8. DEDUCTIONS (Optional Info box)
  if (data.anBeitrageUndQuellensteuer > 0) {
    if (y > pageHeight - 40) { doc.addPage(); y = 20; }
    doc.setFillColor(...cBoxBg);
    doc.setDrawColor(...cGold);
    doc.setLineWidth(0.5);
    doc.setLineDashPattern([2, 2], 0);
    doc.roundedRect(marginX, y, pageWidth - marginX * 2, 20, 2, 2, "FD");
    doc.setLineDashPattern([], 0); // reset

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...cGold);
    doc.text("WICHTIGE ABZÜGE (ZUR KENNTNISNAHME)", marginX + 5, y + 6);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...cTextMuted);
    doc.text("Der Inhaber / die Inhaberin schuldet in der privaten Steuererklärung für diesen Verdienst Beiträge:", marginX + 5, y + 11);
    
    doc.setFont("helvetica", "bold");
    doc.setTextColor(239, 68, 68);
    doc.text(`-${fmtCHF(data.anBeitrageUndQuellensteuer)} CHF`, pageWidth - marginX - 5, y + 16, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...cTextMuted);
    doc.text("AN-Beiträge AHV/IV/EO/ALV (Gesamt 10.6%) & ca. 15% Einkommenssteuer", marginX + 5, y + 16);
  }

  // Footer (Fixed at bottom)
  const fh = 30;
  const fy = pageHeight - fh;
  
  doc.setFillColor(...cDarkBg); // #1a1a2e
  doc.rect(0, fy, pageWidth, fh, "F");

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...cTextLight);
  doc.text("Gross ICT · Neuhushof 3 · 6144 Zell LU · info@gross-ict.ch · www.gross-ict.ch", pageWidth / 2, fy + 15, { align: "center" });

  return doc;
}

export function generateAnnualReportBase64(data: AnnualReportData): string {
  const doc = generateAnnualReportJSPDF(data);
  const dataUri = doc.output("datauristring");
  return dataUri.split("base64,")[1];
}

export async function downloadAnnualReportPDF(data: AnnualReportData) {
  try {
    const doc = generateAnnualReportJSPDF(data);
    const fileName = `Jahresabschluss_${data.year}.pdf`;

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
        dialogTitle: `Jahresabschluss ${data.year} teilen`,
      });
    }
  } catch (error: any) {
    Alert.alert("Fehler beim Export", error?.message || "PDF konnte nicht generiert werden.");
  }
}

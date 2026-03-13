import { jsPDF } from "jspdf";
import { LOGO_BASE64 } from "./logo-base64";

export interface QuittungData {
  freelancerName: string;
  freelancerAddress: string;
  freelancerIban: string;
  projectDescription: string;
  amount: number;
  date: string;
}

function fmtCHF(amount: number): string {
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

export function generateQuittungJSPDF(data: QuittungData): any {
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
      // Adjusted aspect ratio for the logo to avoid distortion
      doc.addImage(LOGO_BASE64, "JPEG", pageWidth - marginX - 45, y, 45, 12);
    } catch {
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...cDarkBg);
      doc.text("Gross · ICT", pageWidth - marginX, y + 10, { align: "right" });
    }
  } else {
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...cDarkBg);
    doc.text("Gross · ICT", pageWidth - marginX, y + 10, { align: "right" });
  }

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...cGold);
  doc.text("ABRECHNUNG LEISTUNGEN", marginX, y + 8);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...cTextMuted);
  doc.text(`Datum: ${fmtDate(data.date)}`, marginX, y + 14);

  y += 30;

  // 3. Addresses
  const col1X = marginX;
  const col2X = marginX + 85;

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...cTextLight);
  doc.text("LEISTUNGSERBRINGER (PRIVATPERSON)", col1X, y);
  doc.text("LEISTUNGSEMPFÄNGER / AUSSTELLER", col2X, y);

  y += 6;
  
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...cTextDark);
  doc.text(data.freelancerName, col1X, y);
  doc.text("Gross ICT", col2X, y);
  
  y += 5;
  
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  const addrLines = data.freelancerAddress.split('\n').filter(l => l.trim().length > 0);
  let addrY = y;
  for (const line of addrLines) {
    doc.text(line, col1X, addrY);
    addrY += 5;
  }
  
  let recY = y;
  doc.text("Neuhushof 3", col2X, recY); recY += 5;
  doc.text("6144 Zell LU", col2X, recY); recY += 5;
  doc.text("Schweiz", col2X, recY); recY += 5;
  
  y = Math.max(addrY, recY) + 10;

  // IBAN
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...cTextMuted);
  doc.text("Auszahlung auf IBAN:", col1X, y);
  doc.setFont("helvetica", "normal");
  doc.text(data.freelancerIban || "BAR / Manuell überwiesen", col1X, y + 5);
  
  y += 15;

  // 4. Meta Box
  const metaText = "Diese Abrechnung dient als Beleg für den Bezug von Leistungen im Projektgeschäft. Die Abrechnung der gesetzlichen Sozialabgaben (AHV/IV/EO/ALV) für diesen Betrag obliegt entsprechend dem geltenden Gesamtarbeits- oder Anstellungsverhältnis.";
  // Reduced width slightly to ensure text fully fits in the box
  const boxInnerWidth = pageWidth - marginX * 2 - 12;
  const metaLines = doc.splitTextToSize(metaText, boxInnerWidth);
  const metaH = metaLines.length * 5 + 10;

  doc.setFillColor(...cBoxBg);
  doc.setDrawColor(...cBorder);
  doc.roundedRect(marginX, y, pageWidth - marginX * 2, metaH, 2, 2, "FD");

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...cTextDark);
  
  for (let i = 0; i < metaLines.length; i++) {
    doc.text(metaLines[i], marginX + 6, y + 8 + (i * 5));
  }

  y += metaH + 20;

  // 5. Details Table
  doc.setDrawColor(...cBorder);
  doc.setLineWidth(0.5);
  doc.line(marginX, y + 8, pageWidth - marginX, y + 8);
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...cTextMuted);
  doc.text("BESCHREIBUNG DER LEISTUNG", marginX + 2, y + 5);
  doc.text("BETRAG (CHF)", pageWidth - marginX - 2, y + 5, { align: "right" });
  
  y += 15;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...cTextDark);
  
  const descLines = doc.splitTextToSize(data.projectDescription, 120);
  for (let l = 0; l < descLines.length; l++) {
    doc.text(descLines[l], marginX + 2, y + (l * 5));
  }
  
  doc.text(fmtCHF(data.amount), pageWidth - marginX - 2, y, { align: "right" });
  
  y += Math.max(descLines.length * 5, 5) + 10;

  // Totals Row
  doc.setFillColor(253, 251, 247); // #fdfbf7
  doc.rect(marginX, y, pageWidth - marginX * 2, 12, "F");
  doc.setDrawColor(...cGold);
  doc.setLineWidth(0.5);
  doc.line(marginX, y, pageWidth - marginX, y);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...cTextDark);
  doc.text("Total Auszahlung", marginX + 5, y + 8);
  doc.text(`${fmtCHF(data.amount)} CHF`, pageWidth - marginX - 5, y + 8, { align: "right" });

  y += 40;

  // 6. Signatures
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...cTextMuted);
  
  const sig1X = marginX;
  const sig2X = marginX + 85;

  doc.text(`Zell LU, ${fmtDate(data.date)}`, sig1X, y);
  doc.text("Ort, Datum", sig2X, y);

  y += 20;
  
  doc.setDrawColor(203, 213, 225); // #cbd5e1
  doc.setLineWidth(0.25);
  doc.line(sig1X, y, sig1X + 60, y);
  doc.line(sig2X, y, sig2X + 60, y);
  
  y += 5;
  doc.text("Unterschrift Stefan Gross", sig1X, y);
  doc.text("Inhaber Gross ICT", sig1X, y + 4);
  doc.text(`Unterschrift ${data.freelancerName} (Empfänger)`, sig2X, y);

  // 7. Footer
  const fh = 20;
  const fy = pageHeight - fh;
  
  doc.setFillColor(...cDarkBg);
  doc.rect(0, fy, pageWidth, fh, "F");

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(203, 213, 225);
  doc.text("Gross ICT · Neuhushof 3 · 6144 Zell LU · info@gross-ict.ch · www.gross-ict.ch", pageWidth / 2, fy + 10, { align: "center" });

  return doc;
}

export function generateQuittungBase64(data: QuittungData): string {
  const doc = generateQuittungJSPDF(data);
  const dataUri = doc.output("datauristring");
  return dataUri.split("base64,")[1];
}

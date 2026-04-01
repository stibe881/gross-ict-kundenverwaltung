import { jsPDF } from "https://esm.sh/jspdf@2.5.1";
import { LOGO_BASE64 } from "../contract-page/logo.ts";

export interface InvoiceItem {
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  discountPercentage?: number;
  vatRate: number;
  total: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  customerNumber?: string;
  invoiceDate: string;
  dueDate: string;
  serviceDate?: string;
  paymentMethod?: string;
  customerName: string;
  customerAddress: string;
  items: InvoiceItem[];
  subtotal: number;
  totalVat: number;
  total: number;
  notes?: string;
  paidAmount?: number;
  dunningLevel?: number;
}

function fmtCHF(amount: number): string {
  return amount.toLocaleString("de-CH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(dateString: string): string {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

export function generateInvoicePDF(data: InvoiceData): string {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  
  // Colors
  const cGold = [212, 164, 50] as [number, number, number]; // #D4A432
  const cDarkBg = [26, 26, 46] as [number, number, number]; // #1a1a2e
  const cTextDark = [26, 26, 46] as [number, number, number]; // #1a1a2e
  const cTextMuted = [100, 116, 139] as [number, number, number]; // #64748b
  const cTextLight = [148, 163, 184] as [number, number, number]; // #94a3b8
  const cBoxBg = [248, 250, 251] as [number, number, number]; // #f8fafb
  const cBorder = [226, 232, 240] as [number, number, number]; // #e2e8f0

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 25;
  let y = 0;

  // 1. Accent Bar Type
  doc.setFillColor(...cGold);
  doc.rect(0, 0, pageWidth, 5, "F");
  
  y = 25;

  let docType = "Rechnung";
  if (data.is_dunning_document || (data.dunningLevel !== undefined && data.dunningLevel !== null && data.dunningLevel > 0)) {
    if (data.dunningLevel === 0) docType = "Zahlungserinnerung";
    else if (data.dunningLevel === 1) docType = "1. Mahnung";
    else if (data.dunningLevel === 2) docType = "2. Mahnung";
    else if (data.dunningLevel === 3) docType = "Betreibungsandrohung";
  }

  if (LOGO_BASE64) {
    try {
      doc.addImage(LOGO_BASE64, "PNG", marginX, y, 40, 15);
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

  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...cGold);
  doc.text(docType.toUpperCase(), pageWidth - marginX, y + 12, { align: "right" });

  y += 20;

  // 3. Company Bar
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...cTextMuted);
  
  doc.setFont("helvetica", "bold");
  const compText1 = "Gross ICT  ·  Neuhushof 3  ·  6144 Zell LU  ·  Schweiz";
  doc.text(compText1, pageWidth - marginX, y, { align: "right" });
  
  doc.setFont("helvetica", "normal");
  const compText2 = "+41 41 562 34 16  ·  info@gross-ict.ch";
  doc.text(compText2, pageWidth - marginX, y + 5, { align: "right" });

  y += 10;
  doc.setDrawColor(...cBorder);
  doc.setLineWidth(0.5);
  doc.line(pageWidth - marginX - 100, y, pageWidth - marginX, y); // Short right-aligned line
  
  y += 15;

  // 4. Customer Address (Left) & Meta Box (Right)
  const metaBoxW = 75;
  const metaBoxX = pageWidth - marginX - metaBoxW;
  
  // -- Left: Customer
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...cTextLight);
  doc.text("EMPFÄNGER", marginX, y);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...cTextDark);
  
  const rawAddress = data.customerAddress || "";
  const addressLines = rawAddress.split(/\r?\n|<br\s*\/?>/i).map(l => l.trim()).filter(Boolean);
  let addrY = y + 5;
  for (const line of addressLines) {
    doc.text(line, marginX, addrY);
    addrY += 5;
  }

  // -- Right: Meta Box
  // Background & Border
  doc.setFillColor(...cBoxBg);
  doc.setDrawColor(...cBorder);
  doc.roundedRect(metaBoxX, y - 4, metaBoxW, 30, 2, 2, "FD");

  doc.setFontSize(9);
  let metaY = y + 2;
  const mLabelX = metaBoxX + 5;
  const mValueX = metaBoxX + metaBoxW - 5;
  const ls = 6;

  doc.setFont("helvetica", "normal"); doc.setTextColor(...cTextMuted);
  doc.text("Rechnungsnr.", mLabelX, metaY);
  doc.setFont("helvetica", "bold"); doc.setTextColor(...cTextDark);
  doc.text(data.invoiceNumber, mValueX, metaY, { align: "right" });
  metaY += ls;

  if (data.customerNumber) {
    doc.setFont("helvetica", "normal"); doc.setTextColor(...cTextMuted);
    doc.text("Kundennr.", mLabelX, metaY);
    doc.setFont("helvetica", "bold"); doc.setTextColor(...cTextDark);
    doc.text(data.customerNumber, mValueX, metaY, { align: "right" });
    metaY += ls;
  }

  doc.setFont("helvetica", "normal"); doc.setTextColor(...cTextMuted);
  doc.text("Datum", mLabelX, metaY);
  doc.setFont("helvetica", "bold"); doc.setTextColor(...cTextDark);
  doc.text(fmtDate(data.invoiceDate), mValueX, metaY, { align: "right" });
  metaY += ls;

  doc.setFont("helvetica", "normal"); doc.setTextColor(...cTextMuted);
  doc.text("Zahlungsziel", mLabelX, metaY);
  doc.setFont("helvetica", "bold"); doc.setTextColor(...cTextDark);
  doc.text(fmtDate(data.dueDate), mValueX, metaY, { align: "right" });
  metaY += ls;

  doc.setFont("helvetica", "normal"); doc.setTextColor(...cTextMuted);
  doc.text("Zahlungsform", mLabelX, metaY);
  doc.setFont("helvetica", "bold"); doc.setTextColor(...cTextDark);
  doc.text(data.paymentMethod || "Überweisung", mValueX, metaY, { align: "right" });

  y = Math.max(addrY, y + 35) + 8;

  // 5. Intro
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105); // #475569
  doc.text("Guten Tag", marginX, y);
  y += 10;
  doc.text("Wir bedanken uns für Ihren Auftrag und stellen folgende Positionen in Rechnung:", marginX, y);
  y += 10;

  // 6. Items Table Header
  doc.setFillColor(...cGold);
  doc.rect(marginX, y, pageWidth - marginX * 2, 8, "F");

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);

  const colPos = marginX + 2;
  const colDesc = marginX + 15;
  const colQty = marginX + 85;
  const colPrice = marginX + 115;
  const colTotal = pageWidth - marginX - 3;

  doc.text("POS.", colPos, y + 5);
  doc.text("BESCHREIBUNG", colDesc, y + 5);
  doc.text("MENGE", colQty, y + 5, { align: "right" });
  doc.text("EINZELPREIS", colPrice, y + 5, { align: "right" });
  doc.text("BETRAG (CHF)", colTotal, y + 5, { align: "right" });

  y += 8;

  // 7. Items Rows
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    const isOdd = i % 2 !== 0;

    // description wrapping
    let descLines = doc.splitTextToSize(item.description, 65);
    
    if (item.discountPercentage && item.discountPercentage > 0) {
        descLines.push(`Rabatt: ${item.discountPercentage}%`);
    }

    const rowHeight = Math.max(8, descLines.length * 5 + 4);

    if (isOdd) {
      doc.setFillColor(...cBoxBg);
      doc.rect(marginX, y, pageWidth - marginX * 2, rowHeight, "F");
    }

    doc.setTextColor(...cTextLight);
    doc.setFont("helvetica", "bold");
    doc.text((i + 1).toString(), colPos + 2, y + 6);

    doc.setTextColor(...cTextDark);
    doc.setFont("helvetica", "normal");

    for (let l = 0; l < descLines.length; l++) {
      if (l === descLines.length - 1 && item.discountPercentage && item.discountPercentage > 0) {
        doc.setTextColor(...cTextMuted); // Darker gray for discount
      } else {
        doc.setTextColor(...cTextDark);
      }
      doc.text(descLines[l], colDesc, y + 6 + (l * 5));
    }

    doc.setTextColor(...cTextDark);

    doc.text(`${item.quantity} ${item.unit || "Stk."}`, colQty, y + 6, { align: "right" });
    doc.text(fmtCHF(item.unitPrice), colPrice, y + 6, { align: "right" });
    doc.text(fmtCHF(item.total), colTotal, y + 6, { align: "right" });

    y += rowHeight;

    doc.setDrawColor(241, 245, 249); // #f1f5f9
    doc.setLineWidth(0.25);
    doc.line(marginX, y, pageWidth - marginX, y);
  }

  y += 5;

  // 8. Totals
  const totalBoxW = 80;
  const totalBoxX = pageWidth - marginX - totalBoxW;

  const remainingAmount = data.total - (data.paidAmount || 0);

  if (data.paidAmount && data.paidAmount > 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...cTextDark);
    doc.text("Totalbetrag", totalBoxX + 5, y + 5);
    doc.text(`${fmtCHF(data.total)} CHF`, totalBoxX + totalBoxW - 5, y + 5, { align: "right" });

    y += 8;
    doc.setTextColor(16, 185, 129); // #10b981 (success green)
    doc.text("Bereits bezahlt", totalBoxX + 5, y + 5);
    doc.text(`-${fmtCHF(data.paidAmount)} CHF`, totalBoxX + totalBoxW - 5, y + 5, { align: "right" });

    y += 10;
  }

  doc.setFillColor(...cGold);
  doc.roundedRect(totalBoxX, y, totalBoxW, 10, 2, 2, "F");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("Zu bezahlen", totalBoxX + 5, y + 7);
  doc.text(`${fmtCHF(remainingAmount > 0 ? remainingAmount : 0)} CHF`, totalBoxX + totalBoxW - 5, y + 7, { align: "right" });

  y += 20;

  // 9. Notes Section (if any)
  if (data.notes) {
    if (y > pageHeight - 60) {
      doc.addPage();
      y = 20;
    }
    const safeNotes = data.notes.replace(/<[^>]*>?/gm, '\n');
    const noteLines = doc.splitTextToSize(safeNotes, pageWidth - marginX * 2 - 10);
    const noteH = noteLines.length * 5 + 10;
    
    doc.setFillColor(...cBoxBg);
    doc.rect(marginX, y, pageWidth - marginX * 2, noteH, "F");
    doc.setFillColor(...cGold);
    doc.rect(marginX, y, 1.5, noteH, "F"); // Left border

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...cGold);
    doc.text("ANMERKUNGEN", marginX + 5, y + 6);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    for (let n = 0; n < noteLines.length; n++) {
      doc.text(noteLines[n], marginX + 5, y + 11 + (n * 5));
    }
    y += noteH + 10;
  }

  // 10. Footer (Fixed at bottom)
  const fh = 30; // approx height of footer
  const fy = pageHeight - fh;
  
  doc.setFillColor(...cDarkBg); // #1a1a2e
  doc.rect(0, fy, pageWidth, fh, "F");

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...cGold);
  
  const col1X = marginX;
  const col2X = marginX + 55;
  const col3X = marginX + 110;

  doc.text("ZAHLUNGSEMPFÄNGER", col1X, fy + 10);
  doc.text("BANKVERBINDUNG", col2X, fy + 10);
  doc.text("IBAN", col3X, fy + 10);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(255, 255, 255); // #fff

  doc.text("Gross ICT", col1X, fy + 15);
  doc.text("Luzerner Kantonalbank AG", col2X, fy + 15);
  
  doc.text("CH32 0077 8229 1386 9200 1", col3X, fy + 15);

  // Buffer and Base64 return
  const dataUri = doc.output("datauristring");
  return dataUri.split("base64,")[1];
}

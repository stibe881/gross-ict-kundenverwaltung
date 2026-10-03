// Schweizer QR-Rechnung (Zahlteil + Empfangsschein) für jsPDF-Dokumente.
// Umsetzung nach den Swiss Payment Standards (QR-Rechnung v2.x):
// - QR-Code 46x46mm, Fehlerkorrektur M, Schweizer Kreuz 7x7mm im Zentrum
// - Zahlteil rechts (148mm), Empfangsschein links (62mm), unterste 105mm der Seite
// - Normale IBAN → Referenztyp NON mit unstrukturierter Mitteilung
import qrcodegen from "https://esm.sh/qrcode-generator@1.4.4";

export interface SwissQROptions {
  iban: string;                 // z.B. "CH32 0077 8229 1386 9200 1"
  creditorName: string;         // Kontoinhaber
  creditorStreet: string;       // Strasse + Nr.
  creditorCity: string;         // PLZ + Ort
  amount: number;               // in CHF
  debtorName?: string;
  debtorStreet?: string;
  debtorCity?: string;
  message?: string;             // unstrukturierte Mitteilung, z.B. "Rechnung RE-2026-001"
}

function cleanIban(iban: string): string {
  return (iban || "").replace(/\s+/g, "").toUpperCase();
}

function fmtIban(iban: string): string {
  return cleanIban(iban).replace(/(.{4})/g, "$1 ").trim();
}

function fmtAmount(amount: number): string {
  return amount.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// SPC-Datenstruktur gemäss Implementation Guidelines
export function buildSwissQRPayload(o: SwissQROptions): string {
  const hasDebtor = !!(o.debtorName && o.debtorCity);
  const lines = [
    "SPC",                      // QRType
    "0200",                     // Version
    "1",                        // Coding (UTF-8)
    cleanIban(o.iban),          // IBAN
    // Zahlungsempfänger (kombinierte Adresse, Typ K)
    "K",
    (o.creditorName || "").substring(0, 70),
    (o.creditorStreet || "").substring(0, 70),
    (o.creditorCity || "").substring(0, 70),
    "", "",                     // PLZ/Ort separat (bei Typ K leer)
    "CH",
    // Endgültiger Zahlungsempfänger (nicht verwendet)
    "", "", "", "", "", "", "",
    // Betrag & Währung
    o.amount > 0 ? o.amount.toFixed(2) : "",
    "CHF",
    // Zahlungspflichtiger
    ...(hasDebtor
      ? ["K", (o.debtorName || "").substring(0, 70), (o.debtorStreet || "").substring(0, 70), (o.debtorCity || "").substring(0, 70), "", "", "CH"]
      : ["", "", "", "", "", "", ""]),
    // Referenz: normale IBAN → NON ohne Referenz
    "NON",
    "",
    // Unstrukturierte Mitteilung
    (o.message || "").substring(0, 140),
    "EPD",                      // Trailer
  ];
  return lines.join("\n");
}

// QR-Code als Modul-Matrix zeichnen (schwarze Rechtecke), inkl. Schweizer Kreuz
function drawQRCode(doc: any, payload: string, x: number, y: number, sizeMm: number) {
  const qr = qrcodegen(0, "M"); // Typ automatisch, Fehlerkorrektur M (Vorgabe)
  qr.addData(payload);
  qr.make();
  const count = qr.getModuleCount();
  const module = sizeMm / count;

  doc.setFillColor(0, 0, 0);
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) {
        doc.rect(x + c * module, y + r * module, module + 0.02, module + 0.02, "F");
      }
    }
  }

  // Schweizer Kreuz: schwarzes Quadrat 7x7mm mit weissem Kreuz, zentriert
  const cx = x + sizeMm / 2;
  const cy = y + sizeMm / 2;
  const cross = 7;
  doc.setFillColor(255, 255, 255);
  doc.rect(cx - cross / 2 - 0.4, cy - cross / 2 - 0.4, cross + 0.8, cross + 0.8, "F");
  doc.setFillColor(0, 0, 0);
  doc.rect(cx - cross / 2, cy - cross / 2, cross, cross, "F");
  doc.setFillColor(255, 255, 255);
  const barL = cross * 0.58;  // Kreuz-Proportionen
  const barW = cross * 0.19;
  doc.rect(cx - barW / 2, cy - barL / 2, barW, barL, "F");
  doc.rect(cx - barL / 2, cy - barW / 2 + 0.25, barL, barW, "F");
}

// Zahlteil + Empfangsschein auf einer NEUEN Seite (unterste 105mm) zeichnen
export function drawSwissQRBill(doc: any, o: SwissQROptions) {
  doc.addPage();
  const pageW = 210;
  const pageH = 297;
  const top = pageH - 105; // 192

  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);

  // Trennlinien mit Hinweis
  doc.setLineWidth(0.15);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(0, top, pageW, top);
  doc.line(62, top, 62, pageH);
  doc.setLineDashPattern([], 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Vor der Einzahlung abzutrennen", pageW / 2, top - 1.5, { align: "center" });

  const debtor = !!(o.debtorName && o.debtorCity);

  // ── Empfangsschein (links, 62mm) ──
  const rx = 5;
  let ry = top + 7;
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("Empfangsschein", rx, ry);
  ry += 7;
  doc.setFontSize(6); doc.text("Konto / Zahlbar an", rx, ry); ry += 3.2;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  doc.text(fmtIban(o.iban), rx, ry); ry += 3.5;
  doc.text(o.creditorName, rx, ry); ry += 3.5;
  doc.text(o.creditorStreet, rx, ry); ry += 3.5;
  doc.text(o.creditorCity, rx, ry); ry += 6;
  doc.setFont("helvetica", "bold"); doc.setFontSize(6);
  doc.text(debtor ? "Zahlbar durch" : "Zahlbar durch (Name/Adresse)", rx, ry); ry += 3.2;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  if (debtor) {
    doc.text(o.debtorName!, rx, ry); ry += 3.5;
    if (o.debtorStreet) { doc.text(o.debtorStreet, rx, ry); ry += 3.5; }
    doc.text(o.debtorCity!, rx, ry); ry += 3.5;
  } else {
    // Leeres Eingabefeld (Eckmarken)
    doc.rect(rx, ry, 52, 20);
    ry += 23;
  }
  // Währung/Betrag
  let ryAmt = top + 68;
  doc.setFont("helvetica", "bold"); doc.setFontSize(6);
  doc.text("Währung", rx, ryAmt);
  doc.text("Betrag", rx + 13, ryAmt);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  doc.text("CHF", rx, ryAmt + 4);
  doc.text(fmtAmount(o.amount), rx + 13, ryAmt + 4);
  doc.setFont("helvetica", "bold"); doc.setFontSize(6);
  doc.text("Annahmestelle", 57, top + 82, { align: "right" });

  // ── Zahlteil (rechts, 148mm) ──
  const zx = 67;
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("Zahlteil", zx, top + 7);

  // QR-Code 46x46mm
  drawQRCode(doc, buildSwissQRPayload(o), zx, top + 12, 46);

  // Währung/Betrag unter dem QR
  doc.setFont("helvetica", "bold"); doc.setFontSize(8);
  doc.text("Währung", zx, top + 68);
  doc.text("Betrag", zx + 20, top + 68);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text("CHF", zx, top + 73);
  doc.text(fmtAmount(o.amount), zx + 20, top + 73);

  // Rechte Spalte: Angaben
  const ix = 118;
  let iy = top + 7;
  doc.setFont("helvetica", "bold"); doc.setFontSize(8);
  doc.text("Konto / Zahlbar an", ix, iy); iy += 4;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(fmtIban(o.iban), ix, iy); iy += 4.5;
  doc.text(o.creditorName, ix, iy); iy += 4.5;
  doc.text(o.creditorStreet, ix, iy); iy += 4.5;
  doc.text(o.creditorCity, ix, iy); iy += 7;
  if (o.message) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(8);
    doc.text("Zusätzliche Informationen", ix, iy); iy += 4;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    const msgLines = doc.splitTextToSize(o.message, 85);
    for (const line of msgLines.slice(0, 3)) { doc.text(line, ix, iy); iy += 4.5; }
    iy += 2.5;
  }
  doc.setFont("helvetica", "bold"); doc.setFontSize(8);
  doc.text(debtor ? "Zahlbar durch" : "Zahlbar durch (Name/Adresse)", ix, iy); iy += 4;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  if (debtor) {
    doc.text(o.debtorName!, ix, iy); iy += 4.5;
    if (o.debtorStreet) { doc.text(o.debtorStreet, ix, iy); iy += 4.5; }
    doc.text(o.debtorCity!, ix, iy);
  } else {
    doc.rect(ix, iy, 65, 25);
  }
}

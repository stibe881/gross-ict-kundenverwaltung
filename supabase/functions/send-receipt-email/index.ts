import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateInvoicePDF, InvoiceData } from "../send-invoice-email/pdf-generator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function fmtCHF(amount: number): string {
  return amount.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(date: Date): string {
  return `${date.getDate().toString().padStart(2, "0")}.${(date.getMonth() + 1).toString().padStart(2, "0")}.${date.getFullYear()}`;
}

// Gleicher E-Mail-Stil wie die Rechnungs-Mail (send-invoice-email)
function buildReceiptEmailHTML(receiptNumber: string, amount: number, description: string, paidDate: Date): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1a1a2e; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">Gross ICT</h1>
        <p style="margin: 4px 0 0; opacity: 0.8; font-size: 14px;">Quittung ${receiptNumber}</p>
      </div>
      <div style="padding: 24px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 8px 8px;">
        <p>Sehr geehrte Damen und Herren,</p>
        <p>vielen Dank für Ihre Zahlung über <strong>CHF ${fmtCHF(amount)}</strong>. Anbei erhalten Sie Ihre Quittung.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Zahlungsdatum:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${fmtDate(paidDate)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Leistung:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${description}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Betrag:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: bold; color: #1a1a2e;">CHF ${fmtCHF(amount)}</td>
          </tr>
        </table>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0; color: #166534;"><strong>✓ Bezahlt</strong> — kontaktlos via Tap to Pay auf dem iPhone</p>
        </div>
        <p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>
        <p>Freundliche Grüsse<br/><strong>Gross ICT</strong></p>
      </div>
    </div>
  `;
}

// Nur Admin/Finanzen dürfen Quittungen versenden (gleiche Regel wie der Kassieren-Screen)
async function requireAuthorized(req: Request, supabaseAdmin: any) {
  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  if (!jwt) throw new Error("Nicht eingeloggt");
  const { data: userData, error } = await supabaseAdmin.auth.getUser(jwt);
  if (error || !userData?.user) throw new Error("Nicht eingeloggt");
  const { data: profile } = await supabaseAdmin
    .from("users").select("roles").eq("id", userData.user.id).single();
  const roles: string[] = profile?.roles || [];
  if (!roles.includes("admin") && !roles.includes("finanzen")) {
    throw new Error("Keine Berechtigung zum Versenden von Quittungen");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, amount, description, invoice_id } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    await requireAuthorized(req, supabase);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Gültige E-Mail-Adresse fehlt");
    }
    const chf = Number(amount);
    if (!chf || chf <= 0) throw new Error("Ungültiger Betrag");

    const now = new Date();
    const desc = String(description || "Tap to Pay Zahlung").slice(0, 200);

    let pdfData: InvoiceData;
    let receiptNumber: string;

    if (invoice_id) {
      // Quittung zu einer bestehenden Rechnung: Positionen und Kunde übernehmen
      const { data: invoice } = await supabase
        .from("invoices")
        .select("*, customer:customers(*), items:invoice_items(*)")
        .eq("id", invoice_id)
        .single();
      if (!invoice) throw new Error("Rechnung nicht gefunden");

      const customerName = invoice.customer?.company_name ||
        `${invoice.customer?.first_name || ""} ${invoice.customer?.last_name || ""}`.trim() || "Unbekannt";
      const addressParts = [
        customerName,
        invoice.customer?.street || invoice.customer?.address,
        `${invoice.customer?.zip || invoice.customer?.postal_code || ""} ${invoice.customer?.city || ""}`.trim(),
      ].filter(Boolean);

      receiptNumber = invoice.invoice_number;
      pdfData = {
        docType: "Quittung",
        invoiceNumber: invoice.invoice_number,
        customerNumber: invoice.customer?.customer_number,
        invoiceDate: now.toISOString(),
        dueDate: now.toISOString(),
        paymentMethod: "Tap to Pay (kontaktlos)",
        customerName,
        customerAddress: addressParts.join("\n"),
        items: (invoice.items || []).map((item: any) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          discountPercentage: item.discount_percentage,
          vatRate: item.vat_rate,
          total: item.total,
        })),
        subtotal: invoice.subtotal,
        totalVat: invoice.vat_amount,
        total: invoice.total,
        paidAmount: invoice.total,
        notes: `Betrag dankend erhalten — bezahlt am ${fmtDate(now)} via Tap to Pay auf dem iPhone.`,
      };
    } else {
      // Freie Zahlung ohne Rechnung: eine Position, MwSt. 8.1% im Betrag enthalten
      const vatRate = 8.1;
      const net = chf / (1 + vatRate / 100);
      const vat = chf - net;
      receiptNumber = `TTP-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}-${now.getHours().toString().padStart(2, "0")}${now.getMinutes().toString().padStart(2, "0")}`;
      pdfData = {
        docType: "Quittung",
        invoiceNumber: receiptNumber,
        invoiceDate: now.toISOString(),
        dueDate: now.toISOString(),
        paymentMethod: "Tap to Pay (kontaktlos)",
        customerName: "Direktzahlung",
        customerAddress: email,
        items: [{
          description: desc,
          quantity: 1,
          unitPrice: net,
          vatRate,
          total: net,
        }],
        subtotal: net,
        totalVat: vat,
        total: chf,
        paidAmount: chf,
        notes: `Betrag dankend erhalten — bezahlt am ${fmtDate(now)} via Tap to Pay auf dem iPhone.`,
      };
    }

    const pdfBase64 = generateInvoicePDF(pdfData);

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY nicht konfiguriert");

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Gross ICT <info@gross-ict.ch>",
        to: [email],
        subject: `Quittung ${receiptNumber} - Gross ICT`,
        html: buildReceiptEmailHTML(receiptNumber, chf, desc, now),
        attachments: [{ filename: `Quittung_${receiptNumber}.pdf`, content: pdfBase64 }],
      }),
    });

    if (!emailRes.ok) {
      const errBody = await emailRes.text();
      console.error("[send-receipt-email] Resend error:", errBody);
      throw new Error("E-Mail konnte nicht gesendet werden");
    }

    if (invoice_id) {
      await supabase.from("invoice_activities").insert({
        invoice_id,
        type: "sent",
        description: `Quittung per E-Mail an ${email} gesendet (Tap to Pay)`,
        user_name: "System",
      });
    }

    return new Response(JSON.stringify({ success: true, receiptNumber }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[send-receipt-email] Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Interner Fehler" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

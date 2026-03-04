import nodemailer from "nodemailer";

// SMTP Transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

const SMTP_FROM = process.env.SMTP_FROM || "rechnung@gross-ict.ch";

interface SendInvoiceEmailOptions {
    to: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    total: string;
    pdfBuffer: Buffer;
    trackingUrl?: string;
}

export async function sendInvoiceEmail(options: SendInvoiceEmailOptions) {
    const { to, invoiceNumber, invoiceDate, dueDate, total, pdfBuffer, trackingUrl } = options;

    const trackingPixel = trackingUrl
        ? `<img src="${trackingUrl}" width="1" height="1" style="display:none" alt="" />`
        : "";

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1a1a2e; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">Gross ICT</h1>
        <p style="margin: 4px 0 0; opacity: 0.8; font-size: 14px;">Rechnung ${invoiceNumber}</p>
      </div>
      <div style="padding: 24px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 8px 8px;">
        <p>Sehr geehrte Damen und Herren,</p>
        <p>anbei erhalten Sie die Rechnung <strong>${invoiceNumber}</strong> über <strong>CHF ${total}</strong>.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Rechnungsdatum:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${invoiceDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Fälligkeitsdatum:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${dueDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Betrag:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: bold; color: #1a1a2e;">CHF ${total}</td>
          </tr>
        </table>
        <p>Bitte überweisen Sie den Betrag bis zum <strong>${dueDate}</strong> auf folgendes Konto:</p>
        <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0 0 4px;"><strong>Kontoinhaber:</strong> Gross ICT</p>
          <p style="margin: 0 0 4px;"><strong>IBAN:</strong> CH93 0900 0000 1553 0590 0</p>
          <p style="margin: 0;"><strong>BIC:</strong> POFICHBEXXX</p>
        </div>
        <p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>
        <p>Freundliche Grüsse<br/><strong>Gross ICT</strong></p>
      </div>
      ${trackingPixel}
    </div>
  `;

    await transporter.sendMail({
        from: `"Gross ICT" <${SMTP_FROM}>`,
        to,
        subject: `Rechnung ${invoiceNumber} - Gross ICT`,
        html,
        attachments: [
            {
                filename: `Rechnung_${invoiceNumber}.pdf`,
                content: pdfBuffer,
                contentType: "application/pdf",
            },
        ],
    });
}

interface SendReminderEmailOptions {
    to: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    remainingAmount: string;
    pdfBuffer: Buffer;
    trackingUrl?: string;
}

export async function sendReminderEmail(options: SendReminderEmailOptions) {
    const { to, invoiceNumber, invoiceDate, dueDate, remainingAmount, pdfBuffer, trackingUrl } = options;

    const trackingPixel = trackingUrl
        ? `<img src="${trackingUrl}" width="1" height="1" style="display:none" alt="" />`
        : "";

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #dc2626; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">Gross ICT</h1>
        <p style="margin: 4px 0 0; opacity: 0.9; font-size: 14px;">Zahlungserinnerung – Rechnung ${invoiceNumber}</p>
      </div>
      <div style="padding: 24px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 8px 8px;">
        <p>Sehr geehrte Damen und Herren,</p>
        <p>wir möchten Sie freundlich daran erinnern, dass die Rechnung <strong>${invoiceNumber}</strong>
           über <strong>CHF ${remainingAmount}</strong> seit dem <strong>${dueDate}</strong> fällig ist.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Rechnungsnummer:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${invoiceNumber}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Rechnungsdatum:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${invoiceDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Fälligkeitsdatum:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${dueDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Offener Betrag:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: bold; color: #dc2626;">CHF ${remainingAmount}</td>
          </tr>
        </table>
        <p>Bitte überweisen Sie den ausstehenden Betrag auf folgendes Konto:</p>
        <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0 0 4px;"><strong>Kontoinhaber:</strong> Gross ICT</p>
          <p style="margin: 0 0 4px;"><strong>IBAN:</strong> CH93 0900 0000 1553 0590 0</p>
          <p style="margin: 0;"><strong>BIC:</strong> POFICHBEXXX</p>
        </div>
        <p>Sollten Sie die Zahlung bereits veranlasst haben, betrachten Sie diese Erinnerung bitte als gegenstandslos.</p>
        <p>Freundliche Grüsse<br/><strong>Gross ICT</strong></p>
      </div>
      ${trackingPixel}
    </div>
  `;

    await transporter.sendMail({
        from: `"Gross ICT" <${SMTP_FROM}>`,
        to,
        subject: `Zahlungserinnerung: Rechnung ${invoiceNumber} - Gross ICT`,
        html,
        attachments: [
            {
                filename: `Rechnung_${invoiceNumber}.pdf`,
                content: pdfBuffer,
                contentType: "application/pdf",
            },
        ],
    });
}

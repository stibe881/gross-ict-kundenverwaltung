import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const EMAIL_FROM = "Gross ICT <info@gross-ict.ch>";

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
          <p style="margin: 0 0 4px;"><strong>Zahlungsempfänger:</strong> Gross ICT</p>
          <p style="margin: 0 0 4px;"><strong>Bank:</strong> Luzerner Kantonalbank AG</p>
          <p style="margin: 0;"><strong>IBAN:</strong> CH32 0077 8229 1386 9200 1</p>
        </div>
        <p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>
        <p>Freundliche Grüsse<br/><strong>Gross ICT</strong></p>
      </div>
      ${trackingPixel}
    </div>
  `;

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: [to],
    subject: `Rechnung ${invoiceNumber} - Gross ICT`,
    html,
    attachments: [
      {
        filename: `Rechnung_${invoiceNumber}.pdf`,
        content: pdfBuffer.toString("base64"),
      },
    ],
  });

  if (error) throw new Error(`E-Mail konnte nicht gesendet werden: ${error.message}`);
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
          <p style="margin: 0 0 4px;"><strong>Zahlungsempfänger:</strong> Gross ICT</p>
          <p style="margin: 0 0 4px;"><strong>Bank:</strong> Luzerner Kantonalbank AG</p>
          <p style="margin: 0;"><strong>IBAN:</strong> CH32 0077 8229 1386 9200 1</p>
        </div>
        <p>Sollten Sie die Zahlung bereits veranlasst haben, betrachten Sie diese Erinnerung bitte als gegenstandslos.</p>
        <p>Freundliche Grüsse<br/><strong>Gross ICT</strong></p>
      </div>
      ${trackingPixel}
    </div>
  `;

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: [to],
    subject: `Zahlungserinnerung: Rechnung ${invoiceNumber} - Gross ICT`,
    html,
    attachments: [
      {
        filename: `Rechnung_${invoiceNumber}.pdf`,
        content: pdfBuffer.toString("base64"),
      },
    ],
  });

  if (error) throw new Error(`E-Mail konnte nicht gesendet werden: ${error.message}`);
}

interface SendQuoteEmailOptions {
  to: string;
  quoteNumber: string;
  quoteDate: string;
  validUntil: string;
  total: string;
  pdfBuffer: Buffer;
  trackingUrl?: string;
}

export async function sendQuoteEmail(options: SendQuoteEmailOptions) {
  const { to, quoteNumber, quoteDate, validUntil, total, pdfBuffer, trackingUrl } = options;

  const trackingPixel = trackingUrl
    ? `<img src="${trackingUrl}" width="1" height="1" style="display:none" alt="" />`
    : "";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1a1a2e; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">Gross ICT</h1>
        <p style="margin: 4px 0 0; opacity: 0.8; font-size: 14px;">Angebot ${quoteNumber}</p>
      </div>
      <div style="padding: 24px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 8px 8px;">
        <p>Sehr geehrte Damen und Herren,</p>
        <p>vielen Dank für Ihr Interesse. Anbei erhalten Sie unser Angebot <strong>${quoteNumber}</strong> über <strong>CHF ${total}</strong>.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Angebotsdatum:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${quoteDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Gültig bis:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${validUntil}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Gesamtbetrag:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: bold; color: #1a1a2e;">CHF ${total}</td>
          </tr>
        </table>
        <p>Das Angebot ist gültig bis zum <strong>${validUntil}</strong>. Bei Fragen oder wenn Sie das Angebot annehmen möchten, kontaktieren Sie uns bitte.</p>
        <p>Wir freuen uns auf Ihre Rückmeldung.</p>
        <p>Freundliche Grüsse<br/><strong>Gross ICT</strong></p>
      </div>
      ${trackingPixel}
    </div>
  `;

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: [to],
    subject: `Angebot ${quoteNumber} - Gross ICT`,
    html,
    attachments: [
      {
        filename: `Angebot_${quoteNumber}.pdf`,
        content: pdfBuffer.toString("base64"),
      },
    ],
  });

  if (error) throw new Error(`E-Mail konnte nicht gesendet werden: ${error.message}`);
}

interface SendNewsletterEmailOptions {
  to: string;
  subject: string;
  htmlContent: string;
}

export async function sendNewsletterEmail(options: SendNewsletterEmailOptions) {
  const { to, subject, htmlContent } = options;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1a1a2e; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">Gross ICT</h1>
      </div>
      <div style="padding: 24px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 8px 8px;">
        ${htmlContent}
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="font-size: 12px; color: #999;">
          Gross ICT · Stefan Gross<br/>
          Diese E-Mail wurde von Gross ICT versendet.
        </p>
      </div>
    </div>
  `;

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: [to],
    subject,
    html,
  });

  if (error) throw new Error(`Newsletter konnte nicht gesendet werden: ${error.message}`);
}

interface SendContractEmailOptions {
  to: string;
  contractTitle: string;
  startDate: string;
  endDate: string;
  annualAmount: string;
  signUrl: string;
}

export async function sendContractEmail(options: SendContractEmailOptions) {
  const { to, contractTitle, startDate, endDate, annualAmount, signUrl } = options;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1a1a2e; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">Gross ICT</h1>
        <p style="margin: 4px 0 0; opacity: 0.8; font-size: 14px;">Vertrag: ${contractTitle}</p>
      </div>
      <div style="padding: 24px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 8px 8px;">
        <p>Sehr geehrte Damen und Herren,</p>
        <p>anbei finden Sie Ihren Vertrag <strong>${contractTitle}</strong> zur Ansicht und Unterzeichnung.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Vertragsbeginn:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${startDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Vertragsende:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${endDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Jahresbetrag:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: bold; color: #1a1a2e;">CHF ${annualAmount}</td>
          </tr>
        </table>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${signUrl}" style="display: inline-block; background: #d4a432; color: #1a1a2e; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
            Vertrag ansehen & unterzeichnen
          </a>
        </div>
        <p style="font-size: 13px; color: #666;">Klicken Sie auf den Button oben, um den Vertrag online einzusehen und digital zu unterzeichnen.</p>
        <p>Freundliche Grüsse<br/><strong>Gross ICT</strong></p>
      </div>
    </div>
  `;

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: [to],
    subject: `Vertrag: ${contractTitle} - Gross ICT`,
    html,
  });

  if (error) throw new Error(`E-Mail konnte nicht gesendet werden: ${error.message}`);
}

interface SendLeadReminderEmailOptions {
  to: string;
  leadName: string;
  note: string;
  leadUrl: string;
}

export async function sendLeadReminderEmail(options: SendLeadReminderEmailOptions) {
  const { to, leadName, note, leadUrl } = options;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1a1a2e; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">Gross ICT</h1>
        <p style="margin: 4px 0 0; opacity: 0.8; font-size: 14px;">Erinnerung: Akquise ${leadName}</p>
      </div>
      <div style="padding: 24px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 8px 8px;">
        <p>Hallo,</p>
        <p>Dies ist deine festgelegte Erinnerung für die Akquise <strong>${leadName}</strong>.</p>
        <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #eee;">
          <p style="margin: 0;"><strong>Notiz:</strong><br/>${note.replace(/\n/g, '<br/>')}</p>
        </div>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${leadUrl}" style="display: inline-block; background: #d4a432; color: #1a1a2e; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
            Akquise ansehen
          </a>
        </div>
        <p>Freundliche Grüsse<br/><strong>Dein Gross ICT System</strong></p>
      </div>
    </div>
  `;

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: [to],
    subject: `Erinnerung Akquise: ${leadName} - Gross ICT`,
    html,
  });

  if (error) throw new Error(`E-Mail konnte nicht gesendet werden: ${error.message}`);
}


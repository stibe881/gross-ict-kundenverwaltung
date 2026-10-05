// Termineinladung per E-Mail mit ICS-Anhang (Outlook-kompatible
// Meeting-Anfrage) an einen Mitarbeitenden senden.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function icsDate(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function icsEscape(s: string) {
  return String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { title, description, location, start, durationMinutes, attendeeEmail, attendeeName } = await req.json();
    if (!title || !start || !attendeeEmail) {
      return json({ error: "title, start und attendeeEmail sind erforderlich." }, 400);
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) return json({ error: "RESEND_API_KEY ist nicht konfiguriert." }, 500);

    const startDate = new Date(start);
    if (isNaN(startDate.getTime())) return json({ error: "Ungültiges Startdatum." }, 400);
    const endDate = new Date(startDate.getTime() + (Number(durationMinutes) || 60) * 60000);
    const uid = `${crypto.randomUUID()}@gross-ict.ch`;

    const ics = [
      "BEGIN:VCALENDAR",
      "PRODID:-//Gross ICT//CRM//DE",
      "VERSION:2.0",
      "METHOD:REQUEST",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${icsDate(new Date())}`,
      `DTSTART:${icsDate(startDate)}`,
      `DTEND:${icsDate(endDate)}`,
      `SUMMARY:${icsEscape(title)}`,
      description ? `DESCRIPTION:${icsEscape(description)}` : "",
      location ? `LOCATION:${icsEscape(location)}` : "",
      "ORGANIZER;CN=Gross ICT:mailto:info@gross-ict.ch",
      `ATTENDEE;CN=${icsEscape(attendeeName || attendeeEmail)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${attendeeEmail}`,
      "STATUS:CONFIRMED",
      "BEGIN:VALARM",
      "TRIGGER:-PT15M",
      "ACTION:DISPLAY",
      `DESCRIPTION:${icsEscape(title)}`,
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ].filter(Boolean).join("\r\n");

    const icsBase64 = btoa(String.fromCharCode(...new TextEncoder().encode(ics)));
    const when = startDate.toLocaleString("de-CH", {
      timeZone: "Europe/Zurich",
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Gross ICT <info@gross-ict.ch>",
        to: [attendeeEmail],
        subject: `Termineinladung: ${title} — ${when}`,
        html: `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:600px;margin:0 auto;color:#1f2430;">
  <div style="background:#1C1D27;padding:18px 24px;border-radius:12px 12px 0 0;">
    <span style="color:#C19A6B;font-size:17px;font-weight:700;">Gross ICT</span>
  </div>
  <div style="border:1px solid #e3e3e8;border-top:none;border-radius:0 0 12px 12px;padding:24px;font-size:14.5px;line-height:1.65;">
    <p><strong>${title}</strong></p>
    <p>📅 ${when} Uhr · Dauer ca. ${Number(durationMinutes) || 60} Minuten${location ? `<br>📍 ${location}` : ""}</p>
    ${description ? `<p>${String(description).replace(/\n/g, "<br>")}</p>` : ""}
    <p style="color:#6b7280;font-size:13px;">Der Termin ist als Kalendereinladung angehängt — in Outlook einfach annehmen, dann steht er im Kalender.</p>
  </div>
</div>`,
        attachments: [
          {
            filename: "termin.ics",
            content: icsBase64,
            content_type: "text/calendar; method=REQUEST",
          },
        ],
      }),
    });

    if (!res.ok) {
      console.error("[send-calendar-invite] Resend-Fehler:", await res.text());
      return json({ error: "Einladung konnte nicht gesendet werden." }, 500);
    }
    return json({ ok: true });
  } catch (e) {
    console.error("[send-calendar-invite]", e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});

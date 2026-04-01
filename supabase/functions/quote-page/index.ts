import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateQuotePDFHTML } from "./pdfTemplate.ts";

function fmtCHF(amount: number): string {
  if (amount == null) return "0.00";
  return amount.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(dateString: string): string {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

function fmtDateLong(dateString: string): string {
  const months = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  const d = new Date(dateString);
  return `${d.getDate().toString().padStart(2, "0")}. ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function escHtml(str: string): string {
  return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderPage(quote: any, supabaseUrl: string, project?: any, anonKey?: string): string {
  const customer = quote.customer || {};
  const customerName = customer.company_name ||
    `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "Kunde";
  const items = quote.items || [];
  const acceptUrl = `${supabaseUrl}/functions/v1/accept-quote?id=${quote.id}`;
  const milestones = project?.milestones || [];

  const optionalItems = items.filter((i: any) => !!i.optional);
  const nonOptionalItems = items.filter((i: any) => !i.optional);
  const nonOptionalTotal = nonOptionalItems.reduce((s: number, i: any) => s + (i.total || 0), 0);
  const optionalTotal = optionalItems.reduce((s: number, i: any) => s + (i.total || 0), 0);
  const hasOptional = optionalTotal > 0;
  const grandTotal = quote.total || nonOptionalTotal + optionalTotal;

  const itemsHTML = items.map((item: any, idx: number) => {
    const isOpt = !!item.optional;
    const descParts = (item.description || "").split("\n");
    const mainName = escHtml(descParts[0]);
    const subLines = descParts.slice(1).filter(Boolean).map((l: string) =>
      `<span style="font-size:12px;color:var(--text-muted);">${escHtml(l)}</span>`
    ).join("<br>");
    const prefix = isOpt ? '<span style="color:var(--primary);font-weight:600;font-size:11px;">OPTIONAL</span> – ' : "";
    const bg = idx % 2 === 1 ? 'background:rgba(255,255,255,0.015);' : '';
    return `<tr style="${bg}">
      <td style="padding:16px 24px;border-bottom:1px solid var(--border);font-size:14px;vertical-align:top;">
        <div style="font-weight:600;color:var(--text-heading);">${prefix}${mainName}</div>
        ${subLines ? `<div style="margin-top:3px;">${subLines}</div>` : ""}
      </td>
      <td style="padding:16px 24px;border-bottom:1px solid var(--border);font-size:14px;vertical-align:top;">${item.quantity} ${item.unit || 'Stk.'}</td>
      <td style="padding:16px 24px;border-bottom:1px solid var(--border);font-size:14px;text-align:right;vertical-align:top;font-variant-numeric:tabular-nums;">${fmtCHF(item.unit_price)}</td>
      <td style="padding:16px 24px;border-bottom:1px solid var(--border);font-size:14px;text-align:right;vertical-align:top;font-variant-numeric:tabular-nums;">${fmtCHF(item.total)}</td>
    </tr>`;
  }).join("");

  const isAccepted = quote.status === "accepted";
  const isExpired = quote.status === "expired" || quote.status === "rejected";

  let statusBanner = "";
  if (isAccepted) {
    statusBanner = `<div style="background:#22c55e;color:#fff;text-align:center;padding:14px;font-weight:700;font-size:15px;">
      ✓ Dieses Angebot wurde angenommen
    </div>`;
  } else if (isExpired) {
    statusBanner = `<div style="background:#ef4444;color:#fff;text-align:center;padding:14px;font-weight:700;font-size:15px;">
      Dieses Angebot ist nicht mehr gültig
    </div>`;
  }

  return `<!DOCTYPE html>
<html lang="de-CH">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Angebot ${escHtml(quote.quote_number)} – Gross ICT</title>
  <meta name="description" content="Ihr persönliches Angebot von Gross ICT">
  <meta name="robots" content="noindex, nofollow">
  <link rel="icon" type="image/png" href="data:image/png;base64,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">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #D4A432; --primary-light: #E8B84A; --primary-dark: #B8901E;
      --primary-glow: rgba(212,164,50,0.15); --primary-glow-strong: rgba(212,164,50,0.3);
      --secondary: #1a1a2e; --secondary-light: #252542;
      --bg: #0f0f1a; --bg-card: #16162b;
      --text: #e8e8f0; --text-muted: #8b8ba3; --text-heading: #ffffff;
      --border: rgba(255,255,255,0.06); --border-hover: rgba(212,164,50,0.3);
      --radius: 16px;
    }
    *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
    html { scroll-behavior:smooth; overflow-x:hidden; }
    body {
      font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;
      background:var(--bg); color:var(--text); line-height:1.6;
      -webkit-font-smoothing:antialiased; overflow-x:hidden;
    }
    .container { max-width:1140px; margin:0 auto; padding:0 24px; }
    @keyframes fadeInUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
    @keyframes fadeInLeft { from{opacity:0;transform:translateX(-30px)} to{opacity:1;transform:translateX(0)} }
    @keyframes fadeInRight { from{opacity:0;transform:translateX(30px)} to{opacity:1;transform:translateX(0)} }
    @keyframes fadeInScale { from{opacity:0;transform:scale(0.9)} to{opacity:1;transform:scale(1)} }
    @keyframes pulse-glow { 0%,100%{box-shadow:0 0 20px var(--primary-glow)} 50%{box-shadow:0 0 40px var(--primary-glow-strong)} }
    @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
    @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
    @keyframes particle-drift { 0%{transform:translate(0,0) scale(1);opacity:0} 10%{opacity:1} 90%{opacity:1} 100%{transform:translate(var(--dx),var(--dy)) scale(0);opacity:0} }
    @keyframes slide-in-row { from{opacity:0;transform:translateX(-20px)} to{opacity:1;transform:translateX(0)} }
    @keyframes count-up { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    @keyframes border-glow { 0%,100%{border-color:var(--border)} 50%{border-color:var(--border-hover)} }
    @keyframes spin { to { transform: rotate(360deg); } }
    .animate-in { opacity:0; transform:translateY(30px); transition:opacity 0.8s cubic-bezier(0.16,1,0.3,1),transform 0.8s cubic-bezier(0.16,1,0.3,1); }
    .animate-in.visible { opacity:1; transform:translateY(0); }
    .animate-in[data-delay="1"] { transition-delay:0.1s; }
    .animate-in[data-delay="2"] { transition-delay:0.2s; }
    .animate-in[data-delay="3"] { transition-delay:0.3s; }
    .animate-in[data-delay="4"] { transition-delay:0.4s; }
    .animate-in[data-delay="5"] { transition-delay:0.5s; }

    /* Particles */
    .particles { position:absolute; inset:0; overflow:hidden; pointer-events:none; z-index:0; }
    .particle { position:absolute; width:4px; height:4px; background:var(--primary); border-radius:50%; opacity:0; animation:particle-drift linear infinite; }

    /* Live Update Toast */
    .live-toast { position:fixed; top:80px; right:24px; z-index:200; background:var(--bg-card); border:1px solid var(--primary); border-radius:12px; padding:16px 24px; display:flex; align-items:center; gap:12px; box-shadow:0 8px 32px rgba(0,0,0,0.4); transform:translateX(120%); transition:transform 0.5s cubic-bezier(0.16,1,0.3,1); max-width:360px; }
    .live-toast.show { transform:translateX(0); }
    .live-dot { width:8px; height:8px; background:#22c55e; border-radius:50%; animation:pulse-glow 2s infinite; flex-shrink:0; }
    .live-toast-text { font-size:13px; color:var(--text); line-height:1.4; }
    .live-toast-text strong { color:var(--primary); }

    /* Card shine effect */
    .card-shine { position:relative; overflow:hidden; }
    .card-shine::after { content:''; position:absolute; top:-50%; left:-50%; width:200%; height:200%; background:linear-gradient(to right,transparent 0%,rgba(255,255,255,0.03) 50%,transparent 100%); transform:rotate(30deg); transition:all 0.6s; opacity:0; pointer-events:none; }
    .card-shine:hover::after { opacity:1; transform:rotate(30deg) translateX(30%); }

    /* Header */
    .site-header {
      position:sticky; top:0; z-index:100;
      background:rgba(15,15,26,0.85); backdrop-filter:blur(20px);
      border-bottom:1px solid var(--border); padding:16px 0;
    }
    .header-inner { display:flex; align-items:center; justify-content:space-between; gap:16px; }
    .logo-area { display:flex; align-items:center; }
    .logo-img { height:40px; width:auto; display:block; }
    .header-meta { display:flex; gap:24px; align-items:center; font-size:13px; color:var(--text-muted); }
    .header-meta-item { display:flex; flex-direction:column; align-items:flex-end; }
    .header-meta-label { font-size:10px; text-transform:uppercase; letter-spacing:1.2px; color:var(--text-muted); opacity:0.7; }
    .header-meta-value { font-weight:600; color:var(--text); font-size:13px; display:flex; align-items:center; gap:6px; }
    .preview-link {
      display:inline-flex; align-items:center; justify-content:center;
      width:28px; height:28px; border-radius:8px;
      background:linear-gradient(135deg,var(--primary),var(--primary-light));
      color:#0f0f1a; text-decoration:none; transition:all 0.2s;
    }
    .preview-link:hover { transform:scale(1.1); box-shadow:0 0 12px var(--primary); }
    .preview-link svg { width:14px; height:14px; }

    /* Hero */
    .hero { padding:80px 0 60px; text-align:center; position:relative; overflow:hidden; }
    .hero::before {
      content:''; position:absolute; top:-100px; left:50%; transform:translateX(-50%);
      width:600px; height:600px; background:radial-gradient(circle,var(--primary-glow) 0%,transparent 70%);
      pointer-events:none; animation:float 6s ease-in-out infinite;
    }
    .hero::after {
      content:''; position:absolute; bottom:-200px; right:-100px;
      width:400px; height:400px; background:radial-gradient(circle,rgba(59,130,246,0.08) 0%,transparent 70%);
      pointer-events:none; animation:float 8s ease-in-out infinite reverse;
    }
    .hero-badge {
      display:inline-flex; align-items:center; gap:8px;
      background:var(--primary-glow); border:1px solid rgba(212,164,50,0.2);
      border-radius:100px; padding:6px 18px; font-size:12px; font-weight:600;
      color:var(--primary); text-transform:uppercase; letter-spacing:1.5px; margin-bottom:24px;
      animation:fadeInScale 0.6s ease both;
    }
    .hero-badge::before { content:''; width:6px; height:6px; background:var(--primary); border-radius:50%; animation:pulse-glow 2s infinite; }
    .hero h1 {
      font-size:clamp(32px,5vw,52px); font-weight:800; color:var(--text-heading);
      letter-spacing:-1px; line-height:1.15; margin-bottom:16px; animation:fadeInUp 0.8s ease both;
    }
    .hero h1 em {
      font-style:normal; background:linear-gradient(135deg,var(--primary),var(--primary-light));
      -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
    }
    .hero-sub { font-size:18px; color:var(--text-muted); max-width:560px; margin:0 auto 48px; line-height:1.7; animation:fadeInUp 0.8s 0.2s ease both; }

    /* Section */
    .section { padding:80px 0; position:relative; }
    .section-label {
      display:inline-flex; align-items:center; gap:8px;
      font-size:11px; font-weight:700; color:var(--primary);
      text-transform:uppercase; letter-spacing:2px; margin-bottom:12px;
    }
    .section-label::before { content:''; width:24px; height:2px; background:var(--primary); border-radius:1px; }
    .section h2 { font-size:clamp(26px,4vw,38px); font-weight:800; color:var(--text-heading); letter-spacing:-0.5px; margin-bottom:16px; }
    .section-desc { font-size:16px; color:var(--text-muted); max-width:600px; line-height:1.7; margin-bottom:48px; }

    .pricing-card { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius); overflow:hidden; }
    .pricing-header { background:linear-gradient(135deg,var(--secondary),var(--secondary-light)); padding:28px 32px; border-bottom:1px solid var(--border); }
    .pricing-header h3 { font-size:18px; font-weight:700; color:var(--text-heading); }
    .pricing-header p { font-size:13px; color:var(--text-muted); margin-top:4px; }
    .pricing-table-wrap { overflow-x:auto; -webkit-overflow-scrolling:touch; }
    .pricing-table { width:100%; border-collapse:collapse; min-width:400px; }
    .pricing-table thead th {
      padding:14px 24px; font-size:10px; font-weight:700; text-transform:uppercase;
      letter-spacing:1.5px; color:var(--text-muted); text-align:left;
      background:rgba(255,255,255,0.02); border-bottom:1px solid var(--border);
    }
    .pricing-table thead th:nth-child(3),.pricing-table thead th:nth-child(4) { text-align:right; }
    .pricing-table tbody tr:hover { background:rgba(255,255,255,0.015); }
    .pricing-footer { padding:24px 32px; background:rgba(255,255,255,0.02); }
    .pricing-total-row { display:flex; justify-content:space-between; align-items:center; padding:6px 0; font-size:14px; color:var(--text-muted); }
    .pricing-total-row.grand {
      padding:16px 0 0; margin-top:8px; border-top:2px solid var(--primary);
      font-size:20px; font-weight:800; color:var(--text-heading);
    }
    .pricing-total-row.grand .amount { color:var(--primary); font-size:24px; }

    /* USPs */
    .usps-section { background:var(--secondary); }
    .usps-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:20px; }
    .usp-card {
      background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius);
      padding:32px; transition:all 0.5s cubic-bezier(0.16,1,0.3,1); position:relative; overflow:hidden;
    }
    .usp-card::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; background:linear-gradient(90deg,var(--primary),var(--primary-light),transparent); opacity:0; transition:opacity 0.4s; }
    .usp-card::after { content:''; position:absolute; inset:0; background:radial-gradient(circle at var(--mouse-x,50%) var(--mouse-y,50%),rgba(212,164,50,0.06) 0%,transparent 60%); opacity:0; transition:opacity 0.4s; pointer-events:none; }
    .usp-card:hover { border-color:var(--border-hover); transform:translateY(-6px) scale(1.02); box-shadow:0 12px 48px var(--primary-glow); }
    .usp-card:hover::before { opacity:1; }
    .usp-card:hover::after { opacity:1; }
    .usp-icon {
      width:52px; height:52px; background:var(--primary-glow); border:1px solid rgba(212,164,50,0.15);
      border-radius:14px; display:flex; align-items:center; justify-content:center; margin-bottom:20px;
      transition:all 0.4s cubic-bezier(0.16,1,0.3,1);
    }
    .usp-card:hover .usp-icon { background:var(--primary); border-color:var(--primary); transform:scale(1.1) rotate(-5deg); }
    .usp-card h3 { font-size:17px; font-weight:700; color:var(--text-heading); margin-bottom:8px; transition:color 0.3s; }
    .usp-card:hover h3 { color:var(--primary); }
    .usp-card p { font-size:14px; color:var(--text-muted); line-height:1.6; }

    /* Action */
    .action-section { padding:80px 0 100px; text-align:center; }
    .action-glow { position:relative; }
    .action-glow::before {
      content:''; position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
      width:500px; height:500px; background:radial-gradient(circle,var(--primary-glow) 0%,transparent 70%);
      pointer-events:none;
    }
    .action-box {
      background:var(--bg-card); border:1px solid var(--border); border-radius:24px;
      padding:60px 48px; position:relative; z-index:1; max-width:640px; margin:0 auto;
    }
    .action-box h2 { font-size:28px; font-weight:800; color:var(--text-heading); margin-bottom:12px; }
    .action-box p { font-size:16px; color:var(--text-muted); margin-bottom:36px; line-height:1.7; }
    .action-buttons { display:flex; flex-direction:column; gap:14px; align-items:center; }

    .btn {
      display:inline-flex; align-items:center; justify-content:center; gap:10px;
      padding:16px 32px; border-radius:12px; font-size:16px; font-weight:700;
      font-family:inherit; text-decoration:none; border:none; cursor:pointer;
      transition:all 0.3s ease; min-width:320px;
    }
    .btn svg { width:18px; height:18px; flex-shrink:0; }
    .btn-primary {
      background:linear-gradient(135deg,var(--primary),var(--primary-light));
      color:var(--secondary); box-shadow:0 4px 20px var(--primary-glow-strong);
      animation:pulse-glow 3s ease-in-out infinite;
    }
    .btn-primary:hover { transform:translateY(-2px) scale(1.02); box-shadow:0 8px 40px var(--primary-glow-strong); }
    .btn-secondary { background:transparent; color:var(--text); border:1px solid var(--border); }
    .btn-secondary:hover { border-color:var(--primary); color:var(--primary); background:var(--primary-glow); }
    .btn:disabled { opacity:0.4; cursor:not-allowed; transform:none!important; box-shadow:none!important; animation:none!important; }

    /* Footer */
    .site-footer { border-top:1px solid var(--border); padding:32px 0; text-align:center; }
    .footer-inner { display:flex; justify-content:space-between; align-items:center; font-size:13px; color:var(--text-muted); }
    .footer-inner a { color:var(--primary); text-decoration:none; }

    /* Modal */
    .modal-overlay {
      position:fixed; inset:0; background:rgba(0,0,0,0.7); backdrop-filter:blur(8px);
      z-index:1000; display:flex; align-items:center; justify-content:center;
      opacity:0; pointer-events:none; transition:opacity 0.3s; padding:24px;
    }
    .modal-overlay.active { opacity:1; pointer-events:auto; }
    .modal {
      background:var(--bg-card); border:1px solid var(--border); border-radius:20px;
      padding:40px; max-width:480px; width:100%; transform:scale(0.95) translateY(10px);
      transition:transform 0.3s; position:relative;
    }
    .modal-overlay.active .modal { transform:scale(1) translateY(0); }
    .modal h3 { font-size:22px; font-weight:800; color:var(--text-heading); margin-bottom:8px; }
    .modal p { font-size:14px; color:var(--text-muted); line-height:1.6; margin-bottom:24px; }
    .modal-check {
      display:flex; align-items:flex-start; gap:12px; padding:16px;
      background:rgba(255,255,255,0.03); border:1px solid var(--border);
      border-radius:12px; margin-bottom:24px; cursor:pointer; transition:border-color 0.3s;
    }
    .modal-check:hover { border-color:var(--primary); }
    .modal-check input[type="checkbox"] { width:20px; height:20px; accent-color:var(--primary); margin-top:2px; flex-shrink:0; cursor:pointer; }
    .modal-check label { font-size:13px; color:var(--text); line-height:1.5; cursor:pointer; }
    .modal-amount { text-align:center; padding:20px; background:var(--primary-glow); border-radius:12px; margin-bottom:24px; }
    .modal-amount .label { font-size:12px; text-transform:uppercase; letter-spacing:1.5px; color:var(--text-muted); margin-bottom:4px; }
    .modal-amount .value { font-size:32px; font-weight:800; color:var(--primary); }
    .modal-buttons { display:flex; gap:12px; }
    .modal-buttons .btn { min-width:0; flex:1; padding:14px 20px; font-size:14px; }
    .modal-close { position:absolute; top:16px; right:16px; background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:20px; }

    /* Timeline */
    .timeline-section { background:var(--bg); }
    .timeline-list { position:relative; padding-left:32px; }
    .timeline-list::before { content:''; position:absolute; left:11px; top:8px; bottom:8px; width:2px; background:var(--border); }
    .timeline-item { position:relative; margin-bottom:24px; }
    .timeline-dot {
      position:absolute; left:-32px; top:4px; width:22px; height:22px;
      border-radius:50%; display:flex; align-items:center; justify-content:center;
      font-size:12px; z-index:1;
    }
    .timeline-dot.completed { background:#22c55e; }
    .timeline-dot.in_progress { background:#3b82f6; }
    .timeline-dot.pending { background:var(--secondary-light); border:2px solid var(--border); }
    .timeline-card {
      background:var(--bg-card); border:1px solid var(--border); border-radius:12px;
      padding:20px 24px; transition:border-color 0.3s;
    }
    .timeline-card:hover { border-color:var(--border-hover); }
    .timeline-title { font-size:15px; font-weight:700; color:var(--text-heading); }
    .timeline-meta { font-size:12px; color:var(--text-muted); margin-top:6px; display:flex; gap:16px; align-items:center; }
    .timeline-badge {
      display:inline-flex; padding:2px 10px; border-radius:100px; font-size:11px; font-weight:600;
    }

    /* Responsive */
    @media(max-width:768px) {
      .header-meta { display:none; }
      .hero { padding:48px 0 40px; }
      .section { padding:56px 0; }
      .usps-grid { grid-template-columns:1fr; gap:14px; }
      .action-box { padding:40px 24px; }
      .btn { min-width:100%; font-size:14px; padding:14px 24px; }
      .modal { padding:28px; }
      .modal-buttons { flex-direction:column; }
      .footer-inner { flex-direction:column; gap:8px; }
      .pricing-header { padding:20px 16px; }
      .pricing-footer { padding:20px 16px; }
      .pricing-table { min-width:0; width:100%; table-layout:fixed; }
      .pricing-table thead th { padding:10px 8px; font-size:8px; letter-spacing:0.5px; }
      .pricing-table thead th:nth-child(3) { display:none; }
      .pricing-table tbody td { padding:12px 8px; font-size:12px; }
      .pricing-table tbody td:nth-child(3) { display:none; }
      .pricing-table-wrap { overflow-x:hidden; }
      .pricing-total-row { font-size:13px; }
      .pricing-total-row.grand { font-size:16px; }
      .pricing-total-row.grand .amount { font-size:18px; }
      .container { padding:0 16px; }
      .overview-grid { grid-template-columns:1fr 1fr; gap:12px; }
    }
  </style>
</head>
<body>

  ${statusBanner}

  <header class="site-header">
    <div class="container header-inner">
      <div class="logo-area">
        <img src="https://bvluvvyvftygnxtmboxw.supabase.co/storage/v1/object/public/quote-pages/logo.png" alt="Gross ICT" class="logo-img">
      </div>
      <div class="header-meta">
        <div class="header-meta-item">
          <span class="header-meta-label">Kunde</span>
          <span class="header-meta-value">${escHtml(customerName)}</span>
        </div>
        <div class="header-meta-item">
          <span class="header-meta-label">Datum</span>
          <span class="header-meta-value">${fmtDateLong(quote.quote_date)}</span>
        </div>
        <div class="header-meta-item">
          <span class="header-meta-label">Angebotsnr.</span>
          <span class="header-meta-value">${escHtml(quote.quote_number)}</span>
        </div>
      </div>
    </div>
  </header>

  <section class="hero">
    <div class="particles" id="particles"></div>
    <div class="container" style="position:relative;z-index:1;">
      <div class="hero-badge">Persönliches Angebot</div>
      <h1>Guten Tag, ${escHtml(customer.first_name || customerName)}<br><em>Ihr Angebot ist bereit</em></h1>
      <p class="hero-sub">
        Wir haben eine massgeschneiderte Lösung für ${customer.company_name ? escHtml(customer.company_name) : 'Sie'} vorbereitet.
        Hier finden Sie alle Details zu unserem Angebot.
      </p>
    </div>
  </section>

  <section class="section" style="background:var(--secondary);">
    <div class="container">
      <div class="animate-in">
        <div class="section-label">Projektdetails</div>
        <h2>Auf einen Blick</h2>
      </div>
      <div class="animate-in" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:16px;margin-top:8px;max-width:100%;">
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:24px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:var(--text-muted);margin-bottom:8px;">Angebotsnummer</div>
          <div style="font-size:20px;font-weight:700;color:var(--text-heading);">${escHtml(quote.quote_number)}</div>
        </div>
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:24px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:var(--text-muted);margin-bottom:8px;">Erstellt am</div>
          <div style="font-size:20px;font-weight:700;color:var(--text-heading);">${fmtDate(quote.quote_date)}</div>
        </div>
        ${quote.valid_until ? `
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:24px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:var(--text-muted);margin-bottom:8px;">Gültig bis</div>
          <div style="font-size:20px;font-weight:700;color:var(--primary);">${fmtDate(quote.valid_until)}</div>
        </div>` : ""}
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:24px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:var(--text-muted);margin-bottom:8px;">Gesamtbetrag</div>
          <div style="font-size:20px;font-weight:700;color:var(--primary);">CHF ${fmtCHF(grandTotal)}</div>
        </div>
        ${quote.preview_url ? `
        <div style="background:linear-gradient(135deg,var(--primary),var(--primary-light));border-radius:var(--radius);padding:24px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-decoration:none;">
          <a href="${escHtml(quote.preview_url)}" target="_blank" rel="noopener" style="text-decoration:none;display:flex;flex-direction:column;align-items:center;gap:8px;color:#0f0f1a;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:24px;height:24px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">Webvorschau</div>
          </a>
        </div>` : ''}
      </div>
    </div>
  </section>

  ${project && milestones.length > 0 ? `
  <section class="section timeline-section">
    <div class="container">
      <div class="animate-in">
        <div class="section-label">Projektplanung</div>
        <h2>Ihre Timeline</h2>
        <p class="section-desc">Hier sehen Sie den aktuellen Stand Ihres Projekts und die geplanten Meilensteine.</p>
      </div>

      ${project.status ? `
      <div class="animate-in" style="display:flex;gap:16px;margin-bottom:32px;flex-wrap:wrap;">
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px 24px;flex:1;min-width:140px;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:var(--text-muted);margin-bottom:6px;">Projektstatus</div>
          <div style="font-size:16px;font-weight:700;color:var(--text-heading);display:flex;align-items:center;gap:8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${project.status === 'completed' ? '#22c55e' : project.status === 'in_progress' ? '#3b82f6' : 'var(--primary)'
        }" stroke-width="2" stroke-linecap="round"><${project.status === 'planning' ? 'rect x="3" y="3" width="18" height="18" rx="2"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="12" y2="16"/' :
          project.status === 'in_progress' ? 'path d="M12 2v20M2 12h20"/' :
            project.status === 'completed' ? 'path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/' : 'circle cx="12" cy="12" r="10"/'
        }></svg>
            ${project.status === 'planning' ? 'Planung' :
          project.status === 'in_progress' ? 'In Arbeit' :
            project.status === 'completed' ? 'Abgeschlossen' : project.status
        }
          </div>
        </div>
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px 24px;flex:1;min-width:140px;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:var(--text-muted);margin-bottom:6px;">Fortschritt</div>
          <div style="font-size:16px;font-weight:700;color:var(--primary);">${Math.round((milestones.filter((m: any) => m.status === 'completed').length / milestones.length) * 100)}%</div>
          <div style="height:6px;background:var(--border);border-radius:3px;margin-top:8px;">
            <div style="height:6px;background:var(--primary);border-radius:3px;width:${Math.round((milestones.filter((m: any) => m.status === 'completed').length / milestones.length) * 100)}%;"></div>
          </div>
        </div>
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px 24px;flex:1;min-width:140px;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:var(--text-muted);margin-bottom:6px;">Meilensteine</div>
          <div style="font-size:16px;font-weight:700;color:var(--text-heading);">${milestones.filter((m: any) => m.status === 'completed').length} / ${milestones.length}</div>
        </div>
      </div>` : ''}

      <div class="animate-in timeline-list">
        ${milestones.map((m: any) => {
          const statusClass = m.status || 'pending';
          const statusIcon = m.status === 'completed' ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>' :
            m.status === 'in_progress' ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' : '';
          const statusLabel = m.status === 'completed' ? 'Abgeschlossen' :
            m.status === 'in_progress' ? 'In Arbeit' : 'Ausstehend';
          const statusBg = m.status === 'completed' ? 'rgba(34,197,94,0.15)' :
            m.status === 'in_progress' ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.05)';
          const statusColor = m.status === 'completed' ? '#22c55e' :
            m.status === 'in_progress' ? '#3b82f6' : 'var(--text-muted)';
          const calendarIcon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
          const checkIcon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>';
          const dueDateHtml = m.due_date ? '<span style="display:flex;align-items:center;gap:4px;">' + calendarIcon + ' ' + fmtDate(m.due_date) + '</span>' : '';
          const completedHtml = m.completed_at ? '<span style="display:flex;align-items:center;gap:4px;">' + checkIcon + ' ' + fmtDate(m.completed_at) + '</span>' : '';
          return '<div class="timeline-item">'
            + '<div class="timeline-dot ' + statusClass + '">' + statusIcon + '</div>'
            + '<div class="timeline-card">'
            + '<div class="timeline-title" style="' + (m.status === 'completed' ? 'text-decoration:line-through;opacity:0.7;' : '') + '">' + escHtml(m.title) + '</div>'
            + '<div class="timeline-meta">'
            + '<span class="timeline-badge" style="background:' + statusBg + ';color:' + statusColor + ';display:flex;align-items:center;gap:4px;">' + statusLabel + '</span>'
            + dueDateHtml
            + completedHtml
            + '</div>'
            + (m.notes && m.is_note_public ? '<div style="margin-top:10px;padding:12px 14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:8px;font-size:13px;color:var(--text-body);line-height:1.6;">'
              + '<div style="font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:var(--text-muted);margin-bottom:6px;font-weight:600;">Hinweis</div>'
              + escHtml(m.notes)
              + '</div>' : '')
            + '</div>'
            + '</div>';
        }).join('')}
      </div>
    </div>
  </section>` : ''}

  <section class="section">
    <div class="container">
      <div class="animate-in">
        <div class="section-label">Leistungsübersicht</div>
        <h2>Ihr Angebot im Detail</h2>
        <p class="section-desc">Transparente Kostendarstellung — keine versteckten Gebühren, keine Überraschungen.</p>
      </div>
      <div class="pricing-card animate-in">
        <div class="pricing-header">
          <h3>Angebot für ${escHtml(customerName)}</h3>
          <p>${escHtml(quote.quote_number)} · ${fmtDate(quote.quote_date)}</p>
        </div>
        <div class="pricing-table-wrap">
        <table class="pricing-table">
          <thead>
            <tr>
              <th>Position</th>
              <th>Menge</th>
              <th>Einzelpreis</th>
              <th>Betrag (CHF)</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML}
          </tbody>
        </table>
        </div>
        <div class="pricing-footer">
          <div class="pricing-total-row">
            <span>Zwischensumme</span>
            <span>CHF ${fmtCHF(nonOptionalTotal || quote.subtotal)}</span>
          </div>
          ${hasOptional ? `
          <div class="pricing-total-row">
            <span>Optional-Positionen</span>
            <span>CHF ${fmtCHF(optionalTotal)}</span>
          </div>` : ""}
          ${quote.tax > 0 ? `
          <div class="pricing-total-row">
            <span>MwSt.</span>
            <span>CHF ${fmtCHF(quote.tax)}</span>
          </div>` : ""}
          <div class="pricing-total-row grand">
            <span>Gesamtbetrag</span>
            <span class="amount">CHF ${fmtCHF(grandTotal)}</span>
          </div>
        </div>
      </div>
    </div>
  </section>

  ${quote.notes ? `
  <section class="section" style="padding-top:0;">
    <div class="container">
      <div class="animate-in" style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:32px;">
        <div style="font-weight:700;font-size:14px;color:var(--primary);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Anmerkungen</div>
        <div style="font-size:14px;color:var(--text-muted);line-height:1.7;">${escHtml(quote.notes).replace(/\n/g, "<br>")}</div>
      </div>
    </div>
  </section>` : ""}

  <section class="section usps-section">
    <div class="container">
      <div class="animate-in" style="text-align:center;">
        <div class="section-label" style="justify-content:center;">Ihre Vorteile</div>
        <h2>Warum Gross ICT?</h2>
        <p class="section-desc" style="margin-left:auto;margin-right:auto;">Vier Gründe, warum Schweizer KMU auf uns vertrauen.</p>
      </div>
      <div class="usps-grid">
        <div class="usp-card card-shine animate-in" data-delay="1">
          <div class="usp-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
          <h3>Schnelle Umsetzung</h3>
          <p>Von der Idee zum Ergebnis in kürzester Zeit. Ergebnisse, keine Endlos-Meetings.</p>
        </div>
        <div class="usp-card card-shine animate-in" data-delay="2">
          <div class="usp-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
          <h3>Swiss Made Quality</h3>
          <p>Hosting in der Schweiz, DSGVO-konform, persönlicher Ansprechpartner in Zell LU.</p>
        </div>
        <div class="usp-card card-shine animate-in" data-delay="3">
          <div class="usp-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg></div>
          <h3>Alles aus einer Hand</h3>
          <p>Design, Entwicklung, Hosting & Support — ein Ansprechpartner, null Stress.</p>
        </div>
        <div class="usp-card card-shine animate-in" data-delay="4">
          <div class="usp-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg></div>
          <h3>Faire Preise</h3>
          <p>Transparent und verständlich. Keine versteckten Kosten — unser Preis ist unser Preis.</p>
        </div>
      </div>
    </div>
  </section>

  ${!isAccepted && !isExpired ? `
  <section class="section action-section">
    <div class="container action-glow">
      <div class="action-box animate-in" id="action-box">
        <h2>Bereit loszulegen?</h2>
        <p>Nehmen Sie das Angebot jetzt an und wir starten sofort mit der Umsetzung.</p>
        <div class="action-buttons">
          <button class="btn btn-primary" id="btn-accept">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            Angebot kostenpflichtig annehmen
          </button>
          <button class="btn btn-secondary" onclick="downloadPdf()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Angebot als PDF herunterladen
          </button>
        </div>
      </div>
    </div>
  </section>` : `
  <section class="section action-section">
    <div class="container action-glow">
      <div class="action-box animate-in">
        ${isAccepted ? '<div style="font-size:56px;margin-bottom:16px;">&#x2705;</div><h2 style="color:#22c55e;">Angebot angenommen</h2><p>Vielen Dank f&uuml;r Ihr Vertrauen. Hier k&ouml;nnen Sie das Angebot weiterhin als PDF herunterladen.</p>' : '<h2>Dieses Angebot ist nicht mehr g&uuml;ltig</h2><p>Sie k&ouml;nnen das Angebot trotzdem als PDF herunterladen.</p>'}
        <div class="action-buttons">
          <button class="btn btn-secondary" onclick="downloadPdf()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Angebot als PDF herunterladen
          </button>
        </div>
      </div>
    </div>
  </section>`}

  <footer class="site-footer">
    <div class="container footer-inner">
      <span>© ${new Date().getFullYear()} Gross ICT · Neuhushof 3 · 6144 Zell LU</span>
      <span><a href="tel:+41415623416">+41 41 562 34 16</a> · <a href="mailto:info@gross-ict.ch">info@gross-ict.ch</a></span><br>
      <span>UID: CHE-142.161.164</span>
    </div>
  </footer>

  <div class="modal-overlay" id="modal-overlay">
    <div class="modal">
      <button class="modal-close" id="modal-close">&times;</button>
      <h3>Angebot annehmen</h3>
      <p>Mit Ihrer Bestätigung wird das Angebot verbindlich angenommen.</p>
      <div class="modal-amount">
        <div class="label">Gesamtbetrag</div>
        <div class="value">CHF ${fmtCHF(grandTotal)}</div>
      </div>
      <div class="modal-check" id="modal-check-area">
        <input type="checkbox" id="agree">
        <label for="agree">Ich habe das Angebot gelesen und nehme es hiermit <strong>kostenpflichtig</strong> an. Die AGB und Datenschutzerklärung von Gross ICT habe ich zur Kenntnis genommen.</label>
      </div>
      <div class="modal-buttons">
        <button class="btn btn-secondary" id="modal-cancel">Abbrechen</button>
        <button class="btn btn-primary" id="modal-confirm" disabled>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          Bestätigen
        </button>
      </div>
    </div>
  </div>

  <script type="text/template" id="pdf-template">
    ${generateQuotePDFHTML(quote)}
  </script>

  <script>
    async function downloadPdf() {
      const btn = document.querySelector('[onclick="downloadPdf()"]') || document.querySelector('.btn-secondary');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<svg style="width:20px;height:20px;animation:spin 1s linear infinite" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> PDF wird erstellt...';
      }
      try {
        const res = await fetch('${supabaseUrl}/functions/v1/contract-page?id=${quote.id}&action=generate-quote-pdf');
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Unbekannter Fehler' }));
          throw new Error(err.error || 'HTTP ' + res.status);
        }
        const data = await res.json();
        if (!data.pdf) throw new Error('Kein PDF erhalten');

        // Convert base64 to Blob and download
        const byteChars = atob(data.pdf);
        const byteArray = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteArray[i] = byteChars.charCodeAt(i);
        }
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        // Try to download as file
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Angebot_${(quote.quote_number || "").replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Also open in new tab for mobile (where download might not work)
        if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
          window.open(url, '_blank');
        }

        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } catch (err) {
        alert('PDF konnte nicht erstellt werden: ' + (err.message || err));
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Angebot als PDF herunterladen';
        }
      }
    }

    // === Particles ===
    (function() {
      const container = document.getElementById('particles');
      if (!container) return;
      for (let i = 0; i < 20; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.left = Math.random() * 100 + '%';
        p.style.top = Math.random() * 100 + '%';
        p.style.setProperty('--dx', (Math.random() - 0.5) * 200 + 'px');
        p.style.setProperty('--dy', (Math.random() - 0.5) * 200 + 'px');
        p.style.animationDuration = (4 + Math.random() * 6) + 's';
        p.style.animationDelay = Math.random() * 5 + 's';
        p.style.width = p.style.height = (2 + Math.random() * 4) + 'px';
        container.appendChild(p);
      }
    })();

    // === Scroll animations with stagger ===
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const delay = parseInt(entry.target.dataset.delay || '0') * 100;
          setTimeout(() => entry.target.classList.add('visible'), delay);
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.animate-in').forEach(el => obs.observe(el));

    // === Number counter animation ===
    document.querySelectorAll('[data-count]').forEach(el => {
      const target = parseFloat(el.dataset.count);
      const obs2 = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            let start = 0;
            const duration = 1500;
            const startTime = performance.now();
            function step(now) {
              const progress = Math.min((now - startTime) / duration, 1);
              const eased = 1 - Math.pow(1 - progress, 3);
              const current = start + (target - start) * eased;
              el.textContent = current.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              if (progress < 1) requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
            obs2.unobserve(el);
          }
        });
      }, { threshold: 0.5 });
      obs2.observe(el);
    });

    // === USP card mouse tracking ===
    document.querySelectorAll('.usp-card').forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        card.style.setProperty('--mouse-x', x + '%');
        card.style.setProperty('--mouse-y', y + '%');
      });
    });

    // === Parallax on scroll ===
    const hero = document.querySelector('.hero');
    if (hero) {
      window.addEventListener('scroll', () => {
        const scroll = window.scrollY;
        const before = hero.querySelector('.particles');
        if (before) before.style.transform = 'translateY(' + scroll * 0.3 + 'px)';
      }, { passive: true });
    }

    // === Pricing table row animation ===
    document.querySelectorAll('.pricing-table tbody tr').forEach((row, i) => {
      row.style.opacity = '0';
      row.style.transform = 'translateX(-20px)';
      const rowObs = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            setTimeout(() => {
              row.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
              row.style.opacity = '1';
              row.style.transform = 'translateX(0)';
            }, i * 80);
            rowObs.unobserve(row);
          }
        });
      }, { threshold: 0.1 });
      rowObs.observe(row);
    });

    // === Supabase Realtime for live updates ===
    (async function() {
      try {
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        const supabase = createClient(
          '${supabaseUrl}',
          '${anonKey || ""}'
        );
        supabase
          .channel('quote-live-${quote.id}')
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'quotes',
            filter: 'id=eq.${quote.id}',
          }, (payload) => {
            const newStatus = payload.new.status;
            showLiveToast('Angebotsstatus wurde aktualisiert auf: <strong>' + newStatus + '</strong>. Seite wird neu geladen…');
            setTimeout(() => window.location.reload(), 3000);
          })
          .subscribe();
      } catch(e) { console.log('Realtime not available:', e); }
    })();

    function showLiveToast(html) {
      let toast = document.getElementById('live-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'live-toast';
        toast.className = 'live-toast';
        toast.innerHTML = '<div class="live-dot"></div><div class="live-toast-text"></div>';
        document.body.appendChild(toast);
      }
      toast.querySelector('.live-toast-text').innerHTML = html;
      requestAnimationFrame(() => { toast.classList.add('show'); });
      setTimeout(() => toast.classList.remove('show'), 8000);
    }

    // Modal
    const overlay = document.getElementById('modal-overlay');
    const checkbox = document.getElementById('agree');
    const confirmBtn = document.getElementById('modal-confirm');
    const acceptBtn = document.getElementById('btn-accept');

    if (acceptBtn) {
      acceptBtn.addEventListener('click', () => { overlay.classList.add('active'); document.body.style.overflow='hidden'; });
    }
    function closeModal() { overlay.classList.remove('active'); document.body.style.overflow=''; }
    document.getElementById('modal-close')?.addEventListener('click', closeModal);
    document.getElementById('modal-cancel')?.addEventListener('click', closeModal);
    overlay?.addEventListener('click', (e) => { if(e.target===overlay) closeModal(); });
    document.addEventListener('keydown', (e) => { if(e.key==='Escape') closeModal(); });

    checkbox?.addEventListener('change', () => { confirmBtn.disabled = !checkbox.checked; });
    document.getElementById('modal-check-area')?.addEventListener('click', (e) => {
      if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'LABEL') {
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change'));
      }
    });

    confirmBtn?.addEventListener('click', async () => {
      if (!checkbox.checked) return;
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = 'Wird verarbeitet…';

      try {
        const res = await fetch('${acceptUrl}', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          confirmBtn.innerHTML = '&#x2713; Angenommen!';
          confirmBtn.style.background = '#22c55e';
          confirmBtn.style.boxShadow = '0 4px 20px rgba(34,197,94,0.3)';
          checkbox.disabled = true;
          setTimeout(() => {
            closeModal();
            const ab = document.getElementById('action-box');
            if (ab) ab.innerHTML = '<div style="font-size:56px;margin-bottom:16px;">&#x2705;</div><h2 style="color:#22c55e;">Angebot angenommen!</h2><p>Vielen Dank für Ihr Vertrauen. Wir melden uns innerhalb von 24 Stunden bei Ihnen.</p>';
          }, 1500);
        } else {
          throw new Error(data.error || 'Fehler');
        }
      } catch (err) {
        confirmBtn.innerHTML = 'Fehler – bitte erneut versuchen';
        confirmBtn.disabled = false;
        confirmBtn.style.background = '#ef4444';
        setTimeout(() => {
          confirmBtn.style.background = '';
          confirmBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" width="18" height="18"><polyline points="20 6 9 17 4 12"/></svg> Bestätigen';
        }, 3000);
      }
    });
  </script>
</body>
</html>`;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return new Response(
      JSON.stringify({ error: "Angebots-ID fehlt" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: quote, error } = await supabase
      .from("quotes")
      .select("*, customer:customers(*), items:quote_items(*)")
      .eq("id", id)
      .single();

    if (error || !quote) {
      return new Response(
        JSON.stringify({ error: "Angebot nicht gefunden" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch linked project with milestones if quote is accepted
    let project = null;
    if (quote.status === "accepted") {
      const { data: projectData } = await supabase
        .from("projects")
        .select("*, milestones:project_milestones(*)")
        .eq("quote_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (projectData) {
        // Sort milestones by sort_order
        if (projectData.milestones) {
          projectData.milestones.sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
        }
        project = projectData;
      }
    }

    const html = renderPage(quote, supabaseUrl, project, Deno.env.get("SUPABASE_ANON_KEY"));

    return new Response(
      JSON.stringify({ html, quoteNumber: quote.quote_number }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[quote-page] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

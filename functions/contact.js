/**
 * Cloudflare Pages Function — POST /contact
 *
 * Receives the contact form payload, validates it, and sends a
 * formatted email to info@zentalence.com via the Resend API.
 *
 * Required environment variable (set in Cloudflare Pages → Settings → Environment Variables):
 *   RESEND_API_KEY   — your Resend API key (starts with re_...)
 *
 * The "from" address uses contact@zentalence.com — zentalence.com must be
 * verified in your Resend dashboard (Settings → Domains) before emails will
 * send. Resend will walk you through adding two DNS records; it takes ~5 min.
 */

const TO_ADDRESS   = 'info@zentalence.com';
const FROM_ADDRESS = 'Zentalence Website <contact@zentalence.com>';
const RESEND_URL   = 'https://api.resend.com/emails';

const SERVICE_LABELS = {
  'ai-staffing':  'AI & Data Contract Staffing',
  'erp-staffing': 'Oracle or SAP Contract Staffing',
  'multiple':     'Multiple services / not sure yet',
};

const TIMELINE_LABELS = {
  'asap':      'As soon as possible',
  '2weeks':    'Within 2 weeks',
  'month':     'Within a month',
  'quarter':   'Within the quarter',
  'exploring': 'Just exploring for now',
};

/** Escape user-supplied strings before embedding in HTML email */
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildEmailHtml({ fname, lname, email, company, service, timeline, message }) {
  const rows = [
    ['NAME',     `${esc(fname)} ${esc(lname)}`],
    ['EMAIL',    `<a href="mailto:${esc(email)}" style="color:#2563eb;">${esc(email)}</a>`],
    company  ? ['COMPANY',  esc(company)]                              : null,
    ['SERVICE',  esc(SERVICE_LABELS[service]  || service)],
    timeline ? ['TIMELINE', esc(TIMELINE_LABELS[timeline] || timeline)] : null,
  ]
  .filter(Boolean)
  .map(([label, value]) => `
    <tr style="border-bottom:1px solid #e2e8f0;">
      <td style="padding:10px 0;font-weight:600;color:#64748b;font-size:0.8rem;
                 text-transform:uppercase;letter-spacing:0.06em;width:130px;
                 vertical-align:top;">${label}</td>
      <td style="padding:10px 0;color:#0f172a;">${value}</td>
    </tr>`)
  .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/></head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;margin:0;padding:32px 16px;">
  <div style="max-width:580px;margin:0 auto;background:white;border-radius:12px;
              border:1px solid #e2e8f0;overflow:hidden;">
    <div style="background:#2563eb;padding:24px 32px;">
      <p style="margin:0;color:rgba(255,255,255,0.7);font-size:0.8rem;
                text-transform:uppercase;letter-spacing:0.1em;">New enquiry</p>
      <h1 style="margin:6px 0 0;color:white;font-size:1.4rem;font-weight:700;">
        ${esc(SERVICE_LABELS[service] || service)}
      </h1>
    </div>
    <div style="padding:32px;">
      <table style="width:100%;border-collapse:collapse;margin-bottom:28px;">
        ${rows}
      </table>
      <h3 style="margin:0 0 12px;color:#334155;font-size:0.85rem;
                 text-transform:uppercase;letter-spacing:0.06em;">Message</h3>
      <p style="margin:0;line-height:1.75;color:#334155;white-space:pre-wrap;
                background:#f8fafc;border-radius:8px;padding:16px;
                border:1px solid #e2e8f0;">${esc(message)}</p>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #e2e8f0;background:#f8fafc;">
      <p style="margin:0;font-size:0.75rem;color:#94a3b8;">
        Sent via the contact form at zentalence.com
      </p>
    </div>
  </div>
</body>
</html>`;
}

/** Handle CORS preflight */
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

/** Handle form submission */
export async function onRequestPost(context) {
  const { request, env } = context;

  const jsonHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400, headers: jsonHeaders });
  }

  const { fname, lname, email, company, service, timeline, message } = body;

  // ── Validate required fields ─────────────────────────────────────────────────
  if (!fname?.trim() || !email?.trim() || !service?.trim() || !message?.trim()) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: jsonHeaders });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: 'Invalid email address' }), { status: 400, headers: jsonHeaders });
  }

  // ── Check API key is configured ──────────────────────────────────────────────
  if (!env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY environment variable is not set');
    return new Response(JSON.stringify({ error: 'Email service not configured' }), { status: 500, headers: jsonHeaders });
  }

  // ── Build subject line ───────────────────────────────────────────────────────
  const serviceName = SERVICE_LABELS[service] || service;
  const senderName  = `${fname.trim()} ${(lname || '').trim()}`.trim();
  const subject     = company?.trim()
    ? `New enquiry: ${serviceName} — ${senderName} (${company.trim()})`
    : `New enquiry: ${serviceName} — ${senderName}`;

  // ── Send via Resend ──────────────────────────────────────────────────────────
  let resendRes;
  try {
    resendRes = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:     FROM_ADDRESS,
        to:       [TO_ADDRESS],
        reply_to: email.trim(),
        subject,
        html:     buildEmailHtml({ fname, lname: lname || '', email, company: company || '', service, timeline: timeline || '', message }),
      }),
    });
  } catch (fetchErr) {
    console.error('Network error calling Resend:', fetchErr);
    return new Response(JSON.stringify({ error: 'Failed to reach email service' }), { status: 502, headers: jsonHeaders });
  }

  if (!resendRes.ok) {
    const detail = await resendRes.text().catch(() => '');
    console.error('Resend API error', resendRes.status, detail);
    return new Response(JSON.stringify({ error: 'Email delivery failed' }), { status: 502, headers: jsonHeaders });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200, headers: jsonHeaders });
}

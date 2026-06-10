/**
 * Cloudflare Pages Function — POST /contact
 *
 * Receives the contact form payload, validates it, and sends a
 * formatted email to info@zentalence.com via the Resend API.
 *
 * Required environment variable (Cloudflare Pages → Settings → Environment Variables):
 *   RESEND_API_KEY   — your Resend API key (starts with re_...)
 *
 * The "from" address (contact@zentalence.com) requires zentalence.com to be
 * verified in Resend → Settings → Domains before emails will send.
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

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function row(label, value) {
  return `<tr style="border-bottom:1px solid #e2e8f0;">
    <td style="padding:10px 0;font-weight:600;color:#64748b;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.06em;width:130px;vertical-align:top;">${label}</td>
    <td style="padding:10px 0;color:#0f172a;">${value}</td>
  </tr>`;
}

function buildEmailHtml(data) {
  var fname    = data.fname    || '';
  var lname    = data.lname    || '';
  var email    = data.email    || '';
  var company  = data.company  || '';
  var service  = data.service  || '';
  var timeline = data.timeline || '';
  var message  = data.message  || '';

  var serviceLabel  = SERVICE_LABELS[service]  || service;
  var timelineLabel = TIMELINE_LABELS[timeline] || timeline;

  var rows = row('Name',    esc(fname) + ' ' + esc(lname))
           + row('Email',   '<a href="mailto:' + esc(email) + '" style="color:#2563eb;">' + esc(email) + '</a>')
           + (company  ? row('Company',  esc(company))       : '')
           + row('Service', esc(serviceLabel))
           + (timeline ? row('Timeline', esc(timelineLabel)) : '');

  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head>'
    + '<body style="font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;margin:0;padding:32px 16px;">'
    + '<div style="max-width:580px;margin:0 auto;background:white;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">'
    + '<div style="background:#2563eb;padding:24px 32px;">'
    + '<p style="margin:0;color:rgba(255,255,255,0.7);font-size:0.8rem;text-transform:uppercase;letter-spacing:0.1em;">New enquiry</p>'
    + '<h1 style="margin:6px 0 0;color:white;font-size:1.4rem;font-weight:700;">' + esc(serviceLabel) + '</h1>'
    + '</div>'
    + '<div style="padding:32px;">'
    + '<table style="width:100%;border-collapse:collapse;margin-bottom:28px;">' + rows + '</table>'
    + '<h3 style="margin:0 0 12px;color:#334155;font-size:0.85rem;text-transform:uppercase;letter-spacing:0.06em;">Message</h3>'
    + '<p style="margin:0;line-height:1.75;color:#334155;white-space:pre-wrap;background:#f8fafc;border-radius:8px;padding:16px;border:1px solid #e2e8f0;">' + esc(message) + '</p>'
    + '</div>'
    + '<div style="padding:16px 32px;border-top:1px solid #e2e8f0;background:#f8fafc;">'
    + '<p style="margin:0;font-size:0.75rem;color:#94a3b8;">Sent via the contact form at zentalence.com</p>'
    + '</div></div></body></html>';
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

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

export async function onRequestPost(context) {
  var request = context.request;
  var env     = context.env;

  // ── Wrap everything so an unexpected exception never hits Cloudflare's default 500 ──
  try {

    // Parse JSON body
    var body;
    try {
      body = await request.json();
    } catch (parseErr) {
      console.error('Failed to parse request body:', parseErr);
      return jsonResponse({ error: 'Invalid request body' }, 400);
    }

    var fname    = (body.fname    || '').toString().trim();
    var lname    = (body.lname    || '').toString().trim();
    var email    = (body.email    || '').toString().trim();
    var company  = (body.company  || '').toString().trim();
    var service  = (body.service  || '').toString().trim();
    var timeline = (body.timeline || '').toString().trim();
    var message  = (body.message  || '').toString().trim();

    // Validate required fields
    if (!fname || !email || !service || !message) {
      return jsonResponse({ error: 'Missing required fields' }, 400);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ error: 'Invalid email address' }, 400);
    }

    // Check API key
    if (!env || !env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not set in environment variables');
      return jsonResponse({ error: 'Email service not configured' }, 500);
    }

    // Build email content
    var serviceLabel = SERVICE_LABELS[service] || service;
    var senderName   = lname ? fname + ' ' + lname : fname;
    var subject      = company
      ? 'New enquiry: ' + serviceLabel + ' — ' + senderName + ' (' + company + ')'
      : 'New enquiry: ' + serviceLabel + ' — ' + senderName;

    var emailHtml;
    try {
      emailHtml = buildEmailHtml({ fname: fname, lname: lname, email: email, company: company, service: service, timeline: timeline, message: message });
    } catch (buildErr) {
      console.error('Failed to build email HTML:', buildErr);
      return jsonResponse({ error: 'Failed to build email' }, 500);
    }

    // Call Resend
    var resendPayload = JSON.stringify({
      from:     FROM_ADDRESS,
      to:       [TO_ADDRESS],
      reply_to: email,
      subject:  subject,
      html:     emailHtml,
    });

    var resendRes;
    try {
      resendRes = await fetch(RESEND_URL, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + env.RESEND_API_KEY,
          'Content-Type': 'application/json',
        },
        body: resendPayload,
      });
    } catch (fetchErr) {
      console.error('Network error reaching Resend API:', fetchErr);
      return jsonResponse({ error: 'Failed to reach email service' }, 502);
    }

    if (!resendRes.ok) {
      var detail = '';
      try { detail = await resendRes.text(); } catch (e) { /* ignore */ }
      console.error('Resend API returned', resendRes.status, ':', detail);
      return jsonResponse({ error: 'Email delivery failed', detail: detail }, 502);
    }

    console.log('Email sent successfully for', email);
    return jsonResponse({ success: true }, 200);

  } catch (unexpectedErr) {
    console.error('Unexpected error in contact function:', unexpectedErr && (unexpectedErr.message || unexpectedErr));
    return jsonResponse({ error: 'Unexpected server error', detail: unexpectedErr && unexpectedErr.message || 'unknown' }, 500);
  }
}

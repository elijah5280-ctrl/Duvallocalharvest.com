// netlify/functions/submission-created.js
//
// Netlify calls this automatically after a VERIFIED form submission.
// No changes to your HTML are needed. Nothing here is visible to the browser.
//
// SETUP (all in the Netlify dashboard, no terminal):
//   1. Site configuration > Environment variables > Add:
//        RESEND_API_KEY   = your Resend key
//        DLH_FROM         = the From line for welcome emails,
//                           formatted as:  Name <address@yourdomain>
//      That domain must be VERIFIED in Resend or sends will fail.
//
//      Do NOT paste either value into this file. Netlify scans the repo
//      for env var values and will fail the build if it finds them.
//   2. Deploy. Netlify auto-detects the netlify/functions folder.
//   3. Test the form. Check the function log under Logs > Functions.

const ESC = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function shell(bodyHtml) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#FAF6EE;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF6EE;padding:28px 14px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #E5DBC7;border-radius:12px;">
<tr><td style="background:#2E4A34;padding:22px 26px;border-radius:12px 12px 0 0;">
  <div style="font-family:Georgia,serif;font-size:19px;color:#FFFFFF;letter-spacing:.4px;">Duval Local Harvest</div>
  <div style="font-family:Georgia,serif;font-size:13px;color:#C6D4BC;margin-top:3px;">Good food. Stronger community.</div>
</td></tr>
<tr><td style="padding:26px;font-family:Georgia,serif;font-size:15px;line-height:1.6;color:#29251F;">
${bodyHtml}
</td></tr>
<tr><td style="padding:0 26px 24px;font-family:Georgia,serif;font-size:13px;line-height:1.6;color:#6C6556;border-top:1px solid #E5DBC7;padding-top:18px;">
  Elijah Acquafredda<br>
  Founder, Duval Local Harvest<br>
  <a href="mailto:elijah@duvallocalharvest.com" style="color:#9C7322;text-decoration:none;">elijah@duvallocalharvest.com</a> &nbsp;&middot;&nbsp;
  <a href="https://duvallocalharvest.com" style="color:#9C7322;text-decoration:none;">duvallocalharvest.com</a>
</td></tr>
</table></td></tr></table></body></html>`;
}

function farmEmail(name) {
  const hi = name ? `Dear ${ESC(name)},` : 'Hello,';
  return {
    subject: 'Welcome to Duval Local Harvest',
    html: shell(`
<p style="margin:0 0 14px;">${hi}</p>
<p style="margin:0 0 14px;">Thank you for signing up for Duval Local Harvest.</p>
<p style="margin:0 0 14px;">Here is how the network works. Enrolled farms post what they have actually harvested each week, and enrolled restaurants review that list and claim what they need, directly from the farm.</p>
<p style="margin:0 0 14px;">I want to be transparent about where things stand. The network is still in its early stages. A small number of farms and kitchens are currently enrolled, and there is not yet enough volume on either side to support weekly ordering. That will change as enrollment grows. By signing up now, you are among the first, and I will notify you as soon as restaurants are ready to purchase what you post.</p>
<p style="margin:0 0 14px;">I will be in touch within the next day or two to learn more about what you grow and to complete your setup. There is no cost to participate and no obligation to post.</p>
<p style="margin:0 0 14px;">If any part of this does not align with how your operation works, please let me know.</p>
<p style="margin:0;">Sincerely,</p>`)
  };
}

function restaurantEmail(name) {
  const hi = name ? `Dear ${ESC(name)},` : 'Hello,';
  return {
    subject: 'Welcome to Duval Local Harvest',
    html: shell(`
<p style="margin:0 0 14px;">${hi}</p>
<p style="margin:0 0 14px;">Thank you for signing up for Duval Local Harvest.</p>
<p style="margin:0 0 14px;">Here is how the network works. Enrolled farms post what they have actually harvested each week. You review that list and claim what you need, directly from the grower.</p>
<p style="margin:0 0 14px;">I want to be transparent about where things stand. The network is still in its early stages. I am actively enrolling farms, and there is not yet enough supply to support a full weekly order. That will change as enrollment grows. By signing up now, you are among the first, and I will notify you as soon as there is enough available to be worth your time. Until then, this is intended to supplement your existing sourcing, not replace it.</p>
<p style="margin:0 0 14px;">I will be in touch within the next day or two to learn what you would want from local farms and to complete your setup. There is no cost to sign up, no minimums, and no commitment.</p>
<p style="margin:0 0 14px;">If any part of this does not align with how your kitchen operates, please let me know.</p>
<p style="margin:0;">Sincerely,</p>`)
  };
}

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const payload = body.payload || {};
    const data = payload.data || {};
    const formName = payload.form_name || data['form-name'] || '';
    const to = (data.email || '').trim();
    const name = (data.contact_name || '').trim().split(/\s+/)[0] || '';

    if (!to) {
      console.log('No email field on submission; nothing sent. form=' + formName);
      return { statusCode: 200, body: 'no recipient' };
    }
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not set');
      return { statusCode: 200, body: 'missing key' };
    }
    if (!process.env.DLH_FROM) {
      console.error('DLH_FROM is not set - add it in Netlify environment variables');
      return { statusCode: 200, body: 'missing from' };
    }

    const isFarm = formName === 'farm-enrollment';
    const msg = isFarm ? farmEmail(name) : restaurantEmail(name);

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.DLH_FROM,
        to: [to],
        reply_to: 'elijah@duvallocalharvest.com',
        subject: msg.subject,
        html: msg.html
      })
    });

    const text = await res.text();
    if (!res.ok) {
      console.error('Resend failed', res.status, text);
      return { statusCode: 200, body: 'resend error logged' };
    }
    console.log('Welcome sent', formName, to, text);
    return { statusCode: 200, body: 'sent' };
  } catch (err) {
    console.error('submission-created error', err);
    return { statusCode: 200, body: 'error logged' };
  }
};

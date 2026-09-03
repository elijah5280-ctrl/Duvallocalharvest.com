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
  const hi = name ? `Hi ${ESC(name)},` : 'Hi,';
  return {
    subject: 'You\u2019re on the Duval Local Harvest farm list',
    html: shell(`
<p style="margin:0 0 14px;">${hi}</p>
<p style="margin:0 0 14px;">Thanks for signing up. Here\u2019s what Duval Local Harvest actually is, and what happens next.</p>
<p style="margin:0 0 14px;"><b>What it is.</b> A direct line between farms here in Duval County and the kitchens that want to buy from them. You post what you actually harvested that week &mdash; real items, real quantities. Enrolled restaurants see that list and claim what they want. No broker in the middle, no bidding, no one telling you what to grow.</p>
<p style="margin:0 0 14px;"><b>What being enrolled means.</b> You set your own prices. You post only what you actually have, when you have it. You are never obligated to post, and you can stop any time. It is free to join, and it stays free for farms.</p>
<p style="margin:0 0 14px;"><b>What happens next.</b> I\u2019ll reach out personally, usually within a day or two, to get you set up and walk you through posting your first harvest. If it\u2019s easier to talk it through on the phone, just reply and tell me a good time.</p>
<p style="margin:0 0 14px;">If anything I\u2019ve said doesn\u2019t match what you need, tell me. I\u2019d rather hear it now.</p>
<p style="margin:0;">Thanks for giving this a look.</p>`)
  };
}

function restaurantEmail(name) {
  const hi = name ? `Hi ${ESC(name)},` : 'Hi,';
  return {
    subject: 'You\u2019re on the Duval Local Harvest kitchen list',
    html: shell(`
<p style="margin:0 0 14px;">${hi}</p>
<p style="margin:0 0 14px;">Thanks for signing up. Here\u2019s what Duval Local Harvest actually is, and what happens next.</p>
<p style="margin:0 0 14px;"><b>What it is.</b> A direct line between kitchens here in Duval County and the farms growing food a few miles away. Enrolled farms post what they actually harvested that week. You see that board and claim what you want, direct from the grower. You know whose field it came from, because it says so.</p>
<p style="margin:0 0 14px;"><b>What being enrolled means.</b> No contract, no minimum, no commitment to buy. You claim what\u2019s useful to you and ignore the rest. It is free to join. I\u2019ll be straight with you about scale: this is a small network right now, a handful of farms and growing. It supplements your existing sourcing rather than replacing it.</p>
<p style="margin:0 0 14px;"><b>What happens next.</b> I\u2019ll reach out personally, usually within a day or two, to walk you through the weekly board and how claiming works. If a quick call is easier, reply and tell me a good time for your prep schedule.</p>
<p style="margin:0;">I run a kitchen too, so if something about this doesn\u2019t fit how you actually buy, say so.</p>`)
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

const nodemailer = require('nodemailer');
const { getApartmentPayload, fetchListingEventsBetweenCreatedAt } = require('../../lib/apartmentRepository');
const { boundsForInstantInTz } = require('../../lib/etDayBounds');
const { buildEmailHtml, normalizeBaseUrl } = require('../../lib/pipelineDigest');
const { json, parseBody } = require('../../lib/http');

function parseRecipientList(raw) {
  return String(raw || '')
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const body = parseBody(event) || {};

  const smtpHost = process.env.NYHOME_SMTP_SERVER || process.env.SMTP_SERVER;
  const smtpPort = Number(process.env.NYHOME_SMTP_PORT || process.env.SMTP_PORT || 587);
  const smtpUser = process.env.NYHOME_SMTP_USER || process.env.SMTP_USER;
  const smtpPass = process.env.NYHOME_SMTP_PASS || process.env.SMTP_PASS;
  const from = process.env.NYHOME_EMAIL_FROM || smtpUser;
  const toRaw = process.env.NYHOME_EMAIL_TO || '';

  const recipients = parseRecipientList(toRaw);
  if (!smtpHost || !smtpUser || !smtpPass || !from || recipients.length === 0) {
    return json(400, {
      error:
        'Email not configured. Set NYHOME_SMTP_SERVER, NYHOME_SMTP_USER, NYHOME_SMTP_PASS, NYHOME_EMAIL_FROM, NYHOME_EMAIL_TO (comma-separated).',
    });
  }

  const publicBaseUrl =
    normalizeBaseUrl(body.publicBaseUrl) ||
    normalizeBaseUrl(process.env.NYHOME_PUBLIC_URL) ||
    '';

  let payload;
  let listingEventsToday = [];
  const bounds = boundsForInstantInTz(Date.now(), 'America/New_York');
  try {
    listingEventsToday = await fetchListingEventsBetweenCreatedAt(
      new Date(bounds.startMs),
      new Date(bounds.endExclusiveMs)
    );
  } catch (e) {
    console.error('[pipeline-digest-email] listing_events range query', e);
  }

  try {
    payload = await getApartmentPayload();
  } catch (e) {
    console.error('[pipeline-digest-email]', e);
    return json(500, { error: 'Could not load apartments' });
  }

  const { html, subject, meta } = buildEmailHtml({
    apartments: payload.apartments || [],
    publicBaseUrl,
    now: Date.now(),
    listingEventsToday,
    digestBounds: bounds,
  });

  const transport = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  try {
    await transport.sendMail({
      from,
      to: recipients.join(', '),
      subject,
      html,
    });
  } catch (e) {
    console.error('[pipeline-digest-email] sendMail', e);
    return json(500, { error: e.message || 'Failed to send email' });
  }

  return json(200, {
    success: true,
    to: recipients,
    subject,
    ...meta,
  });
};

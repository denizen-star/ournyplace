const nodemailer = require('nodemailer');
const { getApartmentById, setListingScoresCompleteEmailSent } = require('./apartmentRepository');
const { buildListingAddedEmailHtml, buildListingDetailEmailHtml } = require('./listingAddedEmail');
const { normalizeBaseUrl } = require('./pipelineDigest');
const { isBothPartnersVotingComplete } = require('./votingComplete');

function parseRecipientList(raw) {
  return String(raw || '')
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function getSmtpConfig() {
  const smtpHost = process.env.NYHOME_SMTP_SERVER || process.env.SMTP_SERVER;
  const smtpPort = Number(process.env.NYHOME_SMTP_PORT || process.env.SMTP_PORT || 587);
  const smtpUser = process.env.NYHOME_SMTP_USER || process.env.SMTP_USER;
  const smtpPass = process.env.NYHOME_SMTP_PASS || process.env.SMTP_PASS;
  const from = process.env.NYHOME_EMAIL_FROM || smtpUser;
  const toRaw = process.env.NYHOME_EMAIL_TO || '';
  const recipients = parseRecipientList(toRaw);
  return { smtpHost, smtpPort, smtpUser, smtpPass, from, recipients };
}

function smtpReady(cfg) {
  return Boolean(cfg.smtpHost && cfg.smtpUser && cfg.smtpPass && cfg.from && cfg.recipients.length > 0);
}

function createTransport(cfg) {
  return nodemailer.createTransport({
    host: cfg.smtpHost,
    port: cfg.smtpPort,
    secure: cfg.smtpPort === 465,
    auth: {
      user: cfg.smtpUser,
      pass: cfg.smtpPass,
    },
  });
}

/**
 * Notify NYHOME_EMAIL_TO when a new apartment row is created (POST /api/apartments).
 * Does not throw: logs and returns `{ sent, skipped, error? }`.
 */
async function sendListingAddedEmail(apartmentId) {
  const cfg = getSmtpConfig();
  if (!smtpReady(cfg)) {
    console.warn('[listing-added-email] skipped: SMTP or NYHOME_EMAIL_TO not configured');
    return { skipped: true };
  }

  const data = await getApartmentById(apartmentId);
  if (!data || !data.apartment) {
    console.error('[listing-added-email] apartment not found', apartmentId);
    return { skipped: true };
  }

  const publicBaseUrl = normalizeBaseUrl(process.env.NYHOME_PUBLIC_URL) || '';
  const { html, subject } = buildListingAddedEmailHtml({
    apartment: data.apartment,
    criteria: data.criteria,
    publicBaseUrl,
  });
  const transport = createTransport(cfg);

  try {
    await transport.sendMail({
      from: cfg.from,
      to: cfg.recipients.join(', '),
      subject,
      html,
    });
  } catch (e) {
    console.error('[listing-added-email] sendMail', e);
    return { skipped: false, sent: false, error: e.message };
  }

  return { sent: true, to: cfg.recipients, subject };
}

/**
 * Same layout as listing-added email, when both partners scored every criterion.
 * @param {boolean} options.manual - from UI button: always send if complete (no DB flag).
 * @param {boolean} options.auto - from ratings handler: send once until voting incomplete again.
 */
async function sendListingScoresCompleteEmail(apartmentId, options) {
  const manual = Boolean(options && options.manual);
  const auto = Boolean(options && options.auto);
  const cfg = getSmtpConfig();
  if (!smtpReady(cfg)) {
    console.warn('[listing-scores-complete-email] skipped: SMTP or NYHOME_EMAIL_TO not configured');
    return { skipped: true };
  }

  const data = await getApartmentById(apartmentId);
  if (!data || !data.apartment) {
    console.error('[listing-scores-complete-email] apartment not found', apartmentId);
    return { skipped: true };
  }

  const { apartment, criteria } = data;
  if (auto && !isBothPartnersVotingComplete(criteria, apartment.ratings)) {
    return { skipped: true, reason: 'incomplete' };
  }

  const sentFlag = apartment.listing_scores_complete_email_sent;
  const alreadySent = sentFlag === true || sentFlag === 1 || sentFlag === '1';
  if (auto && alreadySent) {
    return { skipped: true, reason: 'already_sent' };
  }

  const publicBaseUrl = normalizeBaseUrl(process.env.NYHOME_PUBLIC_URL) || '';
  const { html, subject } = buildListingDetailEmailHtml({
    apartment,
    criteria,
    publicBaseUrl,
    kind: 'scores_complete',
    manual,
  });
  const transport = createTransport(cfg);

  try {
    await transport.sendMail({
      from: cfg.from,
      to: cfg.recipients.join(', '),
      subject,
      html,
    });
  } catch (e) {
    console.error('[listing-scores-complete-email] sendMail', e);
    return { skipped: false, sent: false, error: e.message };
  }

  if (auto) {
    try {
      await setListingScoresCompleteEmailSent(apartmentId, true);
    } catch (e) {
      console.error('[listing-scores-complete-email] set flag', e);
    }
  }

  return { sent: true, to: cfg.recipients, subject };
}

module.exports = {
  sendListingAddedEmail,
  sendListingScoresCompleteEmail,
};

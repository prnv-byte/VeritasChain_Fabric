'use strict';

const nodemailer = require('nodemailer');

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  FROM_EMAIL,
  APP_BASE_URL,
} = process.env;

const DEFAULT_FROM = FROM_EMAIL || 'no-reply@veritaschain.com';
const DEFAULT_APP_URL = APP_BASE_URL || 'http://localhost:5173';

function createTransporter() {
  if (SMTP_HOST && SMTP_PORT) {
    return nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465,
      auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });
  }

  return nodemailer.createTransport({
    jsonTransport: true,
  });
}

async function sendPasswordSetupEmail(org, token) {
  if (!org || !org.email) {
    throw new Error('Invalid org or missing email address');
  }
  if (!token) {
    throw new Error('Password setup token is required');
  }

  const transporter = createTransporter();
  const setupUrl = `${DEFAULT_APP_URL.replace(/\/$/, '')}/password-setup?token=${encodeURIComponent(token)}&email=${encodeURIComponent(org.email)}`;
  const mailOptions = {
    from: DEFAULT_FROM,
    to: org.email,
    subject: 'Set up your VeritasChain password',
    text: `Hello ${org.name},\n\n` +
      'Your organization registration is almost complete. Click the link below to set your password for first login:\n\n' +
      `${setupUrl}\n\n` +
      'This link expires in 24 hours. If you did not request this email, please ignore it.\n\n' +
      'Thank you,\nVeritasChain Team',
    html: `
      <p>Hello ${org.name},</p>
      <p>Your organization registration is almost complete. Click the button below to set your password for first login.</p>
      <p><a href="${setupUrl}" style="display:inline-block;padding:12px 18px;color:#ffffff;background:#2563eb;border-radius:6px;text-decoration:none;">Set your password</a></p>
      <p>If the button does not work, paste this link into your browser:</p>
      <p><a href="${setupUrl}">${setupUrl}</a></p>
      <p>This link expires in 24 hours.</p>
      <p>Thank you,<br/>VeritasChain Team</p>
    `,
  };

  const info = await transporter.sendMail(mailOptions);

  if (process.env.NODE_ENV !== 'production' && transporter.options && transporter.options.jsonTransport) {
    console.log('[email] Password setup mail content:', info.message);
  }

  return info;
}

module.exports = {
  sendPasswordSetupEmail,
};

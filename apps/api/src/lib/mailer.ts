import nodemailer from 'nodemailer';
import { env } from '../env.js';

const enabled = Boolean(env.SMTP_HOST && env.SMTP_USER);
const transporter = enabled
  ? nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_PORT === 465, auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } })
  : null;

export async function sendMail(opts: { to: string; subject: string; html: string }): Promise<void> {
  if (!transporter || !opts.to) {
    if (env.NODE_ENV !== 'test') console.log('[mail:skipped]', opts.subject, '->', opts.to || '(no recipient)');
    return;
  }
  await transporter.sendMail({ from: env.MAIL_FROM, to: opts.to, subject: opts.subject, html: opts.html });
}

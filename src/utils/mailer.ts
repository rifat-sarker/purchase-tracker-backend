import nodemailer from 'nodemailer';
import config from '../config';
import logger from './logger';

/**
 * Sends an email via SMTP when configured. If SMTP env vars are absent,
 * falls back to console.log-ing the email content so the app never
 * crashes and the warranty cron (or any future email feature) still
 * "works" in dev without real credentials.
 */
const sendMail = async (options: { to: string; subject: string; text: string; html?: string }): Promise<void> => {
  if (!config.smtp.isConfigured) {
    logger.info(`[email:fallback] To: ${options.to} | Subject: ${options.subject}\n${options.text}`);
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: { user: config.smtp.user, pass: config.smtp.password },
    });

    await transporter.sendMail({
      from: config.smtp.user,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
  } catch (err) {
    logger.error(`Failed to send email via SMTP, falling back to console log: ${(err as Error).message}`);
    logger.info(`[email:fallback] To: ${options.to} | Subject: ${options.subject}\n${options.text}`);
  }
};

export default sendMail;

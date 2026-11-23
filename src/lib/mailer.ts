// src/lib/mailer.ts
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

let cached: Transporter | null = null;

/**
 * 🔹 Fase 7.9 — Transporter Nodemailer.
 *    DEV: Ethereal (createTestAccount, zero config).
 *    PROD: SMTP da empresa via env (SMTP_HOST/PORT/USER/PASS).
 */
export async function getTransporter(): Promise<Transporter> {
  if (cached) return cached;

  if (process.env.NODE_ENV === "development") {
    const testAccount = await nodemailer.createTestAccount();
    console.log("📧 Ethereal user:", testAccount.user);
    console.log("📧 Ethereal pass:", testAccount.pass);

    cached = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    return cached;
  }

  cached = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return cached;
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  const t = await getTransporter();
  const info = await t.sendMail({
    from: process.env.SMTP_FROM || '"Stockify" <no-reply@stockify.local>',
    ...opts,
  });

  if (process.env.NODE_ENV === "development") {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) console.log("📧 Preview:", previewUrl);
  }
  return info;
}

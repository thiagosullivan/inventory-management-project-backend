// src/emails/templates/verification-email.ts
import { baseLayout } from "../base-layout.js";

export function verificationEmailTemplate(opts: {
  userName: string;
  otp: string;
}): { subject: string; html: string } {
  const { userName, otp } = opts;

  const body = `
    <p style="margin:0 0 16px 0;font-size:14px;color:#3f3f46;line-height:1.6;">
      Use o código abaixo para <strong>confirmar seu e-mail</strong> no Stockify.
    </p>

    <div style="text-align:center;margin:24px 0;">
      <span style="display:inline-block;font-size:32px;font-weight:700;letter-spacing:8px;color:#18181b;background-color:#f4f4f5;padding:16px 28px;border-radius:8px;border:1px solid #e4e4e7;font-family:monospace;">
        ${otp}
      </span>
    </div>

    <p style="margin:0 0 8px 0;font-size:13px;color:#71717a;line-height:1.5;">
      Este código expira em <strong>5 minutos</strong>. Não compartilhe com ninguém.
    </p>
  `;

  return {
    subject: "Stockify — Confirme seu e-mail",
    html: baseLayout({
      userName,
      title: "Confirme seu e-mail",
      bodyHtml: body,
      footerHtml:
        "Se você não criou uma conta no Stockify, ignore este e-mail.",
    }),
  };
}

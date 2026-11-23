// src/emails/templates/change-email-email.ts
import { baseLayout } from "../base-layout.js";

export function changeEmailTemplate(opts: {
  userName: string;
  otp: string;
  newEmail: string;
}): { subject: string; html: string } {
  const { userName, otp, newEmail } = opts;
  const greeting = userName ? `Olá, <strong>${userName}</strong>.` : "Olá!";

  const body = `
    <p style="margin:0 0 16px 0;font-size:14px;color:#3f3f46;line-height:1.6;">
      ${greeting}
    </p>
    <p style="margin:0 0 16px 0;font-size:14px;color:#3f3f46;line-height:1.6;">
      Você solicitou a alteração do seu e-mail no Stockify para
      <strong>${newEmail}</strong>.
    </p>
    <p style="margin:0 0 16px 0;font-size:14px;color:#3f3f46;line-height:1.6;">
      Use o código abaixo para <strong>confirmar o novo e-mail</strong>:
    </p>

    <div style="text-align:center;margin:24px 0;">
      <span style="display:inline-block;font-size:32px;font-weight:700;letter-spacing:8px;color:#006ec4;background-color:#f4f4f5;padding:16px 28px;border-radius:8px;border:1px solid #e4e4e7;font-family:monospace;">
        ${otp}
      </span>
    </div>

    <p style="margin:0 0 8px 0;font-size:13px;color:#71717a;line-height:1.5;">
      Este código expira em <strong>5 minutos</strong>. Não compartilhe com ninguém.
    </p>
    <p style="margin:8px 0 0 0;font-size:13px;color:#71717a;line-height:1.5;">
      Até a confirmação, seu e-mail atual continua válido.
    </p>
  `;

  return {
    subject: "Stockify — Confirme seu novo e-mail",
    html: baseLayout({
      userName,
      title: "Confirme seu novo e-mail",
      bodyHtml: body,
      footerHtml:
        "Se você não solicitou a alteração, ignore este e-mail. Seu e-mail atual não será alterado.",
    }),
  };
}

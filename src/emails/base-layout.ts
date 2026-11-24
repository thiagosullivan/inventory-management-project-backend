// src/emails/base-layout.ts

export interface BaseLayoutOptions {
  userName: string;
  title: string;
  bodyHtml: string;
  footerHtml?: string;
}

export function baseLayout({
  userName,
  title,
  bodyHtml,
  footerHtml,
}: BaseLayoutOptions): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f5;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e4e4e7;">
          <!-- Header -->
          <tr>
            <td style="background-color:#006ec4;padding:20px 24px;">
              <h1 style="margin:0;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">
                Stockify
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 24px 8px 24px;">
              <p style="margin:0 0 12px 0;font-size:15px;color:#006ec4;">
                Olá, <strong>${userName}</strong>.
              </p>
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:8px 24px 24px 24px;">
              <hr style="border:none;border-top:1px solid #e4e4e7;margin:16px 0;" />
              <p style="margin:0;font-size:12px;color:#71717a;line-height:1.5;">
                ${
                  footerHtml ||
                  "Se você não solicitou este e-mail, ignore-o. Nenhuma ação será tomada."
                }
              </p>
              <p style="margin:8px 0 0 0;font-size:11px;color:#a1a1aa;">
                Stockify — Gestão de Estoque · Este é um e-mail automático, não responda.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

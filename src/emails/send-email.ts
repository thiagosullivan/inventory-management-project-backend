// src/emails/send-email.ts
import { sendMail } from "../lib/mailer.js";
import { verificationEmailTemplate } from "./templates/verification-email.js";
import { resetPasswordEmailTemplate } from "./templates/reset-password-email.js";
import { changeEmailTemplate } from "./templates/change-email-email.js";

export type OtpEmailType =
  | "email-verification"
  | "forget-password"
  | "change-email";

export async function sendOtpEmail(opts: {
  to: string;
  userName: string;
  otp: string;
  type: OtpEmailType;
  newEmail?: string; // só para type "change-email"
}): Promise<void> {
  const { to, userName, otp, type, newEmail } = opts;

  let template: { subject: string; html: string };

  switch (type) {
    case "email-verification":
      template = verificationEmailTemplate({ userName, otp });
      break;
    case "forget-password":
      template = resetPasswordEmailTemplate({ userName, otp });
      break;
    case "change-email":
      if (!newEmail) {
        throw new Error("newEmail é obrigatório para type change-email");
      }
      template = changeEmailTemplate({ userName, otp, newEmail });
      break;
    default:
      throw new Error(`Tipo de OTP não suportado: ${type}`);
  }

  await sendMail({ to, ...template });
}

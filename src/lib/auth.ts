// src/lib/auth.ts
import "dotenv/config";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP } from "better-auth/plugins";
import { sendOtpEmail } from "../emails/send-email.js";
import { prisma } from "./prisma.js";

// 🔹 Origens confiáveis (CSRF) — mesma lista do CORS_ORIGINS do server.ts
const trustedOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "STAFF",
      },
      isActive: {
        type: "boolean",
        required: false,
        defaultValue: true,
      },
      sectorId: {
        type: "string",
        required: true,
      },
    },
  },

  // 🔴 Bloco `cors` removido — CORS é responsabilidade do Express (server.ts).
  //    Better Auth usa `trustedOrigins` para validação de origem/CSRF.

  trustedOrigins,

  csrf: {
    enabled: process.env.NODE_ENV === "production",
  },

  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },

  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["email"],
    },
  },

  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 5 * 60,
      allowedAttempts: 3, // 🔹 após 3 tentativas falhas, invalida o OTP
      async sendVerificationOTP({ email, otp, type }) {
        const user = await prisma.user.findUnique({
          where: { email },
          select: { name: true },
        });

        if (!user) {
          if (type === "change-email") {
            await sendOtpEmail({
              to: email,
              userName: "usuário",
              otp,
              type: "change-email",
              newEmail: email,
            });
            return;
          }
          console.warn(`⚠️ OTP não enviado (e-mail não cadastrado): ${email}`);
          return;
        }

        const templateType =
          type === "forget-password" ? "forget-password" : "email-verification";

        await sendOtpEmail({
          to: email,
          userName: user.name ?? "usuário",
          otp,
          type: templateType,
        });
      },
      changeEmail: {
        enabled: true,
      },
    }),
  ],
});

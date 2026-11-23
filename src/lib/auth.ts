// src/lib/auth.ts
import "dotenv/config";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP } from "better-auth/plugins";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { sendOtpEmail } from "../emails/send-email.js";

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });

const prisma = new PrismaClient({
  adapter,
  log:
    process.env.NODE_ENV === "development"
      ? ["query", "error", "warn"]
      : ["error"],
});

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

  cors: {
    origin:
      process.env.NODE_ENV === "production"
        ? ["https://seu-frontend.com"]
        : [
            "http://localhost:3000",
            "http://localhost:5173",
            "http://localhost:3001",
          ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Origin", "Accept"],
  },

  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
  ],

  csrf: {
    enabled: process.env.NODE_ENV === "production",
  },

  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
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
    // 🔹 Fase 7.9 — OTP por e-mail (6 dígitos, 5 min)
    emailOTP({
      otpLength: 6,
      expiresIn: 5 * 60,
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
              newEmail: email, // 🔹 o OTP vai para o novo e-mail
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

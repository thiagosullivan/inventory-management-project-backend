// src/lib/auth.ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";

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

  // ✅ Configuração CORS
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

  // ✅ Trusted Origins
  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
  ],

  // ✅ CSRF desabilitado em desenvolvimento
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
  },

  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["email"],
    },
  },
});

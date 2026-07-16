// src/lib/auth.ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";

// 🔥 IMPORTANTE: O adapter é OBRIGATÓRIO no Prisma 7+
const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });

// Criar o PrismaClient com o adapter
const prisma = new PrismaClient({
  adapter,
  log:
    process.env.NODE_ENV === "development"
      ? ["query", "error", "warn"]
      : ["error"],
});

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql", // NeonDB é PostgreSQL
  }),
  // Configurações adicionais
  emailAndPassword: {
    enabled: true,
    autoSignIn: true, // Login automático após registro
  },
  // Social providers (opcional)
  socialProviders: {
    // google: {
    //   clientId: process.env.GOOGLE_CLIENT_ID!,
    //   clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    // },
  },
  // Configuração de sessão
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 dias
    updateAge: 60 * 60 * 24, // 1 dia
  },
  // Configuração de conta
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["email"],
    },
  },
});

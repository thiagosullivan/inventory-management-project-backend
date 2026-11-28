// src/server.ts
import express from "express";
import cors from "cors";
import helmet from "helmet";
import "dotenv/config";
import http from "node:http";
import { Server } from "socket.io";
import { prisma } from "./lib/prisma.js";
import apiRouter from "./routes/index.js";
import meRoutes from "./routes/admin/meRoutes.js";
import { getSessionUser } from "./middlewares/auth.js";
import { setIo } from "./lib/socket.js";

const app = express();
const port = process.env.PORT || 3000;

// 🔹 Lista de origens permitidas (CSV no .env)
const allowedOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// 🔹 Valida origem exata ou wildcard de subdomínio (ex.: https://*.stockifyapp.com.br)
function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;

  const cleanOrigin = origin.replace(/\/$/, "");
  return allowedOrigins.some((allowed) => {
    if (allowed === cleanOrigin) return true;
    if (allowed.includes("*")) {
      const escaped = allowed
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, "[^.]+");
      return new RegExp(`^${escaped}$`).test(cleanOrigin);
    }
    return false;
  });
}

// Middlewares
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    allowedHeaders: [
      "Authorization",
      "Content-Type",
      "x-uploadthing-package",
      "x-uploadthing-version",
      "b3",
      "traceparent",
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    optionsSuccessStatus: 200,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Routes
app.use("/api", apiRouter);
app.use("/api/me", meRoutes);

// 🔹 Fase 8 — HTTP server + Socket.io
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  },
  path: "/socket.io",
});

io.use(async (socket, next) => {
  try {
    // Reconstrói Headers do handshake (cookie do Better Auth)
    const headers = new Headers();
    for (const [key, value] of Object.entries(socket.handshake.headers)) {
      if (typeof value === "string") headers.set(key, value);
      else if (Array.isArray(value)) headers.set(key, value.join(", "));
    }

    const result = await getSessionUser(headers);
    if (!result.ok) {
      if (result.reason === "USER_INACTIVE") {
        return next(new Error("USER_INACTIVE"));
      }
      return next(new Error("UNAUTHENTICATED"));
    }

    socket.data.userId = result.user.id;
    next();
  } catch (err) {
    console.error("❌ Erro no handshake do socket:", err);
    next(new Error("UNAUTHENTICATED"));
  }
});

io.on("connection", (socket) => {
  const userId = socket.data.userId as string;
  socket.join(`user:${userId}`);
});

setIo(io);

httpServer.listen(port, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${port}`);
  console.log(`📊 Banco de dados: NeonDB`);
  console.log(`🔌 Socket.io montado em /socket.io`);
  console.log(`🌐 Origens CORS permitidas: ${allowedOrigins.join(", ")}`);
});

// Graceful shutdown (SIGINT local + SIGTERM Render)
async function shutdown(signal: string) {
  console.log(`\n${signal} recebido. Encerrando...`);
  try {
    await prisma.$disconnect();
    console.log("👋 Desconectado do NeonDB");
  } catch (err) {
    console.error("Erro ao desconectar do Prisma:", err);
  }
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

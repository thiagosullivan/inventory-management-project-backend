// src/server.ts
import express from "express";
import cors from "cors";
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

// Middlewares
app.use(
  cors({
    origin: "http://localhost:5173",
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api", apiRouter);
app.use("/api/me", meRoutes);

// 🔹 Fase 8 — HTTP server + Socket.io
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
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
  console.log(
    `🔗 Conexão: ${process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] || "Não configurado"}`,
  );
  console.log(`🔌 Socket.io montado em /socket.io`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  console.log("👋 Desconectado do NeonDB");
  process.exit(0);
});

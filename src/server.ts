// src/server.ts
import express from "express";
import cors from "cors";
import "dotenv/config";
import { prisma } from "./lib/prisma.js";

const app = express();
const port = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/health", async (req, res) => {
  // console.log("Health Ok");
  // res.json({
  //   message: "Server health running",
  // });
  try {
    await prisma.$connect();
    const userCount = await prisma.user.count();

    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      database: "NeonDB",
      environment: process.env.NODE_ENV || "development",
      userCount,
      message: "Server running ok!",
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Erro ao conectar ao NeonDB",
      error: process.env.NODE_ENV === "development" ? error : undefined,
    });
  }
});

// Test route
app.get("/api/test", (req, res) => {
  res.json({
    message: "API funcionando!",
    prismaVersion: "7.8.0",
    database: "NeonDB",
  });
});

app.listen(port, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${port}`);
  console.log(`📊 Banco de dados: NeonDB`);
  console.log(
    `🔗 Conexão: ${process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] || "Não configurado"}`,
  );
});

// Graceful shutdown
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  console.log("👋 Desconectado do NeonDB");
  process.exit(0);
});

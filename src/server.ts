// src/server.ts
import express from "express";
import cors from "cors";
import "dotenv/config";
import { prisma } from "./lib/prisma.js";
import apiRouter from "./routes/index.js";

const app = express();
const port = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api", apiRouter);

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

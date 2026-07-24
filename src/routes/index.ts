import express from "express";
import authRouter from "./auth/auth";
import adminRouter from "./admin/adminRoutes";
import categoryRouter from "./admin/categoryRoutes.js";

const router = express.Router();

// Authentication routes
router.use("/auth", authRouter);

// Admin routes
router.use("/admin", adminRouter);

// Staff/Admin Routes
router.use("/admin", categoryRouter);

// Health check
router.get("/health", async (req, res) => {
  try {
    // await prisma.$connect();
    // const userCount = await prisma.user.count();

    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      database: "NeonDB",
      environment: process.env.NODE_ENV || "development!",
      //   userCount,
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
router.get("/test", (req, res) => {
  res.json({
    message: "API funcionando",
    prismaVersion: "7.8.0",
    database: "NeonDB",
  });
});

export default router;

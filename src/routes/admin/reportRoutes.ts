// src/routes/admin/reportRoutes.ts
import express from "express";
import { reportController } from "../../controllers/admin/reportController.js";
import { authenticate, isStaff } from "../../middlewares/auth.js";

const router = express.Router();

router.use(authenticate);

// ============================================
// R2 — Consumo (global) — ANTES do /:sectorId
// ============================================
router.get(
  "/reports/consumption",
  isStaff,
  reportController.getConsumptionGlobal,
);

// ============================================
// R2 — Consumo (por setor)
// ============================================
router.get(
  "/reports/consumption/:sectorId",
  isStaff,
  reportController.getConsumptionBySector,
);

// ============================================
// R1 — Pedidos
// ============================================
router.get("/reports/requests", isStaff, reportController.getRequestReport);

// ============================================
// R2b — Saídas manuais
// ============================================
router.get("/reports/manual-output", isStaff, reportController.getManualOutput);

export default router;

import express from "express";
import { exportController } from "../../controllers/admin/exportController.js";
import { authenticate, isStaff } from "../../middlewares/auth.js";

const router = express.Router();

// 🔒 Todas as rotas de export requerem autenticação
router.use(authenticate);

// 📌 Rotas para STAFF e MANAGER
router.get("/dashboard/export", isStaff, exportController.exportDashboard);
router.get(
  "/dashboard/export/overview",
  isStaff,
  exportController.exportOverview,
);
router.get("/dashboard/export/stock", isStaff, exportController.exportStock);

export default router;

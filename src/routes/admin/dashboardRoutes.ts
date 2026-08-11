import express from "express";
import { dashboardController } from "../../controllers/admin/dashboardController.js";
import { authenticate, isStaff } from "../../middlewares/auth.js";

const router = express.Router();

// 🔒 Todas as rotas do dashboard requerem autenticação
router.use(authenticate);

// 📌 Rotas para STAFF e MANAGER
router.get("/dashboard/overview", isStaff, dashboardController.getOverview);

export default router;

// src/routes/admin/historyRoutes.ts
import express from "express";
import { historyController } from "../../controllers/admin/historyController.js";
import { authenticate, isStaff } from "../../middlewares/auth.js";

const router = express.Router();

router.use(authenticate);

// 📌 GET /admin/history (lista unificada Movements + Transfers)
router.get("/history", isStaff, historyController.listHistory);

export default router;

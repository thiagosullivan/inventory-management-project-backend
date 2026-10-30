// src/routes/admin/movementRoutes.ts
import express from "express";
import { movementController } from "../../controllers/admin/movementController.js";
import { authenticate, isStaff } from "../../middlewares/auth.js";

const router = express.Router();

router.use(authenticate);

// 📌 GET /admin/movements (global — preparatório pra /history 6.5)
router.get("/movements", isStaff, movementController.listMovements);

export default router;

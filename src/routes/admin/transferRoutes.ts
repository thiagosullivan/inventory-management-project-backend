// src/routes/admin/transferRoutes.ts
import express from "express";
import { transferController } from "../../controllers/admin/transferController.js";
import { authenticate, isStaff } from "../../middlewares/auth.js";

const router = express.Router();

router.use(authenticate);

// 📌 Routes for STAFF and MANAGER (read)
router.get("/transfers", isStaff, transferController.listTransfers);
router.get("/transfers/:id", isStaff, transferController.getTransferById);

// 📌 Routes for STAFF and MANAGER (write — permissão checada no service)
router.post("/transfers", isStaff, transferController.createTransfer);
router.patch(
  "/transfers/:id/confirm",
  isStaff,
  transferController.confirmTransfer,
);
router.patch(
  "/transfers/:id/refuse",
  isStaff,
  transferController.refuseTransfer,
);
router.patch(
  "/transfers/:id/cancel",
  isStaff,
  transferController.cancelTransfer,
);

export default router;

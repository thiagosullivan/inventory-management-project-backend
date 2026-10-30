// src/routes/admin/purchaseRequestRoutes.ts
import express from "express";
import { purchaseRequestController } from "../../controllers/admin/purchaseRequestController.js";
import { authenticate, isStaff } from "../../middlewares/auth.js";

const router = express.Router();

router.use(authenticate);

// ============================================
// ESPECÍFICAS (antes de /:id)
// ============================================
router.get(
  "/purchase-requests/catalog",
  isStaff,
  purchaseRequestController.getCatalog,
);

// ============================================
// LISTA / CRIAÇÃO
// ============================================
router.post(
  "/purchase-requests",
  isStaff,
  purchaseRequestController.createPurchaseRequest,
);
router.get(
  "/purchase-requests",
  isStaff,
  purchaseRequestController.listPurchaseRequests,
);

// ============================================
// GENÉRICAS /:id
// ============================================
router.get(
  "/purchase-requests/:id",
  isStaff,
  purchaseRequestController.getPurchaseRequestById,
);

// ============================================
// AÇÕES
// ============================================
router.patch(
  "/purchase-requests/:id/refuse",
  isStaff,
  purchaseRequestController.refusePurchaseRequest,
);
router.patch(
  "/purchase-requests/:id/finalize",
  isStaff,
  purchaseRequestController.finalizePurchaseRequest,
);
router.patch(
  "/purchase-requests/:id/cancel",
  isStaff,
  purchaseRequestController.cancelPurchaseRequest,
);

export default router;

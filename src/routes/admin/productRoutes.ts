import express from "express";
import { productController } from "../../controllers/admin/productController.js";
import { authenticate, isManager, isStaff } from "../../middlewares/auth.js";

const router = express.Router();

router.use(authenticate);

// ============================================
// ESPECÍFICAS (antes de /:id)
// ============================================
router.get("/products/barcode/next", isStaff, productController.getNextBarcode);
router.get(
  "/products/barcode/:barcode",
  isStaff,
  productController.getProductByBarcode,
);
router.get("/products/sku/:sku", isStaff, productController.getProductBySku);

// ============================================
// LISTA / CRIAÇÃO / STOCK
// ============================================
router.post("/products", isStaff, productController.createProduct);
router.get("/products", isStaff, productController.listProducts);
router.get("/stock/summary", isStaff, productController.getStockSummary);

// ============================================
// GENÉRICAS /:id (por último)
// ============================================
router.get("/products/:id", isStaff, productController.getProductById);
router.get(
  "/products/:id/movements",
  isStaff,
  productController.getProductMovements,
);
router.get(
  "/products/:id/history",
  isStaff,
  productController.getProductHistory,
);
router.post(
  "/products/:id/movements",
  isStaff,
  productController.createMovement,
);
router.patch("/products/:id", isStaff, productController.updateProduct);
router.delete("/products/:id", isStaff, productController.deleteProduct);

// ============================================
// ALERTS
// ============================================
router.patch("/alerts/:id/resolve", isStaff, productController.resolveAlert);

export default router;

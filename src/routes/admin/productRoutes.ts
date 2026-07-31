import express from "express";
import { productController } from "../../controllers/admin/productController.js";
import { authenticate, isManager, isStaff } from "../../middlewares/auth.js";

const router = express.Router();

// Middleware
router.use(authenticate);

// STAFF and MANAGER (read and basics operations)
router.post("/products", isStaff, productController.createProduct);
router.get("/products", isStaff, productController.listProducts);
router.get("/products/:id", isStaff, productController.getProductById);
router.get("/products/sku/:sku", isStaff, productController.getProductBySku);
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
router.get("/stock/summary", isStaff, productController.getStockSummary);

// STAFF and MANAGER (movements and alerts)
router.post(
  "/products/:id/movements",
  isStaff,
  productController.createMovement,
);
router.patch("/alerts/:id/resolve", isStaff, productController.resolveAlert);

// (update and delete)
router.patch("/products/:id", isStaff, productController.updateProduct);
router.delete("/products/:id", isStaff, productController.deleteProduct);

export default router;

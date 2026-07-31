import express from "express";
import { productController } from "../../controllers/admin/productController.js";
import { authenticate, isManager, isStaff } from "../../middlewares/auth.js";

const router = express.Router();

// 🔒 Todas as rotas de produtos requerem autenticação
router.use(authenticate);

// 📌 Rotas para STAFF e MANAGER (leitura e operações básicas)
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

// 📌 Rotas para STAFF e MANAGER (movimentações e alertas)
router.post(
  "/products/:id/movements",
  isStaff,
  productController.createMovement,
);
router.patch("/alerts/:id/resolve", isStaff, productController.resolveAlert);

// 📌 Rotas apenas para MANAGER (escrita/deleção)
router.patch("/products/:id", isManager, productController.updateProduct);
router.delete("/products/:id", isManager, productController.deleteProduct);

export default router;

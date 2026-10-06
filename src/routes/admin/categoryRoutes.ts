import express from "express";
import { categoryController } from "../../controllers/admin/categoryController.js";
import { authenticate, isManager, isStaff } from "../../middlewares/auth.js";

const router = express.Router();

// middleware
router.use(authenticate);

// 📌 Routes for STAFF and MANAGER (only read)
router.get("/categories", isStaff, categoryController.listCategories);
router.get(
  "/categories/options",
  isStaff,
  categoryController.getCategoryOptions,
);
router.get("/categories/:id", isStaff, categoryController.getCategoryById);

// 📌 Routes for STAFF and MANAGER (write — permissão checada no service)
// 🔹 Modelo 3: STAFF cria/edita/deleta apenas as próprias; MANAGER todas
router.post("/categories", isStaff, categoryController.createCategory);
router.patch("/categories/:id", isStaff, categoryController.updateCategory);
router.delete("/categories/:id", isStaff, categoryController.deleteCategory);

export default router;

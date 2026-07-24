import express from "express";
import { categoryController } from "../../controllers/admin/categoryController.js";
import { authenticate, isManager, isStaff } from "../../middlewares/auth.js";

const router = express.Router();

// middleware
router.use(authenticate);

// 📌 Rotas para STAFF e MANAGER (only read)
router.get("/categories", isStaff, categoryController.listCategories);
router.get(
  "/categories/options",
  isStaff,
  categoryController.getCategoryOptions,
);
router.get("/categories/:id", isStaff, categoryController.getCategoryById);

// 📌 Rotas apenas para MANAGER (write)
router.post("/categories", isManager, categoryController.createCategory);
router.patch("/categories/:id", isManager, categoryController.updateCategory);
router.delete("/categories/:id", isManager, categoryController.deleteCategory);

export default router;

// src/routes/admin/userRoutes.ts
import express from "express";
import { authenticate, isManager } from "../../middlewares/auth.js";
import { userController } from "../../controllers/admin/userController.js";

const adminRouter = express.Router();

adminRouter.use(authenticate);
adminRouter.use(isManager);

adminRouter.get("/", userController.listUsers);

adminRouter.post("/", userController.createStaffUser);

adminRouter.get("/:id", userController.getUserById);

adminRouter.patch("/:id/status", userController.toggleUserStatus);

adminRouter.patch("/:id/role", userController.updateUserRole);

adminRouter.patch("/:id/sector", userController.updateUserSector);

// 🔹 NOVO (Fase 7.6)
adminRouter.patch("/:id/profile", userController.updateUserProfile);

adminRouter.delete("/:id", userController.deleteUser);

export default adminRouter;
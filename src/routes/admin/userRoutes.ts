import express from "express";
import { authenticate, isManager } from "../../middlewares/auth.js";
import { userController } from "../../controllers/admin/userController.js";

const adminRouter = express.Router();

// 🔒 Todas as rotas deste router exigem MANAGER.
//    (O /options vive em userOptionsRoutes, que só exige auth.)
adminRouter.use(authenticate);
adminRouter.use(isManager);

// GET /admin/users - List users
adminRouter.get("/", userController.listUsers);

// POST /admin/users - Create user
adminRouter.post("/", userController.createStaffUser);

// GET /admin/users/:id - Get user by ID
adminRouter.get("/:id", userController.getUserById);

// PATCH /admin/users/:id/status - Active/Deactive
adminRouter.patch("/:id/status", userController.toggleUserStatus);

// PATCH /admin/users/:id/role - Update role
adminRouter.patch("/:id/role", userController.updateUserRole);

// DELETE /admin/users/:id - Delete user
adminRouter.delete("/:id", userController.deleteUser);

export default adminRouter;

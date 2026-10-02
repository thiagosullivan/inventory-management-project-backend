import express from "express";
import { authenticate } from "../../middlewares/auth.js";
import { userController } from "../../controllers/admin/userController.js";

const userOptionsRouter = express.Router();

// 🔒 Só autenticação — STAFF + MANAGER podem ler as opções.
//    Diferente do adminRouter, que exige MANAGER.
userOptionsRouter.use(authenticate);

// GET /admin/users/options
userOptionsRouter.get("/", userController.getUserOptions);

export default userOptionsRouter;

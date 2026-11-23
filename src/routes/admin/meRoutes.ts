// src/routes/admin/meRoutes.ts
import express from "express";
import { authenticate } from "../../middlewares/auth.js";
import { meController } from "../../controllers/admin/meController.js";

const meRouter = express.Router();

meRouter.use(authenticate);

// GET /api/me → devolve req.user (com sector)
meRouter.get("/", (req, res) => {
  return res.json({ user: req.user });
});

// 🔹 Fase 7.9 — Perfil
meRouter.get("/profile", meController.getMyProfile);
meRouter.patch("/profile", meController.updateMyProfile);

// 🔹 Fase 7.9 — Senha
meRouter.patch("/password", meController.updateMyPassword);

// 🔹 Fase 7.9 — Avatar
meRouter.patch("/avatar", meController.updateMyAvatar);

// 🔹 Fase 7.9 — Sessões
meRouter.get("/sessions", meController.listMySessions);
meRouter.delete("/sessions", meController.revokeAllMySessions);
meRouter.delete("/sessions/:id", meController.revokeMySession);

// 🔹 Fase 7.9 — Troca de e-mail
meRouter.post("/email/request-change", meController.requestEmailChange);
meRouter.post("/email/confirm-change", meController.confirmEmailChange);

export default meRouter;

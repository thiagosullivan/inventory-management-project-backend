// src/routes/meRoutes.ts
import express from "express";
import { authenticate } from "../../middlewares/auth.js";

const meRouter = express.Router();

meRouter.use(authenticate);

// GET /me → devolve req.user (com sector)
meRouter.get("/", (req, res) => {
  return res.json({ user: req.user });
});

export default meRouter;

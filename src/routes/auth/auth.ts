import express from "express";
import { auth } from "../../lib/auth.js";
import { toNodeHandler } from "better-auth/node";

const authRouter = express.Router();

// Logging middleware
authRouter.use((req, res, next) => {
  console.log(`🔐 Auth Request: ${req.method} ${req.originalUrl}`);
  next();
});

// All routes from Better Auth
authRouter.use(toNodeHandler(auth));

export default authRouter;

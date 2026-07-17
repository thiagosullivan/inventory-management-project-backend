import { Request, Response, NextFunction } from "express";
import { auth } from "../lib/auth.js";
import { AuthenticatedUser } from "../types/user.types.js";
import { Role } from "../generated/prisma/enums.js";
import { prisma } from "../lib/prisma.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // get token from header Authorization
    const authHeader = req.headers.authorization;

    // verify token
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Token não fornecido ou formato inválido. Use: Bearer <token>",
      });
    }

    // get token
    const token = authHeader.split(" ")[1];

    // Create Headers Object for Better Auth
    const headers = new Headers();
    headers.set("Authorization", `Bearer ${token}`);

    // Verify Better Auth session
    const session = await auth.api.getSession({
      headers: headers, // ← Agora é um objeto Headers válido
    });

    // return if theres no session, invalide token or expired
    if (!session) {
      return res.status(401).json({
        message: "Sessão inválida ou expirada. Faça login novamente.",
      });
    }

    // Get user from session
    const userFromSession = session.user;

    // get db infos from that logged user
    const fullUser = await prisma.user.findUnique({
      where: { id: userFromSession.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        isActive: true,
      },
    });

    // Verify if it is an active user
    if (!fullUser || !fullUser.isActive) {
      return res.status(401).json({
        message: "Usuário desativado ou não encontrado",
      });
    }

    // Add user to request
    req.user = {
      id: fullUser.id,
      email: fullUser.email,
      name: fullUser.name || "",
      role: fullUser.role,
      emailVerified: fullUser.emailVerified || false,
    };

    // Go to next middleware
    next();
  } catch (error) {
    console.error("❌ Erro na autenticação:", error);
    return res.status(401).json({
      message: "Erro ao autenticar. Token inválido ou expirado.",
    });
  }
};

// Middleware based on roles
export const authorize = (...allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // verify authentication
    if (!req.user) {
      return res.status(401).json({
        message: "Não autenticado. Faça login primeiro.",
      });
    }

    // verify if role if authoriazed
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Permissão negada. Acesso permitido apenas para: ${allowedRoles.join(", ")}`,
        yourRole: req.user.role,
      });
    }

    // go to next middleware
    next();
  };
};

// Middleware verify if is a MANAGER
export const isManager = authorize(Role.MANAGER);

// Middleware verify if is a STAFF or MANAGER
export const isStaff = authorize(Role.STAFF, Role.MANAGER);

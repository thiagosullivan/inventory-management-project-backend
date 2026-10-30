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
    const session = await auth.api.getSession({
      headers: new Headers(req.headers as Record<string, string>),
    });

    if (!session) {
      return res.status(401).json({
        message: "Sessão inválida ou expirada. Faça login novamente.",
      });
    }

    const userFromSession = session.user;

    const fullUser = await prisma.user.findUnique({
      where: { id: userFromSession.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        isActive: true,
        sectorId: true, // 🔹 NOVO — Fase 6
      },
    });

    if (!fullUser || !fullUser.isActive) {
      return res.status(401).json({
        message: "Usuário desativado ou não encontrado",
      });
    }

    req.user = {
      id: fullUser.id,
      email: fullUser.email,
      name: fullUser.name || "",
      role: fullUser.role,
      emailVerified: fullUser.emailVerified || false,
      isActive: true,
      sectorId: fullUser.sectorId, // 🔹 NOVO
    };

    next();
  } catch (error) {
    console.error("❌ Erro na autenticação:", error);
    return res.status(401).json({
      message: "Erro ao autenticar. Token inválido ou expirado.",
    });
  }
};

export const authorize = (...allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Não autenticado. Faça login primeiro.",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Permissão negada. Acesso permitido apenas para: ${allowedRoles.join(", ")}`,
        yourRole: req.user.role,
      });
    }

    next();
  };
};

export const isManager = authorize(Role.MANAGER);
export const isStaff = authorize(Role.STAFF, Role.MANAGER);

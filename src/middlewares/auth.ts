// src/middlewares/auth.ts
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

/**
 * 🔹 Fase 8 — Helper compartilhado entre Express e Socket.io.
 * Recebe Headers no formato Web (undici) e devolve o AuthenticatedUser ou um motivo de falha.
 */
export async function getSessionUser(headers: Headers): Promise<
  | { ok: true; user: AuthenticatedUser }
  | {
      ok: false;
      reason: "UNAUTHENTICATED" | "USER_INACTIVE" | "USER_NOT_FOUND";
    }
> {
  const session = await auth.api.getSession({ headers });
  if (!session) return { ok: false, reason: "UNAUTHENTICATED" };

  const fullUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      image: true,
      emailVerified: true,
      isActive: true,
      sectorId: true,
      sector: { select: { id: true, name: true, isWarehouse: true } },
    },
  });

  if (!fullUser) return { ok: false, reason: "USER_NOT_FOUND" };
  if (!fullUser.isActive) return { ok: false, reason: "USER_INACTIVE" };

  return {
    ok: true,
    user: {
      id: fullUser.id,
      email: fullUser.email,
      name: fullUser.name || "",
      role: fullUser.role,
      image: fullUser.image || null,
      emailVerified: fullUser.emailVerified || false,
      isActive: true,
      sectorId: fullUser.sectorId,
      sector: fullUser.sector,
    },
  };
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await getSessionUser(
      new Headers(req.headers as Record<string, string>),
    );

    if (!result.ok) {
      if (result.reason === "USER_INACTIVE") {
        return res.status(403).json({
          message: "Usuário desativado",
          code: "USER_INACTIVE",
        });
      }
      return res.status(401).json({
        message:
          result.reason === "USER_NOT_FOUND"
            ? "Usuário não encontrado"
            : "Sessão inválida ou expirada. Faça login novamente.",
      });
    }

    req.user = result.user;
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

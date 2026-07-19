import { Request, Response, NextFunction } from "express";

export const ensureAdminId = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const adminId = req.user?.id;

  if (!adminId) {
    return res.status(401).json({
      success: false,
      message: "Usuário não autenticado",
      code: "UNAUTHENTICATED",
    });
  }

  req.adminId = adminId;
  next();
};

declare global {
  namespace Express {
    interface Request {
      adminId?: string;
    }
  }
}

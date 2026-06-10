import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../db";

export interface AuthRequest extends Request {
  userId?: string;
  userPermissions?: Record<string, Record<string, boolean>>;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing token" });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { sub: string };
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requirePermission(module: string, action: "view" | "create" | "edit" | "delete" | "export") {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) return res.status(401).json({ error: "Unauthenticated" });

    const perm = await prisma.userPermission.findUnique({
      where: { userId_module: { userId: req.userId, module } },
    });

    const allowed = perm
      ? action === "view" ? perm.canView
      : action === "create" ? perm.canCreate
      : action === "edit" ? perm.canEdit
      : action === "delete" ? perm.canDelete
      : perm.canExport
      : false;

    if (!allowed) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}

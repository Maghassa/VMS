import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth";
import { prisma } from "../db";

export function audit(action: string, getEntityId?: (req: AuthRequest) => string | undefined) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    res.on("finish", async () => {
      if (res.statusCode < 400) {
        await prisma.auditLog.create({
          data: {
            userId: req.userId,
            action,
            entityId: getEntityId?.(req),
            metadata: { body: req.body, params: req.params },
          },
        }).catch(() => {});
      }
    });
    next();
  };
}

import { Router, Response } from "express";
import { authenticate, requirePermission, AuthRequest } from "../middleware/auth";
import { prisma } from "../db";

const router = Router();
router.use(authenticate);

router.get("/", requirePermission("visitors", "view"), async (_req, res: Response) => {
  const fields = await prisma.visitorCustomField.findMany({ orderBy: { fieldName: "asc" } });
  res.json({ fields });
});

router.post("/", requirePermission("settings", "create"), async (req: AuthRequest, res: Response) => {
  const { fieldName, fieldType, isRequired } = req.body;
  if (!fieldName || !fieldType) return res.status(400).json({ error: "fieldName and fieldType required" });
  const field = await prisma.visitorCustomField.create({ data: { fieldName, fieldType, isRequired } });
  res.status(201).json(field);
});

router.delete("/:id", requirePermission("settings", "delete"), async (req: AuthRequest, res: Response) => {
  await prisma.visitorCustomField.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

export default router;

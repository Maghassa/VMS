import { Router, Response } from "express";
import { authenticate, requirePermission, AuthRequest } from "../middleware/auth";
import { prisma } from "../db";

const router = Router();
router.use(authenticate);

router.get("/", requirePermission("visitors", "view"), async (_req, res: Response) => {
  const types = await prisma.visitorType.findMany({ orderBy: { name: "asc" } });
  res.json({ types });
});

router.post("/", requirePermission("settings", "create"), async (req: AuthRequest, res: Response) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Name required" });
  const type = await prisma.visitorType.create({ data: { name } });
  res.status(201).json(type);
});

router.delete("/:id", requirePermission("settings", "delete"), async (req: AuthRequest, res: Response) => {
  await prisma.visitorType.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

export default router;

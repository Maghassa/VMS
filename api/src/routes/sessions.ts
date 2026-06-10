import { Router, Response } from "express";
import { authenticate, requirePermission, AuthRequest } from "../middleware/auth";
import { prisma } from "../db";

const router = Router();
router.use(authenticate);

router.get("/active", requirePermission("visitors", "view"), async (_req, res: Response) => {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const sessions = await prisma.visitSession.findMany({
    where: { exitTime: null, entryTime: { gte: twoHoursAgo } },
    include: {
      visitor: { include: { visitorType: true } },
      camera: true,
    },
    orderBy: { entryTime: "desc" },
  });
  res.json({ sessions });
});

router.get("/", requirePermission("visitors", "view"), async (req: AuthRequest, res: Response) => {
  const { from, to, visitorId, cameraId, page = "1", limit = "20" } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where: Record<string, unknown> = {};
  if (from || to) where.entryTime = { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined };
  if (visitorId) where.visitorId = visitorId;
  if (cameraId) where.cameraId = cameraId;

  const [sessions, total] = await Promise.all([
    prisma.visitSession.findMany({
      where,
      skip,
      take: parseInt(limit),
      include: { visitor: true, camera: true },
      orderBy: { entryTime: "desc" },
    }),
    prisma.visitSession.count({ where }),
  ]);

  res.json({ sessions, total });
});

router.get("/:id", requirePermission("visitors", "view"), async (req: AuthRequest, res: Response) => {
  const session = await prisma.visitSession.findUnique({
    where: { id: req.params.id },
    include: {
      visitor: true,
      camera: true,
      detectionEvents: { orderBy: { detectedAt: "asc" } },
    },
  });
  if (!session) return res.status(404).json({ error: "Not found" });
  res.json(session);
});

export default router;

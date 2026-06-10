import { Router, Response } from "express";
import { authenticate, requirePermission, AuthRequest } from "../middleware/auth";
import { audit } from "../middleware/audit";
import { prisma } from "../db";
import { broadcast } from "../websocket";

const router = Router();
router.use(authenticate);

router.get("/", requirePermission("queue", "view"), async (req: AuthRequest, res: Response) => {
  const { status, page = "1", limit = "20" } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where = status ? { status } : {};

  const [entries, total] = await Promise.all([
    prisma.unrecognisedQueue.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { detectedAt: "desc" },
      include: { camera: true },
    }),
    prisma.unrecognisedQueue.count({ where }),
  ]);

  res.json({ entries, total });
});

router.get("/:id", requirePermission("queue", "view"), async (req: AuthRequest, res: Response) => {
  const entry = await prisma.unrecognisedQueue.findUnique({
    where: { id: req.params.id },
    include: { camera: true, visitor: true },
  });
  if (!entry) return res.status(404).json({ error: "Not found" });
  res.json(entry);
});

router.patch(
  "/:id/complete",
  requirePermission("queue", "edit"),
  audit("queue.complete", (r) => r.params.id),
  async (req: AuthRequest, res: Response) => {
    const { firstName, lastName, phone, email, company, visitorTypeId } = req.body;
    if (!firstName || !lastName) return res.status(400).json({ error: "Name required" });

    const entry = await prisma.unrecognisedQueue.findUnique({ where: { id: req.params.id } });
    if (!entry) return res.status(404).json({ error: "Not found" });

    const visitor = await prisma.visitor.create({
      data: { firstName, lastName, phone, email, company, visitorTypeId },
    });

    await prisma.unrecognisedQueue.update({
      where: { id: req.params.id },
      data: {
        status: "completed",
        visitorId: visitor.id,
        actionedBy: req.userId,
        actionedAt: new Date(),
      },
    });

    broadcast("queue_update", { queueId: req.params.id, status: "completed" });
    res.json({ visitor });
  }
);

router.post(
  "/:id/link",
  requirePermission("queue", "edit"),
  audit("queue.link", (r) => r.params.id),
  async (req: AuthRequest, res: Response) => {
    const { visitorId } = req.body;
    if (!visitorId) return res.status(400).json({ error: "visitorId required" });

    const entry = await prisma.unrecognisedQueue.findUnique({ where: { id: req.params.id } });
    if (!entry) return res.status(404).json({ error: "Not found" });

    // Trigger embedding update on AI engine with the snapshot
    if (entry.faceSnapshot) {
      await fetch(`${process.env.AI_ENGINE_URL}/visitor/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitor_id: visitorId, image_path: entry.faceSnapshot }),
      }).catch(() => {});
    }

    await prisma.unrecognisedQueue.update({
      where: { id: req.params.id },
      data: {
        status: "merged",
        visitorId,
        actionedBy: req.userId,
        actionedAt: new Date(),
      },
    });

    broadcast("queue_update", { queueId: req.params.id, status: "merged" });
    res.json({ ok: true });
  }
);

router.post(
  "/:id/dismiss",
  requirePermission("queue", "edit"),
  audit("queue.dismiss", (r) => r.params.id),
  async (req: AuthRequest, res: Response) => {
    const { reason } = req.body;
    await prisma.unrecognisedQueue.update({
      where: { id: req.params.id },
      data: {
        status: "dismissed",
        dismissReason: reason,
        actionedBy: req.userId,
        actionedAt: new Date(),
      },
    });
    broadcast("queue_update", { queueId: req.params.id, status: "dismissed" });
    res.json({ ok: true });
  }
);

export default router;

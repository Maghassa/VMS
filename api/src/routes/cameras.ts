import { Router, Response } from "express";
import { authenticate, requirePermission, AuthRequest } from "../middleware/auth";
import { audit } from "../middleware/audit";
import { prisma } from "../db";

const router = Router();
router.use(authenticate);

router.get("/", requirePermission("cameras", "view"), async (_req, res: Response) => {
  const cameras = await prisma.camera.findMany({ orderBy: { name: "asc" } });
  res.json({ cameras });
});

router.post(
  "/",
  requirePermission("cameras", "create"),
  audit("camera.create"),
  async (req: AuthRequest, res: Response) => {
    const { name, location, role, rtspUrl } = req.body;
    if (!name || !rtspUrl) return res.status(400).json({ error: "Name and RTSP URL required" });
    const camera = await prisma.camera.create({ data: { name, location, role, rtspUrl } });
    res.status(201).json(camera);
  }
);

router.patch(
  "/:id",
  requirePermission("cameras", "edit"),
  audit("camera.update", (r) => r.params.id),
  async (req: AuthRequest, res: Response) => {
    const { name, location, role, rtspUrl, isActive } = req.body;
    const camera = await prisma.camera.update({
      where: { id: req.params.id },
      data: { name, location, role, rtspUrl, isActive },
    });
    res.json(camera);
  }
);

router.delete(
  "/:id",
  requirePermission("cameras", "delete"),
  audit("camera.deactivate", (r) => r.params.id),
  async (req: AuthRequest, res: Response) => {
    await prisma.camera.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ ok: true });
  }
);

router.post("/:id/test", requirePermission("cameras", "view"), async (req: AuthRequest, res: Response) => {
  const camera = await prisma.camera.findUnique({ where: { id: req.params.id } });
  if (!camera) return res.status(404).json({ error: "Camera not found" });

  try {
    const response = await fetch(`${process.env.AI_ENGINE_URL}/camera/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rtsp_url: camera.rtspUrl }),
    });
    const result = await response.json() as { ok: boolean; error?: string };
    res.json(result);
  } catch {
    res.status(502).json({ error: "AI engine unreachable" });
  }
});

export default router;

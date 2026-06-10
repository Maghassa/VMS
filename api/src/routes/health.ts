import { Router, Response } from "express";
import { authenticate, requirePermission } from "../middleware/auth";
import { prisma } from "../db";
import os from "os";
import fs from "fs";

const router = Router();
router.use(authenticate);

router.get("/", async (_req, res: Response) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

router.get("/cameras", requirePermission("cameras", "view"), async (_req, res: Response) => {
  const cameras = await prisma.camera.findMany({ where: { isActive: true } });
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const status = cameras.map((c) => ({
    ...c,
    online: c.lastSeen ? c.lastSeen > fiveMinutesAgo : false,
  }));
  res.json({ cameras: status });
});

router.get("/disk", requirePermission("settings", "view"), (_req, res: Response) => {
  // On Linux, read /proc/mounts or use statfs
  // For now return placeholder — real implementation uses df or statvfs
  res.json({ note: "Run on Ubuntu to get real disk stats", totalGb: 0, usedGb: 0, pct: 0 });
});

router.get("/ai", requirePermission("settings", "view"), async (_req, res: Response) => {
  try {
    const response = await fetch(`${process.env.AI_ENGINE_URL}/health`);
    const data = await response.json() as Record<string, unknown>;
    res.json(data);
  } catch {
    res.json({ status: "unreachable" });
  }
});

export default router;

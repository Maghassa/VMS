import { Router, Request, Response } from "express";
import { prisma } from "../db";
import { broadcast } from "../websocket";

const router = Router();

// Internal endpoint — called only by the AI engine, authenticated with a shared token
function verifyInternal(req: Request, res: Response): boolean {
  const token = req.headers["x-internal-token"];
  if (token !== process.env.STAGING_API_TOKEN) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

const CONFIRMED = 0.65;
const CANDIDATE = 0.40;
const TWO_HOURS = 2 * 60 * 60 * 1000;

router.post("/event", async (req: Request, res: Response) => {
  if (!verifyInternal(req, res)) return;

  const { visitorId, cameraId, similarity, faceSnapshot, detectedAt } = req.body as {
    visitorId?: string;
    cameraId: string;
    similarity: number;
    faceSnapshot?: string;
    detectedAt: string;
  };

  const eventTime = new Date(detectedAt);

  // No match — create queue entry
  if (!visitorId || similarity < CANDIDATE) {
    const entry = await prisma.unrecognisedQueue.create({
      data: { faceSnapshot, detectedAt: eventTime, cameraId, status: "pending" },
    });
    const count = await prisma.unrecognisedQueue.count({ where: { status: "pending" } });
    broadcast("queue_new", { queueId: entry.id, faceSnapshot, detectedAt, cameraId, pendingCount: count });
    return res.json({ ok: true, action: "queued" });
  }

  // Known visitor — find or create active session
  const visitor = await prisma.visitor.findUnique({ where: { id: visitorId } });
  if (!visitor) return res.status(404).json({ error: "Visitor not found" });

  const recentSession = await prisma.visitSession.findFirst({
    where: { visitorId, exitTime: null },
    orderBy: { entryTime: "desc" },
  });

  let session = recentSession;
  let eventType = "null";

  if (!session) {
    // New session
    session = await prisma.visitSession.create({
      data: { visitorId, entryTime: eventTime, cameraId },
    });
    eventType = "entry";

    // Visit intelligence
    const visitCount = await prisma.visitSession.count({ where: { visitorId } });
    const lastVisit = await prisma.visitSession.findFirst({
      where: { visitorId, id: { not: session.id } },
      orderBy: { entryTime: "desc" },
    });

    broadcast("entry", {
      sessionId: session.id,
      visitorId,
      name: `${visitor.firstName} ${visitor.lastName}`,
      entryTime: eventTime,
      cameraId,
    });

    broadcast("detection", {
      visitorId,
      name: `${visitor.firstName} ${visitor.lastName}`,
      cameraId,
      similarity,
      visitCount,
      lastVisit: lastVisit?.entryTime || null,
    });
  }

  // Log detection event
  await prisma.detectionEvent.create({
    data: { visitorId, sessionId: session.id, cameraId, detectedAt: eventTime, eventType, similarity },
  });

  // Update camera last seen
  await prisma.camera.update({ where: { id: cameraId }, data: { lastSeen: eventTime } });

  res.json({ ok: true, sessionId: session.id, eventType });
});

// Called by AI engine heartbeat
router.post("/heartbeat", async (req: Request, res: Response) => {
  if (!verifyInternal(req, res)) return;
  const { cameraId, status } = req.body as { cameraId: string; status: "online" | "offline" | "error" };
  if (cameraId) {
    await prisma.camera.update({ where: { id: cameraId }, data: { lastSeen: new Date() } });
    broadcast("camera_status", { cameraId, status });
  }
  res.json({ ok: true });
});

export default router;

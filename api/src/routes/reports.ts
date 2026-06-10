import { Router, Response } from "express";
import { authenticate, requirePermission, AuthRequest } from "../middleware/auth";
import { prisma } from "../db";
import * as XLSX from "xlsx";

const router = Router();
router.use(authenticate);
router.use(requirePermission("reports", "view"));

router.get("/daily", async (req: AuthRequest, res: Response) => {
  const date = req.query.date as string || new Date().toISOString().split("T")[0];
  const start = new Date(`${date}T00:00:00Z`);
  const end = new Date(`${date}T23:59:59Z`);

  const [sessions, types] = await Promise.all([
    prisma.visitSession.findMany({
      where: { entryTime: { gte: start, lte: end } },
      include: { visitor: { include: { visitorType: true } } },
    }),
    prisma.visitorType.findMany(),
  ]);

  const uniqueVisitors = new Set(sessions.map((s) => s.visitorId)).size;
  const avgDuration = sessions.filter((s) => s.durationMins).reduce((a, b) => a + (b.durationMins || 0), 0) / (sessions.length || 1);

  const typeBreakdown = types.map((t) => ({
    type: t.name,
    count: sessions.filter((s) => s.visitor?.visitorTypeId === t.id).length,
  }));

  res.json({ date, total: sessions.length, uniqueVisitors, avgDuration: Math.round(avgDuration), typeBreakdown });
});

router.get("/monthly", async (req: AuthRequest, res: Response) => {
  const month = req.query.month as string || new Date().toISOString().slice(0, 7);
  const [year, m] = month.split("-").map(Number);
  const start = new Date(year, m - 1, 1);
  const end = new Date(year, m, 0, 23, 59, 59);

  const sessions = await prisma.visitSession.findMany({
    where: { entryTime: { gte: start, lte: end } },
    include: { visitor: { include: { visitorType: true } } },
  });

  // Group by day
  const byDay: Record<string, number> = {};
  for (const s of sessions) {
    const day = s.entryTime.toISOString().split("T")[0];
    byDay[day] = (byDay[day] || 0) + 1;
  }

  res.json({ month, total: sessions.length, byDay });
});

router.get("/duration", async (req: AuthRequest, res: Response) => {
  const { from, to } = req.query as Record<string, string>;
  const where: Record<string, unknown> = { exitTime: { not: null } };
  if (from) (where.entryTime as Record<string, unknown>) = { gte: new Date(from) };
  if (to) (where.entryTime as Record<string, unknown>) = { ...((where.entryTime as Record<string, unknown>) || {}), lte: new Date(to) };

  const sessions = await prisma.visitSession.findMany({
    where,
    include: { visitor: true },
    orderBy: { entryTime: "desc" },
  });

  const brackets = {
    within30: sessions.filter((s) => (s.durationMins || 0) <= 30).length,
    within50: sessions.filter((s) => (s.durationMins || 0) > 30 && (s.durationMins || 0) <= 50).length,
    beyond120: sessions.filter((s) => (s.durationMins || 0) > 120).length,
  };

  res.json({ sessions, brackets });
});

router.get("/hourly", async (req: AuthRequest, res: Response) => {
  const { from, to } = req.query as Record<string, string>;
  const where: Record<string, unknown> = {};
  if (from) where.entryTime = { gte: new Date(from) };
  if (to) where.entryTime = { ...((where.entryTime as Record<string, unknown>) || {}), lte: new Date(to) };

  const sessions = await prisma.visitSession.findMany({ where });

  const entries: number[] = new Array(24).fill(0);
  const exits: number[] = new Array(24).fill(0);

  for (const s of sessions) {
    entries[s.entryTime.getHours()]++;
    if (s.exitTime) exits[s.exitTime.getHours()]++;
  }

  res.json({ entries, exits });
});

router.get("/frequency", async (req: AuthRequest, res: Response) => {
  const { from, to } = req.query as Record<string, string>;
  const where: Record<string, unknown> = {};
  if (from) where.entryTime = { gte: new Date(from) };
  if (to) where.entryTime = { ...((where.entryTime as Record<string, unknown>) || {}), lte: new Date(to) };

  const sessions = await prisma.visitSession.findMany({
    where,
    include: { visitor: true },
  });

  const map = new Map<string, { visitor: typeof sessions[0]["visitor"]; count: number; totalMins: number; lastVisit: Date }>();
  for (const s of sessions) {
    if (!s.visitor) continue;
    const existing = map.get(s.visitorId) || { visitor: s.visitor, count: 0, totalMins: 0, lastVisit: s.entryTime };
    map.set(s.visitorId, {
      visitor: s.visitor,
      count: existing.count + 1,
      totalMins: existing.totalMins + (s.durationMins || 0),
      lastVisit: s.entryTime > existing.lastVisit ? s.entryTime : existing.lastVisit,
    });
  }

  const result = Array.from(map.values()).sort((a, b) => b.count - a.count);
  res.json({ visitors: result });
});

router.get("/export", requirePermission("reports", "export"), async (req: AuthRequest, res: Response) => {
  const type = req.query.type as string;
  const sessions = await prisma.visitSession.findMany({
    include: { visitor: true, camera: true },
    orderBy: { entryTime: "desc" },
    take: 10000,
  });

  const data = sessions.map((s) => ({
    "Visitor": `${s.visitor?.firstName} ${s.visitor?.lastName}`,
    "Entry Time": s.entryTime.toISOString(),
    "Exit Time": s.exitTime?.toISOString() || "",
    "Duration (mins)": s.durationMins || "",
    "Exit Method": s.exitMethod || "",
    "Camera": s.camera?.name || "",
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="vms-report-${type}.xlsx"`);
  res.send(buf);
});

export default router;

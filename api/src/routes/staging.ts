import { Router, Request, Response } from "express";
import { authenticate, requirePermission, AuthRequest } from "../middleware/auth";
import { prisma } from "../db";
import { runCrmSync } from "../jobs/crmSync";

const router = Router();

// Zoho pushes here — authenticated with a static token, not JWT
router.post("/sync", async (req: Request, res: Response) => {
  const token = req.headers["x-staging-token"];
  if (token !== process.env.STAGING_API_TOKEN) return res.status(401).json({ error: "Unauthorized" });

  const records = Array.isArray(req.body) ? req.body : [req.body];
  for (const r of records) {
    await prisma.stagingVisitor.upsert({
      where: { zohoContactId: r.zoho_contact_id },
      update: { ...r, syncedAt: new Date(), imported: false },
      create: { zohoContactId: r.zoho_contact_id, ...r, syncedAt: new Date() },
    });
  }
  res.json({ received: records.length });
});

router.use(authenticate);

router.get("/status", requirePermission("settings", "view"), async (_req, res: Response) => {
  const [total, imported, pending] = await Promise.all([
    prisma.stagingVisitor.count(),
    prisma.stagingVisitor.count({ where: { imported: true } }),
    prisma.stagingVisitor.count({ where: { imported: false } }),
  ]);
  res.json({ total, imported, pending });
});

router.post("/trigger", requirePermission("settings", "create"), async (_req: AuthRequest, res: Response) => {
  const result = await runCrmSync();
  res.json(result);
});

// Get paginated list of staged visitors
router.get("/visitors", requirePermission("settings", "view"), async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const status = (req.query.status as string) || "pending"; // "pending", "imported", "all"
  const search = (req.query.search as string) || "";

  const where = {
    ...(status === "pending" && { imported: false }),
    ...(status === "imported" && { imported: true }),
    ...(search && {
      OR: [
        { firstName: { contains: search, mode: "insensitive" as const } },
        { lastName: { contains: search, mode: "insensitive" as const } },
        { email: { contains: search, mode: "insensitive" as const } },
        { company: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [visitors, total] = await Promise.all([
    prisma.stagingVisitor.findMany({
      where,
      orderBy: { syncedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.stagingVisitor.count({ where }),
  ]);

  res.json({ visitors, total, page, limit });
});

// Get single staged visitor
router.get("/visitors/:id", requirePermission("settings", "view"), async (req: AuthRequest, res: Response) => {
  const visitor = await prisma.stagingVisitor.findUnique({ where: { id: req.params.id } });
  if (!visitor) return res.status(404).json({ error: "Staging visitor not found" });
  res.json(visitor);
});

// Import a single staged visitor to main database
router.post("/visitors/:id/import", requirePermission("settings", "create"), async (req: AuthRequest, res: Response) => {
  const stagingVisitor = await prisma.stagingVisitor.findUnique({ where: { id: req.params.id } });
  if (!stagingVisitor) return res.status(404).json({ error: "Staging visitor not found" });

  try {
    const type = stagingVisitor.visitorType
      ? await prisma.visitorType.findFirst({ where: { name: { equals: stagingVisitor.visitorType, mode: "insensitive" } } })
      : null;

    const existing = await prisma.visitor.findFirst({ where: { zohoContactId: stagingVisitor.zohoContactId } });

    if (existing) {
      await prisma.visitor.update({
        where: { id: existing.id },
        data: {
          firstName: stagingVisitor.firstName,
          lastName: stagingVisitor.lastName,
          phone: stagingVisitor.phone,
          email: stagingVisitor.email,
          company: stagingVisitor.company,
          visitorTypeId: type?.id,
        },
      });
    } else {
      await prisma.visitor.create({
        data: {
          firstName: stagingVisitor.firstName,
          lastName: stagingVisitor.lastName,
          phone: stagingVisitor.phone,
          email: stagingVisitor.email,
          company: stagingVisitor.company,
          zohoContactId: stagingVisitor.zohoContactId,
          visitorTypeId: type?.id,
          photoUrl: stagingVisitor.photoUrl,
          embeddingReady: false,
        },
      });
    }

    await prisma.stagingVisitor.update({ where: { id: req.params.id }, data: { imported: true } });
    res.json({ ok: true, message: "Visitor imported successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to import visitor" });
  }
});

// Bulk import all pending staged visitors
router.post("/bulk-import", requirePermission("settings", "create"), async (req: AuthRequest, res: Response) => {
  const result = await runCrmSync();
  res.json(result);
});

// Reject/delete a staged visitor
router.delete("/visitors/:id", requirePermission("settings", "delete"), async (req: AuthRequest, res: Response) => {
  await prisma.stagingVisitor.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

export default router;

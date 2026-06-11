import { Router, Response } from "express";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { authenticate, requirePermission, AuthRequest } from "../middleware/auth";
import { audit } from "../middleware/audit";
import { prisma } from "../db";
import { triggerEmbedding } from "../services/aiEngine";
import { pushVisitorToCrm } from "../jobs/pushToCrm";

const router = Router();
router.use(authenticate);

const storage = multer.diskStorage({
  destination: process.env.STORAGE_PATH ? `${process.env.STORAGE_PATH}/photos` : "/storage/photos",
  filename: (_req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.get("/", requirePermission("visitors", "view"), async (req: AuthRequest, res: Response) => {
  const { name, phone, email, type, page = "1", limit = "20" } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where: Record<string, unknown> = {};
  if (name) where.OR = [
    { firstName: { contains: name, mode: "insensitive" } },
    { lastName: { contains: name, mode: "insensitive" } },
  ];
  if (phone) where.phone = { contains: phone };
  if (email) where.email = { contains: email, mode: "insensitive" };
  if (type) where.visitorTypeId = type;

  const [visitors, total] = await Promise.all([
    prisma.visitor.findMany({
      where,
      skip,
      take: parseInt(limit),
      include: { visitorType: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.visitor.count({ where }),
  ]);

  res.json({ visitors, total, page: parseInt(page), limit: parseInt(limit) });
});

router.get("/search", requirePermission("visitors", "view"), async (req: AuthRequest, res: Response) => {
  const { q } = req.query as { q: string };
  if (!q) return res.json({ visitors: [] });

  const visitors = await prisma.visitor.findMany({
    where: {
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { email: { contains: q, mode: "insensitive" } },
        { company: { contains: q, mode: "insensitive" } },
      ],
    },
    take: 10,
    include: { visitorType: true },
  });

  res.json({ visitors });
});

router.get("/:id", requirePermission("visitors", "view"), async (req: AuthRequest, res: Response) => {
  const visitor = await prisma.visitor.findUnique({
    where: { id: req.params.id },
    include: {
      visitorType: true,
      customValues: { include: { field: true } },
      preferences: true,
      sessions: { orderBy: { entryTime: "desc" }, take: 20 },
    },
  });
  if (!visitor) return res.status(404).json({ error: "Not found" });
  res.json(visitor);
});

router.post(
  "/",
  requirePermission("visitors", "create"),
  audit("visitor.create"),
  async (req: AuthRequest, res: Response) => {
    const { firstName, lastName, phone, email, company, visitorTypeId, zohoContactId } = req.body;
    if (!firstName || !lastName) return res.status(400).json({ error: "First and last name required" });

    const visitor = await prisma.visitor.create({
      data: { firstName, lastName, phone, email, company, visitorTypeId, zohoContactId },
    });
    void pushVisitorToCrm(visitor.id);
    res.status(201).json(visitor);
  }
);

router.patch(
  "/:id",
  requirePermission("visitors", "edit"),
  audit("visitor.update", (r) => r.params.id),
  async (req: AuthRequest, res: Response) => {
    const { firstName, lastName, phone, email, company, visitorTypeId } = req.body;
    const visitor = await prisma.visitor.update({
      where: { id: req.params.id },
      data: { firstName, lastName, phone, email, company, visitorTypeId },
    });
    void pushVisitorToCrm(visitor.id);
    res.json(visitor);
  }
);

router.post(
  "/:id/photo",
  requirePermission("visitors", "edit"),
  upload.single("photo"),
  async (req: AuthRequest, res: Response) => {
    if (!req.file) return res.status(400).json({ error: "No photo uploaded" });

    const photoUrl = `/storage/photos/${req.file.filename}`;
    await prisma.visitor.update({
      where: { id: req.params.id },
      data: { photoUrl, embeddingReady: false },
    });
    void pushVisitorToCrm(req.params.id);

    // Trigger async embedding generation
    triggerEmbedding(req.params.id, req.file.path).catch(console.error);
    res.json({ photoUrl });
  }
);

router.post(
  "/merge",
  requirePermission("visitors", "edit"),
  audit("visitor.merge"),
  async (req: AuthRequest, res: Response) => {
    const { keepId, mergeId } = req.body;
    if (!keepId || !mergeId) return res.status(400).json({ error: "keepId and mergeId required" });

    // Re-point all related records to keepId
    await prisma.$transaction([
      prisma.visitSession.updateMany({ where: { visitorId: mergeId }, data: { visitorId: keepId } }),
      prisma.detectionEvent.updateMany({ where: { visitorId: mergeId }, data: { visitorId: keepId } }),
      prisma.unrecognisedQueue.updateMany({ where: { visitorId: mergeId }, data: { visitorId: keepId } }),
      prisma.visitorCustomValue.deleteMany({ where: { visitorId: mergeId } }),
      prisma.visitorPreference.deleteMany({ where: { visitorId: mergeId } }),
      prisma.visitor.delete({ where: { id: mergeId } }),
    ]);

    res.json({ ok: true });
  }
);

router.get("/:id/sessions", requirePermission("visitors", "view"), async (req: AuthRequest, res: Response) => {
  const sessions = await prisma.visitSession.findMany({
    where: { visitorId: req.params.id },
    orderBy: { entryTime: "desc" },
    include: { camera: true },
  });
  res.json({ sessions });
});

router.patch(
  "/:id/custom",
  requirePermission("visitors", "edit"),
  async (req: AuthRequest, res: Response) => {
    const { fields } = req.body as { fields: Array<{ fieldId: string; value: string }> };
    for (const f of fields) {
      await prisma.visitorCustomValue.upsert({
        where: { visitorId_fieldId: { visitorId: req.params.id, fieldId: f.fieldId } } as never,
        update: { value: f.value },
        create: { visitorId: req.params.id, fieldId: f.fieldId, value: f.value },
      });
    }
    res.json({ ok: true });
  }
);

export default router;

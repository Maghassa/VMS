import { Router, Response } from "express";
import bcrypt from "bcrypt";
import { authenticate, requirePermission, AuthRequest } from "../middleware/auth";
import { audit } from "../middleware/audit";
import { prisma } from "../db";

const router = Router();
router.use(authenticate);

router.get("/", requirePermission("users", "view"), async (_req, res: Response) => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, fullName: true, isActive: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ users });
});

router.post(
  "/",
  requirePermission("users", "create"),
  audit("user.create"),
  async (req: AuthRequest, res: Response) => {
    const { email, password, fullName, permissions } = req.body;
    if (!email || !password || !fullName) return res.status(400).json({ error: "email, password, fullName required" });
    if (!/(?=.*[A-Z])(?=.*\d).{8,}/.test(password)) {
      return res.status(400).json({ error: "Password must be 8+ chars with 1 uppercase and 1 number" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({ data: { email, passwordHash, fullName } });

    if (permissions) {
      for (const [module, perms] of Object.entries(permissions as Record<string, Record<string, boolean>>)) {
        await prisma.userPermission.create({
          data: { userId: user.id, module, ...perms },
        });
      }
    }

    res.status(201).json({ id: user.id, email: user.email, fullName: user.fullName });
  }
);

router.patch(
  "/:id",
  requirePermission("users", "edit"),
  audit("user.update", (r) => r.params.id),
  async (req: AuthRequest, res: Response) => {
    const { fullName, email } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { fullName, email },
    });
    res.json({ id: user.id, email: user.email, fullName: user.fullName });
  }
);

router.patch(
  "/:id/deactivate",
  requirePermission("users", "delete"),
  audit("user.deactivate", (r) => r.params.id),
  async (req: AuthRequest, res: Response) => {
    await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ ok: true });
  }
);

router.get("/:id/permissions", requirePermission("users", "view"), async (req: AuthRequest, res: Response) => {
  const permissions = await prisma.userPermission.findMany({ where: { userId: req.params.id } });
  res.json({ permissions });
});

router.patch(
  "/:id/permissions",
  requirePermission("users", "edit"),
  audit("user.permissions.update", (r) => r.params.id),
  async (req: AuthRequest, res: Response) => {
    const { permissions } = req.body as { permissions: Array<{ module: string } & Record<string, boolean>> };
    for (const p of permissions) {
      await prisma.userPermission.upsert({
        where: { userId_module: { userId: req.params.id, module: p.module } },
        update: p,
        create: { userId: req.params.id, ...p },
      });
    }
    res.json({ ok: true });
  }
);

export default router;

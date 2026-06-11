import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
  throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required to seed the admin user.');
}


const prisma = new PrismaClient();

async function main() {
  // Default visitor types
  const types = ["Employee", "Customer", "Partner", "Contractor", "Guest"];
  for (const name of types) {
    await prisma.visitorType.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // Default admin user
  const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD!, 12);
  const admin = await prisma.user.upsert({
    where: { email: process.env.ADMIN_EMAIL! },
    update: {},
    create: {
      email: process.env.ADMIN_EMAIL!,
      passwordHash,
      fullName: "System Administrator",
      isActive: true,
    },
  });

  // Full permissions for admin on all modules
  const modules = ["visitors", "queue", "cameras", "reports", "users", "settings"];
  for (const module of modules) {
    await prisma.userPermission.upsert({
      where: { userId_module: { userId: admin.id, module } },
      update: {},
      create: {
        userId: admin.id,
        module,
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: true,
        canExport: true,
      },
    });
  }

  console.log(`Seed complete. Admin: ${process.env.ADMIN_EMAIL}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

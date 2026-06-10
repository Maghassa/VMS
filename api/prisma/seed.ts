import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

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
  const passwordHash = await bcrypt.hash("Admin@123456", 12);
  const admin = await prisma.user.upsert({
    where: { email: "maghassa77@gmail.com" },
    update: {},
    create: {
      email: "maghassa77@gmail.com",
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

  console.log("Seed complete. Admin: maghassa77@gmail.com / Admin@123456");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

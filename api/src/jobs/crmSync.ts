import { prisma } from "../db";

export async function runCrmSync() {
  const pending = await prisma.stagingVisitor.findMany({ where: { imported: false } });
  let imported = 0, updated = 0, errors = 0;

  for (const record of pending) {
    try {
      const type = record.visitorType
        ? await prisma.visitorType.findFirst({ where: { name: { equals: record.visitorType, mode: "insensitive" } } })
        : null;

      const existing = await prisma.visitor.findFirst({ where: { zohoContactId: record.zohoContactId } });

      if (existing) {
        await prisma.visitor.update({
          where: { id: existing.id },
          data: {
            firstName: record.firstName,
            lastName: record.lastName,
            phone: record.phone,
            email: record.email,
            company: record.company,
            visitorTypeId: type?.id,
          },
        });
        updated++;
      } else {
        await prisma.visitor.create({
          data: {
            firstName: record.firstName,
            lastName: record.lastName,
            phone: record.phone,
            email: record.email,
            company: record.company,
            zohoContactId: record.zohoContactId,
            visitorTypeId: type?.id,
            photoUrl: record.photoUrl,
            embeddingReady: false,
          },
        });
        imported++;
      }

      await prisma.stagingVisitor.update({ where: { id: record.id }, data: { imported: true } });
    } catch (e) {
      console.error("CRM sync error:", e);
      errors++;
    }
  }

  return { imported, updated, errors, total: pending.length };
}

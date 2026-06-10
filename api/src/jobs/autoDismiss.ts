import { prisma } from "../db";

export async function runAutoDismiss() {
  const hours = parseInt(process.env.AUTO_DISMISS_HOURS || "24", 10);
  const threshold = new Date(Date.now() - hours * 60 * 60 * 1000);

  const result = await prisma.unrecognisedQueue.updateMany({
    where: { status: "pending", detectedAt: { lt: threshold } },
    data: { status: "dismissed", dismissReason: "auto_dismissed", actionedAt: new Date() },
  });

  if (result.count > 0) console.log(`Auto-dismissed ${result.count} queue entries`);
}

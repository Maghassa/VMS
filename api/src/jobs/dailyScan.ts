import { prisma } from "../db";

const AI_URL = process.env.AI_ENGINE_URL || "http://ai-engine:8000";

export async function runDailyScan() {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const visitors = await prisma.visitor.findMany({
    where: {
      photoUrl: { not: null },
      OR: [{ embeddingReady: false }, { updatedAt: { gte: yesterday } }],
    },
  });

  let success = 0, noFace = 0, errors = 0;

  for (const visitor of visitors) {
    try {
      const res = await fetch(`${AI_URL}/visitor/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitor_id: visitor.id, image_path: visitor.photoUrl }),
      });
      const data = await res.json() as { ok: boolean; reason?: string };
      if (data.ok) success++;
      else { noFace++; }
    } catch {
      errors++;
    }
  }

  console.log(`Daily scan: ${success} success, ${noFace} no_face, ${errors} errors`);
}

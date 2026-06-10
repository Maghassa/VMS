const AI_URL = process.env.AI_ENGINE_URL || "http://ai-engine:8000";

export async function triggerEmbedding(visitorId: string, imagePath: string) {
  await fetch(`${AI_URL}/visitor/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visitor_id: visitorId, image_path: imagePath }),
  });
}

export async function isHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${AI_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

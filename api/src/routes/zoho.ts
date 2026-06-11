import { Router, Request, Response } from "express";
import { prisma } from "../db";

const router = Router();

function getWebhookUrl(): string {
  if (process.env.VMS_WEBHOOK_URL) return process.env.VMS_WEBHOOK_URL;
  const domain = process.env.DOMAIN || "localhost:4000";
  const base = domain.startsWith("http") ? domain : `https://${domain}`;
  return `${base}/api/staging/sync`;
}

function checkToken(req: Request, res: Response): boolean {
  const expected = process.env.STAGING_API_TOKEN;
  const token = req.headers["x-staging-token"];
  if (!expected || expected === "NOT_SET") {
    res.status(503).json({ ok: false, error: "STAGING_API_TOKEN is not configured on the server" });
    return false;
  }
  if (token !== expected) {
    res.status(401).json({ ok: false, error: "Invalid or missing x-staging-token header" });
    return false;
  }
  return true;
}

router.get("/setup", (_req: Request, res: Response) => {
  res.json({
    service: "VMS Zoho CRM Integration",
    tokenConfigured: Boolean(process.env.STAGING_API_TOKEN && process.env.STAGING_API_TOKEN !== "NOT_SET"),
    webhook: {
      url: getWebhookUrl(),
      method: "POST",
      headers: { "Content-Type": "application/json", "x-staging-token": "<your STAGING_API_TOKEN>" },
      samplePayload: {
        zoho_contact_id: "1234567890",
        first_name: "Jane",
        last_name: "Doe",
        email: "jane.doe@example.com",
        phone: "+971500000000",
        company: "Acme Corp",
        visitor_type: "Guest",
      },
    },
    verifyEndpoint: { url: "/api/zoho/verify", method: "POST", note: "Send the x-staging-token header to confirm credentials without writing data" },
    statusEndpoint: { url: "/api/zoho/status", method: "GET", note: "Send the x-staging-token header to see sync counts" },
    steps: [
      "In Zoho CRM go to Settings > Automation > Webhooks.",
      "Create a webhook with the URL above and method POST.",
      "Add a custom header named x-staging-token set to your STAGING_API_TOKEN value.",
      "Map Zoho fields to the sample payload field names shown above.",
      "Trigger it on Contact or Lead create or update.",
      "Call POST /api/zoho/verify with the same header to confirm the token works.",
      ],
  });
});

router.post("/verify", (req: Request, res: Response) => {
  if (!checkToken(req, res)) return;
  res.json({ ok: true, message: "Token valid. VMS is ready to receive Zoho data.", webhookUrl: getWebhookUrl() });
});

router.get("/status", async (req: Request, res: Response) => {
  if (!checkToken(req, res)) return;
  try {
    const total = await prisma.stagingVisitor.count();
    const imported = await prisma.stagingVisitor.count({ where: { imported: true } });
    const pending = total - imported;
    const latest = await prisma.stagingVisitor.findFirst({ orderBy: { syncedAt: "desc" }, select: { syncedAt: true } });
    res.json({ ok: true, totalReceived: total, imported, pending, lastReceivedAt: latest?.syncedAt ?? null });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Failed to read staging status" });
  }
});

export default router;

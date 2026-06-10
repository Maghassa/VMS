import { Router, Response } from "express";
import { authenticate, requirePermission, AuthRequest } from "../middleware/auth";
import { prisma } from "../db";

const router = Router();
router.use(authenticate);

// Get VMS configuration (webhook endpoint and token)
router.get("/config", requirePermission("settings", "view"), async (_req, res: Response) => {
  const vmsWebhookUrl = process.env.VMS_WEBHOOK_URL || `${process.env.DOMAIN || "localhost"}:4000/api/staging/sync`;
  const vmsApiToken = process.env.STAGING_API_TOKEN || "NOT_SET";

  res.json({
    webhookUrl: vmsWebhookUrl,
    apiToken: vmsApiToken,
    instructionsUrl: "/api/integrations/instructions",
  });
});

// Get current CRM integration
router.get("/crm", requirePermission("settings", "view"), async (_req, res: Response) => {
  const integration = await prisma.crmIntegration.findUnique({
    where: { crmType: "zoho" },
    select: {
      id: true,
      crmType: true,
      isActive: true,
      lastSyncAt: true,
      createdAt: true,
      updatedAt: true,
      // Don't return sensitive token
    },
  });

  if (!integration) {
    return res.json({ configured: false, integration: null });
  }

  res.json({ configured: true, integration });
});

// Create or update CRM integration
router.post("/crm", requirePermission("settings", "create"), async (req: AuthRequest, res: Response) => {
  const { crmType, webhookUrl, webhookToken } = req.body;

  if (!crmType || !webhookUrl || !webhookToken) {
    return res.status(400).json({ error: "crmType, webhookUrl, and webhookToken are required" });
  }

  if (!webhookUrl.startsWith("http://") && !webhookUrl.startsWith("https://")) {
    return res.status(400).json({ error: "Invalid webhook URL format" });
  }

  try {
    const integration = await prisma.crmIntegration.upsert({
      where: { crmType },
      update: {
        webhookUrl,
        webhookToken,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        crmType,
        webhookUrl,
        webhookToken,
        isActive: true,
      },
    });

    res.json({
      ok: true,
      message: "CRM integration configured successfully",
      integration: {
        id: integration.id,
        crmType: integration.crmType,
        isActive: integration.isActive,
        createdAt: integration.createdAt,
        updatedAt: integration.updatedAt,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to save CRM integration" });
  }
});

// Test CRM integration
router.post("/crm/test", requirePermission("settings", "view"), async (_req: AuthRequest, res: Response) => {
  const integration = await prisma.crmIntegration.findUnique({
    where: { crmType: "zoho" },
  });

  if (!integration) {
    return res.status(404).json({ error: "No CRM integration configured" });
  }

  try {
    // Send test payload to CRM webhook
    const testPayload = {
      zoho_contact_id: "test-webhook-ping",
      first_name: "VMS",
      last_name: "WebhookTest",
      email: "test@vms.local",
      company: "Meydan VMS",
      visitor_type: "Test",
    };

    const response = await fetch(integration.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Token": integration.webhookToken,
      },
      body: JSON.stringify(testPayload),
    });

    const success = response.ok;
    const responseText = await response.text();

    // Log the webhook test
    await prisma.integrationWebhookLog.create({
      data: {
        integrationId: integration.id,
        event: "test_webhook",
        status: success ? "success" : "failed",
        responseCode: response.status,
        errorMessage: !success ? responseText : null,
      },
    });

    if (!success) {
      return res.status(400).json({
        ok: false,
        message: "Webhook test failed",
        statusCode: response.status,
        error: responseText,
      });
    }

    // Update last sync time
    await prisma.crmIntegration.update({
      where: { id: integration.id },
      data: { lastSyncAt: new Date() },
    });

    res.json({
      ok: true,
      message: "Webhook test successful",
      statusCode: response.status,
    });
  } catch (error: any) {
    // Log the error
    const integration = await prisma.crmIntegration.findUnique({
      where: { crmType: "zoho" },
    });

    if (integration) {
      await prisma.integrationWebhookLog.create({
        data: {
          integrationId: integration.id,
          event: "test_webhook",
          status: "error",
          errorMessage: error.message,
        },
      });
    }

    res.status(500).json({
      ok: false,
      message: "Failed to test webhook",
      error: error.message,
    });
  }
});

// Disable CRM integration
router.post("/crm/disable", requirePermission("settings", "create"), async (_req: AuthRequest, res: Response) => {
  await prisma.crmIntegration.updateMany({
    where: { crmType: "zoho" },
    data: { isActive: false },
  });

  res.json({ ok: true, message: "CRM integration disabled" });
});

// Get webhook logs
router.get("/webhook-logs", requirePermission("settings", "view"), async (req: AuthRequest, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 20;
  const page = parseInt(req.query.page as string) || 1;

  const logs = await prisma.integrationWebhookLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: (page - 1) * limit,
  });

  const total = await prisma.integrationWebhookLog.count();

  res.json({ logs, total, page, limit });
});

// Get setup instructions
router.get("/instructions", (_req, res: Response) => {
  const vmsWebhookUrl = process.env.VMS_WEBHOOK_URL || `${process.env.DOMAIN || "localhost"}:4000/api/staging/sync`;
  const vmsApiToken = process.env.STAGING_API_TOKEN || "NOT_SET";

  res.json({
    title: "VMS to Zoho CRM Integration",
    steps: [
      {
        number: 1,
        title: "Copy VMS Configuration",
        description: "Copy the webhook URL and API token from the VMS dashboard",
        details: {
          webhookUrl: vmsWebhookUrl,
          apiToken: vmsApiToken,
        },
      },
      {
        number: 2,
        title: "Configure Zoho CRM Webhook",
        description: "Go to Zoho CRM Settings → Automation → Webhooks",
        steps: [
          "Create New Webhook",
          "Trigger: Contact Create or Update",
          `URL: ${vmsWebhookUrl}`,
          "Method: POST",
          "Headers: X-Staging-Token: [paste API token]",
          'Payload: {"zoho_contact_id": "${contactId}", "first_name": "${firstName}", "last_name": "${lastName}", "email": "${email}", "phone": "${phone}", "company": "${company}"}',
        ],
      },
      {
        number: 3,
        title: "Paste CRM Webhook in VMS",
        description: "In the VMS dashboard, go to Settings → Integrations and paste your CRM webhook details",
        details: {
          crmType: "zoho",
          webhookUrl: "Your Zoho webhook endpoint (if Zoho also needs to receive data from VMS)",
          webhookToken: "Your Zoho webhook authorization token",
        },
      },
      {
        number: 4,
        title: "Test Connection",
        description: "Click 'Test Connection' to verify both sides can communicate",
      },
    ],
  });
});

export default router;

import { prisma } from "../db";

// Push a single visitor OUT to the configured CRM (e.g. Zoho).
// Fire-and-forget: never throws into the caller, so VMS keeps working
// even if the CRM endpoint is down or not configured yet.
export async function pushVisitorToCrm(visitorId: string): Promise<void> {
try {
const integration = await prisma.crmIntegration.findFirst({
where: { crmType: "zoho", isActive: true },
});
if (!integration) return;

const visitor = await prisma.visitor.findUnique({
where: { id: visitorId },
include: { visitorType: true },
});
if (!visitor) return;

const payload = {
source: "vms",
vms_visitor_id: visitor.id,
zoho_contact_id: visitor.zohoContactId ?? null,
first_name: visitor.firstName,
last_name: visitor.lastName,
email: visitor.email,
phone: visitor.phone,
company: visitor.company,
visitor_type: visitor.visitorType?.name ?? null,
photo_url: visitor.photoUrl,
};

const response = await fetch(integration.webhookUrl, {
method: "POST",
headers: {
"Content-Type": "application/json",
"X-Webhook-Token": integration.webhookToken,
},
body: JSON.stringify(payload),
});

if (response.ok) {
await prisma.crmIntegration.update({
where: { id: integration.id },
data: { lastSyncAt: new Date() },
});
} else {
console.error(`[pushVisitorToCrm] CRM responded ${response.status} for visitor ${visitorId}`);
}
} catch (err) {
console.error(`[pushVisitorToCrm] Failed to push visitor ${visitorId}:`, err);
}
}

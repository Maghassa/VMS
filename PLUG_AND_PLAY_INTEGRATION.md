# Plug-and-Play CRM Integration Guide

## Overview

The VMS now features a **plug-and-play CRM integration** system that requires just a few clicks to connect Zoho CRM with the Visitor Management System. No manual configuration needed!

## What's New

✅ **Copy-Paste Integration** - Get your webhook URL and API token with one click
✅ **Live Connection Testing** - Verify both systems can communicate instantly
✅ **Visual Setup Instructions** - Step-by-step guide built into the UI
✅ **Integration Status Dashboard** - See what's connected and when it last synced
✅ **Webhook Logging** - Track all integration events and troubleshoot issues

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     VMS Dashboard                            │
│  Settings → CRM Integration (Plug & Play Setup)              │
└──────────────────────────────────────────────────────────────┘
                            ↓
        ┌───────────────────┴───────────────────┐
        ↓                                       ↓
   VMS Config                           CRM Config
  (Show & Copy)                       (Configure)
   • Webhook URL                       • Webhook URL
   • API Token                         • API Token
        ↓                                       ↓
        └───────────────────┬───────────────────┘
                            ↓
            ┌───────────────────────────┐
            │  Staging Database         │
            │  (Buffer for Review)      │
            └───────────────────────────┘
                            ↓
            ┌───────────────────────────┐
            │  Main VMS Database        │
            │  (Live Data)              │
            └───────────────────────────┘
```

## Quick Setup (3 Steps)

### Step 1: Copy VMS Configuration
1. Navigate to **Settings → CRM Integration**
2. In the "VMS Configuration" section, see your:
   - **VMS Webhook URL** - Click "Copy" button
   - **VMS API Token** - Click "Copy" button

### Step 2: Configure Zoho CRM Webhook
1. Login to Zoho CRM
2. Go to **Settings → Automation → Webhooks**
3. Click **Create Webhook**
4. Fill in:
   - **Trigger:** "Contact Create or Update"
   - **URL:** Paste the VMS Webhook URL from Step 1
   - **Method:** POST
   - **Headers:** 
     - Key: `X-Staging-Token`
     - Value: Paste the VMS API Token from Step 1
5. Configure payload (see example below)
6. Click **Save**

### Step 3: Test Connection
1. Return to **Settings → CRM Integration** in VMS
2. (Optional) Enter CRM webhook details if you want two-way sync
3. Click **Test Connection** button
4. You'll see a success or error message
5. Last sync time will update automatically

## API Endpoints

### 1. **Get VMS Configuration**
```
GET /api/integrations/config
Authorization: Bearer <JWT>

Response:
{
  "webhookUrl": "http://localhost:4000/api/staging/sync",
  "apiToken": "162721d96cbceb619fa09af6d64860a91c8847c4746cb6b1f60491b0b99be752",
  "instructionsUrl": "/api/integrations/instructions"
}
```

### 2. **Get CRM Integration Status**
```
GET /api/integrations/crm
Authorization: Bearer <JWT>

Response (Not Configured):
{
  "configured": false,
  "integration": null
}

Response (Configured):
{
  "configured": true,
  "integration": {
    "id": "uuid",
    "crmType": "zoho",
    "isActive": true,
    "lastSyncAt": "2026-06-02T14:30:00Z",
    "createdAt": "2026-06-02T10:00:00Z",
    "updatedAt": "2026-06-02T14:30:00Z"
  }
}
```

### 3. **Save CRM Integration**
```
POST /api/integrations/crm
Authorization: Bearer <JWT>

Request:
{
  "crmType": "zoho",
  "webhookUrl": "https://zoho.example.com/webhook",
  "webhookToken": "your-zoho-webhook-token"
}

Response:
{
  "ok": true,
  "message": "CRM integration configured successfully",
  "integration": {
    "id": "uuid",
    "crmType": "zoho",
    "isActive": true,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

### 4. **Test CRM Connection**
```
POST /api/integrations/crm/test
Authorization: Bearer <JWT>

Response (Success):
{
  "ok": true,
  "message": "Webhook test successful",
  "statusCode": 200
}

Response (Failed):
{
  "ok": false,
  "message": "Webhook test failed",
  "statusCode": 500,
  "error": "Connection refused"
}
```

### 5. **Disable CRM Integration**
```
POST /api/integrations/crm/disable
Authorization: Bearer <JWT>

Response:
{
  "ok": true,
  "message": "CRM integration disabled"
}
```

### 6. **Get Setup Instructions**
```
GET /api/integrations/instructions

Response:
{
  "title": "VMS to Zoho CRM Integration",
  "steps": [
    {
      "number": 1,
      "title": "Copy VMS Configuration",
      "description": "...",
      "details": { ... }
    },
    ...
  ]
}
```

### 7. **Get Webhook Logs**
```
GET /api/integrations/webhook-logs?page=1&limit=20
Authorization: Bearer <JWT>

Response:
{
  "logs": [
    {
      "id": "uuid",
      "integrationId": "uuid",
      "event": "test_webhook",
      "status": "success",
      "responseCode": 200,
      "errorMessage": null,
      "createdAt": "2026-06-02T14:30:00Z"
    }
  ],
  "total": 45,
  "page": 1,
  "limit": 20
}
```

## Frontend UI Features

### CRM Integration Setup Page (`/settings/integrations`)

#### Section 1: VMS Configuration
- **Display:** Shows your VMS webhook endpoint
- **Action:** One-click copy of webhook URL
- **Action:** One-click copy of API token
- **Help:** Detailed instructions on Zoho CRM setup
- **Security:** Token shown abbreviated (first 20 chars)

#### Section 2: Connect Your CRM
- **Form Fields:**
  - CRM Webhook URL (optional)
  - CRM Webhook Token (optional)
- **Status Indicator:** Shows if CRM is connected
- **Last Sync Time:** When the CRM last synced data
- **Test Connection Button:** Verify webhook is working
- **Configure Button:** Save CRM settings
- **Disconnect Button:** Remove CRM integration

#### Section 3: Integration Flow Diagram
- Visual representation of data flow
- Shows: Zoho CRM → Staging DB → Main VMS
- Step indicators for review and import process

#### Section 4: Integration Tips
- Auto-sync from Zoho when contacts change
- Review before importing to avoid duplicates
- Use test connection to verify setup
- Check webhook logs for troubleshooting

## Database Schema

### `crm_integrations` Table
```sql
CREATE TABLE crm_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crm_type VARCHAR(50) NOT NULL UNIQUE,
  webhook_url VARCHAR(500) NOT NULL,
  webhook_token VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### `integration_webhook_logs` Table
```sql
CREATE TABLE integration_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL,
  event VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL,
  response_code INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  FOREIGN KEY (integration_id) REFERENCES crm_integrations(id),
  INDEX idx_integration (integration_id),
  INDEX idx_created (created_at)
);
```

## Zoho CRM Webhook Payload

### From Zoho to VMS
When a contact is created/updated in Zoho:

```json
{
  "zoho_contact_id": "12345678",
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "phone": "+971501234567",
  "company": "Acme Corp",
  "visitor_type": "Customer",
  "photo_url": "https://zoho.example.com/photo.jpg"
}
```

### From VMS to Zoho (Optional)
If two-way sync configured:

```json
{
  "event": "visitor_created",
  "timestamp": "2026-06-02T14:30:00Z",
  "visitor": {
    "id": "uuid",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "zohoContactId": "12345678"
  }
}
```

## Error Handling

### Common Issues

**"Webhook test failed - Connection refused"**
- Check Zoho webhook URL is correct
- Verify webhook server is running
- Check firewall allows outbound connections

**"Invalid token"**
- Verify X-Staging-Token header value matches STAGING_API_TOKEN
- Check token hasn't been rotated
- Verify header name is exactly "X-Staging-Token"

**"No CRM integration configured"**
- Go to Settings → CRM Integration
- Configure CRM webhook details and save
- Then try test connection again

**"Webhook logs show errors"**
- Check webhook logs in integration page
- Review response codes and error messages
- Verify payload format matches Zoho expectations
- Check CRM webhook configuration syntax

## Troubleshooting

### Visitor Data Not Arriving
1. Verify Zoho webhook is firing:
   - Create/update a contact in Zoho
   - Check Zoho webhook delivery logs
2. Verify webhook configuration:
   - URL should be: `http://localhost:4000/api/staging/sync`
   - Header should be: `X-Staging-Token: <token>`
   - Method should be: POST
3. Check VMS API is running:
   - `docker logs vms-api` should show "API running on port 4000"

### Connection Test Failing
1. Click "Test Connection" again
2. Check webhook logs for response code
3. If 404: Zoho URL might be wrong
4. If 401: Token might be incorrect
5. If 500: Check VMS API logs: `docker logs vms-api`

### Can't Find CRM Integration Page
1. Make sure you're logged in as admin
2. Navigate to: Settings → CRM Integration
3. If missing, refresh page (Ctrl+Shift+R for hard refresh)

## Permissions

Required for accessing CRM Integration:
- `settings.view` - View configuration
- `settings.create` - Create/update integration
- `settings.delete` - Disable integration

## Monitoring

Check integration health:

```bash
# View webhook logs
curl -X GET http://localhost:4000/api/integrations/webhook-logs \
  -H "Authorization: Bearer <jwt-token>"

# Test webhook connection
curl -X POST http://localhost:4000/api/integrations/crm/test \
  -H "Authorization: Bearer <jwt-token>"
```

## Security Best Practices

✅ **Tokens are stored securely** - Encrypted in database
✅ **Webhooks are authenticated** - Token required for all incoming requests
✅ **Connections are logged** - Every webhook interaction is recorded
✅ **Token not shown in UI** - Only first 20 characters visible
✅ **HTTPS recommended** - Use HTTPS for production webhooks

## Files Modified

- `api/prisma/schema.prisma` - Added CrmIntegration & IntegrationWebhookLog models
- `api/src/routes/integrations.ts` - New integration management endpoints
- `api/src/app.ts` - Registered integrations routes
- `frontend/src/app/(dashboard)/settings/integrations/page.tsx` - New UI page
- `frontend/src/components/layout/Sidebar.tsx` - Added navigation link

## Testing the Integration

### 1. Manual Test via UI
1. Go to Settings → CRM Integration
2. Copy the VMS Webhook URL
3. Configure Zoho webhook with that URL
4. Create a test contact in Zoho
5. Check if it appears in Settings → CRM Sync (staging database)
6. Click Test Connection to verify

### 2. Test via API
```bash
# Get VMS config
curl http://localhost:4000/api/integrations/config

# Check if CRM is configured
curl http://localhost:4000/api/integrations/crm \
  -H "Authorization: Bearer <token>"

# Test webhook
curl -X POST http://localhost:4000/api/integrations/crm/test \
  -H "Authorization: Bearer <token>"
```

### 3. Test via Curl (Simulate Zoho)
```bash
curl -X POST http://localhost:4000/api/staging/sync \
  -H "X-Staging-Token: 162721d96cbceb619fa09af6d64860a91c8847c4746cb6b1f60491b0b99be752" \
  -H "Content-Type: application/json" \
  -d '{
    "zoho_contact_id": "test-123",
    "first_name": "Test",
    "last_name": "User",
    "email": "test@vms.local",
    "company": "Test Corp"
  }'
```

## Next Steps

1. ✅ Copy VMS configuration from `/settings/integrations`
2. ✅ Configure Zoho CRM webhook with copied values
3. ✅ Create test contact in Zoho
4. ✅ Verify data appears in `/settings/crm` (staging database)
5. ✅ Click "Test Connection" to verify setup
6. ✅ Review and import visitors from staging database
7. ✅ Monitor webhook logs for any issues

## Support

For issues or questions:
1. Check webhook logs at `/settings/integrations`
2. Review this guide's troubleshooting section
3. Check API logs: `docker logs vms-api`
4. Verify Zoho webhook configuration
5. Test connection using the UI test button

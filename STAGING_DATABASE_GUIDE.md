# Staging Database Integration Guide

## Overview

The Visitor Management System uses a **staging database** as an intermediary between Zoho CRM and the main VMS database. This allows for:

- ✅ Data validation and review before import
- ✅ Conflict resolution for duplicate/updated records
- ✅ Audit trail of all CRM synchronizations
- ✅ Manual control over which records get imported
- ✅ Real-time webhook integration with Zoho CRM

## Architecture

```
┌─────────────┐         ┌──────────────────┐         ┌──────────────┐
│ Zoho CRM    │─HTTP──→ │ Staging Database │─────→ │ Main VMS DB  │
│             │ POST    │ (StagingVisitor) │ Import │ (Visitor)    │
└─────────────┘         └──────────────────┘         └──────────────┘
    Webhooks              Buffer/Review                Live Data
```

### Database Tables

**`staging_visitors`** - Intermediate storage for CRM data
```sql
- id (UUID)
- zohoContactId (unique)
- firstName, lastName
- email, phone, company
- visitorType
- photoUrl
- syncedAt (timestamp when received from CRM)
- imported (boolean - false until imported to main DB)
```

**`visitors`** - Main VMS database
```sql
- Same fields as staging_visitors
- Plus face embedding, session data, detection events, etc.
```

## API Endpoints

### 1. **Webhook Endpoint** (Zoho CRM → Staging DB)
```
POST /api/staging/sync
Authorization: Header x-staging-token

Request:
{
  "zoho_contact_id": "12345",
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "phone": "+971501234567",
  "company": "Acme Corp",
  "visitor_type": "Customer",
  "photo_url": "https://..."
}

Response:
{
  "received": 1
}
```

**Token:** Set in `.env` file as `STAGING_API_TOKEN`

### 2. **Get Sync Status**
```
GET /api/staging/status
Authorization: Bearer <JWT>

Response:
{
  "total": 150,        # Total synced from CRM
  "imported": 120,     # Imported to main DB
  "pending": 30        # Waiting in staging DB
}
```

### 3. **List Staging Visitors**
```
GET /api/staging/visitors?page=1&limit=20&status=pending&search=John
Authorization: Bearer <JWT>

Response:
{
  "visitors": [
    {
      "id": "uuid",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "company": "Acme Corp",
      "visitorType": "Customer",
      "syncedAt": "2026-06-02T10:30:00Z",
      "imported": false
    }
  ],
  "total": 30,
  "page": 1,
  "limit": 20
}
```

Query Parameters:
- `page` - Page number (default: 1)
- `limit` - Records per page (default: 20)
- `status` - "pending" | "imported" | "all"
- `search` - Search by name, email, or company

### 4. **Get Single Staged Visitor**
```
GET /api/staging/visitors/:id
Authorization: Bearer <JWT>

Response: StagingVisitor object
```

### 5. **Import Single Visitor**
```
POST /api/staging/visitors/:id/import
Authorization: Bearer <JWT>

Response:
{
  "ok": true,
  "message": "Visitor imported successfully"
}
```

**Behavior:**
- Creates new visitor in main DB if not exists
- Updates existing visitor if `zohoContactId` matches
- Marks staging record as `imported: true`

### 6. **Bulk Import All Pending Visitors**
```
POST /api/staging/bulk-import
Authorization: Bearer <JWT>

Response:
{
  "imported": 25,      # New visitors created
  "updated": 5,        # Existing visitors updated
  "errors": 0,         # Failed imports
  "total": 30          # Total processed
}
```

### 7. **Delete/Reject Staged Visitor**
```
DELETE /api/staging/visitors/:id
Authorization: Bearer <JWT>

Response:
{
  "ok": true
}
```

## Zoho CRM Webhook Configuration

To automatically send visitor data from Zoho CRM to VMS:

### Step 1: Get Your Webhook URL
```
https://your-vms-domain.com/api/staging/sync
```

### Step 2: Get Your API Token
From `.env` file:
```
STAGING_API_TOKEN=162721d96cbceb619fa09af6d64860a91c8847c4746cb6b1f60491b0b99be752
```

### Step 3: Configure Zoho Webhook
1. Go to **Zoho CRM Settings**
2. Navigate to **Automation → Webhooks**
3. Create New Webhook
4. **Trigger:** When a Contact is created/updated
5. **URL:** `https://your-vms-domain.com/api/staging/sync`
6. **Method:** POST
7. **Headers:**
   ```
   X-Staging-Token: <your-STAGING_API_TOKEN>
   Content-Type: application/json
   ```
8. **Payload Template:**
   ```json
   {
     "zoho_contact_id": "${contactId}",
     "first_name": "${firstName}",
     "last_name": "${lastName}",
     "email": "${email}",
     "phone": "${phone}",
     "company": "${company}",
     "visitor_type": "${visitorType}",
     "photo_url": "${photoUrl}"
   }
   ```

## Frontend: CRM Integration Page

**URL:** `/settings/crm`

### Features:

1. **Status Overview**
   - Total synced records from CRM
   - Pending records in staging database
   - Already imported records

2. **Pending Visitors Table**
   - List all visitors waiting for review
   - Search by name, email, or company
   - Pagination support
   - Checkbox selection for bulk operations

3. **Individual Import**
   - Review each visitor's details
   - Import button for individual records
   - Shows visitor type, company, contact info

4. **Bulk Import**
   - Select multiple visitors
   - "Import Selected" button
   - Or "Trigger Full Import" to auto-import all pending

5. **Record Management**
   - Delete/reject records that shouldn't be imported
   - Synced timestamp shows when data arrived from CRM

## Import Flow

```
1. Zoho CRM sends visitor data via webhook
   ↓
2. Data stored in staging_visitors table (imported=false)
   ↓
3. User reviews data in /settings/crm page
   ↓
4. User clicks "Import" on selected visitor(s)
   ↓
5. System creates/updates visitor in main database
   ↓
6. Staging record marked as imported=true
   ↓
7. Visitor now visible in /visitors page
   ↓
8. Available for face recognition and check-in
```

## Error Handling

If import fails:
- Error is logged but doesn't block other records
- Staging record remains with `imported=false`
- User can retry import later

Common errors:
- **Duplicate email/phone:** System updates existing record
- **Invalid visitor type:** Uses closest matching type
- **Missing required fields:** Record skipped with error logged

## Performance Considerations

- Staging table has index on `zohoContactId` (unique)
- Pagination prevents loading large datasets
- Search indexes on name, email, company
- Auto-imports run in background without blocking API

## Testing

### Test Webhook Payload:
```bash
curl -X POST http://localhost:4000/api/staging/sync \
  -H "X-Staging-Token: 162721d96cbceb619fa09af6d64860a91c8847c4746cb6b1f60491b0b99be752" \
  -H "Content-Type: application/json" \
  -d '{
    "zoho_contact_id": "test-123",
    "first_name": "Test",
    "last_name": "User",
    "email": "test@example.com",
    "company": "Test Company"
  }'
```

### Get Status:
```bash
curl -X GET http://localhost:4000/api/staging/status \
  -H "Authorization: Bearer <your-jwt-token>"
```

### List Pending:
```bash
curl -X GET "http://localhost:4000/api/staging/visitors?status=pending" \
  -H "Authorization: Bearer <your-jwt-token>"
```

## Security

- Webhook authentication via `x-staging-token` header
- JWT required for all management endpoints
- Permissions enforced: `settings.view`, `settings.create`, `settings.delete`
- Database isolation: staging data separate from main system
- Data validation on import

## Monitoring

Monitor staging database health:

```sql
-- Check pending count
SELECT COUNT(*) FROM staging_visitors WHERE imported = false;

-- Check sync rate
SELECT COUNT(*), MAX(synced_at) 
FROM staging_visitors 
WHERE synced_at > NOW() - INTERVAL '24 hours';

-- Find failed imports
SELECT * FROM staging_visitors 
WHERE imported = false AND synced_at < NOW() - INTERVAL '7 days';
```

## Troubleshooting

### "Staging visitors not appearing"
1. Check webhook token matches in Zoho settings and `.env`
2. Verify webhook URL is publicly accessible
3. Check Zoho webhook delivery logs
4. Test endpoint with curl command above

### "Import fails with error"
1. Check API logs: `docker logs vms-api`
2. Verify visitor type exists in system
3. Check for duplicate email/phone in existing visitors

### "Webhook not triggering"
1. Verify contact creation/update in Zoho
2. Check Zoho webhook delivery status
3. Ensure URL is HTTPS (if deployed to production)
4. Verify firewall rules allow incoming requests

## Next Steps

1. ✅ Configure Zoho CRM webhook (see steps above)
2. ✅ Test webhook with sample data
3. ✅ Monitor staging database via `/settings/crm` page
4. ✅ Review and import visitors as they arrive
5. ✅ Set up automated monitoring for failed imports

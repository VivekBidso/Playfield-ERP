# ZOHO FINANCE API Integration Roadmap

**Status**: PLANNING (Not Implemented)
**Created**: March 31, 2026
**Last Updated**: March 31, 2026

---

## Overview

Integration between Factory OPS ERP and Zoho Books for automated financial data synchronization.

### Scope
- Customer creation (Buyers → Zoho Contacts)
- Vendor creation (Suppliers → Zoho Contacts)
- Purchase Inward (GRN → Zoho Bills) - Branch Specific
- Dispatches (→ Zoho Invoices) - Branch Specific
- E-way Bill generation for all dispatches

---

## Confirmed Requirements

| Requirement | Configuration |
|-------------|---------------|
| Zoho Subscription | ✅ Active |
| Organization Type | **Multi-Branch** (separate org per branch) |
| Sync Mode | **Batch Sync** (30 min interval) + Manual Trigger |
| E-way Bill | **All dispatches** (no threshold) |
| Initial Data | **One-time import** of Customers & Vendors from Zoho |
| Manual Trigger | Available for **Master Admin** only (emergency use) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     FACTORY OPS ERP                             │
├─────────────────────────────────────────────────────────────────┤
│  UNIVERSAL DATA                │  BRANCH-SPECIFIC DATA          │
│  ─────────────────────────     │  ────────────────────────      │
│  • Buyers → Zoho Customers     │  • GRN → Zoho Bills            │
│  • Vendors → Zoho Vendors      │  • Dispatch → Zoho Invoices    │
│                                │  • E-way Bills (auto)          │
└────────────────┬───────────────┴────────────────┬───────────────┘
                 │                                │
                 ▼                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ZOHO SYNC SERVICE                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐  │
│  │ Batch Scheduler │  │ Manual Trigger  │  │ Sync Queue     │  │
│  │ (30 min cron)   │  │ (Master Admin)  │  │ (Retry logic)  │  │
│  └─────────────────┘  └─────────────────┘  └────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Branch-Organization Mapping                              │   │
│  │  • Branch A → Zoho Org ID: xxxxxxxx                     │   │
│  │  • Branch B → Zoho Org ID: yyyyyyyy                     │   │
│  │  • Branch C → Zoho Org ID: zzzzzzzz                     │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ZOHO BOOKS API (v3)                          │
│  Base URL: https://www.zohoapis.com/books/v3/                   │
│  • POST /contacts (Customers/Vendors)                           │
│  • POST /bills (Purchase Inward)                                │
│  • POST /invoices (Dispatches)                                  │
│  • POST /invoices/{id}/eway_bill (E-way Bill)                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. Customer/Buyer Sync (Universal)
```
ERP Buyer Create/Update 
    → Add to Sync Queue (status: PENDING)
    → Batch Process (every 30 min)
    → POST /contacts (contact_type: customer)
    → Store Zoho contact_id mapping
    → Update sync status: SYNCED
```

### 2. Vendor Sync (Universal)
```
ERP Vendor Create/Update 
    → Add to Sync Queue (status: PENDING)
    → Batch Process (every 30 min)
    → POST /contacts (contact_type: vendor)
    → Store Zoho contact_id mapping
    → Update sync status: SYNCED
```

### 3. Purchase Inward / GRN (Branch Specific)
```
GRN Approved
    → Identify Branch → Get Zoho Org ID
    → Add to Sync Queue
    → Batch Process
    → POST /bills (with line_items)
    → Store Zoho bill_id
    → Update sync status
```

### 4. Dispatch + E-way Bill (Branch Specific)
```
Dispatch Completed
    → Identify Branch → Get Zoho Org ID
    → Add to Sync Queue
    → Batch Process
    → POST /invoices
    → POST /invoices/{id}/eway_bill (with transport details)
    → Store invoice_id + eway_bill_number
    → Update sync status
```

---

## Field Mappings

### Buyer → Zoho Customer
| ERP Field | Zoho Field | Notes |
|-----------|------------|-------|
| `customer_code` | `contact_number` | Unique identifier |
| `name` | `contact_name` | Company/Customer name |
| `gst_number` | `gst_no` | GST identification |
| `address` | `billing_address` | Address object |
| `email` | `email` | Primary email |
| `phone` | `phone` | Contact number |
| - | `contact_type` | Fixed: "customer" |

### Vendor → Zoho Vendor
| ERP Field | Zoho Field | Notes |
|-----------|------------|-------|
| `vendor_code` | `contact_number` | Unique identifier |
| `name` | `contact_name` | Vendor name |
| `gst_number` | `gst_no` | GST identification |
| `payment_terms` | `payment_terms` | Net 30, etc. |
| - | `contact_type` | Fixed: "vendor" |

### GRN → Zoho Bill
| ERP Field | Zoho Field | Notes |
|-----------|------------|-------|
| `grn_number` | `reference_number` | Your GRN ID |
| `vendor_id` | `vendor_id` | Mapped Zoho vendor ID |
| `grn_date` | `bill_date` | Date of receipt |
| `line_items[]` | `line_items[]` | RM items with qty, rate |
| `total_amount` | `total` | Invoice total |

### Dispatch → Zoho Invoice + E-way Bill
| ERP Field | Zoho Field | Notes |
|-----------|------------|-------|
| `dispatch_lot_id` | `reference_number` | Your dispatch ID |
| `buyer_id` | `customer_id` | Mapped Zoho customer ID |
| `dispatch_date` | `invoice_date` | Date of dispatch |
| `line_items[]` | `line_items[]` | SKUs with qty, rate |
| `shipping_address` | `shipping_address` | For E-way bill |
| `vehicle_number` | E-way bill field | Transport vehicle |
| `transport_distance` | E-way bill field | Distance in KM |
| `transport_mode` | E-way bill field | Road/Rail/Air/Ship |

---

## Database Schema Additions

### zoho_config
```
{
  id: UUID,
  branch_id: string,
  zoho_organization_id: string,
  zoho_client_id: string (encrypted),
  zoho_client_secret: string (encrypted),
  refresh_token: string (encrypted),
  access_token: string (encrypted),
  token_expires_at: datetime,
  is_active: boolean,
  created_at: datetime,
  updated_at: datetime
}
```

### zoho_sync_queue
```
{
  id: UUID,
  entity_type: string (buyer/vendor/grn/dispatch),
  entity_id: string,
  branch_id: string (nullable for universal),
  zoho_org_id: string,
  operation: string (create/update),
  status: string (pending/processing/synced/failed),
  retry_count: int,
  error_message: string,
  zoho_id: string (after sync),
  created_at: datetime,
  processed_at: datetime
}
```

### zoho_id_mapping
```
{
  id: UUID,
  entity_type: string,
  local_id: string,
  zoho_id: string,
  zoho_org_id: string,
  created_at: datetime
}
```

---

## Implementation Phases

### Phase 1: Setup & Authentication (2-3 days)
- [ ] OAuth 2.0 flow implementation
- [ ] Token storage and auto-refresh
- [ ] Branch → Zoho Organization ID mapping
- [ ] Settings UI for Zoho credentials
- [ ] Database schema for zoho_config

### Phase 2: Initial Data Import (1-2 days)
- [ ] One-time import: Zoho Customers → Buyers
- [ ] One-time import: Zoho Vendors → Vendors
- [ ] ID mapping table population
- [ ] Import UI with progress indicator

### Phase 3: Customer & Vendor Sync (2-3 days)
- [ ] Sync queue implementation
- [ ] On Buyer create/update → Queue
- [ ] On Vendor create/update → Queue
- [ ] Batch processor (30 min cron)
- [ ] Manual sync trigger (Master Admin)
- [ ] Sync status indicators in UI

### Phase 4: Purchase Inward - GRN → Bills (2-3 days)
- [ ] On GRN approval → Queue for Zoho Bill
- [ ] Branch-specific organization routing
- [ ] Line items mapping (RM → Zoho Items)
- [ ] Zoho Bill ID storage & display
- [ ] Error handling & retry logic

### Phase 5: Dispatch → Invoice + E-way Bill (3-4 days)
- [ ] On Dispatch completion → Queue for Zoho Invoice
- [ ] Transport details capture UI (vehicle, distance)
- [ ] Auto E-way bill generation after invoice
- [ ] E-way bill number storage & display
- [ ] GST compliance validation

### Phase 6: Monitoring & Admin UI (2 days)
- [ ] Sync status dashboard
- [ ] Error logs & retry mechanism
- [ ] Sync history view
- [ ] Manual "Sync Now" button (Master Admin)
- [ ] Sync statistics (success/failed counts)

---

## API Endpoints to Create

### Settings & Config
- `GET /api/zoho/config` - Get Zoho configuration
- `POST /api/zoho/connect` - Initiate OAuth flow
- `GET /api/zoho/callback` - OAuth callback handler
- `POST /api/zoho/disconnect` - Disconnect Zoho
- `PUT /api/zoho/branch-mapping` - Update branch-org mapping

### Sync Operations
- `POST /api/zoho/sync/trigger` - Manual sync trigger (Master Admin)
- `GET /api/zoho/sync/status` - Get current sync status
- `GET /api/zoho/sync/queue` - View pending sync items
- `GET /api/zoho/sync/history` - Sync history with filters
- `POST /api/zoho/sync/retry/{id}` - Retry failed sync item

### Data Import
- `POST /api/zoho/import/customers` - Import customers from Zoho
- `POST /api/zoho/import/vendors` - Import vendors from Zoho
- `GET /api/zoho/import/status` - Import progress status

---

## UI Changes Required

### 1. Settings → Zoho Integration (New Page)
- Connect/Disconnect Zoho button
- OAuth status indicator
- Branch-Organization mapping table
- Sync interval display (30 min)
- Last sync timestamp

### 2. Buyers/Vendors Pages
- Zoho sync status column (✅ Synced / 🔄 Pending / ❌ Error)
- Last synced timestamp tooltip
- "Sync to Zoho" individual action (optional)

### 3. GRN Page
- Zoho Bill ID display (after sync)
- Sync status indicator
- Link to view in Zoho Books

### 4. Dispatch Lots
- Transport details input section:
  - Vehicle Number (text)
  - Transport Mode (dropdown: Road/Rail/Air/Ship)
  - Distance in KM (number)
- Zoho Invoice ID display
- E-way Bill number display
- Link to view in Zoho Books

### 5. Master Dashboard (Admin Only)
- "Sync Now" button (manual trigger)
- Sync queue count (pending items)
- Last successful sync timestamp
- Quick stats: Today's synced/failed counts

---

## Credentials Required

| Credential | Where to Get | Purpose |
|------------|--------------|---------|
| **Zoho Client ID** | [Zoho API Console](https://api-console.zoho.com/) | OAuth authentication |
| **Zoho Client Secret** | Zoho API Console | OAuth authentication |
| **Organization IDs** | Zoho Books → Settings → Organization | One per branch |
| **E-way Bill Portal Login** | ewaybill.nic.in | GST compliance (one-time setup) |

### Zoho API Console Setup Steps
1. Go to https://api-console.zoho.com/
2. Click "Add Client ID"
3. Choose "Server-based Applications"
4. Fill in:
   - Client Name: Factory OPS ERP
   - Homepage URL: Your production URL
   - Authorized Redirect URI: `{YOUR_URL}/api/zoho/callback`
5. Save and note down Client ID & Client Secret

### E-way Bill Portal Setup (One-time)
1. Go to https://ewaybill.nic.in
2. Login with GST credentials
3. Navigate to Registration → For GSP
4. Add "Zoho Corporation" as GSP
5. Create username/password for Zoho connection

---

## Technical Considerations

### API Rate Limits
- Zoho Books: ~100 requests/minute/organization
- Batch processing handles this automatically
- Implement exponential backoff for rate limit errors

### Error Handling
- Failed syncs marked as "failed" with error message
- Auto-retry up to 3 times with increasing delay
- Alert notification for persistent failures
- Manual retry option available

### Data Consistency
- ERP is source of truth
- If Zoho sync fails, ERP record is valid but marked "pending sync"
- Zoho ID stored only after successful sync
- No rollback of ERP data on Zoho failure

### Security
- OAuth tokens encrypted in database
- Client secrets stored in environment variables
- API calls over HTTPS only
- Token auto-refresh before expiry

### Multi-Branch Isolation
- Each branch syncs only to its mapped Zoho organization
- Sync queue includes branch_id for routing
- Universal data (Buyers/Vendors) synced to all orgs or primary org

---

## Open Questions (To Define)

1. **Item Mapping**: Should RM/SKU items be auto-created in Zoho, or manually maintained?

2. **E-way Bill Transport Details**: 
   - Enter at dispatch time?
   - Use defaults per route?
   - Mandatory or optional fields?

3. **Sync Conflict Resolution**: If same entity updated in both ERP and Zoho, which wins?

4. **Historical Data**: Should existing GRNs/Dispatches be synced, or only new ones?

5. **Notifications**: Email/SMS alerts for sync failures?

6. **Reporting**: Any specific Zoho reports needed in ERP?

---

## Dependencies

- `httpx` - Async HTTP client for API calls
- `python-jose` - JWT handling for tokens
- `cryptography` - Token encryption
- `APScheduler` - Batch job scheduling

---

## References

- [Zoho Books API v3 Documentation](https://www.zoho.com/books/api/v3/)
- [Zoho OAuth 2.0 Guide](https://www.zoho.com/accounts/protocol/oauth.html)
- [E-way Bill Portal](https://ewaybill.nic.in)
- [Zoho Contacts API](https://www.zoho.com/books/api/v3/contacts/)
- [Zoho Bills API](https://www.zoho.com/books/api/v3/bills/)
- [Zoho Invoices API](https://www.zoho.com/books/api/v3/invoices/)

---

*This document is a planning reference. Implementation will begin after requirements are finalized.*

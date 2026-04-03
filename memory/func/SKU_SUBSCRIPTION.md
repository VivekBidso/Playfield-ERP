# SKU Subscription

**Route**: `/sku-subscription`  
**Access**: MASTER_ADMIN, CPC_PLANNER, BRANCH_OPS_USER  
**Frontend**: `/app/frontend/src/pages/SKUSubscription.js`

---

## Overview

Manages which SKUs each branch is subscribed to produce. Controls SKU availability at branch level.

---

## Key Features

### Subscription Management
- Subscribe branch to SKUs
- Unsubscribe SKUs
- Bulk subscribe/unsubscribe

### Branch View
- Filter by branch
- See all subscribed SKUs
- SKU details and BOM preview

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sku-subscriptions?branch={branch}` | Branch subscriptions |
| POST | `/api/sku-subscriptions` | Subscribe SKU |
| DELETE | `/api/sku-subscriptions/{id}` | Unsubscribe |
| POST | `/api/sku-subscriptions/bulk` | Bulk subscribe |

---

## Database Collections

- `sku_subscriptions`
- `bidso_skus` / `buyer_skus`
- `branches`

---

## Key Files

- **Frontend**: `/app/frontend/src/pages/SKUSubscription.js`
- **Backend**: `/app/backend/routes/sku_subscription_routes.py`


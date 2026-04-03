# SKUs (DELETED)

**Route**: `/skus`  
**Status**: ❌ DELETED (April 3, 2026)

---

## Reason for Deletion

Superseded by **SKU Management** (`/sku-management`):

| SKU Legacy | SKU Management |
|------------|----------------|
| Single flat `skus` collection | Two-tier: `bidso_skus` + `buyer_skus` |
| No BOM support | Full BOM (Common + Brand-Specific) |
| Basic filters | Proper hierarchy and inheritance |

---

## Replacement

Use **SKU Management** (`/sku-management`) for all SKU operations.

---

## Files Deleted

- `/app/frontend/src/pages/SKUs.js`
- Route removed from `/app/frontend/src/App.js`
- Sidebar entry removed from `/app/frontend/src/components/Layout.js`


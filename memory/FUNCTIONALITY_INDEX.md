# Functionality Index - Role × Sidebar Menu × Documentation

**Purpose**: Quick reference for rolling back features and re-implementing later.

**Last Updated**: April 3, 2026

---

## Index Table

| Role | Sidebar Menu Page | Functionality Doc |
|------|-------------------|-------------------|
| **ALL USERS** | Dashboard | [DASHBOARD.md](func/DASHBOARD.md) |
| **ALL USERS** | Reports | [REPORTS.md](func/REPORTS.md) |
| MASTER_ADMIN | Master Dashboard | [MASTER_DASHBOARD.md](func/MASTER_DASHBOARD.md) |
| MASTER_ADMIN | User Management | [USER_MANAGEMENT.md](func/USER_MANAGEMENT.md) |
| MASTER_ADMIN | Event System | [EVENTS.md](func/EVENTS.md) |
| MASTER_ADMIN | SKUs (Legacy) | [SKUS_LEGACY.md](func/SKUS_LEGACY.md) |
| MASTER_ADMIN, TECH_OPS_ENGINEER | Tech Ops | [TECH_OPS.md](func/TECH_OPS.md) |
| MASTER_ADMIN, TECH_OPS_ENGINEER | SKU Management | [SKU_MANAGEMENT.md](func/SKU_MANAGEMENT.md) |
| MASTER_ADMIN, TECH_OPS_ENGINEER | RM Repository | [RM_REPOSITORY.md](func/RM_REPOSITORY.md) |
| MASTER_ADMIN, DEMAND_PLANNER | Demand Forecasts | [DEMAND_FORECASTS.md](func/DEMAND_FORECASTS.md) |
| MASTER_ADMIN, DEMAND_PLANNER | Demand Hub | [DEMAND_HUB.md](func/DEMAND_HUB.md) |
| MASTER_ADMIN, DEMAND_PLANNER | SKU Catalog | [SKU_CATALOG.md](func/SKU_CATALOG.md) |
| MASTER_ADMIN, DEMAND_PLANNER | Color Development | [COLOR_DEVELOPMENT.md](func/COLOR_DEVELOPMENT.md) |
| MASTER_ADMIN, DEMAND_PLANNER, LOGISTICS_COORDINATOR | Dispatch Lots | [DISPATCH_LOTS.md](func/DISPATCH_LOTS.md) |
| MASTER_ADMIN, CPC_PLANNER | CPC | [CPC.md](func/CPC.md) |
| MASTER_ADMIN, CPC_PLANNER, PROCUREMENT_OFFICER | MRP Planning | [MRP_PLANNING.md](func/MRP_PLANNING.md) |
| MASTER_ADMIN, BRANCH_OPS_USER | Branch Ops | [BRANCH_OPS.md](func/BRANCH_OPS.md) |
| MASTER_ADMIN, CPC_PLANNER, BRANCH_OPS_USER | SKU Subscription | [SKU_SUBSCRIPTION.md](func/SKU_SUBSCRIPTION.md) |
| MASTER_ADMIN, PROCUREMENT_OFFICER | Procurement | [PROCUREMENT.md](func/PROCUREMENT.md) |
| MASTER_ADMIN, BRANCH_OPS_USER, PROCUREMENT_OFFICER, CPC_PLANNER, FINANCE_VIEWER | RM Stock View | [RAW_MATERIALS.md](func/RAW_MATERIALS.md) |
| MASTER_ADMIN, BRANCH_OPS_USER, PROCUREMENT_OFFICER, FINANCE_VIEWER | RM Inward Entry | [RM_INWARD.md](func/RM_INWARD.md) |
| MASTER_ADMIN, PROCUREMENT_OFFICER | Vendor Management | [VENDOR_MANAGEMENT.md](func/VENDOR_MANAGEMENT.md) |
| MASTER_ADMIN, QUALITY_INSPECTOR | Quality Control | [QUALITY_CONTROL.md](func/QUALITY_CONTROL.md) |
| MASTER_ADMIN, LOGISTICS_COORDINATOR | Logistics | [LOGISTICS.md](func/LOGISTICS.md) |
| MASTER_ADMIN, LOGISTICS_COORDINATOR, BRANCH_OPS_USER | IBT Transfers | [IBT_TRANSFERS.md](func/IBT_TRANSFERS.md) |
| MASTER_ADMIN, LOGISTICS_COORDINATOR | Dispatch (Legacy) | [DISPATCH_LEGACY.md](func/DISPATCH_LEGACY.md) |

---

## Role Summary

| Role Code | Display Name | Primary Functions |
|-----------|--------------|-------------------|
| MASTER_ADMIN | Master Admin | Full system access |
| TECH_OPS_ENGINEER | Tech Ops | SKU/RM master data, BOMs |
| DEMAND_PLANNER | Demand Planner | Forecasts, Dispatch Lots |
| CPC_PLANNER | CPC Planner | Production planning, MRP |
| PROCUREMENT_OFFICER | Procurement | Vendors, POs, Raw Materials |
| BRANCH_OPS_USER | Branch Ops | Production schedules, Inventory |
| FINANCE_VIEWER | Finance | RM Inward bills, Reports |
| QUALITY_INSPECTOR | Quality | QC inspections |
| LOGISTICS_COORDINATOR | Logistics | Dispatch, IBT |
| AUDITOR_READONLY | Auditor | Read-only access |

---

## Test Users

| Role | Email | Password |
|------|-------|----------|
| MASTER_ADMIN | admin@factory.com | bidso123 |
| DEMAND_PLANNER | demandplanner@bidso.com | bidso123 |
| CPC_PLANNER | cpcplanner@bidso.com | bidso123 |
| TECH_OPS_ENGINEER | tech_ops@factory.com | bidso123 |
| FINANCE_VIEWER | finance@bidso.com | bidso123 |
| BRANCH_OPS_USER | branchops@bidso.com | bidso123 |
| PROCUREMENT_OFFICER | procurement@bidso.com | bidso123 |

---

## File References

- **Layout.js**: `/app/frontend/src/components/Layout.js` (sidebar definitions)
- **Pages Directory**: `/app/frontend/src/pages/`
- **Routes Directory**: `/app/backend/routes/`


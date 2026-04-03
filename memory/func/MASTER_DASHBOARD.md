# Master Dashboard

**Route**: `/master-dashboard`  
**Access**: MASTER_ADMIN only  
**Frontend**: `/app/frontend/src/pages/MasterDashboard.js`

---

## Overview

Executive dashboard with cross-branch KPIs and system-wide metrics. Admin-only view.

---

## Key Features

### KPI Cards
- Total production across all branches
- Total inventory value
- Pending forecasts
- Active dispatch lots

### Branch Comparison
- Production by branch chart
- Efficiency rankings
- Capacity utilization

### Alerts
- Critical stock alerts
- Overdue schedules
- Quality issues

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/dashboard` | Master metrics |
| GET | `/api/admin/branch-comparison` | Branch KPIs |
| GET | `/api/admin/alerts` | System alerts |

---

## Key Files

- **Frontend**: `/app/frontend/src/pages/MasterDashboard.js`
- **Backend**: `/app/backend/routes/admin_routes.py`


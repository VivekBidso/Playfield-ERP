# Quality Control

**Route**: `/quality`  
**Access**: MASTER_ADMIN, QUALITY_INSPECTOR  
**Frontend**: `/app/frontend/src/pages/Quality.js`

---

## Overview

Quality control and inspection management. Records QC checks, defects, and quality metrics.

---

## Key Features

### Inspection Queue
- Pending inspections from production
- Assign inspectors
- Priority ordering

### Inspection Entry
- Record inspection results
- Defect logging
- Pass/Fail decision
- Photos/evidence upload

### Quality Reports
- Defect rate trends
- Vendor quality scores
- Branch quality metrics

---

## Inspection Flow

```
PENDING → IN_INSPECTION → PASSED
                       → FAILED → REWORK/SCRAP
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/quality/inspections` | Inspection list |
| POST | `/api/quality/inspections` | Create inspection |
| PUT | `/api/quality/inspections/{id}` | Update result |
| GET | `/api/quality/defects` | Defect log |
| GET | `/api/quality/reports` | Quality reports |

---

## Database Collections

- `quality_inspections`
- `defect_logs`
- `quality_metrics`

---

## Key Files

- **Frontend**: `/app/frontend/src/pages/Quality.js`
- **Backend**: `/app/backend/routes/quality_routes.py`


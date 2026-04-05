# In-House Production Module

## Overview
This module enables tracking of internally manufactured raw materials (L2/L3) that are produced by consuming other raw materials (L1/L2).

## Key Concepts

### BOM Levels
| Level | Description | Source Type | Examples |
|-------|-------------|-------------|----------|
| L1 | Raw purchased materials | PURCHASED | Polymers, Master Batches, Pipes, Powder |
| L2 | First transformation | MANUFACTURED/BOTH | Molded plastic parts, Fabricated metal parts |
| L3 | Second transformation | MANUFACTURED/BOTH | Powder coated parts |

### Source Types
| Type | Purchased Inward | Production Inward | Has BOM |
|------|------------------|-------------------|---------|
| PURCHASED | ✅ | ❌ | No |
| MANUFACTURED | ❌ | ✅ | Yes |
| BOTH | ✅ | ✅ | Yes |

## Categories

| Code | Name | Level | Default Source |
|------|------|-------|----------------|
| POLY | Polymer Grades | L1 | PURCHASED |
| MB | Master Batches | L1 | PURCHASED |
| PWD | Powder Coating Materials | L1 | PURCHASED |
| PIPE | Metal Pipes | L1 | PURCHASED |
| INP | In-house Plastic Parts | L2 | MANUFACTURED |
| INM_FAB | Fabricated Metal Parts | L2 | BOTH |
| INM | Input Materials (Coated) | L3 | BOTH |
| ACC | Accessories | L1 | PURCHASED |
| ELC | Electrical Components | L1 | PURCHASED |
| PM | Packaging Materials | L1 | PURCHASED |
| LB | Labels | L1 | PURCHASED |
| BS | Brand Assets | L1 | PURCHASED |
| STK | Stickers | L1 | PURCHASED |
| SP | Spares | L1 | PURCHASED |

## BOM Examples

### INP (Plastic Parts) - 2 Level
```
POLY_001 (98%) + MB_RED_01 (2%) → INP_654 (Battery Cover Red)
```

### INM (Metal Parts) - 3 Level
```
PIPE_001 → INM_FAB_001 (Fabricated)
INM_FAB_001 + PWD_WHITE_01 → INM_001 (Powder Coated)
```

## Database Collections

### rm_categories
```json
{
  "code": "INP",
  "name": "In-house Plastic Parts",
  "description": "Molded plastic parts manufactured in-house",
  "default_source_type": "MANUFACTURED",
  "default_bom_level": 2,
  "is_active": true,
  "created_at": "2026-04-05T00:00:00Z"
}
```

### rm_bom
```json
{
  "id": "uuid",
  "rm_id": "INP_654",
  "rm_name": "Battery Cover Red",
  "category": "INP",
  "bom_level": 2,
  "output_qty": 1,
  "output_uom": "PCS",
  "components": [
    {
      "component_rm_id": "POLY_001",
      "component_name": "ABS Polymer",
      "quantity": 0.098,
      "uom": "KG",
      "percentage": 98,
      "wastage_factor": 1.02
    },
    {
      "component_rm_id": "MB_RED_01",
      "component_name": "Red Master Batch",
      "quantity": 0.002,
      "uom": "KG",
      "percentage": 2,
      "wastage_factor": 1.05
    }
  ],
  "total_weight_per_unit": 0.1,
  "yield_factor": 0.97,
  "is_active": true,
  "created_at": "2026-04-05T00:00:00Z",
  "updated_at": "2026-04-05T00:00:00Z"
}
```

### production_log
```json
{
  "id": "uuid",
  "production_code": "PROD_20260405_0001",
  "branch": "Unit 1 Vedica",
  "rm_id": "INP_654",
  "rm_name": "Battery Cover Red",
  "category": "INP",
  "bom_level": 2,
  "quantity_produced": 100,
  "uom": "PCS",
  "components_consumed": [
    {
      "rm_id": "POLY_001",
      "name": "ABS Polymer",
      "quantity_consumed": 10.0,
      "uom": "KG"
    },
    {
      "rm_id": "MB_RED_01",
      "name": "Red Master Batch",
      "quantity_consumed": 0.21,
      "uom": "KG"
    }
  ],
  "notes": "Batch PB-2026-0405",
  "produced_by": "user_id",
  "produced_by_name": "Raju Kumar",
  "production_date": "2026-04-05",
  "created_at": "2026-04-05T08:30:00Z"
}
```

## User Workflows

### Full In-house INP Production
1. Purchase POLY_001 → RM Inward (Purchased)
2. Purchase MB_RED_01 → RM Inward (Purchased)
3. Produce INP_654 → Production RM Inward → Consumes POLY + MB

### Full In-house INM Production (3 levels)
1. Purchase PIPE_001 → RM Inward (Purchased)
2. Purchase PWD_WHITE_01 → RM Inward (Purchased)
3. Produce INM_FAB_001 → Production RM Inward → Consumes PIPE
4. Produce INM_001 → Production RM Inward → Consumes INM_FAB + PWD

### Buy L2, Coat In-house
1. Purchase INM_FAB_001 → RM Inward (Purchased)
2. Purchase PWD_WHITE_01 → RM Inward (Purchased)
3. Produce INM_001 → Production RM Inward → Consumes INM_FAB + PWD

## UI Pages

### Tech Ops
- RM Categories: Manage category master with default source types
- RM BOM: Define BOMs for manufactured RMs

### Branch Ops
- Production RM Inward: Enter production with BOM consumption
- Production Reports: View production logs and consumption

## Future Enhancements
- Pantone → Master Batch linkage
- Role-based category access
- Production targets and efficiency tracking
- Internal PO system

---
*Module Created: April 5, 2026*
*Status: In Development*

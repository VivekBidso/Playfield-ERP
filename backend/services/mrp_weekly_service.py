"""
Weekly Time-Phased MRP Service

Enhanced MRP calculation engine with:
1. Weekly breakdown of forecasts
2. Dual BOM explosion (common + brand-specific)
3. Order timing with site buffer and lead time
4. Open PO / Scheduled receipts consideration
5. Separate common vs brand-specific ordering

Reference: /app/memory/MRP_IMPLEMENTATION_PLAN.md
"""
import logging
import uuid
from datetime import datetime, timezone, timedelta, date
from dateutil.relativedelta import relativedelta
from typing import Dict, List, Tuple, Optional, Any
from collections import defaultdict
import math

from database import db

logger = logging.getLogger(__name__)


# RM Categories that are brand-specific (M1 only)
BRAND_SPECIFIC_PREFIXES = ['BS', 'LB', 'PM']


def classify_rm(rm_id: str) -> str:
    """Classify RM as COMMON or BRAND_SPECIFIC based on prefix"""
    if not rm_id:
        return 'COMMON'
    prefix = rm_id.split('_')[0] if '_' in rm_id else rm_id[:2]
    return 'BRAND_SPECIFIC' if prefix in BRAND_SPECIFIC_PREFIXES else 'COMMON'


def get_week_monday(d: date) -> date:
    """Get the Monday of the week containing date d"""
    return d - timedelta(days=d.weekday())


def get_week_number(d: date) -> int:
    """Get ISO week number"""
    return d.isocalendar()[1]


class WeeklyMRPService:
    """Weekly Time-Phased MRP Calculation Service"""
    
    def __init__(self):
        self.planning_horizon_months = 12
        self.rolling_months = 6  # for ratio calculation
        self.site_buffer_days = 7  # material arrives 7 days before production
        self.ordering_day = 0  # Monday = 0
    
    async def calculate_weekly_mrp(
        self,
        user_id: str,
        planning_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Main Weekly MRP calculation method.
        
        Returns complete MRP run with weekly order plan.
        """
        if not planning_date:
            planning_date = datetime.now(timezone.utc)
        
        planning_date_only = planning_date.date() if isinstance(planning_date, datetime) else planning_date
        
        run_code = f"MRP-{planning_date.strftime('%Y%m%d-%H%M%S')}"
        logger.info(f"Starting Weekly MRP calculation: {run_code}")
        
        # ===== STEP 1: Get weekly production requirements =====
        logger.info("Step 1: Getting weekly production requirements...")
        
        # M1: Buyer SKU level from forecasts (brand-specific)
        m1_weekly_requirements = await self._get_m1_weekly_requirements(planning_date_only)
        logger.info(f"M1: {len(m1_weekly_requirements)} weekly Buyer SKU requirements")
        
        # M2-M12: Model level -> Bidso SKU level
        m2_m12_weekly_requirements = await self._get_m2_m12_weekly_requirements(planning_date_only)
        logger.info(f"M2-M12: {len(m2_m12_weekly_requirements)} weekly Bidso SKU requirements")
        
        # ===== STEP 2: BOM Explosion =====
        logger.info("Step 2: BOM explosion...")
        
        # M1: Explode both common_bom and brand_specific_bom (all RM categories)
        m1_rm_requirements = await self._explode_bom_m1(m1_weekly_requirements)
        logger.info(f"M1 RM requirements: {len(m1_rm_requirements)} entries")
        
        # M2-M12: Explode common_bom only (skip brand-specific RMs)
        m2_m12_rm_requirements = await self._explode_bom_m2_m12(m2_m12_weekly_requirements)
        logger.info(f"M2-M12 RM requirements: {len(m2_m12_rm_requirements)} entries")
        
        # ===== STEP 3: Merge and aggregate by production week =====
        logger.info("Step 3: Aggregating RM requirements by production week...")
        all_rm_requirements = self._merge_rm_requirements(m1_rm_requirements, m2_m12_rm_requirements)
        logger.info(f"Total RM production week entries: {len(all_rm_requirements)}")
        
        # ===== STEP 4: Calculate order timing and group by order week =====
        logger.info("Step 4: Calculating order timing...")
        weekly_order_plan = await self._calculate_order_timing(all_rm_requirements, planning_date_only)
        
        # ===== STEP 5: Apply MOQ, batch size, assign vendors =====
        logger.info("Step 5: Applying lot sizing and assigning vendors...")
        weekly_order_plan = await self._apply_lot_sizing_and_vendors(weekly_order_plan)
        
        # ===== STEP 6: Separate common vs brand-specific =====
        common_plan, brand_specific_plan = self._separate_by_type(weekly_order_plan)
        
        # ===== STEP 7: Generate alerts =====
        alerts = self._generate_alerts(weekly_order_plan, planning_date_only)
        
        # ===== Calculate summary =====
        summary = self._calculate_summary(common_plan, brand_specific_plan, alerts)
        
        run_id = str(uuid.uuid4())
        
        # Store weekly plans - each week as separate document (to avoid 16MB limit)
        # Delete any existing plans for this run (in case of re-run)
        await db.mrp_weekly_plans.delete_many({"run_id": run_id})
        
        # Insert common plan weeks
        if common_plan:
            common_docs = [
                {
                    "run_id": run_id,
                    "plan_type": "COMMON",
                    "order_week": week["order_week"],
                    "week_data": week,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                for week in common_plan
            ]
            if common_docs:
                await db.mrp_weekly_plans.insert_many(common_docs)
        
        # Insert brand-specific plan weeks
        if brand_specific_plan:
            brand_docs = [
                {
                    "run_id": run_id,
                    "plan_type": "BRAND_SPECIFIC",
                    "order_week": week["order_week"],
                    "week_data": week,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                for week in brand_specific_plan
            ]
            if brand_docs:
                await db.mrp_weekly_plans.insert_many(brand_docs)
        
        logger.info(f"Saved {len(common_plan)} common weeks and {len(brand_specific_plan)} brand-specific weeks")
        
        # Build MRP run document (summary only, no large data)
        mrp_run = {
            "id": run_id,
            "run_code": run_code,
            "run_date": planning_date.isoformat(),
            "planning_horizon_months": self.planning_horizon_months,
            "status": "CALCULATED",
            "version": "WEEKLY_V1",
            
            # Configuration used
            "config": {
                "site_buffer_days": self.site_buffer_days,
                "ordering_day": "MONDAY",
                "planning_horizon_months": self.planning_horizon_months,
                "include_open_pos": True
            },
            
            # Summary
            "summary": summary,
            
            # Week counts
            "common_weeks_count": len(common_plan),
            "brand_specific_weeks_count": len(brand_specific_plan),
            
            # Alerts (keep in main doc - usually small)
            "alerts": alerts[:100],  # Limit to first 100 alerts
            "total_alerts": len(alerts),
            
            # Legacy compatibility fields
            "total_skus": summary.get("total_skus", 0),
            "total_rms": summary.get("total_rms", 0),
            "total_order_value": summary.get("total_order_value", 0),
            
            # Audit
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": user_id
        }
        
        # Save to database
        await db.mrp_runs.insert_one(mrp_run)
        logger.info(f"Weekly MRP run saved: {run_code}")
        
        return mrp_run
    
    # =========================================================================
    # STEP 1: Get Weekly Production Requirements
    # =========================================================================
    
    async def _get_m1_weekly_requirements(self, planning_date: date) -> List[Dict]:
        """
        Get Month 1 weekly requirements from forecasts (Buyer SKU level).
        
        Returns: [{ production_week, buyer_sku_id, bidso_sku_id, brand_code, qty }]
        """
        # Get current month's forecasts
        month_start = planning_date.replace(day=1)
        month_end = (month_start + relativedelta(months=1)) - timedelta(days=1)
        
        forecasts = await db.forecasts.find({
            "forecast_month": {
                "$gte": datetime.combine(month_start, datetime.min.time()),
                "$lte": datetime.combine(month_end, datetime.max.time())
            },
            "status": {"$in": ["CONFIRMED", "PLANNED"]}
        }, {"_id": 0}).to_list(10000)
        
        if not forecasts:
            logger.warning("No M1 forecasts found, falling back to production_plans")
            return await self._get_m1_from_production_plans(planning_date)
        
        # Break down monthly forecast into weekly buckets (4 weeks)
        weekly_requirements = []
        weeks_in_month = self._get_weeks_in_month(month_start)
        
        for forecast in forecasts:
            buyer_sku_id = forecast.get("sku_id", "")
            total_qty = forecast.get("quantity", 0)
            
            if not buyer_sku_id or total_qty <= 0:
                continue
            
            # Extract brand code and bidso_sku_id from buyer_sku_id
            # Format: {BrandCode}_{BidsoSKU} e.g., FC_KS_BE_115
            parts = buyer_sku_id.split('_')
            brand_code = parts[0] if len(parts) > 1 else ""
            bidso_sku_id = '_'.join(parts[1:]) if len(parts) > 1 else buyer_sku_id
            
            # Distribute evenly across weeks
            weekly_qty = total_qty // len(weeks_in_month)
            remainder = total_qty % len(weeks_in_month)
            
            for i, week_monday in enumerate(weeks_in_month):
                qty = weekly_qty + (1 if i < remainder else 0)
                if qty > 0:
                    weekly_requirements.append({
                        "production_week": week_monday.isoformat(),
                        "buyer_sku_id": buyer_sku_id,
                        "bidso_sku_id": bidso_sku_id,
                        "brand_code": brand_code,
                        "qty": qty,
                        "source": "M1_FORECAST"
                    })
        
        return weekly_requirements
    
    async def _get_m1_from_production_plans(self, planning_date: date) -> List[Dict]:
        """Fallback: Get M1 data from production_plans"""
        month_start = planning_date.replace(day=1)
        month_end = (month_start + relativedelta(months=1)) - timedelta(days=1)
        
        plans = await db.production_plans.find({
            "$or": [
                {"date": {"$gte": month_start, "$lte": month_end}},
                {"plan_month": planning_date.strftime("%Y-%m")}
            ]
        }, {"_id": 0}).to_list(10000)
        
        weekly_requirements = []
        for plan in plans:
            sku_id = plan.get("sku_id", "")
            qty = plan.get("planned_quantity", 0)
            plan_date = plan.get("date", month_start)
            
            if isinstance(plan_date, datetime):
                plan_date = plan_date.date()
            
            week_monday = get_week_monday(plan_date)
            
            # Check if it's a Buyer SKU or Bidso SKU
            parts = sku_id.split('_')
            if len(parts) >= 4:  # Likely Buyer SKU: FC_KS_BE_115
                brand_code = parts[0]
                bidso_sku_id = '_'.join(parts[1:])
            else:  # Likely Bidso SKU
                brand_code = ""
                bidso_sku_id = sku_id
            
            weekly_requirements.append({
                "production_week": week_monday.isoformat(),
                "buyer_sku_id": sku_id if brand_code else None,
                "bidso_sku_id": bidso_sku_id,
                "brand_code": brand_code,
                "qty": qty,
                "source": "M1_PRODUCTION_PLAN"
            })
        
        return weekly_requirements
    
    async def _get_m2_m12_weekly_requirements(self, planning_date: date) -> List[Dict]:
        """
        Get Months 2-12 weekly requirements from model_level_forecasts.
        Split to Bidso SKU level using historical ratios.
        
        Returns: [{ production_week, bidso_sku_id, qty }]
        """
        # Calculate date range for M2-M12
        m2_start = (planning_date.replace(day=1) + relativedelta(months=1))
        m12_end = (planning_date.replace(day=1) + relativedelta(months=12)) - timedelta(days=1)
        
        # Get model forecasts for M2-M12
        forecasts = await db.model_level_forecasts.find({
            "month_year": {
                "$gte": m2_start.strftime("%Y-%m"),
                "$lte": m12_end.strftime("%Y-%m")
            }
        }, {"_id": 0}).to_list(10000)
        
        if not forecasts:
            logger.warning("No M2-M12 model forecasts found")
            return []
        
        # Get rolling ratios for SKU splits
        rolling_ratios = await self._calculate_rolling_ratios(planning_date)
        
        weekly_requirements = []
        
        for forecast in forecasts:
            model_id = forecast.get("model_id")
            month_year = forecast.get("month_year")  # "2026-04"
            model_qty = forecast.get("forecast_qty", 0)
            
            if not model_id or not month_year or model_qty <= 0:
                continue
            
            # Parse month
            try:
                month_start = datetime.strptime(month_year, "%Y-%m").date()
            except ValueError:
                continue
            
            # Get SKU ratios for this model
            model_ratios = rolling_ratios.get(model_id, {})
            if not model_ratios:
                # Fall back to equal distribution among model SKUs
                model_ratios = await self._get_default_ratios(model_id)
            
            # Split to SKUs
            for bidso_sku_id, ratio in model_ratios.items():
                sku_qty = int(model_qty * ratio)
                if sku_qty <= 0:
                    continue
                
                # Break down monthly to weekly
                weeks_in_month = self._get_weeks_in_month(month_start)
                weekly_qty = sku_qty // len(weeks_in_month)
                remainder = sku_qty % len(weeks_in_month)
                
                for i, week_monday in enumerate(weeks_in_month):
                    qty = weekly_qty + (1 if i < remainder else 0)
                    if qty > 0:
                        weekly_requirements.append({
                            "production_week": week_monday.isoformat(),
                            "bidso_sku_id": bidso_sku_id,
                            "qty": qty,
                            "source": "M2_M12_FORECAST",
                            "model_id": model_id
                        })
        
        return weekly_requirements
    
    # =========================================================================
    # STEP 2: BOM Explosion
    # =========================================================================
    
    async def _explode_bom_m1(self, m1_requirements: List[Dict]) -> List[Dict]:
        """
        Explode BOM for M1 (Buyer SKU level).
        Uses both common_bom and brand_specific_bom.
        
        Returns: [{ production_week, rm_id, rm_type, gross_qty, ... }]
        """
        if not m1_requirements:
            return []
        
        # Collect unique SKU IDs for batch query
        bidso_sku_ids = set(req["bidso_sku_id"] for req in m1_requirements)
        buyer_sku_ids = set(req.get("buyer_sku_id") for req in m1_requirements if req.get("buyer_sku_id"))
        
        # Batch fetch common BOMs
        common_boms = {}
        async for bom in db.common_bom.find(
            {"bidso_sku_id": {"$in": list(bidso_sku_ids)}},
            {"_id": 0, "bidso_sku_id": 1, "items": 1}
        ):
            common_boms[bom["bidso_sku_id"]] = bom.get("items", [])
        
        # Batch fetch brand-specific BOMs
        brand_boms = {}
        if buyer_sku_ids:
            async for bom in db.brand_specific_bom.find(
                {"buyer_sku_id": {"$in": list(buyer_sku_ids)}},
                {"_id": 0, "buyer_sku_id": 1, "items": 1}
            ):
                brand_boms[bom["buyer_sku_id"]] = bom.get("items", [])
        
        rm_entries = []
        
        for req in m1_requirements:
            production_week = req["production_week"]
            bidso_sku_id = req["bidso_sku_id"]
            buyer_sku_id = req.get("buyer_sku_id")
            brand_code = req.get("brand_code", "")
            sku_qty = req["qty"]
            
            # 1. Explode common_bom
            for item in common_boms.get(bidso_sku_id, []):
                rm_id = item.get("rm_id")
                bom_qty = item.get("quantity", 1)
                
                if not rm_id:
                    continue
                
                rm_entries.append({
                    "production_week": production_week,
                    "rm_id": rm_id,
                    "rm_type": classify_rm(rm_id),
                    "gross_qty": sku_qty * bom_qty,
                    "source_sku": buyer_sku_id or bidso_sku_id,
                    "brand_code": brand_code,
                    "bom_source": "COMMON"
                })
            
            # 2. Explode brand_specific_bom (if buyer_sku_id exists)
            if buyer_sku_id:
                for item in brand_boms.get(buyer_sku_id, []):
                    rm_id = item.get("rm_id")
                    bom_qty = item.get("quantity", 1)
                    
                    if not rm_id:
                        continue
                    
                    rm_entries.append({
                        "production_week": production_week,
                        "rm_id": rm_id,
                        "rm_type": classify_rm(rm_id),
                        "gross_qty": sku_qty * bom_qty,
                        "source_sku": buyer_sku_id,
                        "brand_code": brand_code,
                        "bom_source": "BRAND_SPECIFIC"
                    })
        
        return rm_entries
    
    async def _explode_bom_m2_m12(self, m2_m12_requirements: List[Dict]) -> List[Dict]:
        """
        Explode BOM for M2-M12 (Bidso SKU level).
        Uses only common_bom, SKIPS brand-specific RMs (BS_, LB_, PM_).
        OPTIMIZED: Batch fetches all BOMs first.
        
        Returns: [{ production_week, rm_id, rm_type, gross_qty, ... }]
        """
        if not m2_m12_requirements:
            return []
        
        # Collect unique Bidso SKU IDs
        bidso_sku_ids = set(req["bidso_sku_id"] for req in m2_m12_requirements)
        
        # Batch fetch all common BOMs
        common_boms = {}
        async for bom in db.common_bom.find(
            {"bidso_sku_id": {"$in": list(bidso_sku_ids)}},
            {"_id": 0, "bidso_sku_id": 1, "items": 1}
        ):
            common_boms[bom["bidso_sku_id"]] = bom.get("items", [])
        
        rm_entries = []
        
        for req in m2_m12_requirements:
            production_week = req["production_week"]
            bidso_sku_id = req["bidso_sku_id"]
            sku_qty = req["qty"]
            
            # Explode common_bom only
            for item in common_boms.get(bidso_sku_id, []):
                rm_id = item.get("rm_id")
                bom_qty = item.get("quantity", 1)
                
                if not rm_id:
                    continue
                
                # SKIP brand-specific RMs for M2-M12
                rm_type = classify_rm(rm_id)
                if rm_type == "BRAND_SPECIFIC":
                    continue
                
                rm_entries.append({
                    "production_week": production_week,
                    "rm_id": rm_id,
                    "rm_type": "COMMON",
                    "gross_qty": sku_qty * bom_qty,
                    "source_sku": bidso_sku_id,
                    "brand_code": "",
                    "bom_source": "COMMON"
                })
        
        return rm_entries
    
    # =========================================================================
    # STEP 3: Merge and Aggregate
    # =========================================================================
    
    def _merge_rm_requirements(
        self, 
        m1_entries: List[Dict], 
        m2_m12_entries: List[Dict]
    ) -> List[Dict]:
        """Merge M1 and M2-M12 RM requirements"""
        return m1_entries + m2_m12_entries
    
    # =========================================================================
    # STEP 4: Calculate Order Timing
    # =========================================================================
    
    async def _calculate_order_timing(
        self, 
        rm_entries: List[Dict],
        planning_date: date
    ) -> Dict[str, Dict]:
        """
        Calculate order timing for each RM entry.
        OPTIMIZED: Batch fetches all reference data first.
        
        For each production week:
        - Arrival Date = Production Week - 7 days (site buffer)
        - Order Date = Arrival Date - Lead Time
        - Order Week = Monday of order date week
        
        Returns: { order_week: { rm_id: { details } } }
        """
        # Group by RM and production week first
        rm_prod_week = defaultdict(lambda: defaultdict(lambda: {
            "gross_qty": 0,
            "entries": []
        }))
        
        for entry in rm_entries:
            rm_id = entry["rm_id"]
            prod_week = entry["production_week"]
            rm_prod_week[rm_id][prod_week]["gross_qty"] += entry["gross_qty"]
            rm_prod_week[rm_id][prod_week]["entries"].append(entry)
        
        all_rm_ids = list(rm_prod_week.keys())
        logger.info(f"Processing {len(all_rm_ids)} unique RMs across {sum(len(v) for v in rm_prod_week.values())} RM-week combinations")
        
        # BATCH FETCH: Procurement parameters
        rm_params = {}
        async for param in db.rm_procurement_parameters.find(
            {"rm_id": {"$in": all_rm_ids}},
            {"_id": 0}
        ):
            rm_params[param["rm_id"]] = param
        
        # BATCH FETCH: RM info (name, category)
        rm_info_map = {}
        async for rm in db.raw_materials.find(
            {"rm_id": {"$in": all_rm_ids}},
            {"_id": 0, "rm_id": 1, "name": 1, "category": 1}
        ):
            rm_info_map[rm["rm_id"]] = rm
        
        # BATCH FETCH: Scheduled receipts (Open POs)
        scheduled_receipts = await self._get_scheduled_receipts(all_rm_ids)
        
        # BATCH FETCH: Current stock
        current_stocks = await self._get_current_stocks(all_rm_ids)
        
        # Calculate order timing
        order_week_plan = defaultdict(lambda: defaultdict(dict))
        
        for rm_id, prod_weeks in rm_prod_week.items():
            params = rm_params.get(rm_id, {})
            lead_time = params.get("lead_time_days", 7)
            safety_stock = params.get("safety_stock", 0)
            yield_factor = params.get("yield_factor", 1.0)
            
            rm_info = rm_info_map.get(rm_id, {})
            
            current_stock = current_stocks.get(rm_id, 0)
            
            for prod_week_str, data in prod_weeks.items():
                prod_week = date.fromisoformat(prod_week_str)
                gross_qty = data["gross_qty"]
                entries = data["entries"]
                
                # Apply yield factor
                gross_with_scrap = math.ceil(gross_qty / yield_factor) if yield_factor < 1 else gross_qty
                
                # Calculate arrival date (7 days before production)
                arrival_date = prod_week - timedelta(days=self.site_buffer_days)
                
                # Calculate order date (arrival - lead time)
                order_date = arrival_date - timedelta(days=lead_time)
                
                # Get order week (Monday)
                order_week = get_week_monday(order_date)
                order_week_str = order_week.isoformat()
                
                # Get scheduled receipts arriving before this production week
                receipts_for_rm = scheduled_receipts.get(rm_id, [])
                scheduled_qty = sum(
                    r["pending_qty"] 
                    for r in receipts_for_rm 
                    if r["expected_delivery"] <= prod_week
                )
                
                # Calculate net requirement
                net_qty = gross_with_scrap + safety_stock - current_stock - scheduled_qty
                net_qty = max(0, net_qty)
                
                # Reduce current stock for next iteration (stock is consumed)
                stock_used = min(current_stock, gross_with_scrap)
                current_stock = max(0, current_stock - stock_used)
                
                # Get RM details
                rm_type = entries[0]["rm_type"] if entries else "COMMON"
                brand_code = entries[0].get("brand_code", "") if entries else ""
                
                order_week_plan[order_week_str][rm_id] = {
                    "rm_id": rm_id,
                    "rm_name": rm_info.get("name", rm_id),
                    "category": rm_info.get("category", ""),
                    "rm_type": rm_type,
                    "brand_code": brand_code,
                    
                    # Timing
                    "production_week": prod_week_str,
                    "arrival_date": arrival_date.isoformat(),
                    "order_date": order_date.isoformat(),
                    "lead_time_days": lead_time,
                    
                    # Quantities
                    "gross_qty": gross_qty,
                    "yield_factor": yield_factor,
                    "gross_with_scrap": gross_with_scrap,
                    "safety_stock": safety_stock,
                    "current_stock": current_stocks.get(rm_id, 0),
                    "scheduled_receipts": scheduled_qty,
                    "net_qty": net_qty,
                    
                    # Params for lot sizing
                    "moq": params.get("moq", 1),
                    "batch_size": params.get("batch_size", 1),
                    "preferred_vendor_id": params.get("preferred_vendor_id")
                }
        
        return dict(order_week_plan)
    
    # =========================================================================
    # STEP 5: Apply Lot Sizing and Assign Vendors
    # =========================================================================
    
    async def _apply_lot_sizing_and_vendors(
        self, 
        order_week_plan: Dict[str, Dict]
    ) -> List[Dict]:
        """
        Apply MOQ, batch size, and assign vendors.
        OPTIMIZED: Batch fetches vendor prices.
        
        Returns: [{ order_week, order_week_label, items: [...] }]
        """
        # Collect all unique RM IDs and preferred vendor IDs
        all_rm_ids = set()
        preferred_vendors = set()
        for rm_items in order_week_plan.values():
            for rm_id, data in rm_items.items():
                if data.get("net_qty", 0) > 0:
                    all_rm_ids.add(rm_id)
                    if data.get("preferred_vendor_id"):
                        preferred_vendors.add(data["preferred_vendor_id"])
        
        # BATCH FETCH: All vendor prices for these RMs
        vendor_prices = defaultdict(list)
        async for price in db.vendor_rm_prices.find(
            {"rm_id": {"$in": list(all_rm_ids)}},
            {"_id": 0}
        ):
            vendor_prices[price["rm_id"]].append(price)
        
        # BATCH FETCH: Vendor names
        all_vendor_ids = set()
        for prices in vendor_prices.values():
            for p in prices:
                all_vendor_ids.add(p.get("vendor_id"))
        all_vendor_ids.update(preferred_vendors)
        
        vendor_names = {}
        async for v in db.vendors.find(
            {"id": {"$in": list(all_vendor_ids)}},
            {"_id": 0, "id": 1, "name": 1}
        ):
            vendor_names[v["id"]] = v.get("name", "")
        
        result = []
        
        for order_week_str in sorted(order_week_plan.keys()):
            rm_items = order_week_plan[order_week_str]
            order_week = date.fromisoformat(order_week_str)
            week_num = get_week_number(order_week)
            
            items = []
            for rm_id, data in rm_items.items():
                net_qty = data["net_qty"]
                
                if net_qty <= 0:
                    continue
                
                # Apply MOQ
                moq = data.get("moq", 1)
                order_qty = max(net_qty, moq)
                
                # Apply batch size
                batch_size = data.get("batch_size", 1)
                if batch_size > 1:
                    order_qty = math.ceil(order_qty / batch_size) * batch_size
                
                # Assign vendor from pre-fetched data
                vendor_info = self._assign_vendor_from_cache(
                    rm_id, 
                    data.get("preferred_vendor_id"),
                    vendor_prices,
                    vendor_names
                )
                
                # Calculate cost
                unit_price = vendor_info.get("unit_price", 0)
                total_cost = order_qty * unit_price
                
                items.append({
                    **data,
                    "order_qty": order_qty,
                    "vendor_id": vendor_info.get("vendor_id"),
                    "vendor_name": vendor_info.get("vendor_name", ""),
                    "unit_price": unit_price,
                    "total_cost": round(total_cost, 2)
                })
            
            if items:
                # Sort items by category, then rm_id
                items.sort(key=lambda x: (x.get("category", ""), x.get("rm_id", "")))
                
                # Calculate week totals
                week_total_cost = sum(item["total_cost"] for item in items)
                
                result.append({
                    "order_week": order_week_str,
                    "order_week_label": f"Week {week_num} ({order_week.strftime('%b %d')})",
                    "order_week_number": week_num,
                    "place_order_by": order_week_str,
                    "items": items,
                    "week_summary": {
                        "total_items": len(items),
                        "total_cost": round(week_total_cost, 2)
                    }
                })
        
        return result
    
    def _assign_vendor_from_cache(
        self, 
        rm_id: str, 
        preferred_vendor_id: Optional[str],
        vendor_prices: Dict[str, List],
        vendor_names: Dict[str, str]
    ) -> Dict:
        """Assign vendor from pre-fetched cache"""
        prices = vendor_prices.get(rm_id, [])
        
        if not prices:
            return {"vendor_id": None, "vendor_name": "", "unit_price": 0}
        
        # Try preferred vendor first
        if preferred_vendor_id:
            for p in prices:
                if p.get("vendor_id") == preferred_vendor_id:
                    return {
                        "vendor_id": preferred_vendor_id,
                        "vendor_name": vendor_names.get(preferred_vendor_id, ""),
                        "unit_price": p.get("price", 0)
                    }
        
        # Find lowest price
        prices.sort(key=lambda x: x.get("price", float('inf')))
        best = prices[0]
        return {
            "vendor_id": best.get("vendor_id"),
            "vendor_name": vendor_names.get(best.get("vendor_id"), ""),
            "unit_price": best.get("price", 0)
        }

    async def _assign_vendor(self, rm_id: str, preferred_vendor_id: Optional[str]) -> Dict:
        """Assign vendor and get pricing"""
        vendor_info = {"vendor_id": None, "vendor_name": "", "unit_price": 0}
        
        # Try preferred vendor first
        if preferred_vendor_id:
            price = await db.vendor_rm_prices.find_one(
                {"rm_id": rm_id, "vendor_id": preferred_vendor_id},
                {"_id": 0}
            )
            if price:
                vendor = await db.vendors.find_one(
                    {"id": preferred_vendor_id},
                    {"_id": 0, "name": 1}
                )
                return {
                    "vendor_id": preferred_vendor_id,
                    "vendor_name": vendor.get("name", "") if vendor else "",
                    "unit_price": price.get("price", 0)
                }
        
        # Find lowest price vendor
        prices = await db.vendor_rm_prices.find(
            {"rm_id": rm_id},
            {"_id": 0}
        ).sort("price", 1).to_list(1)
        
        if prices:
            price = prices[0]
            vendor = await db.vendors.find_one(
                {"id": price.get("vendor_id")},
                {"_id": 0, "name": 1}
            )
            return {
                "vendor_id": price.get("vendor_id"),
                "vendor_name": vendor.get("name", "") if vendor else "",
                "unit_price": price.get("price", 0)
            }
        
        return vendor_info
    
    # =========================================================================
    # STEP 6: Separate by Type
    # =========================================================================
    
    def _separate_by_type(self, weekly_plan: List[Dict]) -> Tuple[List[Dict], List[Dict]]:
        """Separate into common and brand-specific plans"""
        common_plan = []
        brand_specific_plan = []
        
        for week in weekly_plan:
            common_items = [i for i in week["items"] if i["rm_type"] == "COMMON"]
            brand_items = [i for i in week["items"] if i["rm_type"] == "BRAND_SPECIFIC"]
            
            if common_items:
                common_plan.append({
                    **week,
                    "items": common_items,
                    "week_summary": {
                        "total_items": len(common_items),
                        "total_cost": round(sum(i["total_cost"] for i in common_items), 2)
                    }
                })
            
            if brand_items:
                brand_specific_plan.append({
                    **week,
                    "items": brand_items,
                    "week_summary": {
                        "total_items": len(brand_items),
                        "total_cost": round(sum(i["total_cost"] for i in brand_items), 2)
                    }
                })
        
        return common_plan, brand_specific_plan
    
    # =========================================================================
    # STEP 7: Generate Alerts
    # =========================================================================
    
    def _generate_alerts(self, weekly_plan: List[Dict], planning_date: date) -> List[Dict]:
        """Generate alerts for expedite, missing prices, etc."""
        alerts = []
        
        for week in weekly_plan:
            order_week = date.fromisoformat(week["order_week"])
            
            for item in week["items"]:
                # Alert: Expedite required (order date is in the past)
                order_date = date.fromisoformat(item["order_date"])
                if order_date <= planning_date:
                    days_overdue = (planning_date - order_date).days
                    alerts.append({
                        "type": "EXPEDITE_REQUIRED",
                        "severity": "CRITICAL",
                        "rm_id": item["rm_id"],
                        "rm_name": item["rm_name"],
                        "message": f"Order date {item['order_date']} is in the past. Order immediately or expedite.",
                        "production_week": item["production_week"],
                        "days_overdue": days_overdue
                    })
                
                # Alert: Missing vendor price
                if item.get("unit_price", 0) == 0:
                    alerts.append({
                        "type": "NO_VENDOR_PRICE",
                        "severity": "WARNING",
                        "rm_id": item["rm_id"],
                        "rm_name": item["rm_name"],
                        "message": "No vendor price set. Cost calculation incomplete."
                    })
        
        return alerts
    
    # =========================================================================
    # Summary Calculation
    # =========================================================================
    
    def _calculate_summary(
        self, 
        common_plan: List[Dict], 
        brand_specific_plan: List[Dict],
        alerts: List[Dict]
    ) -> Dict:
        """Calculate summary statistics"""
        common_rms = set()
        common_value = 0
        for week in common_plan:
            for item in week["items"]:
                common_rms.add(item["rm_id"])
                common_value += item["total_cost"]
        
        brand_rms = set()
        brand_value = 0
        for week in brand_specific_plan:
            for item in week["items"]:
                brand_rms.add(item["rm_id"])
                brand_value += item["total_cost"]
        
        return {
            "total_order_weeks": len(common_plan) + len(brand_specific_plan),
            "common_rms_count": len(common_rms),
            "common_order_value": round(common_value, 2),
            "brand_specific_rms_count": len(brand_rms),
            "brand_specific_order_value": round(brand_value, 2),
            "total_rms": len(common_rms | brand_rms),
            "total_order_value": round(common_value + brand_value, 2),
            "total_skus": 0,  # Will be calculated from source data
            "alerts_count": {
                "critical": len([a for a in alerts if a["severity"] == "CRITICAL"]),
                "warning": len([a for a in alerts if a["severity"] == "WARNING"])
            }
        }
    
    # =========================================================================
    # Helper Methods
    # =========================================================================
    
    def _get_weeks_in_month(self, month_start: date) -> List[date]:
        """Get list of Mondays in the given month"""
        weeks = []
        current = month_start
        month = month_start.month
        
        # Find first Monday
        while current.weekday() != 0:
            current += timedelta(days=1)
        
        # Collect all Mondays in the month
        while current.month == month or (current.month != month and len(weeks) == 0):
            if current >= month_start:
                weeks.append(current)
            current += timedelta(days=7)
            if current.month != month and current.day > 7:
                break
        
        # Ensure at least 4 weeks
        if not weeks:
            weeks = [get_week_monday(month_start)]
        
        return weeks[:5]  # Max 5 weeks
    
    async def _calculate_rolling_ratios(self, planning_date: date) -> Dict[str, Dict[str, float]]:
        """Calculate 6-month rolling ratios for SKU splits"""
        # Get historical dispatch data for last 6 months
        six_months_ago = planning_date - relativedelta(months=6)
        
        pipeline = [
            {
                "$match": {
                    "dispatch_date": {"$gte": six_months_ago.isoformat()},
                    "status": "COMPLETED"
                }
            },
            {
                "$group": {
                    "_id": {
                        "model_id": "$model_id",
                        "bidso_sku_id": "$bidso_sku_id"
                    },
                    "total_qty": {"$sum": "$quantity"}
                }
            }
        ]
        
        results = await db.dispatch_lots.aggregate(pipeline).to_list(10000)
        
        # Calculate ratios per model
        model_totals = defaultdict(int)
        model_skus = defaultdict(lambda: defaultdict(int))
        
        for r in results:
            model_id = r["_id"].get("model_id")
            bidso_sku_id = r["_id"].get("bidso_sku_id")
            qty = r.get("total_qty", 0)
            
            if model_id and bidso_sku_id:
                model_totals[model_id] += qty
                model_skus[model_id][bidso_sku_id] += qty
        
        # Convert to ratios
        ratios = {}
        for model_id, total in model_totals.items():
            if total > 0:
                ratios[model_id] = {
                    sku_id: qty / total
                    for sku_id, qty in model_skus[model_id].items()
                }
        
        return ratios
    
    async def _get_default_ratios(self, model_id: str) -> Dict[str, float]:
        """Get equal distribution ratios for a model"""
        skus = await db.bidso_skus.find(
            {"model_id": model_id, "status": "ACTIVE"},
            {"_id": 0, "bidso_sku_id": 1}
        ).to_list(1000)
        
        if not skus:
            return {}
        
        ratio = 1.0 / len(skus)
        return {sku["bidso_sku_id"]: ratio for sku in skus}
    
    async def _get_scheduled_receipts(self, rm_ids: List[str]) -> Dict[str, List[Dict]]:
        """Get open PO quantities expected to arrive"""
        receipts = defaultdict(list)
        
        pos = await db.purchase_orders.find({
            "status": {"$in": ["ISSUED", "ACKNOWLEDGED", "SHIPPED", "IN_TRANSIT"]},
            "line_items.rm_id": {"$in": rm_ids}
        }, {"_id": 0}).to_list(10000)
        
        for po in pos:
            for line in po.get("line_items", []):
                rm_id = line.get("rm_id")
                if rm_id not in rm_ids:
                    continue
                
                pending_qty = line.get("pending_qty", line.get("ordered_qty", 0))
                expected_delivery = line.get("expected_delivery_date") or po.get("expected_delivery_date")
                
                if expected_delivery and pending_qty > 0:
                    if isinstance(expected_delivery, str):
                        expected_delivery = date.fromisoformat(expected_delivery[:10])
                    elif isinstance(expected_delivery, datetime):
                        expected_delivery = expected_delivery.date()
                    
                    receipts[rm_id].append({
                        "po_number": po.get("po_number"),
                        "pending_qty": pending_qty,
                        "expected_delivery": expected_delivery
                    })
        
        return dict(receipts)
    
    async def _get_current_stocks(self, rm_ids: List[str]) -> Dict[str, int]:
        """Get current available stock for RMs"""
        stocks = {}
        
        inventory = await db.branch_rm_inventory.find(
            {"rm_id": {"$in": rm_ids}},
            {"_id": 0, "rm_id": 1, "quantity": 1, "quality_hold_qty": 1, "allocated_qty": 1}
        ).to_list(10000)
        
        for inv in inventory:
            rm_id = inv["rm_id"]
            on_hand = inv.get("quantity", 0)
            hold = inv.get("quality_hold_qty", 0)
            allocated = inv.get("allocated_qty", 0)
            available = max(0, on_hand - hold - allocated)
            
            # Sum across branches
            stocks[rm_id] = stocks.get(rm_id, 0) + available
        
        return stocks


# Singleton instance
weekly_mrp_service = WeeklyMRPService()

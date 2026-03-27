"""
MRP (Material Requisition Planning) Service

Core calculation engine for:
1. Month 1: Aggregate from production_plans (SKU-level)
2. Months 2-12: Split model_level_forecasts to SKUs using 6-month rolling ratio
3. BOM Explosion: Convert SKU requirements to RM requirements
4. Draft PO Generation: Consolidated by vendor with MOQ/lead time logic
"""
import logging
from datetime import datetime, timezone, timedelta
from dateutil.relativedelta import relativedelta
from typing import Dict, List, Tuple, Optional, Any
from collections import defaultdict
import math

from database import db

logger = logging.getLogger(__name__)


class MRPService:
    """MRP Calculation Service"""
    
    def __init__(self):
        self.planning_horizon = 12  # months
        self.rolling_months = 6  # historical months for ratio calculation
    
    async def calculate_mrp(
        self,
        user_id: str,
        planning_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Main MRP calculation method.
        
        Args:
            user_id: ID of user running the calculation
            planning_date: Starting date for planning (default: today)
        
        Returns:
            Complete MRP run data with recommendations
        """
        if not planning_date:
            planning_date = datetime.now(timezone.utc)
        
        run_code = f"MRP-{planning_date.strftime('%Y%m%d-%H%M%S')}"
        logger.info(f"Starting MRP calculation: {run_code}")
        
        # Step 1: Get Month 1 data from production_plans
        month1_data = await self._get_month1_data(planning_date)
        logger.info(f"Month 1: {len(month1_data)} SKUs from production_plans")
        
        # Step 2: Calculate 6-month rolling ratios for each model
        rolling_ratios = await self._calculate_rolling_ratios(planning_date)
        logger.info(f"Rolling ratios calculated for {len(rolling_ratios)} models")
        
        # Step 3: Get Months 2-12 from model_level_forecasts and split to SKUs
        model_splits, months_2_12_data = await self._get_months_2_12_data(
            planning_date, rolling_ratios
        )
        logger.info(f"Months 2-12: {len(months_2_12_data)} SKUs from model forecasts")
        
        # Step 4: Aggregate all SKU requirements
        sku_requirements = self._aggregate_sku_requirements(month1_data, months_2_12_data)
        logger.info(f"Total unique SKUs: {len(sku_requirements)}")
        
        # Step 5: BOM Explosion - convert SKU requirements to RM requirements
        rm_requirements_raw = await self._explode_bom(sku_requirements)
        logger.info(f"BOM explosion: {len(rm_requirements_raw)} unique RMs")
        
        # Step 6: Apply procurement parameters and calculate net requirements
        rm_requirements = await self._apply_procurement_params(
            rm_requirements_raw, planning_date
        )
        
        # Step 7: Calculate order quantities with MOQ/batch size
        rm_requirements = self._calculate_order_quantities(rm_requirements)
        
        # Step 8: Assign vendors
        rm_requirements = await self._assign_vendors(rm_requirements)
        
        # Calculate totals
        total_order_value = sum(
            r.get('total_cost', 0) or 0 for r in rm_requirements
        )
        
        # Build MRP run document
        mrp_run = {
            "id": str(__import__('uuid').uuid4()),
            "run_code": run_code,
            "run_date": planning_date.isoformat(),
            "planning_horizon_months": self.planning_horizon,
            "status": "CALCULATED",
            "month1_data": month1_data,
            "model_splits": model_splits,
            "sku_requirements": sku_requirements,
            "rm_requirements": rm_requirements,
            "total_skus": len(sku_requirements),
            "total_rms": len(rm_requirements),
            "total_order_value": round(total_order_value, 2),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": user_id
        }
        
        # Save to database
        await db.mrp_runs.insert_one(mrp_run)
        logger.info(f"MRP run saved: {run_code}")
        
        return mrp_run
    
    async def _get_month1_data(self, planning_date: datetime) -> Dict[str, int]:
        """
        Get Month 1 SKU requirements from production_plans.
        Aggregates day-wise plans for the current month.
        """
        # Get start and end of current month
        month_start = planning_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month_end = (month_start + relativedelta(months=1)) - timedelta(seconds=1)
        
        # Also check plan_month format (YYYY-MM)
        plan_month_str = planning_date.strftime("%Y-%m")
        
        # Query production_plans
        plans = await db.production_plans.find({
            "$or": [
                {
                    "date": {
                        "$gte": month_start,
                        "$lte": month_end
                    }
                },
                {
                    "plan_month": plan_month_str
                }
            ]
        }, {"_id": 0}).to_list(10000)
        
        # Aggregate by SKU
        sku_qty = defaultdict(int)
        for plan in plans:
            sku_id = plan.get("sku_id", "")
            qty = plan.get("planned_quantity", 0) or plan.get("quantity", 0)
            if sku_id and qty:
                # Convert Buyer SKU to Bidso SKU if needed
                bidso_sku_id = await self._get_bidso_sku_id(sku_id)
                if bidso_sku_id:
                    sku_qty[bidso_sku_id] += int(qty)
        
        return dict(sku_qty)
    
    async def _get_bidso_sku_id(self, sku_id: str) -> Optional[str]:
        """
        Convert a SKU ID (which could be Buyer SKU) to Bidso SKU ID.
        If already a Bidso SKU, returns as-is.
        """
        # Check if it's already a Bidso SKU
        bidso = await db.bidso_skus.find_one({"bidso_sku_id": sku_id}, {"_id": 0, "bidso_sku_id": 1})
        if bidso:
            return sku_id
        
        # Check if it's a Buyer SKU and get parent Bidso SKU
        buyer_sku = await db.skus.find_one({"sku_id": sku_id}, {"_id": 0, "bidso_sku_id": 1})
        if buyer_sku and buyer_sku.get("bidso_sku_id"):
            return buyer_sku["bidso_sku_id"]
        
        # Try to extract Bidso SKU from Buyer SKU format (BRAND_BIDSO)
        # e.g., FC_KS_BE_115 -> KS_BE_115
        parts = sku_id.split("_")
        if len(parts) >= 3:
            potential_bidso = "_".join(parts[1:])
            bidso = await db.bidso_skus.find_one({"bidso_sku_id": potential_bidso}, {"_id": 0})
            if bidso:
                return potential_bidso
        
        logger.warning(f"Could not find Bidso SKU for: {sku_id}")
        return None
    
    async def _calculate_rolling_ratios(
        self, planning_date: datetime
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Calculate 6-month rolling ratios for each model.
        Returns: {model_id: [{bidso_sku_id, ratio, historical_qty}, ...]}
        """
        # Get date range for last 6 months
        end_date = planning_date
        start_date = end_date - relativedelta(months=self.rolling_months)
        
        # Get all production_plans in the date range
        plans = await db.production_plans.find({
            "$or": [
                {"date": {"$gte": start_date, "$lte": end_date}},
                {"plan_month": {"$gte": start_date.strftime("%Y-%m"), "$lte": end_date.strftime("%Y-%m")}}
            ]
        }, {"_id": 0, "sku_id": 1, "planned_quantity": 1, "quantity": 1}).to_list(100000)
        
        # Aggregate by Bidso SKU
        sku_qty = defaultdict(int)
        for plan in plans:
            sku_id = plan.get("sku_id", "")
            qty = plan.get("planned_quantity", 0) or plan.get("quantity", 0)
            if sku_id and qty:
                bidso_sku_id = await self._get_bidso_sku_id(sku_id)
                if bidso_sku_id:
                    sku_qty[bidso_sku_id] += int(qty)
        
        # Get model mapping for all Bidso SKUs
        bidso_skus = await db.bidso_skus.find(
            {"bidso_sku_id": {"$in": list(sku_qty.keys())}},
            {"_id": 0, "bidso_sku_id": 1, "model_id": 1, "name": 1}
        ).to_list(10000)
        
        sku_model_map = {s["bidso_sku_id"]: s for s in bidso_skus}
        
        # Group by model and calculate ratios
        model_totals = defaultdict(int)
        model_skus = defaultdict(list)
        
        for sku_id, qty in sku_qty.items():
            sku_info = sku_model_map.get(sku_id)
            if sku_info:
                model_id = sku_info.get("model_id")
                if model_id:
                    model_totals[model_id] += qty
                    model_skus[model_id].append({
                        "bidso_sku_id": sku_id,
                        "bidso_sku_name": sku_info.get("name", ""),
                        "historical_qty": qty
                    })
        
        # Calculate ratios
        rolling_ratios = {}
        for model_id, total in model_totals.items():
            if total > 0:
                skus = model_skus[model_id]
                for sku in skus:
                    sku["ratio"] = round(sku["historical_qty"] / total, 4)
                rolling_ratios[model_id] = skus
        
        return rolling_ratios
    
    async def _get_months_2_12_data(
        self,
        planning_date: datetime,
        rolling_ratios: Dict[str, List[Dict[str, Any]]]
    ) -> Tuple[List[Dict[str, Any]], Dict[str, int]]:
        """
        Get Months 2-12 data from model_level_forecasts.
        Split to SKU level using rolling ratios.
        
        Returns: (model_splits, sku_requirements)
        """
        # Get months 2-12 date range
        month2_start = planning_date.replace(day=1) + relativedelta(months=1)
        month12_end = planning_date.replace(day=1) + relativedelta(months=12)
        
        # Generate list of month strings
        month_strings = []
        current = month2_start
        while current < month12_end:
            month_strings.append(current.strftime("%Y-%m"))
            current += relativedelta(months=1)
        
        # Get model forecasts
        forecasts = await db.model_level_forecasts.find({
            "month_year": {"$in": month_strings}
        }, {"_id": 0}).to_list(10000)
        
        # Aggregate by model
        model_forecasts = defaultdict(int)
        model_info = {}
        for f in forecasts:
            model_id = f.get("model_id")
            if model_id:
                model_forecasts[model_id] += f.get("forecast_qty", 0)
                if model_id not in model_info:
                    model_info[model_id] = {
                        "model_code": f.get("model_code", ""),
                        "model_name": f.get("model_name", "")
                    }
        
        # Split to SKU level
        model_splits = []
        sku_requirements = defaultdict(int)
        
        for model_id, total_qty in model_forecasts.items():
            if total_qty <= 0:
                continue
            
            info = model_info.get(model_id, {})
            ratios = rolling_ratios.get(model_id, [])
            
            sku_splits = []
            if ratios:
                # Use historical ratios
                for sku_ratio in ratios:
                    allocated_qty = int(round(total_qty * sku_ratio["ratio"]))
                    if allocated_qty > 0:
                        sku_splits.append({
                            "bidso_sku_id": sku_ratio["bidso_sku_id"],
                            "ratio": sku_ratio["ratio"],
                            "allocated_qty": allocated_qty
                        })
                        sku_requirements[sku_ratio["bidso_sku_id"]] += allocated_qty
            else:
                # No historical data - get all SKUs for this model and split equally
                model_skus = await db.bidso_skus.find(
                    {"model_id": model_id, "status": "ACTIVE"},
                    {"_id": 0, "bidso_sku_id": 1}
                ).to_list(1000)
                
                if model_skus:
                    equal_ratio = 1.0 / len(model_skus)
                    per_sku_qty = int(round(total_qty / len(model_skus)))
                    for sku in model_skus:
                        sku_splits.append({
                            "bidso_sku_id": sku["bidso_sku_id"],
                            "ratio": round(equal_ratio, 4),
                            "allocated_qty": per_sku_qty
                        })
                        sku_requirements[sku["bidso_sku_id"]] += per_sku_qty
            
            model_splits.append({
                "model_id": model_id,
                "model_code": info.get("model_code", ""),
                "model_name": info.get("model_name", ""),
                "model_forecast_qty": total_qty,
                "sku_splits": sku_splits
            })
        
        return model_splits, dict(sku_requirements)
    
    def _aggregate_sku_requirements(
        self,
        month1_data: Dict[str, int],
        months_2_12_data: Dict[str, int]
    ) -> Dict[str, int]:
        """Combine Month 1 and Months 2-12 SKU requirements"""
        combined = defaultdict(int)
        
        for sku_id, qty in month1_data.items():
            combined[sku_id] += qty
        
        for sku_id, qty in months_2_12_data.items():
            combined[sku_id] += qty
        
        return dict(combined)
    
    async def _explode_bom(
        self, sku_requirements: Dict[str, int]
    ) -> Dict[str, Dict[str, Any]]:
        """
        Explode BOM for all SKUs to get RM requirements.
        
        Returns: {rm_id: {total_required, category, sku_breakdown}}
        """
        rm_requirements = defaultdict(lambda: {
            "total_required": 0,
            "category": "",
            "rm_name": "",
            "sku_breakdown": []
        })
        
        for bidso_sku_id, sku_qty in sku_requirements.items():
            # Get BOM for this SKU
            bom = await db.common_bom.find_one(
                {"bidso_sku_id": bidso_sku_id},
                {"_id": 0, "items": 1}
            )
            
            if not bom or not bom.get("items"):
                logger.warning(f"No BOM found for SKU: {bidso_sku_id}")
                continue
            
            for item in bom["items"]:
                rm_id = item.get("rm_id")
                bom_qty = item.get("quantity", 1)
                
                if not rm_id:
                    continue
                
                # Calculate required quantity
                required_qty = sku_qty * bom_qty
                
                rm_requirements[rm_id]["total_required"] += required_qty
                rm_requirements[rm_id]["sku_breakdown"].append({
                    "sku_id": bidso_sku_id,
                    "sku_qty": sku_qty,
                    "bom_qty": bom_qty,
                    "rm_qty": required_qty
                })
        
        # Enrich with RM details
        for rm_id in rm_requirements.keys():
            rm = await db.raw_materials.find_one(
                {"rm_id": rm_id},
                {"_id": 0, "name": 1, "category": 1}
            )
            if rm:
                rm_requirements[rm_id]["rm_name"] = rm.get("name", rm_id)
                rm_requirements[rm_id]["category"] = rm.get("category", "")
        
        return dict(rm_requirements)
    
    async def _apply_procurement_params(
        self,
        rm_requirements_raw: Dict[str, Dict[str, Any]],
        planning_date: datetime
    ) -> List[Dict[str, Any]]:
        """
        Apply procurement parameters and calculate net requirements.
        """
        result = []
        
        for rm_id, data in rm_requirements_raw.items():
            # Get procurement parameters
            params = await db.rm_procurement_parameters.find_one(
                {"rm_id": rm_id},
                {"_id": 0}
            )
            
            if not params:
                # Use defaults
                params = {
                    "safety_stock": 0,
                    "reorder_point": 0,
                    "moq": 1,
                    "batch_size": 1,
                    "lead_time_days": 7
                }
            
            # Get current stock
            # Sum across all branches
            stock_agg = await db.branch_rm_inventory.aggregate([
                {"$match": {"rm_id": rm_id}},
                {"$group": {"_id": None, "total": {"$sum": "$quantity"}}}
            ]).to_list(1)
            
            current_stock = stock_agg[0]["total"] if stock_agg else 0
            
            # Calculate net requirement
            safety_stock = params.get("safety_stock", 0)
            total_required = data["total_required"]
            net_requirement = total_required + safety_stock - current_stock
            
            # Calculate dates
            lead_time = params.get("lead_time_days", 7)
            required_by = planning_date + relativedelta(months=1)  # Need by end of Month 1
            order_date = required_by - timedelta(days=lead_time)
            
            result.append({
                "rm_id": rm_id,
                "rm_name": data.get("rm_name", rm_id),
                "category": data.get("category", ""),
                "total_required": total_required,
                "current_stock": current_stock,
                "safety_stock": safety_stock,
                "net_requirement": max(0, net_requirement),
                "moq": params.get("moq", 1),
                "batch_size": params.get("batch_size", 1),
                "lead_time_days": lead_time,
                "required_by_date": required_by.strftime("%Y-%m-%d"),
                "order_date": order_date.strftime("%Y-%m-%d"),
                "sku_breakdown": data.get("sku_breakdown", [])
            })
        
        return result
    
    def _calculate_order_quantities(
        self, rm_requirements: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Calculate order quantities respecting MOQ and batch size.
        """
        for rm in rm_requirements:
            net_req = rm.get("net_requirement", 0)
            
            if net_req <= 0:
                rm["order_qty"] = 0
                continue
            
            moq = rm.get("moq", 1) or 1
            batch_size = rm.get("batch_size", 1) or 1
            
            # First ensure we meet MOQ
            order_qty = max(net_req, moq)
            
            # Round up to batch size
            if batch_size > 1:
                order_qty = math.ceil(order_qty / batch_size) * batch_size
            
            rm["order_qty"] = order_qty
        
        return rm_requirements
    
    async def _assign_vendors(
        self, rm_requirements: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Auto-assign vendors based on:
        1. Preferred vendor in procurement parameters
        2. Lowest price from vendor_rm_prices
        """
        for rm in rm_requirements:
            rm_id = rm["rm_id"]
            
            # Check for preferred vendor in parameters
            params = await db.rm_procurement_parameters.find_one(
                {"rm_id": rm_id, "preferred_vendor_id": {"$ne": None}},
                {"_id": 0, "preferred_vendor_id": 1, "preferred_vendor_name": 1}
            )
            
            if params and params.get("preferred_vendor_id"):
                vendor_id = params["preferred_vendor_id"]
                # Get price for this vendor
                price_doc = await db.vendor_rm_prices.find_one(
                    {"vendor_id": vendor_id, "rm_id": rm_id},
                    {"_id": 0, "price": 1}
                )
                price = price_doc.get("price", 0) if price_doc else 0
                
                rm["vendor_id"] = vendor_id
                rm["vendor_name"] = params.get("preferred_vendor_name", "")
                rm["unit_price"] = price
            else:
                # Find lowest price vendor
                price_doc = await db.vendor_rm_prices.find_one(
                    {"rm_id": rm_id},
                    {"_id": 0, "vendor_id": 1, "price": 1},
                    sort=[("price", 1)]
                )
                
                if price_doc:
                    vendor_id = price_doc["vendor_id"]
                    # Get vendor name
                    vendor = await db.vendors.find_one(
                        {"$or": [{"id": vendor_id}, {"vendor_id": vendor_id}]},
                        {"_id": 0, "name": 1}
                    )
                    
                    rm["vendor_id"] = vendor_id
                    rm["vendor_name"] = vendor.get("name", "") if vendor else ""
                    rm["unit_price"] = price_doc.get("price", 0)
                else:
                    rm["vendor_id"] = None
                    rm["vendor_name"] = "UNASSIGNED"
                    rm["unit_price"] = 0
            
            # Calculate total cost
            order_qty = rm.get("order_qty", 0)
            unit_price = rm.get("unit_price", 0) or 0
            rm["total_cost"] = round(order_qty * unit_price, 2)
        
        return rm_requirements
    
    async def generate_draft_pos(
        self, mrp_run_id: str, user_id: str
    ) -> List[Dict[str, Any]]:
        """
        Generate Draft POs from an MRP run.
        Consolidates by vendor.
        """
        # Get MRP run
        mrp_run = await db.mrp_runs.find_one({"id": mrp_run_id}, {"_id": 0})
        if not mrp_run:
            raise ValueError(f"MRP run not found: {mrp_run_id}")
        
        rm_requirements = mrp_run.get("rm_requirements", [])
        
        # Group by vendor
        vendor_items = defaultdict(list)
        for rm in rm_requirements:
            if rm.get("order_qty", 0) > 0:
                vendor_id = rm.get("vendor_id") or "UNASSIGNED"
                vendor_items[vendor_id].append(rm)
        
        # Create Draft POs
        draft_pos = []
        counter = 1
        
        for vendor_id, items in vendor_items.items():
            if vendor_id == "UNASSIGNED":
                vendor_name = "UNASSIGNED - Manual Assignment Required"
            else:
                vendor = await db.vendors.find_one(
                    {"$or": [{"id": vendor_id}, {"vendor_id": vendor_id}]},
                    {"_id": 0, "name": 1}
                )
                vendor_name = vendor.get("name", "") if vendor else "Unknown"
            
            # Build lines
            lines = []
            total_amount = 0
            earliest_order_date = None
            latest_delivery_date = None
            
            for rm in items:
                line_total = rm.get("total_cost", 0)
                lines.append({
                    "rm_id": rm["rm_id"],
                    "rm_name": rm.get("rm_name", ""),
                    "category": rm.get("category", ""),
                    "quantity": rm.get("order_qty", 0),
                    "unit_price": rm.get("unit_price", 0),
                    "line_total": line_total,
                    "required_by_date": rm.get("required_by_date", "")
                })
                total_amount += line_total
                
                # Track dates
                order_date = rm.get("order_date", "")
                if order_date:
                    if not earliest_order_date or order_date < earliest_order_date:
                        earliest_order_date = order_date
                
                required_by = rm.get("required_by_date", "")
                if required_by:
                    if not latest_delivery_date or required_by > latest_delivery_date:
                        latest_delivery_date = required_by
            
            # Create draft PO
            draft_po_code = f"DPO-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{counter:03d}"
            counter += 1
            
            draft_po = {
                "id": str(__import__('uuid').uuid4()),
                "draft_po_code": draft_po_code,
                "mrp_run_id": mrp_run_id,
                "mrp_run_code": mrp_run.get("run_code", ""),
                "vendor_id": vendor_id if vendor_id != "UNASSIGNED" else None,
                "vendor_name": vendor_name,
                "lines": lines,
                "total_items": len(lines),
                "total_amount": round(total_amount, 2),
                "currency": "INR",
                "suggested_order_date": earliest_order_date or "",
                "expected_delivery_date": latest_delivery_date or "",
                "status": "DRAFT",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.mrp_draft_pos.insert_one(draft_po)
            draft_pos.append(draft_po)
        
        # Update MRP run status
        await db.mrp_runs.update_one(
            {"id": mrp_run_id},
            {"$set": {"status": "PO_GENERATED"}}
        )
        
        logger.info(f"Generated {len(draft_pos)} draft POs for MRP run: {mrp_run_id}")
        return draft_pos


# Singleton instance
mrp_service = MRPService()

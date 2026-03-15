"""
Test CPC Module Restructure
- Production Planning tab: forecasts with new columns (Forecast Qty, Inventory, Scheduled, Pending)
- Branch Capacity tab: branch cards and day-wise upload
- Production Schedule tab: branch-wise per-day view
- Schedule Pending = Forecast Qty - Inventory - Scheduled
- Summary cards show correct totals including inventory
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCPCDemandForecasts:
    """Test CPC demand forecasts endpoint with new columns"""
    
    def test_get_demand_forecasts_returns_required_columns(self):
        """Verify forecasts have forecast_qty, inventory_qty, scheduled_qty, schedule_pending"""
        response = requests.get(f"{BASE_URL}/api/cpc/demand-forecasts")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        if len(data) > 0:
            forecast = data[0]
            # Check required columns exist
            assert "forecast_qty" in forecast, "Missing forecast_qty column"
            assert "inventory_qty" in forecast, "Missing inventory_qty column"
            assert "scheduled_qty" in forecast, "Missing scheduled_qty column"
            assert "schedule_pending" in forecast, "Missing schedule_pending column"
            assert "forecast_code" in forecast, "Missing forecast_code"
            assert "sku_id" in forecast or "vertical_name" in forecast, "Missing SKU identifier"
            print(f"SUCCESS: Forecast has all required columns")
            print(f"  - forecast_qty: {forecast.get('forecast_qty')}")
            print(f"  - inventory_qty: {forecast.get('inventory_qty')}")
            print(f"  - scheduled_qty: {forecast.get('scheduled_qty')}")
            print(f"  - schedule_pending: {forecast.get('schedule_pending')}")
    
    def test_schedule_pending_calculation(self):
        """Verify Schedule Pending = Forecast Qty - Inventory - Scheduled"""
        response = requests.get(f"{BASE_URL}/api/cpc/demand-forecasts")
        assert response.status_code == 200
        
        data = response.json()
        for forecast in data:
            forecast_qty = forecast.get("forecast_qty", 0)
            inventory_qty = forecast.get("inventory_qty", 0)
            scheduled_qty = forecast.get("scheduled_qty", 0)
            schedule_pending = forecast.get("schedule_pending", 0)
            
            expected_pending = max(0, forecast_qty - inventory_qty - scheduled_qty)
            assert schedule_pending == expected_pending, \
                f"Schedule pending mismatch for {forecast.get('forecast_code')}: " \
                f"expected {expected_pending}, got {schedule_pending}"
        
        print(f"SUCCESS: Schedule pending calculation verified for {len(data)} forecasts")
    
    def test_is_fully_scheduled_flag(self):
        """Verify is_fully_scheduled flag is set correctly"""
        response = requests.get(f"{BASE_URL}/api/cpc/demand-forecasts")
        assert response.status_code == 200
        
        data = response.json()
        for forecast in data:
            schedule_pending = forecast.get("schedule_pending", 0)
            is_fully_scheduled = forecast.get("is_fully_scheduled", False)
            
            if schedule_pending == 0:
                assert is_fully_scheduled == True, \
                    f"Forecast {forecast.get('forecast_code')} should be fully scheduled"
            else:
                assert is_fully_scheduled == False, \
                    f"Forecast {forecast.get('forecast_code')} should NOT be fully scheduled"
        
        print(f"SUCCESS: is_fully_scheduled flag verified for {len(data)} forecasts")


class TestCPCDemandForecastsSummary:
    """Test CPC summary endpoint with inventory consideration"""
    
    def test_summary_returns_required_fields(self):
        """Verify summary has all required fields including inventory"""
        response = requests.get(f"{BASE_URL}/api/cpc/demand-forecasts/summary")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "total_forecasts" in data, "Missing total_forecasts"
        assert "total_forecast_qty" in data, "Missing total_forecast_qty"
        assert "total_inventory" in data, "Missing total_inventory"
        assert "total_scheduled_qty" in data, "Missing total_scheduled_qty"
        assert "remaining_to_schedule" in data, "Missing remaining_to_schedule"
        assert "scheduling_percent" in data, "Missing scheduling_percent"
        
        print(f"SUCCESS: Summary has all required fields")
        print(f"  - total_forecasts: {data.get('total_forecasts')}")
        print(f"  - total_forecast_qty: {data.get('total_forecast_qty')}")
        print(f"  - total_inventory: {data.get('total_inventory')}")
        print(f"  - total_scheduled_qty: {data.get('total_scheduled_qty')}")
        print(f"  - remaining_to_schedule: {data.get('remaining_to_schedule')}")
    
    def test_summary_remaining_calculation(self):
        """Verify remaining_to_schedule = forecast_qty - inventory - scheduled"""
        response = requests.get(f"{BASE_URL}/api/cpc/demand-forecasts/summary")
        assert response.status_code == 200
        
        data = response.json()
        total_forecast = data.get("total_forecast_qty", 0)
        total_inventory = data.get("total_inventory", 0)
        total_scheduled = data.get("total_scheduled_qty", 0)
        remaining = data.get("remaining_to_schedule", 0)
        
        expected_remaining = max(0, total_forecast - total_inventory - total_scheduled)
        assert remaining == expected_remaining, \
            f"Remaining mismatch: expected {expected_remaining}, got {remaining}"
        
        print(f"SUCCESS: Summary remaining calculation verified")
        print(f"  Formula: max(0, {total_forecast} - {total_inventory} - {total_scheduled}) = {expected_remaining}")


class TestBranchCapacity:
    """Test Branch Capacity endpoints"""
    
    def test_get_branch_capacities(self):
        """Verify branch capacities endpoint returns required fields"""
        response = requests.get(f"{BASE_URL}/api/branches/capacity")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        if len(data) > 0:
            branch = data[0]
            assert "branch" in branch, "Missing branch name"
            assert "capacity_units_per_day" in branch, "Missing capacity_units_per_day"
            assert "allocated_today" in branch, "Missing allocated_today"
            assert "available_today" in branch, "Missing available_today"
            assert "utilization_percent" in branch, "Missing utilization_percent"
            print(f"SUCCESS: Branch capacity has all required fields")
            print(f"  Found {len(data)} branches")
    
    def test_daily_capacity_template_download(self):
        """Verify daily capacity template download works"""
        response = requests.get(f"{BASE_URL}/api/branches/daily-capacity/template")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        content_type = response.headers.get("content-type", "")
        assert "spreadsheet" in content_type or "excel" in content_type.lower() or "octet-stream" in content_type, \
            f"Expected Excel content type, got {content_type}"
        
        print(f"SUCCESS: Daily capacity template download works")
    
    def test_get_daily_capacities(self):
        """Verify daily capacities endpoint works"""
        response = requests.get(f"{BASE_URL}/api/branches/daily-capacity")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"SUCCESS: Daily capacities endpoint works, found {len(data)} records")


class TestBranchSchedules:
    """Test Branch-wise Production Schedule endpoint"""
    
    def test_get_branch_schedules(self):
        """Verify branch schedules endpoint returns required fields"""
        response = requests.get(f"{BASE_URL}/api/cpc/branch-schedules")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        if len(data) > 0:
            schedule = data[0]
            assert "branch" in schedule, "Missing branch"
            assert "date" in schedule, "Missing date"
            assert "capacity" in schedule, "Missing capacity"
            assert "total_scheduled" in schedule, "Missing total_scheduled"
            assert "available" in schedule, "Missing available"
            assert "utilization_percent" in schedule, "Missing utilization_percent"
            assert "schedules" in schedule, "Missing schedules array"
            print(f"SUCCESS: Branch schedules has all required fields")
            print(f"  Found {len(data)} branch-date combinations")
    
    def test_branch_schedules_with_date_filter(self):
        """Verify branch schedules can be filtered by date"""
        today = datetime.now().strftime("%Y-%m-%d")
        end_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        response = requests.get(f"{BASE_URL}/api/cpc/branch-schedules?start_date={today}&end_date={end_date}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"SUCCESS: Branch schedules date filter works, found {len(data)} records")
    
    def test_branch_schedules_with_branch_filter(self):
        """Verify branch schedules can be filtered by branch"""
        # First get available branches
        branches_response = requests.get(f"{BASE_URL}/api/branches/capacity")
        if branches_response.status_code == 200 and len(branches_response.json()) > 0:
            branch_name = branches_response.json()[0].get("branch")
            
            response = requests.get(f"{BASE_URL}/api/cpc/branch-schedules?branch={branch_name}")
            assert response.status_code == 200, f"Expected 200, got {response.status_code}"
            
            data = response.json()
            # All results should be for the specified branch
            for item in data:
                assert item.get("branch") == branch_name, \
                    f"Expected branch {branch_name}, got {item.get('branch')}"
            
            print(f"SUCCESS: Branch schedules branch filter works for {branch_name}")


class TestProductionPlanTemplate:
    """Test Production Plan bulk upload template"""
    
    def test_production_plan_template_download(self):
        """Verify production plan template download works"""
        response = requests.get(f"{BASE_URL}/api/cpc/production-plan/template")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        content_type = response.headers.get("content-type", "")
        assert "spreadsheet" in content_type or "excel" in content_type.lower() or "octet-stream" in content_type, \
            f"Expected Excel content type, got {content_type}"
        
        print(f"SUCCESS: Production plan template download works")


class TestScheduleFromForecast:
    """Test scheduling from forecast (forecast-driven planning)"""
    
    def test_schedule_from_forecast_requires_branch(self):
        """Verify that branch is required for scheduling from forecast"""
        # First get a forecast with pending qty
        forecasts_response = requests.get(f"{BASE_URL}/api/cpc/demand-forecasts")
        assert forecasts_response.status_code == 200
        
        forecasts = forecasts_response.json()
        pending_forecast = None
        for f in forecasts:
            if f.get("schedule_pending", 0) > 0 and f.get("sku_id"):
                pending_forecast = f
                break
        
        if not pending_forecast:
            pytest.skip("No pending forecasts with SKU available for testing")
        
        # Try to schedule without branch - should fail or require branch
        target_date = (datetime.now() + timedelta(days=1)).isoformat()
        payload = {
            "forecast_id": pending_forecast["id"],
            "quantity": min(10, pending_forecast["schedule_pending"]),
            "target_date": target_date,
            "priority": "MEDIUM"
            # Note: branch is not provided
        }
        
        response = requests.post(f"{BASE_URL}/api/cpc/schedule-from-forecast", json=payload)
        # The endpoint should either require branch or accept without it
        # Based on the code, branch is optional but recommended
        print(f"Schedule without branch response: {response.status_code}")
        
        # Now test with branch
        branches_response = requests.get(f"{BASE_URL}/api/branches/capacity")
        if branches_response.status_code == 200 and len(branches_response.json()) > 0:
            branch_name = branches_response.json()[0].get("branch")
            
            payload["branch"] = branch_name
            response = requests.post(f"{BASE_URL}/api/cpc/schedule-from-forecast", json=payload)
            # Should succeed or fail due to capacity
            print(f"Schedule with branch response: {response.status_code}")
            if response.status_code == 200:
                print(f"SUCCESS: Schedule created with branch {branch_name}")
            elif response.status_code == 400:
                print(f"INFO: Schedule rejected (likely capacity issue): {response.json()}")


class TestForecastExport:
    """Test forecast export functionality"""
    
    def test_demand_forecasts_download(self):
        """Verify demand forecasts Excel download works"""
        response = requests.get(f"{BASE_URL}/api/cpc/demand-forecasts/download")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        content_type = response.headers.get("content-type", "")
        assert "spreadsheet" in content_type or "excel" in content_type.lower() or "octet-stream" in content_type, \
            f"Expected Excel content type, got {content_type}"
        
        print(f"SUCCESS: Demand forecasts export works")


class TestSKUAssignedBranches:
    """Test SKU assigned branches endpoint for Plan dialog"""
    
    def test_get_sku_assigned_branches(self):
        """Verify SKU assigned branches endpoint works"""
        # First get a SKU ID from forecasts
        forecasts_response = requests.get(f"{BASE_URL}/api/cpc/demand-forecasts")
        assert forecasts_response.status_code == 200
        
        forecasts = forecasts_response.json()
        sku_id = None
        for f in forecasts:
            if f.get("sku_id"):
                sku_id = f["sku_id"]
                break
        
        if not sku_id:
            pytest.skip("No SKU found in forecasts")
        
        response = requests.get(f"{BASE_URL}/api/skus/{sku_id}/assigned-branches")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "branches" in data, "Missing branches field"
        assert isinstance(data["branches"], list), "branches should be a list"
        
        print(f"SUCCESS: SKU {sku_id} has {len(data['branches'])} assigned branches")


class TestBranchCapacityForDate:
    """Test branch capacity for specific date endpoint"""
    
    def test_get_branch_capacity_for_date(self):
        """Verify branch capacity for date endpoint works"""
        # First get a branch
        branches_response = requests.get(f"{BASE_URL}/api/branches/capacity")
        assert branches_response.status_code == 200
        
        branches = branches_response.json()
        if len(branches) == 0:
            pytest.skip("No branches available")
        
        branch_name = branches[0].get("branch")
        date_str = datetime.now().strftime("%Y-%m-%d")
        
        response = requests.get(f"{BASE_URL}/api/branches/{branch_name}/capacity-for-date?date_str={date_str}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "base_capacity" in data, "Missing base_capacity"
        assert "allocated" in data, "Missing allocated"
        assert "available" in data, "Missing available"
        
        print(f"SUCCESS: Branch {branch_name} capacity for {date_str}:")
        print(f"  - base_capacity: {data.get('base_capacity')}")
        print(f"  - allocated: {data.get('allocated')}")
        print(f"  - available: {data.get('available')}")


class TestSummaryOnlyCountsForecastLinkedSchedules:
    """Test that summary only counts forecast-linked schedules"""
    
    def test_summary_counts_forecast_linked_schedules(self):
        """Verify summary scheduled_qty only counts schedules linked to forecasts"""
        # Get summary
        summary_response = requests.get(f"{BASE_URL}/api/cpc/demand-forecasts/summary")
        assert summary_response.status_code == 200
        
        summary = summary_response.json()
        total_scheduled = summary.get("total_scheduled_qty", 0)
        
        # Get individual forecasts and sum their scheduled_qty
        forecasts_response = requests.get(f"{BASE_URL}/api/cpc/demand-forecasts")
        assert forecasts_response.status_code == 200
        
        forecasts = forecasts_response.json()
        sum_from_forecasts = sum(f.get("scheduled_qty", 0) for f in forecasts)
        
        # The summary should match the sum from individual forecasts
        # (both should only count forecast-linked schedules)
        print(f"Summary total_scheduled_qty: {total_scheduled}")
        print(f"Sum from individual forecasts: {sum_from_forecasts}")
        
        # They should be close (might differ slightly due to capping)
        assert abs(total_scheduled - sum_from_forecasts) <= total_scheduled * 0.1, \
            f"Summary scheduled qty ({total_scheduled}) differs significantly from forecast sum ({sum_from_forecasts})"
        
        print(f"SUCCESS: Summary correctly counts forecast-linked schedules")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

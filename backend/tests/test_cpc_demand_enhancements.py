"""
Test CPC and Demand Module Enhancements
- GET /api/forecasts - dispatch_allocated, production_scheduled, schedule_pending columns
- GET /api/skus/{sku_id}/assigned-branches - branches with capacity for SKU
- GET /api/branches/{branch}/capacity-for-date - available capacity for date
- POST /api/cpc/schedule-from-forecast - branch parameter and capacity validation
- POST /api/dispatch-lots/{lot_id}/add-line - add line to existing lot
- GET /api/dispatch-lots/by-buyer/{buyer_id} - buyer's open dispatch lots
- POST /api/branches/model-capacity/upload - model-specific capacity upload
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data
TEST_SKU = "FC_KS_BE_115"
TEST_BRANCH = "Unit 1 Vedica"
TEST_BUYER_ID = "204cff89-9cbc-4c3e-9a05-9057fe12a654"


class TestForecastsNewColumns:
    """Test GET /api/forecasts returns new columns"""
    
    def test_forecasts_returns_dispatch_allocated(self):
        """Verify forecasts endpoint returns dispatch_allocated column"""
        response = requests.get(f"{BASE_URL}/api/forecasts")
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            forecast = data[0]
            assert "dispatch_allocated" in forecast, "dispatch_allocated column missing"
            assert isinstance(forecast["dispatch_allocated"], (int, float)), "dispatch_allocated should be numeric"
            print(f"PASS: dispatch_allocated = {forecast['dispatch_allocated']}")
    
    def test_forecasts_returns_production_scheduled(self):
        """Verify forecasts endpoint returns production_scheduled column"""
        response = requests.get(f"{BASE_URL}/api/forecasts")
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            forecast = data[0]
            assert "production_scheduled" in forecast, "production_scheduled column missing"
            assert isinstance(forecast["production_scheduled"], (int, float)), "production_scheduled should be numeric"
            print(f"PASS: production_scheduled = {forecast['production_scheduled']}")
    
    def test_forecasts_returns_schedule_pending(self):
        """Verify forecasts endpoint returns schedule_pending column"""
        response = requests.get(f"{BASE_URL}/api/forecasts")
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            forecast = data[0]
            assert "schedule_pending" in forecast, "schedule_pending column missing"
            assert isinstance(forecast["schedule_pending"], (int, float)), "schedule_pending should be numeric"
            # schedule_pending should be >= 0
            assert forecast["schedule_pending"] >= 0, "schedule_pending should be non-negative"
            print(f"PASS: schedule_pending = {forecast['schedule_pending']}")
    
    def test_forecasts_schedule_pending_calculation(self):
        """Verify schedule_pending = quantity - production_scheduled"""
        response = requests.get(f"{BASE_URL}/api/forecasts")
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            forecast = data[0]
            expected_pending = max(0, forecast.get("quantity", 0) - forecast.get("production_scheduled", 0))
            actual_pending = forecast.get("schedule_pending", 0)
            assert actual_pending == expected_pending, f"schedule_pending calculation wrong: expected {expected_pending}, got {actual_pending}"
            print(f"PASS: schedule_pending calculation correct ({actual_pending})")


class TestSKUAssignedBranches:
    """Test GET /api/skus/{sku_id}/assigned-branches"""
    
    def test_get_assigned_branches_success(self):
        """Verify endpoint returns branches for valid SKU"""
        response = requests.get(f"{BASE_URL}/api/skus/{TEST_SKU}/assigned-branches")
        assert response.status_code == 200
        data = response.json()
        
        assert "sku_id" in data, "Response should contain sku_id"
        assert data["sku_id"] == TEST_SKU
        assert "branches" in data, "Response should contain branches list"
        assert isinstance(data["branches"], list), "branches should be a list"
        assert "assignment_type" in data, "Response should contain assignment_type"
        print(f"PASS: Found {len(data['branches'])} branches for SKU {TEST_SKU}")
        print(f"  Assignment type: {data['assignment_type']}")
        print(f"  Branches: {data['branches']}")
    
    def test_get_assigned_branches_invalid_sku(self):
        """Verify endpoint returns 404 for invalid SKU"""
        response = requests.get(f"{BASE_URL}/api/skus/INVALID_SKU_12345/assigned-branches")
        assert response.status_code == 404
        print("PASS: Returns 404 for invalid SKU")


class TestBranchCapacityForDate:
    """Test GET /api/branches/{branch}/capacity-for-date"""
    
    def test_capacity_for_date_success(self):
        """Verify endpoint returns capacity info for valid branch and date"""
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        response = requests.get(
            f"{BASE_URL}/api/branches/{TEST_BRANCH}/capacity-for-date",
            params={"date_str": tomorrow}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "branch" in data, "Response should contain branch"
        assert data["branch"] == TEST_BRANCH
        assert "date" in data, "Response should contain date"
        assert "base_capacity" in data, "Response should contain base_capacity"
        assert "allocated" in data, "Response should contain allocated"
        assert "available" in data, "Response should contain available"
        assert "capacity_type" in data, "Response should contain capacity_type"
        
        # available should be base_capacity - allocated (or model capacity - allocated)
        assert data["available"] >= 0, "available should be non-negative"
        print(f"PASS: Capacity for {TEST_BRANCH} on {tomorrow}:")
        print(f"  Base capacity: {data['base_capacity']}")
        print(f"  Allocated: {data['allocated']}")
        print(f"  Available: {data['available']}")
        print(f"  Capacity type: {data['capacity_type']}")
    
    def test_capacity_for_date_invalid_format(self):
        """Verify endpoint returns 400 for invalid date format"""
        response = requests.get(
            f"{BASE_URL}/api/branches/{TEST_BRANCH}/capacity-for-date",
            params={"date_str": "invalid-date"}
        )
        assert response.status_code == 400
        print("PASS: Returns 400 for invalid date format")
    
    def test_capacity_for_date_invalid_branch(self):
        """Verify endpoint returns 404 for invalid branch"""
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        response = requests.get(
            f"{BASE_URL}/api/branches/INVALID_BRANCH_XYZ/capacity-for-date",
            params={"date_str": tomorrow}
        )
        assert response.status_code == 404
        print("PASS: Returns 404 for invalid branch")


class TestScheduleFromForecastWithBranch:
    """Test POST /api/cpc/schedule-from-forecast with branch parameter"""
    
    def test_schedule_from_forecast_with_branch(self):
        """Test scheduling from forecast with branch assignment"""
        # First get a confirmed forecast
        forecasts_res = requests.get(f"{BASE_URL}/api/forecasts?status=CONFIRMED")
        if forecasts_res.status_code != 200 or len(forecasts_res.json()) == 0:
            pytest.skip("No confirmed forecasts available for testing")
        
        forecasts = forecasts_res.json()
        # Find a forecast with remaining quantity
        test_forecast = None
        for f in forecasts:
            if f.get("schedule_pending", 0) > 0 and f.get("sku_id"):
                test_forecast = f
                break
        
        if not test_forecast:
            pytest.skip("No forecast with remaining quantity found")
        
        # Get available branches for the SKU
        branches_res = requests.get(f"{BASE_URL}/api/skus/{test_forecast['sku_id']}/assigned-branches")
        if branches_res.status_code != 200 or len(branches_res.json().get("branches", [])) == 0:
            pytest.skip("No branches available for SKU")
        
        branch = branches_res.json()["branches"][0]
        
        # Schedule with branch
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%dT00:00:00Z")
        schedule_qty = min(10, test_forecast.get("schedule_pending", 10))
        
        response = requests.post(
            f"{BASE_URL}/api/cpc/schedule-from-forecast",
            json={
                "forecast_id": test_forecast["id"],
                "quantity": schedule_qty,
                "target_date": tomorrow,
                "branch": branch,
                "priority": "MEDIUM"
            }
        )
        
        # Should succeed or fail with capacity error
        if response.status_code == 200:
            data = response.json()
            assert "schedule" in data, "Response should contain schedule"
            assert data["schedule"].get("branch") == branch, "Schedule should have branch assigned"
            print(f"PASS: Created schedule with branch {branch}")
            print(f"  Schedule code: {data['schedule'].get('schedule_code')}")
        elif response.status_code == 400:
            # Capacity exceeded is acceptable
            detail = response.json().get("detail", "")
            assert "capacity" in detail.lower() or "exceeds" in detail.lower(), f"Unexpected error: {detail}"
            print(f"PASS: Correctly rejected due to capacity: {detail}")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code}")
    
    def test_schedule_from_forecast_invalid_branch(self):
        """Test scheduling with invalid branch returns error"""
        # Get a confirmed forecast
        forecasts_res = requests.get(f"{BASE_URL}/api/forecasts?status=CONFIRMED")
        if forecasts_res.status_code != 200 or len(forecasts_res.json()) == 0:
            pytest.skip("No confirmed forecasts available")
        
        forecasts = forecasts_res.json()
        test_forecast = None
        for f in forecasts:
            if f.get("schedule_pending", 0) > 0 and f.get("sku_id"):
                test_forecast = f
                break
        
        if not test_forecast:
            pytest.skip("No forecast with remaining quantity found")
        
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%dT00:00:00Z")
        
        response = requests.post(
            f"{BASE_URL}/api/cpc/schedule-from-forecast",
            json={
                "forecast_id": test_forecast["id"],
                "quantity": 10,
                "target_date": tomorrow,
                "branch": "INVALID_BRANCH_XYZ",
                "priority": "MEDIUM"
            }
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Returns 404 for invalid branch")


class TestAddLineToDispatchLot:
    """Test POST /api/dispatch-lots/{lot_id}/add-line"""
    
    def test_add_line_to_existing_lot(self):
        """Test adding a line to an existing dispatch lot"""
        # Get existing lots
        lots_res = requests.get(f"{BASE_URL}/api/dispatch-lots")
        if lots_res.status_code != 200 or len(lots_res.json()) == 0:
            pytest.skip("No dispatch lots available")
        
        lots = lots_res.json()
        # Find a lot that's not dispatched/delivered
        test_lot = None
        for lot in lots:
            if lot.get("status") not in ["DISPATCHED", "DELIVERED"]:
                test_lot = lot
                break
        
        if not test_lot:
            pytest.skip("No editable dispatch lot found")
        
        # Add a line
        response = requests.post(
            f"{BASE_URL}/api/dispatch-lots/{test_lot['id']}/add-line",
            json={
                "sku_id": TEST_SKU,
                "quantity": 50
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "message" in data, "Response should contain message"
        assert "line" in data, "Response should contain line"
        assert data["line"]["sku_id"] == TEST_SKU
        assert data["line"]["quantity"] == 50
        print(f"PASS: Added line to lot {test_lot.get('lot_code')}")
        print(f"  New lot total: {data.get('new_lot_total')}")
    
    def test_add_line_to_nonexistent_lot(self):
        """Test adding line to nonexistent lot returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/dispatch-lots/nonexistent-lot-id/add-line",
            json={
                "sku_id": TEST_SKU,
                "quantity": 50
            }
        )
        assert response.status_code == 404
        print("PASS: Returns 404 for nonexistent lot")


class TestDispatchLotsByBuyer:
    """Test GET /api/dispatch-lots/by-buyer/{buyer_id}"""
    
    def test_get_lots_by_buyer(self):
        """Test getting dispatch lots for a specific buyer"""
        response = requests.get(f"{BASE_URL}/api/dispatch-lots/by-buyer/{TEST_BUYER_ID}")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        
        # All lots should belong to the buyer
        for lot in data:
            assert lot.get("buyer_id") == TEST_BUYER_ID, f"Lot {lot.get('lot_code')} has wrong buyer"
        
        print(f"PASS: Found {len(data)} lots for buyer {TEST_BUYER_ID}")
    
    def test_get_lots_by_buyer_excludes_completed(self):
        """Test that completed lots are excluded by default"""
        response = requests.get(
            f"{BASE_URL}/api/dispatch-lots/by-buyer/{TEST_BUYER_ID}",
            params={"exclude_completed": True}
        )
        assert response.status_code == 200
        data = response.json()
        
        # No DISPATCHED or DELIVERED lots
        for lot in data:
            assert lot.get("status") not in ["DISPATCHED", "DELIVERED"], \
                f"Lot {lot.get('lot_code')} should be excluded (status: {lot.get('status')})"
        
        print(f"PASS: Correctly excludes completed lots")


class TestBranchModelCapacityUpload:
    """Test POST /api/branches/model-capacity/upload"""
    
    def test_upload_model_capacity_success(self):
        """Test uploading model-specific capacity"""
        # First get a model ID
        models_res = requests.get(f"{BASE_URL}/api/models")
        if models_res.status_code != 200 or len(models_res.json()) == 0:
            pytest.skip("No models available")
        
        model_id = models_res.json()[0]["id"]
        next_month = (datetime.now() + timedelta(days=30)).strftime("%Y-%m")
        
        response = requests.post(
            f"{BASE_URL}/api/branches/model-capacity/upload",
            json={
                "branch": TEST_BRANCH,
                "capacities": [
                    {
                        "month": next_month,
                        "day": 15,
                        "model_id": model_id,
                        "capacity_qty": 100
                    }
                ]
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "message" in data
        assert "inserted" in data or "updated" in data
        print(f"PASS: Uploaded model capacity")
        print(f"  Inserted: {data.get('inserted', 0)}, Updated: {data.get('updated', 0)}")
    
    def test_upload_model_capacity_invalid_branch(self):
        """Test uploading to invalid branch returns 404"""
        models_res = requests.get(f"{BASE_URL}/api/models")
        if models_res.status_code != 200 or len(models_res.json()) == 0:
            pytest.skip("No models available")
        
        model_id = models_res.json()[0]["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/branches/model-capacity/upload",
            json={
                "branch": "INVALID_BRANCH_XYZ",
                "capacities": [
                    {
                        "month": "2026-03",
                        "day": 15,
                        "model_id": model_id,
                        "capacity_qty": 100
                    }
                ]
            }
        )
        
        assert response.status_code == 404
        print("PASS: Returns 404 for invalid branch")
    
    def test_upload_model_capacity_invalid_model(self):
        """Test uploading with invalid model returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/branches/model-capacity/upload",
            json={
                "branch": TEST_BRANCH,
                "capacities": [
                    {
                        "month": "2026-03",
                        "day": 15,
                        "model_id": "INVALID_MODEL_XYZ",
                        "capacity_qty": 100
                    }
                ]
            }
        )
        
        assert response.status_code == 400
        print("PASS: Returns 400 for invalid model")
    
    def test_upload_model_capacity_empty_data(self):
        """Test uploading empty capacity data returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/branches/model-capacity/upload",
            json={
                "branch": TEST_BRANCH,
                "capacities": []
            }
        )
        
        assert response.status_code == 400
        print("PASS: Returns 400 for empty capacity data")


class TestCPCDemandForecastsEndpoint:
    """Test GET /api/cpc/demand-forecasts"""
    
    def test_cpc_demand_forecasts_returns_data(self):
        """Test CPC demand forecasts endpoint returns enriched data"""
        response = requests.get(f"{BASE_URL}/api/cpc/demand-forecasts")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        
        if len(data) > 0:
            forecast = data[0]
            # Check for expected fields
            expected_fields = [
                "id", "forecast_code", "buyer_id", "sku_id", 
                "forecast_qty", "scheduled_qty", "remaining_qty",
                "is_fully_scheduled"
            ]
            for field in expected_fields:
                assert field in forecast, f"Missing field: {field}"
            
            print(f"PASS: CPC demand forecasts returns {len(data)} forecasts")
            print(f"  Sample: {forecast.get('forecast_code')} - {forecast.get('remaining_qty')} remaining")


class TestBranchModelCapacityGet:
    """Test GET /api/branches/{branch}/model-capacity"""
    
    def test_get_branch_model_capacity(self):
        """Test getting model-specific capacity for a branch"""
        response = requests.get(f"{BASE_URL}/api/branches/{TEST_BRANCH}/model-capacity")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        print(f"PASS: Found {len(data)} model capacity records for {TEST_BRANCH}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

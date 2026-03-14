"""
CPC (Central Production Control) Module Tests
Tests for: Dashboard, Production Schedules, Branch Capacity, Auto-Allocate, Branch Allocations
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCPCDashboard:
    """CPC Dashboard endpoint tests"""
    
    def test_get_cpc_dashboard(self):
        """Test GET /api/cpc/dashboard returns dashboard data"""
        response = requests.get(f"{BASE_URL}/api/cpc/dashboard")
        assert response.status_code == 200
        
        data = response.json()
        # Verify dashboard structure
        assert "pending_schedules" in data
        assert "in_progress_schedules" in data
        assert "todays_planned_quantity" in data
        assert "todays_completed_quantity" in data
        assert "branch_utilization" in data
        
        # Verify branch_utilization is a list
        assert isinstance(data["branch_utilization"], list)
        
        # Verify branch utilization structure
        if len(data["branch_utilization"]) > 0:
            branch = data["branch_utilization"][0]
            assert "branch" in branch
            assert "capacity" in branch
            assert "allocated" in branch
            assert "completed" in branch
            assert "utilization" in branch


class TestBranchCapacity:
    """Branch Capacity Management tests"""
    
    def test_get_branch_capacities(self):
        """Test GET /api/branches/capacity returns all branch capacities"""
        response = requests.get(f"{BASE_URL}/api/branches/capacity")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # Verify capacity structure
        if len(data) > 0:
            branch = data[0]
            assert "branch" in branch
            assert "capacity_units_per_day" in branch
            assert "allocated_today" in branch
            assert "available_today" in branch
            assert "utilization_percent" in branch
    
    def test_update_branch_capacity(self):
        """Test PUT /api/branches/{branch_name}/capacity updates capacity"""
        branch_name = "Unit 1 Vedica"
        new_capacity = 600
        
        response = requests.put(
            f"{BASE_URL}/api/branches/{branch_name}/capacity",
            json={"capacity_units_per_day": new_capacity}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        assert str(new_capacity) in data["message"]
        
        # Verify the update persisted
        get_response = requests.get(f"{BASE_URL}/api/branches/capacity")
        assert get_response.status_code == 200
        
        capacities = get_response.json()
        branch_capacity = next((b for b in capacities if b["branch"] == branch_name), None)
        assert branch_capacity is not None
        assert branch_capacity["capacity_units_per_day"] == new_capacity
        
        # Reset to original value
        requests.put(
            f"{BASE_URL}/api/branches/{branch_name}/capacity",
            json={"capacity_units_per_day": 500}
        )
    
    def test_update_nonexistent_branch_capacity(self):
        """Test PUT /api/branches/{branch_name}/capacity returns 404 for nonexistent branch"""
        response = requests.put(
            f"{BASE_URL}/api/branches/NONEXISTENT_BRANCH/capacity",
            json={"capacity_units_per_day": 100}
        )
        assert response.status_code == 404
    
    def test_get_branch_capacity_forecast(self):
        """Test GET /api/branches/{branch_name}/capacity-forecast returns 7-day forecast"""
        branch_name = "Unit 1 Vedica"
        
        response = requests.get(f"{BASE_URL}/api/branches/{branch_name}/capacity-forecast?days=7")
        assert response.status_code == 200
        
        data = response.json()
        assert "branch" in data
        assert data["branch"] == branch_name
        assert "capacity_units_per_day" in data
        assert "forecast" in data
        assert isinstance(data["forecast"], list)
        assert len(data["forecast"]) == 7
        
        # Verify forecast day structure
        day = data["forecast"][0]
        assert "date" in day
        assert "day" in day
        assert "capacity" in day
        assert "allocated" in day
        assert "available" in day
        assert "utilization_percent" in day
    
    def test_get_nonexistent_branch_forecast(self):
        """Test GET /api/branches/{branch_name}/capacity-forecast returns 404 for nonexistent branch"""
        response = requests.get(f"{BASE_URL}/api/branches/NONEXISTENT_BRANCH/capacity-forecast?days=7")
        assert response.status_code == 404


class TestProductionSchedules:
    """Production Schedules CRUD tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get a valid SKU for testing"""
        response = requests.get(f"{BASE_URL}/api/skus")
        if response.status_code == 200 and len(response.json()) > 0:
            self.test_sku_id = response.json()[0]["sku_id"]
        else:
            self.test_sku_id = "FC_KS_BE_115"  # Fallback
    
    def test_get_production_schedules(self):
        """Test GET /api/production-schedules returns list of schedules"""
        response = requests.get(f"{BASE_URL}/api/production-schedules")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # Verify schedule structure if any exist
        if len(data) > 0:
            schedule = data[0]
            assert "id" in schedule
            assert "schedule_code" in schedule
            assert "sku_id" in schedule
            assert "target_quantity" in schedule
            assert "allocated_quantity" in schedule or "total_allocated" in schedule
            assert "status" in schedule
    
    def test_create_production_schedule(self):
        """Test POST /api/production-schedules creates a new schedule"""
        target_date = (datetime.now() + timedelta(days=14)).isoformat()
        
        payload = {
            "sku_id": self.test_sku_id,
            "target_quantity": 200,
            "target_date": target_date,
            "priority": "MEDIUM",
            "notes": "TEST_CPC_SCHEDULE"
        }
        
        response = requests.post(f"{BASE_URL}/api/production-schedules", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert "schedule_code" in data
        assert data["sku_id"] == self.test_sku_id
        assert data["target_quantity"] == 200
        assert data["status"] == "DRAFT"
        
        # Store for cleanup
        self.created_schedule_id = data["id"]
        self.created_schedule_code = data["schedule_code"]
    
    def test_create_schedule_with_invalid_sku(self):
        """Test POST /api/production-schedules returns 404 for invalid SKU"""
        target_date = (datetime.now() + timedelta(days=14)).isoformat()
        
        payload = {
            "sku_id": "INVALID_SKU_12345",
            "target_quantity": 100,
            "target_date": target_date,
            "priority": "LOW"
        }
        
        response = requests.post(f"{BASE_URL}/api/production-schedules", json=payload)
        assert response.status_code == 404
    
    def test_get_production_schedule_by_id(self):
        """Test GET /api/production-schedules/{schedule_id} returns schedule details"""
        # First get list to find an existing schedule
        list_response = requests.get(f"{BASE_URL}/api/production-schedules")
        assert list_response.status_code == 200
        
        schedules = list_response.json()
        if len(schedules) == 0:
            pytest.skip("No schedules exist to test")
        
        schedule_id = schedules[0]["id"]
        
        response = requests.get(f"{BASE_URL}/api/production-schedules/{schedule_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["id"] == schedule_id
        assert "allocations" in data
        assert "total_allocated" in data
        assert "total_completed" in data
    
    def test_filter_schedules_by_status(self):
        """Test GET /api/production-schedules?status=DRAFT filters by status"""
        response = requests.get(f"{BASE_URL}/api/production-schedules?status=DRAFT")
        assert response.status_code == 200
        
        data = response.json()
        # All returned schedules should have DRAFT status
        for schedule in data:
            assert schedule["status"] == "DRAFT"


class TestBranchAllocations:
    """Branch Allocation tests"""
    
    def test_create_branch_allocation(self):
        """Test POST /api/branch-allocations creates allocation"""
        # First get a schedule to allocate
        schedules_response = requests.get(f"{BASE_URL}/api/production-schedules")
        assert schedules_response.status_code == 200
        
        schedules = schedules_response.json()
        # Find a schedule that's not fully allocated
        schedule = next((s for s in schedules if s.get("total_allocated", 0) < s["target_quantity"]), None)
        
        if not schedule:
            pytest.skip("No schedules available for allocation")
        
        planned_date = (datetime.now() + timedelta(days=7)).isoformat()
        
        payload = {
            "schedule_id": schedule["id"],
            "branch": "Unit 1 Vedica",
            "allocated_quantity": 50,
            "planned_date": planned_date
        }
        
        response = requests.post(f"{BASE_URL}/api/branch-allocations", json=payload)
        # Could be 200 or 400 if capacity exceeded
        assert response.status_code in [200, 400]
        
        if response.status_code == 200:
            data = response.json()
            assert "id" in data
            assert data["branch"] == "Unit 1 Vedica"
            assert data["allocated_quantity"] == 50
            assert data["status"] == "PENDING"
    
    def test_create_allocation_invalid_schedule(self):
        """Test POST /api/branch-allocations returns 404 for invalid schedule"""
        planned_date = (datetime.now() + timedelta(days=7)).isoformat()
        
        payload = {
            "schedule_id": "invalid-schedule-id-12345",
            "branch": "Unit 1 Vedica",
            "allocated_quantity": 50,
            "planned_date": planned_date
        }
        
        response = requests.post(f"{BASE_URL}/api/branch-allocations", json=payload)
        assert response.status_code == 404


class TestAutoAllocate:
    """Auto-Allocate functionality tests"""
    
    def test_auto_allocate_production(self):
        """Test POST /api/branch-allocations/auto-allocate distributes production"""
        # First create a new schedule for testing
        skus_response = requests.get(f"{BASE_URL}/api/skus")
        if skus_response.status_code != 200 or len(skus_response.json()) == 0:
            pytest.skip("No SKUs available")
        
        sku_id = skus_response.json()[0]["sku_id"]
        target_date = (datetime.now() + timedelta(days=21)).isoformat()
        
        # Create schedule
        schedule_payload = {
            "sku_id": sku_id,
            "target_quantity": 300,
            "target_date": target_date,
            "priority": "HIGH",
            "notes": "TEST_AUTO_ALLOCATE"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/production-schedules", json=schedule_payload)
        if create_response.status_code != 200:
            pytest.skip("Could not create test schedule")
        
        schedule_id = create_response.json()["id"]
        
        # Auto-allocate
        allocate_payload = {
            "schedule_id": schedule_id,
            "preferred_branches": None
        }
        
        response = requests.post(f"{BASE_URL}/api/branch-allocations/auto-allocate", json=allocate_payload)
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        assert "allocations" in data
        assert isinstance(data["allocations"], list)
    
    def test_auto_allocate_with_preferred_branches(self):
        """Test auto-allocate with preferred branches filter"""
        # Get existing schedules
        schedules_response = requests.get(f"{BASE_URL}/api/production-schedules?status=DRAFT")
        schedules = schedules_response.json()
        
        if len(schedules) == 0:
            pytest.skip("No DRAFT schedules available")
        
        schedule = schedules[0]
        
        allocate_payload = {
            "schedule_id": schedule["id"],
            "preferred_branches": ["Unit 1 Vedica", "Unit 2 Trikes"]
        }
        
        response = requests.post(f"{BASE_URL}/api/branch-allocations/auto-allocate", json=allocate_payload)
        assert response.status_code == 200
        
        data = response.json()
        # Allocations should only be to preferred branches
        for alloc in data.get("allocations", []):
            assert alloc["branch"] in ["Unit 1 Vedica", "Unit 2 Trikes"]
    
    def test_auto_allocate_invalid_schedule(self):
        """Test auto-allocate returns 404 for invalid schedule"""
        payload = {
            "schedule_id": "invalid-schedule-id-12345"
        }
        
        response = requests.post(f"{BASE_URL}/api/branch-allocations/auto-allocate", json=payload)
        assert response.status_code == 404


class TestAllocationStatusTransitions:
    """Allocation status transition tests"""
    
    def test_start_production(self):
        """Test PUT /api/branch-allocations/{id}/start transitions to IN_PROGRESS"""
        # Find a PENDING allocation
        schedules_response = requests.get(f"{BASE_URL}/api/production-schedules")
        schedules = schedules_response.json()
        
        pending_allocation = None
        for schedule in schedules:
            for alloc in schedule.get("allocations", []):
                if alloc.get("status") == "PENDING":
                    pending_allocation = alloc
                    break
            if pending_allocation:
                break
        
        if not pending_allocation:
            pytest.skip("No PENDING allocations available")
        
        response = requests.put(f"{BASE_URL}/api/branch-allocations/{pending_allocation['id']}/start")
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        assert "started" in data["message"].lower()
    
    def test_start_production_invalid_allocation(self):
        """Test start production returns 400 for invalid allocation"""
        response = requests.put(f"{BASE_URL}/api/branch-allocations/invalid-id-12345/start")
        assert response.status_code == 400


class TestScheduleSuggestions:
    """Schedule Suggestions tests"""
    
    def test_get_schedule_suggestions(self):
        """Test GET /api/cpc/schedule-suggestions returns dispatch lots needing scheduling"""
        response = requests.get(f"{BASE_URL}/api/cpc/schedule-suggestions")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # Verify suggestion structure if any exist
        if len(data) > 0:
            suggestion = data[0]
            assert "dispatch_lot_id" in suggestion
            assert "lot_code" in suggestion
            assert "sku_id" in suggestion
            assert "required_quantity" in suggestion


class TestCPCIntegration:
    """Integration tests for complete CPC workflow"""
    
    def test_complete_cpc_workflow(self):
        """Test complete workflow: Create schedule -> Auto-allocate -> Start production"""
        # 1. Get SKU
        skus_response = requests.get(f"{BASE_URL}/api/skus")
        if skus_response.status_code != 200 or len(skus_response.json()) == 0:
            pytest.skip("No SKUs available")
        
        sku = skus_response.json()[0]
        
        # 2. Create production schedule
        target_date = (datetime.now() + timedelta(days=28)).isoformat()
        schedule_payload = {
            "sku_id": sku["sku_id"],
            "target_quantity": 150,
            "target_date": target_date,
            "priority": "MEDIUM",
            "notes": "TEST_INTEGRATION_WORKFLOW"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/production-schedules", json=schedule_payload)
        assert create_response.status_code == 200
        
        schedule = create_response.json()
        assert schedule["status"] == "DRAFT"
        
        # 3. Auto-allocate
        allocate_response = requests.post(
            f"{BASE_URL}/api/branch-allocations/auto-allocate",
            json={"schedule_id": schedule["id"]}
        )
        assert allocate_response.status_code == 200
        
        allocate_data = allocate_response.json()
        assert len(allocate_data.get("allocations", [])) > 0
        
        # 4. Verify schedule status updated
        get_response = requests.get(f"{BASE_URL}/api/production-schedules/{schedule['id']}")
        assert get_response.status_code == 200
        
        updated_schedule = get_response.json()
        assert updated_schedule["total_allocated"] > 0
        
        # 5. Verify dashboard reflects changes
        dashboard_response = requests.get(f"{BASE_URL}/api/cpc/dashboard")
        assert dashboard_response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

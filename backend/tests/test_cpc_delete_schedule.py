"""
Test CPC Delete Production Schedule Feature
Tests for soft-deleting production schedules for a specific month and branch.
Features tested:
- Preview-delete API returns correct schedules for given month and branch
- Soft-delete API marks schedules as DELETED without hard deleting them
- Deleted schedules are excluded from production-schedules API response
- deleted-completions API returns completed quantities from soft-deleted schedules
"""
import pytest
import requests
import os
from datetime import datetime, timedelta
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data
TEST_BRANCH = "Unit 1 Vedica"
TEST_MONTH = "2026-04"  # April 2026
TEST_SKU = "FC_KS_BE_115"  # Valid SKU from previous tests


class TestDeleteSchedulePreview:
    """Tests for GET /api/production-schedules/preview-delete endpoint"""
    
    def test_preview_delete_returns_schedules(self):
        """Test that preview-delete returns schedules for given month and branch"""
        response = requests.get(
            f"{BASE_URL}/api/production-schedules/preview-delete",
            params={"month": TEST_MONTH, "branch": TEST_BRANCH}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "month" in data
        assert "branch" in data
        assert "schedules" in data
        assert "summary" in data
        
        # Verify summary structure
        summary = data["summary"]
        assert "total_count" in summary
        assert "schedules_with_completion" in summary
        assert "total_target_quantity" in summary
        assert "total_completed_quantity" in summary
        
        print(f"Preview delete returned {summary['total_count']} schedules for {TEST_BRANCH} in {TEST_MONTH}")
    
    def test_preview_delete_invalid_month_format(self):
        """Test that preview-delete rejects invalid month format"""
        response = requests.get(
            f"{BASE_URL}/api/production-schedules/preview-delete",
            params={"month": "04-2026", "branch": TEST_BRANCH}  # Wrong format
        )
        
        assert response.status_code == 400
        assert "Invalid month format" in response.json().get("detail", "")
    
    def test_preview_delete_past_month_rejected(self):
        """Test that preview-delete rejects past months"""
        past_month = "2025-01"  # Past month
        response = requests.get(
            f"{BASE_URL}/api/production-schedules/preview-delete",
            params={"month": past_month, "branch": TEST_BRANCH}
        )
        
        assert response.status_code == 400
        assert "past months" in response.json().get("detail", "").lower()
    
    def test_preview_delete_missing_params(self):
        """Test that preview-delete requires both month and branch"""
        # Missing branch
        response = requests.get(
            f"{BASE_URL}/api/production-schedules/preview-delete",
            params={"month": TEST_MONTH}
        )
        assert response.status_code == 422  # Validation error
        
        # Missing month
        response = requests.get(
            f"{BASE_URL}/api/production-schedules/preview-delete",
            params={"branch": TEST_BRANCH}
        )
        assert response.status_code == 422


class TestBulkSoftDelete:
    """Tests for POST /api/production-schedules/bulk-soft-delete endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup_test_schedule(self):
        """Create a test schedule before each test"""
        # Create a test schedule for April 2026
        target_date = datetime(2026, 4, 15, 10, 0, 0)
        
        schedule_data = {
            "sku_id": TEST_SKU,
            "branch": TEST_BRANCH,
            "target_quantity": 50,
            "target_date": target_date.isoformat(),
            "priority": "MEDIUM",
            "notes": "TEST_DELETE_SCHEDULE"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/production-schedules",
            json=schedule_data
        )
        
        if response.status_code == 201:
            self.test_schedule_id = response.json().get("id")
            self.test_schedule_code = response.json().get("schedule_code")
            print(f"Created test schedule: {self.test_schedule_code}")
        else:
            self.test_schedule_id = None
            self.test_schedule_code = None
            print(f"Could not create test schedule: {response.status_code} - {response.text}")
        
        yield
        
        # Cleanup is not needed since we're soft-deleting
    
    def test_bulk_soft_delete_success(self):
        """Test that bulk-soft-delete marks schedules as DELETED"""
        # First, get preview to see what will be deleted
        preview_response = requests.get(
            f"{BASE_URL}/api/production-schedules/preview-delete",
            params={"month": TEST_MONTH, "branch": TEST_BRANCH}
        )
        
        if preview_response.status_code != 200:
            pytest.skip("Could not get preview")
        
        preview_data = preview_response.json()
        initial_count = preview_data["summary"]["total_count"]
        
        if initial_count == 0:
            pytest.skip("No schedules to delete")
        
        # Perform soft delete
        response = requests.post(
            f"{BASE_URL}/api/production-schedules/bulk-soft-delete",
            json={"month": TEST_MONTH, "branch": TEST_BRANCH}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "deleted_count" in data
        assert data["deleted_count"] > 0
        assert "message" in data
        
        print(f"Soft-deleted {data['deleted_count']} schedules")
        
        # Verify schedules are no longer in preview (they're now DELETED)
        verify_response = requests.get(
            f"{BASE_URL}/api/production-schedules/preview-delete",
            params={"month": TEST_MONTH, "branch": TEST_BRANCH}
        )
        
        assert verify_response.status_code == 200
        verify_data = verify_response.json()
        assert verify_data["summary"]["total_count"] == 0, "Deleted schedules should not appear in preview"
    
    def test_bulk_soft_delete_invalid_month(self):
        """Test that bulk-soft-delete rejects invalid month format"""
        response = requests.post(
            f"{BASE_URL}/api/production-schedules/bulk-soft-delete",
            json={"month": "invalid", "branch": TEST_BRANCH}
        )
        
        assert response.status_code == 400
    
    def test_bulk_soft_delete_past_month_rejected(self):
        """Test that bulk-soft-delete rejects past months"""
        response = requests.post(
            f"{BASE_URL}/api/production-schedules/bulk-soft-delete",
            json={"month": "2025-01", "branch": TEST_BRANCH}
        )
        
        assert response.status_code == 400
        assert "past months" in response.json().get("detail", "").lower()
    
    def test_bulk_soft_delete_no_schedules(self):
        """Test that bulk-soft-delete handles no schedules gracefully"""
        # Use a future month with no schedules
        future_month = "2027-12"
        response = requests.post(
            f"{BASE_URL}/api/production-schedules/bulk-soft-delete",
            json={"month": future_month, "branch": TEST_BRANCH}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["deleted_count"] == 0


class TestDeletedSchedulesExclusion:
    """Tests to verify deleted schedules are excluded from normal queries"""
    
    def test_deleted_schedules_excluded_from_list(self):
        """Test that deleted schedules don't appear in production-schedules list"""
        response = requests.get(f"{BASE_URL}/api/production-schedules")
        
        assert response.status_code == 200
        
        schedules = response.json()
        
        # Verify no DELETED schedules in the response
        for schedule in schedules:
            assert schedule.get("status") != "DELETED", f"Found DELETED schedule in list: {schedule.get('schedule_code')}"
        
        print(f"Verified {len(schedules)} schedules - none have DELETED status")


class TestDeletedCompletions:
    """Tests for GET /api/production-schedules/deleted-completions endpoint"""
    
    def test_deleted_completions_returns_data(self):
        """Test that deleted-completions returns completed quantities from deleted schedules"""
        response = requests.get(
            f"{BASE_URL}/api/production-schedules/deleted-completions",
            params={"month": TEST_MONTH, "branch": TEST_BRANCH}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "month" in data
        assert "branch" in data
        assert "completions" in data
        assert "count" in data
        
        print(f"Found {data['count']} deleted schedules with completed quantities")
        
        # If there are completions, verify structure
        if data["count"] > 0:
            for key, completion in data["completions"].items():
                assert "completed_quantity" in completion
                assert "deleted_schedule_id" in completion
                assert "target_date" in completion
                assert "sku_id" in completion
    
    def test_deleted_completions_invalid_month(self):
        """Test that deleted-completions rejects invalid month format"""
        response = requests.get(
            f"{BASE_URL}/api/production-schedules/deleted-completions",
            params={"month": "invalid", "branch": TEST_BRANCH}
        )
        
        assert response.status_code == 400
    
    def test_deleted_completions_missing_params(self):
        """Test that deleted-completions requires both month and branch"""
        # Missing branch
        response = requests.get(
            f"{BASE_URL}/api/production-schedules/deleted-completions",
            params={"month": TEST_MONTH}
        )
        assert response.status_code == 422
        
        # Missing month
        response = requests.get(
            f"{BASE_URL}/api/production-schedules/deleted-completions",
            params={"branch": TEST_BRANCH}
        )
        assert response.status_code == 422


class TestBranchesCapacity:
    """Tests for branch capacity endpoint (needed for delete schedule UI)"""
    
    def test_get_branch_capacities(self):
        """Test that branch capacities endpoint returns data"""
        response = requests.get(f"{BASE_URL}/api/branches/capacity")
        
        assert response.status_code == 200
        
        branches = response.json()
        assert isinstance(branches, list)
        assert len(branches) > 0
        
        # Verify Unit 1 Vedica exists
        vedica_branch = next((b for b in branches if b.get("branch") == TEST_BRANCH), None)
        assert vedica_branch is not None, f"Branch '{TEST_BRANCH}' not found in capacities"
        
        print(f"Found {len(branches)} branches with capacity data")
        print(f"Test branch '{TEST_BRANCH}' capacity: {vedica_branch.get('capacity_units_per_day')}")


class TestEndToEndDeleteFlow:
    """End-to-end test for the delete schedule flow"""
    
    def test_complete_delete_flow(self):
        """Test the complete flow: create schedule -> preview -> delete -> verify exclusion"""
        # Step 1: Create a test schedule
        target_date = datetime(2026, 4, 20, 10, 0, 0)
        schedule_data = {
            "sku_id": TEST_SKU,
            "branch": TEST_BRANCH,
            "target_quantity": 25,
            "target_date": target_date.isoformat(),
            "priority": "LOW",
            "notes": "TEST_E2E_DELETE"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/production-schedules",
            json=schedule_data
        )
        
        if create_response.status_code != 201:
            pytest.skip(f"Could not create test schedule: {create_response.text}")
        
        created_schedule = create_response.json()
        schedule_id = created_schedule.get("id")
        schedule_code = created_schedule.get("schedule_code")
        print(f"Step 1: Created schedule {schedule_code}")
        
        # Step 2: Preview delete - should include our schedule
        preview_response = requests.get(
            f"{BASE_URL}/api/production-schedules/preview-delete",
            params={"month": TEST_MONTH, "branch": TEST_BRANCH}
        )
        
        assert preview_response.status_code == 200
        preview_data = preview_response.json()
        
        schedule_in_preview = any(
            s.get("id") == schedule_id for s in preview_data.get("schedules", [])
        )
        assert schedule_in_preview, f"Created schedule {schedule_code} should be in preview"
        print(f"Step 2: Schedule {schedule_code} found in preview")
        
        # Step 3: Perform soft delete
        delete_response = requests.post(
            f"{BASE_URL}/api/production-schedules/bulk-soft-delete",
            json={"month": TEST_MONTH, "branch": TEST_BRANCH}
        )
        
        assert delete_response.status_code == 200
        delete_data = delete_response.json()
        assert delete_data["deleted_count"] > 0
        print(f"Step 3: Soft-deleted {delete_data['deleted_count']} schedules")
        
        # Step 4: Verify schedule is excluded from normal list
        list_response = requests.get(f"{BASE_URL}/api/production-schedules")
        assert list_response.status_code == 200
        
        schedules = list_response.json()
        schedule_in_list = any(s.get("id") == schedule_id for s in schedules)
        assert not schedule_in_list, f"Deleted schedule {schedule_code} should NOT be in list"
        print(f"Step 4: Schedule {schedule_code} correctly excluded from list")
        
        # Step 5: Verify schedule is excluded from preview (already deleted)
        verify_preview = requests.get(
            f"{BASE_URL}/api/production-schedules/preview-delete",
            params={"month": TEST_MONTH, "branch": TEST_BRANCH}
        )
        
        assert verify_preview.status_code == 200
        verify_data = verify_preview.json()
        
        schedule_still_in_preview = any(
            s.get("id") == schedule_id for s in verify_data.get("schedules", [])
        )
        assert not schedule_still_in_preview, f"Deleted schedule should not be in preview"
        print(f"Step 5: Schedule {schedule_code} correctly excluded from preview")
        
        print("End-to-end delete flow completed successfully!")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

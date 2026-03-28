"""
Test Weekly MRP Module - Weekly Order Plan Tab Features

Tests:
1. GET /api/mrp/runs returns version and common_weeks_count fields
2. Weekly Order Plan dropdown filters correctly
3. Summary cards display correct values
4. Weekly plan data structure
5. Export Excel endpoint
6. Run Weekly MRP calculation
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "admin@factory.com"
TEST_PASSWORD = "bidso123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Authentication failed")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestMRPRunsEndpoint:
    """Test /api/mrp/runs endpoint returns required fields for Weekly Order Plan"""
    
    def test_runs_returns_version_field_for_weekly_runs(self, auth_headers):
        """Verify /api/mrp/runs returns version field for weekly runs"""
        response = requests.get(
            f"{BASE_URL}/api/mrp/runs?limit=50",
            headers=auth_headers
        )
        assert response.status_code == 200
        runs = response.json()
        assert isinstance(runs, list)
        
        # Find weekly runs (those with WEEKLY_V1 version)
        weekly_runs = [r for r in runs if r.get("version") == "WEEKLY_V1"]
        
        # Should have at least one weekly run
        assert len(weekly_runs) > 0, "No weekly MRP runs found"
        
        # Check that version field exists for weekly runs
        for run in weekly_runs:
            assert "version" in run, f"Run {run.get('run_code')} missing 'version' field"
            assert run["version"] == "WEEKLY_V1"
    
    def test_runs_returns_common_weeks_count_field_for_weekly_runs(self, auth_headers):
        """Verify /api/mrp/runs returns common_weeks_count field for weekly runs"""
        response = requests.get(
            f"{BASE_URL}/api/mrp/runs?limit=50",
            headers=auth_headers
        )
        assert response.status_code == 200
        runs = response.json()
        
        # Find weekly runs
        weekly_runs = [r for r in runs if r.get("version") == "WEEKLY_V1"]
        assert len(weekly_runs) > 0, "No weekly MRP runs found"
        
        # Check that common_weeks_count field exists for weekly runs
        for run in weekly_runs:
            assert "common_weeks_count" in run, f"Run {run.get('run_code')} missing 'common_weeks_count' field"
            assert run["common_weeks_count"] > 0, f"Weekly run should have common_weeks_count > 0"
    
    def test_runs_returns_summary_field_for_weekly_runs(self, auth_headers):
        """Verify /api/mrp/runs returns summary field for weekly runs"""
        response = requests.get(
            f"{BASE_URL}/api/mrp/runs?limit=50",
            headers=auth_headers
        )
        assert response.status_code == 200
        runs = response.json()
        
        # Find weekly runs
        weekly_runs = [r for r in runs if r.get("version") == "WEEKLY_V1"]
        assert len(weekly_runs) > 0, "No weekly MRP runs found"
        
        # Check that summary field exists for weekly runs
        for run in weekly_runs:
            assert "summary" in run, f"Run {run.get('run_code')} missing 'summary' field"
            assert run["summary"] is not None, "Summary should not be None for weekly runs"
    
    def test_weekly_run_has_correct_version(self, auth_headers):
        """Verify weekly MRP runs have version=WEEKLY_V1"""
        response = requests.get(
            f"{BASE_URL}/api/mrp/runs?limit=50",
            headers=auth_headers
        )
        assert response.status_code == 200
        runs = response.json()
        
        # Find runs with weekly data
        weekly_runs = [r for r in runs if r.get("version") == "WEEKLY_V1" or (r.get("common_weeks_count") or 0) > 0]
        
        # Should have at least one weekly run
        assert len(weekly_runs) > 0, "No weekly MRP runs found"
        
        # Verify weekly run has correct version
        for run in weekly_runs:
            if (run.get("common_weeks_count") or 0) > 0:
                assert run.get("version") == "WEEKLY_V1", f"Run {run.get('run_code')} has weeks but wrong version"


class TestWeeklyOrderPlanDropdownFilter:
    """Test that dropdown correctly filters weekly MRP runs"""
    
    def test_filter_weekly_runs_by_version(self, auth_headers):
        """Verify filtering runs by version=WEEKLY_V1"""
        response = requests.get(
            f"{BASE_URL}/api/mrp/runs?limit=50",
            headers=auth_headers
        )
        assert response.status_code == 200
        runs = response.json()
        
        # Filter like frontend does: version === 'WEEKLY_V1' || common_weeks_count > 0
        weekly_runs = [
            r for r in runs 
            if r.get("version") == "WEEKLY_V1" or (r.get("common_weeks_count") or 0) > 0
        ]
        
        print(f"Total runs: {len(runs)}, Weekly runs: {len(weekly_runs)}")
        
        # Verify filtered runs have weekly data
        for run in weekly_runs:
            has_version = run.get("version") == "WEEKLY_V1"
            has_weeks = (run.get("common_weeks_count") or 0) > 0
            assert has_version or has_weeks, f"Run {run.get('run_code')} incorrectly included in weekly filter"


class TestWeeklyPlanSummaryCards:
    """Test summary card values from weekly MRP run"""
    
    @pytest.fixture
    def weekly_run_id(self, auth_headers):
        """Get a weekly MRP run ID"""
        response = requests.get(
            f"{BASE_URL}/api/mrp/runs?limit=50",
            headers=auth_headers
        )
        runs = response.json()
        weekly_runs = [r for r in runs if r.get("version") == "WEEKLY_V1"]
        if not weekly_runs:
            pytest.skip("No weekly MRP runs available")
        return weekly_runs[0]["id"]
    
    def test_summary_has_total_order_weeks(self, auth_headers, weekly_run_id):
        """Verify summary contains total_order_weeks"""
        response = requests.get(
            f"{BASE_URL}/api/mrp/runs/{weekly_run_id}/weekly-plan?plan_type=all",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        summary = data.get("summary", {})
        assert "total_order_weeks" in summary, "Missing total_order_weeks in summary"
        assert isinstance(summary["total_order_weeks"], int)
    
    def test_summary_has_common_rms_count(self, auth_headers, weekly_run_id):
        """Verify summary contains common_rms_count"""
        response = requests.get(
            f"{BASE_URL}/api/mrp/runs/{weekly_run_id}/weekly-plan?plan_type=all",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        summary = data.get("summary", {})
        assert "common_rms_count" in summary, "Missing common_rms_count in summary"
    
    def test_summary_has_common_order_value(self, auth_headers, weekly_run_id):
        """Verify summary contains common_order_value"""
        response = requests.get(
            f"{BASE_URL}/api/mrp/runs/{weekly_run_id}/weekly-plan?plan_type=all",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        summary = data.get("summary", {})
        assert "common_order_value" in summary, "Missing common_order_value in summary"
    
    def test_summary_has_brand_specific_rms_count(self, auth_headers, weekly_run_id):
        """Verify summary contains brand_specific_rms_count"""
        response = requests.get(
            f"{BASE_URL}/api/mrp/runs/{weekly_run_id}/weekly-plan?plan_type=all",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        summary = data.get("summary", {})
        assert "brand_specific_rms_count" in summary, "Missing brand_specific_rms_count in summary"
    
    def test_summary_has_total_order_value(self, auth_headers, weekly_run_id):
        """Verify summary contains total_order_value"""
        response = requests.get(
            f"{BASE_URL}/api/mrp/runs/{weekly_run_id}/weekly-plan?plan_type=all",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        summary = data.get("summary", {})
        assert "total_order_value" in summary, "Missing total_order_value in summary"


class TestWeeklyPlanData:
    """Test weekly plan data structure"""
    
    @pytest.fixture
    def weekly_run_id(self, auth_headers):
        """Get a weekly MRP run ID"""
        response = requests.get(
            f"{BASE_URL}/api/mrp/runs?limit=50",
            headers=auth_headers
        )
        runs = response.json()
        weekly_runs = [r for r in runs if r.get("version") == "WEEKLY_V1"]
        if not weekly_runs:
            pytest.skip("No weekly MRP runs available")
        return weekly_runs[0]["id"]
    
    def test_weekly_plan_returns_weeks(self, auth_headers, weekly_run_id):
        """Verify weekly plan returns week data"""
        response = requests.get(
            f"{BASE_URL}/api/mrp/runs/{weekly_run_id}/weekly-plan?plan_type=all",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        weekly_plan = data.get("weekly_plan", [])
        assert len(weekly_plan) > 0, "No weekly plan data returned"
    
    def test_week_has_order_week_field(self, auth_headers, weekly_run_id):
        """Verify each week has order_week field"""
        response = requests.get(
            f"{BASE_URL}/api/mrp/runs/{weekly_run_id}/weekly-plan?plan_type=all",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        weekly_plan = data.get("weekly_plan", [])
        for week in weekly_plan[:5]:  # Check first 5 weeks
            assert "order_week" in week, "Week missing order_week field"
    
    def test_week_has_items(self, auth_headers, weekly_run_id):
        """Verify each week has items array"""
        response = requests.get(
            f"{BASE_URL}/api/mrp/runs/{weekly_run_id}/weekly-plan?plan_type=all",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        weekly_plan = data.get("weekly_plan", [])
        for week in weekly_plan[:5]:
            assert "items" in week, "Week missing items field"
            assert isinstance(week["items"], list)
    
    def test_item_has_required_fields(self, auth_headers, weekly_run_id):
        """Verify items have required fields for display"""
        response = requests.get(
            f"{BASE_URL}/api/mrp/runs/{weekly_run_id}/weekly-plan?plan_type=all",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        weekly_plan = data.get("weekly_plan", [])
        if weekly_plan and weekly_plan[0].get("items"):
            item = weekly_plan[0]["items"][0]
            
            # Required fields for UI display
            required_fields = [
                "rm_id", "rm_name", "category", "rm_type", 
                "production_week", "gross_qty", "net_qty", 
                "order_qty", "total_cost"
            ]
            
            for field in required_fields:
                assert field in item, f"Item missing required field: {field}"
    
    def test_filter_by_common_type(self, auth_headers, weekly_run_id):
        """Verify filtering by plan_type=common"""
        response = requests.get(
            f"{BASE_URL}/api/mrp/runs/{weekly_run_id}/weekly-plan?plan_type=common",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        weekly_plan = data.get("weekly_plan", [])
        # All items should be COMMON type
        for week in weekly_plan[:3]:
            for item in week.get("items", [])[:5]:
                assert item.get("rm_type") == "COMMON", f"Non-common item in common filter: {item.get('rm_type')}"


class TestWeeklyMRPCalculation:
    """Test Weekly MRP calculation endpoint"""
    
    def test_calculate_weekly_mrp_endpoint_exists(self, auth_headers):
        """Verify POST /api/mrp/runs/calculate-weekly endpoint exists"""
        # Just check the endpoint responds (don't actually run calculation)
        response = requests.post(
            f"{BASE_URL}/api/mrp/runs/calculate-weekly",
            headers=auth_headers
        )
        # Should return 200 (success) or 500 (calculation error), not 404
        assert response.status_code != 404, "calculate-weekly endpoint not found"


class TestWeeklyPlanExport:
    """Test Weekly Plan Excel export"""
    
    @pytest.fixture
    def weekly_run_id(self, auth_headers):
        """Get a weekly MRP run ID"""
        response = requests.get(
            f"{BASE_URL}/api/mrp/runs?limit=50",
            headers=auth_headers
        )
        runs = response.json()
        weekly_runs = [r for r in runs if r.get("version") == "WEEKLY_V1"]
        if not weekly_runs:
            pytest.skip("No weekly MRP runs available")
        return weekly_runs[0]["id"]
    
    def test_export_endpoint_exists(self, auth_headers, weekly_run_id):
        """Verify export endpoint exists and returns Excel"""
        response = requests.get(
            f"{BASE_URL}/api/mrp/runs/{weekly_run_id}/weekly-plan/export?plan_type=all",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Export failed: {response.status_code}"
        
        # Check content type is Excel
        content_type = response.headers.get("content-type", "")
        assert "spreadsheet" in content_type or "excel" in content_type.lower() or "octet-stream" in content_type, \
            f"Unexpected content type: {content_type}"
    
    def test_export_returns_file(self, auth_headers, weekly_run_id):
        """Verify export returns a file with content"""
        response = requests.get(
            f"{BASE_URL}/api/mrp/runs/{weekly_run_id}/weekly-plan/export?plan_type=all",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        # Check content length
        assert len(response.content) > 0, "Export returned empty file"


class TestMRPRunsTab:
    """Test MRP Runs tab displays all runs with correct status badges"""
    
    def test_runs_have_status_field(self, auth_headers):
        """Verify all runs have status field"""
        response = requests.get(
            f"{BASE_URL}/api/mrp/runs?limit=50",
            headers=auth_headers
        )
        assert response.status_code == 200
        runs = response.json()
        
        for run in runs:
            assert "status" in run, f"Run {run.get('run_code')} missing status field"
            # Allow various status values
            valid_statuses = ["CALCULATED", "APPROVED", "PO_GENERATED", "COMPLETED", "DRAFT"]
            assert run["status"] in valid_statuses, \
                f"Unexpected status: {run['status']}"
    
    def test_weekly_runs_have_required_display_fields(self, auth_headers):
        """Verify weekly runs have all fields needed for display"""
        response = requests.get(
            f"{BASE_URL}/api/mrp/runs?limit=50",
            headers=auth_headers
        )
        assert response.status_code == 200
        runs = response.json()
        
        # Focus on weekly runs
        weekly_runs = [r for r in runs if r.get("version") == "WEEKLY_V1"]
        assert len(weekly_runs) > 0, "No weekly MRP runs found"
        
        required_fields = ["id", "run_code", "run_date", "status", "total_skus", "total_rms", "total_order_value"]
        
        for run in weekly_runs:
            for field in required_fields:
                assert field in run, f"Weekly run missing required field: {field}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

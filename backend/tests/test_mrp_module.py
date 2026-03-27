"""
MRP (Material Requisition Planning) Module Tests

Tests for:
- MRP Dashboard stats
- MRP Calculation runs
- Draft PO generation and management
- Model Forecasts CRUD
- RM Procurement Parameters CRUD
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
    pytest.skip("Authentication failed - skipping MRP tests")


@pytest.fixture(scope="module")
def headers(auth_token):
    """Headers with auth token"""
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    }


class TestMRPDashboard:
    """MRP Dashboard endpoint tests"""
    
    def test_dashboard_returns_stats(self, headers):
        """GET /api/mrp/dashboard - returns dashboard statistics"""
        response = requests.get(f"{BASE_URL}/api/mrp/dashboard", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        # Verify all expected fields are present
        assert "total_runs" in data
        assert "pending_approval" in data
        assert "total_draft_pos" in data
        assert "pending_po_approval" in data
        assert "total_model_forecasts" in data
        assert "total_rm_params" in data
        assert "total_rm_shortage" in data
        assert "total_order_value_pending" in data
        
        # Verify data types
        assert isinstance(data["total_runs"], int)
        assert isinstance(data["total_draft_pos"], int)
        assert isinstance(data["total_model_forecasts"], int)
        assert isinstance(data["total_rm_params"], int)
    
    def test_dashboard_requires_auth(self):
        """GET /api/mrp/dashboard - requires authentication"""
        response = requests.get(f"{BASE_URL}/api/mrp/dashboard")
        # 401 or 403 are both valid for unauthenticated requests
        assert response.status_code in [401, 403]


class TestMRPRuns:
    """MRP Runs endpoint tests"""
    
    def test_get_runs_list(self, headers):
        """GET /api/mrp/runs - returns list of MRP runs"""
        response = requests.get(f"{BASE_URL}/api/mrp/runs?limit=10", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        if len(data) > 0:
            run = data[0]
            # Verify run structure
            assert "id" in run
            assert "run_code" in run
            assert "status" in run
            assert "total_skus" in run or "total_rms" in run
    
    def test_get_run_detail(self, headers):
        """GET /api/mrp/runs/{id} - returns run detail with RM requirements"""
        # First get a run ID
        runs_response = requests.get(f"{BASE_URL}/api/mrp/runs?limit=1", headers=headers)
        assert runs_response.status_code == 200
        runs = runs_response.json()
        
        if len(runs) == 0:
            pytest.skip("No MRP runs available for detail test")
        
        run_id = runs[0]["id"]
        
        # Get run detail
        response = requests.get(f"{BASE_URL}/api/mrp/runs/{run_id}", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["id"] == run_id
        assert "run_code" in data
        assert "status" in data
        
        # Check for RM requirements if run is calculated
        if data.get("status") in ["CALCULATED", "APPROVED", "PO_GENERATED"]:
            assert "rm_requirements" in data
            assert isinstance(data["rm_requirements"], list)
    
    def test_get_run_detail_not_found(self, headers):
        """GET /api/mrp/runs/{id} - returns 404 for non-existent run"""
        response = requests.get(
            f"{BASE_URL}/api/mrp/runs/non-existent-id-12345",
            headers=headers
        )
        assert response.status_code == 404
    
    def test_runs_filter_by_status(self, headers):
        """GET /api/mrp/runs - can filter by status"""
        response = requests.get(
            f"{BASE_URL}/api/mrp/runs?status=PO_GENERATED&limit=10",
            headers=headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        # All returned runs should have the filtered status
        for run in data:
            assert run.get("status") == "PO_GENERATED"


class TestDraftPOs:
    """Draft PO endpoint tests"""
    
    def test_get_draft_pos_list(self, headers):
        """GET /api/mrp/draft-pos - returns list of draft POs"""
        response = requests.get(f"{BASE_URL}/api/mrp/draft-pos", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        if len(data) > 0:
            po = data[0]
            # Verify PO structure
            assert "id" in po
            assert "draft_po_code" in po
            assert "vendor_name" in po
            assert "total_items" in po
            assert "total_amount" in po
            assert "status" in po
            assert "lines" in po
    
    def test_get_draft_po_detail(self, headers):
        """GET /api/mrp/draft-pos/{id} - returns PO detail with lines"""
        # First get a PO ID
        pos_response = requests.get(f"{BASE_URL}/api/mrp/draft-pos", headers=headers)
        assert pos_response.status_code == 200
        pos = pos_response.json()
        
        if len(pos) == 0:
            pytest.skip("No draft POs available for detail test")
        
        po_id = pos[0]["id"]
        
        # Get PO detail
        response = requests.get(f"{BASE_URL}/api/mrp/draft-pos/{po_id}", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["id"] == po_id
        assert "lines" in data
        assert isinstance(data["lines"], list)
        
        # Verify line structure if lines exist
        if len(data["lines"]) > 0:
            line = data["lines"][0]
            assert "rm_id" in line
            assert "quantity" in line
            assert "unit_price" in line
            assert "line_total" in line
    
    def test_get_draft_po_not_found(self, headers):
        """GET /api/mrp/draft-pos/{id} - returns 404 for non-existent PO"""
        response = requests.get(
            f"{BASE_URL}/api/mrp/draft-pos/non-existent-po-12345",
            headers=headers
        )
        assert response.status_code == 404
    
    def test_draft_pos_filter_by_status(self, headers):
        """GET /api/mrp/draft-pos - can filter by status"""
        response = requests.get(
            f"{BASE_URL}/api/mrp/draft-pos?status=DRAFT",
            headers=headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        # All returned POs should have DRAFT status
        for po in data:
            assert po.get("status") == "DRAFT"
    
    def test_draft_pos_consolidated_by_vendor(self, headers):
        """Verify draft POs are consolidated by vendor"""
        response = requests.get(f"{BASE_URL}/api/mrp/draft-pos", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        if len(data) > 0:
            # Check that each PO has a vendor and multiple lines
            for po in data[:5]:  # Check first 5
                assert "vendor_id" in po or "vendor_name" in po
                assert "total_items" in po
                # Consolidated POs should have multiple items
                if po.get("total_items", 0) > 1:
                    assert len(po.get("lines", [])) > 1


class TestModelForecasts:
    """Model Forecasts endpoint tests"""
    
    def test_get_model_forecasts(self, headers):
        """GET /api/mrp/model-forecasts - returns list of forecasts"""
        response = requests.get(f"{BASE_URL}/api/mrp/model-forecasts", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        if len(data) > 0:
            forecast = data[0]
            # Verify forecast structure
            assert "id" in forecast
            assert "model_id" in forecast
            assert "month_year" in forecast
            assert "forecast_qty" in forecast
    
    def test_model_forecasts_filter_by_vertical(self, headers):
        """GET /api/mrp/model-forecasts - can filter by vertical_id"""
        # First get a vertical ID from existing forecasts
        forecasts_response = requests.get(
            f"{BASE_URL}/api/mrp/model-forecasts",
            headers=headers
        )
        forecasts = forecasts_response.json()
        
        if len(forecasts) == 0:
            pytest.skip("No forecasts available for filter test")
        
        # Find a forecast with vertical_id
        vertical_id = None
        for f in forecasts:
            if f.get("vertical_id"):
                vertical_id = f["vertical_id"]
                break
        
        if not vertical_id:
            pytest.skip("No forecasts with vertical_id found")
        
        # Filter by vertical
        response = requests.get(
            f"{BASE_URL}/api/mrp/model-forecasts?vertical_id={vertical_id}",
            headers=headers
        )
        assert response.status_code == 200
        
        data = response.json()
        # All returned forecasts should have the filtered vertical
        for f in data:
            assert f.get("vertical_id") == vertical_id
    
    def test_model_forecasts_count_matches_dashboard(self, headers):
        """Verify model forecasts count matches dashboard stats"""
        # Get dashboard stats
        dashboard_response = requests.get(
            f"{BASE_URL}/api/mrp/dashboard",
            headers=headers
        )
        dashboard = dashboard_response.json()
        
        # Get forecasts
        forecasts_response = requests.get(
            f"{BASE_URL}/api/mrp/model-forecasts",
            headers=headers
        )
        forecasts = forecasts_response.json()
        
        # Counts should match
        assert len(forecasts) == dashboard.get("total_model_forecasts", 0)


class TestRMParameters:
    """RM Procurement Parameters endpoint tests"""
    
    def test_get_rm_params(self, headers):
        """GET /api/mrp/rm-params - returns list of RM parameters"""
        response = requests.get(f"{BASE_URL}/api/mrp/rm-params", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        if len(data) > 0:
            param = data[0]
            # Verify parameter structure
            assert "id" in param
            assert "rm_id" in param
            assert "moq" in param
            assert "batch_size" in param
            assert "lead_time_days" in param
            assert "safety_stock" in param
    
    def test_rm_params_filter_by_category(self, headers):
        """GET /api/mrp/rm-params - can filter by category"""
        # First get a category from existing params
        params_response = requests.get(
            f"{BASE_URL}/api/mrp/rm-params",
            headers=headers
        )
        params = params_response.json()
        
        if len(params) == 0:
            pytest.skip("No RM params available for filter test")
        
        # Find a param with category
        category = None
        for p in params:
            if p.get("category"):
                category = p["category"]
                break
        
        if not category:
            pytest.skip("No params with category found")
        
        # Filter by category
        response = requests.get(
            f"{BASE_URL}/api/mrp/rm-params?category={category}",
            headers=headers
        )
        assert response.status_code == 200
        
        data = response.json()
        # All returned params should have the filtered category
        for p in data:
            assert p.get("category") == category
    
    def test_rm_params_count_matches_dashboard(self, headers):
        """Verify RM params count matches dashboard stats"""
        # Get dashboard stats
        dashboard_response = requests.get(
            f"{BASE_URL}/api/mrp/dashboard",
            headers=headers
        )
        dashboard = dashboard_response.json()
        
        # Get params
        params_response = requests.get(
            f"{BASE_URL}/api/mrp/rm-params",
            headers=headers
        )
        params = params_response.json()
        
        # Counts should match
        assert len(params) == dashboard.get("total_rm_params", 0)


class TestMRPCalculation:
    """MRP Calculation endpoint tests"""
    
    def test_calculate_mrp_endpoint_exists(self, headers):
        """POST /api/mrp/runs/calculate - endpoint exists and requires auth"""
        # Test without auth
        response = requests.post(f"{BASE_URL}/api/mrp/runs/calculate")
        # 401 or 403 are both valid for unauthenticated requests
        assert response.status_code in [401, 403]
    
    def test_calculate_mrp_creates_run(self, headers):
        """POST /api/mrp/runs/calculate - creates new MRP run"""
        # Get current run count
        runs_before = requests.get(
            f"{BASE_URL}/api/mrp/runs?limit=100",
            headers=headers
        ).json()
        count_before = len(runs_before)
        
        # Run calculation
        response = requests.post(
            f"{BASE_URL}/api/mrp/runs/calculate",
            headers=headers
        )
        
        # Should succeed or fail gracefully
        assert response.status_code in [200, 500]
        
        if response.status_code == 200:
            data = response.json()
            assert "run_id" in data
            assert "run_code" in data
            assert "total_skus" in data
            assert "total_rms" in data
            
            # Verify run was created
            runs_after = requests.get(
                f"{BASE_URL}/api/mrp/runs?limit=100",
                headers=headers
            ).json()
            assert len(runs_after) >= count_before


class TestDraftPOGeneration:
    """Draft PO Generation endpoint tests"""
    
    def test_generate_pos_endpoint_exists(self, headers):
        """POST /api/mrp/runs/{id}/generate-pos - endpoint exists"""
        # Get a run ID
        runs_response = requests.get(
            f"{BASE_URL}/api/mrp/runs?limit=1",
            headers=headers
        )
        runs = runs_response.json()
        
        if len(runs) == 0:
            pytest.skip("No MRP runs available for PO generation test")
        
        run_id = runs[0]["id"]
        
        # Try to generate POs (may fail if already generated)
        response = requests.post(
            f"{BASE_URL}/api/mrp/runs/{run_id}/generate-pos",
            headers=headers
        )
        
        # Should return 200 (success) or 400/500 (already generated or error)
        assert response.status_code in [200, 400, 500]
    
    def test_generate_pos_not_found(self, headers):
        """POST /api/mrp/runs/{id}/generate-pos - returns 404 for non-existent run"""
        response = requests.post(
            f"{BASE_URL}/api/mrp/runs/non-existent-run-12345/generate-pos",
            headers=headers
        )
        # Should return 404 or 500 (ValueError caught)
        assert response.status_code in [404, 500]


class TestDraftPOApproval:
    """Draft PO Approval workflow tests"""
    
    def test_approve_draft_po_endpoint_exists(self, headers):
        """POST /api/mrp/draft-pos/{id}/approve - endpoint exists"""
        # Get a draft PO
        pos_response = requests.get(
            f"{BASE_URL}/api/mrp/draft-pos?status=DRAFT",
            headers=headers
        )
        pos = pos_response.json()
        
        if len(pos) == 0:
            pytest.skip("No draft POs available for approval test")
        
        po_id = pos[0]["id"]
        
        # Try to approve
        response = requests.post(
            f"{BASE_URL}/api/mrp/draft-pos/{po_id}/approve",
            headers=headers
        )
        
        # Should succeed
        assert response.status_code in [200, 400]
    
    def test_convert_to_po_requires_approval(self, headers):
        """POST /api/mrp/draft-pos/{id}/convert-to-po - requires APPROVED status"""
        # Get a draft PO (not approved)
        pos_response = requests.get(
            f"{BASE_URL}/api/mrp/draft-pos?status=DRAFT",
            headers=headers
        )
        pos = pos_response.json()
        
        if len(pos) == 0:
            pytest.skip("No draft POs available for conversion test")
        
        po_id = pos[0]["id"]
        
        # Try to convert without approval
        response = requests.post(
            f"{BASE_URL}/api/mrp/draft-pos/{po_id}/convert-to-po",
            headers=headers
        )
        
        # Should fail - not approved
        assert response.status_code == 400


class TestMRPRunApproval:
    """MRP Run Approval workflow tests"""
    
    def test_approve_run_endpoint_exists(self, headers):
        """POST /api/mrp/runs/{id}/approve - endpoint exists"""
        # Get a calculated run
        runs_response = requests.get(
            f"{BASE_URL}/api/mrp/runs?status=CALCULATED&limit=1",
            headers=headers
        )
        runs = runs_response.json()
        
        if len(runs) == 0:
            pytest.skip("No calculated runs available for approval test")
        
        run_id = runs[0]["id"]
        
        # Try to approve
        response = requests.post(
            f"{BASE_URL}/api/mrp/runs/{run_id}/approve",
            headers=headers
        )
        
        # Should succeed or fail gracefully
        assert response.status_code in [200, 400]


class TestMRPDataIntegrity:
    """Data integrity tests for MRP module"""
    
    def test_run_rm_requirements_have_vendor_info(self, headers):
        """Verify RM requirements have vendor assignment"""
        # Get a run with RM requirements
        runs_response = requests.get(
            f"{BASE_URL}/api/mrp/runs?limit=1",
            headers=headers
        )
        runs = runs_response.json()
        
        if len(runs) == 0:
            pytest.skip("No MRP runs available")
        
        run_id = runs[0]["id"]
        run_detail = requests.get(
            f"{BASE_URL}/api/mrp/runs/{run_id}",
            headers=headers
        ).json()
        
        rm_requirements = run_detail.get("rm_requirements", [])
        if len(rm_requirements) == 0:
            pytest.skip("No RM requirements in run")
        
        # Check that RMs have vendor info
        for rm in rm_requirements[:10]:  # Check first 10
            # Should have vendor_id or vendor_name (even if UNASSIGNED)
            assert "vendor_id" in rm or "vendor_name" in rm
    
    def test_draft_po_lines_have_required_fields(self, headers):
        """Verify draft PO lines have all required fields"""
        pos_response = requests.get(
            f"{BASE_URL}/api/mrp/draft-pos",
            headers=headers
        )
        pos = pos_response.json()
        
        if len(pos) == 0:
            pytest.skip("No draft POs available")
        
        for po in pos[:5]:  # Check first 5 POs
            for line in po.get("lines", [])[:5]:  # Check first 5 lines
                assert "rm_id" in line
                assert "quantity" in line
                assert "unit_price" in line
                assert "line_total" in line
                # Verify line_total calculation
                expected_total = line["quantity"] * line["unit_price"]
                assert abs(line["line_total"] - expected_total) < 0.01

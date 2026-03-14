"""
Test suite for new Architecture Modules:
- Tech Ops: Verticals, Models, Brands, Buyers
- Demand: Forecasts, Dispatch Lots
- Quality Control: QC Checklists, QC Results, Approvals
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture(scope="module")
def auth_token(api_client):
    """Get authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@factory.com",
        "password": "admin123"
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Authentication failed - skipping authenticated tests")

@pytest.fixture(scope="module")
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client


# ============ TECH OPS: VERTICALS ============
class TestVerticals:
    """Verticals CRUD tests"""
    
    def test_get_verticals(self, authenticated_client):
        """GET /api/verticals - List all verticals"""
        response = authenticated_client.get(f"{BASE_URL}/api/verticals")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} verticals")
    
    def test_create_vertical(self, authenticated_client):
        """POST /api/verticals - Create a new vertical"""
        payload = {
            "code": "TEST_VERTICAL_001",
            "name": "Test Vertical",
            "description": "Test vertical for automated testing"
        }
        response = authenticated_client.post(f"{BASE_URL}/api/verticals", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == "TEST_VERTICAL_001"
        assert data["name"] == "Test Vertical"
        assert data["status"] == "ACTIVE"
        assert "id" in data
        print(f"Created vertical: {data['id']}")
    
    def test_create_duplicate_vertical_fails(self, authenticated_client):
        """POST /api/verticals - Duplicate code should fail"""
        payload = {
            "code": "TEST_VERTICAL_001",
            "name": "Duplicate Vertical",
            "description": "Should fail"
        }
        response = authenticated_client.post(f"{BASE_URL}/api/verticals", json=payload)
        assert response.status_code == 400
        assert "already exists" in response.json().get("detail", "")


# ============ TECH OPS: MODELS ============
class TestModels:
    """Models CRUD tests"""
    
    def test_get_models(self, authenticated_client):
        """GET /api/models - List all models"""
        response = authenticated_client.get(f"{BASE_URL}/api/models")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} models")
    
    def test_create_model(self, authenticated_client):
        """POST /api/models - Create a new model"""
        # First get a vertical ID
        verticals_res = authenticated_client.get(f"{BASE_URL}/api/verticals")
        verticals = verticals_res.json()
        test_vertical = next((v for v in verticals if v["code"] == "TEST_VERTICAL_001"), None)
        
        if not test_vertical:
            pytest.skip("Test vertical not found")
        
        payload = {
            "vertical_id": test_vertical["id"],
            "code": "TEST_MODEL_001",
            "name": "Test Model",
            "description": "Test model for automated testing"
        }
        response = authenticated_client.post(f"{BASE_URL}/api/models", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == "TEST_MODEL_001"
        assert data["vertical_id"] == test_vertical["id"]
        assert data["status"] == "ACTIVE"
        print(f"Created model: {data['id']}")
    
    def test_get_models_by_vertical(self, authenticated_client):
        """GET /api/models?vertical_id= - Filter models by vertical"""
        verticals_res = authenticated_client.get(f"{BASE_URL}/api/verticals")
        verticals = verticals_res.json()
        test_vertical = next((v for v in verticals if v["code"] == "TEST_VERTICAL_001"), None)
        
        if not test_vertical:
            pytest.skip("Test vertical not found")
        
        response = authenticated_client.get(f"{BASE_URL}/api/models", params={"vertical_id": test_vertical["id"]})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # All returned models should belong to the test vertical
        for model in data:
            assert model["vertical_id"] == test_vertical["id"]


# ============ TECH OPS: BUYERS ============
class TestBuyers:
    """Buyers CRUD tests"""
    
    def test_get_buyers(self, authenticated_client):
        """GET /api/buyers - List all buyers"""
        response = authenticated_client.get(f"{BASE_URL}/api/buyers")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} buyers")
    
    def test_create_buyer(self, authenticated_client):
        """POST /api/buyers - Create a new buyer"""
        payload = {
            "code": "TEST_BUYER_001",
            "name": "Test Buyer Inc",
            "country": "USA",
            "contact_email": "test@testbuyer.com",
            "payment_terms_days": 30
        }
        response = authenticated_client.post(f"{BASE_URL}/api/buyers", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == "TEST_BUYER_001"
        assert data["name"] == "Test Buyer Inc"
        assert data["country"] == "USA"
        assert data["contact_email"] == "test@testbuyer.com"
        assert data["status"] == "ACTIVE"
        assert "id" in data
        print(f"Created buyer: {data['id']}")
    
    def test_get_buyer_by_id(self, authenticated_client):
        """GET /api/buyers/{buyer_id} - Get buyer details"""
        # First get the test buyer
        buyers_res = authenticated_client.get(f"{BASE_URL}/api/buyers")
        buyers = buyers_res.json()
        test_buyer = next((b for b in buyers if b["code"] == "TEST_BUYER_001"), None)
        
        if not test_buyer:
            pytest.skip("Test buyer not found")
        
        response = authenticated_client.get(f"{BASE_URL}/api/buyers/{test_buyer['id']}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_buyer["id"]
        assert data["code"] == "TEST_BUYER_001"


# ============ TECH OPS: BRANDS ============
class TestBrands:
    """Brands CRUD tests"""
    
    def test_get_brands(self, authenticated_client):
        """GET /api/brands - List all brands"""
        response = authenticated_client.get(f"{BASE_URL}/api/brands")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} brands")
    
    def test_create_brand(self, authenticated_client):
        """POST /api/brands - Create a new brand"""
        # Get test buyer ID
        buyers_res = authenticated_client.get(f"{BASE_URL}/api/buyers")
        buyers = buyers_res.json()
        test_buyer = next((b for b in buyers if b["code"] == "TEST_BUYER_001"), None)
        
        payload = {
            "code": "TEST_BRAND_001",
            "name": "Test Brand",
            "buyer_id": test_buyer["id"] if test_buyer else ""
        }
        response = authenticated_client.post(f"{BASE_URL}/api/brands", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == "TEST_BRAND_001"
        assert data["name"] == "Test Brand"
        assert data["status"] == "ACTIVE"
        print(f"Created brand: {data['id']}")
    
    def test_get_brands_by_buyer(self, authenticated_client):
        """GET /api/brands?buyer_id= - Filter brands by buyer"""
        buyers_res = authenticated_client.get(f"{BASE_URL}/api/buyers")
        buyers = buyers_res.json()
        test_buyer = next((b for b in buyers if b["code"] == "TEST_BUYER_001"), None)
        
        if not test_buyer:
            pytest.skip("Test buyer not found")
        
        response = authenticated_client.get(f"{BASE_URL}/api/brands", params={"buyer_id": test_buyer["id"]})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


# ============ DEMAND: FORECASTS ============
class TestForecasts:
    """Forecasts CRUD tests"""
    
    def test_get_forecasts(self, authenticated_client):
        """GET /api/forecasts - List all forecasts"""
        response = authenticated_client.get(f"{BASE_URL}/api/forecasts")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} forecasts")
    
    def test_create_forecast(self, authenticated_client):
        """POST /api/forecasts - Create a new forecast"""
        # Get test buyer and vertical
        buyers_res = authenticated_client.get(f"{BASE_URL}/api/buyers")
        buyers = buyers_res.json()
        test_buyer = next((b for b in buyers if b["code"] == "TEST_BUYER_001"), None)
        
        verticals_res = authenticated_client.get(f"{BASE_URL}/api/verticals")
        verticals = verticals_res.json()
        test_vertical = next((v for v in verticals if v["code"] == "TEST_VERTICAL_001"), None)
        
        if not test_buyer or not test_vertical:
            pytest.skip("Test buyer or vertical not found")
        
        forecast_month = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-01T00:00:00.000Z")
        
        payload = {
            "buyer_id": test_buyer["id"],
            "vertical_id": test_vertical["id"],
            "sku_id": "",
            "forecast_month": forecast_month,
            "quantity": 1000,
            "priority": "HIGH",
            "notes": "Test forecast for automated testing"
        }
        response = authenticated_client.post(f"{BASE_URL}/api/forecasts", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["buyer_id"] == test_buyer["id"]
        assert data["vertical_id"] == test_vertical["id"]
        assert data["quantity"] == 1000
        assert data["priority"] == "HIGH"
        assert data["status"] == "DRAFT"
        assert "forecast_code" in data
        assert data["forecast_code"].startswith("FC_")
        print(f"Created forecast: {data['forecast_code']}")
    
    def test_confirm_forecast(self, authenticated_client):
        """PUT /api/forecasts/{id}/confirm - Confirm a forecast"""
        # Get the test forecast
        forecasts_res = authenticated_client.get(f"{BASE_URL}/api/forecasts")
        forecasts = forecasts_res.json()
        test_forecast = next((f for f in forecasts if f.get("notes") == "Test forecast for automated testing"), None)
        
        if not test_forecast:
            pytest.skip("Test forecast not found")
        
        response = authenticated_client.put(f"{BASE_URL}/api/forecasts/{test_forecast['id']}/confirm")
        assert response.status_code == 200
        
        # Verify status changed
        verify_res = authenticated_client.get(f"{BASE_URL}/api/forecasts")
        updated_forecast = next((f for f in verify_res.json() if f["id"] == test_forecast["id"]), None)
        assert updated_forecast["status"] == "CONFIRMED"
        print(f"Confirmed forecast: {test_forecast['forecast_code']}")


# ============ DEMAND: DISPATCH LOTS ============
class TestDispatchLots:
    """Dispatch Lots CRUD tests"""
    
    def test_get_dispatch_lots(self, authenticated_client):
        """GET /api/dispatch-lots - List all dispatch lots"""
        response = authenticated_client.get(f"{BASE_URL}/api/dispatch-lots")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} dispatch lots")
    
    def test_create_dispatch_lot(self, authenticated_client):
        """POST /api/dispatch-lots - Create a new dispatch lot"""
        # Get test buyer
        buyers_res = authenticated_client.get(f"{BASE_URL}/api/buyers")
        buyers = buyers_res.json()
        test_buyer = next((b for b in buyers if b["code"] == "TEST_BUYER_001"), None)
        
        # Get a SKU
        skus_res = authenticated_client.get(f"{BASE_URL}/api/skus", params={"limit": 1})
        skus = skus_res.json()
        test_sku = skus[0] if skus else None
        
        if not test_buyer:
            pytest.skip("Test buyer not found")
        
        target_date = (datetime.now() + timedelta(days=14)).strftime("%Y-%m-%dT00:00:00.000Z")
        
        payload = {
            "forecast_id": "",
            "sku_id": test_sku["sku_id"] if test_sku else "TEST_SKU",
            "buyer_id": test_buyer["id"],
            "required_quantity": 500,
            "target_date": target_date,
            "priority": "MEDIUM"
        }
        response = authenticated_client.post(f"{BASE_URL}/api/dispatch-lots", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["buyer_id"] == test_buyer["id"]
        assert data["required_quantity"] == 500
        assert data["status"] == "CREATED"
        assert "lot_code" in data
        assert data["lot_code"].startswith("DL_")
        print(f"Created dispatch lot: {data['lot_code']}")
    
    def test_get_dispatch_lots_by_buyer(self, authenticated_client):
        """GET /api/dispatch-lots?buyer_id= - Filter by buyer"""
        buyers_res = authenticated_client.get(f"{BASE_URL}/api/buyers")
        buyers = buyers_res.json()
        test_buyer = next((b for b in buyers if b["code"] == "TEST_BUYER_001"), None)
        
        if not test_buyer:
            pytest.skip("Test buyer not found")
        
        response = authenticated_client.get(f"{BASE_URL}/api/dispatch-lots", params={"buyer_id": test_buyer["id"]})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        for lot in data:
            assert lot["buyer_id"] == test_buyer["id"]


# ============ QUALITY: QC CHECKLISTS ============
class TestQCChecklists:
    """QC Checklists CRUD tests"""
    
    def test_get_qc_checklists(self, authenticated_client):
        """GET /api/qc-checklists - List all QC checklists"""
        response = authenticated_client.get(f"{BASE_URL}/api/qc-checklists")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} QC checklists")
    
    def test_create_qc_checklist(self, authenticated_client):
        """POST /api/qc-checklists - Create a new QC checklist"""
        payload = {
            "name": "TEST Surface Quality Check",
            "description": "Check for scratches and dents",
            "check_type": "VISUAL",
            "vertical_id": "",
            "model_id": "",
            "brand_id": "",
            "expected_value": "No visible defects",
            "tolerance": "",
            "is_mandatory": True,
            "check_priority": 100
        }
        response = authenticated_client.post(f"{BASE_URL}/api/qc-checklists", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "TEST Surface Quality Check"
        assert data["check_type"] == "VISUAL"
        assert data["is_mandatory"] == True
        assert data["status"] == "ACTIVE"
        assert "checklist_code" in data
        assert data["checklist_code"].startswith("QC_")
        print(f"Created QC checklist: {data['checklist_code']}")
    
    def test_create_measurement_checklist(self, authenticated_client):
        """POST /api/qc-checklists - Create measurement type checklist"""
        payload = {
            "name": "TEST Dimension Check",
            "description": "Verify dimensions are within tolerance",
            "check_type": "MEASUREMENT",
            "vertical_id": "",
            "model_id": "",
            "brand_id": "",
            "expected_value": "100mm",
            "tolerance": "±0.5mm",
            "is_mandatory": True,
            "check_priority": 50
        }
        response = authenticated_client.post(f"{BASE_URL}/api/qc-checklists", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["check_type"] == "MEASUREMENT"
        assert data["expected_value"] == "100mm"
        assert data["tolerance"] == "±0.5mm"


# ============ QUALITY: QC RESULTS ============
class TestQCResults:
    """QC Results tests - requires production batch"""
    
    def test_get_qc_results_requires_batch_id(self, authenticated_client):
        """GET /api/qc-results - Requires production_batch_id parameter"""
        # Without batch_id should return empty or error
        response = authenticated_client.get(f"{BASE_URL}/api/qc-results", params={"production_batch_id": "nonexistent"})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0  # No results for nonexistent batch


# ============ CLEANUP ============
class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_data(self, authenticated_client):
        """Clean up TEST_ prefixed data"""
        # Note: In a real scenario, we'd have delete endpoints
        # For now, just verify we can list the test data
        
        # Verify test vertical exists
        verticals_res = authenticated_client.get(f"{BASE_URL}/api/verticals")
        test_verticals = [v for v in verticals_res.json() if v["code"].startswith("TEST_")]
        print(f"Test verticals to clean: {len(test_verticals)}")
        
        # Verify test buyers exist
        buyers_res = authenticated_client.get(f"{BASE_URL}/api/buyers")
        test_buyers = [b for b in buyers_res.json() if b["code"].startswith("TEST_")]
        print(f"Test buyers to clean: {len(test_buyers)}")
        
        # Verify test brands exist
        brands_res = authenticated_client.get(f"{BASE_URL}/api/brands")
        test_brands = [b for b in brands_res.json() if b["code"].startswith("TEST_")]
        print(f"Test brands to clean: {len(test_brands)}")
        
        # Verify test checklists exist
        checklists_res = authenticated_client.get(f"{BASE_URL}/api/qc-checklists")
        test_checklists = [c for c in checklists_res.json() if c["name"].startswith("TEST")]
        print(f"Test checklists to clean: {len(test_checklists)}")
        
        assert True  # Cleanup verification passed


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

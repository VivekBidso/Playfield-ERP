"""
Test Suite for Bidso SKU Clone Feature
Tests the Clone & Customize Bidso SKU workflow for Demand Planners and Tech Ops approval
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
DEMAND_PLANNER_EMAIL = "demand_planner@factory.com"
DEMAND_PLANNER_PASSWORD = "bidso123"
TECHOPS_EMAIL = "techops@bidso.com"
TECHOPS_PASSWORD = "bidso123"


@pytest.fixture(scope="module")
def demand_planner_token():
    """Get authentication token for Demand Planner"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": DEMAND_PLANNER_EMAIL,
        "password": DEMAND_PLANNER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Demand Planner authentication failed")


@pytest.fixture(scope="module")
def techops_token():
    """Get authentication token for Tech Ops"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TECHOPS_EMAIL,
        "password": TECHOPS_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Tech Ops authentication failed")


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestBidsoSkusForClone:
    """Test GET /api/demand-hub/bidso-skus-for-clone endpoint"""
    
    def test_get_bidso_skus_for_clone_returns_list(self, api_client):
        """Test that endpoint returns list of Bidso SKUs with BOMs"""
        response = api_client.get(f"{BASE_URL}/api/demand-hub/bidso-skus-for-clone")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} Bidso SKUs available for cloning")
    
    def test_bidso_skus_have_bom_item_count(self, api_client):
        """Test that returned SKUs have bom_item_count field"""
        response = api_client.get(f"{BASE_URL}/api/demand-hub/bidso-skus-for-clone")
        assert response.status_code == 200
        
        data = response.json()
        if len(data) > 0:
            sku = data[0]
            assert "bom_item_count" in sku
            assert sku["bom_item_count"] > 0
            assert "bidso_sku_id" in sku
            print(f"First SKU: {sku['bidso_sku_id']} with {sku['bom_item_count']} BOM items")
    
    def test_bidso_skus_have_vertical_and_model(self, api_client):
        """Test that returned SKUs have enriched vertical and model data"""
        response = api_client.get(f"{BASE_URL}/api/demand-hub/bidso-skus-for-clone")
        assert response.status_code == 200
        
        data = response.json()
        if len(data) > 0:
            sku = data[0]
            assert "vertical" in sku
            assert "model" in sku
            print(f"SKU {sku['bidso_sku_id']} - Vertical: {sku.get('vertical', {}).get('code')}, Model: {sku.get('model', {}).get('code')}")
    
    def test_filter_by_vertical(self, api_client):
        """Test filtering by vertical_id"""
        # First get a SKU to find its vertical_id
        response = api_client.get(f"{BASE_URL}/api/demand-hub/bidso-skus-for-clone")
        data = response.json()
        
        if len(data) > 0:
            vertical_id = data[0].get("vertical_id")
            if vertical_id:
                filtered_response = api_client.get(f"{BASE_URL}/api/demand-hub/bidso-skus-for-clone?vertical_id={vertical_id}")
                assert filtered_response.status_code == 200
                filtered_data = filtered_response.json()
                # All results should have the same vertical_id
                for sku in filtered_data:
                    assert sku.get("vertical_id") == vertical_id
                print(f"Filtered by vertical {vertical_id}: {len(filtered_data)} SKUs")
    
    def test_search_filter(self, api_client):
        """Test search filter"""
        response = api_client.get(f"{BASE_URL}/api/demand-hub/bidso-skus-for-clone?search=Blaze")
        assert response.status_code == 200
        
        data = response.json()
        print(f"Search 'Blaze' returned {len(data)} results")


class TestBomForClone:
    """Test GET /api/demand-hub/bidso-skus/{id}/bom-for-clone endpoint"""
    
    def test_get_bom_for_clone_returns_bom(self, api_client):
        """Test that endpoint returns BOM with edit indicators"""
        # First get a SKU
        skus_response = api_client.get(f"{BASE_URL}/api/demand-hub/bidso-skus-for-clone")
        skus = skus_response.json()
        
        if len(skus) > 0:
            sku_id = skus[0]["bidso_sku_id"]
            response = api_client.get(f"{BASE_URL}/api/demand-hub/bidso-skus/{sku_id}/bom-for-clone")
            assert response.status_code == 200
            
            data = response.json()
            assert "source_sku" in data
            assert "bom_items" in data
            assert "total_items" in data
            assert "editable_count" in data
            assert "locked_count" in data
            print(f"BOM for {sku_id}: {data['total_items']} items, {data['editable_count']} editable, {data['locked_count']} locked")
    
    def test_bom_items_have_edit_type(self, api_client):
        """Test that BOM items have edit_type field"""
        skus_response = api_client.get(f"{BASE_URL}/api/demand-hub/bidso-skus-for-clone")
        skus = skus_response.json()
        
        if len(skus) > 0:
            sku_id = skus[0]["bidso_sku_id"]
            response = api_client.get(f"{BASE_URL}/api/demand-hub/bidso-skus/{sku_id}/bom-for-clone")
            data = response.json()
            
            for item in data.get("bom_items", []):
                assert "edit_type" in item
                assert item["edit_type"] in ["LOCKED", "COLOUR_ONLY", "COLOUR_OR_SWAP"]
                assert "rm_id" in item
                assert "category" in item
    
    def test_bom_for_nonexistent_sku_returns_404(self, api_client):
        """Test that non-existent SKU returns 404"""
        response = api_client.get(f"{BASE_URL}/api/demand-hub/bidso-skus/NONEXISTENT_SKU/bom-for-clone")
        assert response.status_code == 404


class TestBidsoCloneRequests:
    """Test Bidso Clone Request CRUD operations"""
    
    def test_get_clone_requests_requires_auth(self, api_client):
        """Test that getting clone requests requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/demand-hub/bidso-clone-requests")
        # 401 or 403 both indicate auth is required
        assert response.status_code in [401, 403]
    
    def test_get_clone_requests_with_auth(self, api_client, demand_planner_token):
        """Test getting clone requests with authentication"""
        response = api_client.get(
            f"{BASE_URL}/api/demand-hub/bidso-clone-requests",
            headers={"Authorization": f"Bearer {demand_planner_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} clone requests")
    
    def test_get_pending_clone_count(self, api_client):
        """Test getting pending clone request count"""
        response = api_client.get(f"{BASE_URL}/api/demand-hub/bidso-clone-requests/pending-count")
        assert response.status_code == 200
        
        data = response.json()
        assert "pending_count" in data
        print(f"Pending clone requests: {data['pending_count']}")
    
    def test_create_clone_request(self, api_client, demand_planner_token):
        """Test creating a new clone request"""
        # First get a SKU to clone
        skus_response = api_client.get(f"{BASE_URL}/api/demand-hub/bidso-skus-for-clone")
        skus = skus_response.json()
        
        if len(skus) > 0:
            source_sku_id = skus[0]["bidso_sku_id"]
            
            response = api_client.post(
                f"{BASE_URL}/api/demand-hub/bidso-clone-requests",
                headers={"Authorization": f"Bearer {demand_planner_token}"},
                json={
                    "source_bidso_sku_id": source_sku_id,
                    "proposed_name": "TEST_Clone_Request_Variant",
                    "proposed_description": "Test clone request for automated testing",
                    "bom_modifications": []
                }
            )
            assert response.status_code == 200
            
            data = response.json()
            assert "id" in data
            assert "message" in data
            print(f"Created clone request: {data['id']}")
            
            # Store for cleanup
            return data["id"]
    
    def test_create_clone_request_requires_source_sku(self, api_client, demand_planner_token):
        """Test that source_bidso_sku_id is required"""
        response = api_client.post(
            f"{BASE_URL}/api/demand-hub/bidso-clone-requests",
            headers={"Authorization": f"Bearer {demand_planner_token}"},
            json={
                "proposed_name": "Test Clone"
            }
        )
        assert response.status_code == 400
    
    def test_create_clone_request_requires_proposed_name(self, api_client, demand_planner_token):
        """Test that proposed_name is required"""
        response = api_client.post(
            f"{BASE_URL}/api/demand-hub/bidso-clone-requests",
            headers={"Authorization": f"Bearer {demand_planner_token}"},
            json={
                "source_bidso_sku_id": "KS_BE_010"
            }
        )
        assert response.status_code == 400


class TestCloneRequestReview:
    """Test Tech Ops review of clone requests"""
    
    def test_get_clone_request_detail(self, api_client, techops_token):
        """Test getting detailed clone request info"""
        # First get list of requests
        list_response = api_client.get(
            f"{BASE_URL}/api/demand-hub/bidso-clone-requests",
            headers={"Authorization": f"Bearer {techops_token}"}
        )
        requests_list = list_response.json()
        
        if len(requests_list) > 0:
            request_id = requests_list[0]["id"]
            response = api_client.get(
                f"{BASE_URL}/api/demand-hub/bidso-clone-requests/{request_id}",
                headers={"Authorization": f"Bearer {techops_token}"}
            )
            assert response.status_code == 200
            
            data = response.json()
            assert "id" in data
            assert "source_bidso_sku_id" in data
            assert "proposed_name" in data
            assert "status" in data
            print(f"Clone request detail: {data['proposed_name']} - Status: {data['status']}")
    
    def test_review_clone_request_invalid_action(self, api_client, techops_token):
        """Test that invalid action is rejected"""
        # First get a pending request
        list_response = api_client.get(
            f"{BASE_URL}/api/demand-hub/bidso-clone-requests?status=PENDING",
            headers={"Authorization": f"Bearer {techops_token}"}
        )
        requests_list = list_response.json()
        
        if len(requests_list) > 0:
            request_id = requests_list[0]["id"]
            response = api_client.post(
                f"{BASE_URL}/api/demand-hub/bidso-clone-requests/{request_id}/review",
                headers={"Authorization": f"Bearer {techops_token}"},
                json={"action": "INVALID_ACTION"}
            )
            assert response.status_code == 400


class TestMyRequestsIncludesClone:
    """Test that My Requests includes BIDSO_CLONE type"""
    
    def test_my_requests_returns_clone_requests(self, api_client, demand_planner_token):
        """Test that my-requests endpoint includes clone requests"""
        response = api_client.get(
            f"{BASE_URL}/api/demand-hub/my-requests",
            headers={"Authorization": f"Bearer {demand_planner_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # Check if any BIDSO_CLONE type exists
        clone_requests = [r for r in data if r.get("type") == "BIDSO_CLONE"]
        print(f"Found {len(clone_requests)} BIDSO_CLONE requests in my-requests")
    
    def test_my_requests_summary_includes_clone_counts(self, api_client, demand_planner_token):
        """Test that summary includes clone request counts"""
        response = api_client.get(
            f"{BASE_URL}/api/demand-hub/my-requests/summary",
            headers={"Authorization": f"Bearer {demand_planner_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "bidso_clone_requests" in data
        assert "total" in data["bidso_clone_requests"]
        assert "pending" in data["bidso_clone_requests"]
        assert "approved" in data["bidso_clone_requests"]
        print(f"Clone request summary: {data['bidso_clone_requests']}")


class TestColourVariants:
    """Test colour variant lookup endpoint"""
    
    def test_get_colour_variants(self, api_client):
        """Test getting colour variants for an RM"""
        # First get a BOM to find an editable RM
        skus_response = api_client.get(f"{BASE_URL}/api/demand-hub/bidso-skus-for-clone")
        skus = skus_response.json()
        
        if len(skus) > 0:
            sku_id = skus[0]["bidso_sku_id"]
            bom_response = api_client.get(f"{BASE_URL}/api/demand-hub/bidso-skus/{sku_id}/bom-for-clone")
            bom = bom_response.json()
            
            # Find an editable item
            editable_items = [i for i in bom.get("bom_items", []) if i["edit_type"] != "LOCKED"]
            if len(editable_items) > 0:
                rm_id = editable_items[0]["rm_id"]
                response = api_client.get(f"{BASE_URL}/api/demand-hub/colour-variants/{rm_id}")
                assert response.status_code == 200
                
                data = response.json()
                assert "source_rm" in data
                assert "variants" in data
                print(f"Colour variants for {rm_id}: {len(data['variants'])} found")


class TestSearchRmForSwap:
    """Test RM search for swap endpoint"""
    
    def test_search_rm_for_swap(self, api_client):
        """Test searching RMs for swap"""
        response = api_client.get(f"{BASE_URL}/api/demand-hub/search-rm-for-swap?category=ACC")
        assert response.status_code == 200
        
        data = response.json()
        assert "results" in data
        assert "total" in data
        print(f"Search ACC category: {data['total']} results")
    
    def test_search_rm_with_model_filter(self, api_client):
        """Test searching RMs with model_name filter"""
        response = api_client.get(f"{BASE_URL}/api/demand-hub/search-rm-for-swap?category=ACC&model_name=Blaze")
        assert response.status_code == 200
        
        data = response.json()
        assert "results" in data
        print(f"Search ACC with model_name=Blaze: {data['total']} results")
    
    def test_search_rm_with_search_term(self, api_client):
        """Test searching RMs with search term"""
        response = api_client.get(f"{BASE_URL}/api/demand-hub/search-rm-for-swap?category=INP&search=wheel")
        assert response.status_code == 200
        
        data = response.json()
        assert "results" in data
        print(f"Search INP with term 'wheel': {data['total']} results")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

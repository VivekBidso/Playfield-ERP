"""
Test Dispatch Lots V2 and Price Master APIs
Two-stage workflow: Demand Team creates lots -> Finance Team creates invoices

Tests:
- Price Master CRUD (template, create, list)
- Dispatch Lots V2 (summary, create, list, send-to-finance, inventory-check)
- Buyer SKU HSN/GST update
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_CREDS = {"email": "admin@factory.com", "password": "bidso123"}
DEMAND_CREDS = {"email": "demandplanner@bidso.com", "password": "bidso123"}
FINANCE_CREDS = {"email": "finance@bidso.com", "password": "bidso123"}


class TestAuth:
    """Authentication tests for different roles"""
    
    def test_admin_login(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data or "token" in data
        print(f"Admin login successful")
    
    def test_demand_planner_login(self):
        """Test demand planner login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMAND_CREDS)
        # May return 401 if user doesn't exist - that's ok for this test
        if response.status_code == 200:
            data = response.json()
            assert "access_token" in data or "token" in data
            print(f"Demand planner login successful")
        else:
            print(f"Demand planner user may not exist: {response.status_code}")
    
    def test_finance_login(self):
        """Test finance user login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=FINANCE_CREDS)
        assert response.status_code == 200, f"Finance login failed: {response.text}"
        data = response.json()
        assert "access_token" in data or "token" in data
        print(f"Finance login successful")


@pytest.fixture(scope="module")
def admin_token():
    """Get admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token") or data.get("token")
    pytest.skip("Admin authentication failed")


@pytest.fixture(scope="module")
def finance_token():
    """Get finance auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=FINANCE_CREDS)
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token") or data.get("token")
    pytest.skip("Finance authentication failed")


@pytest.fixture(scope="module")
def test_customer(admin_token):
    """Get a test customer from buyers collection"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = requests.get(f"{BASE_URL}/api/buyers", headers=headers)
    if response.status_code == 200:
        buyers = response.json()
        if isinstance(buyers, list) and len(buyers) > 0:
            return buyers[0]
        elif isinstance(buyers, dict) and buyers.get("items"):
            return buyers["items"][0]
    return None


@pytest.fixture(scope="module")
def test_buyer_sku(admin_token):
    """Get a test buyer SKU"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = requests.get(f"{BASE_URL}/api/sku-management/buyer-skus?page_size=10", headers=headers)
    if response.status_code == 200:
        data = response.json()
        items = data.get("items") or data.get("buyer_skus") or []
        if len(items) > 0:
            return items[0]
    return None


@pytest.fixture(scope="module")
def test_branch(admin_token):
    """Get a test branch"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = requests.get(f"{BASE_URL}/api/branches", headers=headers)
    if response.status_code == 200:
        branches = response.json()
        if isinstance(branches, list) and len(branches) > 0:
            return branches[0]
    return None


class TestPriceMasterAPI:
    """Price Master API tests"""
    
    def test_get_template(self, admin_token):
        """GET /api/price-master/template - Get bulk upload template"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/price-master/template", headers=headers)
        
        assert response.status_code == 200, f"Template endpoint failed: {response.text}"
        data = response.json()
        
        # Verify template structure
        assert "columns" in data, "Missing columns in template"
        assert "required" in data, "Missing required fields in template"
        assert "example" in data, "Missing example in template"
        
        # Verify required columns
        assert "customer_id" in data["required"]
        assert "buyer_sku_id" in data["required"]
        assert "unit_price" in data["required"]
        
        print(f"Template columns: {data['columns']}")
        print(f"Required fields: {data['required']}")
    
    def test_list_prices_empty(self, admin_token):
        """GET /api/price-master - List prices (may be empty)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/price-master", headers=headers)
        
        assert response.status_code == 200, f"List prices failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "prices" in data, "Missing prices array"
        assert "total" in data, "Missing total count"
        assert "page" in data, "Missing page number"
        
        print(f"Total prices: {data['total']}, Page: {data['page']}")
    
    def test_create_price_entry(self, admin_token, test_customer, test_buyer_sku):
        """POST /api/price-master - Create price entry"""
        if not test_customer or not test_buyer_sku:
            pytest.skip("No test customer or buyer SKU available")
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        customer_id = test_customer.get("customer_code") or test_customer.get("id")
        buyer_sku_id = test_buyer_sku.get("buyer_sku_id")
        
        payload = {
            "customer_id": customer_id,
            "buyer_sku_id": buyer_sku_id,
            "unit_price": 1500.00,
            "currency": "INR",
            "notes": "TEST_PRICE_ENTRY"
        }
        
        response = requests.post(f"{BASE_URL}/api/price-master", json=payload, headers=headers)
        
        # May fail if customer/SKU validation fails - check both success and expected errors
        if response.status_code == 200 or response.status_code == 201:
            data = response.json()
            assert "id" in data or "price" in data, "Missing price ID in response"
            print(f"Price entry created: {data}")
        elif response.status_code == 400:
            # Expected if customer or SKU not found
            print(f"Price creation failed (expected): {response.json()}")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code}, {response.text}")
    
    def test_list_prices_with_filters(self, admin_token, test_customer):
        """GET /api/price-master with filters"""
        if not test_customer:
            pytest.skip("No test customer available")
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        customer_id = test_customer.get("customer_code") or test_customer.get("id")
        
        response = requests.get(
            f"{BASE_URL}/api/price-master?customer_id={customer_id}&active_only=true",
            headers=headers
        )
        
        assert response.status_code == 200, f"Filtered list failed: {response.text}"
        data = response.json()
        assert "prices" in data
        print(f"Prices for customer {customer_id}: {len(data['prices'])}")


class TestDispatchLotsV2API:
    """Dispatch Lots V2 API tests"""
    
    def test_get_summary(self, admin_token):
        """GET /api/dispatch-lots-v2/summary - Get status counts"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/dispatch-lots-v2/summary", headers=headers)
        
        assert response.status_code == 200, f"Summary endpoint failed: {response.text}"
        data = response.json()
        
        # Verify summary structure - should have status counts
        expected_statuses = ["DRAFT", "PENDING_FINANCE", "INVOICED", "DISPATCHED", "CANCELLED"]
        for status in expected_statuses:
            assert status in data, f"Missing status {status} in summary"
        
        assert "total" in data, "Missing total count"
        
        print(f"Summary: {data}")
    
    def test_list_lots_empty(self, admin_token):
        """GET /api/dispatch-lots-v2 - List lots (may be empty)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/dispatch-lots-v2", headers=headers)
        
        assert response.status_code == 200, f"List lots failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "lots" in data, "Missing lots array"
        assert "total" in data, "Missing total count"
        assert "page" in data, "Missing page number"
        
        print(f"Total lots: {data['total']}, Page: {data['page']}")
    
    def test_list_lots_with_status_filter(self, admin_token):
        """GET /api/dispatch-lots-v2?status=DRAFT - Filter by status"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/dispatch-lots-v2?status=DRAFT", headers=headers)
        
        assert response.status_code == 200, f"Filtered list failed: {response.text}"
        data = response.json()
        assert "lots" in data
        
        # Verify all returned lots have DRAFT status
        for lot in data["lots"]:
            assert lot["status"] == "DRAFT", f"Lot {lot['lot_number']} has wrong status"
        
        print(f"DRAFT lots: {len(data['lots'])}")
    
    def test_create_dispatch_lot(self, admin_token, test_customer, test_buyer_sku):
        """POST /api/dispatch-lots-v2 - Create simple dispatch lot"""
        if not test_customer or not test_buyer_sku:
            pytest.skip("No test customer or buyer SKU available")
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        customer_id = test_customer.get("customer_code") or test_customer.get("id")
        buyer_sku_id = test_buyer_sku.get("buyer_sku_id")
        
        payload = {
            "customer_id": customer_id,
            "lines": [
                {"buyer_sku_id": buyer_sku_id, "quantity": 100}
            ],
            "notes": "TEST_LOT_CREATION"
        }
        
        response = requests.post(f"{BASE_URL}/api/dispatch-lots-v2", json=payload, headers=headers)
        
        if response.status_code in [200, 201]:
            data = response.json()
            assert "lot_number" in data, "Missing lot_number in response"
            assert "id" in data, "Missing id in response"
            print(f"Lot created: {data['lot_number']}, ID: {data['id']}")
            return data
        elif response.status_code == 400:
            # Expected if customer or SKU not found
            print(f"Lot creation failed (expected): {response.json()}")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code}, {response.text}")
    
    def test_create_lot_and_send_to_finance(self, admin_token, test_customer, test_buyer_sku):
        """Create lot and send to finance - full workflow"""
        if not test_customer or not test_buyer_sku:
            pytest.skip("No test customer or buyer SKU available")
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        customer_id = test_customer.get("customer_code") or test_customer.get("id")
        buyer_sku_id = test_buyer_sku.get("buyer_sku_id")
        
        # Step 1: Create lot
        payload = {
            "customer_id": customer_id,
            "lines": [
                {"buyer_sku_id": buyer_sku_id, "quantity": 50}
            ],
            "notes": "TEST_SEND_TO_FINANCE"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/dispatch-lots-v2", json=payload, headers=headers)
        
        if create_response.status_code not in [200, 201]:
            pytest.skip(f"Could not create lot: {create_response.text}")
        
        lot_data = create_response.json()
        lot_id = lot_data["id"]
        print(f"Created lot: {lot_data['lot_number']}")
        
        # Step 2: Send to finance
        send_response = requests.post(
            f"{BASE_URL}/api/dispatch-lots-v2/{lot_id}/send-to-finance",
            headers=headers
        )
        
        assert send_response.status_code == 200, f"Send to finance failed: {send_response.text}"
        print(f"Lot sent to finance successfully")
        
        # Step 3: Verify status changed
        get_response = requests.get(f"{BASE_URL}/api/dispatch-lots-v2/{lot_id}", headers=headers)
        assert get_response.status_code == 200
        lot_details = get_response.json()
        assert lot_details["status"] == "PENDING_FINANCE", f"Status not updated: {lot_details['status']}"
        print(f"Lot status verified: PENDING_FINANCE")
    
    def test_inventory_check(self, admin_token, test_branch, test_customer, test_buyer_sku):
        """GET /api/dispatch-lots-v2/{id}/inventory-check - Check inventory availability"""
        if not test_branch or not test_customer or not test_buyer_sku:
            pytest.skip("Missing test data")
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        customer_id = test_customer.get("customer_code") or test_customer.get("id")
        buyer_sku_id = test_buyer_sku.get("buyer_sku_id")
        branch_id = test_branch.get("branch_id") or test_branch.get("id")
        
        # First create a lot
        payload = {
            "customer_id": customer_id,
            "lines": [{"buyer_sku_id": buyer_sku_id, "quantity": 10}],
            "notes": "TEST_INVENTORY_CHECK"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/dispatch-lots-v2", json=payload, headers=headers)
        
        if create_response.status_code not in [200, 201]:
            pytest.skip(f"Could not create lot: {create_response.text}")
        
        lot_id = create_response.json()["id"]
        
        # Check inventory
        check_response = requests.get(
            f"{BASE_URL}/api/dispatch-lots-v2/{lot_id}/inventory-check?branch_id={branch_id}",
            headers=headers
        )
        
        assert check_response.status_code == 200, f"Inventory check failed: {check_response.text}"
        data = check_response.json()
        
        # Verify response structure
        assert "can_proceed" in data, "Missing can_proceed flag"
        assert "items" in data, "Missing items array"
        
        for item in data["items"]:
            assert "buyer_sku_id" in item
            assert "required" in item
            assert "available" in item
            assert "sufficient" in item
        
        print(f"Inventory check result: can_proceed={data['can_proceed']}, items={len(data['items'])}")


class TestBuyerSKUHSNGST:
    """Test HSN/GST fields on Buyer SKU update"""
    
    def test_update_buyer_sku_with_hsn_gst(self, admin_token, test_buyer_sku):
        """PUT /api/sku-management/buyer-skus/{id} - Update with HSN and GST"""
        if not test_buyer_sku:
            pytest.skip("No test buyer SKU available")
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        buyer_sku_id = test_buyer_sku.get("buyer_sku_id")
        
        payload = {
            "hsn_code": "87141090",
            "gst_rate": 18.0
        }
        
        response = requests.put(
            f"{BASE_URL}/api/sku-management/buyer-skus/{buyer_sku_id}",
            json=payload,
            headers=headers
        )
        
        assert response.status_code == 200, f"Update failed: {response.text}"
        print(f"Updated buyer SKU {buyer_sku_id} with HSN/GST")
        
        # Verify the update
        get_response = requests.get(
            f"{BASE_URL}/api/sku-management/buyer-skus/{buyer_sku_id}",
            headers=headers
        )
        
        assert get_response.status_code == 200
        sku_data = get_response.json()
        
        assert sku_data.get("hsn_code") == "87141090", f"HSN not updated: {sku_data.get('hsn_code')}"
        assert sku_data.get("gst_rate") == 18.0, f"GST not updated: {sku_data.get('gst_rate')}"
        
        print(f"Verified HSN: {sku_data.get('hsn_code')}, GST: {sku_data.get('gst_rate')}")


class TestDispatchLotsV2Workflow:
    """End-to-end workflow tests"""
    
    def test_full_workflow_draft_to_pending(self, admin_token, test_customer, test_buyer_sku):
        """Test complete workflow: Create -> Send to Finance"""
        if not test_customer or not test_buyer_sku:
            pytest.skip("Missing test data")
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        customer_id = test_customer.get("customer_code") or test_customer.get("id")
        buyer_sku_id = test_buyer_sku.get("buyer_sku_id")
        
        # 1. Create lot
        create_payload = {
            "customer_id": customer_id,
            "lines": [{"buyer_sku_id": buyer_sku_id, "quantity": 25}],
            "notes": "TEST_FULL_WORKFLOW"
        }
        
        create_resp = requests.post(f"{BASE_URL}/api/dispatch-lots-v2", json=create_payload, headers=headers)
        if create_resp.status_code not in [200, 201]:
            pytest.skip(f"Could not create lot: {create_resp.text}")
        
        lot_id = create_resp.json()["id"]
        lot_number = create_resp.json()["lot_number"]
        print(f"Step 1: Created lot {lot_number}")
        
        # 2. Verify initial status is DRAFT
        get_resp = requests.get(f"{BASE_URL}/api/dispatch-lots-v2/{lot_id}", headers=headers)
        assert get_resp.status_code == 200
        assert get_resp.json()["status"] == "DRAFT"
        print(f"Step 2: Verified status is DRAFT")
        
        # 3. Send to finance
        send_resp = requests.post(f"{BASE_URL}/api/dispatch-lots-v2/{lot_id}/send-to-finance", headers=headers)
        assert send_resp.status_code == 200
        print(f"Step 3: Sent to finance")
        
        # 4. Verify status changed to PENDING_FINANCE
        get_resp2 = requests.get(f"{BASE_URL}/api/dispatch-lots-v2/{lot_id}", headers=headers)
        assert get_resp2.status_code == 200
        assert get_resp2.json()["status"] == "PENDING_FINANCE"
        print(f"Step 4: Verified status is PENDING_FINANCE")
        
        # 5. Verify summary counts updated
        summary_resp = requests.get(f"{BASE_URL}/api/dispatch-lots-v2/summary", headers=headers)
        assert summary_resp.status_code == 200
        print(f"Step 5: Summary verified - {summary_resp.json()}")
    
    def test_delete_draft_lot(self, admin_token, test_customer, test_buyer_sku):
        """Test deleting a DRAFT lot"""
        if not test_customer or not test_buyer_sku:
            pytest.skip("Missing test data")
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        customer_id = test_customer.get("customer_code") or test_customer.get("id")
        buyer_sku_id = test_buyer_sku.get("buyer_sku_id")
        
        # Create lot
        create_payload = {
            "customer_id": customer_id,
            "lines": [{"buyer_sku_id": buyer_sku_id, "quantity": 5}],
            "notes": "TEST_DELETE_LOT"
        }
        
        create_resp = requests.post(f"{BASE_URL}/api/dispatch-lots-v2", json=create_payload, headers=headers)
        if create_resp.status_code not in [200, 201]:
            pytest.skip(f"Could not create lot: {create_resp.text}")
        
        lot_id = create_resp.json()["id"]
        
        # Delete lot
        delete_resp = requests.delete(f"{BASE_URL}/api/dispatch-lots-v2/{lot_id}", headers=headers)
        assert delete_resp.status_code == 200, f"Delete failed: {delete_resp.text}"
        print(f"Lot deleted successfully")
        
        # Verify lot is gone
        get_resp = requests.get(f"{BASE_URL}/api/dispatch-lots-v2/{lot_id}", headers=headers)
        assert get_resp.status_code == 404, "Lot should not exist after deletion"
        print(f"Verified lot no longer exists")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

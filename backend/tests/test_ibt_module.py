"""
IBT (Inter-Branch Transfer) Module Tests
Tests the enhanced IBT features:
1. Inventory check on create
2. PENDING_RECEIPT/IN_TRANSIT status
3. Transit tracking details (vehicle, driver, ETA)
4. Receiver inputs actual Qty
5. Shortage/Variance logging when received < dispatched
6. Partial receipt handling
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@factory.com"
ADMIN_PASSWORD = "bidso123"


class TestIBTModule:
    """IBT Module API Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.token = token
        else:
            pytest.skip(f"Authentication failed: {login_response.status_code}")
    
    # --- Authentication Tests ---
    def test_01_admin_login(self):
        """Test admin login works"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data.get("user", {}).get("role") in ["master_admin", "MASTER_ADMIN"]
        print(f"Admin login successful, role: {data.get('user', {}).get('role')}")
    
    # --- IBT List and Get Tests ---
    def test_02_get_ibt_transfers_list(self):
        """Test GET /api/ibt-transfers returns list"""
        response = self.session.get(f"{BASE_URL}/api/ibt-transfers")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} IBT transfers")
        
        # Check structure of first transfer if exists
        if len(data) > 0:
            transfer = data[0]
            assert "id" in transfer
            assert "transfer_code" in transfer
            assert "status" in transfer
            assert "source_branch" in transfer
            assert "destination_branch" in transfer
            print(f"First transfer: {transfer.get('transfer_code')} - {transfer.get('status')}")
    
    def test_03_get_ibt_transfers_filter_by_status(self):
        """Test filtering IBT transfers by status"""
        response = self.session.get(f"{BASE_URL}/api/ibt-transfers?status=COMPLETED")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # All returned should be COMPLETED
        for transfer in data:
            assert transfer.get("status") == "COMPLETED"
        print(f"Found {len(data)} COMPLETED transfers")
    
    # --- Inventory Check Tests ---
    def test_04_check_inventory_endpoint(self):
        """Test inventory check endpoint for IBT"""
        # Check RM inventory at Unit 1 Vedica for INP_654
        response = self.session.get(
            f"{BASE_URL}/api/ibt-transfers/check-inventory/RM/INP_654/Unit%201%20Vedica"
        )
        assert response.status_code == 200
        data = response.json()
        assert "available_stock" in data
        assert "item_id" in data
        assert "branch" in data
        print(f"INP_654 at Unit 1 Vedica: {data.get('available_stock')} available")
    
    def test_05_check_inventory_nonexistent_item(self):
        """Test inventory check for non-existent item returns 0"""
        response = self.session.get(
            f"{BASE_URL}/api/ibt-transfers/check-inventory/RM/NONEXISTENT_ITEM/Unit%201%20Vedica"
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("available_stock") == 0
        print("Non-existent item correctly returns 0 stock")
    
    # --- Create IBT Tests ---
    def test_06_create_ibt_insufficient_inventory(self):
        """Test creating IBT with insufficient inventory fails"""
        response = self.session.post(f"{BASE_URL}/api/ibt-transfers", json={
            "transfer_type": "RM",
            "source_branch": "Unit 1 Vedica",
            "destination_branch": "Unit 2 Trikes",
            "item_id": "INP_654",
            "quantity": 999999,  # Very large quantity
            "notes": "TEST_insufficient_inventory"
        })
        assert response.status_code == 400
        data = response.json()
        detail = data.get("detail", {})
        assert detail.get("error") == "INSUFFICIENT_INVENTORY"
        print(f"Correctly rejected: {detail.get('message')}")
    
    def test_07_create_ibt_same_branch_fails(self):
        """Test creating IBT with same source and destination fails"""
        response = self.session.post(f"{BASE_URL}/api/ibt-transfers", json={
            "transfer_type": "RM",
            "source_branch": "Unit 1 Vedica",
            "destination_branch": "Unit 1 Vedica",  # Same branch
            "item_id": "INP_654",
            "quantity": 10,
            "notes": "TEST_same_branch"
        })
        assert response.status_code == 400
        assert "same" in response.json().get("detail", "").lower()
        print("Correctly rejected same branch transfer")
    
    def test_08_create_ibt_with_transit_details(self):
        """Test creating IBT with transit details"""
        # First check available stock
        inv_response = self.session.get(
            f"{BASE_URL}/api/ibt-transfers/check-inventory/RM/INP_654/Unit%201%20Vedica"
        )
        available = inv_response.json().get("available_stock", 0)
        
        if available < 5:
            pytest.skip(f"Not enough stock for test: {available}")
        
        response = self.session.post(f"{BASE_URL}/api/ibt-transfers", json={
            "transfer_type": "RM",
            "source_branch": "Unit 1 Vedica",
            "destination_branch": "Unit 2 Trikes",
            "item_id": "INP_654",
            "quantity": 5,
            "notes": "TEST_transit_details",
            "vehicle_number": "MH-12-TEST-1234",
            "driver_name": "Test Driver",
            "driver_contact": "9876543210",
            "expected_arrival": (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
        })
        assert response.status_code == 200
        data = response.json()
        assert "transfer" in data
        transfer = data["transfer"]
        assert transfer.get("status") == "INITIATED"
        assert transfer.get("vehicle_number") == "MH-12-TEST-1234"
        assert transfer.get("driver_name") == "Test Driver"
        self.test_transfer_id = transfer.get("id")
        print(f"Created IBT: {transfer.get('transfer_code')} with transit details")
        return transfer.get("id")
    
    # --- IBT Status Flow Tests ---
    def test_09_approve_ibt_transfer(self):
        """Test approving an IBT transfer"""
        # First create a transfer
        inv_response = self.session.get(
            f"{BASE_URL}/api/ibt-transfers/check-inventory/RM/INP_654/Unit%201%20Vedica"
        )
        available = inv_response.json().get("available_stock", 0)
        
        if available < 3:
            pytest.skip(f"Not enough stock for test: {available}")
        
        create_response = self.session.post(f"{BASE_URL}/api/ibt-transfers", json={
            "transfer_type": "RM",
            "source_branch": "Unit 1 Vedica",
            "destination_branch": "Unit 3 TM",
            "item_id": "INP_654",
            "quantity": 3,
            "notes": "TEST_approve_flow"
        })
        assert create_response.status_code == 200
        transfer_id = create_response.json()["transfer"]["id"]
        
        # Approve the transfer
        approve_response = self.session.put(f"{BASE_URL}/api/ibt-transfers/{transfer_id}/approve")
        assert approve_response.status_code == 200
        print(f"Transfer approved: {approve_response.json()}")
        
        # Verify status changed
        get_response = self.session.get(f"{BASE_URL}/api/ibt-transfers/{transfer_id}")
        assert get_response.status_code == 200
        assert get_response.json().get("status") == "APPROVED"
        print("Status correctly changed to APPROVED")
        return transfer_id
    
    def test_10_dispatch_ibt_transfer(self):
        """Test dispatching an IBT transfer - deducts inventory"""
        # Create and approve a transfer first
        inv_response = self.session.get(
            f"{BASE_URL}/api/ibt-transfers/check-inventory/RM/INP_654/Unit%201%20Vedica"
        )
        available_before = inv_response.json().get("available_stock", 0)
        
        if available_before < 2:
            pytest.skip(f"Not enough stock for test: {available_before}")
        
        # Create
        create_response = self.session.post(f"{BASE_URL}/api/ibt-transfers", json={
            "transfer_type": "RM",
            "source_branch": "Unit 1 Vedica",
            "destination_branch": "Unit 3 TM",
            "item_id": "INP_654",
            "quantity": 2,
            "notes": "TEST_dispatch_flow"
        })
        transfer_id = create_response.json()["transfer"]["id"]
        
        # Approve
        self.session.put(f"{BASE_URL}/api/ibt-transfers/{transfer_id}/approve")
        
        # Dispatch with transit details
        dispatch_response = self.session.put(
            f"{BASE_URL}/api/ibt-transfers/{transfer_id}/dispatch?vehicle_number=MH-TEST-DISPATCH&driver_name=Dispatch%20Driver"
        )
        assert dispatch_response.status_code == 200
        data = dispatch_response.json()
        assert data.get("status") == "IN_TRANSIT"
        print(f"Transfer dispatched: {data}")
        
        # Verify inventory was deducted
        inv_after = self.session.get(
            f"{BASE_URL}/api/ibt-transfers/check-inventory/RM/INP_654/Unit%201%20Vedica"
        )
        available_after = inv_after.json().get("available_stock", 0)
        assert available_after == available_before - 2
        print(f"Inventory deducted: {available_before} -> {available_after}")
        return transfer_id
    
    def test_11_receive_ibt_full_quantity(self):
        """Test receiving IBT with full quantity - no shortage"""
        # Create, approve, dispatch
        inv_response = self.session.get(
            f"{BASE_URL}/api/ibt-transfers/check-inventory/RM/INP_654/Unit%201%20Vedica"
        )
        available = inv_response.json().get("available_stock", 0)
        
        if available < 2:
            pytest.skip(f"Not enough stock for test: {available}")
        
        create_response = self.session.post(f"{BASE_URL}/api/ibt-transfers", json={
            "transfer_type": "RM",
            "source_branch": "Unit 1 Vedica",
            "destination_branch": "Unit 3 TM",
            "item_id": "INP_654",
            "quantity": 2,
            "notes": "TEST_receive_full"
        })
        transfer_id = create_response.json()["transfer"]["id"]
        
        self.session.put(f"{BASE_URL}/api/ibt-transfers/{transfer_id}/approve")
        self.session.put(f"{BASE_URL}/api/ibt-transfers/{transfer_id}/dispatch")
        
        # Receive full quantity
        receive_response = self.session.put(
            f"{BASE_URL}/api/ibt-transfers/{transfer_id}/receive",
            json={
                "received_quantity": 2,
                "received_notes": "All items received in good condition"
            }
        )
        assert receive_response.status_code == 200
        data = receive_response.json()
        assert data.get("status") == "COMPLETED"
        assert data.get("variance") == 0
        assert "shortage_record_id" not in data
        print(f"Full receipt completed: {data}")
    
    def test_12_receive_ibt_with_shortage(self):
        """Test receiving IBT with shortage - creates shortage record"""
        inv_response = self.session.get(
            f"{BASE_URL}/api/ibt-transfers/check-inventory/RM/INP_654/Unit%201%20Vedica"
        )
        available = inv_response.json().get("available_stock", 0)
        
        if available < 10:
            pytest.skip(f"Not enough stock for test: {available}")
        
        # Create transfer for 10 units
        create_response = self.session.post(f"{BASE_URL}/api/ibt-transfers", json={
            "transfer_type": "RM",
            "source_branch": "Unit 1 Vedica",
            "destination_branch": "Unit 3 TM",
            "item_id": "INP_654",
            "quantity": 10,
            "notes": "TEST_shortage_test"
        })
        transfer_id = create_response.json()["transfer"]["id"]
        
        self.session.put(f"{BASE_URL}/api/ibt-transfers/{transfer_id}/approve")
        self.session.put(f"{BASE_URL}/api/ibt-transfers/{transfer_id}/dispatch")
        
        # Receive only 7 of 10 (3 short)
        receive_response = self.session.put(
            f"{BASE_URL}/api/ibt-transfers/{transfer_id}/receive",
            json={
                "received_quantity": 7,
                "received_notes": "3 units missing",
                "damage_notes": "Possible transit damage"
            }
        )
        assert receive_response.status_code == 200
        data = receive_response.json()
        assert data.get("status") == "COMPLETED"
        assert data.get("variance") == 3
        assert "shortage_record_id" in data
        assert data.get("shortage_status") == "PENDING_INVESTIGATION"
        print(f"Shortage recorded: {data}")
        return data.get("shortage_record_id")
    
    # --- Cancel IBT Tests ---
    def test_13_cancel_ibt_before_dispatch(self):
        """Test cancelling IBT before dispatch is allowed"""
        inv_response = self.session.get(
            f"{BASE_URL}/api/ibt-transfers/check-inventory/RM/INP_654/Unit%201%20Vedica"
        )
        available = inv_response.json().get("available_stock", 0)
        
        if available < 1:
            pytest.skip(f"Not enough stock for test: {available}")
        
        # Create transfer
        create_response = self.session.post(f"{BASE_URL}/api/ibt-transfers", json={
            "transfer_type": "RM",
            "source_branch": "Unit 1 Vedica",
            "destination_branch": "Unit 3 TM",
            "item_id": "INP_654",
            "quantity": 1,
            "notes": "TEST_cancel_initiated"
        })
        transfer_id = create_response.json()["transfer"]["id"]
        
        # Cancel while INITIATED
        cancel_response = self.session.put(
            f"{BASE_URL}/api/ibt-transfers/{transfer_id}/cancel?reason=Test%20cancellation"
        )
        assert cancel_response.status_code == 200
        print("Cancelled INITIATED transfer successfully")
        
        # Verify status
        get_response = self.session.get(f"{BASE_URL}/api/ibt-transfers/{transfer_id}")
        assert get_response.json().get("status") == "CANCELLED"
    
    def test_14_cancel_ibt_after_dispatch_fails(self):
        """Test cancelling IBT after dispatch is not allowed"""
        inv_response = self.session.get(
            f"{BASE_URL}/api/ibt-transfers/check-inventory/RM/INP_654/Unit%201%20Vedica"
        )
        available = inv_response.json().get("available_stock", 0)
        
        if available < 1:
            pytest.skip(f"Not enough stock for test: {available}")
        
        # Create, approve, dispatch
        create_response = self.session.post(f"{BASE_URL}/api/ibt-transfers", json={
            "transfer_type": "RM",
            "source_branch": "Unit 1 Vedica",
            "destination_branch": "Unit 3 TM",
            "item_id": "INP_654",
            "quantity": 1,
            "notes": "TEST_cancel_after_dispatch"
        })
        transfer_id = create_response.json()["transfer"]["id"]
        
        self.session.put(f"{BASE_URL}/api/ibt-transfers/{transfer_id}/approve")
        self.session.put(f"{BASE_URL}/api/ibt-transfers/{transfer_id}/dispatch")
        
        # Try to cancel - should fail
        cancel_response = self.session.put(
            f"{BASE_URL}/api/ibt-transfers/{transfer_id}/cancel?reason=Should%20fail"
        )
        assert cancel_response.status_code == 400
        print("Correctly rejected cancellation of IN_TRANSIT transfer")
    
    # --- Shortage Records Tests ---
    def test_15_get_ibt_shortages(self):
        """Test GET /api/ibt-shortages returns shortage records"""
        response = self.session.get(f"{BASE_URL}/api/ibt-shortages")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} shortage records")
        
        # Check structure if any exist
        if len(data) > 0:
            shortage = data[0]
            assert "id" in shortage
            assert "transfer_code" in shortage
            assert "shortage_quantity" in shortage
            assert "status" in shortage
            print(f"First shortage: {shortage.get('transfer_code')} - {shortage.get('shortage_quantity')} units")
    
    def test_16_get_pending_shortages(self):
        """Test filtering shortages by PENDING_INVESTIGATION status"""
        response = self.session.get(f"{BASE_URL}/api/ibt-shortages?status=PENDING_INVESTIGATION")
        assert response.status_code == 200
        data = response.json()
        for shortage in data:
            assert shortage.get("status") == "PENDING_INVESTIGATION"
        print(f"Found {len(data)} pending investigation shortages")
    
    # --- Get Single Transfer Tests ---
    def test_17_get_single_transfer_details(self):
        """Test GET /api/ibt-transfers/{id} returns full details"""
        # Get list first
        list_response = self.session.get(f"{BASE_URL}/api/ibt-transfers")
        transfers = list_response.json()
        
        if len(transfers) == 0:
            pytest.skip("No transfers to test")
        
        transfer_id = transfers[0]["id"]
        response = self.session.get(f"{BASE_URL}/api/ibt-transfers/{transfer_id}")
        assert response.status_code == 200
        data = response.json()
        
        # Check all expected fields
        assert "id" in data
        assert "transfer_code" in data
        assert "transfer_type" in data
        assert "source_branch" in data
        assert "destination_branch" in data
        assert "item_id" in data
        assert "quantity" in data
        assert "status" in data
        print(f"Transfer details: {data.get('transfer_code')} - {data.get('status')}")
    
    def test_18_get_nonexistent_transfer_returns_404(self):
        """Test GET non-existent transfer returns 404"""
        response = self.session.get(f"{BASE_URL}/api/ibt-transfers/nonexistent-id-12345")
        assert response.status_code == 404
        print("Correctly returned 404 for non-existent transfer")
    
    # --- Branches and Items Tests ---
    def test_19_get_branches_for_ibt(self):
        """Test branches endpoint returns list for IBT dropdowns"""
        response = self.session.get(f"{BASE_URL}/api/branches/names")
        assert response.status_code == 200
        data = response.json()
        assert "branches" in data
        branches = data["branches"]
        assert len(branches) > 0
        assert "Unit 1 Vedica" in branches
        assert "Unit 2 Trikes" in branches
        print(f"Found {len(branches)} branches: {branches[:5]}...")
    
    def test_20_get_raw_materials_for_ibt(self):
        """Test raw materials endpoint for IBT item selection"""
        response = self.session.get(f"{BASE_URL}/api/raw-materials")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        # Check INP_654 exists
        rm_ids = [rm.get("rm_id") for rm in data]
        assert "INP_654" in rm_ids
        print(f"Found {len(data)} raw materials, INP_654 exists")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

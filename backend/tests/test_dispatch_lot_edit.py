"""
Test Dispatch Lot Edit Functionality
Tests PUT /api/dispatch-lots/{lot_id} endpoint for:
- Updating lot fields (target_date, priority, notes)
- Updating line items (adjust quantities, remove lines)
- Rejecting updates for DISPATCHED/DELIVERED lots
- Requiring at least one line item
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
API = f"{BASE_URL}/api"

# Test credentials
ADMIN_EMAIL = "admin@factory.com"
ADMIN_PASSWORD = "admin123"


class TestDispatchLotEdit:
    """Test dispatch lot edit functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login to get token
        login_resp = self.session.post(f"{API}/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if login_resp.status_code == 200:
            token = login_resp.json().get("token")
            if token:
                self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_get_dispatch_lots_list(self):
        """Test GET /api/dispatch-lots/with-readiness returns list"""
        response = self.session.get(f"{API}/dispatch-lots/with-readiness")
        assert response.status_code == 200, f"Failed to get dispatch lots: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Found {len(data)} dispatch lots")
    
    def test_get_dispatch_lot_details(self):
        """Test GET /api/dispatch-lots/{lot_id}/details returns lot with lines"""
        # First get a lot with lines
        lots_resp = self.session.get(f"{API}/dispatch-lots/with-readiness")
        lots = lots_resp.json()
        
        # Find a lot with line_count > 0
        lot_with_lines = None
        for lot in lots:
            if lot.get("line_count", 0) > 0 or lot.get("total_lines", 0) > 0:
                lot_with_lines = lot
                break
        
        if not lot_with_lines:
            pytest.skip("No lots with lines found for testing")
        
        # Get details
        response = self.session.get(f"{API}/dispatch-lots/{lot_with_lines['id']}/details")
        assert response.status_code == 200, f"Failed to get lot details: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should have id"
        assert "lot_code" in data, "Response should have lot_code"
        assert "lines" in data, "Response should have lines array"
        assert isinstance(data["lines"], list), "Lines should be a list"
        print(f"✓ Got details for lot {data['lot_code']} with {len(data['lines'])} lines")
    
    def test_update_lot_fields_only(self):
        """Test updating lot-level fields (target_date, priority, notes) without changing lines"""
        # Get a lot that is not DISPATCHED or DELIVERED
        lots_resp = self.session.get(f"{API}/dispatch-lots/with-readiness")
        lots = lots_resp.json()
        
        editable_lot = None
        for lot in lots:
            if lot.get("status") not in ["DISPATCHED", "DELIVERED"]:
                editable_lot = lot
                break
        
        if not editable_lot:
            pytest.skip("No editable lots found")
        
        # Update only lot-level fields
        new_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%dT00:00:00")
        update_payload = {
            "target_date": new_date,
            "priority": "CRITICAL",
            "notes": "TEST_Updated via pytest"
        }
        
        response = self.session.put(f"{API}/dispatch-lots/{editable_lot['id']}", json=update_payload)
        assert response.status_code == 200, f"Failed to update lot: {response.text}"
        
        data = response.json()
        assert data.get("priority") == "CRITICAL", "Priority should be updated"
        assert "TEST_Updated via pytest" in data.get("notes", ""), "Notes should be updated"
        print(f"✓ Updated lot {editable_lot['lot_code']} fields successfully")
    
    def test_update_line_quantities(self):
        """Test updating line item quantities"""
        # Get a lot with lines
        lots_resp = self.session.get(f"{API}/dispatch-lots/with-readiness")
        lots = lots_resp.json()
        
        lot_with_lines = None
        for lot in lots:
            if lot.get("status") not in ["DISPATCHED", "DELIVERED"] and (lot.get("line_count", 0) > 0 or lot.get("total_lines", 0) > 0):
                lot_with_lines = lot
                break
        
        if not lot_with_lines:
            pytest.skip("No editable lots with lines found")
        
        # Get lot details to get lines
        details_resp = self.session.get(f"{API}/dispatch-lots/{lot_with_lines['id']}/details")
        lot_details = details_resp.json()
        
        if not lot_details.get("lines"):
            pytest.skip("Lot has no lines")
        
        # Update line quantities
        updated_lines = []
        for line in lot_details["lines"]:
            updated_lines.append({
                "id": line.get("id"),
                "sku_id": line.get("sku_id"),
                "brand_id": line.get("brand_id"),
                "vertical_id": line.get("vertical_id"),
                "quantity": line.get("quantity", 100) + 50,  # Increase by 50
                "forecast_id": line.get("forecast_id")
            })
        
        update_payload = {
            "target_date": lot_details.get("target_date"),
            "priority": lot_details.get("priority", "MEDIUM"),
            "notes": "TEST_Quantities updated",
            "lines": updated_lines
        }
        
        response = self.session.put(f"{API}/dispatch-lots/{lot_with_lines['id']}", json=update_payload)
        assert response.status_code == 200, f"Failed to update line quantities: {response.text}"
        
        data = response.json()
        assert "lines" in data, "Response should have lines"
        print(f"✓ Updated line quantities for lot {lot_with_lines['lot_code']}")
    
    def test_remove_line_from_lot(self):
        """Test removing a line from a lot (keeping at least one)"""
        # Get a lot with multiple lines
        lots_resp = self.session.get(f"{API}/dispatch-lots/with-readiness")
        lots = lots_resp.json()
        
        lot_with_multiple_lines = None
        for lot in lots:
            if lot.get("status") not in ["DISPATCHED", "DELIVERED"] and (lot.get("line_count", 0) > 1 or lot.get("total_lines", 0) > 1):
                lot_with_multiple_lines = lot
                break
        
        if not lot_with_multiple_lines:
            pytest.skip("No editable lots with multiple lines found")
        
        # Get lot details
        details_resp = self.session.get(f"{API}/dispatch-lots/{lot_with_multiple_lines['id']}/details")
        lot_details = details_resp.json()
        
        if len(lot_details.get("lines", [])) < 2:
            pytest.skip("Lot doesn't have multiple lines")
        
        # Keep only the first line
        first_line = lot_details["lines"][0]
        updated_lines = [{
            "id": first_line.get("id"),
            "sku_id": first_line.get("sku_id"),
            "brand_id": first_line.get("brand_id"),
            "vertical_id": first_line.get("vertical_id"),
            "quantity": first_line.get("quantity", 100),
            "forecast_id": first_line.get("forecast_id")
        }]
        
        update_payload = {
            "target_date": lot_details.get("target_date"),
            "priority": lot_details.get("priority", "MEDIUM"),
            "notes": "TEST_Line removed",
            "lines": updated_lines
        }
        
        response = self.session.put(f"{API}/dispatch-lots/{lot_with_multiple_lines['id']}", json=update_payload)
        assert response.status_code == 200, f"Failed to remove line: {response.text}"
        
        data = response.json()
        assert len(data.get("lines", [])) == 1, "Should have only 1 line after removal"
        print(f"✓ Removed line from lot {lot_with_multiple_lines['lot_code']}")
    
    def test_reject_update_with_empty_lines(self):
        """Test that updating with empty lines array is rejected"""
        # Get an editable lot
        lots_resp = self.session.get(f"{API}/dispatch-lots/with-readiness")
        lots = lots_resp.json()
        
        editable_lot = None
        for lot in lots:
            if lot.get("status") not in ["DISPATCHED", "DELIVERED"]:
                editable_lot = lot
                break
        
        if not editable_lot:
            pytest.skip("No editable lots found")
        
        # Try to update with empty lines
        update_payload = {
            "target_date": editable_lot.get("target_date"),
            "priority": "HIGH",
            "notes": "TEST_Empty lines",
            "lines": []  # Empty lines array
        }
        
        response = self.session.put(f"{API}/dispatch-lots/{editable_lot['id']}", json=update_payload)
        assert response.status_code == 400, f"Should reject empty lines, got {response.status_code}"
        
        data = response.json()
        assert "at least one line" in data.get("detail", "").lower(), "Error should mention line requirement"
        print(f"✓ Correctly rejected update with empty lines")
    
    def test_reject_update_dispatched_lot(self):
        """Test that DISPATCHED lots cannot be edited"""
        # First, create a lot and set it to DISPATCHED
        lots_resp = self.session.get(f"{API}/dispatch-lots/with-readiness")
        lots = lots_resp.json()
        
        # Find a CREATED lot to change to DISPATCHED for testing
        test_lot = None
        for lot in lots:
            if lot.get("status") == "CREATED" and lot.get("lot_code", "").startswith("DL_"):
                test_lot = lot
                break
        
        if not test_lot:
            pytest.skip("No CREATED lot found for testing")
        
        # Change status to DISPATCHED
        status_resp = self.session.put(f"{API}/dispatch-lots/{test_lot['id']}/status?status=DISPATCHED")
        if status_resp.status_code != 200:
            pytest.skip("Could not change lot status to DISPATCHED")
        
        # Now try to edit the DISPATCHED lot
        update_payload = {
            "target_date": test_lot.get("target_date"),
            "priority": "LOW",
            "notes": "TEST_Should fail"
        }
        
        response = self.session.put(f"{API}/dispatch-lots/{test_lot['id']}", json=update_payload)
        assert response.status_code == 400, f"Should reject editing DISPATCHED lot, got {response.status_code}"
        
        data = response.json()
        assert "dispatched" in data.get("detail", "").lower() or "delivered" in data.get("detail", "").lower(), \
            "Error should mention dispatched/delivered status"
        print(f"✓ Correctly rejected update for DISPATCHED lot")
        
        # Revert status back to CREATED for other tests
        self.session.put(f"{API}/dispatch-lots/{test_lot['id']}/status?status=CREATED")
    
    def test_reject_update_delivered_lot(self):
        """Test that DELIVERED lots cannot be edited"""
        # Find a lot to test with
        lots_resp = self.session.get(f"{API}/dispatch-lots/with-readiness")
        lots = lots_resp.json()
        
        test_lot = None
        for lot in lots:
            if lot.get("status") == "CREATED" and lot.get("lot_code", "").startswith("DL_"):
                test_lot = lot
                break
        
        if not test_lot:
            pytest.skip("No CREATED lot found for testing")
        
        # Change status to DELIVERED
        status_resp = self.session.put(f"{API}/dispatch-lots/{test_lot['id']}/status?status=DELIVERED")
        if status_resp.status_code != 200:
            pytest.skip("Could not change lot status to DELIVERED")
        
        # Try to edit the DELIVERED lot
        update_payload = {
            "target_date": test_lot.get("target_date"),
            "priority": "LOW",
            "notes": "TEST_Should fail"
        }
        
        response = self.session.put(f"{API}/dispatch-lots/{test_lot['id']}", json=update_payload)
        assert response.status_code == 400, f"Should reject editing DELIVERED lot, got {response.status_code}"
        
        data = response.json()
        assert "dispatched" in data.get("detail", "").lower() or "delivered" in data.get("detail", "").lower(), \
            "Error should mention dispatched/delivered status"
        print(f"✓ Correctly rejected update for DELIVERED lot")
        
        # Revert status back to CREATED
        self.session.put(f"{API}/dispatch-lots/{test_lot['id']}/status?status=CREATED")
    
    def test_update_nonexistent_lot(self):
        """Test updating a non-existent lot returns 404"""
        fake_id = "00000000-0000-0000-0000-000000000000"
        update_payload = {
            "target_date": "2026-04-01T00:00:00",
            "priority": "HIGH",
            "notes": "TEST_Should fail"
        }
        
        response = self.session.put(f"{API}/dispatch-lots/{fake_id}", json=update_payload)
        assert response.status_code == 404, f"Should return 404 for non-existent lot, got {response.status_code}"
        print(f"✓ Correctly returned 404 for non-existent lot")


class TestDispatchLotEditIntegration:
    """Integration tests for dispatch lot edit - create, edit, verify"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login
        login_resp = self.session.post(f"{API}/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if login_resp.status_code == 200:
            token = login_resp.json().get("token")
            if token:
                self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_create_edit_verify_flow(self):
        """Test full flow: create lot -> edit lot -> verify changes"""
        # Get a buyer with forecasts
        buyers_resp = self.session.get(f"{API}/dispatch-lots/buyers-with-forecasts")
        buyers = buyers_resp.json()
        
        if not buyers:
            pytest.skip("No buyers with forecasts found")
        
        buyer_id = buyers[0]["id"]
        
        # Get forecasted SKUs for this buyer
        skus_resp = self.session.get(f"{API}/dispatch-lots/forecasted-skus?buyer_id={buyer_id}")
        skus = skus_resp.json()
        
        if not skus:
            pytest.skip("No forecasted SKUs found")
        
        # Create a new dispatch lot
        create_payload = {
            "buyer_id": buyer_id,
            "target_date": "2026-05-01T00:00:00",
            "priority": "MEDIUM",
            "notes": "TEST_Created for edit testing",
            "lines": [{
                "sku_id": skus[0]["sku_id"],
                "brand_id": skus[0].get("brand_id"),
                "vertical_id": skus[0].get("vertical_id"),
                "quantity": 100
            }]
        }
        
        create_resp = self.session.post(f"{API}/dispatch-lots/multi", json=create_payload)
        assert create_resp.status_code == 200, f"Failed to create lot: {create_resp.text}"
        
        created_lot = create_resp.json()
        lot_id = created_lot["id"]
        print(f"✓ Created lot {created_lot['lot_code']}")
        
        # Edit the lot
        edit_payload = {
            "target_date": "2026-06-15T00:00:00",
            "priority": "HIGH",
            "notes": "TEST_Edited successfully",
            "lines": [{
                "id": created_lot["lines"][0]["id"],
                "sku_id": skus[0]["sku_id"],
                "brand_id": skus[0].get("brand_id"),
                "vertical_id": skus[0].get("vertical_id"),
                "quantity": 200  # Changed from 100 to 200
            }]
        }
        
        edit_resp = self.session.put(f"{API}/dispatch-lots/{lot_id}", json=edit_payload)
        assert edit_resp.status_code == 200, f"Failed to edit lot: {edit_resp.text}"
        
        edited_lot = edit_resp.json()
        print(f"✓ Edited lot {edited_lot['lot_code']}")
        
        # Verify changes via GET
        verify_resp = self.session.get(f"{API}/dispatch-lots/{lot_id}/details")
        assert verify_resp.status_code == 200
        
        verified_lot = verify_resp.json()
        assert verified_lot["priority"] == "HIGH", "Priority should be HIGH"
        assert "TEST_Edited successfully" in verified_lot.get("notes", ""), "Notes should be updated"
        assert verified_lot["lines"][0]["quantity"] == 200, "Line quantity should be 200"
        print(f"✓ Verified changes for lot {verified_lot['lot_code']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

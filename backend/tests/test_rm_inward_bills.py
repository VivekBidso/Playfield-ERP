"""
Test RM Inward Bills Feature
Tests the comprehensive RM Inward (Purchase Entry) bill/invoice functionality
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
FINANCE_USER = {"email": "finance@bidso.com", "password": "bidso123"}
ADMIN_USER = {"email": "admin@factory.com", "password": "bidso123"}

# Test data
TEST_VENDOR_ID = "5bbff48e-d4fb-4238-98a9-0ebd22b95173"
TEST_VENDOR_NAME = "SHIPIT EXPRESS LOGISTICS PRIVATE LIMITED"
TEST_RM_ID = "INP_654"
TEST_BRANCH = "Unit 1 Vedica"
TEST_BRANCH_ID = "BR_001"


class TestRMInwardBillsAPI:
    """Test RM Inward Bills API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def get_finance_token(self):
        """Get finance user token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=FINANCE_USER)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Finance user authentication failed")
        
    def get_admin_token(self):
        """Get admin user token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin user authentication failed")

    # ============ Authentication Tests ============
    
    def test_finance_user_login(self):
        """Test finance user can login"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=FINANCE_USER)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == FINANCE_USER["email"]
        assert data["user"]["role"] == "finance_viewer"
        print("PASS: Finance user login successful")
        
    def test_admin_user_login(self):
        """Test admin user can login"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == ADMIN_USER["email"]
        print("PASS: Admin user login successful")

    # ============ Vendor API Tests ============
    
    def test_get_vendors(self):
        """Test GET /api/vendors returns vendor list"""
        token = self.get_finance_token()
        response = self.session.get(
            f"{BASE_URL}/api/vendors",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        # Verify vendor structure
        vendor = data[0]
        assert "id" in vendor
        assert "vendor_id" in vendor
        assert "name" in vendor
        print(f"PASS: GET /api/vendors returned {len(data)} vendors")
        
    def test_vendor_has_required_fields(self):
        """Test vendor data has required fields for dropdown"""
        token = self.get_finance_token()
        response = self.session.get(
            f"{BASE_URL}/api/vendors",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        vendors = response.json()
        # Find test vendor
        test_vendor = next((v for v in vendors if v["id"] == TEST_VENDOR_ID), None)
        assert test_vendor is not None, f"Test vendor {TEST_VENDOR_ID} not found"
        assert test_vendor["name"] == TEST_VENDOR_NAME
        print(f"PASS: Test vendor found with correct name")

    # ============ Branch API Tests ============
    
    def test_get_branches(self):
        """Test GET /api/branches/reference returns branch list"""
        token = self.get_finance_token()
        response = self.session.get(
            f"{BASE_URL}/api/branches/reference",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "branches" in data
        assert len(data["branches"]) > 0
        # Verify branch structure
        branch = data["branches"][0]
        assert "branch_id" in branch
        assert "name" in branch
        print(f"PASS: GET /api/branches/reference returned {len(data['branches'])} branches")

    # ============ Raw Materials API Tests ============
    
    def test_get_raw_materials(self):
        """Test GET /api/raw-materials returns RM list"""
        token = self.get_finance_token()
        response = self.session.get(
            f"{BASE_URL}/api/raw-materials",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        # Verify RM structure
        rm = data[0]
        assert "rm_id" in rm
        assert "category" in rm
        print(f"PASS: GET /api/raw-materials returned {len(data)} RMs")
        
    def test_test_rm_exists(self):
        """Test that test RM INP_654 exists"""
        token = self.get_finance_token()
        response = self.session.get(
            f"{BASE_URL}/api/raw-materials",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        rms = response.json()
        test_rm = next((rm for rm in rms if rm["rm_id"] == TEST_RM_ID), None)
        assert test_rm is not None, f"Test RM {TEST_RM_ID} not found"
        print(f"PASS: Test RM {TEST_RM_ID} found")

    # ============ RM Inward Bills API Tests ============
    
    def test_get_rm_inward_bills(self):
        """Test GET /api/rm-inward/bills returns bills list"""
        token = self.get_finance_token()
        response = self.session.get(
            f"{BASE_URL}/api/rm-inward/bills",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "bills" in data
        assert "total" in data
        print(f"PASS: GET /api/rm-inward/bills returned {data['total']} bills")
        
    def test_get_rm_inward_bills_with_branch_filter(self):
        """Test GET /api/rm-inward/bills with branch filter"""
        token = self.get_finance_token()
        response = self.session.get(
            f"{BASE_URL}/api/rm-inward/bills?branch={TEST_BRANCH}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "bills" in data
        # All returned bills should be for the specified branch
        for bill in data["bills"]:
            assert bill["branch"] == TEST_BRANCH
        print(f"PASS: Branch filter works correctly")
        
    def test_create_rm_inward_bill_single_line_item(self):
        """Test POST /api/rm-inward/bills with single line item"""
        token = self.get_finance_token()
        bill_number = f"TEST-BILL-{uuid.uuid4().hex[:8].upper()}"
        
        payload = {
            "vendor_id": TEST_VENDOR_ID,
            "vendor_name": TEST_VENDOR_NAME,
            "branch": TEST_BRANCH,
            "branch_id": TEST_BRANCH_ID,
            "bill_number": bill_number,
            "order_number": "PO-TEST-001",
            "bill_date": datetime.now().strftime("%Y-%m-%d"),
            "due_date": "2026-02-01",
            "payment_terms": "NET_30",
            "accounts_payable": "Trade Payables",
            "reverse_charge": False,
            "notes": "Pytest single line item test",
            "line_items": [
                {
                    "rm_id": TEST_RM_ID,
                    "quantity": 50,
                    "rate": 25.00,
                    "tax": "GST_18",
                    "tax_amount": 225.00,
                    "amount": 1250.00
                }
            ],
            "totals": {
                "sub_total": 1250.00,
                "discount_type": "percentage",
                "discount_value": 0,
                "discount_amount": 0,
                "tds_tcs": "NONE",
                "tds_tcs_amount": 0,
                "tax_total": 225.00,
                "grand_total": 1475.00
            },
            "date": datetime.now().isoformat()
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/rm-inward/bills",
            headers={"Authorization": f"Bearer {token}"},
            json=payload
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "bill_id" in data
        assert "entries_count" in data
        assert "grand_total" in data
        assert data["entries_count"] == 1
        assert data["grand_total"] == 1475.00
        print(f"PASS: Created bill {data['bill_id']} with 1 line item")
        
    def test_create_rm_inward_bill_multiple_line_items(self):
        """Test POST /api/rm-inward/bills with multiple line items"""
        token = self.get_finance_token()
        bill_number = f"TEST-MULTI-{uuid.uuid4().hex[:8].upper()}"
        
        payload = {
            "vendor_id": TEST_VENDOR_ID,
            "vendor_name": TEST_VENDOR_NAME,
            "branch": TEST_BRANCH,
            "branch_id": TEST_BRANCH_ID,
            "bill_number": bill_number,
            "order_number": "PO-TEST-MULTI",
            "bill_date": datetime.now().strftime("%Y-%m-%d"),
            "due_date": "2026-02-15",
            "payment_terms": "NET_45",
            "accounts_payable": "Sundry Creditors",
            "reverse_charge": True,
            "notes": "Pytest multiple line items test",
            "line_items": [
                {
                    "rm_id": TEST_RM_ID,
                    "quantity": 100,
                    "rate": 30.00,
                    "tax": "GST_18",
                    "tax_amount": 540.00,
                    "amount": 3000.00
                },
                {
                    "rm_id": "INP_655",
                    "quantity": 50,
                    "rate": 40.00,
                    "tax": "GST_12",
                    "tax_amount": 240.00,
                    "amount": 2000.00
                }
            ],
            "totals": {
                "sub_total": 5000.00,
                "discount_type": "amount",
                "discount_value": 200,
                "discount_amount": 200.00,
                "tds_tcs": "TDS_2",
                "tds_tcs_amount": 96.00,
                "tax_total": 780.00,
                "grand_total": 5484.00
            },
            "date": datetime.now().isoformat()
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/rm-inward/bills",
            headers={"Authorization": f"Bearer {token}"},
            json=payload
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["entries_count"] == 2
        print(f"PASS: Created bill {data['bill_id']} with 2 line items")
        
    def test_create_bill_with_discount_percentage(self):
        """Test bill creation with percentage discount"""
        token = self.get_finance_token()
        bill_number = f"TEST-DISC-PCT-{uuid.uuid4().hex[:8].upper()}"
        
        payload = {
            "vendor_id": TEST_VENDOR_ID,
            "vendor_name": TEST_VENDOR_NAME,
            "branch": TEST_BRANCH,
            "bill_number": bill_number,
            "bill_date": datetime.now().strftime("%Y-%m-%d"),
            "payment_terms": "NET_30",
            "accounts_payable": "Trade Payables",
            "reverse_charge": False,
            "line_items": [
                {
                    "rm_id": TEST_RM_ID,
                    "quantity": 100,
                    "rate": 100.00,
                    "tax": "GST_18",
                    "tax_amount": 1800.00,
                    "amount": 10000.00
                }
            ],
            "totals": {
                "sub_total": 10000.00,
                "discount_type": "percentage",
                "discount_value": 10,
                "discount_amount": 1000.00,
                "tds_tcs": "NONE",
                "tds_tcs_amount": 0,
                "tax_total": 1800.00,
                "grand_total": 10800.00
            }
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/rm-inward/bills",
            headers={"Authorization": f"Bearer {token}"},
            json=payload
        )
        
        assert response.status_code == 200
        print("PASS: Bill with percentage discount created")
        
    def test_create_bill_with_tds(self):
        """Test bill creation with TDS deduction"""
        token = self.get_finance_token()
        bill_number = f"TEST-TDS-{uuid.uuid4().hex[:8].upper()}"
        
        payload = {
            "vendor_id": TEST_VENDOR_ID,
            "vendor_name": TEST_VENDOR_NAME,
            "branch": TEST_BRANCH,
            "bill_number": bill_number,
            "bill_date": datetime.now().strftime("%Y-%m-%d"),
            "payment_terms": "NET_30",
            "accounts_payable": "Trade Payables",
            "reverse_charge": False,
            "line_items": [
                {
                    "rm_id": TEST_RM_ID,
                    "quantity": 100,
                    "rate": 100.00,
                    "tax": "GST_18",
                    "tax_amount": 1800.00,
                    "amount": 10000.00
                }
            ],
            "totals": {
                "sub_total": 10000.00,
                "discount_type": "percentage",
                "discount_value": 0,
                "discount_amount": 0,
                "tds_tcs": "TDS_10",
                "tds_tcs_amount": 1000.00,
                "tax_total": 1800.00,
                "grand_total": 10800.00
            }
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/rm-inward/bills",
            headers={"Authorization": f"Bearer {token}"},
            json=payload
        )
        
        assert response.status_code == 200
        print("PASS: Bill with TDS deduction created")
        
    def test_create_bill_invalid_rm_returns_404(self):
        """Test bill creation with invalid RM ID returns 404"""
        token = self.get_finance_token()
        bill_number = f"TEST-INVALID-{uuid.uuid4().hex[:8].upper()}"
        
        payload = {
            "vendor_id": TEST_VENDOR_ID,
            "vendor_name": TEST_VENDOR_NAME,
            "branch": TEST_BRANCH,
            "bill_number": bill_number,
            "bill_date": datetime.now().strftime("%Y-%m-%d"),
            "payment_terms": "NET_30",
            "accounts_payable": "Trade Payables",
            "reverse_charge": False,
            "line_items": [
                {
                    "rm_id": "INVALID_RM_ID_12345",
                    "quantity": 100,
                    "rate": 100.00,
                    "tax": "GST_18",
                    "tax_amount": 1800.00,
                    "amount": 10000.00
                }
            ],
            "totals": {
                "sub_total": 10000.00,
                "discount_type": "percentage",
                "discount_value": 0,
                "discount_amount": 0,
                "tds_tcs": "NONE",
                "tds_tcs_amount": 0,
                "tax_total": 1800.00,
                "grand_total": 11800.00
            }
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/rm-inward/bills",
            headers={"Authorization": f"Bearer {token}"},
            json=payload
        )
        
        assert response.status_code == 404
        print("PASS: Invalid RM ID correctly returns 404")

    # ============ Purchase Entries API Tests ============
    
    def test_get_purchase_entries(self):
        """Test GET /api/purchase-entries returns entries"""
        token = self.get_finance_token()
        response = self.session.get(
            f"{BASE_URL}/api/purchase-entries?branch={TEST_BRANCH}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: GET /api/purchase-entries returned {len(data)} entries")
        
    def test_purchase_entries_created_from_bill(self):
        """Test that purchase entries are created when bill is created"""
        token = self.get_finance_token()
        
        # Get current count
        response = self.session.get(
            f"{BASE_URL}/api/purchase-entries?branch={TEST_BRANCH}",
            headers={"Authorization": f"Bearer {token}"}
        )
        initial_count = len(response.json())
        
        # Create a bill
        bill_number = f"TEST-ENTRY-{uuid.uuid4().hex[:8].upper()}"
        payload = {
            "vendor_id": TEST_VENDOR_ID,
            "vendor_name": TEST_VENDOR_NAME,
            "branch": TEST_BRANCH,
            "bill_number": bill_number,
            "bill_date": datetime.now().strftime("%Y-%m-%d"),
            "payment_terms": "NET_30",
            "accounts_payable": "Trade Payables",
            "reverse_charge": False,
            "line_items": [
                {
                    "rm_id": TEST_RM_ID,
                    "quantity": 10,
                    "rate": 10.00,
                    "tax": "GST_18",
                    "tax_amount": 18.00,
                    "amount": 100.00
                }
            ],
            "totals": {
                "sub_total": 100.00,
                "discount_type": "percentage",
                "discount_value": 0,
                "discount_amount": 0,
                "tds_tcs": "NONE",
                "tds_tcs_amount": 0,
                "tax_total": 18.00,
                "grand_total": 118.00
            }
        }
        
        self.session.post(
            f"{BASE_URL}/api/rm-inward/bills",
            headers={"Authorization": f"Bearer {token}"},
            json=payload
        )
        
        # Get new count
        response = self.session.get(
            f"{BASE_URL}/api/purchase-entries?branch={TEST_BRANCH}",
            headers={"Authorization": f"Bearer {token}"}
        )
        new_count = len(response.json())
        
        assert new_count > initial_count
        print(f"PASS: Purchase entries increased from {initial_count} to {new_count}")

    # ============ Bill Data Verification Tests ============
    
    def test_bill_contains_all_required_fields(self):
        """Test that created bill contains all required fields"""
        token = self.get_finance_token()
        response = self.session.get(
            f"{BASE_URL}/api/rm-inward/bills",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        bills = response.json()["bills"]
        
        if len(bills) > 0:
            bill = bills[0]
            required_fields = [
                "id", "bill_id", "vendor_id", "vendor_name", "branch",
                "bill_number", "bill_date", "payment_terms", "accounts_payable",
                "line_items", "totals", "status", "created_by", "created_at"
            ]
            for field in required_fields:
                assert field in bill, f"Missing field: {field}"
            print("PASS: Bill contains all required fields")
        else:
            pytest.skip("No bills to verify")
            
    def test_bill_line_items_structure(self):
        """Test that bill line items have correct structure"""
        token = self.get_finance_token()
        response = self.session.get(
            f"{BASE_URL}/api/rm-inward/bills",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        bills = response.json()["bills"]
        if len(bills) > 0:
            bill = bills[0]
            assert "line_items" in bill
            assert len(bill["line_items"]) > 0
            
            line_item = bill["line_items"][0]
            required_fields = ["rm_id", "quantity", "rate", "tax", "amount"]
            for field in required_fields:
                assert field in line_item, f"Missing line item field: {field}"
            print("PASS: Line items have correct structure")
        else:
            pytest.skip("No bills to verify")
            
    def test_bill_totals_structure(self):
        """Test that bill totals have correct structure"""
        token = self.get_finance_token()
        response = self.session.get(
            f"{BASE_URL}/api/rm-inward/bills",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        bills = response.json()["bills"]
        if len(bills) > 0:
            bill = bills[0]
            assert "totals" in bill
            
            totals = bill["totals"]
            required_fields = [
                "sub_total", "discount_type", "discount_value", "discount_amount",
                "tds_tcs", "tds_tcs_amount", "tax_total", "grand_total"
            ]
            for field in required_fields:
                assert field in totals, f"Missing totals field: {field}"
            print("PASS: Totals have correct structure")
        else:
            pytest.skip("No bills to verify")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

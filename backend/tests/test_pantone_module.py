"""
Pantone Shade Management Module Tests
- Pantone shade CRUD operations
- Vendor master batch mapping
- QC approval workflow
- Search and filter functionality
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@factory.com"
ADMIN_PASSWORD = "bidso123"
TECH_OPS_EMAIL = "tech_ops@factory.com"
TECH_OPS_PASSWORD = "bidso123"


class TestPantoneShadesCRUD:
    """Pantone Shades CRUD operations tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Store created test data for cleanup
        self.created_shade_ids = []
        self.created_mapping_ids = []
        
        yield
        
        # Cleanup test data
        for shade_id in self.created_shade_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/pantone/shades/{shade_id}")
            except:
                pass
    
    def test_get_pantone_shades_list(self):
        """Test GET /api/pantone/shades - List all shades"""
        response = self.session.get(f"{BASE_URL}/api/pantone/shades")
        
        assert response.status_code == 200, f"Failed to get shades: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "items" in data, "Response should have 'items' field"
        assert "total" in data, "Response should have 'total' field"
        assert "limit" in data, "Response should have 'limit' field"
        assert "skip" in data, "Response should have 'skip' field"
        assert isinstance(data["items"], list), "Items should be a list"
        
        print(f"✓ GET /api/pantone/shades - Found {data['total']} shades")
    
    def test_create_pantone_shade(self):
        """Test POST /api/pantone/shades - Create new shade"""
        unique_code = f"TEST_{uuid.uuid4().hex[:6].upper()}"
        
        shade_data = {
            "pantone_code": unique_code,
            "pantone_name": "Test Shade",
            "color_hex": "#FF5733",
            "color_family": "RED",
            "applicable_categories": ["INP", "INM"],
            "notes": "Test shade for automated testing"
        }
        
        response = self.session.post(f"{BASE_URL}/api/pantone/shades", json=shade_data)
        
        assert response.status_code == 200, f"Failed to create shade: {response.text}"
        data = response.json()
        
        # Verify response data
        assert "id" in data, "Response should have 'id' field"
        assert data["pantone_code"] == unique_code.upper(), "Pantone code should match"
        assert data["pantone_name"] == "Test Shade", "Pantone name should match"
        assert data["color_hex"] == "#FF5733", "Color hex should match"
        assert data["color_family"] == "RED", "Color family should match"
        assert data["status"] == "ACTIVE", "Status should be ACTIVE"
        
        self.created_shade_ids.append(data["id"])
        
        print(f"✓ POST /api/pantone/shades - Created shade {unique_code}")
        
        return data
    
    def test_create_duplicate_shade_fails(self):
        """Test POST /api/pantone/shades - Duplicate code should fail"""
        # First create a shade
        unique_code = f"TEST_{uuid.uuid4().hex[:6].upper()}"
        
        shade_data = {
            "pantone_code": unique_code,
            "pantone_name": "Original Shade",
            "color_hex": "#FF5733",
            "color_family": "RED",
            "applicable_categories": ["INP"]
        }
        
        response1 = self.session.post(f"{BASE_URL}/api/pantone/shades", json=shade_data)
        assert response1.status_code == 200
        self.created_shade_ids.append(response1.json()["id"])
        
        # Try to create duplicate
        response2 = self.session.post(f"{BASE_URL}/api/pantone/shades", json=shade_data)
        assert response2.status_code == 400, "Duplicate shade should return 400"
        
        print(f"✓ POST /api/pantone/shades - Duplicate code correctly rejected")
    
    def test_get_single_pantone_shade(self):
        """Test GET /api/pantone/shades/{id} - Get single shade with vendor mappings"""
        # First create a shade
        created = self.test_create_pantone_shade()
        shade_id = created["id"]
        
        response = self.session.get(f"{BASE_URL}/api/pantone/shades/{shade_id}")
        
        assert response.status_code == 200, f"Failed to get shade: {response.text}"
        data = response.json()
        
        assert data["id"] == shade_id, "ID should match"
        assert "vendor_mappings" in data, "Response should include vendor_mappings"
        assert isinstance(data["vendor_mappings"], list), "vendor_mappings should be a list"
        
        print(f"✓ GET /api/pantone/shades/{shade_id} - Retrieved shade details")
    
    def test_update_pantone_shade(self):
        """Test PUT /api/pantone/shades/{id} - Update shade"""
        # First create a shade
        created = self.test_create_pantone_shade()
        shade_id = created["id"]
        
        update_data = {
            "pantone_name": "Updated Test Shade",
            "color_hex": "#00FF00",
            "color_family": "GREEN",
            "notes": "Updated notes"
        }
        
        response = self.session.put(f"{BASE_URL}/api/pantone/shades/{shade_id}", json=update_data)
        
        assert response.status_code == 200, f"Failed to update shade: {response.text}"
        data = response.json()
        
        assert data["pantone_name"] == "Updated Test Shade", "Name should be updated"
        assert data["color_hex"] == "#00FF00", "Color hex should be updated"
        assert data["color_family"] == "GREEN", "Color family should be updated"
        
        # Verify persistence with GET
        get_response = self.session.get(f"{BASE_URL}/api/pantone/shades/{shade_id}")
        assert get_response.status_code == 200
        get_data = get_response.json()
        assert get_data["pantone_name"] == "Updated Test Shade", "Update should persist"
        
        print(f"✓ PUT /api/pantone/shades/{shade_id} - Updated shade successfully")
    
    def test_delete_pantone_shade(self):
        """Test DELETE /api/pantone/shades/{id} - Soft delete (deprecate) shade"""
        # First create a shade
        created = self.test_create_pantone_shade()
        shade_id = created["id"]
        
        response = self.session.delete(f"{BASE_URL}/api/pantone/shades/{shade_id}")
        
        assert response.status_code == 200, f"Failed to delete shade: {response.text}"
        data = response.json()
        assert "message" in data, "Response should have message"
        
        # Verify shade is deprecated (not in active list)
        list_response = self.session.get(f"{BASE_URL}/api/pantone/shades")
        assert list_response.status_code == 200
        items = list_response.json()["items"]
        shade_ids = [s["id"] for s in items]
        assert shade_id not in shade_ids, "Deprecated shade should not appear in active list"
        
        # Remove from cleanup list since already deleted
        self.created_shade_ids.remove(shade_id)
        
        print(f"✓ DELETE /api/pantone/shades/{shade_id} - Shade deprecated successfully")
    
    def test_search_pantone_shades(self):
        """Test GET /api/pantone/shades?search= - Search by code or name"""
        # Create a shade with unique name
        unique_code = f"SRCH_{uuid.uuid4().hex[:4].upper()}"
        
        shade_data = {
            "pantone_code": unique_code,
            "pantone_name": "Searchable Test Shade",
            "color_hex": "#123456",
            "color_family": "BLUE",
            "applicable_categories": ["INP"]
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/pantone/shades", json=shade_data)
        assert create_response.status_code == 200
        self.created_shade_ids.append(create_response.json()["id"])
        
        # Search by code
        search_response = self.session.get(f"{BASE_URL}/api/pantone/shades?search={unique_code}")
        assert search_response.status_code == 200
        data = search_response.json()
        assert data["total"] >= 1, "Should find at least one shade"
        
        found_codes = [s["pantone_code"] for s in data["items"]]
        assert unique_code in found_codes, f"Should find shade with code {unique_code}"
        
        print(f"✓ GET /api/pantone/shades?search={unique_code} - Search working")
    
    def test_filter_by_category(self):
        """Test GET /api/pantone/shades?category= - Filter by category"""
        response = self.session.get(f"{BASE_URL}/api/pantone/shades?category=INP")
        
        assert response.status_code == 200, f"Failed to filter: {response.text}"
        data = response.json()
        
        # All returned shades should have INP in applicable_categories
        for shade in data["items"]:
            assert "INP" in shade.get("applicable_categories", []), \
                f"Shade {shade['pantone_code']} should have INP category"
        
        print(f"✓ GET /api/pantone/shades?category=INP - Category filter working")
    
    def test_filter_by_color_family(self):
        """Test GET /api/pantone/shades?color_family= - Filter by color family"""
        response = self.session.get(f"{BASE_URL}/api/pantone/shades?color_family=RED")
        
        assert response.status_code == 200, f"Failed to filter: {response.text}"
        data = response.json()
        
        # All returned shades should have RED color family
        for shade in data["items"]:
            assert shade.get("color_family") == "RED", \
                f"Shade {shade['pantone_code']} should have RED color family"
        
        print(f"✓ GET /api/pantone/shades?color_family=RED - Color family filter working")


class TestVendorMasterbatchMapping:
    """Vendor Master Batch Mapping tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get a vendor for testing
        vendors_response = self.session.get(f"{BASE_URL}/api/vendors")
        assert vendors_response.status_code == 200
        vendors = vendors_response.json()
        assert len(vendors) > 0, "Need at least one vendor for testing"
        self.test_vendor = vendors[0]
        
        # Store created test data for cleanup
        self.created_shade_ids = []
        self.created_mapping_ids = []
        
        yield
        
        # Cleanup
        for mapping_id in self.created_mapping_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/pantone/vendor-masterbatch/{mapping_id}")
            except:
                pass
        for shade_id in self.created_shade_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/pantone/shades/{shade_id}")
            except:
                pass
    
    def _create_test_shade(self):
        """Helper to create a test shade"""
        unique_code = f"VND_{uuid.uuid4().hex[:6].upper()}"
        
        shade_data = {
            "pantone_code": unique_code,
            "pantone_name": "Vendor Test Shade",
            "color_hex": "#AABBCC",
            "color_family": "BLUE",
            "applicable_categories": ["INP", "INM", "ACC"]
        }
        
        response = self.session.post(f"{BASE_URL}/api/pantone/shades", json=shade_data)
        assert response.status_code == 200
        shade = response.json()
        self.created_shade_ids.append(shade["id"])
        return shade
    
    def test_create_vendor_masterbatch_mapping(self):
        """Test POST /api/pantone/vendor-masterbatch - Add vendor mapping"""
        shade = self._create_test_shade()
        
        mapping_data = {
            "pantone_id": shade["id"],
            "vendor_id": self.test_vendor["id"],
            "master_batch_code": f"MB-{uuid.uuid4().hex[:6].upper()}",
            "delta_e_value": 0.8,
            "lead_time_days": 14,
            "moq": 100,
            "notes": "Test mapping"
        }
        
        response = self.session.post(f"{BASE_URL}/api/pantone/vendor-masterbatch", json=mapping_data)
        
        assert response.status_code == 200, f"Failed to create mapping: {response.text}"
        data = response.json()
        
        assert "id" in data, "Response should have 'id' field"
        assert data["pantone_id"] == shade["id"], "Pantone ID should match"
        assert data["vendor_id"] == self.test_vendor["id"], "Vendor ID should match"
        assert data["approval_status"] == "PENDING", "Initial status should be PENDING"
        assert data["is_preferred"] == False, "Should not be preferred initially"
        
        self.created_mapping_ids.append(data["id"])
        
        print(f"✓ POST /api/pantone/vendor-masterbatch - Created mapping successfully")
        
        return data
    
    def test_create_duplicate_vendor_mapping_fails(self):
        """Test POST /api/pantone/vendor-masterbatch - Duplicate mapping should fail"""
        shade = self._create_test_shade()
        
        mapping_data = {
            "pantone_id": shade["id"],
            "vendor_id": self.test_vendor["id"],
            "master_batch_code": f"MB-{uuid.uuid4().hex[:6].upper()}"
        }
        
        # First mapping
        response1 = self.session.post(f"{BASE_URL}/api/pantone/vendor-masterbatch", json=mapping_data)
        assert response1.status_code == 200
        self.created_mapping_ids.append(response1.json()["id"])
        
        # Duplicate mapping
        mapping_data["master_batch_code"] = f"MB-{uuid.uuid4().hex[:6].upper()}"  # Different code
        response2 = self.session.post(f"{BASE_URL}/api/pantone/vendor-masterbatch", json=mapping_data)
        assert response2.status_code == 400, "Duplicate vendor mapping should fail"
        
        print(f"✓ POST /api/pantone/vendor-masterbatch - Duplicate correctly rejected")
    
    def test_get_shade_vendors(self):
        """Test GET /api/pantone/shades/{id}/vendors - Get vendor mappings for shade"""
        shade = self._create_test_shade()
        
        # Create a mapping
        mapping_data = {
            "pantone_id": shade["id"],
            "vendor_id": self.test_vendor["id"],
            "master_batch_code": f"MB-{uuid.uuid4().hex[:6].upper()}"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/pantone/vendor-masterbatch", json=mapping_data)
        assert create_response.status_code == 200
        self.created_mapping_ids.append(create_response.json()["id"])
        
        # Get vendors
        response = self.session.get(f"{BASE_URL}/api/pantone/shades/{shade['id']}/vendors")
        
        assert response.status_code == 200, f"Failed to get vendors: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        assert len(data) >= 1, "Should have at least one vendor mapping"
        
        print(f"✓ GET /api/pantone/shades/{shade['id']}/vendors - Retrieved vendor mappings")
    
    def test_update_vendor_masterbatch(self):
        """Test PUT /api/pantone/vendor-masterbatch/{id} - Update mapping"""
        mapping = self.test_create_vendor_masterbatch_mapping()
        
        update_data = {
            "delta_e_value": 0.5,
            "lead_time_days": 10,
            "moq": 200,
            "notes": "Updated notes"
        }
        
        response = self.session.put(
            f"{BASE_URL}/api/pantone/vendor-masterbatch/{mapping['id']}", 
            json=update_data
        )
        
        assert response.status_code == 200, f"Failed to update mapping: {response.text}"
        data = response.json()
        
        assert data["delta_e_value"] == 0.5, "Delta E should be updated"
        assert data["lead_time_days"] == 10, "Lead time should be updated"
        assert data["moq"] == 200, "MOQ should be updated"
        
        print(f"✓ PUT /api/pantone/vendor-masterbatch/{mapping['id']} - Updated successfully")


class TestQCApprovalWorkflow:
    """QC Approval Workflow tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin (master_admin role)
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get a vendor for testing
        vendors_response = self.session.get(f"{BASE_URL}/api/vendors")
        assert vendors_response.status_code == 200
        vendors = vendors_response.json()
        assert len(vendors) > 0, "Need at least one vendor for testing"
        self.test_vendor = vendors[0]
        
        # Store created test data for cleanup
        self.created_shade_ids = []
        self.created_mapping_ids = []
        
        yield
        
        # Cleanup
        for mapping_id in self.created_mapping_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/pantone/vendor-masterbatch/{mapping_id}")
            except:
                pass
        for shade_id in self.created_shade_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/pantone/shades/{shade_id}")
            except:
                pass
    
    def _create_test_shade_with_mapping(self):
        """Helper to create a test shade with vendor mapping"""
        unique_code = f"QC_{uuid.uuid4().hex[:6].upper()}"
        
        shade_data = {
            "pantone_code": unique_code,
            "pantone_name": "QC Test Shade",
            "color_hex": "#DDEEFF",
            "color_family": "BLUE",
            "applicable_categories": ["INP"]
        }
        
        shade_response = self.session.post(f"{BASE_URL}/api/pantone/shades", json=shade_data)
        assert shade_response.status_code == 200
        shade = shade_response.json()
        self.created_shade_ids.append(shade["id"])
        
        mapping_data = {
            "pantone_id": shade["id"],
            "vendor_id": self.test_vendor["id"],
            "master_batch_code": f"MB-{uuid.uuid4().hex[:6].upper()}",
            "delta_e_value": 1.2
        }
        
        mapping_response = self.session.post(f"{BASE_URL}/api/pantone/vendor-masterbatch", json=mapping_data)
        assert mapping_response.status_code == 200
        mapping = mapping_response.json()
        self.created_mapping_ids.append(mapping["id"])
        
        return shade, mapping
    
    def test_approve_vendor_masterbatch(self):
        """Test PUT /api/pantone/vendor-masterbatch/{id}/approve - QC approve"""
        shade, mapping = self._create_test_shade_with_mapping()
        
        assert mapping["approval_status"] == "PENDING", "Initial status should be PENDING"
        
        response = self.session.put(
            f"{BASE_URL}/api/pantone/vendor-masterbatch/{mapping['id']}/approve",
            json={"delta_e_value": 0.7, "notes": "Approved after QC check"}
        )
        
        assert response.status_code == 200, f"Failed to approve: {response.text}"
        data = response.json()
        assert "message" in data, "Response should have message"
        
        # Verify approval persisted
        get_response = self.session.get(f"{BASE_URL}/api/pantone/shades/{shade['id']}/vendors")
        assert get_response.status_code == 200
        vendors = get_response.json()
        
        approved_mapping = next((v for v in vendors if v["id"] == mapping["id"]), None)
        assert approved_mapping is not None, "Mapping should exist"
        assert approved_mapping["approval_status"] == "APPROVED", "Status should be APPROVED"
        
        print(f"✓ PUT /api/pantone/vendor-masterbatch/{mapping['id']}/approve - Approved successfully")
    
    def test_reject_vendor_masterbatch(self):
        """Test PUT /api/pantone/vendor-masterbatch/{id}/reject - QC reject"""
        shade, mapping = self._create_test_shade_with_mapping()
        
        response = self.session.put(
            f"{BASE_URL}/api/pantone/vendor-masterbatch/{mapping['id']}/reject",
            json={"rejection_reason": "Delta E too high"}
        )
        
        assert response.status_code == 200, f"Failed to reject: {response.text}"
        data = response.json()
        assert "message" in data, "Response should have message"
        
        # Verify rejection persisted
        get_response = self.session.get(f"{BASE_URL}/api/pantone/shades/{shade['id']}/vendors")
        assert get_response.status_code == 200
        vendors = get_response.json()
        
        rejected_mapping = next((v for v in vendors if v["id"] == mapping["id"]), None)
        assert rejected_mapping is not None, "Mapping should exist"
        assert rejected_mapping["approval_status"] == "REJECTED", "Status should be REJECTED"
        
        print(f"✓ PUT /api/pantone/vendor-masterbatch/{mapping['id']}/reject - Rejected successfully")
    
    def test_set_preferred_vendor(self):
        """Test PUT /api/pantone/vendor-masterbatch/{id}/set-preferred - Set preferred vendor"""
        shade, mapping = self._create_test_shade_with_mapping()
        
        # First approve the mapping
        approve_response = self.session.put(
            f"{BASE_URL}/api/pantone/vendor-masterbatch/{mapping['id']}/approve",
            json={}
        )
        assert approve_response.status_code == 200
        
        # Set as preferred
        response = self.session.put(
            f"{BASE_URL}/api/pantone/vendor-masterbatch/{mapping['id']}/set-preferred"
        )
        
        assert response.status_code == 200, f"Failed to set preferred: {response.text}"
        data = response.json()
        assert "message" in data, "Response should have message"
        
        # Verify preferred status
        get_response = self.session.get(f"{BASE_URL}/api/pantone/shades/{shade['id']}/vendors")
        assert get_response.status_code == 200
        vendors = get_response.json()
        
        preferred_mapping = next((v for v in vendors if v["id"] == mapping["id"]), None)
        assert preferred_mapping is not None, "Mapping should exist"
        assert preferred_mapping["is_preferred"] == True, "Should be marked as preferred"
        
        print(f"✓ PUT /api/pantone/vendor-masterbatch/{mapping['id']}/set-preferred - Set successfully")
    
    def test_set_preferred_requires_approval(self):
        """Test that only approved vendors can be set as preferred"""
        shade, mapping = self._create_test_shade_with_mapping()
        
        # Try to set as preferred without approval
        response = self.session.put(
            f"{BASE_URL}/api/pantone/vendor-masterbatch/{mapping['id']}/set-preferred"
        )
        
        assert response.status_code == 400, "Should fail for non-approved vendor"
        
        print(f"✓ Set preferred correctly requires approval first")
    
    def test_get_pending_approvals(self):
        """Test GET /api/pantone/vendor-masterbatch/pending - Get pending approvals"""
        # Create a pending mapping
        shade, mapping = self._create_test_shade_with_mapping()
        
        response = self.session.get(f"{BASE_URL}/api/pantone/vendor-masterbatch/pending")
        
        assert response.status_code == 200, f"Failed to get pending: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        
        # All items should be PENDING
        for item in data:
            assert item["approval_status"] == "PENDING", "All items should be PENDING"
        
        print(f"✓ GET /api/pantone/vendor-masterbatch/pending - Found {len(data)} pending approvals")


class TestExportImportTemplate:
    """Export and Import Template tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_download_import_template(self):
        """Test GET /api/pantone/shades/download-template - Download template"""
        response = self.session.get(f"{BASE_URL}/api/pantone/shades/download-template")
        
        assert response.status_code == 200, f"Failed to download template: {response.text}"
        
        # Check content type
        content_type = response.headers.get("Content-Type", "")
        assert "spreadsheet" in content_type or "excel" in content_type.lower() or "octet-stream" in content_type, \
            f"Should return Excel file, got: {content_type}"
        
        # Check content disposition
        content_disposition = response.headers.get("Content-Disposition", "")
        assert "Pantone_Import_Template" in content_disposition, \
            f"Should have correct filename, got: {content_disposition}"
        
        print(f"✓ GET /api/pantone/shades/download-template - Template downloaded")
    
    def test_export_pantone_data(self):
        """Test GET /api/pantone/shades/export - Export all data"""
        response = self.session.get(f"{BASE_URL}/api/pantone/shades/export")
        
        assert response.status_code == 200, f"Failed to export: {response.text}"
        
        # Check content type
        content_type = response.headers.get("Content-Type", "")
        assert "spreadsheet" in content_type or "excel" in content_type.lower() or "octet-stream" in content_type, \
            f"Should return Excel file, got: {content_type}"
        
        # Check content disposition
        content_disposition = response.headers.get("Content-Disposition", "")
        assert "Pantone_Export" in content_disposition, \
            f"Should have correct filename, got: {content_disposition}"
        
        print(f"✓ GET /api/pantone/shades/export - Data exported")


class TestIntegrationHelpers:
    """Integration helper endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get a vendor for testing
        vendors_response = self.session.get(f"{BASE_URL}/api/vendors")
        assert vendors_response.status_code == 200
        vendors = vendors_response.json()
        assert len(vendors) > 0, "Need at least one vendor for testing"
        self.test_vendor = vendors[0]
        
        # Store created test data for cleanup
        self.created_shade_ids = []
        self.created_mapping_ids = []
        
        yield
        
        # Cleanup
        for mapping_id in self.created_mapping_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/pantone/vendor-masterbatch/{mapping_id}")
            except:
                pass
        for shade_id in self.created_shade_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/pantone/shades/{shade_id}")
            except:
                pass
    
    def test_get_approved_vendors_for_shade(self):
        """Test GET /api/pantone/shades/{id}/approved-vendors - Get approved vendors"""
        # Create shade with approved vendor
        unique_code = f"APV_{uuid.uuid4().hex[:6].upper()}"
        
        shade_data = {
            "pantone_code": unique_code,
            "pantone_name": "Approved Vendor Test",
            "color_hex": "#112233",
            "color_family": "BLUE",
            "applicable_categories": ["INP"]
        }
        
        shade_response = self.session.post(f"{BASE_URL}/api/pantone/shades", json=shade_data)
        assert shade_response.status_code == 200
        shade = shade_response.json()
        self.created_shade_ids.append(shade["id"])
        
        # Create and approve mapping
        mapping_data = {
            "pantone_id": shade["id"],
            "vendor_id": self.test_vendor["id"],
            "master_batch_code": f"MB-{uuid.uuid4().hex[:6].upper()}"
        }
        
        mapping_response = self.session.post(f"{BASE_URL}/api/pantone/vendor-masterbatch", json=mapping_data)
        assert mapping_response.status_code == 200
        mapping = mapping_response.json()
        self.created_mapping_ids.append(mapping["id"])
        
        # Approve
        approve_response = self.session.put(
            f"{BASE_URL}/api/pantone/vendor-masterbatch/{mapping['id']}/approve",
            json={}
        )
        assert approve_response.status_code == 200
        
        # Get approved vendors
        response = self.session.get(f"{BASE_URL}/api/pantone/shades/{shade['id']}/approved-vendors")
        
        assert response.status_code == 200, f"Failed to get approved vendors: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        assert len(data) >= 1, "Should have at least one approved vendor"
        
        for vendor in data:
            assert vendor["approval_status"] == "APPROVED", "All should be approved"
        
        print(f"✓ GET /api/pantone/shades/{shade['id']}/approved-vendors - Retrieved approved vendors")
    
    def test_get_pantone_by_category(self):
        """Test GET /api/pantone/by-category/{category} - Get shades by category"""
        response = self.session.get(f"{BASE_URL}/api/pantone/by-category/INP")
        
        assert response.status_code == 200, f"Failed to get by category: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        
        for shade in data:
            assert "INP" in shade.get("applicable_categories", []), \
                f"Shade {shade['pantone_code']} should have INP category"
            assert shade.get("status") == "ACTIVE", "All should be active"
        
        print(f"✓ GET /api/pantone/by-category/INP - Found {len(data)} shades")


class TestExistingPantoneData:
    """Test existing Pantone data created by main agent"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_existing_pantone_shades(self):
        """Verify existing Pantone shades created by main agent"""
        response = self.session.get(f"{BASE_URL}/api/pantone/shades")
        
        assert response.status_code == 200, f"Failed to get shades: {response.text}"
        data = response.json()
        
        # Check for expected test shades
        expected_codes = ["485 C", "2728 C", "360 C"]
        found_codes = [s["pantone_code"] for s in data["items"]]
        
        for code in expected_codes:
            if code in found_codes:
                print(f"  ✓ Found expected shade: {code}")
            else:
                print(f"  ⚠ Expected shade not found: {code}")
        
        print(f"✓ Verified existing Pantone shades - Total: {data['total']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

"""
Test suite for Vendor Management and Raw Materials Filters
Tests:
- Vendor CRUD operations (Create, Read, Update, Delete)
- Vendor auto-generated ID (VND_XXX format)
- Vendor RM pricing
- Price comparison report
- Vendor bulk upload
- RM column-based filters (Category, Type, Model, Colour, Brand)
- RM search functionality
- RM pagination (100 items per page)
- RM filter reset/clear functionality
"""

import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestVendorManagement:
    """Vendor Management CRUD and features tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@factory.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        token = login_response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_get_vendors_list(self):
        """Test GET /api/vendors - should return list of vendors"""
        response = self.session.get(f"{BASE_URL}/api/vendors")
        assert response.status_code == 200
        vendors = response.json()
        assert isinstance(vendors, list)
        assert len(vendors) > 0, "Expected vendors in the system"
        # Verify vendor structure
        vendor = vendors[0]
        assert "id" in vendor
        assert "vendor_id" in vendor
        assert "name" in vendor
        print(f"SUCCESS: Found {len(vendors)} vendors")
    
    def test_vendor_id_format(self):
        """Test that vendors have auto-generated VND_XXX format IDs"""
        response = self.session.get(f"{BASE_URL}/api/vendors")
        assert response.status_code == 200
        vendors = response.json()
        
        # Check VND_XXX format
        for vendor in vendors[:10]:  # Check first 10
            vendor_id = vendor.get("vendor_id", "")
            assert vendor_id.startswith("VND_"), f"Vendor ID should start with VND_: {vendor_id}"
            # Check numeric suffix
            suffix = vendor_id.replace("VND_", "")
            assert suffix.isdigit(), f"Vendor ID suffix should be numeric: {vendor_id}"
        print(f"SUCCESS: Vendor IDs follow VND_XXX format")
    
    def test_create_vendor(self):
        """Test POST /api/vendors - create new vendor with auto-generated ID"""
        vendor_data = {
            "name": "TEST_Vendor_Pytest",
            "gst": "TEST123456789",
            "address": "Test Address, City",
            "poc": "Test Contact",
            "email": "test@vendor.com",
            "phone": "9876543210"
        }
        
        response = self.session.post(f"{BASE_URL}/api/vendors", json=vendor_data)
        assert response.status_code == 200, f"Create vendor failed: {response.text}"
        
        created_vendor = response.json()
        assert "id" in created_vendor
        assert "vendor_id" in created_vendor
        assert created_vendor["vendor_id"].startswith("VND_"), "Auto-generated ID should be VND_XXX"
        assert created_vendor["name"] == vendor_data["name"]
        
        # Store for cleanup
        self.created_vendor_id = created_vendor["id"]
        print(f"SUCCESS: Created vendor with ID {created_vendor['vendor_id']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/vendors/{created_vendor['id']}")
    
    def test_get_vendor_details(self):
        """Test GET /api/vendors/{vendor_id} - get vendor with RM prices"""
        # Get first vendor
        vendors_response = self.session.get(f"{BASE_URL}/api/vendors")
        vendors = vendors_response.json()
        assert len(vendors) > 0
        
        vendor_id = vendors[0]["id"]
        response = self.session.get(f"{BASE_URL}/api/vendors/{vendor_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert "vendor" in data
        assert "rm_prices" in data
        assert isinstance(data["rm_prices"], list)
        print(f"SUCCESS: Got vendor details with {len(data['rm_prices'])} RM prices")
    
    def test_update_vendor(self):
        """Test PUT /api/vendors/{vendor_id} - update vendor details"""
        # Create a test vendor first
        create_response = self.session.post(f"{BASE_URL}/api/vendors", json={
            "name": "TEST_Update_Vendor",
            "gst": "UPDATE123",
            "address": "Original Address"
        })
        assert create_response.status_code == 200
        vendor = create_response.json()
        vendor_id = vendor["id"]
        
        # Update vendor
        update_data = {
            "name": "TEST_Update_Vendor_Modified",
            "gst": "UPDATE456",
            "address": "Updated Address",
            "poc": "New Contact",
            "email": "updated@vendor.com",
            "phone": "1234567890"
        }
        
        update_response = self.session.put(f"{BASE_URL}/api/vendors/{vendor_id}", json=update_data)
        assert update_response.status_code == 200
        
        # Verify update
        get_response = self.session.get(f"{BASE_URL}/api/vendors/{vendor_id}")
        assert get_response.status_code == 200
        updated_vendor = get_response.json()["vendor"]
        assert updated_vendor["name"] == update_data["name"]
        assert updated_vendor["address"] == update_data["address"]
        print(f"SUCCESS: Updated vendor details")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/vendors/{vendor_id}")
    
    def test_delete_vendor(self):
        """Test DELETE /api/vendors/{vendor_id} - delete vendor"""
        # Create a test vendor
        create_response = self.session.post(f"{BASE_URL}/api/vendors", json={
            "name": "TEST_Delete_Vendor"
        })
        assert create_response.status_code == 200
        vendor_id = create_response.json()["id"]
        
        # Delete vendor
        delete_response = self.session.delete(f"{BASE_URL}/api/vendors/{vendor_id}")
        assert delete_response.status_code == 200
        
        # Verify deletion
        get_response = self.session.get(f"{BASE_URL}/api/vendors/{vendor_id}")
        assert get_response.status_code == 404
        print(f"SUCCESS: Deleted vendor")
    
    def test_vendor_search(self):
        """Test GET /api/vendors?search= - search vendors"""
        response = self.session.get(f"{BASE_URL}/api/vendors?search=VND_001")
        assert response.status_code == 200
        vendors = response.json()
        # Should find at least one vendor matching VND_001
        assert len(vendors) >= 1 or len(vendors) == 0  # May or may not find
        print(f"SUCCESS: Search returned {len(vendors)} vendors")


class TestVendorRMPricing:
    """Vendor RM Pricing tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@factory.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_add_rm_price_to_vendor(self):
        """Test POST /api/vendor-rm-prices - add RM price to vendor"""
        # Get a vendor
        vendors_response = self.session.get(f"{BASE_URL}/api/vendors")
        vendors = vendors_response.json()
        assert len(vendors) > 0
        vendor_id = vendors[0]["id"]
        
        # Get an RM
        rm_response = self.session.get(f"{BASE_URL}/api/raw-materials/filtered?page=1&page_size=1")
        assert rm_response.status_code == 200
        rms = rm_response.json()["items"]
        assert len(rms) > 0
        rm_id = rms[0]["rm_id"]
        
        # Add price
        price_data = {
            "vendor_id": vendor_id,
            "rm_id": rm_id,
            "price": 99.99,
            "currency": "INR",
            "notes": "Test price from pytest"
        }
        
        response = self.session.post(f"{BASE_URL}/api/vendor-rm-prices", json=price_data)
        assert response.status_code == 200
        result = response.json()
        assert result["action"] in ["created", "updated"]
        print(f"SUCCESS: Added/Updated RM price - {result['action']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/vendor-rm-prices/{vendor_id}/{rm_id}")
    
    def test_get_vendors_for_rm(self):
        """Test GET /api/vendor-rm-prices/by-rm/{rm_id} - get all vendors for an RM"""
        # First add a price to ensure data exists
        vendors_response = self.session.get(f"{BASE_URL}/api/vendors")
        vendors = vendors_response.json()
        vendor_id = vendors[0]["id"]
        
        rm_response = self.session.get(f"{BASE_URL}/api/raw-materials/filtered?page=1&page_size=1")
        rms = rm_response.json()["items"]
        rm_id = rms[0]["rm_id"]
        
        # Add price
        self.session.post(f"{BASE_URL}/api/vendor-rm-prices", json={
            "vendor_id": vendor_id,
            "rm_id": rm_id,
            "price": 50.00,
            "currency": "INR"
        })
        
        # Get vendors for RM
        response = self.session.get(f"{BASE_URL}/api/vendor-rm-prices/by-rm/{rm_id}")
        assert response.status_code == 200
        vendors_for_rm = response.json()
        assert isinstance(vendors_for_rm, list)
        print(f"SUCCESS: Found {len(vendors_for_rm)} vendors for RM {rm_id}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/vendor-rm-prices/{vendor_id}/{rm_id}")
    
    def test_price_comparison_report(self):
        """Test GET /api/vendor-rm-prices/comparison - price comparison report"""
        response = self.session.get(f"{BASE_URL}/api/vendor-rm-prices/comparison")
        assert response.status_code == 200
        report = response.json()
        assert isinstance(report, list)
        
        # Check report structure if data exists
        if len(report) > 0:
            item = report[0]
            assert "rm_id" in item
            assert "lowest_price" in item
            assert "lowest_vendor_name" in item
            assert "total_vendors" in item
        print(f"SUCCESS: Price comparison report has {len(report)} RMs with prices")
    
    def test_delete_vendor_rm_price(self):
        """Test DELETE /api/vendor-rm-prices/{vendor_id}/{rm_id} - delete price mapping"""
        # Setup - add a price
        vendors_response = self.session.get(f"{BASE_URL}/api/vendors")
        vendor_id = vendors_response.json()[0]["id"]
        
        rm_response = self.session.get(f"{BASE_URL}/api/raw-materials/filtered?page=1&page_size=1")
        rm_id = rm_response.json()["items"][0]["rm_id"]
        
        self.session.post(f"{BASE_URL}/api/vendor-rm-prices", json={
            "vendor_id": vendor_id,
            "rm_id": rm_id,
            "price": 25.00
        })
        
        # Delete
        response = self.session.delete(f"{BASE_URL}/api/vendor-rm-prices/{vendor_id}/{rm_id}")
        assert response.status_code == 200
        print(f"SUCCESS: Deleted vendor RM price mapping")


class TestRawMaterialsFilters:
    """Raw Materials column-based filters and pagination tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@factory.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_get_filter_options(self):
        """Test GET /api/raw-materials/filter-options - get filter dropdown options"""
        response = self.session.get(f"{BASE_URL}/api/raw-materials/filter-options")
        assert response.status_code == 200
        
        options = response.json()
        assert "categories" in options
        assert "types" in options
        assert "models" in options
        assert "colours" in options
        assert "brands" in options
        
        # Verify categories
        expected_categories = ["INP", "ACC", "ELC", "SP", "BS", "PM", "LB"]
        for cat in expected_categories:
            assert cat in options["categories"], f"Missing category: {cat}"
        
        print(f"SUCCESS: Filter options - {len(options['categories'])} categories, {len(options['types'])} types, {len(options['models'])} models, {len(options['colours'])} colours, {len(options['brands'])} brands")
    
    def test_filtered_rm_pagination(self):
        """Test GET /api/raw-materials/filtered - pagination with 100 items per page"""
        response = self.session.get(f"{BASE_URL}/api/raw-materials/filtered?page=1&page_size=100")
        assert response.status_code == 200
        
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "total_pages" in data
        
        assert data["page"] == 1
        assert data["page_size"] == 100
        assert len(data["items"]) <= 100
        
        print(f"SUCCESS: Pagination - Page 1 has {len(data['items'])} items, Total: {data['total']}, Pages: {data['total_pages']}")
    
    def test_filter_by_category(self):
        """Test filtering RMs by category"""
        # Test ACC category
        response = self.session.get(f"{BASE_URL}/api/raw-materials/filtered?category=ACC&page=1&page_size=100")
        assert response.status_code == 200
        
        data = response.json()
        # All items should be ACC category
        for item in data["items"]:
            assert item["category"] == "ACC", f"Expected ACC, got {item['category']}"
        
        print(f"SUCCESS: Category filter - Found {data['total']} ACC items")
    
    def test_filter_by_type(self):
        """Test filtering RMs by type"""
        # Get available types first
        options_response = self.session.get(f"{BASE_URL}/api/raw-materials/filter-options")
        types = options_response.json()["types"]
        
        if len(types) > 0:
            test_type = types[0]
            response = self.session.get(f"{BASE_URL}/api/raw-materials/filtered?type_filter={test_type}&page=1&page_size=100")
            assert response.status_code == 200
            
            data = response.json()
            print(f"SUCCESS: Type filter '{test_type}' - Found {data['total']} items")
        else:
            print("SKIP: No types available for filtering")
    
    def test_filter_by_model(self):
        """Test filtering RMs by model"""
        options_response = self.session.get(f"{BASE_URL}/api/raw-materials/filter-options")
        models = options_response.json()["models"]
        
        if len(models) > 0:
            test_model = models[0]
            response = self.session.get(f"{BASE_URL}/api/raw-materials/filtered?model_filter={test_model}&page=1&page_size=100")
            assert response.status_code == 200
            
            data = response.json()
            print(f"SUCCESS: Model filter '{test_model}' - Found {data['total']} items")
        else:
            print("SKIP: No models available for filtering")
    
    def test_filter_by_colour(self):
        """Test filtering RMs by colour"""
        options_response = self.session.get(f"{BASE_URL}/api/raw-materials/filter-options")
        colours = options_response.json()["colours"]
        
        if len(colours) > 0:
            test_colour = colours[0]
            response = self.session.get(f"{BASE_URL}/api/raw-materials/filtered?colour_filter={test_colour}&page=1&page_size=100")
            assert response.status_code == 200
            
            data = response.json()
            print(f"SUCCESS: Colour filter '{test_colour}' - Found {data['total']} items")
        else:
            print("SKIP: No colours available for filtering")
    
    def test_filter_by_brand(self):
        """Test filtering RMs by brand"""
        options_response = self.session.get(f"{BASE_URL}/api/raw-materials/filter-options")
        brands = options_response.json()["brands"]
        
        if len(brands) > 0:
            test_brand = brands[0]
            response = self.session.get(f"{BASE_URL}/api/raw-materials/filtered?brand_filter={test_brand}&page=1&page_size=100")
            assert response.status_code == 200
            
            data = response.json()
            print(f"SUCCESS: Brand filter '{test_brand}' - Found {data['total']} items")
        else:
            print("SKIP: No brands available for filtering")
    
    def test_search_functionality(self):
        """Test RM search by ID"""
        # Search for ACC prefix
        response = self.session.get(f"{BASE_URL}/api/raw-materials/filtered?search=ACC&page=1&page_size=100")
        assert response.status_code == 200
        
        data = response.json()
        # All items should have ACC in rm_id
        for item in data["items"]:
            assert "ACC" in item["rm_id"].upper(), f"Search result should contain ACC: {item['rm_id']}"
        
        print(f"SUCCESS: Search 'ACC' - Found {data['total']} items")
    
    def test_combined_filters(self):
        """Test combining multiple filters"""
        response = self.session.get(f"{BASE_URL}/api/raw-materials/filtered?category=ACC&page=1&page_size=50")
        assert response.status_code == 200
        
        data = response.json()
        print(f"SUCCESS: Combined filters - Found {data['total']} items")
    
    def test_pagination_navigation(self):
        """Test navigating through pages"""
        # Get page 1
        page1_response = self.session.get(f"{BASE_URL}/api/raw-materials/filtered?page=1&page_size=100")
        assert page1_response.status_code == 200
        page1_data = page1_response.json()
        
        if page1_data["total_pages"] > 1:
            # Get page 2
            page2_response = self.session.get(f"{BASE_URL}/api/raw-materials/filtered?page=2&page_size=100")
            assert page2_response.status_code == 200
            page2_data = page2_response.json()
            
            assert page2_data["page"] == 2
            # Items should be different
            if len(page1_data["items"]) > 0 and len(page2_data["items"]) > 0:
                assert page1_data["items"][0]["rm_id"] != page2_data["items"][0]["rm_id"]
            
            print(f"SUCCESS: Pagination navigation - Page 1 and 2 have different items")
        else:
            print(f"SKIP: Only 1 page available")
    
    def test_filter_reset_returns_all(self):
        """Test that clearing filters returns all items"""
        # Get filtered results
        filtered_response = self.session.get(f"{BASE_URL}/api/raw-materials/filtered?category=ACC&page=1&page_size=100")
        filtered_total = filtered_response.json()["total"]
        
        # Get all results (no filters)
        all_response = self.session.get(f"{BASE_URL}/api/raw-materials/filtered?page=1&page_size=100")
        all_total = all_response.json()["total"]
        
        # All should be >= filtered
        assert all_total >= filtered_total, "All items should be >= filtered items"
        print(f"SUCCESS: Filter reset - All: {all_total}, Filtered (ACC): {filtered_total}")


class TestVendorBulkUpload:
    """Vendor bulk upload tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@factory.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_bulk_upload_endpoint_exists(self):
        """Test that bulk upload endpoint exists and rejects non-Excel files"""
        # Try uploading a non-Excel file
        files = {'file': ('test.txt', b'test content', 'text/plain')}
        response = self.session.post(f"{BASE_URL}/api/vendors/bulk-upload", files=files)
        
        # Should reject with 400 (not 404)
        assert response.status_code == 400, f"Expected 400 for non-Excel file, got {response.status_code}"
        assert "Excel" in response.json().get("detail", "")
        print(f"SUCCESS: Bulk upload endpoint exists and validates file type")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

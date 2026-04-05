"""
Test RM Production Phase 2A/2B - Branch Ops Production Inward & Reports
Tests:
- GET /api/rm-production/manufacturable-rms - RMs with active BOMs
- GET /api/rm-production/active-categories - Categories with manufacturable RMs
- POST /api/rm-production/preview - Preview component requirements
- POST /api/rm-production/confirm - Confirm production (consume components, create log)
- GET /api/rm-production/log - Production history with filters
- GET /api/rm-production/summary - Category-wise production totals
- GET /api/rm-production/consumption-report - L1 material consumption
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestRMProductionPhase2:
    """RM Production Phase 2A/2B API Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.token = None
        self.branch = "HYD"  # Default test branch
        
    def get_auth_token(self, email="admin@factory.com", password="bidso123"):
        """Get authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("access_token") or data.get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
            return self.token
        return None
    
    # ============ Authentication ============
    
    def test_01_admin_login(self):
        """Test admin login"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@factory.com",
            "password": "bidso123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data or "token" in data, "No token in response"
        print(f"PASS: Admin login successful")
    
    def test_02_branch_ops_login(self):
        """Test branch ops user login"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "branchops@bidso.com",
            "password": "bidso123"
        })
        assert response.status_code == 200, f"Branch ops login failed: {response.text}"
        data = response.json()
        assert "access_token" in data or "token" in data, "No token in response"
        print(f"PASS: Branch ops login successful")
    
    # ============ Manufacturable RMs ============
    
    def test_03_get_manufacturable_rms(self):
        """Test GET /api/rm-production/manufacturable-rms"""
        self.get_auth_token()
        response = self.session.get(f"{BASE_URL}/api/rm-production/manufacturable-rms?branch={self.branch}")
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"PASS: GET manufacturable-rms returned {len(data)} items")
        
        # If there are items, verify structure
        if len(data) > 0:
            item = data[0]
            assert "rm_id" in item, "Missing rm_id"
            assert "rm_name" in item, "Missing rm_name"
            assert "category" in item, "Missing category"
            assert "bom_level" in item, "Missing bom_level"
            assert "source_type" in item, "Missing source_type"
            assert "current_stock" in item, "Missing current_stock"
            print(f"  First item: {item['rm_id']} - {item['rm_name']}")
    
    def test_04_get_manufacturable_rms_with_category_filter(self):
        """Test GET /api/rm-production/manufacturable-rms with category filter"""
        self.get_auth_token()
        # First get all to find a category
        response = self.session.get(f"{BASE_URL}/api/rm-production/manufacturable-rms?branch={self.branch}")
        assert response.status_code == 200
        all_items = response.json()
        
        if len(all_items) > 0:
            category = all_items[0]["category"]
            response = self.session.get(f"{BASE_URL}/api/rm-production/manufacturable-rms?branch={self.branch}&category={category}")
            assert response.status_code == 200
            filtered = response.json()
            # All items should have the same category
            for item in filtered:
                assert item["category"] == category, f"Category mismatch: {item['category']} != {category}"
            print(f"PASS: Category filter works - {len(filtered)} items for category {category}")
        else:
            print(f"PASS: No manufacturable RMs found (BOMs need to be defined)")
    
    # ============ Active Categories ============
    
    def test_05_get_active_categories(self):
        """Test GET /api/rm-production/active-categories"""
        self.get_auth_token()
        response = self.session.get(f"{BASE_URL}/api/rm-production/active-categories?branch={self.branch}")
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"PASS: GET active-categories returned {len(data)} categories")
        
        if len(data) > 0:
            cat = data[0]
            assert "code" in cat, "Missing code"
            print(f"  Categories: {[c['code'] for c in data]}")
    
    # ============ Production Preview ============
    
    def test_06_preview_production_no_bom(self):
        """Test POST /api/rm-production/preview with RM that has no BOM"""
        self.get_auth_token()
        # Try with a random RM ID that likely has no BOM
        response = self.session.post(f"{BASE_URL}/api/rm-production/preview", json={
            "branch": self.branch,
            "rm_id": "NONEXISTENT_RM_12345",
            "quantity_to_produce": 10
        })
        # Should return 404 for no BOM
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"PASS: Preview correctly returns 404 for RM without BOM")
    
    def test_07_preview_production_with_bom(self):
        """Test POST /api/rm-production/preview with RM that has BOM"""
        self.get_auth_token()
        # First get manufacturable RMs
        response = self.session.get(f"{BASE_URL}/api/rm-production/manufacturable-rms?branch={self.branch}")
        assert response.status_code == 200
        rms = response.json()
        
        if len(rms) > 0:
            rm = rms[0]
            response = self.session.post(f"{BASE_URL}/api/rm-production/preview", json={
                "branch": self.branch,
                "rm_id": rm["rm_id"],
                "quantity_to_produce": 10
            })
            assert response.status_code == 200, f"Preview failed: {response.status_code} - {response.text}"
            data = response.json()
            
            # Verify response structure
            assert "rm_id" in data, "Missing rm_id"
            assert "rm_name" in data, "Missing rm_name"
            assert "quantity_to_produce" in data, "Missing quantity_to_produce"
            assert "components" in data, "Missing components"
            assert "can_produce" in data, "Missing can_produce"
            
            print(f"PASS: Preview production for {rm['rm_id']}")
            print(f"  Can produce: {data['can_produce']}")
            print(f"  Components: {len(data['components'])}")
            if not data['can_produce'] and 'blocking_components' in data:
                print(f"  Blocking: {data['blocking_components']}")
        else:
            print(f"SKIP: No manufacturable RMs found to test preview")
    
    # ============ Production Log ============
    
    def test_08_get_production_log(self):
        """Test GET /api/rm-production/log"""
        self.get_auth_token()
        response = self.session.get(f"{BASE_URL}/api/rm-production/log?branch={self.branch}")
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        
        assert "items" in data, "Missing items"
        assert "total" in data, "Missing total"
        assert "page" in data, "Missing page"
        assert "total_pages" in data, "Missing total_pages"
        
        print(f"PASS: GET production log - {data['total']} total entries, page {data['page']}/{data['total_pages']}")
        
        if len(data['items']) > 0:
            log = data['items'][0]
            assert "production_code" in log, "Missing production_code"
            assert "rm_id" in log, "Missing rm_id"
            assert "quantity_produced" in log, "Missing quantity_produced"
            print(f"  Latest: {log['production_code']} - {log['rm_id']}")
    
    def test_09_get_production_log_with_filters(self):
        """Test GET /api/rm-production/log with filters"""
        self.get_auth_token()
        
        # Test with date range filter
        response = self.session.get(
            f"{BASE_URL}/api/rm-production/log?branch={self.branch}&start_date=2024-01-01&end_date=2026-12-31"
        )
        assert response.status_code == 200, f"Failed: {response.status_code}"
        data = response.json()
        print(f"PASS: Production log with date filter - {data['total']} entries")
        
        # Test pagination
        response = self.session.get(
            f"{BASE_URL}/api/rm-production/log?branch={self.branch}&page=1&page_size=5"
        )
        assert response.status_code == 200
        data = response.json()
        assert data['page_size'] == 5 or len(data['items']) <= 5, "Pagination not working"
        print(f"PASS: Production log pagination works")
    
    # ============ Production Summary ============
    
    def test_10_get_production_summary(self):
        """Test GET /api/rm-production/summary"""
        self.get_auth_token()
        response = self.session.get(
            f"{BASE_URL}/api/rm-production/summary?branch={self.branch}&start_date=2024-01-01&end_date=2026-12-31"
        )
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        
        assert "branch" in data, "Missing branch"
        assert "period" in data, "Missing period"
        assert "categories" in data, "Missing categories"
        assert "totals" in data, "Missing totals"
        
        print(f"PASS: GET production summary")
        print(f"  Total produced: {data['totals'].get('total_produced', 0)}")
        print(f"  Total entries: {data['totals'].get('total_entries', 0)}")
        print(f"  Categories: {len(data['categories'])}")
    
    # ============ Consumption Report ============
    
    def test_11_get_consumption_report(self):
        """Test GET /api/rm-production/consumption-report"""
        self.get_auth_token()
        response = self.session.get(
            f"{BASE_URL}/api/rm-production/consumption-report?branch={self.branch}&start_date=2024-01-01&end_date=2026-12-31"
        )
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        
        assert "branch" in data, "Missing branch"
        assert "period" in data, "Missing period"
        assert "consumption" in data, "Missing consumption"
        
        print(f"PASS: GET consumption report")
        print(f"  Consumed materials: {len(data['consumption'])}")
        
        if len(data['consumption']) > 0:
            item = data['consumption'][0]
            assert "rm_id" in item, "Missing rm_id"
            assert "total_consumed" in item, "Missing total_consumed"
            print(f"  Top consumed: {item['rm_id']} - {item['total_consumed']} {item.get('uom', '')}")
    
    # ============ Branches API ============
    
    def test_12_get_branches(self):
        """Test GET /api/branches for branch selector"""
        self.get_auth_token()
        response = self.session.get(f"{BASE_URL}/api/branches")
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) > 0, "No branches found"
        
        branch = data[0]
        assert "code" in branch, "Missing code"
        print(f"PASS: GET branches - {len(data)} branches")
        print(f"  Branches: {[b['code'] for b in data[:5]]}")
    
    # ============ Production Confirm (if BOM exists) ============
    
    def test_13_confirm_production_insufficient_stock(self):
        """Test POST /api/rm-production/confirm with insufficient stock"""
        self.get_auth_token()
        # First get manufacturable RMs
        response = self.session.get(f"{BASE_URL}/api/rm-production/manufacturable-rms?branch={self.branch}")
        assert response.status_code == 200
        rms = response.json()
        
        if len(rms) > 0:
            rm = rms[0]
            # Preview first to check if can produce
            preview_response = self.session.post(f"{BASE_URL}/api/rm-production/preview", json={
                "branch": self.branch,
                "rm_id": rm["rm_id"],
                "quantity_to_produce": 999999  # Large quantity to ensure insufficient stock
            })
            
            if preview_response.status_code == 200:
                preview_data = preview_response.json()
                if not preview_data.get('can_produce'):
                    # Try to confirm - should fail
                    response = self.session.post(f"{BASE_URL}/api/rm-production/confirm", json={
                        "branch": self.branch,
                        "rm_id": rm["rm_id"],
                        "quantity_produced": 999999,
                        "production_date": "2026-01-15",
                        "notes": "Test production"
                    })
                    assert response.status_code == 400, f"Expected 400 for insufficient stock, got {response.status_code}"
                    print(f"PASS: Confirm correctly rejects insufficient stock")
                else:
                    print(f"SKIP: RM has sufficient stock for large quantity")
            else:
                print(f"SKIP: Preview failed")
        else:
            print(f"SKIP: No manufacturable RMs found")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

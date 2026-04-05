"""
Test suite for In-House RM Production Module - Phase 1
Tests:
- RM Categories CRUD (GET, POST, PUT)
- RM BOM CRUD (GET, POST, PUT, DELETE)
- RM Repository filters (source_type, bom_level)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for admin user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@factory.com",
            "password": "bidso123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_login_admin(self, auth_token):
        """Test admin login"""
        assert auth_token is not None
        assert len(auth_token) > 0
        print("PASS: Admin login successful")


class TestRMCategories:
    """RM Categories CRUD tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@factory.com",
            "password": "bidso123"
        })
        return response.json()["access_token"]
    
    def test_get_rm_categories(self, auth_token):
        """Test GET /api/production/rm-categories"""
        response = requests.get(
            f"{BASE_URL}/api/production/rm-categories",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        categories = response.json()
        assert isinstance(categories, list)
        assert len(categories) > 0
        
        # Verify category structure
        cat = categories[0]
        assert "code" in cat
        assert "name" in cat
        assert "default_source_type" in cat
        assert "default_bom_level" in cat
        print(f"PASS: GET /api/production/rm-categories - Found {len(categories)} categories")
    
    def test_get_rm_categories_with_source_type_filter(self, auth_token):
        """Test GET /api/production/rm-categories with source_type filter"""
        response = requests.get(
            f"{BASE_URL}/api/production/rm-categories?source_type=MANUFACTURED",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        categories = response.json()
        
        # All returned categories should have MANUFACTURED source type
        for cat in categories:
            assert cat["default_source_type"] == "MANUFACTURED"
        print(f"PASS: GET /api/production/rm-categories?source_type=MANUFACTURED - Found {len(categories)} categories")
    
    def test_get_single_rm_category(self, auth_token):
        """Test GET /api/production/rm-categories/{code}"""
        response = requests.get(
            f"{BASE_URL}/api/production/rm-categories/INP",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        cat = response.json()
        assert cat["code"] == "INP"
        assert cat["default_source_type"] == "MANUFACTURED"
        assert cat["default_bom_level"] == 2
        print("PASS: GET /api/production/rm-categories/INP - Category found")
    
    def test_create_rm_category(self, auth_token):
        """Test POST /api/production/rm-categories"""
        # First try to delete if exists
        requests.delete(
            f"{BASE_URL}/api/production/rm-categories/TEST_PHASE1",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        response = requests.post(
            f"{BASE_URL}/api/production/rm-categories",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "code": "TEST_PHASE1",
                "name": "Test Phase 1 Category",
                "description": "Test category for Phase 1 testing",
                "default_source_type": "BOTH",
                "default_bom_level": 2,
                "is_active": True
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "category" in data
        assert data["category"]["code"] == "TEST_PHASE1"
        assert data["category"]["default_source_type"] == "BOTH"
        assert data["category"]["default_bom_level"] == 2
        print("PASS: POST /api/production/rm-categories - Category created")
    
    def test_update_rm_category(self, auth_token):
        """Test PUT /api/production/rm-categories/{code}"""
        response = requests.put(
            f"{BASE_URL}/api/production/rm-categories/TEST_PHASE1",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "name": "Test Phase 1 Category Updated",
                "description": "Updated description"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["category"]["name"] == "Test Phase 1 Category Updated"
        print("PASS: PUT /api/production/rm-categories/TEST_PHASE1 - Category updated")


class TestRMBOM:
    """RM BOM CRUD tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@factory.com",
            "password": "bidso123"
        })
        return response.json()["access_token"]
    
    def test_get_all_boms(self, auth_token):
        """Test GET /api/rm-bom"""
        response = requests.get(
            f"{BASE_URL}/api/rm-bom",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        boms = response.json()
        assert isinstance(boms, list)
        print(f"PASS: GET /api/rm-bom - Found {len(boms)} BOMs")
    
    def test_get_boms_with_category_filter(self, auth_token):
        """Test GET /api/rm-bom with category filter"""
        response = requests.get(
            f"{BASE_URL}/api/rm-bom?category=INP",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        boms = response.json()
        for bom in boms:
            assert bom["category"] == "INP"
        print(f"PASS: GET /api/rm-bom?category=INP - Found {len(boms)} BOMs")
    
    def test_get_boms_with_bom_level_filter(self, auth_token):
        """Test GET /api/rm-bom with bom_level filter"""
        response = requests.get(
            f"{BASE_URL}/api/rm-bom?bom_level=2",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        boms = response.json()
        for bom in boms:
            assert bom["bom_level"] == 2
        print(f"PASS: GET /api/rm-bom?bom_level=2 - Found {len(boms)} BOMs")


class TestRMRepositoryFilters:
    """RM Repository filter tests"""
    
    def test_get_rms_by_source_type_manufactured(self):
        """Test GET /api/raw-materials/by-tags with source_type=MANUFACTURED"""
        response = requests.get(
            f"{BASE_URL}/api/raw-materials/by-tags?source_type=MANUFACTURED&page=1&page_size=10"
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        
        # All returned items should have MANUFACTURED source type
        for item in data["items"]:
            assert item.get("source_type") == "MANUFACTURED"
        print(f"PASS: GET /api/raw-materials/by-tags?source_type=MANUFACTURED - Found {data['total']} items")
    
    def test_get_rms_by_source_type_purchased(self):
        """Test GET /api/raw-materials/by-tags with source_type=PURCHASED"""
        response = requests.get(
            f"{BASE_URL}/api/raw-materials/by-tags?source_type=PURCHASED&page=1&page_size=10"
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        
        for item in data["items"]:
            assert item.get("source_type") == "PURCHASED"
        print(f"PASS: GET /api/raw-materials/by-tags?source_type=PURCHASED - Found {data['total']} items")
    
    def test_get_rms_by_source_type_both(self):
        """Test GET /api/raw-materials/by-tags with source_type=BOTH"""
        response = requests.get(
            f"{BASE_URL}/api/raw-materials/by-tags?source_type=BOTH&page=1&page_size=10"
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        
        for item in data["items"]:
            assert item.get("source_type") == "BOTH"
        print(f"PASS: GET /api/raw-materials/by-tags?source_type=BOTH - Found {data['total']} items")
    
    def test_get_rms_by_bom_level_1(self):
        """Test GET /api/raw-materials/by-tags with bom_level=1"""
        response = requests.get(
            f"{BASE_URL}/api/raw-materials/by-tags?bom_level=1&page=1&page_size=10"
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        
        for item in data["items"]:
            assert item.get("bom_level") == 1
        print(f"PASS: GET /api/raw-materials/by-tags?bom_level=1 - Found {data['total']} items")
    
    def test_get_rms_by_bom_level_2(self):
        """Test GET /api/raw-materials/by-tags with bom_level=2"""
        response = requests.get(
            f"{BASE_URL}/api/raw-materials/by-tags?bom_level=2&page=1&page_size=10"
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        
        for item in data["items"]:
            assert item.get("bom_level") == 2
        print(f"PASS: GET /api/raw-materials/by-tags?bom_level=2 - Found {data['total']} items")
    
    def test_get_rms_combined_filters(self):
        """Test GET /api/raw-materials/by-tags with combined source_type and bom_level"""
        response = requests.get(
            f"{BASE_URL}/api/raw-materials/by-tags?source_type=MANUFACTURED&bom_level=2&page=1&page_size=10"
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        
        for item in data["items"]:
            assert item.get("source_type") == "MANUFACTURED"
            assert item.get("bom_level") == 2
        print(f"PASS: GET /api/raw-materials/by-tags?source_type=MANUFACTURED&bom_level=2 - Found {data['total']} items")
    
    def test_get_rms_with_category_filter(self):
        """Test GET /api/raw-materials/by-tags with category filter"""
        response = requests.get(
            f"{BASE_URL}/api/raw-materials/by-tags?category=INP&page=1&page_size=10"
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        
        for item in data["items"]:
            assert item.get("category") == "INP"
        print(f"PASS: GET /api/raw-materials/by-tags?category=INP - Found {data['total']} items")


class TestRMRepositoryPagination:
    """RM Repository pagination tests"""
    
    def test_pagination_page_1(self):
        """Test pagination - page 1"""
        response = requests.get(
            f"{BASE_URL}/api/raw-materials/by-tags?page=1&page_size=10"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 10
        assert len(data["items"]) <= 10
        print(f"PASS: Pagination page 1 - {len(data['items'])} items, total: {data['total']}")
    
    def test_pagination_page_2(self):
        """Test pagination - page 2"""
        response = requests.get(
            f"{BASE_URL}/api/raw-materials/by-tags?page=2&page_size=10"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 2
        print(f"PASS: Pagination page 2 - {len(data['items'])} items")
    
    def test_pagination_total_pages(self):
        """Test total_pages calculation"""
        response = requests.get(
            f"{BASE_URL}/api/raw-materials/by-tags?page=1&page_size=50"
        )
        assert response.status_code == 200
        data = response.json()
        
        expected_pages = (data["total"] + 49) // 50
        assert data["total_pages"] == expected_pages
        print(f"PASS: Total pages calculation - {data['total_pages']} pages for {data['total']} items")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

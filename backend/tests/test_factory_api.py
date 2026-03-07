"""
Factory Management API Tests
Tests for: Authentication, User Management, Raw Materials, Purchase Entries, Dashboard
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@factory.com"
ADMIN_PASSWORD = "admin123"

class TestAuthentication:
    """Authentication endpoint tests"""
    
    def test_login_success(self):
        """Test successful login with admin credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "Missing access_token in response"
        assert "user" in data, "Missing user in response"
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "master_admin"
        assert data["token_type"] == "bearer"
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401
        
    def test_login_invalid_password(self):
        """Test login with correct email but wrong password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": "wrongpassword"
        })
        assert response.status_code == 401


class TestAuthenticatedEndpoints:
    """Tests requiring authentication"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_get_current_user(self):
        """Test /api/auth/me endpoint"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "master_admin"
    
    def test_get_branches(self):
        """Test /api/branches endpoint"""
        response = requests.get(f"{BASE_URL}/api/branches", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "branches" in data
        assert len(data["branches"]) > 0
        assert "Unit 1 Vedica" in data["branches"]
    
    def test_get_rm_categories(self):
        """Test /api/rm-categories endpoint"""
        response = requests.get(f"{BASE_URL}/api/rm-categories", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "categories" in data
        assert "ACC" in data["categories"]
        assert "ELC" in data["categories"]


class TestUserManagement:
    """User management tests (master_admin only)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_list_users(self):
        """Test listing all users"""
        response = requests.get(f"{BASE_URL}/api/users", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        # Should have at least the admin user
        assert len(data) >= 1
        admin_user = next((u for u in data if u["email"] == ADMIN_EMAIL), None)
        assert admin_user is not None
        assert admin_user["role"] == "master_admin"


class TestRawMaterials:
    """Raw materials endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_get_all_raw_materials(self):
        """Test getting all raw materials"""
        response = requests.get(f"{BASE_URL}/api/raw-materials", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        # Should have imported RMs (2402 total mentioned)
        print(f"Total RMs found: {len(data)}")
    
    def test_search_raw_materials_acc_273(self):
        """Test searching for ACC_273"""
        response = requests.get(f"{BASE_URL}/api/raw-materials?search=ACC_273", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        # Should find ACC_273
        matching = [rm for rm in data if "ACC_273" in rm.get("rm_id", "")]
        print(f"Found {len(matching)} RMs matching ACC_273")
        assert len(matching) >= 1, "ACC_273 not found in raw materials"
    
    def test_get_raw_materials_by_branch(self):
        """Test getting raw materials for a specific branch"""
        response = requests.get(
            f"{BASE_URL}/api/raw-materials?branch=Unit%201%20Vedica",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"RMs active in Unit 1 Vedica: {len(data)}")


class TestPurchaseEntries:
    """Purchase/Inward entry tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_get_purchase_entries(self):
        """Test getting purchase entries"""
        response = requests.get(
            f"{BASE_URL}/api/purchase-entries?branch=Unit%201%20Vedica",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Purchase entries for Unit 1 Vedica: {len(data)}")
    
    def test_create_purchase_entry_acc_274(self):
        """Test creating a purchase entry for ACC_274 with quantity 50"""
        # First check if ACC_274 exists
        rm_response = requests.get(f"{BASE_URL}/api/raw-materials?search=ACC_274", headers=self.headers)
        assert rm_response.status_code == 200
        
        rm_data = rm_response.json()
        acc_274 = next((rm for rm in rm_data if rm.get("rm_id") == "ACC_274"), None)
        
        if not acc_274:
            pytest.skip("ACC_274 not found in raw materials")
        
        # Create purchase entry
        entry_data = {
            "rm_id": "ACC_274",
            "branch": "Unit 1 Vedica",
            "quantity": 50,
            "date": datetime.now().isoformat(),
            "notes": "Test inward entry"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/purchase-entries",
            json=entry_data,
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to create purchase entry: {response.text}"
        
        data = response.json()
        assert data["rm_id"] == "ACC_274"
        assert data["quantity"] == 50
        assert data["branch"] == "Unit 1 Vedica"
        print(f"Successfully created purchase entry for ACC_274 with quantity 50")


class TestDashboard:
    """Dashboard stats tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_get_dashboard_stats(self):
        """Test getting dashboard stats for a branch"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/stats?branch=Unit%201%20Vedica",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "total_rm_value" in data
        assert "total_sku_value" in data
        assert "low_stock_items" in data
        assert "today_production" in data
        print(f"Dashboard stats: {data}")
    
    def test_dashboard_stats_requires_branch(self):
        """Test that dashboard stats requires branch parameter"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=self.headers)
        assert response.status_code == 400


class TestSKUs:
    """SKU endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_get_all_skus(self):
        """Test getting all SKUs"""
        response = requests.get(f"{BASE_URL}/api/skus", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Total SKUs found: {len(data)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

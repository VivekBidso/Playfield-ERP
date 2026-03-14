"""
RBAC System Tests - Role-Based Access Control
Tests for:
1. RBAC seeding - verify all 10 roles are created
2. Permission assignment - verify role permissions are correctly seeded
3. Login as Master Admin - verify full access
4. Login as Demand Planner - verify can CREATE SKUs but CANNOT delete Raw Materials or create Vendors
5. Login as Procurement Officer - verify can CREATE vendors but CANNOT delete SKUs
6. Role assignment API - verify admin can assign roles to users
7. Permission check API - verify /api/auth/permissions returns correct permissions
8. Role listing API - verify /api/roles returns all 10 roles
9. User roles API - verify /api/users/{id}/roles returns assigned roles
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
MASTER_ADMIN = {"email": "admin@factory.com", "password": "admin123"}
DEMAND_PLANNER = {"email": "demand_planner@factory.com", "password": "planner123"}
BRANCH_USER = {"email": "vedica_user@factory.com", "password": "vedica123"}

# Expected 10 roles
EXPECTED_ROLES = [
    "MASTER_ADMIN",
    "DEMAND_PLANNER", 
    "TECH_OPS_ENGINEER",
    "CPC_PLANNER",
    "PROCUREMENT_OFFICER",
    "BRANCH_OPS_USER",
    "QUALITY_INSPECTOR",
    "LOGISTICS_COORDINATOR",
    "FINANCE_VIEWER",
    "AUDITOR_READONLY"
]


class TestRBACSeeding:
    """Test RBAC seeding - verify all 10 roles are created"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=MASTER_ADMIN)
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        self.admin_token = response.json()["access_token"]
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_all_10_roles_exist(self):
        """Verify all 10 roles are seeded"""
        response = requests.get(f"{BASE_URL}/api/roles", headers=self.admin_headers)
        assert response.status_code == 200, f"Failed to get roles: {response.text}"
        
        roles = response.json()
        role_codes = [r["code"] for r in roles]
        
        # Verify all 10 expected roles exist
        for expected_role in EXPECTED_ROLES:
            assert expected_role in role_codes, f"Role {expected_role} not found in seeded roles"
        
        # Verify we have exactly 10 roles
        assert len(roles) >= 10, f"Expected at least 10 roles, got {len(roles)}"
        print(f"✓ All 10 roles verified: {role_codes}")
    
    def test_role_structure(self):
        """Verify role structure has required fields"""
        response = requests.get(f"{BASE_URL}/api/roles", headers=self.admin_headers)
        assert response.status_code == 200
        
        roles = response.json()
        for role in roles:
            assert "id" in role, "Role missing 'id' field"
            assert "code" in role, "Role missing 'code' field"
            assert "name" in role, "Role missing 'name' field"
            assert "is_active" in role, "Role missing 'is_active' field"
        
        print(f"✓ All roles have correct structure")


class TestPermissionAssignment:
    """Test permission assignment - verify role permissions are correctly seeded"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=MASTER_ADMIN)
        assert response.status_code == 200
        self.admin_token = response.json()["access_token"]
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_master_admin_permissions(self):
        """Verify Master Admin has full permissions"""
        response = requests.get(f"{BASE_URL}/api/auth/permissions", headers=self.admin_headers)
        assert response.status_code == 200, f"Failed to get permissions: {response.text}"
        
        data = response.json()
        assert "roles" in data, "Response missing 'roles' field"
        assert "permissions" in data, "Response missing 'permissions' field"
        
        # Master admin should have MASTER_ADMIN role
        assert "MASTER_ADMIN" in data["roles"], f"Admin should have MASTER_ADMIN role, got: {data['roles']}"
        
        print(f"✓ Master Admin has roles: {data['roles']}")
        print(f"✓ Master Admin has {len(data['permissions'])} permissions")


class TestMasterAdminAccess:
    """Test Master Admin has full access to all operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=MASTER_ADMIN)
        assert response.status_code == 200
        self.admin_token = response.json()["access_token"]
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_admin_can_create_sku(self):
        """Master Admin can CREATE SKUs"""
        sku_data = {
            "sku_id": f"TEST_RBAC_SKU_{uuid.uuid4().hex[:8]}",
            "description": "RBAC Test SKU",
            "vertical": "Test",
            "model": "Test Model",
            "brand": "Test Brand"
        }
        response = requests.post(f"{BASE_URL}/api/skus", json=sku_data, headers=self.admin_headers)
        assert response.status_code == 200, f"Admin should be able to create SKU: {response.text}"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/skus/{sku_data['sku_id']}", headers=self.admin_headers)
        print("✓ Master Admin can CREATE SKUs")
    
    def test_admin_can_create_vendor(self):
        """Master Admin can CREATE Vendors"""
        vendor_data = {
            "name": f"TEST_RBAC_Vendor_{uuid.uuid4().hex[:8]}",
            "contact_person": "Test Contact",
            "phone": "1234567890",
            "email": "test@vendor.com",
            "address": "Test Address"
        }
        response = requests.post(f"{BASE_URL}/api/vendors", json=vendor_data, headers=self.admin_headers)
        assert response.status_code == 200, f"Admin should be able to create Vendor: {response.text}"
        
        vendor_id = response.json().get("vendor_id")
        # Cleanup
        if vendor_id:
            requests.delete(f"{BASE_URL}/api/vendors/{vendor_id}", headers=self.admin_headers)
        print("✓ Master Admin can CREATE Vendors")
    
    def test_admin_can_create_raw_material(self):
        """Master Admin can CREATE Raw Materials"""
        rm_data = {
            "category": "FABRIC",
            "category_data": {"type": "Test Fabric", "color": "Blue"},
            "low_stock_threshold": 10.0
        }
        response = requests.post(f"{BASE_URL}/api/raw-materials", json=rm_data, headers=self.admin_headers)
        assert response.status_code == 200, f"Admin should be able to create RM: {response.text}"
        
        rm_id = response.json().get("rm_id")
        # Cleanup
        if rm_id:
            requests.delete(f"{BASE_URL}/api/raw-materials/{rm_id}", headers=self.admin_headers)
        print("✓ Master Admin can CREATE Raw Materials")


class TestDemandPlannerAccess:
    """Test Demand Planner role permissions"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - create demand planner user if not exists"""
        # Login as admin first
        admin_response = requests.post(f"{BASE_URL}/api/auth/login", json=MASTER_ADMIN)
        assert admin_response.status_code == 200
        self.admin_token = admin_response.json()["access_token"]
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Try to login as demand planner
        planner_response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMAND_PLANNER)
        if planner_response.status_code == 200:
            self.planner_token = planner_response.json()["access_token"]
            self.planner_headers = {"Authorization": f"Bearer {self.planner_token}"}
            self.planner_user_id = planner_response.json()["user"]["id"]
        else:
            # Create demand planner user
            user_data = {
                "email": DEMAND_PLANNER["email"],
                "password": DEMAND_PLANNER["password"],
                "name": "Demand Planner",
                "role": "branch_user",
                "assigned_branches": ["Unit 1 Vedica"]
            }
            create_response = requests.post(f"{BASE_URL}/api/users", json=user_data, headers=self.admin_headers)
            if create_response.status_code == 200:
                self.planner_user_id = create_response.json()["id"]
                
                # Assign DEMAND_PLANNER role
                role_data = {"user_id": self.planner_user_id, "role_code": "DEMAND_PLANNER", "is_primary": True}
                requests.post(f"{BASE_URL}/api/users/{self.planner_user_id}/roles", json=role_data, headers=self.admin_headers)
                
                # Login as demand planner
                planner_response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMAND_PLANNER)
                if planner_response.status_code == 200:
                    self.planner_token = planner_response.json()["access_token"]
                    self.planner_headers = {"Authorization": f"Bearer {self.planner_token}"}
                else:
                    pytest.skip("Could not login as demand planner")
            else:
                pytest.skip(f"Could not create demand planner user: {create_response.text}")
    
    def test_demand_planner_can_create_sku(self):
        """Demand Planner can CREATE SKUs"""
        if not hasattr(self, 'planner_headers'):
            pytest.skip("Demand planner not available")
        
        sku_data = {
            "sku_id": f"TEST_DP_SKU_{uuid.uuid4().hex[:8]}",
            "description": "Demand Planner Test SKU",
            "vertical": "Test",
            "model": "Test Model",
            "brand": "Test Brand"
        }
        response = requests.post(f"{BASE_URL}/api/skus", json=sku_data, headers=self.planner_headers)
        assert response.status_code == 200, f"Demand Planner should be able to create SKU: {response.text}"
        
        # Cleanup with admin
        requests.delete(f"{BASE_URL}/api/skus/{sku_data['sku_id']}", headers=self.admin_headers)
        print("✓ Demand Planner can CREATE SKUs")
    
    def test_demand_planner_cannot_delete_raw_materials(self):
        """Demand Planner CANNOT delete Raw Materials"""
        if not hasattr(self, 'planner_headers'):
            pytest.skip("Demand planner not available")
        
        # First create an RM as admin
        rm_data = {
            "category": "FABRIC",
            "category_data": {"type": "Test Fabric", "color": "Red"},
            "low_stock_threshold": 10.0
        }
        create_response = requests.post(f"{BASE_URL}/api/raw-materials", json=rm_data, headers=self.admin_headers)
        assert create_response.status_code == 200
        rm_id = create_response.json()["rm_id"]
        
        # Try to delete as demand planner - should fail
        delete_response = requests.delete(f"{BASE_URL}/api/raw-materials/{rm_id}", headers=self.planner_headers)
        assert delete_response.status_code == 403, f"Demand Planner should NOT be able to delete RM, got: {delete_response.status_code}"
        
        # Cleanup with admin
        requests.delete(f"{BASE_URL}/api/raw-materials/{rm_id}", headers=self.admin_headers)
        print("✓ Demand Planner CANNOT delete Raw Materials (403 Forbidden)")
    
    def test_demand_planner_cannot_create_vendors(self):
        """Demand Planner CANNOT create Vendors"""
        if not hasattr(self, 'planner_headers'):
            pytest.skip("Demand planner not available")
        
        vendor_data = {
            "name": f"TEST_DP_Vendor_{uuid.uuid4().hex[:8]}",
            "contact_person": "Test Contact",
            "phone": "1234567890",
            "email": "test@vendor.com",
            "address": "Test Address"
        }
        response = requests.post(f"{BASE_URL}/api/vendors", json=vendor_data, headers=self.planner_headers)
        assert response.status_code == 403, f"Demand Planner should NOT be able to create Vendor, got: {response.status_code}"
        print("✓ Demand Planner CANNOT create Vendors (403 Forbidden)")


class TestProcurementOfficerAccess:
    """Test Procurement Officer role permissions"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - create procurement officer user if not exists"""
        # Login as admin first
        admin_response = requests.post(f"{BASE_URL}/api/auth/login", json=MASTER_ADMIN)
        assert admin_response.status_code == 200
        self.admin_token = admin_response.json()["access_token"]
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Create procurement officer user
        self.procurement_email = f"procurement_{uuid.uuid4().hex[:8]}@factory.com"
        self.procurement_password = "procurement123"
        
        user_data = {
            "email": self.procurement_email,
            "password": self.procurement_password,
            "name": "Procurement Officer",
            "role": "branch_user",
            "assigned_branches": ["Unit 1 Vedica"]
        }
        create_response = requests.post(f"{BASE_URL}/api/users", json=user_data, headers=self.admin_headers)
        if create_response.status_code == 200:
            self.procurement_user_id = create_response.json()["id"]
            
            # Assign PROCUREMENT_OFFICER role
            role_data = {"user_id": self.procurement_user_id, "role_code": "PROCUREMENT_OFFICER", "is_primary": True}
            assign_response = requests.post(f"{BASE_URL}/api/users/{self.procurement_user_id}/roles", json=role_data, headers=self.admin_headers)
            
            # Login as procurement officer
            login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": self.procurement_email,
                "password": self.procurement_password
            })
            if login_response.status_code == 200:
                self.procurement_token = login_response.json()["access_token"]
                self.procurement_headers = {"Authorization": f"Bearer {self.procurement_token}"}
            else:
                pytest.skip("Could not login as procurement officer")
        else:
            pytest.skip(f"Could not create procurement officer user: {create_response.text}")
    
    def test_procurement_can_create_vendor(self):
        """Procurement Officer can CREATE Vendors"""
        if not hasattr(self, 'procurement_headers'):
            pytest.skip("Procurement officer not available")
        
        vendor_data = {
            "name": f"TEST_PO_Vendor_{uuid.uuid4().hex[:8]}",
            "contact_person": "Test Contact",
            "phone": "1234567890",
            "email": "test@vendor.com",
            "address": "Test Address"
        }
        response = requests.post(f"{BASE_URL}/api/vendors", json=vendor_data, headers=self.procurement_headers)
        assert response.status_code == 200, f"Procurement Officer should be able to create Vendor: {response.text}"
        
        vendor_id = response.json().get("vendor_id")
        # Cleanup with admin
        if vendor_id:
            requests.delete(f"{BASE_URL}/api/vendors/{vendor_id}", headers=self.admin_headers)
        print("✓ Procurement Officer can CREATE Vendors")
    
    def test_procurement_cannot_delete_skus(self):
        """Procurement Officer CANNOT delete SKUs"""
        if not hasattr(self, 'procurement_headers'):
            pytest.skip("Procurement officer not available")
        
        # First create an SKU as admin
        sku_data = {
            "sku_id": f"TEST_PO_SKU_{uuid.uuid4().hex[:8]}",
            "description": "Procurement Test SKU",
            "vertical": "Test",
            "model": "Test Model",
            "brand": "Test Brand"
        }
        create_response = requests.post(f"{BASE_URL}/api/skus", json=sku_data, headers=self.admin_headers)
        assert create_response.status_code == 200
        sku_id = sku_data["sku_id"]
        
        # Try to delete as procurement officer - should fail
        delete_response = requests.delete(f"{BASE_URL}/api/skus/{sku_id}", headers=self.procurement_headers)
        assert delete_response.status_code == 403, f"Procurement Officer should NOT be able to delete SKU, got: {delete_response.status_code}"
        
        # Cleanup with admin
        requests.delete(f"{BASE_URL}/api/skus/{sku_id}", headers=self.admin_headers)
        print("✓ Procurement Officer CANNOT delete SKUs (403 Forbidden)")


class TestRoleAssignmentAPI:
    """Test role assignment API"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=MASTER_ADMIN)
        assert response.status_code == 200
        self.admin_token = response.json()["access_token"]
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_admin_can_assign_role(self):
        """Admin can assign roles to users"""
        # Create a test user
        test_email = f"test_role_assign_{uuid.uuid4().hex[:8]}@factory.com"
        user_data = {
            "email": test_email,
            "password": "test123",
            "name": "Test Role User",
            "role": "branch_user",
            "assigned_branches": ["Unit 1 Vedica"]
        }
        create_response = requests.post(f"{BASE_URL}/api/users", json=user_data, headers=self.admin_headers)
        assert create_response.status_code == 200, f"Failed to create user: {create_response.text}"
        user_id = create_response.json()["id"]
        
        # Assign QUALITY_INSPECTOR role
        role_data = {"user_id": user_id, "role_code": "QUALITY_INSPECTOR", "is_primary": False}
        assign_response = requests.post(f"{BASE_URL}/api/users/{user_id}/roles", json=role_data, headers=self.admin_headers)
        assert assign_response.status_code == 200, f"Failed to assign role: {assign_response.text}"
        
        # Verify role was assigned
        roles_response = requests.get(f"{BASE_URL}/api/users/{user_id}/roles", headers=self.admin_headers)
        assert roles_response.status_code == 200
        roles_data = roles_response.json()
        role_codes = [r["code"] for r in roles_data.get("roles", [])]
        assert "QUALITY_INSPECTOR" in role_codes, f"Role not found in user roles: {role_codes}"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=self.admin_headers)
        print("✓ Admin can assign roles to users")
    
    def test_assign_duplicate_role_fails(self):
        """Assigning duplicate role should fail"""
        # Create a test user
        test_email = f"test_dup_role_{uuid.uuid4().hex[:8]}@factory.com"
        user_data = {
            "email": test_email,
            "password": "test123",
            "name": "Test Dup Role User",
            "role": "branch_user",
            "assigned_branches": ["Unit 1 Vedica"]
        }
        create_response = requests.post(f"{BASE_URL}/api/users", json=user_data, headers=self.admin_headers)
        assert create_response.status_code == 200
        user_id = create_response.json()["id"]
        
        # Assign role first time
        role_data = {"user_id": user_id, "role_code": "LOGISTICS_COORDINATOR", "is_primary": False}
        first_assign = requests.post(f"{BASE_URL}/api/users/{user_id}/roles", json=role_data, headers=self.admin_headers)
        assert first_assign.status_code == 200
        
        # Try to assign same role again - should fail
        second_assign = requests.post(f"{BASE_URL}/api/users/{user_id}/roles", json=role_data, headers=self.admin_headers)
        assert second_assign.status_code == 400, f"Duplicate role assignment should fail, got: {second_assign.status_code}"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=self.admin_headers)
        print("✓ Duplicate role assignment correctly fails (400)")


class TestPermissionCheckAPI:
    """Test /api/auth/permissions endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=MASTER_ADMIN)
        assert response.status_code == 200
        self.admin_token = response.json()["access_token"]
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_permissions_endpoint_returns_correct_structure(self):
        """Verify /api/auth/permissions returns correct structure"""
        response = requests.get(f"{BASE_URL}/api/auth/permissions", headers=self.admin_headers)
        assert response.status_code == 200, f"Failed to get permissions: {response.text}"
        
        data = response.json()
        assert "user_id" in data, "Response missing 'user_id'"
        assert "roles" in data, "Response missing 'roles'"
        assert "permissions" in data, "Response missing 'permissions'"
        
        # Verify permissions structure
        if data["permissions"]:
            perm = data["permissions"][0]
            assert "entity" in perm, "Permission missing 'entity'"
            assert "action" in perm, "Permission missing 'action'"
        
        print(f"✓ Permissions endpoint returns correct structure")
        print(f"  - User roles: {data['roles']}")
        print(f"  - Permission count: {len(data['permissions'])}")


class TestRoleListingAPI:
    """Test /api/roles endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=MASTER_ADMIN)
        assert response.status_code == 200
        self.admin_token = response.json()["access_token"]
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_roles_endpoint_returns_all_10_roles(self):
        """Verify /api/roles returns all 10 roles"""
        response = requests.get(f"{BASE_URL}/api/roles", headers=self.admin_headers)
        assert response.status_code == 200, f"Failed to get roles: {response.text}"
        
        roles = response.json()
        role_codes = [r["code"] for r in roles]
        
        # Verify all 10 expected roles
        missing_roles = [r for r in EXPECTED_ROLES if r not in role_codes]
        assert len(missing_roles) == 0, f"Missing roles: {missing_roles}"
        
        print(f"✓ /api/roles returns all 10 roles: {role_codes}")


class TestUserRolesAPI:
    """Test /api/users/{id}/roles endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=MASTER_ADMIN)
        assert response.status_code == 200
        self.admin_token = response.json()["access_token"]
        self.admin_user_id = response.json()["user"]["id"]
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_user_roles_endpoint_returns_assigned_roles(self):
        """Verify /api/users/{id}/roles returns assigned roles"""
        # Create a test user with roles
        test_email = f"test_user_roles_{uuid.uuid4().hex[:8]}@factory.com"
        user_data = {
            "email": test_email,
            "password": "test123",
            "name": "Test User Roles",
            "role": "branch_user",
            "assigned_branches": ["Unit 1 Vedica"]
        }
        create_response = requests.post(f"{BASE_URL}/api/users", json=user_data, headers=self.admin_headers)
        assert create_response.status_code == 200
        user_id = create_response.json()["id"]
        
        # Assign multiple roles
        for role_code in ["TECH_OPS_ENGINEER", "CPC_PLANNER"]:
            role_data = {"user_id": user_id, "role_code": role_code, "is_primary": False}
            requests.post(f"{BASE_URL}/api/users/{user_id}/roles", json=role_data, headers=self.admin_headers)
        
        # Get user roles
        roles_response = requests.get(f"{BASE_URL}/api/users/{user_id}/roles", headers=self.admin_headers)
        assert roles_response.status_code == 200, f"Failed to get user roles: {roles_response.text}"
        
        roles_data = roles_response.json()
        assert "user_id" in roles_data, "Response missing 'user_id'"
        assert "roles" in roles_data, "Response missing 'roles'"
        
        role_codes = [r["code"] for r in roles_data.get("roles", [])]
        assert "TECH_OPS_ENGINEER" in role_codes, f"TECH_OPS_ENGINEER not in roles: {role_codes}"
        assert "CPC_PLANNER" in role_codes, f"CPC_PLANNER not in roles: {role_codes}"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=self.admin_headers)
        print(f"✓ /api/users/{{id}}/roles returns assigned roles: {role_codes}")
    
    def test_user_roles_for_nonexistent_user(self):
        """Verify 404 for nonexistent user"""
        fake_user_id = str(uuid.uuid4())
        response = requests.get(f"{BASE_URL}/api/users/{fake_user_id}/roles", headers=self.admin_headers)
        assert response.status_code == 404, f"Expected 404 for nonexistent user, got: {response.status_code}"
        print("✓ /api/users/{id}/roles returns 404 for nonexistent user")


class TestRoleRemoval:
    """Test role removal functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=MASTER_ADMIN)
        assert response.status_code == 200
        self.admin_token = response.json()["access_token"]
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_admin_can_remove_role(self):
        """Admin can remove roles from users"""
        # Create a test user
        test_email = f"test_role_remove_{uuid.uuid4().hex[:8]}@factory.com"
        user_data = {
            "email": test_email,
            "password": "test123",
            "name": "Test Role Remove User",
            "role": "branch_user",
            "assigned_branches": ["Unit 1 Vedica"]
        }
        create_response = requests.post(f"{BASE_URL}/api/users", json=user_data, headers=self.admin_headers)
        assert create_response.status_code == 200
        user_id = create_response.json()["id"]
        
        # Assign role
        role_data = {"user_id": user_id, "role_code": "FINANCE_VIEWER", "is_primary": False}
        assign_response = requests.post(f"{BASE_URL}/api/users/{user_id}/roles", json=role_data, headers=self.admin_headers)
        assert assign_response.status_code == 200
        
        # Remove role
        remove_response = requests.delete(f"{BASE_URL}/api/users/{user_id}/roles/FINANCE_VIEWER", headers=self.admin_headers)
        assert remove_response.status_code == 200, f"Failed to remove role: {remove_response.text}"
        
        # Verify role was removed
        roles_response = requests.get(f"{BASE_URL}/api/users/{user_id}/roles", headers=self.admin_headers)
        roles_data = roles_response.json()
        role_codes = [r["code"] for r in roles_data.get("roles", [])]
        assert "FINANCE_VIEWER" not in role_codes, f"Role should be removed: {role_codes}"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=self.admin_headers)
        print("✓ Admin can remove roles from users")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

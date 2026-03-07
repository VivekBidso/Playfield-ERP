"""
Test suite for Production Planning feature
- POST /api/production-plans endpoint for creating single production plans
- GET /api/production-plans endpoint for retrieving plans
- Cascading SKU filters for production planning
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')

class TestProductionPlansAPI:
    """Tests for Production Plans CRUD operations"""
    
    def test_create_production_plan_success(self):
        """Test creating a production plan with valid SKU"""
        response = requests.post(f"{BASE_URL}/api/production-plans", json={
            "sku_id": "FC_KS_BE_115",
            "branch": "Unit 1 Vedica",
            "date": "2025-02-15T00:00:00Z",
            "planned_quantity": 100
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["message"] in ["Production plan created", "Production plan updated"]
        assert data["sku_id"] == "FC_KS_BE_115"
        assert data["planned_quantity"] == 100.0
    
    def test_create_production_plan_invalid_sku(self):
        """Test creating a production plan with invalid SKU returns 404"""
        response = requests.post(f"{BASE_URL}/api/production-plans", json={
            "sku_id": "INVALID_SKU_XYZ",
            "branch": "Unit 1 Vedica",
            "date": "2025-02-16T00:00:00Z",
            "planned_quantity": 50
        })
        
        assert response.status_code == 404
        data = response.json()
        assert "not found" in data["detail"].lower()
    
    def test_create_production_plan_updates_existing(self):
        """Test that creating a plan for same SKU/branch/date updates existing"""
        # Create first plan
        response1 = requests.post(f"{BASE_URL}/api/production-plans", json={
            "sku_id": "FC_KS_BE_115",
            "branch": "Unit 1 Vedica",
            "date": "2025-02-20T00:00:00Z",
            "planned_quantity": 100
        })
        assert response1.status_code == 200
        
        # Create second plan for same SKU/branch/date - should update
        response2 = requests.post(f"{BASE_URL}/api/production-plans", json={
            "sku_id": "FC_KS_BE_115",
            "branch": "Unit 1 Vedica",
            "date": "2025-02-20T00:00:00Z",
            "planned_quantity": 200
        })
        assert response2.status_code == 200
        data = response2.json()
        assert data["planned_quantity"] == 200.0
    
    def test_get_production_plans_by_branch(self):
        """Test retrieving production plans for a branch"""
        response = requests.get(f"{BASE_URL}/api/production-plans", params={
            "branch": "Unit 1 Vedica"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Verify all plans are for the correct branch
        for plan in data:
            assert plan["branch"] == "Unit 1 Vedica"
    
    def test_get_production_plans_by_month(self):
        """Test retrieving production plans filtered by month"""
        response = requests.get(f"{BASE_URL}/api/production-plans", params={
            "branch": "Unit 1 Vedica",
            "plan_month": "2025-01"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Verify all plans are for the correct month
        for plan in data:
            assert plan["plan_month"] == "2025-01"
    
    def test_get_production_plans_structure(self):
        """Test that production plan response has correct structure"""
        response = requests.get(f"{BASE_URL}/api/production-plans", params={
            "branch": "Unit 1 Vedica"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            plan = data[0]
            assert "id" in plan
            assert "branch" in plan
            assert "plan_month" in plan
            assert "date" in plan
            assert "sku_id" in plan
            assert "planned_quantity" in plan
            assert "created_at" in plan


class TestProductionPlanMonths:
    """Tests for available months endpoint"""
    
    def test_get_available_months(self):
        """Test retrieving available months for a branch"""
        response = requests.get(f"{BASE_URL}/api/production-plans/months", params={
            "branch": "Unit 1 Vedica"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "months" in data
        assert isinstance(data["months"], list)


class TestSKUFiltersForPlanning:
    """Tests for SKU cascading filters used in production planning"""
    
    def test_get_filter_options(self):
        """Test getting SKU filter options (verticals, models, brands)"""
        response = requests.get(f"{BASE_URL}/api/skus/filter-options")
        
        assert response.status_code == 200
        data = response.json()
        assert "verticals" in data
        assert isinstance(data["verticals"], list)
        assert len(data["verticals"]) > 0
    
    def test_get_models_by_vertical(self):
        """Test getting models filtered by vertical"""
        # First get available verticals
        filter_response = requests.get(f"{BASE_URL}/api/skus/filter-options")
        verticals = filter_response.json().get("verticals", [])
        
        if len(verticals) > 0:
            vertical = verticals[0]
            response = requests.get(f"{BASE_URL}/api/skus/models-by-vertical", params={
                "vertical": vertical
            })
            
            assert response.status_code == 200
            data = response.json()
            assert "models" in data
            assert isinstance(data["models"], list)
    
    def test_get_brands_by_vertical_model(self):
        """Test getting brands filtered by vertical and model"""
        # First get available verticals
        filter_response = requests.get(f"{BASE_URL}/api/skus/filter-options")
        verticals = filter_response.json().get("verticals", [])
        
        if len(verticals) > 0:
            vertical = verticals[0]
            response = requests.get(f"{BASE_URL}/api/skus/brands-by-vertical-model", params={
                "vertical": vertical
            })
            
            assert response.status_code == 200
            data = response.json()
            assert "brands" in data
            assert isinstance(data["brands"], list)
    
    def test_get_skus_for_branch(self):
        """Test getting SKUs for a specific branch"""
        response = requests.get(f"{BASE_URL}/api/skus", params={
            "branch": "Unit 1 Vedica"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestShortageAnalysis:
    """Tests for shortage analysis endpoint"""
    
    def test_get_shortage_analysis(self):
        """Test getting shortage analysis for a plan month"""
        response = requests.get(f"{BASE_URL}/api/production-plans/shortage-analysis", params={
            "branch": "Unit 1 Vedica",
            "plan_month": "2025-01"
        })
        
        # Should return 200 if plans exist, 404 if no plans
        assert response.status_code in [200, 404]
        
        if response.status_code == 200:
            data = response.json()
            assert "shortage_report" in data
            assert "sufficient_stock" in data
            assert "plan_summary" in data


class TestProductionPlanDelete:
    """Tests for deleting production plans"""
    
    def test_delete_production_plan_month(self):
        """Test deleting all plans for a specific month"""
        # First create a plan for a test month
        create_response = requests.post(f"{BASE_URL}/api/production-plans", json={
            "sku_id": "FC_KS_BE_115",
            "branch": "Unit 1 Vedica",
            "date": "2025-12-15T00:00:00Z",
            "planned_quantity": 50
        })
        assert create_response.status_code == 200
        
        # Delete plans for that month
        delete_response = requests.delete(
            f"{BASE_URL}/api/production-plans/2025-12",
            params={"branch": "Unit 1 Vedica"}
        )
        
        assert delete_response.status_code == 200
        data = delete_response.json()
        assert "Deleted" in data["message"]
        
        # Verify plans are deleted
        get_response = requests.get(f"{BASE_URL}/api/production-plans", params={
            "branch": "Unit 1 Vedica",
            "plan_month": "2025-12"
        })
        assert get_response.status_code == 200
        assert len(get_response.json()) == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

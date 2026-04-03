"""
Test suite for Custom Reports API endpoints:
- Dispatch by Manufacturing Origin
- Production Output by Unit
- Forecast vs Actual
- Buyer/Customer Dispatch History
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestDispatchByOriginReport:
    """Tests for GET /api/dispatch-by-origin endpoint"""
    
    def test_dispatch_origin_returns_200(self):
        """Test that dispatch-by-origin endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/dispatch-by-origin")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: dispatch-by-origin returns 200")
    
    def test_dispatch_origin_response_structure(self):
        """Test that response has correct structure"""
        response = requests.get(f"{BASE_URL}/api/dispatch-by-origin")
        data = response.json()
        
        # Check required fields
        assert "summary" in data, "Missing 'summary' field"
        assert "detailed_records" in data, "Missing 'detailed_records' field"
        assert "total_records" in data, "Missing 'total_records' field"
        
        # Check types
        assert isinstance(data["summary"], list), "'summary' should be a list"
        assert isinstance(data["detailed_records"], list), "'detailed_records' should be a list"
        assert isinstance(data["total_records"], int), "'total_records' should be an integer"
        print("PASS: dispatch-by-origin has correct response structure")
    
    def test_dispatch_origin_with_date_filters(self):
        """Test dispatch-by-origin with date filters"""
        response = requests.get(
            f"{BASE_URL}/api/dispatch-by-origin",
            params={"start_date": "2025-01-01", "end_date": "2025-12-31"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        print("PASS: dispatch-by-origin works with date filters")
    
    def test_dispatch_origin_with_branch_filter(self):
        """Test dispatch-by-origin with branch filter"""
        response = requests.get(
            f"{BASE_URL}/api/dispatch-by-origin",
            params={"dispatch_branch": "Unit 1"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        print("PASS: dispatch-by-origin works with branch filter")


class TestProductionByUnitReport:
    """Tests for GET /api/production-by-unit endpoint"""
    
    def test_production_by_unit_returns_200(self):
        """Test that production-by-unit endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/production-by-unit")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: production-by-unit returns 200")
    
    def test_production_by_unit_response_structure(self):
        """Test that response has correct structure"""
        response = requests.get(f"{BASE_URL}/api/production-by-unit")
        data = response.json()
        
        # Check required fields
        assert "summary" in data, "Missing 'summary' field"
        assert "detailed_records" in data, "Missing 'detailed_records' field"
        assert "total_schedules" in data, "Missing 'total_schedules' field"
        
        # Check types
        assert isinstance(data["summary"], list), "'summary' should be a list"
        assert isinstance(data["detailed_records"], list), "'detailed_records' should be a list"
        assert isinstance(data["total_schedules"], int), "'total_schedules' should be an integer"
        print("PASS: production-by-unit has correct response structure")
    
    def test_production_by_unit_with_date_filters(self):
        """Test production-by-unit with date filters"""
        response = requests.get(
            f"{BASE_URL}/api/production-by-unit",
            params={"start_date": "2025-01-01", "end_date": "2025-12-31"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        print("PASS: production-by-unit works with date filters")
    
    def test_production_by_unit_with_branch_filter(self):
        """Test production-by-unit with branch filter"""
        response = requests.get(
            f"{BASE_URL}/api/production-by-unit",
            params={"branch": "Unit 1"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        print("PASS: production-by-unit works with branch filter")


class TestForecastVsActualReport:
    """Tests for GET /api/forecast-vs-actual endpoint"""
    
    def test_forecast_vs_actual_returns_200(self):
        """Test that forecast-vs-actual endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/forecast-vs-actual")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: forecast-vs-actual returns 200")
    
    def test_forecast_vs_actual_response_structure(self):
        """Test that response has correct structure"""
        response = requests.get(f"{BASE_URL}/api/forecast-vs-actual")
        data = response.json()
        
        # Check required fields
        assert "summary" in data, "Missing 'summary' field"
        assert "detailed_records" in data, "Missing 'detailed_records' field"
        assert "total_records" in data, "Missing 'total_records' field"
        
        # Check summary structure
        summary = data["summary"]
        assert "total_forecast" in summary, "Missing 'total_forecast' in summary"
        assert "total_actual" in summary, "Missing 'total_actual' in summary"
        assert "overall_variance" in summary, "Missing 'overall_variance' in summary"
        assert "overall_accuracy_pct" in summary, "Missing 'overall_accuracy_pct' in summary"
        assert "items_on_track" in summary, "Missing 'items_on_track' in summary"
        assert "items_over" in summary, "Missing 'items_over' in summary"
        assert "items_under" in summary, "Missing 'items_under' in summary"
        
        # Check types
        assert isinstance(data["detailed_records"], list), "'detailed_records' should be a list"
        assert isinstance(data["total_records"], int), "'total_records' should be an integer"
        print("PASS: forecast-vs-actual has correct response structure")
    
    def test_forecast_vs_actual_with_date_filters(self):
        """Test forecast-vs-actual with date filters"""
        response = requests.get(
            f"{BASE_URL}/api/forecast-vs-actual",
            params={"start_date": "2025-01-01", "end_date": "2025-12-31"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        print("PASS: forecast-vs-actual works with date filters")
    
    def test_forecast_vs_actual_with_buyer_filter(self):
        """Test forecast-vs-actual with buyer filter"""
        response = requests.get(
            f"{BASE_URL}/api/forecast-vs-actual",
            params={"buyer_id": "BUYER001"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        print("PASS: forecast-vs-actual works with buyer filter")


class TestBuyerDispatchHistoryReport:
    """Tests for GET /api/buyer-dispatch-history endpoint"""
    
    def test_buyer_dispatch_history_returns_200(self):
        """Test that buyer-dispatch-history endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/buyer-dispatch-history")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: buyer-dispatch-history returns 200")
    
    def test_buyer_dispatch_history_response_structure(self):
        """Test that response has correct structure"""
        response = requests.get(f"{BASE_URL}/api/buyer-dispatch-history")
        data = response.json()
        
        # Check required fields
        assert "summary" in data, "Missing 'summary' field"
        assert "total_buyers" in data, "Missing 'total_buyers' field"
        assert "grand_total_quantity" in data, "Missing 'grand_total_quantity' field"
        assert "grand_total_lots" in data, "Missing 'grand_total_lots' field"
        
        # Check types
        assert isinstance(data["summary"], list), "'summary' should be a list"
        assert isinstance(data["total_buyers"], int), "'total_buyers' should be an integer"
        assert isinstance(data["grand_total_quantity"], int), "'grand_total_quantity' should be an integer"
        assert isinstance(data["grand_total_lots"], int), "'grand_total_lots' should be an integer"
        print("PASS: buyer-dispatch-history has correct response structure")
    
    def test_buyer_dispatch_history_with_date_filters(self):
        """Test buyer-dispatch-history with date filters"""
        response = requests.get(
            f"{BASE_URL}/api/buyer-dispatch-history",
            params={"start_date": "2025-01-01", "end_date": "2025-12-31"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        print("PASS: buyer-dispatch-history works with date filters")
    
    def test_buyer_dispatch_history_with_buyer_name_filter(self):
        """Test buyer-dispatch-history with buyer_name filter"""
        response = requests.get(
            f"{BASE_URL}/api/buyer-dispatch-history",
            params={"buyer_name": "Test Buyer"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        print("PASS: buyer-dispatch-history works with buyer_name filter")
    
    def test_buyer_dispatch_history_with_buyer_id_filter(self):
        """Test buyer-dispatch-history with buyer_id filter"""
        response = requests.get(
            f"{BASE_URL}/api/buyer-dispatch-history",
            params={"buyer_id": "BUYER001"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        print("PASS: buyer-dispatch-history works with buyer_id filter")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

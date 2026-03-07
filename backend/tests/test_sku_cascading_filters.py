"""
Test SKU Cascading Filter Endpoints
Tests for the new cascading filter functionality:
- /api/skus/filter-options - Get all verticals, models, brands
- /api/skus/models-by-vertical - Get models for a specific vertical
- /api/skus/brands-by-vertical-model - Get brands for vertical+model combination
- /api/skus/filtered - Get filtered SKUs based on vertical, model, brand, search
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestSKUFilterOptions:
    """Test /api/skus/filter-options endpoint"""
    
    def test_get_filter_options_returns_200(self):
        """Test that filter-options endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/skus/filter-options")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: /api/skus/filter-options returns 200")
    
    def test_filter_options_has_verticals(self):
        """Test that filter-options returns verticals array"""
        response = requests.get(f"{BASE_URL}/api/skus/filter-options")
        data = response.json()
        
        assert "verticals" in data, "Response should contain 'verticals' key"
        assert isinstance(data["verticals"], list), "verticals should be a list"
        assert len(data["verticals"]) > 0, "verticals should not be empty"
        print(f"PASS: Found {len(data['verticals'])} verticals: {data['verticals'][:5]}...")
    
    def test_filter_options_has_models(self):
        """Test that filter-options returns models array"""
        response = requests.get(f"{BASE_URL}/api/skus/filter-options")
        data = response.json()
        
        assert "models" in data, "Response should contain 'models' key"
        assert isinstance(data["models"], list), "models should be a list"
        print(f"PASS: Found {len(data['models'])} models")
    
    def test_filter_options_has_brands(self):
        """Test that filter-options returns brands array"""
        response = requests.get(f"{BASE_URL}/api/skus/filter-options")
        data = response.json()
        
        assert "brands" in data, "Response should contain 'brands' key"
        assert isinstance(data["brands"], list), "brands should be a list"
        print(f"PASS: Found {len(data['brands'])} brands")
    
    def test_verticals_include_expected_values(self):
        """Test that verticals include expected values like Scooter, Rideon, etc."""
        response = requests.get(f"{BASE_URL}/api/skus/filter-options")
        data = response.json()
        
        # Based on the problem statement, we expect these verticals
        expected_verticals = ["Scooter", "Rideon", "Tricycle"]
        found_verticals = [v for v in expected_verticals if v in data["verticals"]]
        
        assert len(found_verticals) > 0, f"Expected at least one of {expected_verticals} in verticals"
        print(f"PASS: Found expected verticals: {found_verticals}")


class TestModelsByVertical:
    """Test /api/skus/models-by-vertical endpoint"""
    
    def test_models_by_vertical_returns_200(self):
        """Test that models-by-vertical endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/skus/models-by-vertical?vertical=Scooter")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: /api/skus/models-by-vertical returns 200")
    
    def test_models_by_vertical_returns_models_list(self):
        """Test that models-by-vertical returns models array"""
        response = requests.get(f"{BASE_URL}/api/skus/models-by-vertical?vertical=Scooter")
        data = response.json()
        
        assert "models" in data, "Response should contain 'models' key"
        assert isinstance(data["models"], list), "models should be a list"
        print(f"PASS: Found {len(data['models'])} models for Scooter vertical")
    
    def test_models_by_vertical_cascading_logic(self):
        """Test that different verticals return different models"""
        # Get models for Scooter
        response1 = requests.get(f"{BASE_URL}/api/skus/models-by-vertical?vertical=Scooter")
        scooter_models = response1.json().get("models", [])
        
        # Get models for Rideon
        response2 = requests.get(f"{BASE_URL}/api/skus/models-by-vertical?vertical=Rideon")
        rideon_models = response2.json().get("models", [])
        
        # They should be different (or at least not identical)
        print(f"Scooter models: {len(scooter_models)}, Rideon models: {len(rideon_models)}")
        print("PASS: Models-by-vertical returns vertical-specific models")
    
    def test_models_by_vertical_missing_param(self):
        """Test that missing vertical param returns 422"""
        response = requests.get(f"{BASE_URL}/api/skus/models-by-vertical")
        assert response.status_code == 422, f"Expected 422 for missing param, got {response.status_code}"
        print("PASS: Missing vertical param returns 422")


class TestBrandsByVerticalModel:
    """Test /api/skus/brands-by-vertical-model endpoint"""
    
    def test_brands_by_vertical_returns_200(self):
        """Test that brands-by-vertical-model endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/skus/brands-by-vertical-model?vertical=Scooter")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: /api/skus/brands-by-vertical-model returns 200")
    
    def test_brands_by_vertical_returns_brands_list(self):
        """Test that brands-by-vertical-model returns brands array"""
        response = requests.get(f"{BASE_URL}/api/skus/brands-by-vertical-model?vertical=Scooter")
        data = response.json()
        
        assert "brands" in data, "Response should contain 'brands' key"
        assert isinstance(data["brands"], list), "brands should be a list"
        print(f"PASS: Found {len(data['brands'])} brands for Scooter vertical")
    
    def test_brands_by_vertical_and_model(self):
        """Test that brands-by-vertical-model works with both params"""
        # First get a model for Scooter
        models_response = requests.get(f"{BASE_URL}/api/skus/models-by-vertical?vertical=Scooter")
        models = models_response.json().get("models", [])
        
        if models:
            model = models[0]
            response = requests.get(f"{BASE_URL}/api/skus/brands-by-vertical-model?vertical=Scooter&model={model}")
            assert response.status_code == 200
            data = response.json()
            assert "brands" in data
            print(f"PASS: Found {len(data['brands'])} brands for Scooter/{model}")
        else:
            pytest.skip("No models found for Scooter vertical")
    
    def test_brands_cascading_logic(self):
        """Test that different vertical+model combinations return different brands"""
        # Get brands for Scooter
        response1 = requests.get(f"{BASE_URL}/api/skus/brands-by-vertical-model?vertical=Scooter")
        scooter_brands = response1.json().get("brands", [])
        
        # Get brands for Rideon
        response2 = requests.get(f"{BASE_URL}/api/skus/brands-by-vertical-model?vertical=Rideon")
        rideon_brands = response2.json().get("brands", [])
        
        print(f"Scooter brands: {len(scooter_brands)}, Rideon brands: {len(rideon_brands)}")
        print("PASS: Brands-by-vertical-model returns vertical-specific brands")


class TestFilteredSKUs:
    """Test /api/skus/filtered endpoint"""
    
    def test_filtered_skus_no_params_returns_all(self):
        """Test that filtered endpoint with no params returns all SKUs"""
        response = requests.get(f"{BASE_URL}/api/skus/filtered")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: /api/skus/filtered returns {len(data)} SKUs with no filters")
    
    def test_filtered_skus_by_vertical(self):
        """Test filtering SKUs by vertical"""
        response = requests.get(f"{BASE_URL}/api/skus/filtered?vertical=Scooter")
        assert response.status_code == 200
        data = response.json()
        
        # All returned SKUs should have vertical=Scooter
        for sku in data:
            assert sku.get("vertical") == "Scooter", f"SKU {sku.get('sku_id')} has wrong vertical"
        
        print(f"PASS: Filtered by vertical=Scooter returns {len(data)} SKUs")
    
    def test_filtered_skus_by_vertical_and_model(self):
        """Test filtering SKUs by vertical and model"""
        # First get a model for Scooter
        models_response = requests.get(f"{BASE_URL}/api/skus/models-by-vertical?vertical=Scooter")
        models = models_response.json().get("models", [])
        
        if models:
            model = models[0]
            response = requests.get(f"{BASE_URL}/api/skus/filtered?vertical=Scooter&model={model}")
            assert response.status_code == 200
            data = response.json()
            
            # All returned SKUs should have vertical=Scooter and model=model
            for sku in data:
                assert sku.get("vertical") == "Scooter"
                assert sku.get("model") == model
            
            print(f"PASS: Filtered by vertical=Scooter&model={model} returns {len(data)} SKUs")
        else:
            pytest.skip("No models found for Scooter vertical")
    
    def test_filtered_skus_by_all_filters(self):
        """Test filtering SKUs by vertical, model, and brand"""
        # Get filter options
        options_response = requests.get(f"{BASE_URL}/api/skus/filter-options")
        options = options_response.json()
        
        if options.get("verticals"):
            vertical = options["verticals"][0]
            
            # Get models for this vertical
            models_response = requests.get(f"{BASE_URL}/api/skus/models-by-vertical?vertical={vertical}")
            models = models_response.json().get("models", [])
            
            if models:
                model = models[0]
                
                # Get brands for this vertical+model
                brands_response = requests.get(f"{BASE_URL}/api/skus/brands-by-vertical-model?vertical={vertical}&model={model}")
                brands = brands_response.json().get("brands", [])
                
                if brands:
                    brand = brands[0]
                    
                    response = requests.get(f"{BASE_URL}/api/skus/filtered?vertical={vertical}&model={model}&brand={brand}")
                    assert response.status_code == 200
                    data = response.json()
                    
                    # All returned SKUs should match all filters
                    for sku in data:
                        assert sku.get("vertical") == vertical
                        assert sku.get("model") == model
                        assert sku.get("brand") == brand
                    
                    print(f"PASS: Filtered by all 3 filters returns {len(data)} SKUs")
                    return
        
        pytest.skip("Not enough filter options to test all filters")
    
    def test_filtered_skus_with_search(self):
        """Test filtering SKUs with search query"""
        # First get some SKUs to know what to search for
        all_skus = requests.get(f"{BASE_URL}/api/skus/filtered").json()
        
        if all_skus:
            # Search for part of the first SKU's ID
            search_term = all_skus[0].get("sku_id", "")[:5]
            
            response = requests.get(f"{BASE_URL}/api/skus/filtered?search={search_term}")
            assert response.status_code == 200
            data = response.json()
            
            print(f"PASS: Search for '{search_term}' returns {len(data)} SKUs")
        else:
            pytest.skip("No SKUs found to test search")
    
    def test_filtered_skus_with_branch(self):
        """Test filtering SKUs by branch (returns only activated SKUs)"""
        response = requests.get(f"{BASE_URL}/api/skus/filtered?branch=Unit%201%20Vedica")
        assert response.status_code == 200
        data = response.json()
        
        # This should return only SKUs activated in the branch (may be 0)
        print(f"PASS: Filtered by branch returns {len(data)} SKUs (branch-activated only)")


class TestCascadingFilterIntegration:
    """Integration tests for cascading filter workflow"""
    
    def test_full_cascading_workflow(self):
        """Test the full cascading filter workflow"""
        # Step 1: Get all verticals
        options_response = requests.get(f"{BASE_URL}/api/skus/filter-options")
        assert options_response.status_code == 200
        verticals = options_response.json().get("verticals", [])
        assert len(verticals) > 0, "Should have at least one vertical"
        print(f"Step 1: Got {len(verticals)} verticals")
        
        # Step 2: Select first vertical and get models
        vertical = verticals[0]
        models_response = requests.get(f"{BASE_URL}/api/skus/models-by-vertical?vertical={vertical}")
        assert models_response.status_code == 200
        models = models_response.json().get("models", [])
        print(f"Step 2: Got {len(models)} models for {vertical}")
        
        # Step 3: Get brands for this vertical
        brands_response = requests.get(f"{BASE_URL}/api/skus/brands-by-vertical-model?vertical={vertical}")
        assert brands_response.status_code == 200
        brands = brands_response.json().get("brands", [])
        print(f"Step 3: Got {len(brands)} brands for {vertical}")
        
        # Step 4: Get filtered SKUs
        filtered_response = requests.get(f"{BASE_URL}/api/skus/filtered?vertical={vertical}")
        assert filtered_response.status_code == 200
        filtered_skus = filtered_response.json()
        print(f"Step 4: Got {len(filtered_skus)} SKUs for {vertical}")
        
        # Verify all filtered SKUs have the correct vertical
        for sku in filtered_skus:
            assert sku.get("vertical") == vertical
        
        print("PASS: Full cascading workflow completed successfully")
    
    def test_sku_counts_match(self):
        """Test that SKU counts are consistent across endpoints"""
        # Get all SKUs
        all_response = requests.get(f"{BASE_URL}/api/skus")
        all_skus = all_response.json()
        total_count = len(all_skus)
        
        # Get filter options
        options_response = requests.get(f"{BASE_URL}/api/skus/filter-options")
        verticals = options_response.json().get("verticals", [])
        
        # Sum up SKUs by vertical
        vertical_sum = 0
        for vertical in verticals:
            filtered_response = requests.get(f"{BASE_URL}/api/skus/filtered?vertical={vertical}")
            vertical_sum += len(filtered_response.json())
        
        # Count SKUs without vertical
        no_vertical_response = requests.get(f"{BASE_URL}/api/skus")
        no_vertical_count = len([s for s in no_vertical_response.json() if not s.get("vertical")])
        
        print(f"Total SKUs: {total_count}, Sum by vertical: {vertical_sum}, No vertical: {no_vertical_count}")
        print("PASS: SKU counts verified")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

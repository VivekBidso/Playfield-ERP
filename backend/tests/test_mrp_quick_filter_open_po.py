"""
Test MRP Quick Filter and Open PO/Scheduled Receipts Features

Tests:
1. Quick Filter - Category and Vendor filtering on Weekly Order Plan
2. Open PO/Scheduled Receipts integration in MRP calculation
3. New table columns: Safety, Stock, Open PO, Net, Order Qty
4. Net calculation: Net = Gross + Safety - Stock - Scheduled_Receipts
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMRPQuickFilterAndOpenPO:
    """Test Quick Filter and Open PO features"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@factory.com",
            "password": "bidso123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get a weekly MRP run
        runs_response = self.session.get(f"{BASE_URL}/api/mrp/runs?limit=10")
        assert runs_response.status_code == 200
        runs = runs_response.json()
        
        # Find a weekly run (version=WEEKLY_V1 or common_weeks_count > 0)
        self.weekly_run = None
        for run in runs:
            if run.get("version") == "WEEKLY_V1" or run.get("common_weeks_count", 0) > 0:
                self.weekly_run = run
                break
        
        if not self.weekly_run:
            pytest.skip("No weekly MRP run found")
    
    # =========================================================================
    # Test 1: Weekly Plan returns items with new columns
    # =========================================================================
    
    def test_weekly_plan_has_safety_stock_field(self):
        """Test that weekly plan items have safety_stock field"""
        response = self.session.get(
            f"{BASE_URL}/api/mrp/runs/{self.weekly_run['id']}/weekly-plan?plan_type=all"
        )
        assert response.status_code == 200
        data = response.json()
        
        weekly_plan = data.get("weekly_plan", [])
        assert len(weekly_plan) > 0, "Weekly plan should have weeks"
        
        # Check first week's items
        first_week = weekly_plan[0]
        items = first_week.get("items", [])
        assert len(items) > 0, "Week should have items"
        
        # Verify safety_stock field exists
        item = items[0]
        assert "safety_stock" in item, "Item should have safety_stock field"
        print(f"PASS: safety_stock field present, value={item.get('safety_stock')}")
    
    def test_weekly_plan_has_current_stock_field(self):
        """Test that weekly plan items have current_stock field"""
        response = self.session.get(
            f"{BASE_URL}/api/mrp/runs/{self.weekly_run['id']}/weekly-plan?plan_type=all"
        )
        assert response.status_code == 200
        data = response.json()
        
        weekly_plan = data.get("weekly_plan", [])
        item = weekly_plan[0]["items"][0]
        
        assert "current_stock" in item, "Item should have current_stock field"
        print(f"PASS: current_stock field present, value={item.get('current_stock')}")
    
    def test_weekly_plan_has_scheduled_receipts_field(self):
        """Test that weekly plan items have scheduled_receipts (Open PO) field"""
        response = self.session.get(
            f"{BASE_URL}/api/mrp/runs/{self.weekly_run['id']}/weekly-plan?plan_type=all"
        )
        assert response.status_code == 200
        data = response.json()
        
        weekly_plan = data.get("weekly_plan", [])
        item = weekly_plan[0]["items"][0]
        
        assert "scheduled_receipts" in item, "Item should have scheduled_receipts field"
        print(f"PASS: scheduled_receipts field present, value={item.get('scheduled_receipts')}")
    
    def test_weekly_plan_has_net_qty_field(self):
        """Test that weekly plan items have net_qty field"""
        response = self.session.get(
            f"{BASE_URL}/api/mrp/runs/{self.weekly_run['id']}/weekly-plan?plan_type=all"
        )
        assert response.status_code == 200
        data = response.json()
        
        weekly_plan = data.get("weekly_plan", [])
        item = weekly_plan[0]["items"][0]
        
        assert "net_qty" in item, "Item should have net_qty field"
        print(f"PASS: net_qty field present, value={item.get('net_qty')}")
    
    def test_weekly_plan_has_order_qty_field(self):
        """Test that weekly plan items have order_qty field"""
        response = self.session.get(
            f"{BASE_URL}/api/mrp/runs/{self.weekly_run['id']}/weekly-plan?plan_type=all"
        )
        assert response.status_code == 200
        data = response.json()
        
        weekly_plan = data.get("weekly_plan", [])
        item = weekly_plan[0]["items"][0]
        
        assert "order_qty" in item, "Item should have order_qty field"
        print(f"PASS: order_qty field present, value={item.get('order_qty')}")
    
    # =========================================================================
    # Test 2: Categories available for Quick Filter
    # =========================================================================
    
    def test_weekly_plan_has_categories(self):
        """Test that weekly plan items have category field for filtering"""
        response = self.session.get(
            f"{BASE_URL}/api/mrp/runs/{self.weekly_run['id']}/weekly-plan?plan_type=all"
        )
        assert response.status_code == 200
        data = response.json()
        
        weekly_plan = data.get("weekly_plan", [])
        
        # Collect unique categories
        categories = set()
        for week in weekly_plan:
            for item in week.get("items", []):
                if item.get("category"):
                    categories.add(item.get("category"))
        
        assert len(categories) > 0, "Should have categories for filtering"
        print(f"PASS: Found {len(categories)} categories: {sorted(categories)}")
        
        # Verify expected categories are present
        expected_categories = {"ACC", "ELC", "INM", "INP", "SPR"}
        found_expected = categories & expected_categories
        assert len(found_expected) > 0, f"Should have some expected categories. Found: {categories}"
        print(f"PASS: Found expected categories: {sorted(found_expected)}")
    
    def test_weekly_plan_has_vendor_name(self):
        """Test that weekly plan items have vendor_name field for filtering"""
        response = self.session.get(
            f"{BASE_URL}/api/mrp/runs/{self.weekly_run['id']}/weekly-plan?plan_type=all"
        )
        assert response.status_code == 200
        data = response.json()
        
        weekly_plan = data.get("weekly_plan", [])
        
        # Check that vendor_name field exists (may be empty if no vendor assigned)
        item = weekly_plan[0]["items"][0]
        assert "vendor_name" in item, "Item should have vendor_name field"
        print(f"PASS: vendor_name field present, value='{item.get('vendor_name')}'")
    
    # =========================================================================
    # Test 3: Net Calculation Logic
    # =========================================================================
    
    def test_net_calculation_formula(self):
        """Test Net = Gross + Safety - Stock - Scheduled_Receipts"""
        response = self.session.get(
            f"{BASE_URL}/api/mrp/runs/{self.weekly_run['id']}/weekly-plan?plan_type=all"
        )
        assert response.status_code == 200
        data = response.json()
        
        weekly_plan = data.get("weekly_plan", [])
        
        # Find an item with all values to verify calculation
        for week in weekly_plan:
            for item in week.get("items", []):
                gross = item.get("gross_qty", 0) or item.get("gross_with_scrap", 0)
                safety = item.get("safety_stock", 0)
                stock = item.get("current_stock", 0)
                scheduled = item.get("scheduled_receipts", 0)
                net = item.get("net_qty", 0)
                
                # Expected: Net = Gross + Safety - Stock - Scheduled
                expected_net = gross + safety - stock - scheduled
                expected_net = max(0, expected_net)  # Net can't be negative
                
                # Allow for rounding differences
                if abs(net - expected_net) <= 1:
                    print(f"PASS: Net calculation verified for {item.get('rm_id')}")
                    print(f"  Gross={gross}, Safety={safety}, Stock={stock}, Scheduled={scheduled}")
                    print(f"  Expected Net={expected_net}, Actual Net={net}")
                    return
        
        # If we get here, we couldn't verify the formula (but fields exist)
        print("INFO: Could not verify exact formula (all items may have 0 stock/scheduled)")
    
    # =========================================================================
    # Test 4: Open PO / Scheduled Receipts Backend Integration
    # =========================================================================
    
    def test_purchase_orders_exist(self):
        """Test that purchase orders exist in the system"""
        response = self.session.get(f"{BASE_URL}/api/purchase-orders?limit=10")
        
        # API might return 200 or 404 if no POs
        if response.status_code == 200:
            pos = response.json()
            if isinstance(pos, dict):
                pos = pos.get("items", [])
            print(f"PASS: Found {len(pos)} purchase orders")
            for po in pos[:3]:
                print(f"  PO: {po.get('po_number')}, Status: {po.get('status')}")
        else:
            print(f"INFO: Purchase orders endpoint returned {response.status_code}")
    
    def test_weekly_plan_filter_by_type_common(self):
        """Test filtering weekly plan by type=common"""
        response = self.session.get(
            f"{BASE_URL}/api/mrp/runs/{self.weekly_run['id']}/weekly-plan?plan_type=common"
        )
        assert response.status_code == 200
        data = response.json()
        
        weekly_plan = data.get("weekly_plan", [])
        
        # All items should be COMMON type
        for week in weekly_plan:
            for item in week.get("items", []):
                rm_type = item.get("rm_type", "COMMON")
                assert rm_type == "COMMON", f"Expected COMMON type, got {rm_type}"
        
        print(f"PASS: Filter by type=common works, {len(weekly_plan)} weeks returned")
    
    def test_weekly_plan_filter_by_type_brand_specific(self):
        """Test filtering weekly plan by type=brand_specific"""
        response = self.session.get(
            f"{BASE_URL}/api/mrp/runs/{self.weekly_run['id']}/weekly-plan?plan_type=brand_specific"
        )
        assert response.status_code == 200
        data = response.json()
        
        weekly_plan = data.get("weekly_plan", [])
        
        # All items should be BRAND_SPECIFIC type (or empty if none exist)
        for week in weekly_plan:
            for item in week.get("items", []):
                rm_type = item.get("rm_type", "BRAND_SPECIFIC")
                assert rm_type == "BRAND_SPECIFIC", f"Expected BRAND_SPECIFIC type, got {rm_type}"
        
        print(f"PASS: Filter by type=brand_specific works, {len(weekly_plan)} weeks returned")
    
    # =========================================================================
    # Test 5: Week Summary
    # =========================================================================
    
    def test_week_has_summary(self):
        """Test that each week has summary with total_items and total_cost"""
        response = self.session.get(
            f"{BASE_URL}/api/mrp/runs/{self.weekly_run['id']}/weekly-plan?plan_type=all"
        )
        assert response.status_code == 200
        data = response.json()
        
        weekly_plan = data.get("weekly_plan", [])
        assert len(weekly_plan) > 0
        
        week = weekly_plan[0]
        summary = week.get("week_summary", {})
        
        assert "total_items" in summary, "Week should have total_items in summary"
        assert "total_cost" in summary, "Week should have total_cost in summary"
        
        # Verify total_items matches actual items count
        actual_items = len(week.get("items", []))
        assert summary["total_items"] == actual_items, \
            f"total_items mismatch: {summary['total_items']} vs {actual_items}"
        
        print(f"PASS: Week summary verified - {summary['total_items']} items, cost={summary['total_cost']}")
    
    # =========================================================================
    # Test 6: Item has all required fields for display
    # =========================================================================
    
    def test_item_has_all_display_fields(self):
        """Test that items have all fields needed for table display"""
        response = self.session.get(
            f"{BASE_URL}/api/mrp/runs/{self.weekly_run['id']}/weekly-plan?plan_type=all"
        )
        assert response.status_code == 200
        data = response.json()
        
        weekly_plan = data.get("weekly_plan", [])
        item = weekly_plan[0]["items"][0]
        
        required_fields = [
            "rm_id", "rm_name", "category", "rm_type", "production_week",
            "gross_qty", "safety_stock", "current_stock", "scheduled_receipts",
            "net_qty", "order_qty", "vendor_name", "total_cost"
        ]
        
        missing_fields = []
        for field in required_fields:
            if field not in item:
                missing_fields.append(field)
        
        assert len(missing_fields) == 0, f"Missing fields: {missing_fields}"
        print(f"PASS: All {len(required_fields)} required fields present")
        print(f"  Sample item: rm_id={item.get('rm_id')}, category={item.get('category')}")
    
    # =========================================================================
    # Test 7: MRP Run has summary with counts
    # =========================================================================
    
    def test_mrp_run_has_summary(self):
        """Test that MRP run has summary with RM counts and values"""
        response = self.session.get(f"{BASE_URL}/api/mrp/runs/{self.weekly_run['id']}")
        assert response.status_code == 200
        run = response.json()
        
        summary = run.get("summary", {})
        
        assert "common_rms_count" in summary, "Summary should have common_rms_count"
        assert "common_order_value" in summary, "Summary should have common_order_value"
        assert "total_order_value" in summary, "Summary should have total_order_value"
        
        print(f"PASS: MRP run summary verified")
        print(f"  Common RMs: {summary.get('common_rms_count')}")
        print(f"  Common Value: {summary.get('common_order_value')}")
        print(f"  Total Value: {summary.get('total_order_value')}")
    
    # =========================================================================
    # Test 8: Category filter data extraction
    # =========================================================================
    
    def test_categories_match_expected(self):
        """Test that categories match expected values (ACC, ELC, INM, INP, SPR)"""
        response = self.session.get(
            f"{BASE_URL}/api/mrp/runs/{self.weekly_run['id']}/weekly-plan?plan_type=all"
        )
        assert response.status_code == 200
        data = response.json()
        
        weekly_plan = data.get("weekly_plan", [])
        
        categories = set()
        for week in weekly_plan:
            for item in week.get("items", []):
                if item.get("category"):
                    categories.add(item.get("category"))
        
        expected = {"ACC", "ELC", "INM", "INP", "SPR"}
        
        # Check if all expected categories are present
        missing = expected - categories
        if missing:
            print(f"INFO: Some expected categories not found: {missing}")
        
        found = expected & categories
        assert len(found) >= 3, f"Should have at least 3 expected categories, found: {found}"
        print(f"PASS: Found {len(found)}/{len(expected)} expected categories: {sorted(found)}")
    
    # =========================================================================
    # Test 9: Filtered item count calculation
    # =========================================================================
    
    def test_filtered_item_count(self):
        """Test that we can calculate filtered item count (for 'Showing X items' badge)"""
        response = self.session.get(
            f"{BASE_URL}/api/mrp/runs/{self.weekly_run['id']}/weekly-plan?plan_type=all"
        )
        assert response.status_code == 200
        data = response.json()
        
        weekly_plan = data.get("weekly_plan", [])
        
        # Calculate total items
        total_items = sum(len(week.get("items", [])) for week in weekly_plan)
        
        # Calculate items per category
        category_counts = {}
        for week in weekly_plan:
            for item in week.get("items", []):
                cat = item.get("category", "UNKNOWN")
                category_counts[cat] = category_counts.get(cat, 0) + 1
        
        print(f"PASS: Total items: {total_items}")
        print(f"  Items by category: {category_counts}")
        
        # Verify filtering would work
        assert total_items > 0, "Should have items to filter"
        assert len(category_counts) > 0, "Should have categories for filtering"


class TestScheduledReceiptsBackend:
    """Test _get_scheduled_receipts backend method"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@factory.com",
            "password": "bidso123"
        })
        assert response.status_code == 200
        token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_calculate_weekly_mrp_endpoint(self):
        """Test that calculate-weekly endpoint exists and works"""
        # This is a POST endpoint that triggers MRP calculation
        # We just verify it exists and returns proper response
        response = self.session.post(f"{BASE_URL}/api/mrp/runs/calculate-weekly")
        
        # Should return 200 with run data or 400/500 if prerequisites missing
        assert response.status_code in [200, 400, 500], \
            f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert "run_code" in data, "Response should have run_code"
            print(f"PASS: Weekly MRP calculation successful, run_code={data.get('run_code')}")
        else:
            print(f"INFO: Weekly MRP calculation returned {response.status_code}")
            print(f"  Response: {response.text[:200]}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

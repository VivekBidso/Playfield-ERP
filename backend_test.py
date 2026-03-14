import requests
import sys
import json
from datetime import datetime, timezone
import io
import openpyxl

class FactoryManagementTester:
    def __init__(self, base_url="https://mrp-system-3.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_data = {}

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'} if not files else {}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files)
                else:
                    response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_raw_materials_module(self):
        """Test Raw Materials CRUD operations"""
        print("\n" + "="*50)
        print("TESTING RAW MATERIALS MODULE")
        print("="*50)
        
        # Test create raw material
        rm_data = {
            "rm_id": "RM001",
            "name": "Steel Sheets",
            "unit": "kg",
            "low_stock_threshold": 50.0
        }
        success, response = self.run_test(
            "Create Raw Material RM001",
            "POST",
            "raw-materials",
            200,
            data=rm_data
        )
        if success:
            self.test_data['rm001'] = response

        # Test create another raw material
        rm_data2 = {
            "rm_id": "RM002", 
            "name": "Aluminum Rods",
            "unit": "pieces",
            "low_stock_threshold": 20.0
        }
        success, response = self.run_test(
            "Create Raw Material RM002",
            "POST",
            "raw-materials",
            200,
            data=rm_data2
        )
        if success:
            self.test_data['rm002'] = response

        # Test duplicate RM ID (should fail)
        self.run_test(
            "Create Duplicate RM ID (should fail)",
            "POST",
            "raw-materials",
            400,
            data=rm_data
        )

        # Test get all raw materials
        self.run_test(
            "Get All Raw Materials",
            "GET",
            "raw-materials",
            200
        )

        # Test get specific raw material
        self.run_test(
            "Get Specific Raw Material RM001",
            "GET",
            "raw-materials/RM001",
            200
        )

        # Test search raw materials
        self.run_test(
            "Search Raw Materials",
            "GET",
            "raw-materials?search=Steel",
            200
        )

    def test_purchase_entries(self):
        """Test Purchase Entry operations"""
        print("\n" + "="*50)
        print("TESTING PURCHASE ENTRIES")
        print("="*50)

        # Add purchase entry for RM001
        purchase_data = {
            "rm_id": "RM001",
            "quantity": 100.0,
            "date": datetime.now(timezone.utc).isoformat(),
            "notes": "Initial stock purchase"
        }
        self.run_test(
            "Add Purchase Entry for RM001",
            "POST",
            "purchase-entries",
            200,
            data=purchase_data
        )

        # Add purchase entry for RM002
        purchase_data2 = {
            "rm_id": "RM002",
            "quantity": 100.0,
            "date": datetime.now(timezone.utc).isoformat(),
            "notes": "Initial stock purchase"
        }
        self.run_test(
            "Add Purchase Entry for RM002",
            "POST",
            "purchase-entries",
            200,
            data=purchase_data2
        )

        # Test get all purchase entries
        self.run_test(
            "Get All Purchase Entries",
            "GET",
            "purchase-entries",
            200
        )

        # Test get purchase entries for specific RM
        self.run_test(
            "Get Purchase Entries for RM001",
            "GET",
            "purchase-entries?rm_id=RM001",
            200
        )

    def test_sku_module(self):
        """Test SKU CRUD operations"""
        print("\n" + "="*50)
        print("TESTING SKU MODULE")
        print("="*50)

        # Test create SKU
        sku_data = {
            "sku_id": "SKU001",
            "name": "Metal Widget",
            "description": "High quality metal widget",
            "low_stock_threshold": 10.0
        }
        success, response = self.run_test(
            "Create SKU SKU001",
            "POST",
            "skus",
            200,
            data=sku_data
        )
        if success:
            self.test_data['sku001'] = response

        # Test duplicate SKU ID (should fail)
        self.run_test(
            "Create Duplicate SKU ID (should fail)",
            "POST",
            "skus",
            400,
            data=sku_data
        )

        # Test get all SKUs
        self.run_test(
            "Get All SKUs",
            "GET",
            "skus",
            200
        )

        # Test get specific SKU
        self.run_test(
            "Get Specific SKU SKU001",
            "GET",
            "skus/SKU001",
            200
        )

        # Test update SKU
        updated_sku_data = {
            "sku_id": "SKU001",
            "name": "Premium Metal Widget",
            "description": "Premium quality metal widget",
            "low_stock_threshold": 15.0
        }
        self.run_test(
            "Update SKU SKU001",
            "PUT",
            "skus/SKU001",
            200,
            data=updated_sku_data
        )

        # Test search SKUs
        self.run_test(
            "Search SKUs",
            "GET",
            "skus?search=Widget",
            200
        )

    def test_sku_mapping_module(self):
        """Test SKU Mapping operations"""
        print("\n" + "="*50)
        print("TESTING SKU MAPPING MODULE")
        print("="*50)

        # Test create SKU mapping
        mapping_data = {
            "sku_id": "SKU001",
            "rm_mappings": [
                {"rm_id": "RM001", "quantity_required": 2.0},
                {"rm_id": "RM002", "quantity_required": 3.0}
            ]
        }
        success, response = self.run_test(
            "Create SKU Mapping for SKU001",
            "POST",
            "sku-mappings",
            200,
            data=mapping_data
        )
        if success:
            self.test_data['mapping001'] = response

        # Test get specific mapping
        self.run_test(
            "Get SKU Mapping for SKU001",
            "GET",
            "sku-mappings/SKU001",
            200
        )

        # Test get all mappings
        self.run_test(
            "Get All SKU Mappings",
            "GET",
            "sku-mappings",
            200
        )

        # Test mapping with non-existent RM (should fail)
        invalid_mapping = {
            "sku_id": "SKU001",
            "rm_mappings": [
                {"rm_id": "RM999", "quantity_required": 1.0}
            ]
        }
        self.run_test(
            "Create Mapping with Invalid RM (should fail)",
            "POST",
            "sku-mappings",
            404,
            data=invalid_mapping
        )

    def test_production_module(self):
        """Test Production Entry operations"""
        print("\n" + "="*50)
        print("TESTING PRODUCTION MODULE")
        print("="*50)

        # Test production entry
        production_data = {
            "sku_id": "SKU001",
            "quantity": 5.0,
            "date": datetime.now(timezone.utc).isoformat(),
            "notes": "Test production run"
        }
        success, response = self.run_test(
            "Add Production Entry for SKU001 (5 units)",
            "POST",
            "production-entries",
            200,
            data=production_data
        )
        if success:
            self.test_data['production001'] = response

        # Test get all production entries
        self.run_test(
            "Get All Production Entries",
            "GET",
            "production-entries",
            200
        )

        # Test get production entries for specific SKU
        self.run_test(
            "Get Production Entries for SKU001",
            "GET",
            "production-entries?sku_id=SKU001",
            200
        )

        # Test production with insufficient stock (should fail)
        large_production = {
            "sku_id": "SKU001",
            "quantity": 100.0,  # This should exceed available RM stock
            "date": datetime.now(timezone.utc).isoformat(),
            "notes": "Large production run"
        }
        self.run_test(
            "Production with Insufficient Stock (should fail)",
            "POST",
            "production-entries",
            400,
            data=large_production
        )

    def test_dispatch_module(self):
        """Test Dispatch Entry operations"""
        print("\n" + "="*50)
        print("TESTING DISPATCH MODULE")
        print("="*50)

        # Test dispatch entry
        dispatch_data = {
            "sku_id": "SKU001",
            "quantity": 2.0,
            "date": datetime.now(timezone.utc).isoformat(),
            "notes": "Test dispatch"
        }
        success, response = self.run_test(
            "Add Dispatch Entry for SKU001 (2 units)",
            "POST",
            "dispatch-entries",
            200,
            data=dispatch_data
        )
        if success:
            self.test_data['dispatch001'] = response

        # Test get all dispatch entries
        self.run_test(
            "Get All Dispatch Entries",
            "GET",
            "dispatch-entries",
            200
        )

        # Test get dispatch entries for specific SKU
        self.run_test(
            "Get Dispatch Entries for SKU001",
            "GET",
            "dispatch-entries?sku_id=SKU001",
            200
        )

        # Test dispatch with insufficient SKU stock (should fail)
        large_dispatch = {
            "sku_id": "SKU001",
            "quantity": 100.0,  # This should exceed available SKU stock
            "date": datetime.now(timezone.utc).isoformat(),
            "notes": "Large dispatch"
        }
        self.run_test(
            "Dispatch with Insufficient Stock (should fail)",
            "POST",
            "dispatch-entries",
            400,
            data=large_dispatch
        )

    def test_reports_module(self):
        """Test Reports operations"""
        print("\n" + "="*50)
        print("TESTING REPORTS MODULE")
        print("="*50)

        # Test dashboard stats
        self.run_test(
            "Get Dashboard Stats",
            "GET",
            "dashboard/stats",
            200
        )

        # Test inventory report
        self.run_test(
            "Get Inventory Report",
            "GET",
            "reports/inventory",
            200
        )

        # Test low stock report
        self.run_test(
            "Get Low Stock Report",
            "GET",
            "reports/low-stock",
            200
        )

        # Test production summary report
        self.run_test(
            "Get Production Summary Report",
            "GET",
            "reports/production-summary",
            200
        )

        # Test production summary with custom days
        self.run_test(
            "Get Production Summary (30 days)",
            "GET",
            "reports/production-summary?days=30",
            200
        )

    def test_bulk_upload(self):
        """Test bulk upload functionality"""
        print("\n" + "="*50)
        print("TESTING BULK UPLOAD")
        print("="*50)

        # Create a test Excel file
        workbook = openpyxl.Workbook()
        sheet = workbook.active
        sheet['A1'] = 'RM_ID'
        sheet['B1'] = 'Name'
        sheet['C1'] = 'Unit'
        sheet['D1'] = 'Threshold'
        
        # Add test data
        sheet['A2'] = 'RM003'
        sheet['B2'] = 'Copper Wire'
        sheet['C2'] = 'meters'
        sheet['D2'] = 25.0
        
        sheet['A3'] = 'RM004'
        sheet['B3'] = 'Plastic Sheets'
        sheet['C3'] = 'sheets'
        sheet['D3'] = 15.0

        # Save to bytes
        excel_buffer = io.BytesIO()
        workbook.save(excel_buffer)
        excel_buffer.seek(0)

        # Test bulk upload
        files = {'file': ('test_materials.xlsx', excel_buffer.getvalue(), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
        self.run_test(
            "Bulk Upload Raw Materials",
            "POST",
            "raw-materials/bulk-upload",
            200,
            files=files
        )

    def test_delete_operations(self):
        """Test delete operations"""
        print("\n" + "="*50)
        print("TESTING DELETE OPERATIONS")
        print("="*50)

        # Test delete SKU
        self.run_test(
            "Delete SKU SKU001",
            "DELETE",
            "skus/SKU001",
            200
        )

        # Test delete raw materials
        self.run_test(
            "Delete Raw Material RM001",
            "DELETE",
            "raw-materials/RM001",
            200
        )

        self.run_test(
            "Delete Raw Material RM002",
            "DELETE",
            "raw-materials/RM002",
            200
        )

        # Test delete non-existent item (should fail)
        self.run_test(
            "Delete Non-existent RM (should fail)",
            "DELETE",
            "raw-materials/RM999",
            404
        )

    def run_complete_flow_test(self):
        """Run the complete flow test as specified in requirements"""
        print("\n" + "="*80)
        print("RUNNING COMPLETE FLOW TEST (Scenario 1)")
        print("="*80)

        # Step 1: Add 2 raw materials
        print("\n--- Step 1: Add Raw Materials ---")
        self.test_raw_materials_module()

        # Step 2: Add purchase entries
        print("\n--- Step 2: Add Purchase Entries ---")
        self.test_purchase_entries()

        # Step 3: Create SKU
        print("\n--- Step 3: Create SKU ---")
        self.test_sku_module()

        # Step 4: Map SKU to RMs
        print("\n--- Step 4: Create SKU Mapping ---")
        self.test_sku_mapping_module()

        # Step 5: Add production entry
        print("\n--- Step 5: Add Production Entry ---")
        self.test_production_module()

        # Step 6: Add dispatch entry
        print("\n--- Step 6: Add Dispatch Entry ---")
        self.test_dispatch_module()

        # Step 7: Check reports and dashboard
        print("\n--- Step 7: Check Reports and Dashboard ---")
        self.test_reports_module()

        # Step 8: Test bulk upload
        print("\n--- Step 8: Test Bulk Upload ---")
        self.test_bulk_upload()

        # Step 9: Test delete operations
        print("\n--- Step 9: Test Delete Operations ---")
        self.test_delete_operations()

def main():
    print("🏭 Factory Management System - Backend API Testing")
    print("=" * 60)
    
    tester = FactoryManagementTester()
    
    try:
        # Run complete flow test
        tester.run_complete_flow_test()
        
        # Print final results
        print("\n" + "="*60)
        print("📊 FINAL TEST RESULTS")
        print("="*60)
        print(f"Tests Run: {tester.tests_run}")
        print(f"Tests Passed: {tester.tests_passed}")
        print(f"Tests Failed: {tester.tests_run - tester.tests_passed}")
        print(f"Success Rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
        
        if tester.tests_passed == tester.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print("⚠️  Some tests failed. Check the output above for details.")
            return 1
            
    except Exception as e:
        print(f"💥 Critical error during testing: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
import { useState, useEffect } from "react";
import axios from "axios";
import { Package, Box, AlertTriangle, TrendingUp, Filter, Download } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const MasterDashboard = () => {
  const [masterData, setMasterData] = useState(null);
  const [selectedBranchFilter, setSelectedBranchFilter] = useState("all");
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    fetchMasterData();
  }, []);

  const fetchMasterData = async () => {
    try {
      const response = await axios.get(`${API}/reports/master-dashboard`);
      setMasterData(response.data);
    } catch (error) {
      console.error('Error fetching master dashboard data:', error);
    }
  };

  // Bulk Download Functions
  const downloadAllRMs = async () => {
    setDownloading('rm');
    try {
      const response = await axios.get(`${API}/raw-materials`);
      const data = response.data.map(rm => ({
        'RM ID': rm.rm_id,
        'Category': rm.category,
        'Type': rm.category_data?.type || '',
        'Model': rm.category_data?.model || rm.category_data?.model_name || '',
        'Part Name': rm.category_data?.part_name || '',
        'Colour': rm.category_data?.colour || '',
        'Brand': rm.category_data?.brand || '',
        'Specs': rm.category_data?.specs || '',
        'Unit': rm.category_data?.unit || '',
        'Per Unit Weight': rm.category_data?.per_unit_weight || '',
        'Safety Stock': rm.low_stock_threshold || 10
      }));
      
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Raw Materials');
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'all_raw_materials.xlsx');
      toast.success(`Exported ${data.length} raw materials`);
    } catch (error) {
      toast.error("Failed to download raw materials");
    } finally {
      setDownloading(null);
    }
  };

  const downloadAllSKUs = async () => {
    setDownloading('sku');
    try {
      const response = await axios.get(`${API}/skus`);
      const data = response.data.map(sku => ({
        'SKU ID': sku.sku_id,
        'Buyer SKU ID': sku.buyer_sku_id || '',
        'BIDSO SKU': sku.bidso_sku || '',
        'Description': sku.description || '',
        'Vertical': sku.vertical || '',
        'Model': sku.model || '',
        'Brand': sku.brand || '',
        'Low Stock Threshold': sku.low_stock_threshold || 5
      }));
      
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'SKUs');
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'all_skus.xlsx');
      toast.success(`Exported ${data.length} SKUs`);
    } catch (error) {
      toast.error("Failed to download SKUs");
    } finally {
      setDownloading(null);
    }
  };

  const downloadBranchInventory = async () => {
    setDownloading('inventory');
    try {
      const branches = Object.keys(masterData.by_branch);
      const wb = XLSX.utils.book_new();
      
      for (const branch of branches) {
        // Get RM inventory for branch
        const rmResponse = await axios.get(`${API}/raw-materials?branch=${encodeURIComponent(branch)}`);
        const rmData = rmResponse.data.map(rm => ({
          'RM ID': rm.rm_id,
          'Category': rm.category,
          'Current Stock': rm.current_stock || 0,
          'Safety Stock': rm.low_stock_threshold || 10
        }));
        
        // Get SKU inventory for branch
        const skuResponse = await axios.get(`${API}/skus?branch=${encodeURIComponent(branch)}`);
        const skuData = skuResponse.data.map(sku => ({
          'SKU ID': sku.sku_id,
          'Vertical': sku.vertical || '',
          'Model': sku.model || '',
          'Brand': sku.brand || '',
          'Current Stock': sku.current_stock || 0
        }));
        
        // Create sheets for this branch (max 31 char sheet name)
        const branchShortName = branch.substring(0, 15);
        if (rmData.length > 0) {
          const rmWs = XLSX.utils.json_to_sheet(rmData);
          XLSX.utils.book_append_sheet(wb, rmWs, `${branchShortName} RM`);
        }
        if (skuData.length > 0) {
          const skuWs = XLSX.utils.json_to_sheet(skuData);
          XLSX.utils.book_append_sheet(wb, skuWs, `${branchShortName} SKU`);
        }
      }
      
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'branch_inventory.xlsx');
      toast.success(`Exported inventory for ${branches.length} branches`);
    } catch (error) {
      toast.error("Failed to download branch inventory");
    } finally {
      setDownloading(null);
    }
  };

  const downloadVendorRMPricing = async () => {
    setDownloading('vendor');
    try {
      const response = await axios.get(`${API}/vendor-rm-prices/comparison`);
      const data = response.data.map(item => ({
        'RM ID': item.rm_id,
        'Category': item.category || '',
        'Vendor Count': item.vendor_count,
        'Lowest Price': item.lowest_price,
        'Lowest Price Vendor': item.lowest_price_vendor,
        'All Vendors': item.vendors?.map(v => `${v.vendor_id}:₹${v.price}`).join(', ') || ''
      }));
      
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Vendor RM Pricing');
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'vendor_rm_pricing.xlsx');
      toast.success(`Exported ${data.length} RM price comparisons`);
    } catch (error) {
      toast.error("Failed to download vendor pricing");
    } finally {
      setDownloading(null);
    }
  };

  if (!masterData) {
    return <div className="p-8">Loading...</div>;
  }

  const overallStats = masterData.overall;
  const branchStats = masterData.by_branch;
  
  const displayStats = selectedBranchFilter === "all" 
    ? overallStats 
    : branchStats[selectedBranchFilter];

  const statCards = [
    { label: "Total Raw Materials", value: displayStats.total_rm_value, icon: Package, color: "text-zinc-700" },
    { label: "Total SKUs", value: displayStats.total_sku_value, icon: Box, color: "text-zinc-700" },
    { label: "Low Stock Items", value: displayStats.low_stock_items, icon: AlertTriangle, color: "text-red-600" },
    { label: "Today's Production", value: displayStats.today_production, icon: TrendingUp, color: "text-primary" },
  ];

  return (
    <div className="p-6 md:p-8" data-testid="master-dashboard-page">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight uppercase">Master Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">Admin overview across all branches</p>
        </div>
        <div className="flex items-center gap-3">
          <Filter className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
          <select
            value={selectedBranchFilter}
            onChange={(e) => setSelectedBranchFilter(e.target.value)}
            className="border border-border rounded-sm px-4 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
            data-testid="branch-filter"
          >
            <option value="all">All Branches</option>
            {Object.keys(branchStats).map((branch) => (
              <option key={branch} value={branch}>{branch}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-border border border-border mb-8">
        {statCards.map((stat, idx) => (
          <div key={idx} className="bg-white p-6" data-testid={`master-stat-card-${idx}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">
                  {stat.label}
                </div>
                <div className={`text-4xl font-black font-mono ${stat.color}`}>
                  {stat.value}
                </div>
              </div>
              <stat.icon className={`w-8 h-8 ${stat.color}`} strokeWidth={1.5} />
            </div>
          </div>
        ))}
      </div>

      {/* Branch Breakdown */}
      <div className="border border-border bg-white rounded-sm">
        <div className="p-6 border-b border-border">
          <h2 className="text-lg font-bold uppercase tracking-tight">Branch Breakdown</h2>
        </div>
        <div className="p-6">
          <Tabs defaultValue="overview">
            <TabsList className="mb-6">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
              <TabsTrigger value="production">Production</TabsTrigger>
              <TabsTrigger value="alerts">Alerts</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-zinc-50 border-b border-zinc-200">
                    <tr>
                      <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Branch</th>
                      <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Raw Materials</th>
                      <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">SKUs</th>
                      <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Low Stock</th>
                      <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Today Prod</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(branchStats).map(([branch, stats]) => (
                      <tr key={branch} className="border-b border-zinc-100 hover:bg-zinc-50/50">
                        <td className="p-4 align-middle font-mono text-sm font-bold text-zinc-700">{branch}</td>
                        <td className="p-4 align-middle font-mono text-zinc-700">{stats.total_rm_value}</td>
                        <td className="p-4 align-middle font-mono text-zinc-700">{stats.total_sku_value}</td>
                        <td className="p-4 align-middle">
                          {stats.low_stock_items > 0 ? (
                            <span className="text-xs font-mono text-red-600 border border-red-600 px-2 py-1 uppercase tracking-wider">
                              {stats.low_stock_items}
                            </span>
                          ) : (
                            <span className="text-xs font-mono text-green-600 border border-green-600 px-2 py-1 uppercase tracking-wider">
                              OK
                            </span>
                          )}
                        </td>
                        <td className="p-4 align-middle font-mono text-primary font-bold">{stats.today_production}</td>
                      </tr>
                    ))}
                    <tr className="bg-zinc-100 font-bold">
                      <td className="p-4 align-middle font-mono text-sm uppercase">Total</td>
                      <td className="p-4 align-middle font-mono text-zinc-900">{overallStats.total_rm_value}</td>
                      <td className="p-4 align-middle font-mono text-zinc-900">{overallStats.total_sku_value}</td>
                      <td className="p-4 align-middle font-mono text-red-600">{overallStats.low_stock_items}</td>
                      <td className="p-4 align-middle font-mono text-primary">{overallStats.today_production}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="inventory">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(branchStats).map(([branch, stats]) => (
                  <div key={branch} className="border border-border rounded-sm p-4 hover:bg-zinc-50">
                    <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">
                      {branch}
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-zinc-600">RM:</span>
                        <span className="font-mono text-sm font-bold">{stats.total_rm_value}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-zinc-600">SKU:</span>
                        <span className="font-mono text-sm font-bold">{stats.total_sku_value}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="production">
              <div className="space-y-4">
                {Object.entries(branchStats)
                  .filter(([_, stats]) => stats.today_production > 0)
                  .sort((a, b) => b[1].today_production - a[1].today_production)
                  .map(([branch, stats]) => (
                    <div key={branch} className="flex items-center justify-between p-4 border border-border rounded-sm">
                      <div>
                        <div className="font-mono text-sm font-bold text-zinc-700">{branch}</div>
                        <div className="text-xs text-muted-foreground mt-1">Today's Production</div>
                      </div>
                      <div className="text-2xl font-black font-mono text-primary">{stats.today_production}</div>
                    </div>
                  ))}
                {Object.values(branchStats).every(stats => stats.today_production === 0) && (
                  <div className="text-center text-muted-foreground font-mono text-sm py-8">
                    No production recorded today across any branch
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="alerts">
              <div className="space-y-4">
                {Object.entries(branchStats)
                  .filter(([_, stats]) => stats.low_stock_items > 0)
                  .sort((a, b) => b[1].low_stock_items - a[1].low_stock_items)
                  .map(([branch, stats]) => (
                    <div key={branch} className="flex items-center justify-between p-4 border border-red-200 bg-red-50 rounded-sm">
                      <div>
                        <div className="font-mono text-sm font-bold text-red-900">{branch}</div>
                        <div className="text-xs text-red-700 mt-1">Low Stock Items</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-600" strokeWidth={1.5} />
                        <div className="text-2xl font-black font-mono text-red-600">{stats.low_stock_items}</div>
                      </div>
                    </div>
                  ))}
                {Object.values(branchStats).every(stats => stats.low_stock_items === 0) && (
                  <div className="text-center text-green-600 font-mono text-sm py-8">
                    All branches have adequate stock levels
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default MasterDashboard;

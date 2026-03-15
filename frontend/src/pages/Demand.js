import { useState, useEffect, useRef } from "react";
import axios from "axios";
import useAuthStore from "@/store/authStore";
import { Plus, TrendingUp, Upload, Download, ChevronDown, ChevronUp, DollarSign, Layers, FileSpreadsheet, X, CheckSquare, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Demand = () => {
  const { token, hasRole } = useAuthStore();
  const [activeTab, setActiveTab] = useState("forecasts");
  const fileInputRef = useRef(null);
  
  // Data
  const [forecasts, setForecasts] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [skus, setSkus] = useState([]);
  const [verticals, setVerticals] = useState([]);
  const [models, setModels] = useState([]);
  const [brands, setBrands] = useState([]);
  const [skuBomMap, setSkuBomMap] = useState({});
  const [expandedSku, setExpandedSku] = useState(null);
  
  // Selection state for bulk confirmation
  const [selectedForecasts, setSelectedForecasts] = useState(new Set());
  const [expandedForecast, setExpandedForecast] = useState(null);
  
  // Check if user can confirm forecasts
  const canConfirmForecasts = hasRole && (hasRole('MASTER_ADMIN') || hasRole('DEMAND_PLANNER'));
  
  // Dialogs
  const [showForecastDialog, setShowForecastDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadPreview, setUploadPreview] = useState([]);
  const [uploading, setUploading] = useState(false);
  
  // Cascading filter state for forecast form
  const [forecastForm, setForecastForm] = useState({
    buyer_id: "",
    vertical_id: "",
    model_id: "",
    brand_id: "",
    sku_id: "",
    forecast_month: new Date().toISOString().slice(0, 7),
    quantity: 0,
    priority: "MEDIUM",
    notes: ""
  });

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const [forecastsRes, buyersRes, skusRes, verticalsRes, modelsRes, brandsRes] = await Promise.all([
        axios.get(`${API}/forecasts`, { headers }),
        axios.get(`${API}/buyers`, { headers }),
        axios.get(`${API}/skus`, { headers }),
        axios.get(`${API}/verticals`, { headers }),
        axios.get(`${API}/models`, { headers }),
        axios.get(`${API}/brands`, { headers })
      ]);
      
      setForecasts(forecastsRes.data);
      setBuyers(buyersRes.data);
      setSkus(skusRes.data);
      setVerticals(verticalsRes.data);
      setModels(modelsRes.data);
      setBrands(brandsRes.data);
      
      // Fetch BOM data for SKUs
      await fetchBomData(skusRes.data, headers);
      
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast.error("Failed to fetch data");
    }
  };

  const fetchBomData = async (skuList, headers) => {
    try {
      const bomRes = await axios.get(`${API}/bill-of-materials`, { headers });
      const rmRes = await axios.get(`${API}/raw-materials`, { headers });
      
      let priceMap = {};
      try {
        const priceRes = await axios.get(`${API}/vendor-rm-prices/comparison`, { headers });
        priceRes.data?.forEach(p => { 
          if (!priceMap[p.rm_id] || p.lowest_price < priceMap[p.rm_id]) {
            priceMap[p.rm_id] = p.lowest_price;
          }
        });
      } catch (e) {
        console.log("No price data available");
      }
      
      const rmMap = {};
      rmRes.data.forEach(rm => { rmMap[rm.rm_id] = rm; });
      
      const bomMap = {};
      bomRes.data.forEach(bom => {
        if (!bomMap[bom.sku_id]) {
          bomMap[bom.sku_id] = { items: [], totalCost: 0 };
        }
        const rm = rmMap[bom.rm_id] || {};
        const price = priceMap[bom.rm_id] || 0;
        const itemCost = price * (bom.quantity || 0);
        
        bomMap[bom.sku_id].items.push({
          rm_id: bom.rm_id,
          rm_name: rm.category_data?.type || rm.category || bom.rm_id,
          quantity: bom.quantity,
          unit_price: price,
          item_cost: itemCost
        });
        bomMap[bom.sku_id].totalCost += itemCost;
      });
      
      setSkuBomMap(bomMap);
    } catch (error) {
      console.error("Failed to fetch BOM data:", error);
    }
  };

  // Cascading filter logic
  const getFilteredVerticals = () => {
    // Filter verticals based on buyer if buyer has associated verticals
    return verticals;
  };

  const getFilteredModels = () => {
    if (!forecastForm.vertical_id) return models;
    return models.filter(m => m.vertical_id === forecastForm.vertical_id);
  };

  const getFilteredBrands = () => {
    if (!forecastForm.model_id) return brands;
    return brands.filter(b => b.model_id === forecastForm.model_id);
  };

  const getFilteredSkus = () => {
    let filtered = skus;
    
    if (forecastForm.vertical_id) {
      const verticalName = verticals.find(v => v.id === forecastForm.vertical_id)?.name;
      filtered = filtered.filter(s => 
        s.vertical_id === forecastForm.vertical_id || 
        s.vertical === verticalName
      );
    }
    
    if (forecastForm.model_id) {
      const modelName = models.find(m => m.id === forecastForm.model_id)?.name;
      filtered = filtered.filter(s => 
        s.model_id === forecastForm.model_id || 
        s.model === modelName
      );
    }
    
    if (forecastForm.brand_id) {
      const brandName = brands.find(b => b.id === forecastForm.brand_id)?.name;
      filtered = filtered.filter(s => 
        s.brand_id === forecastForm.brand_id || 
        s.brand === brandName
      );
    }
    
    return filtered;
  };

  const handleCreateForecast = async () => {
    // Validate buyer is required
    if (!forecastForm.buyer_id) {
      toast.error("Buyer is required for creating a forecast");
      return;
    }
    
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const payload = {
        buyer_id: forecastForm.buyer_id,  // REQUIRED
        forecast_month: new Date(forecastForm.forecast_month + "-01").toISOString(),
        quantity: forecastForm.quantity,
        priority: forecastForm.priority,
        notes: forecastForm.notes || ""
      };
      
      if (forecastForm.vertical_id) payload.vertical_id = forecastForm.vertical_id;
      if (forecastForm.sku_id) payload.sku_id = forecastForm.sku_id;
      
      await axios.post(`${API}/forecasts`, payload, { headers });
      toast.success("Forecast created");
      setShowForecastDialog(false);
      resetForecastForm();
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create forecast");
    }
  };

  const resetForecastForm = () => {
    setForecastForm({
      buyer_id: "",
      vertical_id: "",
      model_id: "",
      brand_id: "",
      sku_id: "",
      forecast_month: new Date().toISOString().slice(0, 7),
      quantity: 0,
      priority: "MEDIUM",
      notes: ""
    });
  };

  const handleConfirmForecast = async (id) => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.put(`${API}/forecasts/${id}/confirm`, {}, { headers });
      toast.success("Forecast confirmed");
      fetchAllData();
    } catch (error) {
      toast.error("Failed to confirm forecast");
    }
  };

  // Bulk confirmation handlers
  const handleSelectForecast = (id) => {
    const newSelected = new Set(selectedForecasts);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedForecasts(newSelected);
  };

  const handleSelectAllDraft = () => {
    const draftIds = forecasts.filter(f => f.status === 'DRAFT').map(f => f.id);
    if (selectedForecasts.size === draftIds.length) {
      setSelectedForecasts(new Set());
    } else {
      setSelectedForecasts(new Set(draftIds));
    }
  };

  const handleBulkConfirm = async () => {
    if (selectedForecasts.size === 0) {
      toast.error("No forecasts selected");
      return;
    }
    
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.post(
        `${API}/forecasts/bulk-confirm`,
        { forecast_ids: Array.from(selectedForecasts) },
        { headers }
      );
      toast.success(`Confirmed ${response.data.confirmed_count} forecasts`);
      setSelectedForecasts(new Set());
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to confirm forecasts");
    }
  };

  const handleConfirmMonth = async (month) => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.post(
        `${API}/forecasts/confirm-month?month=${month}`,
        {},
        { headers }
      );
      toast.success(`Confirmed ${response.data.confirmed_count} forecasts for ${month}`);
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to confirm month forecasts");
    }
  };

  // Get dispatch lots for a forecast
  const fetchForecastDispatchLots = async (forecastId) => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${API}/forecasts/${forecastId}/dispatch-lots`, { headers });
      return response.data;
    } catch (error) {
      console.error("Failed to fetch dispatch lots:", error);
      return [];
    }
  };

  // Bulk upload handlers
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error("Please upload an Excel file (.xlsx or .xls)");
      return;
    }
    
    parseExcelFile(file);
  };

  const parseExcelFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.post(`${API}/forecasts/parse-excel`, formData, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' }
      });
      
      setUploadPreview(response.data.forecasts || []);
      setShowUploadDialog(true);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to parse Excel file");
    }
  };

  const handleBulkUpload = async () => {
    if (uploadPreview.length === 0) {
      toast.error("No data to upload");
      return;
    }
    
    setUploading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      let successCount = 0;
      let errorCount = 0;
      
      for (const row of uploadPreview) {
        try {
          await axios.post(`${API}/forecasts`, {
            forecast_month: new Date(row.month + "-01").toISOString(),
            vertical_id: row.vertical_id,
            sku_id: row.sku_id,
            quantity: row.quantity,
            priority: "MEDIUM"
          }, { headers });
          successCount++;
        } catch (e) {
          errorCount++;
        }
      }
      
      toast.success(`Uploaded ${successCount} forecasts. ${errorCount > 0 ? `${errorCount} failed.` : ''}`);
      setShowUploadDialog(false);
      setUploadPreview([]);
      fetchAllData();
    } catch (error) {
      toast.error("Bulk upload failed");
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    const headers = ['Month', 'Vertical', 'Model', 'Brand', 'SKU', 'Qty'];
    const sampleData = [
      ['2026-03', 'Scooter', 'KS', 'BE', 'FC_KS_BE_115', '1000'],
      ['2026-03', 'Rideon', 'SR', 'BB', 'BB_SC_SR_016', '500']
    ];
    
    let csv = headers.join(',') + '\n';
    sampleData.forEach(row => {
      csv += row.join(',') + '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'forecast_template.csv';
    a.click();
  };

  const getBuyerName = (id) => buyers.find(b => b.id === id)?.name || id || '-';
  const getVerticalName = (id) => verticals.find(v => v.id === id)?.name || id || '-';
  const getSkuDescription = (skuId) => skus.find(s => s.sku_id === skuId)?.description || skuId;

  const getStatusColor = (status) => {
    const colors = {
      'DRAFT': 'bg-zinc-100 text-zinc-700 border-zinc-300',
      'CONFIRMED': 'bg-blue-100 text-blue-700 border-blue-300',
      'CONVERTED': 'bg-green-100 text-green-700 border-green-300'
    };
    return colors[status] || 'bg-zinc-100 text-zinc-700 border-zinc-300';
  };

  return (
    <div className="p-6 md:p-8" data-testid="demand-page">
      <div className="mb-8">
        <h1 className="text-4xl font-black tracking-tight uppercase">Demand Forecasts</h1>
        <p className="text-sm text-muted-foreground mt-1 font-mono">Forecast entry, BOM costing & bulk upload</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="forecasts" className="uppercase text-xs tracking-wide">
            <TrendingUp className="w-4 h-4 mr-2" />
            Forecasts
          </TabsTrigger>
          <TabsTrigger value="sku-bom" className="uppercase text-xs tracking-wide">
            <Layers className="w-4 h-4 mr-2" />
            SKU BOM & Cost
          </TabsTrigger>
        </TabsList>

        {/* Forecasts Tab */}
        <TabsContent value="forecasts">
          <div className="flex justify-between items-center mb-4 gap-4">
            <h2 className="text-lg font-bold">Demand Forecasts</h2>
            <div className="flex gap-2">
              <Button variant="outline" onClick={downloadTemplate} className="text-xs">
                <Download className="w-4 h-4 mr-2" />
                Template
              </Button>
              <Button 
                variant="outline" 
                onClick={() => fileInputRef.current?.click()}
                className="text-xs"
              >
                <Upload className="w-4 h-4 mr-2" />
                Bulk Upload
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Dialog open={showForecastDialog} onOpenChange={setShowForecastDialog}>
                <DialogTrigger asChild>
                  <Button className="uppercase text-xs tracking-wide" data-testid="add-forecast-btn">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Forecast
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Create Forecast</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                    {/* Buyer */}
                    <div>
                      <Label>Buyer</Label>
                      <Select 
                        value={forecastForm.buyer_id || "_none"} 
                        onValueChange={(v) => setForecastForm({...forecastForm, buyer_id: v === "_none" ? "" : v})}
                      >
                        <SelectTrigger><SelectValue placeholder="Select buyer (optional)" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">All Buyers</SelectItem>
                          {buyers.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Vertical */}
                    <div>
                      <Label>Vertical *</Label>
                      <Select 
                        value={forecastForm.vertical_id || "_none"} 
                        onValueChange={(v) => setForecastForm({
                          ...forecastForm, 
                          vertical_id: v === "_none" ? "" : v,
                          model_id: "",
                          brand_id: "",
                          sku_id: ""
                        })}
                      >
                        <SelectTrigger><SelectValue placeholder="Select vertical" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">All Verticals</SelectItem>
                          {getFilteredVerticals().map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Model - cascaded from Vertical */}
                    <div>
                      <Label>Model</Label>
                      <Select 
                        value={forecastForm.model_id || "_none"} 
                        onValueChange={(v) => setForecastForm({
                          ...forecastForm, 
                          model_id: v === "_none" ? "" : v,
                          brand_id: "",
                          sku_id: ""
                        })}
                      >
                        <SelectTrigger><SelectValue placeholder="Select model (optional)" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">All Models</SelectItem>
                          {getFilteredModels().map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Brand - cascaded from Model */}
                    <div>
                      <Label>Brand</Label>
                      <Select 
                        value={forecastForm.brand_id || "_none"} 
                        onValueChange={(v) => setForecastForm({
                          ...forecastForm, 
                          brand_id: v === "_none" ? "" : v,
                          sku_id: ""
                        })}
                      >
                        <SelectTrigger><SelectValue placeholder="Select brand (optional)" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">All Brands</SelectItem>
                          {getFilteredBrands().map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* SKU - filtered by above selections */}
                    <div>
                      <Label>SKU (Optional - for SKU-level forecast)</Label>
                      <Select 
                        value={forecastForm.sku_id || "_all"} 
                        onValueChange={(v) => setForecastForm({...forecastForm, sku_id: v === "_all" ? "" : v})}
                      >
                        <SelectTrigger><SelectValue placeholder="All filtered SKUs" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_all">All SKUs (Vertical-level forecast)</SelectItem>
                          {getFilteredSkus().slice(0, 200).map(s => (
                            <SelectItem key={s.sku_id} value={s.sku_id}>
                              {s.sku_id} - {s.description?.slice(0, 25)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-zinc-500 mt-1">
                        {getFilteredSkus().length} SKUs match current filters
                      </p>
                    </div>

                    {/* Forecast Month */}
                    <div>
                      <Label>Forecast Month *</Label>
                      <Input 
                        type="month" 
                        value={forecastForm.forecast_month}
                        onChange={(e) => setForecastForm({...forecastForm, forecast_month: e.target.value})}
                      />
                    </div>

                    {/* Quantity */}
                    <div>
                      <Label>Quantity *</Label>
                      <Input 
                        type="number"
                        value={forecastForm.quantity}
                        onChange={(e) => setForecastForm({...forecastForm, quantity: parseInt(e.target.value) || 0})}
                      />
                    </div>

                    {/* Priority */}
                    <div>
                      <Label>Priority</Label>
                      <Select value={forecastForm.priority} onValueChange={(v) => setForecastForm({...forecastForm, priority: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LOW">Low</SelectItem>
                          <SelectItem value="MEDIUM">Medium</SelectItem>
                          <SelectItem value="HIGH">High</SelectItem>
                          <SelectItem value="CRITICAL">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button onClick={handleCreateForecast} className="w-full">Create Forecast</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          
          {/* Forecasts Table */}
          <div className="border rounded-sm overflow-x-auto bg-white">
            <table className="w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Code</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Month</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Buyer</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Vertical</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">SKU</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Quantity</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Priority</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Status</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {forecasts.map((f) => (
                  <tr key={f.id} className="border-t hover:bg-zinc-50/50">
                    <td className="p-4 font-mono font-bold text-sm">{f.forecast_code}</td>
                    <td className="p-4 font-mono text-sm">{f.forecast_month?.slice(0, 7)}</td>
                    <td className="p-4 text-sm">{getBuyerName(f.buyer_id)}</td>
                    <td className="p-4 text-sm">{getVerticalName(f.vertical_id)}</td>
                    <td className="p-4 font-mono text-sm text-zinc-600">{f.sku_id || 'All in Vertical'}</td>
                    <td className="p-4 font-mono font-bold">{f.quantity?.toLocaleString()}</td>
                    <td className="p-4">
                      <span className={`text-xs font-mono px-2 py-1 rounded border ${
                        f.priority === 'CRITICAL' ? 'bg-red-100 text-red-700 border-red-300' :
                        f.priority === 'HIGH' ? 'bg-orange-100 text-orange-700 border-orange-300' :
                        f.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
                        'bg-zinc-100 border-zinc-300'
                      }`}>{f.priority}</span>
                    </td>
                    <td className="p-4">
                      <span className={`text-xs font-mono px-2 py-1 rounded border ${getStatusColor(f.status)}`}>{f.status}</span>
                    </td>
                    <td className="p-4">
                      {f.status === 'DRAFT' && (
                        <Button size="sm" variant="outline" onClick={() => handleConfirmForecast(f.id)}>
                          Confirm
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {forecasts.length === 0 && (
                  <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No forecasts yet. Create one to get started.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* SKU BOM & Cost Tab */}
        <TabsContent value="sku-bom">
          <div className="mb-4">
            <h2 className="text-lg font-bold">SKU BOM Breakdown & Cost</h2>
            <p className="text-xs text-zinc-500 font-mono mt-1">View RM mapping and total BOM cost for each SKU</p>
          </div>
          
          <div className="border rounded-sm overflow-hidden bg-white">
            <table className="w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase w-8"></th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">SKU ID</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Description</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Vertical</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">RM Count</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">BOM Cost (₹)</th>
                </tr>
              </thead>
              <tbody>
                {skus.slice(0, 100).map((sku) => {
                  const bom = skuBomMap[sku.sku_id];
                  const isExpanded = expandedSku === sku.sku_id;
                  
                  return (
                    <>
                      <tr 
                        key={sku.sku_id} 
                        className={`border-t cursor-pointer hover:bg-zinc-50 ${isExpanded ? 'bg-zinc-50' : ''}`}
                        onClick={() => setExpandedSku(isExpanded ? null : sku.sku_id)}
                      >
                        <td className="p-4">
                          {bom?.items?.length > 0 && (
                            isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                          )}
                        </td>
                        <td className="p-4 font-mono font-bold text-sm">{sku.sku_id}</td>
                        <td className="p-4 text-sm text-zinc-600">{sku.description?.slice(0, 40)}</td>
                        <td className="p-4 text-sm">{sku.vertical}</td>
                        <td className="p-4 font-mono">{bom?.items?.length || 0}</td>
                        <td className="p-4">
                          {bom?.totalCost > 0 ? (
                            <span className="font-mono font-bold text-green-700">
                              ₹{bom.totalCost.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-xs text-zinc-400 font-mono">No cost data</span>
                          )}
                        </td>
                      </tr>
                      {isExpanded && bom?.items?.length > 0 && (
                        <tr key={`${sku.sku_id}-bom`}>
                          <td colSpan={6} className="p-0">
                            <div className="bg-zinc-100 p-4 border-t">
                              <h4 className="text-xs uppercase font-bold mb-2 text-zinc-600">BOM Details</h4>
                              <table className="w-full">
                                <thead>
                                  <tr className="text-xs font-mono text-zinc-500 uppercase">
                                    <th className="text-left py-2 px-3">RM ID</th>
                                    <th className="text-left py-2 px-3">Type</th>
                                    <th className="text-right py-2 px-3">Qty</th>
                                    <th className="text-right py-2 px-3">Unit Price</th>
                                    <th className="text-right py-2 px-3">Cost</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {bom.items.map((item, idx) => (
                                    <tr key={idx} className="border-t border-zinc-200">
                                      <td className="py-2 px-3 font-mono text-sm">{item.rm_id}</td>
                                      <td className="py-2 px-3 text-sm text-zinc-600">{item.rm_name}</td>
                                      <td className="py-2 px-3 font-mono text-right">{item.quantity}</td>
                                      <td className="py-2 px-3 font-mono text-right">
                                        {item.unit_price > 0 ? `₹${item.unit_price.toFixed(2)}` : '-'}
                                      </td>
                                      <td className="py-2 px-3 font-mono text-right font-bold">
                                        {item.item_cost > 0 ? `₹${item.item_cost.toFixed(2)}` : '-'}
                                      </td>
                                    </tr>
                                  ))}
                                  <tr className="border-t-2 border-zinc-300 bg-zinc-200">
                                    <td colSpan={4} className="py-2 px-3 text-right font-bold text-sm uppercase">Total BOM Cost</td>
                                    <td className="py-2 px-3 font-mono text-right font-bold text-green-700">
                                      ₹{bom.totalCost.toFixed(2)}
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Bulk Upload Preview Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Bulk Upload Preview
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-zinc-600">
              {uploadPreview.length} forecasts parsed from file. Review and confirm upload.
            </p>
            
            <div className="border rounded-sm max-h-60 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 sticky top-0">
                  <tr>
                    <th className="p-2 text-left font-mono text-xs">Month</th>
                    <th className="p-2 text-left font-mono text-xs">Vertical</th>
                    <th className="p-2 text-left font-mono text-xs">Model</th>
                    <th className="p-2 text-left font-mono text-xs">Brand</th>
                    <th className="p-2 text-left font-mono text-xs">SKU</th>
                    <th className="p-2 text-left font-mono text-xs">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {uploadPreview.map((row, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-2 font-mono">{row.month}</td>
                      <td className="p-2">{row.vertical}</td>
                      <td className="p-2">{row.model}</td>
                      <td className="p-2">{row.brand}</td>
                      <td className="p-2 font-mono">{row.sku_id}</td>
                      <td className="p-2 font-mono font-bold">{row.quantity?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowUploadDialog(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleBulkUpload} disabled={uploading} className="flex-1">
                {uploading ? 'Uploading...' : `Upload ${uploadPreview.length} Forecasts`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Demand;

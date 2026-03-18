import { useState, useEffect, useRef } from "react";
import axios from "axios";
import useAuthStore from "@/store/authStore";
import { Plus, TrendingUp, Upload, Download, ChevronDown, ChevronUp, DollarSign, Layers, FileSpreadsheet, X, CheckSquare, Package, Pencil, Trash2 } from "lucide-react";
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
  
  // Dispatch Lots popup state
  const [showLotsDialog, setShowLotsDialog] = useState(false);
  const [selectedForecastLots, setSelectedForecastLots] = useState({ forecast: null, lots: [] });
  const [buyerExistingLots, setBuyerExistingLots] = useState([]);
  const [addToLotQty, setAddToLotQty] = useState(0);
  const [selectedLotForAdd, setSelectedLotForAdd] = useState("");
  const [addingToLot, setAddingToLot] = useState(false);
  
  // Check if user can confirm forecasts - ONLY MASTER_ADMIN can confirm
  const canConfirmForecasts = hasRole && hasRole('MASTER_ADMIN');
  
  // Check if user can create/edit forecasts
  const canEditForecasts = hasRole && (hasRole('MASTER_ADMIN') || hasRole('DEMAND_PLANNER'));
  
  // Dialogs
  const [showForecastDialog, setShowForecastDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadPreview, setUploadPreview] = useState([]);
  const [uploadErrors, setUploadErrors] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [downloadingErrors, setDownloadingErrors] = useState(false);
  
  // Cascading filter state for forecast form
  const [forecastForm, setForecastForm] = useState({
    id: null, // null for new forecast, set for edit
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
    // Get brands from multiple sources
    let filteredBrands = [...brands];
    
    // If a vertical is selected, get brands from SKUs in that vertical
    if (forecastForm.vertical_id) {
      const verticalName = verticals.find(v => v.id === forecastForm.vertical_id)?.name;
      const skusInVertical = skus.filter(s => 
        s.vertical_id === forecastForm.vertical_id || s.vertical === verticalName
      );
      
      // Get unique brand names from these SKUs
      const brandNamesFromSkus = [...new Set(skusInVertical.map(s => s.brand).filter(Boolean))];
      
      // Match with brands collection or create virtual brands
      filteredBrands = brands.filter(b => brandNamesFromSkus.includes(b.name));
      
      // If no brands found in collection, create from SKU brand names
      if (filteredBrands.length === 0) {
        filteredBrands = brandNamesFromSkus.map(name => ({
          id: name,
          name: name
        }));
      }
    }
    
    // If model is selected, further filter by model
    if (forecastForm.model_id) {
      const modelName = models.find(m => m.id === forecastForm.model_id)?.name;
      const skusInModel = skus.filter(s => 
        s.model_id === forecastForm.model_id || s.model === modelName
      );
      
      const brandNamesFromSkus = [...new Set(skusInModel.map(s => s.brand).filter(Boolean))];
      filteredBrands = filteredBrands.filter(b => brandNamesFromSkus.includes(b.name));
      
      // If no brands found, create from SKU brand names
      if (filteredBrands.length === 0) {
        filteredBrands = brandNamesFromSkus.map(name => ({
          id: name,
          name: name
        }));
      }
    }
    
    return filteredBrands;
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
      
      // Validate quantity
      if (forecastForm.quantity <= 0) {
        toast.error("Quantity must be greater than 0");
        return;
      }
      
      const payload = {
        buyer_id: forecastForm.buyer_id,  // REQUIRED
        forecast_month: new Date(forecastForm.forecast_month + "-01").toISOString(),
        quantity: forecastForm.quantity,
        priority: forecastForm.priority,
        notes: forecastForm.notes || ""
      };
      
      if (forecastForm.vertical_id) payload.vertical_id = forecastForm.vertical_id;
      if (forecastForm.sku_id) payload.sku_id = forecastForm.sku_id;
      
      if (forecastForm.id) {
        // Update existing forecast
        await axios.put(`${API}/forecasts/${forecastForm.id}`, payload, { headers });
        toast.success("Forecast updated");
      } else {
        // Create new forecast
        await axios.post(`${API}/forecasts`, payload, { headers });
        toast.success("Forecast created");
      }
      
      setShowForecastDialog(false);
      resetForecastForm();
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save forecast");
    }
  };

  const resetForecastForm = () => {
    setForecastForm({
      id: null,
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

  // Edit forecast - open dialog with existing data
  const handleEditForecast = (forecast) => {
    setForecastForm({
      buyer_id: forecast.buyer_id || "",
      vertical_id: forecast.vertical_id || "",
      model_id: "",
      brand_id: "",
      sku_id: forecast.sku_id || "",
      forecast_month: forecast.forecast_month ? 
        (typeof forecast.forecast_month === 'string' ? forecast.forecast_month.slice(0, 7) : forecast.forecast_month.toISOString().slice(0, 7)) 
        : new Date().toISOString().slice(0, 7),
      quantity: forecast.quantity || 0,
      priority: forecast.priority || "MEDIUM",
      notes: forecast.notes || "",
      // Store ID for update
      id: forecast.id
    });
    setShowForecastDialog(true);
  };

  // Delete forecast
  const handleDeleteForecast = async (id) => {
    if (!window.confirm("Are you sure you want to delete this forecast?")) {
      return;
    }
    
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.delete(`${API}/forecasts/${id}`, { headers });
      toast.success("Forecast deleted");
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete forecast");
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
      setUploadErrors(response.data.errors || []);
      setShowUploadDialog(true);
      
      if (response.data.error_count > 0) {
        toast.warning(`${response.data.error_count} rows have errors and will be skipped`);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to parse Excel file");
    }
  };

  const handleBulkUpload = async () => {
    if (uploadPreview.length === 0) {
      toast.error("No valid data to upload");
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
            brand_id: row.brand_id,
            model_id: row.model_id,
            sku_id: row.sku_id,
            quantity: row.quantity,
            buyer_id: row.buyer_id || undefined,
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
      setUploadErrors([]);
      fetchAllData();
    } catch (error) {
      toast.error("Bulk upload failed");
    } finally {
      setUploading(false);
    }
  };

  const downloadErrorReport = async () => {
    if (uploadErrors.length === 0) return;
    
    setDownloadingErrors(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.post(
        `${API}/forecasts/generate-error-report`,
        uploadErrors,
        { 
          headers: { ...headers, 'Content-Type': 'application/json' },
          responseType: 'blob'
        }
      );
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'forecast_upload_errors.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success("Error report downloaded");
    } catch (error) {
      toast.error("Failed to download error report");
    } finally {
      setDownloadingErrors(false);
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
  
  // Helper function to get auth headers
  const getHeaders = () => token ? { Authorization: `Bearer ${token}` } : {};
  
  // Get vertical name - from forecast's vertical_id or from SKU's vertical
  const getVerticalDisplay = (forecast) => {
    if (forecast.vertical_id) {
      const v = verticals.find(v => v.id === forecast.vertical_id);
      if (v) return v.name;
    }
    // Fallback to SKU's vertical
    if (forecast.sku_id) {
      const sku = skus.find(s => s.sku_id === forecast.sku_id);
      if (sku?.vertical) return sku.vertical;
      if (sku?.vertical_id) {
        const v = verticals.find(v => v.id === sku.vertical_id);
        if (v) return v.name;
      }
    }
    return '-';
  };
  
  // Get brand name from SKU
  const getBrandDisplay = (forecast) => {
    if (forecast.sku_id) {
      const sku = skus.find(s => s.sku_id === forecast.sku_id);
      if (sku?.brand) return sku.brand;
    }
    return '-';
  };
  
  // Get model name from SKU
  const getModelDisplay = (forecast) => {
    if (forecast.sku_id) {
      const sku = skus.find(s => s.sku_id === forecast.sku_id);
      if (sku?.model) return sku.model;
    }
    return '-';
  };

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
              <Dialog open={showForecastDialog} onOpenChange={(open) => { setShowForecastDialog(open); if (!open) resetForecastForm(); }}>
                <DialogTrigger asChild>
                  <Button className="uppercase text-xs tracking-wide" data-testid="add-forecast-btn">
                    <Plus className="w-4 h-4 mr-2" />
                    New Forecast
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{forecastForm.id ? 'Edit Forecast' : 'Create Forecast'}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                    {/* Buyer - REQUIRED */}
                    <div>
                      <Label>Buyer *</Label>
                      <Select 
                        value={forecastForm.buyer_id || "_none"} 
                        onValueChange={(v) => setForecastForm({...forecastForm, buyer_id: v === "_none" ? "" : v})}
                      >
                        <SelectTrigger className={!forecastForm.buyer_id ? "border-red-300" : ""}>
                          <SelectValue placeholder="Select buyer (required)" />
                        </SelectTrigger>
                        <SelectContent>
                          {buyers.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {!forecastForm.buyer_id && (
                        <p className="text-xs text-red-500 mt-1">Buyer is required</p>
                      )}
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
                      <Label>Quantity * (must be greater than 0)</Label>
                      <Input 
                        type="number"
                        min="1"
                        value={forecastForm.quantity}
                        onChange={(e) => setForecastForm({...forecastForm, quantity: parseInt(e.target.value) || 0})}
                        className={forecastForm.quantity <= 0 ? "border-red-300" : ""}
                      />
                      {forecastForm.quantity <= 0 && (
                        <p className="text-xs text-red-500 mt-1">Quantity must be greater than 0</p>
                      )}
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

                    <Button 
                      onClick={handleCreateForecast} 
                      className="w-full"
                      disabled={forecastForm.quantity <= 0 || !forecastForm.buyer_id}
                    >
                      {forecastForm.id ? 'Update Forecast' : 'Create Forecast'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          
          {/* Bulk Confirmation Bar */}
          {canConfirmForecasts && forecasts.filter(f => f.status === 'DRAFT').length > 0 && (
            <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4">
              <div className="flex items-center gap-4">
                <input
                  type="checkbox"
                  checked={selectedForecasts.size === forecasts.filter(f => f.status === 'DRAFT').length && selectedForecasts.size > 0}
                  onChange={handleSelectAllDraft}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">
                  {selectedForecasts.size > 0 
                    ? `${selectedForecasts.size} forecast(s) selected`
                    : `${forecasts.filter(f => f.status === 'DRAFT').length} draft forecast(s) pending confirmation`
                  }
                </span>
              </div>
              <div className="flex gap-2">
                {selectedForecasts.size > 0 && (
                  <Button onClick={handleBulkConfirm} size="sm" className="bg-blue-600 hover:bg-blue-700">
                    <CheckSquare className="w-4 h-4 mr-2" />
                    Confirm Selected ({selectedForecasts.size})
                  </Button>
                )}
                {/* Get unique months from draft forecasts */}
                {[...new Set(forecasts.filter(f => f.status === 'DRAFT').map(f => f.forecast_month?.slice(0, 7)))].map(month => (
                  <Button 
                    key={month} 
                    onClick={() => handleConfirmMonth(month)} 
                    size="sm" 
                    variant="outline"
                  >
                    Confirm All {month}
                  </Button>
                ))}
              </div>
            </div>
          )}
          
          {/* Forecasts Table */}
          <div className="border rounded-sm overflow-x-auto bg-white">
            <table className="w-full">
              <thead className="bg-zinc-50">
                <tr>
                  {canConfirmForecasts && (
                    <th className="h-10 px-2 w-10">
                      <input
                        type="checkbox"
                        checked={selectedForecasts.size === forecasts.filter(f => f.status === 'DRAFT').length && selectedForecasts.size > 0}
                        onChange={handleSelectAllDraft}
                        className="w-4 h-4"
                      />
                    </th>
                  )}
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Forecast ID</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Month</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Buyer</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Vertical</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Brand</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Model</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">SKU</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Forecast Qty</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Dispatch Alloc</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Prod Scheduled</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Sched Pending</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Status</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Dispatch Lots</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Priority</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {forecasts.map((f) => (
                  <tr key={f.id} className={`border-t hover:bg-zinc-50/50 ${selectedForecasts.has(f.id) ? 'bg-blue-50' : ''}`}>
                    {canConfirmForecasts && (
                      <td className="p-2 text-center">
                        {f.status === 'DRAFT' && (
                          <input
                            type="checkbox"
                            checked={selectedForecasts.has(f.id)}
                            onChange={() => handleSelectForecast(f.id)}
                            className="w-4 h-4"
                          />
                        )}
                      </td>
                    )}
                    <td className="p-4">
                      <button 
                        className="font-mono font-bold text-sm text-primary hover:underline cursor-pointer flex items-center gap-1"
                        onClick={async () => {
                          const lots = await fetchForecastDispatchLots(f.id);
                          setSelectedForecastLots({ forecast: f, lots: lots });
                          // Also fetch buyer's other lots for "Add to existing" option
                          if (f.buyer_id) {
                            try {
                              const buyerLotsRes = await axios.get(`${API}/dispatch-lots/by-buyer/${f.buyer_id}`, { headers: getHeaders() });
                              setBuyerExistingLots(buyerLotsRes.data || []);
                            } catch (e) {
                              setBuyerExistingLots([]);
                            }
                          }
                          setShowLotsDialog(true);
                        }}
                        title="Click to view dispatch lots"
                      >
                        {f.forecast_code}
                        <Package className="w-3 h-3 opacity-50" />
                      </button>
                    </td>
                    <td className="p-4 font-mono text-sm">{f.forecast_month?.slice(0, 7)}</td>
                    <td className="p-4 text-sm">{getBuyerName(f.buyer_id)}</td>
                    <td className="p-4 text-sm">{getVerticalDisplay(f)}</td>
                    <td className="p-4 text-sm">{getBrandDisplay(f)}</td>
                    <td className="p-4 text-sm">{getModelDisplay(f)}</td>
                    <td className="p-4 font-mono text-sm text-zinc-600">{f.sku_id || 'All in Vertical'}</td>
                    <td className="p-4 font-mono font-bold">{f.quantity?.toLocaleString()}</td>
                    <td className="p-4 font-mono text-sm">
                      <span className={f.dispatch_allocated > 0 ? 'text-blue-600 font-medium' : 'text-zinc-400'}>
                        {(f.dispatch_allocated || 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-sm">
                      <span className={f.production_scheduled > 0 ? 'text-green-600 font-medium' : 'text-zinc-400'}>
                        {(f.production_scheduled || 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-sm">
                      <span className={f.schedule_pending > 0 ? 'text-orange-600 font-medium' : 'text-green-600'}>
                        {(f.schedule_pending || 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`text-xs font-mono px-2 py-1 rounded border ${getStatusColor(f.status)}`}>{f.status}</span>
                    </td>
                    <td className="p-4">
                      <Button 
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={async () => {
                          const lots = await fetchForecastDispatchLots(f.id);
                          setSelectedForecastLots({ forecast: f, lots: lots });
                          // Also fetch buyer's other lots for "Add to existing" option
                          if (f.buyer_id) {
                            try {
                              const buyerLotsRes = await axios.get(`${API}/dispatch-lots/by-buyer/${f.buyer_id}`, { headers: getHeaders() });
                              setBuyerExistingLots(buyerLotsRes.data || []);
                            } catch (e) {
                              setBuyerExistingLots([]);
                            }
                          }
                          setShowLotsDialog(true);
                        }}
                      >
                        <Package className="w-3 h-3 mr-1" />
                        View Lots
                      </Button>
                    </td>
                    <td className="p-4">
                      <span className={`text-xs font-mono px-2 py-1 rounded border ${
                        f.priority === 'CRITICAL' ? 'bg-red-100 text-red-700 border-red-300' :
                        f.priority === 'HIGH' ? 'bg-orange-100 text-orange-700 border-orange-300' :
                        f.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
                        'bg-zinc-100 border-zinc-300'
                      }`}>{f.priority}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1">
                        {f.status === 'DRAFT' && canEditForecasts && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => handleEditForecast(f)} title="Edit">
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDeleteForecast(f.id)} title="Delete" className="text-red-600 hover:text-red-700">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        {f.status === 'DRAFT' && canConfirmForecasts && (
                          <Button size="sm" variant="outline" onClick={() => handleConfirmForecast(f.id)}>
                            Confirm
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {forecasts.length === 0 && (
                  <tr><td colSpan={canConfirmForecasts ? 17 : 16} className="p-8 text-center text-muted-foreground">No forecasts yet. Create one to get started.</td></tr>
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
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className={`p-3 rounded-lg border ${uploadPreview.length > 0 ? 'bg-green-50 border-green-200' : 'bg-zinc-50 border-zinc-200'}`}>
                <div className="text-2xl font-bold text-green-600">{uploadPreview.length}</div>
                <div className="text-xs text-green-700 uppercase">Valid Forecasts</div>
              </div>
              <div className={`p-3 rounded-lg border ${uploadErrors.length > 0 ? 'bg-red-50 border-red-200' : 'bg-zinc-50 border-zinc-200'}`}>
                <div className="text-2xl font-bold text-red-600">{uploadErrors.length}</div>
                <div className="text-xs text-red-700 uppercase">Errors (will be skipped)</div>
              </div>
            </div>

            {/* Errors Section */}
            {uploadErrors.length > 0 && (
              <div className="border border-red-200 rounded-lg overflow-hidden">
                <div className="bg-red-50 px-4 py-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-red-700">
                    <AlertTriangle className="w-4 h-4 inline mr-2" />
                    {uploadErrors.length} rows have errors
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={downloadErrorReport}
                    disabled={downloadingErrors}
                    className="text-red-700 border-red-300 hover:bg-red-100"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {downloadingErrors ? 'Downloading...' : 'Download Error Report'}
                  </Button>
                </div>
                <div className="max-h-32 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-red-100 sticky top-0">
                      <tr>
                        <th className="p-2 text-left text-xs text-red-800">Row</th>
                        <th className="p-2 text-left text-xs text-red-800">SKU ID</th>
                        <th className="p-2 text-left text-xs text-red-800">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uploadErrors.slice(0, 10).map((err, idx) => (
                        <tr key={idx} className="border-t border-red-100">
                          <td className="p-2 font-mono text-red-600">{err.row_num}</td>
                          <td className="p-2 font-mono">{err.sku_id}</td>
                          <td className="p-2 text-red-600">{err.reason}</td>
                        </tr>
                      ))}
                      {uploadErrors.length > 10 && (
                        <tr className="border-t border-red-100 bg-red-50">
                          <td colSpan={3} className="p-2 text-center text-red-600 text-xs">
                            ... and {uploadErrors.length - 10} more errors. Download the full report.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {/* Valid Forecasts Table */}
            {uploadPreview.length > 0 && (
              <div className="border rounded-sm max-h-60 overflow-y-auto">
                <div className="bg-green-50 px-4 py-2 text-sm font-bold text-green-700 sticky top-0">
                  Valid Forecasts to Upload
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 sticky top-8">
                    <tr>
                      <th className="p-2 text-left font-mono text-xs">Month</th>
                      <th className="p-2 text-left font-mono text-xs">Vertical</th>
                      <th className="p-2 text-left font-mono text-xs">Model</th>
                      <th className="p-2 text-left font-mono text-xs">Brand</th>
                      <th className="p-2 text-left font-mono text-xs">SKU</th>
                      <th className="p-2 text-left font-mono text-xs">Buyer</th>
                      <th className="p-2 text-left font-mono text-xs">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadPreview.map((row, idx) => (
                      <tr key={idx} className="border-t hover:bg-zinc-50">
                        <td className="p-2 font-mono">{row.month}</td>
                        <td className="p-2 text-zinc-600">{row.vertical || '-'}</td>
                        <td className="p-2 text-zinc-600">{row.model || '-'}</td>
                        <td className="p-2 text-zinc-600">{row.brand || '-'}</td>
                        <td className="p-2 font-mono font-bold">{row.sku_id}</td>
                        <td className="p-2 text-zinc-600">{row.buyer || '-'}</td>
                        <td className="p-2 font-mono font-bold text-green-600">{row.quantity?.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {uploadPreview.length === 0 && uploadErrors.length === 0 && (
              <div className="text-center py-8 text-zinc-500">
                No data found in the uploaded file
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              <strong>Required columns:</strong> Month, SKU ID, Quantity<br/>
              <strong>Optional columns:</strong> Vertical, Brand, Model, Buyer (auto-filled from SKU master)
            </p>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setShowUploadDialog(false); setUploadErrors([]); }} className="flex-1">
                Cancel
              </Button>
              <Button 
                onClick={handleBulkUpload} 
                disabled={uploading || uploadPreview.length === 0} 
                className="flex-1"
              >
                {uploading ? 'Uploading...' : `Upload ${uploadPreview.length} Forecasts`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dispatch Lots Popup Dialog */}
      <Dialog open={showLotsDialog} onOpenChange={setShowLotsDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Dispatch Lots - {selectedForecastLots.forecast?.forecast_code}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedForecastLots.forecast && (
              <div className="p-3 bg-zinc-50 rounded-lg text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-zinc-500">SKU:</span> <span className="font-mono font-bold">{selectedForecastLots.forecast.sku_id}</span></div>
                  <div><span className="text-zinc-500">Forecast Qty:</span> <span className="font-mono font-bold">{selectedForecastLots.forecast.quantity?.toLocaleString()}</span></div>
                  <div><span className="text-zinc-500">Buyer:</span> {getBuyerName(selectedForecastLots.forecast.buyer_id)}</div>
                  <div><span className="text-zinc-500">Month:</span> {selectedForecastLots.forecast.forecast_month?.slice(0, 7)}</div>
                  <div><span className="text-zinc-500">Dispatch Allocated:</span> <span className="font-mono text-blue-600">{(selectedForecastLots.forecast.dispatch_allocated || 0).toLocaleString()}</span></div>
                  <div>
                    <span className="text-zinc-500">Available to Allocate:</span> 
                    <span className="font-mono font-bold text-green-600 ml-1">
                      {Math.max(0, (selectedForecastLots.forecast.quantity || 0) - (selectedForecastLots.forecast.dispatch_allocated || 0)).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Linked Dispatch Lots */}
            {selectedForecastLots.lots.length > 0 ? (
              <div className="space-y-4">
                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-blue-600">{selectedForecastLots.lots.length}</div>
                    <div className="text-xs text-blue-700 uppercase">Dispatch Lots</div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {selectedForecastLots.lots.reduce((sum, l) => sum + (l.forecast_qty_in_lot || l.total_quantity || 0), 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-green-700 uppercase">Total Qty Assigned</div>
                  </div>
                  <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-zinc-600">
                      {selectedForecastLots.forecast?.quantity?.toLocaleString() || 0}
                    </div>
                    <div className="text-xs text-zinc-500 uppercase">Forecast Qty</div>
                  </div>
                </div>

                {/* Lots Table */}
                <div className="border rounded overflow-hidden">
                  <div className="bg-zinc-100 px-4 py-2 text-xs font-bold uppercase">Linked Dispatch Lots</div>
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50">
                      <tr>
                        <th className="px-4 py-2 text-left font-mono text-xs uppercase">Lot Code</th>
                        <th className="px-4 py-2 text-left font-mono text-xs uppercase">Buyer</th>
                        <th className="px-4 py-2 text-right font-mono text-xs uppercase">Qty in Lot</th>
                        <th className="px-4 py-2 text-center font-mono text-xs uppercase">Lines</th>
                        <th className="px-4 py-2 text-center font-mono text-xs uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedForecastLots.lots.map((lot, i) => (
                        <tr key={i} className="border-t hover:bg-zinc-50">
                          <td className="px-4 py-3 font-mono font-bold text-primary">{lot.lot_code}</td>
                          <td className="px-4 py-3 text-sm text-zinc-600">{lot.buyer_name || '-'}</td>
                          <td className="px-4 py-3 font-mono font-bold text-right text-green-600">
                            {(lot.forecast_qty_in_lot || lot.total_quantity || lot.required_quantity || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="bg-zinc-100 text-zinc-700 text-xs px-2 py-1 rounded font-mono">
                              {lot.forecast_lines?.length || lot.line_count || 1}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-xs font-mono px-2 py-1 rounded border ${
                              lot.status === 'DISPATCHED' || lot.status === 'DELIVERED' ? 'bg-green-100 text-green-700 border-green-300' :
                              lot.status === 'READY' ? 'bg-blue-100 text-blue-700 border-blue-300' :
                              lot.status === 'CREATED' ? 'bg-zinc-100 border-zinc-300' :
                              'bg-yellow-100 text-yellow-700 border-yellow-300'
                            }`}>{lot.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-zinc-50 border-t">
                      <tr>
                        <td colSpan={2} className="px-4 py-2 font-bold text-right">Total:</td>
                        <td className="px-4 py-2 font-mono font-bold text-right text-green-600">
                          {selectedForecastLots.lots.reduce((sum, l) => sum + (l.forecast_qty_in_lot || l.total_quantity || l.required_quantity || 0), 0).toLocaleString()}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Line Details */}
                {selectedForecastLots.lots.some(l => l.forecast_lines?.length > 0) && (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-zinc-100 px-4 py-2 text-xs font-bold uppercase">Line Details</div>
                    <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
                      {selectedForecastLots.lots.map((lot) => (
                        lot.forecast_lines?.map((line, idx) => (
                          <div key={`${lot.id}-${idx}`} className="flex items-center justify-between bg-zinc-50 rounded px-3 py-2 text-sm">
                            <span className="font-mono text-zinc-600">{lot.lot_code} / Line {line.line_number}</span>
                            <span className="font-mono">{line.sku_id}</span>
                            <span className="font-mono font-bold">{line.quantity?.toLocaleString()}</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              line.status === 'READY' ? 'bg-green-100 text-green-700' :
                              line.status === 'PENDING' ? 'bg-zinc-100 text-zinc-600' :
                              'bg-yellow-100 text-yellow-700'
                            }`}>{line.status || 'PENDING'}</span>
                          </div>
                        ))
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 text-center text-zinc-500 border rounded-lg bg-zinc-50">
                <Package className="w-6 h-6 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No dispatch lots linked to this forecast yet.</p>
              </div>
            )}
            
            {/* Add to Dispatch Lot Section - Only show if there's quantity available */}
            {selectedForecastLots.forecast && 
             selectedForecastLots.forecast.status !== 'DRAFT' &&
             (selectedForecastLots.forecast.quantity - (selectedForecastLots.forecast.dispatch_allocated || 0)) > 0 && (
              <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
                <div className="text-sm font-bold text-blue-800 mb-3 flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Allocate to Dispatch Lot
                </div>
                
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Quantity to Allocate</Label>
                    <Input
                      type="number"
                      value={addToLotQty}
                      onChange={(e) => setAddToLotQty(parseInt(e.target.value) || 0)}
                      max={selectedForecastLots.forecast.quantity - (selectedForecastLots.forecast.dispatch_allocated || 0)}
                      className="font-mono"
                      placeholder="Enter quantity"
                    />
                    <p className="text-xs text-blue-600 mt-1">
                      Max: {(selectedForecastLots.forecast.quantity - (selectedForecastLots.forecast.dispatch_allocated || 0)).toLocaleString()}
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {/* Add to Existing Lot */}
                    <div className="space-y-2">
                      <Label className="text-xs">Add to Existing Lot (Same Buyer)</Label>
                      <Select value={selectedLotForAdd} onValueChange={setSelectedLotForAdd}>
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="Select lot..." />
                        </SelectTrigger>
                        <SelectContent>
                          {buyerExistingLots.length === 0 ? (
                            <SelectItem value="_none" disabled>No existing lots for this buyer</SelectItem>
                          ) : (
                            buyerExistingLots.map(lot => (
                              <SelectItem key={lot.id} value={lot.id}>
                                {lot.lot_code} ({(lot.total_quantity || 0).toLocaleString()} units)
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs"
                        disabled={!selectedLotForAdd || addToLotQty <= 0 || addingToLot}
                        onClick={async () => {
                          if (!selectedLotForAdd || addToLotQty <= 0) return;
                          setAddingToLot(true);
                          try {
                            await axios.post(
                              `${API}/dispatch-lots/${selectedLotForAdd}/add-line`,
                              {
                                sku_id: selectedForecastLots.forecast.sku_id,
                                quantity: addToLotQty,
                                forecast_id: selectedForecastLots.forecast.id
                              },
                              { headers: getHeaders() }
                            );
                            toast.success(`Added ${addToLotQty} units to dispatch lot`);
                            setShowLotsDialog(false);
                            setAddToLotQty(0);
                            setSelectedLotForAdd("");
                            fetchAllData();
                          } catch (error) {
                            toast.error(error.response?.data?.detail || "Failed to add to lot");
                          } finally {
                            setAddingToLot(false);
                          }
                        }}
                      >
                        {addingToLot ? "Adding..." : "Add to Lot"}
                      </Button>
                    </div>
                    
                    {/* Create New Lot */}
                    <div className="space-y-2">
                      <Label className="text-xs">Or Create New Dispatch Lot</Label>
                      <p className="text-xs text-zinc-500">
                        Create a new lot for {getBuyerName(selectedForecastLots.forecast.buyer_id)}
                      </p>
                      <Button
                        size="sm"
                        className="w-full text-xs"
                        disabled={addToLotQty <= 0 || addingToLot}
                        onClick={async () => {
                          if (addToLotQty <= 0) {
                            toast.error("Enter a quantity first");
                            return;
                          }
                          setAddingToLot(true);
                          try {
                            // Create new dispatch lot with this forecast's SKU
                            await axios.post(
                              `${API}/dispatch-lots/multi`,
                              {
                                buyer_id: selectedForecastLots.forecast.buyer_id,
                                forecast_id: selectedForecastLots.forecast.id,
                                target_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Default: 7 days from now
                                priority: selectedForecastLots.forecast.priority || "MEDIUM",
                                notes: `Created from forecast ${selectedForecastLots.forecast.forecast_code}`,
                                lines: [{
                                  sku_id: selectedForecastLots.forecast.sku_id,
                                  quantity: addToLotQty,
                                  forecast_id: selectedForecastLots.forecast.id
                                }]
                              },
                              { headers: getHeaders() }
                            );
                            toast.success(`Created new dispatch lot with ${addToLotQty} units`);
                            setShowLotsDialog(false);
                            setAddToLotQty(0);
                            fetchAllData();
                          } catch (error) {
                            toast.error(error.response?.data?.detail || "Failed to create lot");
                          } finally {
                            setAddingToLot(false);
                          }
                        }}
                      >
                        {addingToLot ? "Creating..." : "Create New Lot"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <Button variant="outline" onClick={() => setShowLotsDialog(false)} className="w-full">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Demand;

import { useState, useEffect } from "react";
import axios from "axios";
import useAuthStore from "@/store/authStore";
import { Plus, TrendingUp, Package, Calendar, Target, ChevronDown, ChevronUp, AlertTriangle, DollarSign, Layers, Check, X } from "lucide-react";
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
  const { token } = useAuthStore();
  const [activeTab, setActiveTab] = useState("forecasts");
  
  // Data
  const [forecasts, setForecasts] = useState([]);
  const [dispatchLots, setDispatchLots] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [skus, setSkus] = useState([]);
  const [verticals, setVerticals] = useState([]);
  const [skuBomMap, setSkuBomMap] = useState({}); // SKU ID -> BOM details with cost
  const [skuBranchMap, setSkuBranchMap] = useState({}); // SKU ID -> assigned branches
  const [expandedSku, setExpandedSku] = useState(null);
  
  // Dialogs
  const [showForecastDialog, setShowForecastDialog] = useState(false);
  const [showLotDialog, setShowLotDialog] = useState(false);
  
  // Forms
  const [forecastForm, setForecastForm] = useState({
    buyer_id: "", vertical_id: "", sku_id: "", 
    forecast_month: new Date().toISOString().slice(0, 7),
    quantity: 0, priority: "MEDIUM", notes: ""
  });
  
  // Dispatch Lot Form with forecast selection
  const [lotForm, setLotForm] = useState({
    forecast_id: "",
    selected_skus: [], // [{sku_id, quantity}]
    buyer_id: "",
    target_date: "",
    priority: "MEDIUM"
  });
  const [selectedForecast, setSelectedForecast] = useState(null);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const [forecastsRes, lotsRes, buyersRes, skusRes, verticalsRes] = await Promise.all([
        axios.get(`${API}/forecasts`, { headers }),
        axios.get(`${API}/dispatch-lots`, { headers }),
        axios.get(`${API}/buyers`, { headers }),
        axios.get(`${API}/skus`, { headers }), // All SKUs, no branch filter
        axios.get(`${API}/verticals`, { headers })
      ]);
      
      setForecasts(forecastsRes.data);
      setDispatchLots(lotsRes.data);
      setBuyers(buyersRes.data);
      setSkus(skusRes.data);
      setVerticals(verticalsRes.data);
      
      // Fetch BOM data for SKUs
      await fetchBomData(skusRes.data);
      
      // Fetch branch assignments for SKUs
      await fetchBranchAssignments();
      
    } catch (error) {
      toast.error("Failed to fetch data");
    }
  };

  const fetchBomData = async (skuList) => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const bomRes = await axios.get(`${API}/bill-of-materials`, { headers });
      const rmRes = await axios.get(`${API}/raw-materials`, { headers });
      const priceRes = await axios.get(`${API}/vendor-rm-prices/comparison`, { headers });
      
      const rmMap = {};
      rmRes.data.forEach(rm => { rmMap[rm.rm_id] = rm; });
      
      // Build price map (rm_id -> lowest price)
      const priceMap = {};
      priceRes.data?.forEach(p => { 
        if (!priceMap[p.rm_id] || p.lowest_price < priceMap[p.rm_id]) {
          priceMap[p.rm_id] = p.lowest_price;
        }
      });
      
      // Build BOM map with cost
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

  const fetchBranchAssignments = async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API}/sku-branch-assignments/all`, { headers });
      
      // Build map: sku_id -> [branches]
      const branchMap = {};
      res.data?.forEach(assignment => {
        if (!branchMap[assignment.sku_id]) {
          branchMap[assignment.sku_id] = [];
        }
        if (!branchMap[assignment.sku_id].includes(assignment.branch)) {
          branchMap[assignment.sku_id].push(assignment.branch);
        }
      });
      
      setSkuBranchMap(branchMap);
    } catch (error) {
      console.error("Failed to fetch branch assignments:", error);
    }
  };

  const handleCreateForecast = async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.post(`${API}/forecasts`, {
        ...forecastForm,
        forecast_month: new Date(forecastForm.forecast_month + "-01").toISOString()
      }, { headers });
      toast.success("Forecast created");
      setShowForecastDialog(false);
      setForecastForm({
        buyer_id: "", vertical_id: "", sku_id: "", 
        forecast_month: new Date().toISOString().slice(0, 7),
        quantity: 0, priority: "MEDIUM", notes: ""
      });
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create forecast");
    }
  };

  const handleCreateLotFromForecast = async () => {
    if (lotForm.selected_skus.length === 0) {
      toast.error("Please select at least one SKU");
      return;
    }
    
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      // Create dispatch lots for each selected SKU
      for (const item of lotForm.selected_skus) {
        await axios.post(`${API}/dispatch-lots`, {
          forecast_id: lotForm.forecast_id,
          sku_id: item.sku_id,
          buyer_id: lotForm.buyer_id,
          required_quantity: item.quantity,
          target_date: new Date(lotForm.target_date).toISOString(),
          priority: lotForm.priority
        }, { headers });
      }
      
      toast.success(`Created ${lotForm.selected_skus.length} dispatch lot(s)`);
      setShowLotDialog(false);
      setLotForm({
        forecast_id: "",
        selected_skus: [],
        buyer_id: "",
        target_date: "",
        priority: "MEDIUM"
      });
      setSelectedForecast(null);
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create dispatch lot");
    }
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

  const openLotDialogFromForecast = (forecast) => {
    setSelectedForecast(forecast);
    setLotForm({
      forecast_id: forecast.id,
      selected_skus: [],
      buyer_id: forecast.buyer_id,
      target_date: "",
      priority: forecast.priority || "MEDIUM"
    });
    setShowLotDialog(true);
  };

  const toggleSkuSelection = (sku, quantity) => {
    const existing = lotForm.selected_skus.find(s => s.sku_id === sku.sku_id);
    if (existing) {
      setLotForm({
        ...lotForm,
        selected_skus: lotForm.selected_skus.filter(s => s.sku_id !== sku.sku_id)
      });
    } else {
      setLotForm({
        ...lotForm,
        selected_skus: [...lotForm.selected_skus, { sku_id: sku.sku_id, quantity: quantity || 0 }]
      });
    }
  };

  const updateSkuQuantity = (skuId, quantity) => {
    setLotForm({
      ...lotForm,
      selected_skus: lotForm.selected_skus.map(s => 
        s.sku_id === skuId ? { ...s, quantity: parseInt(quantity) || 0 } : s
      )
    });
  };

  // Check if selected SKUs span multiple branches (needs CPC attention)
  const checkMultiBranchConflict = () => {
    const allBranches = new Set();
    lotForm.selected_skus.forEach(item => {
      const branches = skuBranchMap[item.sku_id] || [];
      branches.forEach(b => allBranches.add(b));
    });
    return allBranches.size > 1 ? Array.from(allBranches) : null;
  };

  const getBuyerName = (id) => buyers.find(b => b.id === id)?.name || id || '-';
  const getVerticalName = (id) => verticals.find(v => v.id === id)?.name || id || '-';
  const getSkuDescription = (skuId) => {
    const sku = skus.find(s => s.sku_id === skuId);
    return sku?.description || skuId;
  };

  const getStatusColor = (status) => {
    const colors = {
      'DRAFT': 'bg-zinc-100 text-zinc-700 border-zinc-300',
      'CONFIRMED': 'bg-blue-100 text-blue-700 border-blue-300',
      'CONVERTED': 'bg-green-100 text-green-700 border-green-300',
      'CREATED': 'bg-zinc-100 text-zinc-700 border-zinc-300',
      'PRODUCTION_ASSIGNED': 'bg-yellow-100 text-yellow-700 border-yellow-300',
      'PARTIALLY_PRODUCED': 'bg-orange-100 text-orange-700 border-orange-300',
      'FULLY_PRODUCED': 'bg-blue-100 text-blue-700 border-blue-300',
      'QC_CLEARED': 'bg-teal-100 text-teal-700 border-teal-300',
      'DISPATCH_READY': 'bg-purple-100 text-purple-700 border-purple-300',
      'DISPATCHED': 'bg-green-100 text-green-700 border-green-300',
      'DELIVERED': 'bg-green-200 text-green-800 border-green-400'
    };
    return colors[status] || 'bg-zinc-100 text-zinc-700 border-zinc-300';
  };

  // Filter SKUs by vertical for forecast
  const filteredSkusForForecast = forecastForm.vertical_id 
    ? skus.filter(s => s.vertical_id === forecastForm.vertical_id || s.vertical === getVerticalName(forecastForm.vertical_id))
    : skus;

  const multiBranchConflict = checkMultiBranchConflict();

  return (
    <div className="p-6 md:p-8" data-testid="demand-page">
      <div className="mb-8">
        <h1 className="text-4xl font-black tracking-tight uppercase">Demand</h1>
        <p className="text-sm text-muted-foreground mt-1 font-mono">Forecasting, Dispatch Lots & BOM Costing</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="forecasts" className="uppercase text-xs tracking-wide">
            <TrendingUp className="w-4 h-4 mr-2" />
            Forecasts
          </TabsTrigger>
          <TabsTrigger value="dispatch-lots" className="uppercase text-xs tracking-wide">
            <Package className="w-4 h-4 mr-2" />
            Dispatch Lots
          </TabsTrigger>
          <TabsTrigger value="sku-bom" className="uppercase text-xs tracking-wide">
            <Layers className="w-4 h-4 mr-2" />
            SKU BOM & Cost
          </TabsTrigger>
        </TabsList>

        {/* Forecasts Tab */}
        <TabsContent value="forecasts">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold">Demand Forecasts</h2>
            <Dialog open={showForecastDialog} onOpenChange={setShowForecastDialog}>
              <DialogTrigger asChild>
                <Button className="uppercase text-xs tracking-wide" data-testid="add-forecast-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Forecast
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create Forecast</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Buyer *</Label>
                    <Select value={forecastForm.buyer_id} onValueChange={(v) => setForecastForm({...forecastForm, buyer_id: v})}>
                      <SelectTrigger><SelectValue placeholder="Select buyer" /></SelectTrigger>
                      <SelectContent>
                        {buyers.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Vertical *</Label>
                    <Select value={forecastForm.vertical_id} onValueChange={(v) => setForecastForm({...forecastForm, vertical_id: v, sku_id: ""})}>
                      <SelectTrigger><SelectValue placeholder="Select vertical" /></SelectTrigger>
                      <SelectContent>
                        {verticals.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>SKU (Optional - for SKU-level forecast)</Label>
                    <Select value={forecastForm.sku_id} onValueChange={(v) => setForecastForm({...forecastForm, sku_id: v})}>
                      <SelectTrigger><SelectValue placeholder="All SKUs in vertical" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All SKUs in Vertical</SelectItem>
                        {filteredSkusForForecast.slice(0, 200).map(s => (
                          <SelectItem key={s.sku_id} value={s.sku_id}>
                            {s.sku_id} - {s.description?.slice(0, 30)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Forecast Month *</Label>
                    <Input 
                      type="month" 
                      value={forecastForm.forecast_month}
                      onChange={(e) => setForecastForm({...forecastForm, forecast_month: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label>Quantity *</Label>
                    <Input 
                      type="number"
                      value={forecastForm.quantity}
                      onChange={(e) => setForecastForm({...forecastForm, quantity: parseInt(e.target.value) || 0})}
                    />
                  </div>
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
                      <div className="flex gap-2">
                        {f.status === 'DRAFT' && (
                          <Button size="sm" variant="outline" onClick={() => handleConfirmForecast(f.id)}>
                            Confirm
                          </Button>
                        )}
                        {f.status === 'CONFIRMED' && (
                          <Button size="sm" onClick={() => openLotDialogFromForecast(f)}>
                            <Package className="w-3 h-3 mr-1" />
                            Create Lots
                          </Button>
                        )}
                      </div>
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

        {/* Dispatch Lots Tab */}
        <TabsContent value="dispatch-lots">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold">Dispatch Lots</h2>
            <p className="text-xs text-zinc-500 font-mono">
              Create lots from confirmed forecasts using the "Create Lots" button
            </p>
          </div>
          
          <div className="border rounded-sm overflow-x-auto bg-white">
            <table className="w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Lot Code</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">SKU</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Buyer</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Branches</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Target</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Required</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Produced</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {dispatchLots.map((lot) => {
                  const branches = skuBranchMap[lot.sku_id] || [];
                  const isMultiBranch = branches.length > 1;
                  
                  return (
                    <tr key={lot.id} className="border-t hover:bg-zinc-50/50">
                      <td className="p-4 font-mono font-bold text-sm">{lot.lot_code}</td>
                      <td className="p-4 font-mono text-sm">{lot.sku_id}</td>
                      <td className="p-4 text-sm">{getBuyerName(lot.buyer_id)}</td>
                      <td className="p-4">
                        {isMultiBranch ? (
                          <div className="flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4 text-orange-500" />
                            <span className="text-xs font-mono text-orange-600">
                              {branches.length} branches
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs font-mono text-zinc-600">
                            {branches[0] || 'Not assigned'}
                          </span>
                        )}
                      </td>
                      <td className="p-4 font-mono text-sm">{lot.target_date?.slice(0, 10)}</td>
                      <td className="p-4 font-mono font-bold">{lot.required_quantity?.toLocaleString()}</td>
                      <td className="p-4 font-mono">{lot.produced_quantity?.toLocaleString() || 0}</td>
                      <td className="p-4">
                        <span className={`text-xs font-mono px-2 py-1 rounded border ${getStatusColor(lot.status)}`}>
                          {lot.status?.replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {dispatchLots.length === 0 && (
                  <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No dispatch lots yet</td></tr>
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

      {/* Create Dispatch Lot Dialog - From Forecast */}
      <Dialog open={showLotDialog} onOpenChange={setShowLotDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Create Dispatch Lots from Forecast
            </DialogTitle>
          </DialogHeader>
          
          {selectedForecast && (
            <div className="space-y-4">
              {/* Forecast Info */}
              <div className="p-4 bg-zinc-100 rounded-sm">
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-zinc-500 text-xs uppercase">Forecast</span>
                    <div className="font-mono font-bold">{selectedForecast.forecast_code}</div>
                  </div>
                  <div>
                    <span className="text-zinc-500 text-xs uppercase">Buyer</span>
                    <div>{getBuyerName(selectedForecast.buyer_id)}</div>
                  </div>
                  <div>
                    <span className="text-zinc-500 text-xs uppercase">Vertical</span>
                    <div>{getVerticalName(selectedForecast.vertical_id)}</div>
                  </div>
                  <div>
                    <span className="text-zinc-500 text-xs uppercase">Total Qty</span>
                    <div className="font-mono font-bold">{selectedForecast.quantity?.toLocaleString()}</div>
                  </div>
                </div>
              </div>

              {/* Multi-Branch Warning */}
              {multiBranchConflict && (
                <div className="p-4 bg-orange-100 border border-orange-300 rounded-sm flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-orange-800 text-sm">CPC Attention Required</div>
                    <div className="text-xs text-orange-700 mt-1">
                      Selected SKUs are assigned to multiple branches: <strong>{multiBranchConflict.join(', ')}</strong>. 
                      CPC team will need to coordinate production across branches.
                    </div>
                  </div>
                </div>
              )}

              {/* SKU Selection */}
              <div>
                <Label className="mb-2 block">Select SKUs for Dispatch Lot(s)</Label>
                <div className="border rounded-sm max-h-60 overflow-y-auto">
                  {(selectedForecast.sku_id 
                    ? skus.filter(s => s.sku_id === selectedForecast.sku_id)
                    : skus.filter(s => s.vertical_id === selectedForecast.vertical_id || s.vertical === getVerticalName(selectedForecast.vertical_id))
                  ).slice(0, 50).map(sku => {
                    const isSelected = lotForm.selected_skus.some(s => s.sku_id === sku.sku_id);
                    const selectedItem = lotForm.selected_skus.find(s => s.sku_id === sku.sku_id);
                    const branches = skuBranchMap[sku.sku_id] || [];
                    
                    return (
                      <div 
                        key={sku.sku_id} 
                        className={`flex items-center gap-3 p-3 border-b last:border-b-0 ${isSelected ? 'bg-primary/5' : 'hover:bg-zinc-50'}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSkuSelection(sku, Math.floor(selectedForecast.quantity / 10))}
                          className="w-4 h-4"
                        />
                        <div className="flex-1">
                          <div className="font-mono text-sm font-bold">{sku.sku_id}</div>
                          <div className="text-xs text-zinc-500">{sku.description?.slice(0, 50)}</div>
                          {branches.length > 0 && (
                            <div className="text-xs text-zinc-400 mt-1">
                              Branches: {branches.join(', ')}
                            </div>
                          )}
                        </div>
                        {isSelected && (
                          <div className="flex items-center gap-2">
                            <Label className="text-xs">Qty:</Label>
                            <Input
                              type="number"
                              value={selectedItem?.quantity || 0}
                              onChange={(e) => updateSkuQuantity(sku.sku_id, e.target.value)}
                              className="w-24 h-8 text-sm"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Target Date and Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Target Date *</Label>
                  <Input 
                    type="date"
                    value={lotForm.target_date}
                    onChange={(e) => setLotForm({...lotForm, target_date: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Priority</Label>
                  <Select value={lotForm.priority} onValueChange={(v) => setLotForm({...lotForm, priority: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="CRITICAL">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Summary */}
              <div className="p-3 bg-zinc-50 rounded-sm">
                <div className="text-sm">
                  <span className="text-zinc-500">Selected:</span>{' '}
                  <span className="font-bold">{lotForm.selected_skus.length} SKU(s)</span>
                  {lotForm.selected_skus.length > 0 && (
                    <span className="ml-4">
                      <span className="text-zinc-500">Total Qty:</span>{' '}
                      <span className="font-mono font-bold">
                        {lotForm.selected_skus.reduce((sum, s) => sum + s.quantity, 0).toLocaleString()}
                      </span>
                    </span>
                  )}
                </div>
              </div>

              <Button 
                onClick={handleCreateLotFromForecast} 
                className="w-full"
                disabled={lotForm.selected_skus.length === 0 || !lotForm.target_date}
              >
                Create {lotForm.selected_skus.length} Dispatch Lot(s)
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Demand;

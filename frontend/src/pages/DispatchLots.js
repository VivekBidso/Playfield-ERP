import { useState, useEffect } from "react";
import axios from "axios";
import useAuthStore from "@/store/authStore";
import { Plus, Package, Trash2, Search, Users, Layers, Box, X, CheckCircle2, Clock, AlertCircle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DispatchLots = () => {
  const { token } = useAuthStore();
  
  // Data
  const [dispatchLots, setDispatchLots] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Create Dialog state
  const [showDialog, setShowDialog] = useState(false);
  
  // Detail Dialog state
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedLot, setSelectedLot] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  
  // Edit Dialog state
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingLot, setEditingLot] = useState(null);
  const [editTargetDate, setEditTargetDate] = useState("");
  const [editPriority, setEditPriority] = useState("MEDIUM");
  const [editNotes, setEditNotes] = useState("");
  const [editLines, setEditLines] = useState([]);
  const [savingEdit, setSavingEdit] = useState(false);
  
  // Cascade filter data
  const [buyersWithForecasts, setBuyersWithForecasts] = useState([]);
  const [brandsForBuyer, setBrandsForBuyer] = useState([]);
  const [verticalsForBuyer, setVerticalsForBuyer] = useState([]);
  const [forecastedSkus, setForecastedSkus] = useState([]);
  
  // Form state
  const [selectedBuyer, setSelectedBuyer] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [notes, setNotes] = useState("");
  
  // Lines state
  const [lotLines, setLotLines] = useState([]);
  
  // Current line being edited
  const [currentLine, setCurrentLine] = useState({
    brand_id: "",
    vertical_id: "",
    sku_id: "",
    quantity: 0
  });
  
  // Loading states
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [loadingVerticals, setLoadingVerticals] = useState(false);
  const [loadingSkus, setLoadingSkus] = useState(false);

  useEffect(() => {
    fetchDispatchLots();
    fetchBuyersWithForecasts();
  }, []);

  // When buyer changes, fetch brands and verticals
  useEffect(() => {
    if (selectedBuyer) {
      fetchBrandsForBuyer(selectedBuyer);
      fetchVerticalsForBuyer(selectedBuyer);
      setLotLines([]);
      setCurrentLine({ brand_id: "", vertical_id: "", sku_id: "", quantity: 0 });
      setForecastedSkus([]);
    } else {
      setBrandsForBuyer([]);
      setVerticalsForBuyer([]);
      setForecastedSkus([]);
    }
  }, [selectedBuyer]);

  // When brand or vertical changes, fetch SKUs
  useEffect(() => {
    if (selectedBuyer && (currentLine.brand_id || currentLine.vertical_id)) {
      fetchForecastedSkus(selectedBuyer, currentLine.vertical_id, currentLine.brand_id);
    } else {
      setForecastedSkus([]);
    }
  }, [selectedBuyer, currentLine.brand_id, currentLine.vertical_id]);

  const getHeaders = () => token ? { Authorization: `Bearer ${token}` } : {};

  const fetchDispatchLots = async () => {
    try {
      const res = await axios.get(`${API}/dispatch-lots/with-readiness`, { headers: getHeaders() });
      setDispatchLots(res.data);
    } catch (error) {
      console.error("Failed to fetch dispatch lots:", error);
      // Fallback to regular endpoint
      try {
        const res = await axios.get(`${API}/dispatch-lots`, { headers: getHeaders() });
        setDispatchLots(res.data);
      } catch (err) {
        console.error("Fallback also failed:", err);
      }
    }
  };

  const fetchBuyersWithForecasts = async () => {
    try {
      const res = await axios.get(`${API}/dispatch-lots/buyers-with-forecasts`, { headers: getHeaders() });
      setBuyersWithForecasts(res.data);
    } catch (error) {
      console.error("Failed to fetch buyers:", error);
    }
  };

  const fetchBrandsForBuyer = async (buyerId) => {
    setLoadingBrands(true);
    try {
      const res = await axios.get(`${API}/dispatch-lots/brands-by-buyer?buyer_id=${buyerId}`, { headers: getHeaders() });
      setBrandsForBuyer(res.data);
    } catch (error) {
      console.error("Failed to fetch brands:", error);
    } finally {
      setLoadingBrands(false);
    }
  };

  const fetchVerticalsForBuyer = async (buyerId, brandId = null) => {
    setLoadingVerticals(true);
    try {
      let url = `${API}/dispatch-lots/verticals-by-buyer?buyer_id=${buyerId}`;
      if (brandId) url += `&brand_id=${brandId}`;
      const res = await axios.get(url, { headers: getHeaders() });
      setVerticalsForBuyer(res.data);
    } catch (error) {
      console.error("Failed to fetch verticals:", error);
    } finally {
      setLoadingVerticals(false);
    }
  };

  const fetchForecastedSkus = async (buyerId, verticalId, brandId) => {
    setLoadingSkus(true);
    try {
      let url = `${API}/dispatch-lots/forecasted-skus?buyer_id=${buyerId}`;
      if (verticalId) url += `&vertical_id=${verticalId}`;
      if (brandId) url += `&brand_id=${brandId}`;
      const res = await axios.get(url, { headers: getHeaders() });
      setForecastedSkus(res.data);
    } catch (error) {
      console.error("Failed to fetch SKUs:", error);
    } finally {
      setLoadingSkus(false);
    }
  };

  const fetchLotDetails = async (lotId) => {
    setLoadingDetail(true);
    try {
      const res = await axios.get(`${API}/dispatch-lots/${lotId}/details`, { headers: getHeaders() });
      setSelectedLot(res.data);
      setShowDetailDialog(true);
    } catch (error) {
      console.error("Failed to fetch lot details:", error);
      toast.error("Failed to load lot details");
    } finally {
      setLoadingDetail(false);
    }
  };

  const openEditDialog = (lot) => {
    setEditingLot(lot);
    setEditTargetDate(lot.target_date ? lot.target_date.slice(0, 10) : "");
    setEditPriority(lot.priority || "MEDIUM");
    setEditNotes(lot.notes || "");
    setEditLines(lot.lines?.map(l => ({
      id: l.id,
      sku_id: l.sku_id,
      sku_description: l.sku_description || l.description || "",
      brand_id: l.brand_id,
      vertical_id: l.vertical_id,
      quantity: l.quantity,
      forecast_id: l.forecast_id
    })) || []);
    setShowEditDialog(true);
  };

  const handleEditLineQuantity = (index, newQty) => {
    const updated = [...editLines];
    updated[index].quantity = parseInt(newQty) || 0;
    setEditLines(updated);
  };

  const handleRemoveEditLine = (index) => {
    if (editLines.length <= 1) {
      toast.error("At least one line item is required");
      return;
    }
    setEditLines(editLines.filter((_, i) => i !== index));
  };

  const handleSaveEdit = async () => {
    if (!editTargetDate) {
      toast.error("Please select a target date");
      return;
    }
    if (editLines.length === 0) {
      toast.error("At least one line item is required");
      return;
    }
    if (editLines.some(l => l.quantity <= 0)) {
      toast.error("All line quantities must be greater than 0");
      return;
    }

    setSavingEdit(true);
    try {
      const payload = {
        target_date: new Date(editTargetDate).toISOString(),
        priority: editPriority,
        notes: editNotes,
        lines: editLines.map(l => ({
          id: l.id,
          sku_id: l.sku_id,
          brand_id: l.brand_id || null,
          vertical_id: l.vertical_id || null,
          quantity: l.quantity,
          forecast_id: l.forecast_id || null
        }))
      };

      await axios.put(`${API}/dispatch-lots/${editingLot.id}`, payload, { headers: getHeaders() });
      
      toast.success("Dispatch lot updated successfully");
      setShowEditDialog(false);
      setShowDetailDialog(false);
      fetchDispatchLots();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update dispatch lot");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleAddLine = () => {
    if (!currentLine.sku_id || currentLine.quantity <= 0) {
      toast.error("Please select a SKU and enter quantity");
      return;
    }

    const selectedSku = forecastedSkus.find(s => s.sku_id === currentLine.sku_id);
    if (!selectedSku) {
      toast.error("Invalid SKU selected");
      return;
    }

    if (lotLines.some(l => l.sku_id === currentLine.sku_id)) {
      toast.error("This SKU is already added to the lot");
      return;
    }

    if (currentLine.quantity > selectedSku.available_qty) {
      toast.error(`Quantity exceeds available (${selectedSku.available_qty})`);
      return;
    }

    setLotLines([...lotLines, {
      ...currentLine,
      sku_description: selectedSku.description,
      brand_name: selectedSku.brand,
      vertical_name: selectedSku.vertical,
      available_qty: selectedSku.available_qty
    }]);

    setCurrentLine({
      brand_id: currentLine.brand_id,
      vertical_id: currentLine.vertical_id,
      sku_id: "",
      quantity: 0
    });
  };

  const handleRemoveLine = (index) => {
    setLotLines(lotLines.filter((_, i) => i !== index));
  };

  const handleCreateLot = async () => {
    if (!selectedBuyer) {
      toast.error("Please select a buyer");
      return;
    }
    if (!targetDate) {
      toast.error("Please select a target date");
      return;
    }
    if (lotLines.length === 0) {
      toast.error("Please add at least one line item");
      return;
    }

    try {
      const payload = {
        buyer_id: selectedBuyer,
        target_date: new Date(targetDate).toISOString(),
        priority,
        notes,
        lines: lotLines.map(l => ({
          sku_id: l.sku_id,
          brand_id: l.brand_id || null,
          vertical_id: l.vertical_id || null,
          quantity: l.quantity
        }))
      };

      await axios.post(`${API}/dispatch-lots/multi`, payload, { headers: getHeaders() });
      
      toast.success("Dispatch lot created successfully");
      setShowDialog(false);
      resetForm();
      fetchDispatchLots();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create dispatch lot");
    }
  };

  const resetForm = () => {
    setSelectedBuyer("");
    setTargetDate("");
    setPriority("MEDIUM");
    setNotes("");
    setLotLines([]);
    setCurrentLine({ brand_id: "", vertical_id: "", sku_id: "", quantity: 0 });
    setBrandsForBuyer([]);
    setVerticalsForBuyer([]);
    setForecastedSkus([]);
  };

  const getStatusColor = (status) => {
    const colors = {
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

  const getReadinessIcon = (status) => {
    switch (status) {
      case 'READY': return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'PARTIAL': return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'PENDING': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-zinc-400" />;
    }
  };

  const getReadinessColor = (status) => {
    switch (status) {
      case 'READY': return 'bg-green-100 text-green-700 border-green-300';
      case 'PARTIAL': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'PENDING': return 'bg-red-100 text-red-600 border-red-300';
      default: return 'bg-zinc-100 text-zinc-700 border-zinc-300';
    }
  };

  const filteredLots = dispatchLots.filter(lot => 
    lot.lot_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lot.sku_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalLinesQty = lotLines.reduce((sum, l) => sum + l.quantity, 0);

  return (
    <div className="p-6 md:p-8" data-testid="dispatch-lots-page">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight uppercase">Dispatch Lots</h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">
            Create multi-line lots for forecasted SKUs
          </p>
        </div>
        <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="uppercase text-xs tracking-wide" data-testid="add-lot-btn">
              <Plus className="w-4 h-4 mr-2" />
              Create Dispatch Lot
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Create Dispatch Lot
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Step 1: Select Buyer */}
              <div className="p-4 border rounded-lg bg-zinc-50">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-primary" />
                  <Label className="text-sm font-bold uppercase tracking-wide">Step 1: Select Buyer</Label>
                </div>
                <Select value={selectedBuyer} onValueChange={setSelectedBuyer}>
                  <SelectTrigger data-testid="buyer-select">
                    <SelectValue placeholder="Select a buyer with forecasts..." />
                  </SelectTrigger>
                  <SelectContent>
                    {buyersWithForecasts.length === 0 ? (
                      <div className="p-3 text-sm text-zinc-500 text-center">
                        No buyers with confirmed forecasts
                      </div>
                    ) : (
                      buyersWithForecasts.map(b => (
                        <SelectItem key={b.id} value={b.id}>
                          <span className="font-medium">{b.name}</span>
                          <span className="text-xs text-zinc-500 ml-2">({b.code})</span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Step 2: Add Lines */}
              {selectedBuyer && (
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-primary" />
                      <Label className="text-sm font-bold uppercase tracking-wide">Step 2: Add Lot Lines</Label>
                    </div>
                    {lotLines.length > 0 && (
                      <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-1 rounded">
                        {lotLines.length} lines | {totalLinesQty.toLocaleString()} units
                      </span>
                    )}
                  </div>

                  {/* Line Input Form */}
                  <div className="space-y-3 p-3 bg-zinc-50 rounded-lg border border-dashed mb-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-zinc-500">Brand (optional filter)</Label>
                        <Select 
                          value={currentLine.brand_id || "_all"} 
                          onValueChange={(v) => setCurrentLine({...currentLine, brand_id: v === "_all" ? "" : v, sku_id: ""})}
                          disabled={loadingBrands}
                        >
                          <SelectTrigger data-testid="brand-select">
                            <SelectValue placeholder="All brands" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_all">All Brands</SelectItem>
                            {brandsForBuyer.map(b => (
                              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-xs text-zinc-500">Vertical (optional filter)</Label>
                        <Select 
                          value={currentLine.vertical_id || "_all"} 
                          onValueChange={(v) => setCurrentLine({...currentLine, vertical_id: v === "_all" ? "" : v, sku_id: ""})}
                          disabled={loadingVerticals}
                        >
                          <SelectTrigger data-testid="vertical-select">
                            <SelectValue placeholder="All verticals" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_all">All Verticals</SelectItem>
                            {verticalsForBuyer.map(v => (
                              <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs text-zinc-500">SKU (from forecasts)</Label>
                      <Select 
                        value={currentLine.sku_id || "_none"} 
                        onValueChange={(v) => setCurrentLine({...currentLine, sku_id: v === "_none" ? "" : v})}
                        disabled={loadingSkus || forecastedSkus.length === 0}
                      >
                        <SelectTrigger data-testid="sku-select">
                          <SelectValue placeholder={loadingSkus ? "Loading SKUs..." : "Select forecasted SKU"} />
                        </SelectTrigger>
                        <SelectContent>
                          {forecastedSkus.length === 0 ? (
                            <div className="p-3 text-sm text-zinc-500 text-center">
                              {loadingSkus ? "Loading..." : "No forecasted SKUs found"}
                            </div>
                          ) : (
                            forecastedSkus.map(s => (
                              <SelectItem 
                                key={s.sku_id} 
                                value={s.sku_id}
                                disabled={lotLines.some(l => l.sku_id === s.sku_id) || s.available_qty <= 0}
                              >
                                <div className="flex items-center justify-between w-full gap-2">
                                  <span className="font-mono text-sm">{s.sku_id}</span>
                                  <span className={`text-xs ${s.available_qty > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                    Avail: {s.available_qty.toLocaleString()}
                                  </span>
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {currentLine.sku_id && (
                      <div className="p-2 bg-blue-50 rounded text-xs border border-blue-200">
                        {(() => {
                          const sku = forecastedSkus.find(s => s.sku_id === currentLine.sku_id);
                          return sku ? (
                            <div className="space-y-1">
                              <div className="font-medium text-blue-800">{sku.description || sku.sku_id}</div>
                              <div className="flex gap-4 text-blue-600">
                                <span>Brand: {sku.brand || '-'}</span>
                                <span>Vertical: {sku.vertical || '-'}</span>
                              </div>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    )}

                    <div className="flex items-end gap-3">
                      <div className="flex-1">
                        <Label className="text-xs text-zinc-500">Quantity</Label>
                        <Input
                          type="number"
                          value={currentLine.quantity || ""}
                          onChange={(e) => setCurrentLine({...currentLine, quantity: parseInt(e.target.value) || 0})}
                          placeholder="Enter quantity"
                          className="font-mono"
                          data-testid="quantity-input"
                        />
                      </div>
                      <Button 
                        onClick={handleAddLine}
                        disabled={!currentLine.sku_id || currentLine.quantity <= 0}
                        className="uppercase text-xs"
                        data-testid="add-line-btn"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Line
                      </Button>
                    </div>
                  </div>

                  {/* Added Lines List */}
                  {lotLines.length > 0 && (
                    <div className="border rounded overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-zinc-100">
                          <tr>
                            <th className="px-3 py-2 text-left font-mono text-xs uppercase">#</th>
                            <th className="px-3 py-2 text-left font-mono text-xs uppercase">SKU</th>
                            <th className="px-3 py-2 text-left font-mono text-xs uppercase">Brand</th>
                            <th className="px-3 py-2 text-left font-mono text-xs uppercase">Vertical</th>
                            <th className="px-3 py-2 text-right font-mono text-xs uppercase">Qty</th>
                            <th className="px-3 py-2 w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {lotLines.map((line, idx) => (
                            <tr key={idx} className="border-t hover:bg-zinc-50">
                              <td className="px-3 py-2 font-mono text-zinc-500">{idx + 1}</td>
                              <td className="px-3 py-2 font-mono font-medium">{line.sku_id}</td>
                              <td className="px-3 py-2 text-zinc-600">{line.brand_name || '-'}</td>
                              <td className="px-3 py-2 text-zinc-600">{line.vertical_name || '-'}</td>
                              <td className="px-3 py-2 font-mono font-bold text-right">{line.quantity.toLocaleString()}</td>
                              <td className="px-3 py-2">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleRemoveLine(idx)}
                                  className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-zinc-50 border-t">
                          <tr>
                            <td colSpan={4} className="px-3 py-2 text-right font-bold uppercase text-xs">Total</td>
                            <td className="px-3 py-2 font-mono font-bold text-right text-primary">{totalLinesQty.toLocaleString()}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Lot Details */}
              {selectedBuyer && (
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-4">
                    <Box className="w-4 h-4 text-primary" />
                    <Label className="text-sm font-bold uppercase tracking-wide">Step 3: Lot Details</Label>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-zinc-500">Target Date *</Label>
                      <Input
                        type="date"
                        value={targetDate}
                        onChange={(e) => setTargetDate(e.target.value)}
                        data-testid="target-date-input"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-zinc-500">Priority</Label>
                      <Select value={priority} onValueChange={setPriority}>
                        <SelectTrigger data-testid="priority-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LOW">Low</SelectItem>
                          <SelectItem value="MEDIUM">Medium</SelectItem>
                          <SelectItem value="HIGH">High</SelectItem>
                          <SelectItem value="CRITICAL">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <Label className="text-xs text-zinc-500">Notes</Label>
                    <Input
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Optional notes for this lot"
                      data-testid="notes-input"
                    />
                  </div>
                </div>
              )}

              {/* Create Button */}
              {selectedBuyer && (
                <Button 
                  onClick={handleCreateLot} 
                  className="w-full uppercase tracking-wide"
                  disabled={lotLines.length === 0 || !targetDate}
                  data-testid="create-lot-btn"
                >
                  <Package className="w-4 h-4 mr-2" />
                  Create Dispatch Lot ({lotLines.length} lines, {totalLinesQty.toLocaleString()} units)
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="mb-4 flex items-center gap-2 max-w-md">
        <Search className="w-4 h-4 text-zinc-400" />
        <Input
          placeholder="Search by lot code..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="font-mono"
          data-testid="search-input"
        />
      </div>

      {/* Dispatch Lots Table */}
      <div className="border rounded-sm overflow-x-auto bg-white">
        <table className="w-full" data-testid="lots-table">
          <thead className="bg-zinc-50">
            <tr>
              <th className="h-10 px-4 text-left font-mono text-xs uppercase">Lot Code</th>
              <th className="h-10 px-4 text-left font-mono text-xs uppercase">Buyer</th>
              <th className="h-10 px-4 text-left font-mono text-xs uppercase">Lines</th>
              <th className="h-10 px-4 text-left font-mono text-xs uppercase">Target</th>
              <th className="h-10 px-4 text-left font-mono text-xs uppercase">Total Qty</th>
              <th className="h-10 px-4 text-left font-mono text-xs uppercase">Priority</th>
              <th className="h-10 px-4 text-left font-mono text-xs uppercase">Readiness</th>
              <th className="h-10 px-4 text-left font-mono text-xs uppercase">Status</th>
              <th className="h-10 px-4 text-right font-mono text-xs uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredLots.map((lot) => (
              <tr key={lot.id} className="border-t hover:bg-zinc-50/50">
                <td className="p-4">
                  <button
                    onClick={() => fetchLotDetails(lot.id)}
                    className="font-mono font-bold text-sm text-primary hover:underline cursor-pointer"
                    data-testid={`lot-code-${lot.lot_code}`}
                  >
                    {lot.lot_code}
                  </button>
                </td>
                <td className="p-4 text-sm">{lot.buyer_name || '-'}</td>
                <td className="p-4 font-mono text-sm">
                  {lot.line_count || lot.total_lines ? (
                    <span className="text-primary font-medium">{lot.line_count || lot.total_lines} SKUs</span>
                  ) : lot.sku_id ? (
                    <span className="text-zinc-600">{lot.sku_id}</span>
                  ) : '-'}
                </td>
                <td className="p-4 font-mono text-sm">{lot.target_date?.slice(0, 10)}</td>
                <td className="p-4 font-mono font-bold">
                  {(lot.total_quantity || lot.required_quantity || 0).toLocaleString()}
                </td>
                <td className="p-4">
                  <span className={`text-xs font-mono px-2 py-1 rounded border ${
                    lot.priority === 'CRITICAL' ? 'bg-red-100 text-red-700 border-red-300' :
                    lot.priority === 'HIGH' ? 'bg-orange-100 text-orange-700 border-orange-300' :
                    lot.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
                    'bg-zinc-100 border-zinc-300'
                  }`}>{lot.priority}</span>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    {getReadinessIcon(lot.readiness_status)}
                    <span className={`text-xs font-mono px-2 py-1 rounded border ${getReadinessColor(lot.readiness_status)}`}>
                      {lot.readiness_status || 'N/A'}
                    </span>
                  </div>
                </td>
                <td className="p-4">
                  <span className={`text-xs font-mono px-2 py-1 rounded border ${getStatusColor(lot.status)}`}>
                    {lot.status?.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="p-4 text-right">
                  {!["DISPATCHED", "DELIVERED"].includes(lot.status) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        // Fetch full details before editing
                        try {
                          const res = await axios.get(`${API}/dispatch-lots/${lot.id}/details`, { headers: getHeaders() });
                          openEditDialog(res.data);
                        } catch (err) {
                          toast.error("Failed to load lot for editing");
                        }
                      }}
                      className="h-8 px-2"
                      data-testid={`edit-${lot.lot_code}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {filteredLots.length === 0 && (
              <tr>
                <td colSpan={9} className="p-8 text-center text-muted-foreground">
                  No dispatch lots yet. Create one from forecasted SKUs.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Lot Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Dispatch Lot: {selectedLot?.lot_code}
              </div>
              <div className="flex items-center gap-3">
                {selectedLot && !["DISPATCHED", "DELIVERED"].includes(selectedLot.status) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(selectedLot)}
                    className="uppercase text-xs"
                    data-testid="edit-lot-btn"
                  >
                    <Pencil className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                )}
                {selectedLot?.readiness_status && (
                  <div className="flex items-center gap-2">
                    {getReadinessIcon(selectedLot.readiness_status)}
                    <span className={`text-sm font-mono px-3 py-1 rounded border ${getReadinessColor(selectedLot.readiness_status)}`}>
                      {selectedLot.readiness_status === 'READY' ? 'DISPATCH READY' : 
                       selectedLot.readiness_status === 'PARTIAL' ? 'PARTIALLY READY' : 
                       'PENDING PRODUCTION'}
                  </span>
                </div>
              )}
            </DialogTitle>
          </DialogHeader>

          {loadingDetail ? (
            <div className="p-8 text-center">Loading lot details...</div>
          ) : selectedLot ? (
            <div className="space-y-6">
              {/* Lot Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-zinc-50 rounded-lg">
                  <div className="text-xs text-zinc-500 uppercase mb-1">Buyer</div>
                  <div className="font-bold">{selectedLot.buyer_name || '-'}</div>
                </div>
                <div className="p-4 bg-zinc-50 rounded-lg">
                  <div className="text-xs text-zinc-500 uppercase mb-1">Target Date</div>
                  <div className="font-mono font-bold">{selectedLot.target_date?.slice(0, 10)}</div>
                </div>
                <div className="p-4 bg-zinc-50 rounded-lg">
                  <div className="text-xs text-zinc-500 uppercase mb-1">Total Quantity</div>
                  <div className="font-mono font-bold text-xl">{(selectedLot.total_quantity || selectedLot.required_quantity || 0).toLocaleString()}</div>
                </div>
                <div className="p-4 bg-zinc-50 rounded-lg">
                  <div className="text-xs text-zinc-500 uppercase mb-1">Readiness</div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xl">{selectedLot.ready_lines || 0}</span>
                    <span className="text-zinc-500">/ {selectedLot.total_lines || 0} lines ready</span>
                  </div>
                </div>
              </div>

              {/* Readiness Progress Bar */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold uppercase">Dispatch Readiness</span>
                  <span className="font-mono font-bold text-lg">{selectedLot.readiness_pct || 0}%</span>
                </div>
                <div className="h-3 bg-zinc-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all ${
                      selectedLot.readiness_status === 'READY' ? 'bg-green-500' :
                      selectedLot.readiness_status === 'PARTIAL' ? 'bg-yellow-500' :
                      'bg-red-400'
                    }`}
                    style={{ width: `${selectedLot.readiness_pct || 0}%` }}
                  />
                </div>
              </div>

              {/* Line Items Table */}
              <div className="border rounded-lg overflow-hidden">
                <div className="p-4 bg-zinc-50 border-b">
                  <h3 className="font-bold uppercase text-sm">Line Items ({selectedLot.lines?.length || 0})</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-100">
                      <tr>
                        <th className="px-4 py-3 text-left font-mono text-xs uppercase">#</th>
                        <th className="px-4 py-3 text-left font-mono text-xs uppercase">SKU</th>
                        <th className="px-4 py-3 text-left font-mono text-xs uppercase">Description</th>
                        <th className="px-4 py-3 text-right font-mono text-xs uppercase">Required</th>
                        <th className="px-4 py-3 text-right font-mono text-xs uppercase">Available</th>
                        <th className="px-4 py-3 text-right font-mono text-xs uppercase">Pending</th>
                        <th className="px-4 py-3 text-center font-mono text-xs uppercase">Readiness</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedLot.lines?.map((line, idx) => (
                        <tr key={line.id || idx} className="border-t hover:bg-zinc-50">
                          <td className="px-4 py-3 font-mono text-zinc-500">{line.line_number || idx + 1}</td>
                          <td className="px-4 py-3 font-mono font-bold">{line.sku_id}</td>
                          <td className="px-4 py-3 text-zinc-600 truncate max-w-[200px]" title={line.sku_description}>
                            {line.sku_description || '-'}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-right">{(line.quantity || 0).toLocaleString()}</td>
                          <td className="px-4 py-3 font-mono text-right">
                            <span className={line.available_qty >= line.quantity ? 'text-green-600' : 'text-red-500'}>
                              {(line.available_qty || 0).toLocaleString()}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-right">
                            {line.pending_qty > 0 ? (
                              <span className="text-red-500 font-bold">{line.pending_qty.toLocaleString()}</span>
                            ) : (
                              <span className="text-green-600">0</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {getReadinessIcon(line.readiness_status)}
                              <span className={`text-xs font-mono px-2 py-1 rounded border ${getReadinessColor(line.readiness_status)}`}>
                                {line.readiness_status}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {(!selectedLot.lines || selectedLot.lines.length === 0) && (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                            No line items found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Notes */}
              {selectedLot.notes && (
                <div className="p-4 border rounded-lg bg-zinc-50">
                  <div className="text-xs text-zinc-500 uppercase mb-2">Notes</div>
                  <div className="text-sm">{selectedLot.notes}</div>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Edit Lot Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5" />
              Edit Dispatch Lot: {editingLot?.lot_code}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Lot Details Section */}
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-4">
                <Box className="w-4 h-4 text-primary" />
                <Label className="text-sm font-bold uppercase tracking-wide">Lot Details</Label>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-zinc-500">Target Date *</Label>
                  <Input
                    type="date"
                    value={editTargetDate}
                    onChange={(e) => setEditTargetDate(e.target.value)}
                    data-testid="edit-target-date"
                  />
                </div>
                <div>
                  <Label className="text-xs text-zinc-500">Priority</Label>
                  <Select value={editPriority} onValueChange={setEditPriority}>
                    <SelectTrigger data-testid="edit-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="CRITICAL">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="mt-4">
                <Label className="text-xs text-zinc-500">Notes</Label>
                <Input
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Optional notes for this lot"
                  data-testid="edit-notes"
                />
              </div>
            </div>

            {/* Line Items Section */}
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" />
                  <Label className="text-sm font-bold uppercase tracking-wide">Line Items</Label>
                </div>
                <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-1 rounded">
                  {editLines.length} lines | {editLines.reduce((sum, l) => sum + (l.quantity || 0), 0).toLocaleString()} units
                </span>
              </div>

              <div className="border rounded overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-100">
                    <tr>
                      <th className="px-3 py-2 text-left font-mono text-xs uppercase">#</th>
                      <th className="px-3 py-2 text-left font-mono text-xs uppercase">SKU</th>
                      <th className="px-3 py-2 text-left font-mono text-xs uppercase">Description</th>
                      <th className="px-3 py-2 text-right font-mono text-xs uppercase">Quantity</th>
                      <th className="px-3 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {editLines.map((line, idx) => (
                      <tr key={line.id || idx} className="border-t hover:bg-zinc-50">
                        <td className="px-3 py-2 font-mono text-zinc-500">{idx + 1}</td>
                        <td className="px-3 py-2 font-mono font-medium">{line.sku_id}</td>
                        <td className="px-3 py-2 text-zinc-600 truncate max-w-[150px]">{line.sku_description || '-'}</td>
                        <td className="px-3 py-2 text-right">
                          <Input
                            type="number"
                            value={line.quantity}
                            onChange={(e) => handleEditLineQuantity(idx, e.target.value)}
                            className="w-24 text-right font-mono"
                            min={1}
                            data-testid={`edit-line-qty-${idx}`}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleRemoveEditLine(idx)}
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            disabled={editLines.length <= 1}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-zinc-50 border-t">
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-right font-bold uppercase text-xs">Total</td>
                      <td className="px-3 py-2 font-mono font-bold text-right text-primary">
                        {editLines.reduce((sum, l) => sum + (l.quantity || 0), 0).toLocaleString()}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              
              <p className="text-xs text-zinc-500 mt-2">
                Note: You can adjust quantities or remove lines. Adding new SKUs requires creating a new lot.
              </p>
            </div>

            {/* Save Button */}
            <div className="flex gap-3">
              <Button 
                variant="outline"
                onClick={() => setShowEditDialog(false)}
                className="flex-1"
                disabled={savingEdit}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveEdit} 
                className="flex-1 uppercase tracking-wide"
                disabled={savingEdit || editLines.length === 0 || !editTargetDate}
                data-testid="save-edit-btn"
              >
                {savingEdit ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DispatchLots;

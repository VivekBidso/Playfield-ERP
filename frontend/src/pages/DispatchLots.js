import { useState, useEffect } from "react";
import axios from "axios";
import useAuthStore from "@/store/authStore";
import { Plus, Package, Calendar, AlertTriangle, Search } from "lucide-react";
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
  const [forecasts, setForecasts] = useState([]);
  const [forecastedSkus, setForecastedSkus] = useState([]); // SKUs that have forecasts
  const [buyers, setBuyers] = useState([]);
  const [skuBranchMap, setSkuBranchMap] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  
  // Dialog
  const [showDialog, setShowDialog] = useState(false);
  const [lotForm, setLotForm] = useState({
    sku_id: "",
    buyer_id: "",
    required_quantity: 0,
    target_date: "",
    priority: "MEDIUM",
    notes: ""
  });

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const [lotsRes, forecastsRes, buyersRes] = await Promise.all([
        axios.get(`${API}/dispatch-lots`, { headers }),
        axios.get(`${API}/forecasts`, { headers }),
        axios.get(`${API}/buyers`, { headers })
      ]);
      
      setDispatchLots(lotsRes.data);
      setForecasts(forecastsRes.data);
      setBuyers(buyersRes.data);
      
      // Extract unique SKUs from confirmed forecasts
      const confirmedForecasts = forecastsRes.data.filter(f => 
        f.status === 'CONFIRMED' || f.status === 'CONVERTED'
      );
      
      const skuSet = new Set();
      confirmedForecasts.forEach(f => {
        if (f.sku_id) {
          skuSet.add(f.sku_id);
        }
      });
      
      // Also get SKUs from existing forecasts for reference
      const skusWithForecasts = Array.from(skuSet).map(sku_id => {
        const forecast = confirmedForecasts.find(f => f.sku_id === sku_id);
        return {
          sku_id,
          forecast_qty: forecast?.quantity || 0,
          buyer_id: forecast?.buyer_id,
          vertical: forecast?.vertical_id
        };
      });
      
      setForecastedSkus(skusWithForecasts);
      
      // Fetch branch assignments
      await fetchBranchAssignments(headers);
      
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast.error("Failed to fetch data");
    }
  };

  const fetchBranchAssignments = async (headers) => {
    try {
      const res = await axios.get(`${API}/sku-branch-assignments/all`, { headers });
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

  const handleCreateLot = async () => {
    if (!lotForm.sku_id || !lotForm.target_date || !lotForm.required_quantity) {
      toast.error("Please fill all required fields");
      return;
    }
    
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      await axios.post(`${API}/dispatch-lots`, {
        sku_id: lotForm.sku_id,
        buyer_id: lotForm.buyer_id || null,
        required_quantity: lotForm.required_quantity,
        target_date: new Date(lotForm.target_date).toISOString(),
        priority: lotForm.priority,
        notes: lotForm.notes
      }, { headers });
      
      toast.success("Dispatch lot created");
      setShowDialog(false);
      setLotForm({
        sku_id: "",
        buyer_id: "",
        required_quantity: 0,
        target_date: "",
        priority: "MEDIUM",
        notes: ""
      });
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create dispatch lot");
    }
  };

  const getBuyerName = (id) => buyers.find(b => b.id === id)?.name || id || '-';

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

  // Get forecasted quantity for an SKU
  const getForecastedQty = (skuId) => {
    const totalQty = forecasts
      .filter(f => f.sku_id === skuId && (f.status === 'CONFIRMED' || f.status === 'CONVERTED'))
      .reduce((sum, f) => sum + (f.quantity || 0), 0);
    return totalQty;
  };

  // Get total dispatched quantity for an SKU
  const getDispatchedQty = (skuId) => {
    return dispatchLots
      .filter(lot => lot.sku_id === skuId)
      .reduce((sum, lot) => sum + (lot.required_quantity || 0), 0);
  };

  // Filter dispatch lots based on search
  const filteredLots = dispatchLots.filter(lot => 
    lot.lot_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lot.sku_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 md:p-8" data-testid="dispatch-lots-page">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight uppercase">Dispatch Lots</h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">
            Create lots for forecasted SKUs
          </p>
        </div>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button className="uppercase text-xs tracking-wide" data-testid="add-lot-btn">
              <Plus className="w-4 h-4 mr-2" />
              Create Dispatch Lot
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Create Dispatch Lot
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>SKU (From Forecasts Only) *</Label>
                <Select value={lotForm.sku_id} onValueChange={(v) => setLotForm({...lotForm, sku_id: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select forecasted SKU" />
                  </SelectTrigger>
                  <SelectContent>
                    {forecastedSkus.length === 0 ? (
                      <div className="p-2 text-sm text-zinc-500">No confirmed forecasts available</div>
                    ) : (
                      forecastedSkus.map(sku => {
                        const forecastQty = getForecastedQty(sku.sku_id);
                        const dispatchedQty = getDispatchedQty(sku.sku_id);
                        const remaining = forecastQty - dispatchedQty;
                        
                        return (
                          <SelectItem key={sku.sku_id} value={sku.sku_id}>
                            <div className="flex items-center justify-between w-full">
                              <span className="font-mono">{sku.sku_id}</span>
                              <span className="text-xs text-zinc-500 ml-2">
                                (Remaining: {remaining.toLocaleString()})
                              </span>
                            </div>
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
                {lotForm.sku_id && (
                  <div className="mt-2 p-2 bg-zinc-100 rounded text-xs font-mono">
                    Forecasted: {getForecastedQty(lotForm.sku_id).toLocaleString()} | 
                    Already in Lots: {getDispatchedQty(lotForm.sku_id).toLocaleString()} | 
                    <span className="font-bold text-primary">
                      Remaining: {(getForecastedQty(lotForm.sku_id) - getDispatchedQty(lotForm.sku_id)).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <Label>Buyer</Label>
                <Select value={lotForm.buyer_id || "_none"} onValueChange={(v) => setLotForm({...lotForm, buyer_id: v === "_none" ? "" : v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select buyer (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">No specific buyer</SelectItem>
                    {buyers.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Quantity *</Label>
                <Input
                  type="number"
                  value={lotForm.required_quantity}
                  onChange={(e) => setLotForm({...lotForm, required_quantity: parseInt(e.target.value) || 0})}
                  placeholder="Enter quantity"
                />
              </div>

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

              <div>
                <Label>Notes</Label>
                <Input
                  value={lotForm.notes}
                  onChange={(e) => setLotForm({...lotForm, notes: e.target.value})}
                  placeholder="Optional notes"
                />
              </div>

              <Button onClick={handleCreateLot} className="w-full">
                Create Dispatch Lot
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="mb-4 flex items-center gap-2 max-w-md">
        <Search className="w-4 h-4 text-zinc-400" />
        <Input
          placeholder="Search by lot code or SKU..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="font-mono"
        />
      </div>

      {/* Dispatch Lots Table */}
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
              <th className="h-10 px-4 text-left font-mono text-xs uppercase">Priority</th>
              <th className="h-10 px-4 text-left font-mono text-xs uppercase">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredLots.map((lot) => {
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
                    <span className={`text-xs font-mono px-2 py-1 rounded border ${
                      lot.priority === 'CRITICAL' ? 'bg-red-100 text-red-700 border-red-300' :
                      lot.priority === 'HIGH' ? 'bg-orange-100 text-orange-700 border-orange-300' :
                      lot.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
                      'bg-zinc-100 border-zinc-300'
                    }`}>{lot.priority}</span>
                  </td>
                  <td className="p-4">
                    <span className={`text-xs font-mono px-2 py-1 rounded border ${getStatusColor(lot.status)}`}>
                      {lot.status?.replace(/_/g, ' ')}
                    </span>
                  </td>
                </tr>
              );
            })}
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
    </div>
  );
};

export default DispatchLots;

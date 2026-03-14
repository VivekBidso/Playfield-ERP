import { useState, useEffect } from "react";
import axios from "axios";
import { Plus, TrendingUp, Package, Calendar, Target } from "lucide-react";
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
  const [activeTab, setActiveTab] = useState("forecasts");
  
  // Data
  const [forecasts, setForecasts] = useState([]);
  const [dispatchLots, setDispatchLots] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [skus, setSkus] = useState([]);
  const [verticals, setVerticals] = useState([]);
  
  // Dialogs
  const [showForecastDialog, setShowForecastDialog] = useState(false);
  const [showLotDialog, setShowLotDialog] = useState(false);
  
  // Forms
  const [forecastForm, setForecastForm] = useState({
    buyer_id: "", vertical_id: "", sku_id: "", 
    forecast_month: new Date().toISOString().slice(0, 7),
    quantity: 0, priority: "MEDIUM", notes: ""
  });
  const [lotForm, setLotForm] = useState({
    forecast_id: "", sku_id: "", buyer_id: "",
    required_quantity: 0, target_date: "", priority: "MEDIUM"
  });

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      const [forecastsRes, lotsRes, buyersRes, skusRes, verticalsRes] = await Promise.all([
        axios.get(`${API}/forecasts`),
        axios.get(`${API}/dispatch-lots`),
        axios.get(`${API}/buyers`),
        axios.get(`${API}/skus`),
        axios.get(`${API}/verticals`)
      ]);
      setForecasts(forecastsRes.data);
      setDispatchLots(lotsRes.data);
      setBuyers(buyersRes.data);
      setSkus(skusRes.data);
      setVerticals(verticalsRes.data);
    } catch (error) {
      toast.error("Failed to fetch data");
    }
  };

  const handleCreateForecast = async () => {
    try {
      await axios.post(`${API}/forecasts`, {
        ...forecastForm,
        forecast_month: new Date(forecastForm.forecast_month + "-01").toISOString()
      });
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

  const handleCreateLot = async () => {
    try {
      await axios.post(`${API}/dispatch-lots`, {
        ...lotForm,
        target_date: new Date(lotForm.target_date).toISOString()
      });
      toast.success("Dispatch lot created");
      setShowLotDialog(false);
      setLotForm({
        forecast_id: "", sku_id: "", buyer_id: "",
        required_quantity: 0, target_date: "", priority: "MEDIUM"
      });
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create dispatch lot");
    }
  };

  const handleConfirmForecast = async (id) => {
    try {
      await axios.put(`${API}/forecasts/${id}/confirm`);
      toast.success("Forecast confirmed");
      fetchAllData();
    } catch (error) {
      toast.error("Failed to confirm forecast");
    }
  };

  const getBuyerName = (id) => buyers.find(b => b.id === id)?.name || id || '-';
  const getVerticalName = (id) => verticals.find(v => v.id === id)?.name || id || '-';
  const getSkuId = (id) => skus.find(s => s.id === id || s.sku_id === id)?.sku_id || id || '-';

  const getStatusColor = (status) => {
    const colors = {
      'DRAFT': 'bg-zinc-100 text-zinc-700',
      'CONFIRMED': 'bg-blue-100 text-blue-700',
      'CONVERTED': 'bg-green-100 text-green-700',
      'CREATED': 'bg-zinc-100 text-zinc-700',
      'PRODUCTION_ASSIGNED': 'bg-yellow-100 text-yellow-700',
      'PARTIALLY_PRODUCED': 'bg-orange-100 text-orange-700',
      'FULLY_PRODUCED': 'bg-blue-100 text-blue-700',
      'QC_CLEARED': 'bg-teal-100 text-teal-700',
      'DISPATCH_READY': 'bg-purple-100 text-purple-700',
      'DISPATCHED': 'bg-green-100 text-green-700',
      'DELIVERED': 'bg-green-200 text-green-800'
    };
    return colors[status] || 'bg-zinc-100 text-zinc-700';
  };

  return (
    <div className="p-6 md:p-8" data-testid="demand-page">
      <div className="mb-8">
        <h1 className="text-4xl font-black tracking-tight uppercase">Demand</h1>
        <p className="text-sm text-muted-foreground mt-1 font-mono">Forecasting & Dispatch Lots</p>
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
                    <Label>Buyer</Label>
                    <Select value={forecastForm.buyer_id} onValueChange={(v) => setForecastForm({...forecastForm, buyer_id: v})}>
                      <SelectTrigger><SelectValue placeholder="Select buyer" /></SelectTrigger>
                      <SelectContent>
                        {buyers.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Vertical</Label>
                    <Select value={forecastForm.vertical_id} onValueChange={(v) => setForecastForm({...forecastForm, vertical_id: v})}>
                      <SelectTrigger><SelectValue placeholder="Select vertical" /></SelectTrigger>
                      <SelectContent>
                        {verticals.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>SKU (Optional)</Label>
                    <Select value={forecastForm.sku_id} onValueChange={(v) => setForecastForm({...forecastForm, sku_id: v})}>
                      <SelectTrigger><SelectValue placeholder="Select SKU" /></SelectTrigger>
                      <SelectContent>
                        {skus.slice(0, 100).map(s => <SelectItem key={s.sku_id} value={s.sku_id}>{s.sku_id}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Forecast Month</Label>
                    <Input 
                      type="month" 
                      value={forecastForm.forecast_month}
                      onChange={(e) => setForecastForm({...forecastForm, forecast_month: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label>Quantity</Label>
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
          
          <div className="border rounded-sm overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Code</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Month</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Buyer</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Vertical</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Quantity</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Priority</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Status</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {forecasts.map((f) => (
                  <tr key={f.id} className="border-t">
                    <td className="p-4 font-mono font-bold text-sm">{f.forecast_code}</td>
                    <td className="p-4 font-mono text-sm">{f.forecast_month?.slice(0, 7)}</td>
                    <td className="p-4 text-sm">{getBuyerName(f.buyer_id)}</td>
                    <td className="p-4 text-sm">{getVerticalName(f.vertical_id)}</td>
                    <td className="p-4 font-mono font-bold">{f.quantity?.toLocaleString()}</td>
                    <td className="p-4">
                      <span className={`text-xs font-mono px-2 py-1 rounded ${
                        f.priority === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                        f.priority === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                        f.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-zinc-100'
                      }`}>{f.priority}</span>
                    </td>
                    <td className="p-4">
                      <span className={`text-xs font-mono px-2 py-1 rounded ${getStatusColor(f.status)}`}>{f.status}</span>
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
                  <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No forecasts</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Dispatch Lots Tab */}
        <TabsContent value="dispatch-lots">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold">Dispatch Lots</h2>
            <Dialog open={showLotDialog} onOpenChange={setShowLotDialog}>
              <DialogTrigger asChild>
                <Button className="uppercase text-xs tracking-wide" data-testid="add-lot-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Lot
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create Dispatch Lot</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>SKU</Label>
                    <Select value={lotForm.sku_id} onValueChange={(v) => setLotForm({...lotForm, sku_id: v})}>
                      <SelectTrigger><SelectValue placeholder="Select SKU" /></SelectTrigger>
                      <SelectContent>
                        {skus.slice(0, 100).map(s => <SelectItem key={s.sku_id} value={s.sku_id}>{s.sku_id}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Buyer</Label>
                    <Select value={lotForm.buyer_id} onValueChange={(v) => setLotForm({...lotForm, buyer_id: v})}>
                      <SelectTrigger><SelectValue placeholder="Select buyer" /></SelectTrigger>
                      <SelectContent>
                        {buyers.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Required Quantity</Label>
                    <Input 
                      type="number"
                      value={lotForm.required_quantity}
                      onChange={(e) => setLotForm({...lotForm, required_quantity: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <Label>Target Date</Label>
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
                  <Button onClick={handleCreateLot} className="w-full">Create Lot</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          
          <div className="border rounded-sm overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Lot Code</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">SKU</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Buyer</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Target Date</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Required</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Produced</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">QC Passed</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Dispatched</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {dispatchLots.map((lot) => (
                  <tr key={lot.id} className="border-t">
                    <td className="p-4 font-mono font-bold text-sm">{lot.lot_code}</td>
                    <td className="p-4 font-mono text-sm">{lot.sku_id}</td>
                    <td className="p-4 text-sm">{getBuyerName(lot.buyer_id)}</td>
                    <td className="p-4 font-mono text-sm">{lot.target_date?.slice(0, 10)}</td>
                    <td className="p-4 font-mono font-bold">{lot.required_quantity?.toLocaleString()}</td>
                    <td className="p-4 font-mono">{lot.produced_quantity?.toLocaleString()}</td>
                    <td className="p-4 font-mono">{lot.qc_passed_quantity?.toLocaleString()}</td>
                    <td className="p-4 font-mono">{lot.dispatched_quantity?.toLocaleString()}</td>
                    <td className="p-4">
                      <span className={`text-xs font-mono px-2 py-1 rounded ${getStatusColor(lot.status)}`}>
                        {lot.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
                {dispatchLots.length === 0 && (
                  <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No dispatch lots</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Demand;

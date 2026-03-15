import { useState, useEffect } from "react";
import axios from "axios";
import { 
  Plus, 
  Calendar, 
  Building2, 
  Play, 
  CheckCircle, 
  AlertCircle,
  Zap,
  Target,
  BarChart3,
  RefreshCw,
  Factory,
  TrendingUp,
  Package,
  Download,
  Upload,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CPC = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  
  // Data
  const [dashboard, setDashboard] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [branchCapacities, setBranchCapacities] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [skus, setSkus] = useState([]);
  const [dispatchLots, setDispatchLots] = useState([]);
  
  // NEW: Demand Forecasts data
  const [demandForecasts, setDemandForecasts] = useState([]);
  const [forecastSummary, setForecastSummary] = useState(null);
  
  // NEW: Model Capacity Upload
  const [showModelCapacityDialog, setShowModelCapacityDialog] = useState(false);
  const [modelCapacityBranch, setModelCapacityBranch] = useState("");
  const [modelCapacityRows, setModelCapacityRows] = useState([{ month: "", day: 1, model_id: "", capacity_qty: 0 }]);
  const [models, setModels] = useState([]);
  const [uploadingCapacity, setUploadingCapacity] = useState(false);
  
  // Dialogs
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showCapacityDialog, setShowCapacityDialog] = useState(false);
  const [showAllocateDialog, setShowAllocateDialog] = useState(false);
  const [showScheduleFromForecastDialog, setShowScheduleFromForecastDialog] = useState(false);
  
  // Form Data
  const [scheduleForm, setScheduleForm] = useState({
    dispatch_lot_id: "",
    sku_id: "",
    target_quantity: 0,
    target_date: "",
    priority: "MEDIUM",
    notes: ""
  });
  const [capacityForm, setCapacityForm] = useState({
    branch: "",
    capacity_units_per_day: 0
  });
  const [allocateForm, setAllocateForm] = useState({
    schedule_id: "",
    preferred_branches: []
  });
  
  // NEW: Schedule from forecast form
  const [forecastScheduleForm, setForecastScheduleForm] = useState({
    forecast_id: "",
    forecast_code: "",
    sku_id: "",
    remaining_qty: 0,
    quantity: 0,
    target_date: "",
    branch: "",
    priority: "MEDIUM"
  });
  
  // NEW: Available branches for scheduling
  const [availableBranches, setAvailableBranches] = useState([]);
  const [branchCapacityInfo, setBranchCapacityInfo] = useState(null);
  const [loadingBranches, setLoadingBranches] = useState(false);
  
  // Loading & Selected
  const [loading, setLoading] = useState(true);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [branchForecast, setBranchForecast] = useState(null);
  
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [dashRes, schedRes, capRes, sugRes, skuRes, lotsRes, forecastRes, forecastSumRes] = await Promise.all([
        axios.get(`${API}/cpc/dashboard`),
        axios.get(`${API}/production-schedules`),
        axios.get(`${API}/branches/capacity`),
        axios.get(`${API}/cpc/schedule-suggestions`),
        axios.get(`${API}/skus`),
        axios.get(`${API}/dispatch-lots`),
        axios.get(`${API}/cpc/demand-forecasts`).catch(() => ({ data: [] })),
        axios.get(`${API}/cpc/demand-forecasts/summary`).catch(() => ({ data: null }))
      ]);
      setDashboard(dashRes.data);
      setSchedules(schedRes.data);
      setBranchCapacities(capRes.data);
      setSuggestions(sugRes.data);
      setSkus(skuRes.data);
      setDispatchLots(lotsRes.data.filter(l => l.status === 'CREATED'));
      setDemandForecasts(forecastRes.data);
      setForecastSummary(forecastSumRes.data);
      
      // Fetch models for capacity upload
      fetchModels();
    } catch (error) {
      toast.error("Failed to fetch CPC data");
    }
    setLoading(false);
  };

  const handleCreateSchedule = async () => {
    try {
      const payload = {
        ...scheduleForm,
        target_date: new Date(scheduleForm.target_date).toISOString(),
        target_quantity: parseInt(scheduleForm.target_quantity)
      };
      if (!payload.dispatch_lot_id) delete payload.dispatch_lot_id;
      
      await axios.post(`${API}/production-schedules`, payload);
      toast.success("Production schedule created");
      setShowScheduleDialog(false);
      setScheduleForm({ dispatch_lot_id: "", sku_id: "", target_quantity: 0, target_date: "", priority: "MEDIUM", notes: "" });
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create schedule");
    }
  };

  const handleUpdateCapacity = async () => {
    try {
      await axios.put(`${API}/branches/${capacityForm.branch}/capacity`, {
        capacity_units_per_day: parseInt(capacityForm.capacity_units_per_day)
      });
      toast.success("Branch capacity updated");
      setShowCapacityDialog(false);
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update capacity");
    }
  };

  const handleAutoAllocate = async () => {
    try {
      const res = await axios.post(`${API}/branch-allocations/auto-allocate`, {
        schedule_id: allocateForm.schedule_id,
        preferred_branches: allocateForm.preferred_branches.length > 0 ? allocateForm.preferred_branches : null
      });
      toast.success(res.data.message);
      setShowAllocateDialog(false);
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to auto-allocate");
    }
  };

  const handleStartProduction = async (allocationId) => {
    try {
      await axios.put(`${API}/branch-allocations/${allocationId}/start`);
      toast.success("Production started");
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to start production");
    }
  };

  // Fetch models for capacity upload
  const fetchModels = async () => {
    try {
      const res = await axios.get(`${API}/models`);
      setModels(res.data || []);
    } catch (error) {
      console.error("Failed to fetch models:", error);
    }
  };

  // Handle model capacity upload
  const handleUploadModelCapacity = async () => {
    if (!modelCapacityBranch) {
      toast.error("Please select a branch");
      return;
    }
    
    const validRows = modelCapacityRows.filter(r => r.month && r.model_id && r.capacity_qty > 0);
    if (validRows.length === 0) {
      toast.error("Please add at least one valid capacity row");
      return;
    }
    
    setUploadingCapacity(true);
    try {
      const payload = {
        branch: modelCapacityBranch,
        capacities: validRows.map(r => ({
          month: r.month,
          day: parseInt(r.day),
          model_id: r.model_id,
          capacity_qty: parseInt(r.capacity_qty)
        }))
      };
      
      const res = await axios.post(`${API}/branches/model-capacity/upload`, payload);
      toast.success(`Uploaded ${res.data.total} capacity records (${res.data.inserted} new, ${res.data.updated} updated)`);
      setShowModelCapacityDialog(false);
      setModelCapacityRows([{ month: "", day: 1, model_id: "", capacity_qty: 0 }]);
      setModelCapacityBranch("");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to upload capacity");
    } finally {
      setUploadingCapacity(false);
    }
  };

  const addModelCapacityRow = () => {
    setModelCapacityRows([...modelCapacityRows, { month: "", day: 1, model_id: "", capacity_qty: 0 }]);
  };

  const removeModelCapacityRow = (index) => {
    if (modelCapacityRows.length > 1) {
      setModelCapacityRows(modelCapacityRows.filter((_, i) => i !== index));
    }
  };

  const updateModelCapacityRow = (index, field, value) => {
    const updated = [...modelCapacityRows];
    updated[index][field] = value;
    setModelCapacityRows(updated);
  };

  const fetchBranchForecast = async (branchName) => {
    try {
      const res = await axios.get(`${API}/branches/${encodeURIComponent(branchName)}/capacity-forecast?days=7`);
      setBranchForecast(res.data);
    } catch (error) {
      toast.error("Failed to load forecast");
    }
  };

  // NEW: Fetch available branches for a SKU
  const fetchAvailableBranches = async (skuId) => {
    setLoadingBranches(true);
    try {
      const res = await axios.get(`${API}/skus/${skuId}/assigned-branches`);
      setAvailableBranches(res.data.branches || []);
    } catch (error) {
      console.error("Failed to fetch branches:", error);
      setAvailableBranches([]);
    } finally {
      setLoadingBranches(false);
    }
  };

  // NEW: Fetch capacity info for a branch on a specific date
  const fetchBranchCapacityForDate = async (branch, date) => {
    if (!branch || !date) {
      setBranchCapacityInfo(null);
      return;
    }
    try {
      const res = await axios.get(`${API}/branches/${encodeURIComponent(branch)}/capacity-for-date?date_str=${date}`);
      setBranchCapacityInfo(res.data);
    } catch (error) {
      console.error("Failed to fetch capacity:", error);
      setBranchCapacityInfo(null);
    }
  };

  const openCapacityDialog = (branch) => {
    setCapacityForm({
      branch: branch.branch,
      capacity_units_per_day: branch.capacity_units_per_day
    });
    setShowCapacityDialog(true);
  };

  const openAllocateDialog = (schedule) => {
    setAllocateForm({
      schedule_id: schedule.id,
      preferred_branches: []
    });
    setShowAllocateDialog(true);
  };

  const createFromSuggestion = (sug) => {
    setScheduleForm({
      dispatch_lot_id: sug.dispatch_lot_id,
      sku_id: sug.sku_id,
      target_quantity: sug.required_quantity,
      target_date: sug.target_date ? new Date(sug.target_date).toISOString().split('T')[0] : "",
      priority: sug.priority || "MEDIUM",
      notes: `From Dispatch Lot: ${sug.lot_code}`
    });
    setShowScheduleDialog(true);
  };

  const getStatusBadge = (status) => {
    const colors = {
      DRAFT: "bg-zinc-200 text-zinc-800",
      SCHEDULED: "bg-blue-100 text-blue-800",
      IN_PROGRESS: "bg-yellow-100 text-yellow-800",
      COMPLETED: "bg-green-100 text-green-800",
      CANCELLED: "bg-red-100 text-red-800"
    };
    return <Badge className={colors[status] || "bg-zinc-200"}>{status}</Badge>;
  };

  const getPriorityBadge = (priority) => {
    const colors = {
      LOW: "bg-zinc-100 text-zinc-600",
      MEDIUM: "bg-blue-100 text-blue-700",
      HIGH: "bg-orange-100 text-orange-700",
      CRITICAL: "bg-red-100 text-red-700"
    };
    return <Badge variant="outline" className={colors[priority] || ""}>{priority}</Badge>;
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center" data-testid="cpc-loading">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        Loading CPC data...
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8" data-testid="cpc-page">
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-black tracking-tight uppercase">CPC</h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">Central Production Control</p>
        </div>
        <Button onClick={() => setShowScheduleDialog(true)} className="uppercase text-xs tracking-wide" data-testid="create-schedule-btn">
          <Plus className="w-4 h-4 mr-2" />
          New Schedule
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="dashboard" className="uppercase text-xs tracking-wide">
            <BarChart3 className="w-4 h-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="forecasts" className="uppercase text-xs tracking-wide" data-testid="forecasts-tab">
            <TrendingUp className="w-4 h-4 mr-2" />
            Demand Forecasts ({demandForecasts.filter(f => !f.is_fully_scheduled).length})
          </TabsTrigger>
          <TabsTrigger value="schedules" className="uppercase text-xs tracking-wide">
            <Calendar className="w-4 h-4 mr-2" />
            Schedules ({schedules.length})
          </TabsTrigger>
          <TabsTrigger value="capacity" className="uppercase text-xs tracking-wide">
            <Building2 className="w-4 h-4 mr-2" />
            Branch Capacity
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="uppercase text-xs tracking-wide">
            <Target className="w-4 h-4 mr-2" />
            Suggestions ({suggestions.length})
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono uppercase text-muted-foreground">Pending Schedules</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black">{dashboard?.pending_schedules || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono uppercase text-muted-foreground">In Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-yellow-600">{dashboard?.in_progress_schedules || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono uppercase text-muted-foreground">Today's Planned</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-blue-600">{dashboard?.todays_planned_quantity || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono uppercase text-muted-foreground">Today's Completed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-green-600">{dashboard?.todays_completed_quantity || 0}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-bold">Branch Utilization Today</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboard?.branch_utilization?.map((b) => (
                  <div key={b.branch} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-mono">{b.branch}</span>
                      <span className="text-muted-foreground">
                        {b.allocated} / {b.capacity} ({b.utilization}%)
                      </span>
                    </div>
                    <Progress value={b.utilization} className="h-2" />
                  </div>
                ))}
                {(!dashboard?.branch_utilization || dashboard.branch_utilization.length === 0) && (
                  <p className="text-muted-foreground text-center py-4">No branch utilization data</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Demand Forecasts Tab */}
        <TabsContent value="forecasts" data-testid="forecasts-content">
          {/* Forecast Summary */}
          {forecastSummary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-mono uppercase text-muted-foreground">Total Forecasts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black">{forecastSummary.total_forecasts}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-mono uppercase text-muted-foreground">Forecast Qty</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black text-blue-600">{forecastSummary.total_forecast_qty?.toLocaleString()}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-mono uppercase text-muted-foreground">Scheduled</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black text-green-600">{forecastSummary.total_scheduled_qty?.toLocaleString()}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-mono uppercase text-muted-foreground">Remaining</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black text-orange-600">{forecastSummary.remaining_to_schedule?.toLocaleString()}</div>
                  <Progress value={forecastSummary.scheduling_percent || 0} className="h-2 mt-2" />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Forecast Table */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Demand Forecasts from Demand Team
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    View confirmed forecasts, plan production, and see linked dispatch lots
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    window.open(`${API}/cpc/demand-forecasts/download`, '_blank');
                  }}
                  className="uppercase text-xs tracking-wide"
                  data-testid="download-forecasts-btn"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Excel
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-sm overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50">
                    <tr>
                      <th className="h-10 px-4 text-left font-mono text-xs uppercase">Forecast ID</th>
                      <th className="h-10 px-4 text-left font-mono text-xs uppercase">Buyer</th>
                      <th className="h-10 px-4 text-left font-mono text-xs uppercase">SKU</th>
                      <th className="h-10 px-4 text-left font-mono text-xs uppercase">Month</th>
                      <th className="h-10 px-4 text-right font-mono text-xs uppercase">Forecast Qty</th>
                      <th className="h-10 px-4 text-right font-mono text-xs uppercase">Planned</th>
                      <th className="h-10 px-4 text-right font-mono text-xs uppercase">Remaining</th>
                      <th className="h-10 px-4 text-center font-mono text-xs uppercase">Dispatch Lots</th>
                      <th className="h-10 px-4 text-center font-mono text-xs uppercase">Status</th>
                      <th className="h-10 px-4 text-center font-mono text-xs uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {demandForecasts.map((f) => (
                      <tr key={f.id} className={`border-t hover:bg-zinc-50/50 ${f.is_fully_scheduled ? 'opacity-50' : ''}`}>
                        <td className="p-4 font-mono text-sm font-bold text-primary">{f.forecast_code}</td>
                        <td className="p-4 text-sm">{f.buyer_name || '-'}</td>
                        <td className="p-4">
                          <div className="font-mono text-sm font-bold">{f.sku_id || f.vertical_name}</div>
                          <div className="text-xs text-zinc-500 truncate max-w-[200px]">{f.sku_description}</div>
                        </td>
                        <td className="p-4 font-mono text-sm">{f.forecast_month?.slice(0, 7)}</td>
                        <td className="p-4 font-mono font-bold text-right">{f.forecast_qty?.toLocaleString()}</td>
                        <td className="p-4 font-mono text-right text-green-600">{f.scheduled_qty?.toLocaleString() || 0}</td>
                        <td className="p-4 font-mono font-bold text-right">
                          <span className={f.remaining_qty > 0 ? 'text-orange-600' : 'text-green-600'}>
                            {f.remaining_qty?.toLocaleString()}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          {f.dispatch_lots && f.dispatch_lots.length > 0 ? (
                            <div className="text-xs">
                              {f.dispatch_lots.map((lot, i) => (
                                <div key={i} className="font-mono text-blue-600">{lot.lot_code}</div>
                              ))}
                              <div className="text-zinc-500 mt-1">({f.dispatch_qty?.toLocaleString()} units)</div>
                            </div>
                          ) : (
                            <span className="text-xs text-zinc-400">-</span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {f.is_fully_scheduled ? (
                            <Badge className="bg-green-100 text-green-700">Fully Scheduled</Badge>
                          ) : (
                            <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {!f.is_fully_scheduled && f.sku_id && (
                            <Button
                              size="sm"
                              onClick={async () => {
                                setForecastScheduleForm({
                                  forecast_id: f.id,
                                  forecast_code: f.forecast_code,
                                  sku_id: f.sku_id,
                                  remaining_qty: f.remaining_qty,
                                  quantity: f.remaining_qty,
                                  target_date: "",
                                  branch: "",
                                  priority: f.priority || "MEDIUM"
                                });
                                setBranchCapacityInfo(null);
                                await fetchAvailableBranches(f.sku_id);
                                setShowScheduleFromForecastDialog(true);
                              }}
                              className="uppercase text-xs"
                              data-testid={`schedule-forecast-${f.forecast_code}`}
                            >
                              <Factory className="w-3 h-3 mr-1" />
                              Plan
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {demandForecasts.length === 0 && (
                      <tr>
                        <td colSpan={10} className="p-8 text-center text-muted-foreground">
                          No confirmed demand forecasts yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Schedules Tab */}
        <TabsContent value="schedules">
          <div className="border rounded-sm">
            <table className="w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Code</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">SKU</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Target Qty</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Allocated</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Completed</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Target Date</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Priority</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Status</th>
                  <th className="h-10 px-4 text-right font-mono text-xs uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="p-4 font-mono font-bold">{s.schedule_code}</td>
                    <td className="p-4 text-sm">
                      <div>{s.sku_id}</div>
                      <div className="text-xs text-muted-foreground">{s.sku_description}</div>
                    </td>
                    <td className="p-4 font-mono">{s.target_quantity}</td>
                    <td className="p-4 font-mono">{s.total_allocated || 0}</td>
                    <td className="p-4 font-mono text-green-600">{s.total_completed || 0}</td>
                    <td className="p-4 text-sm">
                      {s.target_date ? new Date(s.target_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="p-4">{getPriorityBadge(s.priority)}</td>
                    <td className="p-4">{getStatusBadge(s.status)}</td>
                    <td className="p-4 text-right">
                      {(s.status === 'DRAFT' || s.status === 'SCHEDULED') && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => openAllocateDialog(s)}
                          data-testid={`auto-allocate-${s.schedule_code}`}
                        >
                          <Zap className="w-4 h-4 mr-1" />
                          Auto-Allocate
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedSchedule(s)}
                        data-testid={`view-schedule-${s.schedule_code}`}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
                {schedules.length === 0 && (
                  <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No production schedules</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Schedule Detail View */}
          {selectedSchedule && (
            <Card className="mt-6">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Schedule: {selectedSchedule.schedule_code}</CardTitle>
                  <Button variant="ghost" onClick={() => setSelectedSchedule(null)}>Close</Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div><span className="text-muted-foreground text-sm">SKU:</span> <strong>{selectedSchedule.sku_id}</strong></div>
                  <div><span className="text-muted-foreground text-sm">Target:</span> <strong>{selectedSchedule.target_quantity}</strong></div>
                  <div><span className="text-muted-foreground text-sm">Allocated:</span> <strong>{selectedSchedule.total_allocated || 0}</strong></div>
                  <div><span className="text-muted-foreground text-sm">Completed:</span> <strong className="text-green-600">{selectedSchedule.total_completed || 0}</strong></div>
                </div>
                
                <h4 className="font-bold mb-2 mt-4">Branch Allocations</h4>
                <div className="border rounded-sm">
                  <table className="w-full">
                    <thead className="bg-zinc-50">
                      <tr>
                        <th className="h-8 px-3 text-left font-mono text-xs uppercase">Branch</th>
                        <th className="h-8 px-3 text-left font-mono text-xs uppercase">Allocated</th>
                        <th className="h-8 px-3 text-left font-mono text-xs uppercase">Completed</th>
                        <th className="h-8 px-3 text-left font-mono text-xs uppercase">Date</th>
                        <th className="h-8 px-3 text-left font-mono text-xs uppercase">Status</th>
                        <th className="h-8 px-3 text-right font-mono text-xs uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSchedule.allocations?.map((a) => (
                        <tr key={a.id} className="border-t">
                          <td className="p-3 font-mono">{a.branch}</td>
                          <td className="p-3">{a.allocated_quantity}</td>
                          <td className="p-3 text-green-600">{a.completed_quantity || 0}</td>
                          <td className="p-3 text-sm">{a.planned_date ? new Date(a.planned_date).toLocaleDateString() : '-'}</td>
                          <td className="p-3">{getStatusBadge(a.status)}</td>
                          <td className="p-3 text-right">
                            {a.status === 'PENDING' && (
                              <Button size="sm" onClick={() => handleStartProduction(a.id)}>
                                <Play className="w-4 h-4 mr-1" />
                                Start
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {(!selectedSchedule.allocations || selectedSchedule.allocations.length === 0) && (
                        <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No allocations yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Branch Capacity Tab */}
        <TabsContent value="capacity">
          {/* Model Capacity Upload Section */}
          <Card className="mb-6">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Upload className="w-5 h-5" />
                    Model-Specific Capacity Upload
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Upload capacity by Month, Day, Model to override base capacity for specific days
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline"
                    onClick={() => window.open(`${API}/branches/model-capacity/template`, '_blank')}
                    className="uppercase text-xs"
                    data-testid="download-capacity-template"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Template
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => document.getElementById('capacity-excel-upload').click()}
                    className="uppercase text-xs"
                    data-testid="upload-capacity-excel"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Excel
                  </Button>
                  <input
                    id="capacity-excel-upload"
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      
                      const formData = new FormData();
                      formData.append('file', file);
                      
                      try {
                        const res = await axios.post(`${API}/branches/model-capacity/upload-excel`, formData, {
                          headers: { 'Content-Type': 'multipart/form-data' }
                        });
                        
                        if (res.data.total_errors > 0) {
                          toast.warning(`Uploaded ${res.data.total_processed} records with ${res.data.total_errors} errors`);
                        } else {
                          toast.success(`Successfully uploaded ${res.data.total_processed} capacity records`);
                        }
                        fetchAllData();
                      } catch (error) {
                        toast.error(error.response?.data?.detail || "Failed to upload Excel");
                      }
                      e.target.value = '';
                    }}
                  />
                  <Button 
                    onClick={() => setShowModelCapacityDialog(true)}
                    className="uppercase text-xs"
                    data-testid="open-model-capacity-upload"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Manual Entry
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {branchCapacities.map((b) => (
              <Card key={b.branch} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => fetchBranchForecast(b.branch)}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-sm font-mono">{b.branch}</CardTitle>
                      {b.capacity_source === 'model_specific' && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded mt-1 inline-block">
                          {b.model_capacity_count} model(s) today
                        </span>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openCapacityDialog(b); }} data-testid={`edit-capacity-${b.branch}`}>
                      Edit
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-end mb-2">
                    <div>
                      <div className="text-2xl font-black">{b.capacity_units_per_day}</div>
                      <div className="text-xs text-muted-foreground">
                        {b.capacity_source === 'model_specific' ? 'model capacity today' : 'units/day (base)'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold ${b.utilization_percent > 80 ? 'text-red-600' : b.utilization_percent > 50 ? 'text-yellow-600' : 'text-green-600'}`}>
                        {b.utilization_percent}%
                      </div>
                      <div className="text-xs text-muted-foreground">utilized today</div>
                    </div>
                  </div>
                  <Progress value={b.utilization_percent} className="h-2" />
                  <div className="mt-2 text-sm text-muted-foreground">
                    <span className="text-green-600 font-mono">{b.available_today}</span> available today
                  </div>
                </CardContent>
              </Card>
            ))}
            {branchCapacities.length === 0 && (
              <div className="col-span-3 p-8 text-center text-muted-foreground">No branch capacity data</div>
            )}
          </div>

          {/* Branch Forecast */}
          {branchForecast && (
            <Card className="mt-6">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>{branchForecast.branch} - 7 Day Forecast</CardTitle>
                  <Button variant="ghost" onClick={() => setBranchForecast(null)}>Close</Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {branchForecast.forecast?.map((f) => (
                    <div key={f.date} className="flex items-center gap-4">
                      <div className="w-24 text-sm font-mono">{f.day.slice(0, 3)}</div>
                      <div className="w-24 text-xs text-muted-foreground">{f.date}</div>
                      <div className="flex-1">
                        <Progress value={f.utilization_percent} className="h-2" />
                      </div>
                      <div className="w-20 text-right text-sm">
                        <span className={f.utilization_percent > 80 ? 'text-red-600' : 'text-green-600'}>
                          {f.available}
                        </span>
                        <span className="text-muted-foreground"> / {f.capacity}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Suggestions Tab */}
        <TabsContent value="suggestions">
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">
              Dispatch lots that need production scheduling. Click to create a schedule.
            </p>
          </div>
          
          <div className="border rounded-sm">
            <table className="w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Lot Code</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">SKU</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Required Qty</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Target Date</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Priority</th>
                  <th className="h-10 px-4 text-right font-mono text-xs uppercase">Action</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((s) => (
                  <tr key={s.dispatch_lot_id} className="border-t">
                    <td className="p-4 font-mono font-bold">{s.lot_code}</td>
                    <td className="p-4 text-sm">
                      <div>{s.sku_id}</div>
                      <div className="text-xs text-muted-foreground">{s.sku_description}</div>
                    </td>
                    <td className="p-4 font-mono">{s.required_quantity}</td>
                    <td className="p-4 text-sm">
                      {s.target_date ? new Date(s.target_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="p-4">{getPriorityBadge(s.priority)}</td>
                    <td className="p-4 text-right">
                      <Button onClick={() => createFromSuggestion(s)} data-testid={`create-from-suggestion-${s.lot_code}`}>
                        <Plus className="w-4 h-4 mr-1" />
                        Create Schedule
                      </Button>
                    </td>
                  </tr>
                ))}
                {suggestions.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">
                    <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                    All dispatch lots have been scheduled!
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Schedule Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Production Schedule</DialogTitle>
            <DialogDescription>Schedule production for an SKU or dispatch lot</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Dispatch Lot (Optional)</Label>
              <Select 
                value={scheduleForm.dispatch_lot_id || "none"} 
                onValueChange={(v) => {
                  const actualValue = v === "none" ? "" : v;
                  setScheduleForm({...scheduleForm, dispatch_lot_id: actualValue});
                  const lot = dispatchLots.find(l => l.id === v);
                  if (lot) {
                    setScheduleForm(f => ({
                      ...f, 
                      sku_id: lot.sku_id,
                      target_quantity: lot.required_quantity,
                      dispatch_lot_id: v
                    }));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select dispatch lot" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {dispatchLots.map(l => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.lot_code} - {l.sku_id} ({l.required_quantity} units)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>SKU *</Label>
              <Select value={scheduleForm.sku_id} onValueChange={(v) => setScheduleForm({...scheduleForm, sku_id: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select SKU" />
                </SelectTrigger>
                <SelectContent>
                  {skus.map(s => (
                    <SelectItem key={s.sku_id} value={s.sku_id}>
                      {s.sku_id} - {s.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Target Quantity *</Label>
              <Input 
                type="number"
                value={scheduleForm.target_quantity}
                onChange={(e) => setScheduleForm({...scheduleForm, target_quantity: e.target.value})}
              />
            </div>
            <div>
              <Label>Target Date *</Label>
              <Input 
                type="date"
                value={scheduleForm.target_date}
                onChange={(e) => setScheduleForm({...scheduleForm, target_date: e.target.value})}
              />
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={scheduleForm.priority} onValueChange={(v) => setScheduleForm({...scheduleForm, priority: v})}>
                <SelectTrigger>
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
            <div>
              <Label>Notes</Label>
              <Input 
                value={scheduleForm.notes}
                onChange={(e) => setScheduleForm({...scheduleForm, notes: e.target.value})}
                placeholder="Optional notes"
              />
            </div>
            <Button 
              onClick={handleCreateSchedule} 
              className="w-full"
              disabled={!scheduleForm.sku_id || !scheduleForm.target_quantity || !scheduleForm.target_date}
              data-testid="submit-schedule-btn"
            >
              Create Schedule
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Update Capacity Dialog */}
      <Dialog open={showCapacityDialog} onOpenChange={setShowCapacityDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Branch Capacity</DialogTitle>
            <DialogDescription>Set daily production capacity for {capacityForm.branch}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Capacity (units/day)</Label>
              <Input 
                type="number"
                value={capacityForm.capacity_units_per_day}
                onChange={(e) => setCapacityForm({...capacityForm, capacity_units_per_day: e.target.value})}
              />
            </div>
            <Button onClick={handleUpdateCapacity} className="w-full" data-testid="submit-capacity-btn">
              Update Capacity
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Auto-Allocate Dialog */}
      <Dialog open={showAllocateDialog} onOpenChange={setShowAllocateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Auto-Allocate Production</DialogTitle>
            <DialogDescription>
              Automatically distribute production across branches based on available capacity
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Preferred Branches (Optional)</Label>
              <p className="text-xs text-muted-foreground mb-2">Leave empty to use all available branches</p>
              <div className="space-y-2">
                {branchCapacities.filter(b => b.capacity_units_per_day > 0).map(b => (
                  <label key={b.branch} className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={allocateForm.preferred_branches.includes(b.branch)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setAllocateForm({...allocateForm, preferred_branches: [...allocateForm.preferred_branches, b.branch]});
                        } else {
                          setAllocateForm({...allocateForm, preferred_branches: allocateForm.preferred_branches.filter(br => br !== b.branch)});
                        }
                      }}
                    />
                    <span className="font-mono text-sm">{b.branch}</span>
                    <span className="text-xs text-muted-foreground">({b.available_today} available)</span>
                  </label>
                ))}
              </div>
            </div>
            <Button onClick={handleAutoAllocate} className="w-full" data-testid="submit-auto-allocate-btn">
              <Zap className="w-4 h-4 mr-2" />
              Auto-Allocate Now
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Schedule from Forecast Dialog */}
      <Dialog open={showScheduleFromForecastDialog} onOpenChange={setShowScheduleFromForecastDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Factory className="w-5 h-5" />
              Schedule from Forecast
            </DialogTitle>
            <DialogDescription>
              Create production schedule from demand forecast: {forecastScheduleForm.forecast_code}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-sm font-medium text-blue-800">SKU: {forecastScheduleForm.sku_id}</div>
              <div className="text-xs text-blue-600 mt-1">
                Remaining to schedule: <span className="font-bold">{forecastScheduleForm.remaining_qty?.toLocaleString()}</span> units
              </div>
            </div>
            
            <div>
              <Label>Quantity to Schedule *</Label>
              <Input 
                type="number"
                value={forecastScheduleForm.quantity}
                onChange={(e) => setForecastScheduleForm({...forecastScheduleForm, quantity: parseInt(e.target.value) || 0})}
                max={forecastScheduleForm.remaining_qty}
                className="font-mono"
                data-testid="forecast-schedule-qty"
              />
              <p className="text-xs text-muted-foreground mt-1">Max: {forecastScheduleForm.remaining_qty?.toLocaleString()}</p>
            </div>
            
            <div>
              <Label>Target Date *</Label>
              <Input 
                type="date"
                value={forecastScheduleForm.target_date}
                onChange={(e) => {
                  setForecastScheduleForm({...forecastScheduleForm, target_date: e.target.value});
                  // Fetch capacity when date changes and branch is selected
                  if (forecastScheduleForm.branch) {
                    fetchBranchCapacityForDate(forecastScheduleForm.branch, e.target.value);
                  }
                }}
                className="font-mono"
                data-testid="forecast-schedule-date"
              />
            </div>
            
            {/* NEW: Branch Selector */}
            <div>
              <Label>Branch (Optional)</Label>
              <Select 
                value={forecastScheduleForm.branch || "_none"} 
                onValueChange={(v) => {
                  const branch = v === "_none" ? "" : v;
                  setForecastScheduleForm({...forecastScheduleForm, branch});
                  // Fetch capacity when branch changes
                  if (branch && forecastScheduleForm.target_date) {
                    fetchBranchCapacityForDate(branch, forecastScheduleForm.target_date);
                  } else {
                    setBranchCapacityInfo(null);
                  }
                }}
              >
                <SelectTrigger data-testid="forecast-schedule-branch">
                  <SelectValue placeholder={loadingBranches ? "Loading..." : "Select branch"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">No Branch (Allocate Later)</SelectItem>
                  {availableBranches.map(b => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableBranches.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {availableBranches.length} branch(es) available for this SKU
                </p>
              )}
            </div>
            
            {/* Branch Capacity Info */}
            {branchCapacityInfo && forecastScheduleForm.branch && (
              <div className={`p-3 rounded-lg border ${
                branchCapacityInfo.available >= forecastScheduleForm.quantity 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="text-sm font-medium">
                  Capacity for {forecastScheduleForm.branch} on {forecastScheduleForm.target_date}:
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Capacity:</span>
                    <span className="font-mono ml-1 font-bold">
                      {branchCapacityInfo.model_capacities?.length > 0 
                        ? branchCapacityInfo.model_capacities.reduce((s, m) => s + m.capacity_qty, 0)
                        : branchCapacityInfo.base_capacity}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Allocated:</span>
                    <span className="font-mono ml-1">{branchCapacityInfo.allocated}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Available:</span>
                    <span className={`font-mono ml-1 font-bold ${
                      branchCapacityInfo.available >= forecastScheduleForm.quantity ? 'text-green-600' : 'text-red-600'
                    }`}>{branchCapacityInfo.available}</span>
                  </div>
                </div>
                {branchCapacityInfo.available < forecastScheduleForm.quantity && (
                  <div className="mt-2 text-xs text-red-600 font-medium">
                    ⚠️ Quantity exceeds available capacity! Reduce quantity or select different branch/date.
                  </div>
                )}
              </div>
            )}
            
            <div>
              <Label>Priority</Label>
              <Select 
                value={forecastScheduleForm.priority} 
                onValueChange={(v) => setForecastScheduleForm({...forecastScheduleForm, priority: v})}
              >
                <SelectTrigger>
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
            
            <Button 
              onClick={async () => {
                if (!forecastScheduleForm.target_date) {
                  toast.error("Please select a target date");
                  return;
                }
                if (forecastScheduleForm.quantity <= 0) {
                  toast.error("Please enter a valid quantity");
                  return;
                }
                if (forecastScheduleForm.quantity > forecastScheduleForm.remaining_qty) {
                  toast.error(`Quantity exceeds remaining (${forecastScheduleForm.remaining_qty})`);
                  return;
                }
                // Validate branch capacity if branch is selected
                if (forecastScheduleForm.branch && branchCapacityInfo) {
                  if (forecastScheduleForm.quantity > branchCapacityInfo.available) {
                    toast.error(`Quantity (${forecastScheduleForm.quantity}) exceeds available capacity (${branchCapacityInfo.available}) for ${forecastScheduleForm.branch}`);
                    return;
                  }
                }
                
                try {
                  await axios.post(`${API}/cpc/schedule-from-forecast`, {
                    forecast_id: forecastScheduleForm.forecast_id,
                    quantity: forecastScheduleForm.quantity,
                    target_date: new Date(forecastScheduleForm.target_date).toISOString(),
                    branch: forecastScheduleForm.branch || null,
                    priority: forecastScheduleForm.priority
                  });
                  toast.success("Production schedule created from forecast");
                  setShowScheduleFromForecastDialog(false);
                  fetchAllData();
                } catch (error) {
                  toast.error(error.response?.data?.detail || "Failed to create schedule");
                }
              }}
              className="w-full uppercase text-xs tracking-wide"
              disabled={!forecastScheduleForm.target_date || forecastScheduleForm.quantity <= 0}
              data-testid="submit-forecast-schedule-btn"
            >
              <Factory className="w-4 h-4 mr-2" />
              Create Production Schedule
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Model Capacity Upload Dialog */}
      <Dialog open={showModelCapacityDialog} onOpenChange={setShowModelCapacityDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload Model-Specific Capacity
            </DialogTitle>
            <DialogDescription>
              Upload capacity limits by Month, Day, and Model. This overrides the base branch capacity for specific days.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Branch Selection */}
            <div>
              <Label className="text-sm font-bold">Select Branch *</Label>
              <Select value={modelCapacityBranch} onValueChange={setModelCapacityBranch}>
                <SelectTrigger data-testid="model-capacity-branch">
                  <SelectValue placeholder="Select a branch..." />
                </SelectTrigger>
                <SelectContent>
                  {branchCapacities.map(b => (
                    <SelectItem key={b.branch} value={b.branch}>{b.branch}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Capacity Rows */}
            <div className="border rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <Label className="text-sm font-bold">Capacity Entries</Label>
                <Button size="sm" variant="outline" onClick={addModelCapacityRow}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Row
                </Button>
              </div>
              
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 text-xs font-mono uppercase text-muted-foreground">
                  <div className="col-span-3">Month (YYYY-MM)</div>
                  <div className="col-span-2">Day</div>
                  <div className="col-span-4">Model</div>
                  <div className="col-span-2">Capacity</div>
                  <div className="col-span-1"></div>
                </div>
                
                {modelCapacityRows.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-3">
                      <Input 
                        type="month" 
                        value={row.month} 
                        onChange={(e) => updateModelCapacityRow(idx, 'month', e.target.value)}
                        className="text-sm"
                        data-testid={`cap-month-${idx}`}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input 
                        type="number" 
                        min={1} 
                        max={31}
                        value={row.day} 
                        onChange={(e) => updateModelCapacityRow(idx, 'day', parseInt(e.target.value) || 1)}
                        className="text-sm font-mono"
                        data-testid={`cap-day-${idx}`}
                      />
                    </div>
                    <div className="col-span-4">
                      <Select 
                        value={row.model_id} 
                        onValueChange={(v) => updateModelCapacityRow(idx, 'model_id', v)}
                      >
                        <SelectTrigger className="text-sm" data-testid={`cap-model-${idx}`}>
                          <SelectValue placeholder="Select model..." />
                        </SelectTrigger>
                        <SelectContent>
                          {models.map(m => (
                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Input 
                        type="number" 
                        min={0}
                        value={row.capacity_qty} 
                        onChange={(e) => updateModelCapacityRow(idx, 'capacity_qty', parseInt(e.target.value) || 0)}
                        className="text-sm font-mono"
                        data-testid={`cap-qty-${idx}`}
                      />
                    </div>
                    <div className="col-span-1">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => removeModelCapacityRow(idx)}
                        disabled={modelCapacityRows.length <= 1}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Info */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
              <p className="font-medium text-blue-800">How it works:</p>
              <ul className="text-blue-700 mt-1 space-y-1 list-disc list-inside">
                <li>Model-specific capacity overrides base branch capacity for the specified day</li>
                <li>If no model capacity is set, the base capacity (units/day) is used</li>
                <li>Capacity validation happens when scheduling production</li>
              </ul>
            </div>
            
            {/* Submit */}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowModelCapacityDialog(false)} className="flex-1">
                Cancel
              </Button>
              <Button 
                onClick={handleUploadModelCapacity} 
                disabled={uploadingCapacity || !modelCapacityBranch}
                className="flex-1 uppercase text-xs"
                data-testid="submit-model-capacity"
              >
                {uploadingCapacity ? "Uploading..." : "Upload Capacity"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CPC;

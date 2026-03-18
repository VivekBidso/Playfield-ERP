import { useState, useEffect } from "react";
import axios from "axios";
import { 
  Calendar, 
  Building2, 
  Play, 
  CheckCircle, 
  Factory,
  TrendingUp,
  Download,
  Upload,
  ClipboardList,
  Package,
  ExternalLink
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
  const [activeTab, setActiveTab] = useState("planning");
  
  // Data
  const [demandForecasts, setDemandForecasts] = useState([]);
  const [forecastSummary, setForecastSummary] = useState(null);
  const [branchCapacities, setBranchCapacities] = useState([]);
  const [branchSchedules, setBranchSchedules] = useState([]);
  
  // Dialog states
  const [showScheduleFromForecastDialog, setShowScheduleFromForecastDialog] = useState(false);
  const [showCapacityDialog, setShowCapacityDialog] = useState(false);
  
  // Form Data
  const [forecastScheduleForm, setForecastScheduleForm] = useState({
    forecast_id: "",
    forecast_code: "",
    sku_id: "",
    remaining_qty: 0,
    inventory_qty: 0,
    quantity: 0,
    target_date: "",
    branch: "",
    priority: "MEDIUM"
  });
  
  const [capacityForm, setCapacityForm] = useState({
    branch: "",
    capacity_units_per_day: 0
  });
  
  // Branch scheduling
  const [availableBranches, setAvailableBranches] = useState([]);
  const [branchCapacityInfo, setBranchCapacityInfo] = useState(null);
  const [loadingBranches, setLoadingBranches] = useState(false);
  
  // Date filter for schedules
  const [scheduleStartDate, setScheduleStartDate] = useState("");
  const [scheduleEndDate, setScheduleEndDate] = useState("");
  const [scheduleBranchFilter, setScheduleBranchFilter] = useState("");
  
  // Branch forecast view
  const [branchForecast, setBranchForecast] = useState(null);
  
  // Dispatch Lots dialog for forecast
  const [showForecastLotsDialog, setShowForecastLotsDialog] = useState(false);
  const [forecastLots, setForecastLots] = useState([]);
  const [selectedForecast, setSelectedForecast] = useState(null);
  const [loadingForecastLots, setLoadingForecastLots] = useState(false);
  
  // Loading
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [forecastRes, forecastSumRes, capRes, schedRes] = await Promise.all([
        axios.get(`${API}/cpc/demand-forecasts`).catch(() => ({ data: [] })),
        axios.get(`${API}/cpc/demand-forecasts/summary`).catch(() => ({ data: null })),
        axios.get(`${API}/branches/capacity`),
        axios.get(`${API}/cpc/branch-schedules`).catch(() => ({ data: [] }))
      ]);
      setDemandForecasts(forecastRes.data);
      setForecastSummary(forecastSumRes.data);
      setBranchCapacities(capRes.data);
      setBranchSchedules(schedRes.data);
    } catch (error) {
      toast.error("Failed to fetch CPC data");
    }
    setLoading(false);
  };

  // Fetch available branches for a SKU
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

  // Fetch capacity info for a branch on a specific date
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

  const fetchBranchForecast = async (branchName) => {
    try {
      const res = await axios.get(`${API}/branches/${encodeURIComponent(branchName)}/capacity-forecast?days=7`);
      setBranchForecast(res.data);
    } catch (error) {
      toast.error("Failed to load forecast");
    }
  };

  const fetchBranchSchedules = async () => {
    try {
      let url = `${API}/cpc/branch-schedules`;
      const params = [];
      if (scheduleStartDate) params.push(`start_date=${scheduleStartDate}`);
      if (scheduleEndDate) params.push(`end_date=${scheduleEndDate}`);
      if (scheduleBranchFilter) params.push(`branch=${encodeURIComponent(scheduleBranchFilter)}`);
      if (params.length > 0) url += `?${params.join('&')}`;
      
      const res = await axios.get(url);
      setBranchSchedules(res.data);
    } catch (error) {
      toast.error("Failed to fetch schedules");
    }
  };

  const fetchForecastDispatchLots = async (forecast) => {
    setLoadingForecastLots(true);
    setSelectedForecast(forecast);
    try {
      const res = await axios.get(`${API}/forecasts/${forecast.id}/dispatch-lots`);
      setForecastLots(res.data);
      setShowForecastLotsDialog(true);
    } catch (error) {
      toast.error("Failed to fetch dispatch lots");
    } finally {
      setLoadingForecastLots(false);
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

  const handleScheduleFromForecast = async () => {
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
  };

  const openCapacityDialog = (branch) => {
    setCapacityForm({
      branch: branch.branch,
      capacity_units_per_day: branch.capacity_units_per_day
    });
    setShowCapacityDialog(true);
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
        <Factory className="w-6 h-6 animate-spin mr-2" />
        Loading CPC data...
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8" data-testid="cpc-page">
      <div className="mb-8">
        <h1 className="text-4xl font-black tracking-tight uppercase">CPC</h1>
        <p className="text-sm text-muted-foreground mt-1 font-mono">Central Production Control</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="planning" className="uppercase text-xs tracking-wide" data-testid="planning-tab">
            <TrendingUp className="w-4 h-4 mr-2" />
            Production Planning
          </TabsTrigger>
          <TabsTrigger value="capacity" className="uppercase text-xs tracking-wide" data-testid="capacity-tab">
            <Building2 className="w-4 h-4 mr-2" />
            Branch Capacity
          </TabsTrigger>
          <TabsTrigger value="schedules" className="uppercase text-xs tracking-wide" data-testid="schedules-tab">
            <Calendar className="w-4 h-4 mr-2" />
            Production Schedule
          </TabsTrigger>
        </TabsList>

        {/* ==================== PRODUCTION PLANNING TAB ==================== */}
        <TabsContent value="planning" data-testid="planning-content">
          {/* Summary Cards */}
          {forecastSummary && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
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
                  <CardTitle className="text-sm font-mono uppercase text-muted-foreground">Inventory</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black text-purple-600">{(forecastSummary.total_inventory || 0).toLocaleString()}</div>
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
                  <CardTitle className="text-sm font-mono uppercase text-muted-foreground">Schedule Pending</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black text-orange-600">{forecastSummary.remaining_to_schedule?.toLocaleString()}</div>
                  <Progress value={forecastSummary.scheduling_percent || 0} className="h-2 mt-2" />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Forecasts Table */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <ClipboardList className="w-5 h-5" />
                    Demand Forecasts
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Plan production from confirmed forecasts. Schedule Pending = Forecast - Inventory - Scheduled
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => window.open(`${API}/cpc/demand-forecasts/download`, '_blank')}
                    className="uppercase text-xs tracking-wide"
                    data-testid="download-forecasts-btn"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => window.open(`${API}/cpc/production-plan/template`, '_blank')}
                    className="uppercase text-xs tracking-wide"
                    data-testid="download-plan-template-btn"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Plan Template
                  </Button>
                  <Button 
                    variant="default"
                    onClick={() => document.getElementById('plan-excel-upload').click()}
                    className="uppercase text-xs tracking-wide"
                    data-testid="upload-plan-btn"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Plan
                  </Button>
                  <input
                    id="plan-excel-upload"
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      
                      const formData = new FormData();
                      formData.append('file', file);
                      
                      try {
                        const res = await axios.post(`${API}/cpc/production-plan/upload-excel`, formData, {
                          headers: { 'Content-Type': 'multipart/form-data' }
                        });
                        
                        if (res.data.total_errors > 0) {
                          toast.warning(`Created ${res.data.created} schedules with ${res.data.total_errors} errors`);
                        } else {
                          toast.success(`Successfully created ${res.data.created} production schedules`);
                        }
                        fetchAllData();
                      } catch (error) {
                        toast.error(error.response?.data?.detail || "Failed to upload plan");
                      }
                      e.target.value = '';
                    }}
                  />
                </div>
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
                      <th className="h-10 px-4 text-right font-mono text-xs uppercase">Inventory</th>
                      <th className="h-10 px-4 text-right font-mono text-xs uppercase">Scheduled</th>
                      <th className="h-10 px-4 text-right font-mono text-xs uppercase">Pending</th>
                      <th className="h-10 px-4 text-center font-mono text-xs uppercase">Status</th>
                      <th className="h-10 px-4 text-center font-mono text-xs uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {demandForecasts.map((f) => (
                      <tr key={f.id} className={`border-t hover:bg-zinc-50/50 ${f.is_fully_scheduled ? 'opacity-50' : ''}`}>
                        <td className="p-4">
                          <button 
                            className="font-mono text-sm font-bold text-primary hover:underline cursor-pointer flex items-center gap-1"
                            onClick={() => fetchForecastDispatchLots(f)}
                            title="Click to view dispatch lots"
                          >
                            {f.forecast_code}
                            <ExternalLink className="w-3 h-3 opacity-50" />
                          </button>
                        </td>
                        <td className="p-4 text-sm">{f.buyer_name || '-'}</td>
                        <td className="p-4">
                          <div className="font-mono text-sm font-bold">{f.sku_id || f.vertical_name}</div>
                          <div className="text-xs text-zinc-500 truncate max-w-[200px]">{f.sku_description}</div>
                        </td>
                        <td className="p-4 font-mono text-sm">{f.forecast_month?.slice(0, 7)}</td>
                        <td className="p-4 font-mono font-bold text-right">{f.forecast_qty?.toLocaleString()}</td>
                        <td className="p-4 font-mono text-right text-purple-600">{(f.inventory_qty || 0).toLocaleString()}</td>
                        <td className="p-4 font-mono text-right text-green-600">{(f.scheduled_qty || 0).toLocaleString()}</td>
                        <td className="p-4 font-mono font-bold text-right">
                          <span className={f.schedule_pending > 0 ? 'text-orange-600' : 'text-green-600'}>
                            {(f.schedule_pending || 0).toLocaleString()}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          {f.is_fully_scheduled ? (
                            <Badge className="bg-green-100 text-green-700">Fully Planned</Badge>
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
                                  remaining_qty: f.schedule_pending || 0,
                                  inventory_qty: f.inventory_qty || 0,
                                  quantity: f.schedule_pending || 0,
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
                          <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                          No pending demand forecasts. Production planning starts when Demand team confirms forecasts.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== BRANCH CAPACITY TAB ==================== */}
        <TabsContent value="capacity" data-testid="capacity-content">
          {/* Day-wise Capacity Upload Section */}
          <Card className="mb-6">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Upload className="w-5 h-5" />
                    Day-wise Capacity Upload
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Upload daily capacity by Branch and Date. Re-uploading same date will overwrite existing data.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline"
                    onClick={() => window.open(`${API}/branches/daily-capacity/template`, '_blank')}
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
                        const res = await axios.post(`${API}/branches/daily-capacity/upload-excel`, formData, {
                          headers: { 'Content-Type': 'multipart/form-data' }
                        });
                        
                        if (res.data.total_errors > 0) {
                          toast.warning(`Uploaded ${res.data.total} records with ${res.data.total_errors} errors`);
                        } else {
                          toast.success(`Successfully uploaded ${res.data.total} capacity records (${res.data.inserted} new, ${res.data.updated} updated)`);
                        }
                        fetchAllData();
                      } catch (error) {
                        toast.error(error.response?.data?.detail || "Failed to upload Excel");
                      }
                      e.target.value = '';
                    }}
                  />
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
                      {b.capacity_source === 'daily_override' && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded mt-1 inline-block">
                          Daily override active
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
                        {b.capacity_source === 'daily_override' ? 'daily capacity' : 'units/day (base)'}
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

        {/* ==================== PRODUCTION SCHEDULE TAB ==================== */}
        <TabsContent value="schedules" data-testid="schedules-content">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Branch-wise Production Schedule
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    View per-day production schedules by branch
                  </p>
                </div>
                <div className="flex gap-2 items-end">
                  <div>
                    <Label className="text-xs">Start Date</Label>
                    <Input 
                      type="date" 
                      value={scheduleStartDate} 
                      onChange={(e) => setScheduleStartDate(e.target.value)}
                      className="w-36"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">End Date</Label>
                    <Input 
                      type="date" 
                      value={scheduleEndDate} 
                      onChange={(e) => setScheduleEndDate(e.target.value)}
                      className="w-36"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Branch</Label>
                    <Select value={scheduleBranchFilter || "_all"} onValueChange={(v) => setScheduleBranchFilter(v === "_all" ? "" : v)}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="All Branches" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_all">All Branches</SelectItem>
                        {branchCapacities.map(b => (
                          <SelectItem key={b.branch} value={b.branch}>{b.branch}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={fetchBranchSchedules} className="uppercase text-xs">
                    Apply Filter
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {branchSchedules.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Calendar className="w-8 h-8 mx-auto mb-2 text-zinc-400" />
                  No production schedules found for the selected period
                </div>
              ) : (
                <div className="space-y-4">
                  {branchSchedules.map((bs, idx) => (
                    <Card key={`${bs.branch}-${bs.date}-${idx}`} className="border-l-4 border-l-blue-500">
                      <CardHeader className="py-3">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-4">
                            <div>
                              <div className="font-bold font-mono">{bs.branch}</div>
                              <div className="text-sm text-muted-foreground">{bs.date}</div>
                            </div>
                            {bs.capacity_source === 'daily_override' && (
                              <Badge variant="outline" className="text-xs">Daily Override</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="text-sm text-muted-foreground">Capacity</div>
                              <div className="font-mono font-bold">{bs.capacity}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-muted-foreground">Scheduled</div>
                              <div className="font-mono font-bold text-blue-600">{bs.total_scheduled}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-muted-foreground">Available</div>
                              <div className={`font-mono font-bold ${bs.available > 0 ? 'text-green-600' : 'text-red-600'}`}>{bs.available}</div>
                            </div>
                            <div className="w-20">
                              <Progress value={bs.utilization_percent} className="h-2" />
                              <div className="text-xs text-center mt-1">{bs.utilization_percent}%</div>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="py-2 text-left font-mono text-xs uppercase">Schedule</th>
                              <th className="py-2 text-left font-mono text-xs uppercase">Forecast</th>
                              <th className="py-2 text-left font-mono text-xs uppercase">SKU</th>
                              <th className="py-2 text-right font-mono text-xs uppercase">Qty</th>
                              <th className="py-2 text-right font-mono text-xs uppercase">Completed</th>
                              <th className="py-2 text-center font-mono text-xs uppercase">Priority</th>
                              <th className="py-2 text-center font-mono text-xs uppercase">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bs.schedules.map((s, sidx) => (
                              <tr key={sidx} className="border-b last:border-0">
                                <td className="py-2 font-mono font-bold">{s.schedule_code}</td>
                                <td className="py-2 font-mono text-blue-600">{s.forecast_code || '-'}</td>
                                <td className="py-2">
                                  <div className="font-mono">{s.sku_id}</div>
                                  <div className="text-xs text-muted-foreground truncate max-w-[200px]">{s.sku_description}</div>
                                </td>
                                <td className="py-2 text-right font-mono">{s.target_quantity}</td>
                                <td className="py-2 text-right font-mono text-green-600">{s.completed_quantity || 0}</td>
                                <td className="py-2 text-center">{getPriorityBadge(s.priority)}</td>
                                <td className="py-2 text-center">{getStatusBadge(s.status)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ==================== DIALOGS ==================== */}
      
      {/* Schedule from Forecast Dialog */}
      <Dialog open={showScheduleFromForecastDialog} onOpenChange={setShowScheduleFromForecastDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Factory className="w-5 h-5" />
              Plan Production from Forecast
            </DialogTitle>
            <DialogDescription>
              Create production schedule from: {forecastScheduleForm.forecast_code}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-sm font-medium text-blue-800">SKU: {forecastScheduleForm.sku_id}</div>
              <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-blue-600">
                <div>
                  Inventory: <span className="font-bold">{forecastScheduleForm.inventory_qty?.toLocaleString()}</span>
                </div>
                <div>
                  Schedule Pending: <span className="font-bold">{forecastScheduleForm.remaining_qty?.toLocaleString()}</span>
                </div>
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
                  if (forecastScheduleForm.branch) {
                    fetchBranchCapacityForDate(forecastScheduleForm.branch, e.target.value);
                  }
                }}
                className="font-mono"
                data-testid="forecast-schedule-date"
              />
            </div>
            
            <div>
              <Label>Branch *</Label>
              <Select 
                value={forecastScheduleForm.branch || "_none"} 
                onValueChange={(v) => {
                  const branch = v === "_none" ? "" : v;
                  setForecastScheduleForm({...forecastScheduleForm, branch});
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
                  <SelectItem value="_none">Select a branch...</SelectItem>
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
                    <span className="font-mono ml-1 font-bold">{branchCapacityInfo.base_capacity}</span>
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
              onClick={handleScheduleFromForecast}
              className="w-full uppercase text-xs tracking-wide"
              disabled={!forecastScheduleForm.target_date || !forecastScheduleForm.branch || forecastScheduleForm.quantity <= 0}
              data-testid="submit-forecast-schedule-btn"
            >
              <Factory className="w-4 h-4 mr-2" />
              Create Production Schedule
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

      {/* Forecast Dispatch Lots Dialog */}
      <Dialog open={showForecastLotsDialog} onOpenChange={setShowForecastLotsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Dispatch Lots for Forecast
            </DialogTitle>
            <DialogDescription>
              {selectedForecast && (
                <span className="font-mono font-bold text-primary">{selectedForecast.forecast_code}</span>
              )}
              {selectedForecast && ` - ${selectedForecast.buyer_name || ''} | ${selectedForecast.sku_id || ''}`}
            </DialogDescription>
          </DialogHeader>
          
          {loadingForecastLots ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : forecastLots.length === 0 ? (
            <div className="py-8 text-center">
              <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-muted-foreground">No dispatch lots linked to this forecast</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create dispatch lots from the Dispatch module to link them to forecasts
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-zinc-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-primary">{forecastLots.length}</div>
                  <div className="text-xs text-muted-foreground uppercase">Dispatch Lots</div>
                </div>
                <div className="bg-zinc-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {forecastLots.reduce((sum, l) => sum + (l.forecast_qty_in_lot || 0), 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground uppercase">Total Qty Assigned</div>
                </div>
                <div className="bg-zinc-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {selectedForecast?.forecast_qty?.toLocaleString() || 0}
                  </div>
                  <div className="text-xs text-muted-foreground uppercase">Forecast Qty</div>
                </div>
              </div>

              {/* Lots Table */}
              <div className="border rounded-lg overflow-hidden max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-100 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left font-mono text-xs uppercase">Lot Code</th>
                      <th className="px-4 py-3 text-left font-mono text-xs uppercase">Buyer</th>
                      <th className="px-4 py-3 text-right font-mono text-xs uppercase">Qty in Lot</th>
                      <th className="px-4 py-3 text-center font-mono text-xs uppercase">Lines</th>
                      <th className="px-4 py-3 text-center font-mono text-xs uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecastLots.map((lot) => (
                      <tr key={lot.id} className="border-t hover:bg-zinc-50">
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-primary">{lot.lot_code}</span>
                        </td>
                        <td className="px-4 py-3 text-zinc-600">{lot.buyer_name || '-'}</td>
                        <td className="px-4 py-3 font-mono font-bold text-right text-green-600">
                          {(lot.forecast_qty_in_lot || lot.total_quantity || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant="secondary" className="font-mono">
                            {lot.forecast_lines?.length || lot.line_count || 0}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge className={`text-xs ${
                            lot.status === 'DISPATCHED' ? 'bg-green-100 text-green-700' :
                            lot.status === 'READY' ? 'bg-blue-100 text-blue-700' :
                            lot.status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-zinc-100 text-zinc-700'
                          }`}>
                            {lot.status || 'CREATED'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Forecast Lines Detail */}
              {forecastLots.some(l => l.forecast_lines?.length > 0) && (
                <div className="border-t pt-4">
                  <p className="text-xs text-muted-foreground uppercase mb-2">Line Details</p>
                  <div className="space-y-2">
                    {forecastLots.map((lot) => (
                      lot.forecast_lines?.map((line, idx) => (
                        <div key={`${lot.id}-${idx}`} className="flex items-center justify-between bg-zinc-50 rounded px-3 py-2 text-sm">
                          <span className="font-mono text-zinc-600">{lot.lot_code} / Line {line.line_number}</span>
                          <span className="font-mono">{line.sku_id}</span>
                          <span className="font-mono font-bold">{line.quantity?.toLocaleString()}</span>
                          <Badge variant="outline" className="text-xs">{line.status || 'PENDING'}</Badge>
                        </div>
                      ))
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CPC;

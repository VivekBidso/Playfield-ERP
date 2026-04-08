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
  ExternalLink,
  AlertTriangle,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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
  const [showOverflowDialog, setShowOverflowDialog] = useState(false);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  
  // Overflow allocation state
  const [overflowItems, setOverflowItems] = useState([]);
  const [overflowAllocation, setOverflowAllocation] = useState({});
  const [availableCapacity, setAvailableCapacity] = useState([]);
  
  // Production Plan Upload state
  const [conflictData, setConflictData] = useState(null);
  const [pendingUploadFile, setPendingUploadFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  
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
  
  // Delete Schedule tab state
  const [deleteYear, setDeleteYear] = useState("");
  const [deleteMonthNum, setDeleteMonthNum] = useState("");
  const [deleteBranch, setDeleteBranch] = useState("");
  const [deletePreview, setDeletePreview] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Combine year and month for API calls
  const deleteMonth = deleteYear && deleteMonthNum ? `${deleteYear}-${deleteMonthNum}` : "";
  
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

  const fetchAvailableCapacity = async () => {
    try {
      const res = await axios.get(`${API}/cpc/available-capacity`);
      setAvailableCapacity(res.data.data || []);
    } catch (error) {
      console.error("Failed to fetch available capacity:", error);
    }
  };

  // ===== Delete Schedule Functions =====
  const fetchDeletePreview = async () => {
    if (!deleteMonth || !deleteBranch) {
      setDeletePreview(null);
      return;
    }
    
    setDeleteLoading(true);
    try {
      const res = await axios.get(`${API}/production-schedules/preview-delete?month=${deleteMonth}&branch=${encodeURIComponent(deleteBranch)}`);
      setDeletePreview(res.data);
    } catch (error) {
      const detail = error.response?.data?.detail;
      if (detail) {
        toast.error(detail);
      }
      setDeletePreview(null);
    }
    setDeleteLoading(false);
  };

  useEffect(() => {
    if (deleteMonth && deleteBranch) {
      fetchDeletePreview();
    } else {
      setDeletePreview(null);
    }
  }, [deleteMonth, deleteBranch]);

  const handleDeleteSchedules = async () => {
    if (!deleteMonth || !deleteBranch) return;
    
    setDeleting(true);
    try {
      const res = await axios.post(`${API}/production-schedules/bulk-soft-delete`, {
        month: deleteMonth,
        branch: deleteBranch
      });
      toast.success(res.data.message);
      setShowDeleteConfirmDialog(false);
      setDeleteYear("");
      setDeleteMonthNum("");
      setDeleteBranch("");
      setDeletePreview(null);
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete schedules");
    }
    setDeleting(false);
  };

  // Download schedules as Excel before deletion
  const handleDownloadSchedules = () => {
    if (!deletePreview?.schedules?.length) {
      toast.error("No schedules to download");
      return;
    }
    
    // Prepare data for Excel
    const data = deletePreview.schedules.map(s => ({
      "Schedule Code": s.schedule_code || "",
      "SKU ID": s.sku_id || "",
      "SKU Description": s.sku_description || "",
      "Branch": s.branch || deleteBranch,
      "Date": s.target_date ? new Date(s.target_date).toLocaleDateString() : "",
      "Target Qty": s.target_quantity || 0,
      "Completed Qty": s.completed_quantity || 0,
      "Status": s.status || ""
    }));
    
    // Create CSV content
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(","),
      ...data.map(row => headers.map(h => {
        const val = row[h];
        // Escape commas and quotes in values
        if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      }).join(","))
    ].join("\n");
    
    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthName = monthNames[parseInt(deleteMonthNum) - 1] || deleteMonthNum;
    link.download = `schedules_${deleteBranch.replace(/\s+/g, '_')}_${monthName}_${deleteYear}.csv`;
    link.click();
    
    toast.success(`Downloaded ${data.length} schedules`);
  };

  // Get minimum month for delete (current month)
  const getMinMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };
  
  // Generate year options (current year + next 2 years)
  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    return [currentYear, currentYear + 1, currentYear + 2];
  };
  
  // Generate month options (filter out past months for current year)
  const getMonthOptions = () => {
    const months = [
      { value: "01", label: "January" },
      { value: "02", label: "February" },
      { value: "03", label: "March" },
      { value: "04", label: "April" },
      { value: "05", label: "May" },
      { value: "06", label: "June" },
      { value: "07", label: "July" },
      { value: "08", label: "August" },
      { value: "09", label: "September" },
      { value: "10", label: "October" },
      { value: "11", label: "November" },
      { value: "12", label: "December" }
    ];
    
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    
    // If selected year is current year, filter out past months
    if (deleteYear && parseInt(deleteYear) === currentYear) {
      return months.filter(m => parseInt(m.value) >= currentMonth);
    }
    
    return months;
  };

  const handleAllocateOverflow = async (idx) => {
    const item = overflowItems[idx];
    const alloc = overflowAllocation[idx];
    
    if (!alloc.date) {
      toast.error("Please select a date for allocation");
      return;
    }
    
    try {
      await axios.post(`${API}/cpc/allocate-overflow`, {
        sku_id: item.sku_id,
        branch: alloc.branch,
        date: alloc.date,
        quantity: alloc.qty
      });
      toast.success(`Allocated ${alloc.qty} units to ${alloc.branch} on ${alloc.date}`);
      
      // Remove allocated item from overflow
      setOverflowItems(prev => prev.filter((_, i) => i !== idx));
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to allocate overflow");
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
          <TabsTrigger value="delete-schedule" className="uppercase text-xs tracking-wide text-red-600" data-testid="delete-schedule-tab">
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Schedule
          </TabsTrigger>
        </TabsList>

        {/* ==================== PRODUCTION PLANNING TAB ==================== */}
        <TabsContent value="planning" data-testid="planning-content">
          {/* Upload Section */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <ClipboardList className="w-5 h-5" />
                    Production Planning
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Upload production schedules. Format: Branch ID | Date | Buyer SKU ID | Quantity
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline"
                    onClick={() => window.open(`${API}/cpc/production-plan/template`, '_blank')}
                    className="uppercase text-xs tracking-wide"
                    data-testid="download-plan-template-btn"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Template
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => window.open(`${API}/cpc/available-capacity/download`, '_blank')}
                    className="uppercase text-xs tracking-wide"
                    data-testid="download-capacity-btn"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Capacity Report
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
                      setPendingUploadFile(file);
                      setUploadLoading(true);
                      
                      try {
                        // First, check mode (default)
                        const res = await axios.post(`${API}/cpc/production-plan/upload-excel`, formData, {
                          headers: { 'Content-Type': 'multipart/form-data' },
                          responseType: 'blob'
                        });
                        
                        // Check if response is JSON (warning) or Excel (success)
                        const contentType = res.headers['content-type'];
                        
                        if (contentType?.includes('application/json')) {
                          // It's a warning response - parse JSON
                          const text = await res.data.text();
                          const data = JSON.parse(text);
                          
                          if (data.warning && data.conflicts?.length > 0) {
                            setConflictData(data);
                            setShowConflictDialog(true);
                          } else if (data.error) {
                            toast.error(data.detail || data.error);
                          }
                        } else {
                          // It's an Excel file - download it
                          const summary = JSON.parse(res.headers['x-upload-summary'] || '{}');
                          
                          // Create download link
                          const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `production_plan_result_${summary.upload_id || 'upload'}.xlsx`;
                          document.body.appendChild(a);
                          a.click();
                          window.URL.revokeObjectURL(url);
                          document.body.removeChild(a);
                          
                          // Show summary toast
                          if (summary.errors > 0) {
                            toast.warning(`Processed ${summary.total_rows} rows: ${summary.scheduled} scheduled, ${summary.partial || 0} partial, ${summary.errors} errors. Check downloaded file for details.`);
                          } else if (summary.partial > 0) {
                            toast.warning(`Processed ${summary.total_rows} rows: ${summary.scheduled} scheduled, ${summary.partial} partial (capacity overflow). Total: ${summary.total_allocated} allocated, ${summary.total_not_allocated} overflow.`);
                          } else {
                            toast.success(`Successfully created ${summary.schedules_created} production schedules. Total allocated: ${summary.total_allocated}`);
                          }
                          
                          fetchAllData();
                          setPendingUploadFile(null);
                        }
                      } catch (error) {
                        if (error.response?.data instanceof Blob) {
                          const text = await error.response.data.text();
                          try {
                            const data = JSON.parse(text);
                            toast.error(data.detail || "Failed to upload plan");
                          } catch {
                            toast.error("Failed to upload plan");
                          }
                        } else {
                          toast.error(error.response?.data?.detail || "Failed to upload plan");
                        }
                      }
                      setUploadLoading(false);
                      e.target.value = '';
                    }}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-zinc-50 p-4 rounded border">
                <h4 className="font-bold text-sm mb-2">Upload Format:</h4>
                <table className="text-xs font-mono">
                  <thead>
                    <tr className="text-left">
                      <th className="pr-4 pb-1">Branch ID</th>
                      <th className="pr-4 pb-1">Date (DD-MM-YYYY)</th>
                      <th className="pr-4 pb-1">Buyer SKU ID</th>
                      <th className="pr-4 pb-1">Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="text-zinc-600">
                    <tr>
                      <td className="pr-4">BR_001</td>
                      <td className="pr-4">10-04-2026</td>
                      <td className="pr-4">KM_SC_BN_001</td>
                      <td className="pr-4">100</td>
                    </tr>
                    <tr>
                      <td className="pr-4">BR_002</td>
                      <td className="pr-4">10-04-2026</td>
                      <td className="pr-4">KM_RO_BT_002</td>
                      <td className="pr-4">50</td>
                    </tr>
                  </tbody>
                </table>
                <p className="text-xs text-muted-foreground mt-2">
                  Download the template for a list of valid Branch IDs and Buyer SKU IDs. Date format: DD-MM-YYYY
                </p>
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

        {/* Delete Schedule Tab */}
        <TabsContent value="delete-schedule" data-testid="delete-schedule-content">
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="w-5 h-5" />
                Delete Production Schedules
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Soft-delete schedules for a month and branch. Deleted schedules will not appear in planning.
                When new schedules are created, completed quantities will be auto-populated.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Selection Form */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-zinc-50 rounded-lg">
                <div>
                  <Label>Year *</Label>
                  <Select value={deleteYear || "_none"} onValueChange={(v) => {
                    setDeleteYear(v === "_none" ? "" : v);
                    // Reset month if year changes to ensure valid month selection
                    setDeleteMonthNum("");
                  }}>
                    <SelectTrigger data-testid="delete-year-select">
                      <SelectValue placeholder="Select year..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Select year...</SelectItem>
                      {getYearOptions().map(year => (
                        <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Month *</Label>
                  <Select 
                    value={deleteMonthNum || "_none"} 
                    onValueChange={(v) => setDeleteMonthNum(v === "_none" ? "" : v)}
                    disabled={!deleteYear}
                  >
                    <SelectTrigger data-testid="delete-month-select">
                      <SelectValue placeholder={deleteYear ? "Select month..." : "Select year first"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Select month...</SelectItem>
                      {getMonthOptions().map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">Cannot select past months</p>
                </div>
                
                <div>
                  <Label>Branch *</Label>
                  <Select value={deleteBranch || "_none"} onValueChange={(v) => setDeleteBranch(v === "_none" ? "" : v)}>
                    <SelectTrigger data-testid="delete-branch-select">
                      <SelectValue placeholder="Select branch..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Select a branch...</SelectItem>
                      {branchCapacities.map(b => (
                        <SelectItem key={b.branch} value={b.branch}>{b.branch}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-end gap-2">
                  <Button
                    variant="outline"
                    disabled={!deleteMonth || !deleteBranch || deleteLoading || !deletePreview?.schedules?.length}
                    onClick={handleDownloadSchedules}
                    className="flex-1"
                    data-testid="download-schedules-btn"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={!deleteMonth || !deleteBranch || deleteLoading || !deletePreview?.summary?.total_count}
                    onClick={() => setShowDeleteConfirmDialog(true)}
                    className="flex-1"
                    data-testid="delete-schedules-btn"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
              
              {/* Loading State */}
              {deleteLoading && (
                <div className="text-center py-8 text-muted-foreground">
                  <div className="animate-spin inline-block w-6 h-6 border-2 border-current border-t-transparent rounded-full mb-2" />
                  <p>Loading preview...</p>
                </div>
              )}
              
              {/* Preview Section */}
              {deletePreview && !deleteLoading && (
                <div className="space-y-4">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="border-red-200 bg-red-50">
                      <CardContent className="p-4 text-center">
                        <p className="text-3xl font-bold text-red-600">{deletePreview.summary?.total_count || 0}</p>
                        <p className="text-xs text-red-700">Schedules to Delete</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <p className="text-3xl font-bold text-amber-600">{deletePreview.summary?.schedules_with_completion || 0}</p>
                        <p className="text-xs text-muted-foreground">With Completed Qty</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <p className="text-3xl font-bold">{deletePreview.summary?.total_target_quantity?.toLocaleString() || 0}</p>
                        <p className="text-xs text-muted-foreground">Total Target Qty</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <p className="text-3xl font-bold text-green-600">{deletePreview.summary?.total_completed_quantity?.toLocaleString() || 0}</p>
                        <p className="text-xs text-muted-foreground">Total Completed Qty</p>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {/* Preview Table */}
                  {deletePreview.schedules?.length > 0 ? (
                    <Card>
                      <CardHeader className="py-3 px-4 bg-zinc-50 border-b">
                        <CardTitle className="text-sm">Preview: Schedules to be deleted</CardTitle>
                      </CardHeader>
                      <CardContent className="p-0 max-h-[400px] overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-zinc-100 sticky top-0">
                            <tr>
                              <th className="py-2 px-3 text-left font-medium">Schedule Code</th>
                              <th className="py-2 px-3 text-left font-medium">SKU</th>
                              <th className="py-2 px-3 text-left font-medium">Date</th>
                              <th className="py-2 px-3 text-right font-medium">Target</th>
                              <th className="py-2 px-3 text-right font-medium">Completed</th>
                              <th className="py-2 px-3 text-center font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {deletePreview.schedules.map((s, idx) => (
                              <tr key={s.id || idx} className="hover:bg-zinc-50">
                                <td className="py-2 px-3 font-mono text-xs">{s.schedule_code}</td>
                                <td className="py-2 px-3">
                                  <div className="font-mono text-xs">{s.sku_id}</div>
                                  <div className="text-xs text-muted-foreground truncate max-w-[150px]">{s.sku_description}</div>
                                </td>
                                <td className="py-2 px-3 font-mono text-xs">
                                  {s.target_date ? new Date(s.target_date).toLocaleDateString() : '-'}
                                </td>
                                <td className="py-2 px-3 text-right font-mono">{s.target_quantity?.toLocaleString()}</td>
                                <td className={`py-2 px-3 text-right font-mono ${s.completed_quantity > 0 ? 'text-green-600 font-bold' : 'text-muted-foreground'}`}>
                                  {s.completed_quantity?.toLocaleString() || 0}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <Badge variant={s.status === 'COMPLETED' ? 'default' : 'secondary'} className="text-xs">
                                    {s.status}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="bg-zinc-50">
                      <CardContent className="p-8 text-center text-muted-foreground">
                        <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                        <p>No schedules found for {deleteBranch} in {deleteMonth}</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
              
              {/* Empty State */}
              {(!deleteYear || !deleteMonthNum) && !deleteBranch && (
                <Card className="bg-zinc-50">
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <Calendar className="w-8 h-8 mx-auto mb-2" />
                    <p>Select year, month, and branch to preview schedules for deletion</p>
                  </CardContent>
                </Card>
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

      {/* Capacity Conflict Dialog */}
      <Dialog open={showConflictDialog} onOpenChange={setShowConflictDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="w-5 h-5" />
              Capacity Conflict Detected
            </DialogTitle>
            <DialogDescription>
              Existing schedules were found that would cause capacity overflow. Choose how to proceed.
            </DialogDescription>
          </DialogHeader>
          
          {conflictData && (
            <div className="space-y-4">
              {/* Conflict Summary */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h4 className="font-semibold text-sm mb-2">Conflict Summary:</h4>
                <div className="space-y-2">
                  {conflictData.conflicts?.map((c, idx) => (
                    <div key={idx} className="text-sm bg-white p-2 rounded border">
                      <div className="font-medium">{c.branch} - {c.date}</div>
                      <div className="grid grid-cols-2 gap-2 mt-1 text-xs text-muted-foreground">
                        <span>Branch Capacity: <strong className="text-foreground">{c.capacity}</strong></span>
                        <span>Already Scheduled: <strong className="text-blue-600">{c.existing_scheduled}</strong></span>
                        <span>New Demand: <strong className="text-orange-600">{c.new_demand}</strong></span>
                        <span>Overflow: <strong className="text-red-600">{c.overflow}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="flex gap-4 text-sm">
                <Badge variant="outline">Total Rows: {conflictData.total_rows}</Badge>
                <Badge variant="secondary">Valid: {conflictData.valid_rows}</Badge>
                {conflictData.error_rows > 0 && (
                  <Badge variant="destructive">Errors: {conflictData.error_rows}</Badge>
                )}
              </div>

              {/* Options */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Choose Action:</h4>
                
                <Card 
                  className="cursor-pointer hover:border-blue-500 transition-colors"
                  onClick={async () => {
                    if (!pendingUploadFile) return;
                    setUploadLoading(true);
                    setShowConflictDialog(false);
                    
                    try {
                      const formData = new FormData();
                      formData.append('file', pendingUploadFile);
                      
                      const res = await axios.post(`${API}/cpc/production-plan/upload-excel?mode=override`, formData, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                        responseType: 'blob'
                      });
                      
                      const summary = JSON.parse(res.headers['x-upload-summary'] || '{}');
                      
                      // Download result
                      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `production_plan_result_${summary.upload_id || 'upload'}.xlsx`;
                      document.body.appendChild(a);
                      a.click();
                      window.URL.revokeObjectURL(url);
                      document.body.removeChild(a);
                      
                      toast.success(`Override complete! ${summary.schedules_created} schedules created, ${summary.total_allocated} units allocated.`);
                      fetchAllData();
                    } catch (error) {
                      toast.error("Failed to process override");
                    }
                    setUploadLoading(false);
                    setPendingUploadFile(null);
                    setConflictData(null);
                  }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                      </div>
                      <div>
                        <div className="font-medium">Override Existing</div>
                        <div className="text-xs text-muted-foreground">Delete existing schedules for conflicting dates, then allocate new demand up to capacity</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card 
                  className="cursor-pointer hover:border-green-500 transition-colors"
                  onClick={async () => {
                    if (!pendingUploadFile) return;
                    setUploadLoading(true);
                    setShowConflictDialog(false);
                    
                    try {
                      const formData = new FormData();
                      formData.append('file', pendingUploadFile);
                      
                      const res = await axios.post(`${API}/cpc/production-plan/upload-excel?mode=add`, formData, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                        responseType: 'blob'
                      });
                      
                      const summary = JSON.parse(res.headers['x-upload-summary'] || '{}');
                      
                      // Download result
                      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `production_plan_result_${summary.upload_id || 'upload'}.xlsx`;
                      document.body.appendChild(a);
                      a.click();
                      window.URL.revokeObjectURL(url);
                      document.body.removeChild(a);
                      
                      if (summary.partial > 0 || summary.rejected > 0) {
                        toast.warning(`Partial allocation: ${summary.scheduled} scheduled, ${summary.partial} partial, ${summary.rejected} rejected. Check downloaded file.`);
                      } else {
                        toast.success(`Add complete! ${summary.schedules_created} schedules created, ${summary.total_allocated} units allocated.`);
                      }
                      fetchAllData();
                    } catch (error) {
                      toast.error("Failed to process add");
                    }
                    setUploadLoading(false);
                    setPendingUploadFile(null);
                    setConflictData(null);
                  }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <div className="font-medium">Add to Remaining Capacity</div>
                        <div className="text-xs text-muted-foreground">Keep existing schedules, allocate only within remaining capacity (partial allocation if needed)</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowConflictDialog(false);
                setPendingUploadFile(null);
                setConflictData(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Overflow Allocation Dialog */}
      <Dialog open={showOverflowDialog} onOpenChange={setShowOverflowDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="w-5 h-5" />
              Capacity Exceeded - Allocate Remaining
            </DialogTitle>
            <DialogDescription>
              Some quantities exceeded branch capacity and were capped. Allocate the remaining units to different dates.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Download capacity button */}
            <div className="flex justify-end">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.open(`${API}/cpc/available-capacity/download`, '_blank')}
              >
                <Download className="w-4 h-4 mr-2" />
                Download Capacity Report
              </Button>
            </div>

            {/* Overflow items */}
            {overflowItems.map((item, idx) => (
              <Card key={idx} className="border-l-4 border-l-orange-500">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="font-mono font-bold">{item.sku_id}</div>
                      <div className="text-sm text-muted-foreground">{item.sku_name}</div>
                      <div className="flex gap-4 mt-2 text-sm">
                        <span>Original Date: <strong>{item.date}</strong></span>
                        <span>Branch: <strong>{item.branch}</strong></span>
                      </div>
                      <div className="flex gap-4 mt-1 text-sm">
                        <span>Requested: <strong>{item.requested_qty}</strong></span>
                        <span className="text-green-600">Allocated: <strong>{item.allocated_qty}</strong></span>
                        <span className="text-orange-600">Remaining: <strong>{item.overflow_qty}</strong></span>
                      </div>
                    </div>
                    
                    <div className="flex items-end gap-2">
                      <div>
                        <Label className="text-xs">Branch</Label>
                        <Select 
                          value={overflowAllocation[idx]?.branch || item.branch}
                          onValueChange={(v) => setOverflowAllocation(prev => ({
                            ...prev,
                            [idx]: { ...prev[idx], branch: v }
                          }))}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {branchCapacities.map(b => (
                              <SelectItem key={b.branch} value={b.branch}>{b.branch}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Date</Label>
                        <Input 
                          type="date"
                          className="w-40"
                          value={overflowAllocation[idx]?.date || ""}
                          onChange={(e) => setOverflowAllocation(prev => ({
                            ...prev,
                            [idx]: { ...prev[idx], date: e.target.value }
                          }))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Qty</Label>
                        <Input 
                          type="number"
                          className="w-24"
                          value={overflowAllocation[idx]?.qty || item.overflow_qty}
                          onChange={(e) => setOverflowAllocation(prev => ({
                            ...prev,
                            [idx]: { ...prev[idx], qty: parseInt(e.target.value) || 0 }
                          }))}
                        />
                      </div>
                      <Button 
                        size="sm"
                        onClick={() => handleAllocateOverflow(idx)}
                        className="uppercase text-xs"
                      >
                        Allocate
                      </Button>
                    </div>
                  </div>
                  
                  {/* Show available capacity for selected branch */}
                  {overflowAllocation[idx]?.branch && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs text-muted-foreground mb-2">Available Capacity for {overflowAllocation[idx]?.branch}:</p>
                      <div className="flex gap-2 flex-wrap">
                        {availableCapacity
                          .filter(c => c.branch === overflowAllocation[idx]?.branch && c.available > 0)
                          .slice(0, 7)
                          .map(c => (
                            <button
                              key={c.date}
                              className={`px-2 py-1 rounded text-xs font-mono border hover:bg-zinc-100 ${
                                overflowAllocation[idx]?.date === c.date ? 'bg-blue-100 border-blue-500' : ''
                              }`}
                              onClick={() => setOverflowAllocation(prev => ({
                                ...prev,
                                [idx]: { ...prev[idx], date: c.date }
                              }))}
                            >
                              {c.date.slice(5)} ({c.available} avail)
                            </button>
                          ))
                        }
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {overflowItems.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                All overflow items have been allocated!
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowOverflowDialog(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Confirm Schedule Deletion
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm">
                Are you sure you want to delete <strong className="text-red-600">{deletePreview?.summary?.total_count || 0} production schedules</strong> for:
              </p>
              <ul className="mt-2 text-sm space-y-1">
                <li><strong>Branch:</strong> {deleteBranch}</li>
                <li><strong>Month:</strong> {deleteMonth}</li>
              </ul>
            </div>
            
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <strong>Note:</strong> Schedules will be marked as "DELETED" (soft delete). 
                {deletePreview?.summary?.schedules_with_completion > 0 && (
                  <span> {deletePreview.summary.schedules_with_completion} schedule(s) have completed quantities that will be preserved for new schedules.</span>
                )}
              </p>
            </div>
          </div>
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDeleteConfirmDialog(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteSchedules}
              disabled={deleting}
              data-testid="confirm-delete-btn"
            >
              {deleting ? "Deleting..." : "Yes, Delete Schedules"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CPC;

import { useState, useEffect } from "react";
import axios from "axios";
import useAuthStore from "@/store/authStore";
import { 
  Factory, Calendar, CheckCircle2, Clock, Package, 
  Filter, ChevronDown, AlertCircle, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const BranchOps = () => {
  const { token, user } = useAuthStore();
  
  // State
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [myBranches, setMyBranches] = useState([]);
  
  // Filters
  const [dateFilter, setDateFilter] = useState("today");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("_all");
  const [statusFilter, setStatusFilter] = useState("_all");
  
  // Complete dialog
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [completedQty, setCompletedQty] = useState(0);
  const [completionNotes, setCompletionNotes] = useState("");
  const [completing, setCompleting] = useState(false);

  const getHeaders = () => token ? { Authorization: `Bearer ${token}` } : {};

  // Fetch data on mount and filter change
  useEffect(() => {
    fetchMyBranches();
  }, [token]);

  useEffect(() => {
    if (myBranches.length > 0 || dashboard) {
      fetchSchedules();
    }
  }, [dateFilter, startDate, endDate, selectedBranch, statusFilter, myBranches]);

  const fetchMyBranches = async () => {
    try {
      const res = await axios.get(`${API}/branch-ops/my-branches`, { headers: getHeaders() });
      setMyBranches(res.data.branches || []);
      fetchDashboard();
    } catch (error) {
      toast.error("Failed to load branch data");
    }
  };

  const fetchDashboard = async () => {
    try {
      const res = await axios.get(`${API}/branch-ops/dashboard`, { headers: getHeaders() });
      setDashboard(res.data);
      setLoading(false);
    } catch (error) {
      toast.error("Failed to load dashboard");
      setLoading(false);
    }
  };

  const fetchSchedules = async () => {
    try {
      let url = `${API}/branch-ops/schedules?date_filter=${dateFilter}`;
      
      if (dateFilter === "custom" && startDate && endDate) {
        url += `&start_date=${startDate}&end_date=${endDate}`;
      }
      
      if (selectedBranch && selectedBranch !== "_all") {
        url += `&branch=${encodeURIComponent(selectedBranch)}`;
      }
      
      if (statusFilter && statusFilter !== "_all") {
        url += `&status=${statusFilter}`;
      }
      
      const res = await axios.get(url, { headers: getHeaders() });
      setSchedules(res.data.schedules || []);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to load schedules");
    }
  };

  const openCompleteDialog = (schedule) => {
    setSelectedSchedule(schedule);
    setCompletedQty(schedule.target_quantity);
    setCompletionNotes("");
    setShowCompleteDialog(true);
  };

  const handleComplete = async () => {
    if (!selectedSchedule) return;
    if (completedQty <= 0) {
      toast.error("Completed quantity must be greater than 0");
      return;
    }
    
    setCompleting(true);
    try {
      await axios.put(
        `${API}/branch-ops/schedules/${selectedSchedule.id}/complete?completed_quantity=${completedQty}${completionNotes ? `&notes=${encodeURIComponent(completionNotes)}` : ''}`,
        {},
        { headers: getHeaders() }
      );
      
      toast.success(`Schedule ${selectedSchedule.schedule_code} marked as completed!`);
      setShowCompleteDialog(false);
      setSelectedSchedule(null);
      fetchSchedules();
      fetchDashboard();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to complete schedule");
    } finally {
      setCompleting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "SCHEDULED":
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Scheduled</Badge>;
      case "COMPLETED":
        return <Badge className="bg-green-100 text-green-800 border-green-200">Completed</Badge>;
      case "CANCELLED":
        return <Badge className="bg-red-100 text-red-800 border-red-200">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short' 
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-lg text-zinc-600">Loading Branch Operations...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="branch-ops-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Factory className="w-6 h-6 text-blue-600" />
            Branch Operations
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {dashboard?.branches?.length === 1 
              ? `Branch: ${dashboard.branches[0]}`
              : `${dashboard?.branches?.length || 0} branches assigned`
            }
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-zinc-500">Logged in as</p>
          <p className="font-semibold">{dashboard?.user || user?.name}</p>
        </div>
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Today's Stats */}
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-2 text-zinc-500 text-sm mb-2">
            <Calendar className="w-4 h-4" />
            Today's Production
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-bold text-blue-600">{dashboard?.today?.scheduled || 0}</p>
              <p className="text-xs text-zinc-500">Pending</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{dashboard?.today?.completed || 0}</p>
              <p className="text-xs text-zinc-500">Completed</p>
            </div>
          </div>
        </div>

        {/* Today's Quantity */}
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-2 text-zinc-500 text-sm mb-2">
            <Package className="w-4 h-4" />
            Today's Quantity
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-bold">{dashboard?.today?.target_qty?.toLocaleString() || 0}</p>
              <p className="text-xs text-zinc-500">Target</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{dashboard?.today?.completed_qty?.toLocaleString() || 0}</p>
              <p className="text-xs text-zinc-500">Produced</p>
            </div>
          </div>
        </div>

        {/* Week Stats */}
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-2 text-zinc-500 text-sm mb-2">
            <Clock className="w-4 h-4" />
            This Week
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-bold">{dashboard?.week?.total || 0}</p>
              <p className="text-xs text-zinc-500">Total Schedules</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{dashboard?.week?.completed || 0}</p>
              <p className="text-xs text-zinc-500">Completed</p>
            </div>
          </div>
        </div>

        {/* Completion Rate */}
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-2 text-zinc-500 text-sm mb-2">
            <CheckCircle2 className="w-4 h-4" />
            Completion Rate
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-600">
              {dashboard?.today?.total > 0 
                ? Math.round((dashboard.today.completed / dashboard.today.total) * 100)
                : 0
              }%
            </p>
            <p className="text-xs text-zinc-500">Today's Progress</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-lg p-4 shadow-sm">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <Label className="text-xs text-zinc-500">Date Filter</Label>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {dateFilter === "custom" && (
            <>
              <div>
                <Label className="text-xs text-zinc-500">Start Date</Label>
                <Input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <div>
                <Label className="text-xs text-zinc-500">End Date</Label>
                <Input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-40"
                />
              </div>
            </>
          )}

          {myBranches.length > 1 && (
            <div>
              <Label className="text-xs text-zinc-500">Branch</Label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="All Branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All Branches</SelectItem>
                  {myBranches.map(b => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label className="text-xs text-zinc-500">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All Status</SelectItem>
                <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" onClick={fetchSchedules} className="ml-auto">
            <Filter className="w-4 h-4 mr-2" />
            Apply Filters
          </Button>
        </div>
      </div>

      {/* Schedules Table */}
      <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-zinc-50">
          <h2 className="font-semibold flex items-center gap-2">
            <Package className="w-5 h-5" />
            Production Schedules
            <Badge variant="outline" className="ml-2">{schedules.length} schedules</Badge>
          </h2>
        </div>

        {schedules.length === 0 ? (
          <div className="p-12 text-center text-zinc-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-zinc-300" />
            <p className="text-lg font-medium">No schedules found</p>
            <p className="text-sm">Try adjusting your filters or check back later</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b">
                <tr>
                  <th className="p-3 text-left font-semibold">Schedule Code</th>
                  <th className="p-3 text-left font-semibold">Target Date</th>
                  <th className="p-3 text-left font-semibold">Branch</th>
                  <th className="p-3 text-left font-semibold">SKU ID</th>
                  <th className="p-3 text-left font-semibold">Description</th>
                  <th className="p-3 text-right font-semibold">Target Qty</th>
                  <th className="p-3 text-right font-semibold">Completed</th>
                  <th className="p-3 text-center font-semibold">Status</th>
                  <th className="p-3 text-center font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((schedule) => (
                  <tr key={schedule.id} className="border-b hover:bg-zinc-50">
                    <td className="p-3 font-mono font-bold text-blue-600">
                      {schedule.schedule_code}
                    </td>
                    <td className="p-3">
                      {formatDate(schedule.target_date)}
                    </td>
                    <td className="p-3">
                      <Badge variant="outline">{schedule.branch}</Badge>
                    </td>
                    <td className="p-3 font-mono">{schedule.sku_id}</td>
                    <td className="p-3 text-zinc-600 max-w-xs truncate" title={schedule.sku_description || schedule.sku_details?.description}>
                      {schedule.sku_description || schedule.sku_details?.description || "-"}
                    </td>
                    <td className="p-3 text-right font-bold">
                      {schedule.target_quantity?.toLocaleString()}
                    </td>
                    <td className="p-3 text-right font-bold text-green-600">
                      {schedule.completed_quantity?.toLocaleString() || 0}
                    </td>
                    <td className="p-3 text-center">
                      {getStatusBadge(schedule.status)}
                    </td>
                    <td className="p-3 text-center">
                      {schedule.status === "SCHEDULED" && (
                        <Button 
                          size="sm" 
                          onClick={() => openCompleteDialog(schedule)}
                          className="bg-green-600 hover:bg-green-700"
                          data-testid={`complete-btn-${schedule.id}`}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Complete
                        </Button>
                      )}
                      {schedule.status === "COMPLETED" && (
                        <span className="text-xs text-zinc-400">
                          {schedule.completed_by_name ? `by ${schedule.completed_by_name}` : "Done"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Complete Dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Mark Production Complete
            </DialogTitle>
          </DialogHeader>
          
          {selectedSchedule && (
            <div className="space-y-4">
              <div className="bg-zinc-50 rounded-lg p-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-zinc-500">Schedule</span>
                  <span className="font-mono font-bold">{selectedSchedule.schedule_code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-zinc-500">SKU</span>
                  <span className="font-mono">{selectedSchedule.sku_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-zinc-500">Target Qty</span>
                  <span className="font-bold">{selectedSchedule.target_quantity?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-zinc-500">Branch</span>
                  <Badge variant="outline">{selectedSchedule.branch}</Badge>
                </div>
              </div>

              <div>
                <Label>Actual Quantity Produced</Label>
                <Input
                  type="number"
                  value={completedQty}
                  onChange={(e) => setCompletedQty(parseInt(e.target.value) || 0)}
                  className="text-lg font-bold"
                  data-testid="completed-qty-input"
                />
                {completedQty !== selectedSchedule.target_quantity && (
                  <p className="text-xs text-amber-600 mt-1">
                    {completedQty < selectedSchedule.target_quantity 
                      ? `${selectedSchedule.target_quantity - completedQty} units short of target`
                      : `${completedQty - selectedSchedule.target_quantity} units over target`
                    }
                  </p>
                )}
              </div>

              <div>
                <Label>Notes (Optional)</Label>
                <Input
                  placeholder="Any remarks about production..."
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setShowCompleteDialog(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleComplete}
                  disabled={completing || completedQty <= 0}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  data-testid="confirm-complete-btn"
                >
                  {completing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Completing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Confirm Complete
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BranchOps;

import { useState, useEffect } from "react";
import axios from "axios";
import { 
  AlertTriangle, 
  Download, 
  Package, 
  Building2,
  Calendar,
  Search,
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import useAuthStore from "@/store/authStore";
import useBranchStore from "@/store/branchStore";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const RMShortage = () => {
  const { hasRole, isMasterAdmin } = useAuthStore();
  const { selectedBranch } = useBranchStore();
  const isAdmin = isMasterAdmin();
  const isProcurement = hasRole('PROCUREMENT_OFFICER');
  const canViewAllBranches = isAdmin || isProcurement;

  // State
  const [branches, setBranches] = useState([]);
  const [branchFilter, setBranchFilter] = useState(canViewAllBranches ? "" : selectedBranch);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Initialize dates (next 7 days)
  useEffect(() => {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    
    setStartDate(today.toISOString().split('T')[0]);
    setEndDate(nextWeek.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (canViewAllBranches) {
      fetchBranches();
    }
  }, [canViewAllBranches]);

  useEffect(() => {
    if (startDate && endDate) {
      fetchReport();
    }
  }, [branchFilter, startDate, endDate]);

  const fetchBranches = async () => {
    try {
      const response = await axios.get(`${API}/branches`);
      const activeOnly = (response.data || []).filter(b => b.is_active !== false);
      setBranches(activeOnly);
    } catch (error) {
      console.error("Failed to fetch branches");
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (branchFilter) params.append('branch', branchFilter);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const response = await axios.get(`${API}/rm-shortage-report?${params.toString()}`);
      setReportData(response.data);
    } catch (error) {
      console.error("Failed to fetch report:", error);
      toast.error("Failed to load RM shortage report");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      toast.info("Preparing export...");
      const params = new URLSearchParams();
      if (branchFilter) params.append('branch', branchFilter);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      
      const response = await axios.get(`${API}/rm-shortage-report/export?${params.toString()}`, {
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `rm_shortage_report_${startDate}_${endDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success("Export downloaded!");
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export report");
    }
  };

  // Get flat data for display
  const getFlatData = () => {
    if (!reportData) return [];
    
    let allData = [];
    
    if (reportData.branches) {
      // Multi-branch response
      reportData.branches.forEach(branch => {
        branch.data.forEach(item => {
          allData.push({ ...item, branch: branch.branch });
        });
      });
    } else if (reportData.data) {
      // Single branch response
      allData = reportData.data.map(item => ({ ...item, branch: reportData.branch }));
    }
    
    // Apply search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      allData = allData.filter(item => 
        item.rm_id?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q)
      );
    }
    
    // Sort: shortages first
    allData.sort((a, b) => a.shortage - b.shortage);
    
    return allData;
  };

  const getSummary = () => {
    if (!reportData) return { total: 0, shortage: 0, branches: 0 };
    
    if (reportData.branches) {
      return {
        total: reportData.branches.reduce((sum, b) => sum + b.summary.total_rms, 0),
        shortage: reportData.branches.reduce((sum, b) => sum + b.summary.rms_in_shortage, 0),
        branches: reportData.overall_summary?.branches_with_shortage || 0
      };
    } else if (reportData.summary) {
      return {
        total: reportData.summary.total_rms,
        shortage: reportData.summary.rms_in_shortage,
        branches: 1
      };
    }
    
    return { total: 0, shortage: 0, branches: 0 };
  };

  const flatData = getFlatData();
  const summary = getSummary();

  return (
    <div className="p-6 md:p-8" data-testid="rm-shortage-page">
      {/* Header */}
      <div className="mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight uppercase flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-orange-500" />
            RM Shortage Report
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">
            Production schedule based RM requirement analysis
          </p>
        </div>
        <Button 
          variant="default" 
          onClick={handleExport}
          className="uppercase text-xs tracking-wide"
          data-testid="export-btn"
        >
          <Download className="w-4 h-4 mr-2" />
          Export to Excel
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            {/* Branch Filter (only for admin/procurement) */}
            {canViewAllBranches && (
              <div className="w-48">
                <Label className="text-xs text-muted-foreground">Branch</Label>
                <Select 
                  value={branchFilter || "_all"} 
                  onValueChange={(v) => setBranchFilter(v === "_all" ? "" : v)}
                >
                  <SelectTrigger data-testid="branch-filter">
                    <SelectValue placeholder="All Branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All Branches</SelectItem>
                    {branches.map(b => (
                      <SelectItem key={b.name} value={b.name}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Date Range */}
            <div className="w-40">
              <Label className="text-xs text-muted-foreground">From Date</Label>
              <Input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="font-mono"
                data-testid="start-date"
              />
            </div>
            <div className="w-40">
              <Label className="text-xs text-muted-foreground">To Date</Label>
              <Input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="font-mono"
                data-testid="end-date"
              />
            </div>
            
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs text-muted-foreground">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search RM ID, description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 font-mono"
                  data-testid="search-input"
                />
              </div>
            </div>
            
            <Button onClick={fetchReport} variant="secondary" className="uppercase text-xs">
              Apply
            </Button>
          </div>
          
          {/* Period Info */}
          {reportData && (
            <div className="mt-4 text-xs text-muted-foreground font-mono flex gap-4">
              <span>Selected Period: <strong>{reportData.start_date}</strong> to <strong>{reportData.end_date}</strong></span>
              {reportData.interim_period && reportData.interim_period !== "N/A" && (
                <span>| Interim Consumption Period: <strong>{reportData.interim_period}</strong></span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase text-muted-foreground">Total RMs Analyzed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{summary.total}</div>
          </CardContent>
        </Card>
        <Card className={summary.shortage > 0 ? "border-red-200 bg-red-50" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase text-muted-foreground">RMs in Shortage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-black ${summary.shortage > 0 ? "text-red-600" : "text-green-600"}`}>
              {summary.shortage}
            </div>
          </CardContent>
        </Card>
        {canViewAllBranches && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono uppercase text-muted-foreground">Branches with Shortage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-orange-600">{summary.branches}</div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-100 border-b">
                <tr>
                  {canViewAllBranches && !branchFilter && (
                    <th className="h-12 px-4 text-left font-mono text-xs uppercase">Branch</th>
                  )}
                  <th className="h-12 px-4 text-left font-mono text-xs uppercase">RM ID</th>
                  <th className="h-12 px-4 text-left font-mono text-xs uppercase">Description</th>
                  <th className="h-12 px-4 text-left font-mono text-xs uppercase">Unit</th>
                  <th className="h-12 px-4 text-right font-mono text-xs uppercase">Current Stock</th>
                  <th className="h-12 px-4 text-right font-mono text-xs uppercase">Interim Consumption</th>
                  <th className="h-12 px-4 text-right font-mono text-xs uppercase">Projected Stock</th>
                  <th className="h-12 px-4 text-right font-mono text-xs uppercase">Period Requirement</th>
                  <th className="h-12 px-4 text-right font-mono text-xs uppercase">Shortage</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={canViewAllBranches && !branchFilter ? 9 : 8} className="p-8 text-center text-muted-foreground">
                      Loading...
                    </td>
                  </tr>
                ) : flatData.length === 0 ? (
                  <tr>
                    <td colSpan={canViewAllBranches && !branchFilter ? 9 : 8} className="p-8 text-center text-muted-foreground">
                      <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      No RM requirements found for the selected period
                    </td>
                  </tr>
                ) : (
                  flatData.map((item, idx) => (
                    <tr 
                      key={`${item.branch}-${item.rm_id}-${idx}`} 
                      className={`border-t hover:bg-zinc-50 ${item.is_shortage ? 'bg-red-50' : ''}`}
                    >
                      {canViewAllBranches && !branchFilter && (
                        <td className="p-4 font-mono text-xs">{item.branch}</td>
                      )}
                      <td className="p-4 font-mono font-bold">{item.rm_id}</td>
                      <td className="p-4 text-sm max-w-[200px] truncate" title={item.description}>
                        {item.description}
                      </td>
                      <td className="p-4 font-mono text-xs">{item.unit}</td>
                      <td className="p-4 font-mono text-right">{item.current_stock?.toLocaleString()}</td>
                      <td className="p-4 font-mono text-right text-orange-600">
                        {item.interim_consumption > 0 ? `-${item.interim_consumption?.toLocaleString()}` : '0'}
                      </td>
                      <td className="p-4 font-mono text-right">{item.projected_stock?.toLocaleString()}</td>
                      <td className="p-4 font-mono text-right font-bold">{item.period_requirement?.toLocaleString()}</td>
                      <td className="p-4 font-mono text-right">
                        {item.is_shortage ? (
                          <Badge variant="destructive" className="font-mono">
                            {item.shortage?.toLocaleString()}
                          </Badge>
                        ) : (
                          <span className="text-green-600 font-bold">+{item.shortage?.toLocaleString()}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RMShortage;

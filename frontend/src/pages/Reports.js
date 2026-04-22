import { useState, useEffect } from "react";
import axios from "axios";
import { Download, FileText, Factory, TrendingUp, Users, Package, Filter, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import useBranchStore from "@/store/branchStore";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Reports = () => {
  const { selectedBranch } = useBranchStore();
  const [activeTab, setActiveTab] = useState("dispatch-origin");
  const [loading, setLoading] = useState(false);
  
  // Historical data state
  const [historicalSalesStats, setHistoricalSalesStats] = useState(null);
  const [historicalProdStats, setHistoricalProdStats] = useState(null);
  const [salesSummary, setSalesSummary] = useState(null);
  const [prodSummary, setProdSummary] = useState(null);
  const [salesGroupBy, setSalesGroupBy] = useState("customer");
  const [prodGroupBy, setProdGroupBy] = useState("branch");
  const [salesUploading, setSalesUploading] = useState(false);
  const [prodUploading, setProdUploading] = useState(false);
  const [uploadMode, setUploadMode] = useState("append");

  // Margin report state
  const [marginReport, setMarginReport] = useState(null);
  const [marginLoading, setMarginLoading] = useState(false);
  const [marginFilters, setMarginFilters] = useState({ from_month: "", to_month: "" });
  
  // Report data states
  const [dispatchOriginData, setDispatchOriginData] = useState(null);
  const [productionByUnitData, setProductionByUnitData] = useState(null);
  const [forecastVsActualData, setForecastVsActualData] = useState(null);
  const [buyerHistoryData, setBuyerHistoryData] = useState(null);
  
  // Filter states
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    branch: "",
    buyerName: ""
  });

  const fetchDispatchOriginReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append("start_date", filters.startDate);
      if (filters.endDate) params.append("end_date", filters.endDate);
      if (filters.branch) params.append("dispatch_branch", filters.branch);
      
      const response = await axios.get(`${API}/dispatch-by-origin?${params}`);
      setDispatchOriginData(response.data);
    } catch (error) {
      console.error("Failed to fetch dispatch origin report", error);
      toast.error("Failed to fetch report");
    }
    setLoading(false);
  };

  const fetchProductionByUnitReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append("start_date", filters.startDate);
      if (filters.endDate) params.append("end_date", filters.endDate);
      if (filters.branch) params.append("branch", filters.branch);
      
      const response = await axios.get(`${API}/production-by-unit?${params}`);
      setProductionByUnitData(response.data);
    } catch (error) {
      console.error("Failed to fetch production report", error);
      toast.error("Failed to fetch report");
    }
    setLoading(false);
  };

  const fetchForecastVsActualReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append("start_date", filters.startDate);
      if (filters.endDate) params.append("end_date", filters.endDate);
      
      const response = await axios.get(`${API}/forecast-vs-actual?${params}`);
      setForecastVsActualData(response.data);
    } catch (error) {
      console.error("Failed to fetch forecast report", error);
      toast.error("Failed to fetch report");
    }
    setLoading(false);
  };

  const fetchBuyerHistoryReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append("start_date", filters.startDate);
      if (filters.endDate) params.append("end_date", filters.endDate);
      if (filters.buyerName) params.append("buyer_name", filters.buyerName);
      
      const response = await axios.get(`${API}/buyer-dispatch-history?${params}`);
      setBuyerHistoryData(response.data);
    } catch (error) {
      console.error("Failed to fetch buyer history", error);
      toast.error("Failed to fetch report");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (activeTab === "dispatch-origin") fetchDispatchOriginReport();
    else if (activeTab === "production-unit") fetchProductionByUnitReport();
    else if (activeTab === "forecast-actual") fetchForecastVsActualReport();
    else if (activeTab === "buyer-history") fetchBuyerHistoryReport();
    else if (activeTab === "historical") fetchHistoricalData();
    else if (activeTab === "margin") fetchMarginReport();
  }, [activeTab]);

  const handleRefresh = () => {
    if (activeTab === "dispatch-origin") fetchDispatchOriginReport();
    else if (activeTab === "production-unit") fetchProductionByUnitReport();
    else if (activeTab === "forecast-actual") fetchForecastVsActualReport();
    else if (activeTab === "buyer-history") fetchBuyerHistoryReport();
    else if (activeTab === "historical") fetchHistoricalData();
    else if (activeTab === "margin") fetchMarginReport();
  };

  const fetchMarginReport = async () => {
    setMarginLoading(true);
    try {
      const params = new URLSearchParams();
      if (marginFilters.from_month) params.append("from_month", marginFilters.from_month);
      if (marginFilters.to_month) params.append("to_month", marginFilters.to_month);
      const res = await axios.get(`${API}/rm-prices/margin-report?${params}`);
      setMarginReport(res.data);
    } catch (err) {
      toast.error(`Failed to load margin report: ${err.response?.data?.detail || err.message}`);
    } finally {
      setMarginLoading(false);
    }
  };

  const fetchHistoricalData = async () => {
    try {
      const [salesRes, prodRes] = await Promise.all([
        axios.get(`${API}/historical-sales/stats`),
        axios.get(`${API}/historical-production/stats`)
      ]);
      setHistoricalSalesStats(salesRes.data);
      setHistoricalProdStats(prodRes.data);
      // Fetch summaries
      const [salesSum, prodSum] = await Promise.all([
        axios.get(`${API}/historical-sales/summary?group_by=${salesGroupBy}`),
        axios.get(`${API}/historical-production/summary?group_by=${prodGroupBy}`)
      ]);
      setSalesSummary(salesSum.data);
      setProdSummary(prodSum.data);
    } catch (err) {
      console.error("Failed to fetch historical data:", err);
    }
  };

  useEffect(() => {
    if (activeTab === "historical" && historicalSalesStats) {
      axios.get(`${API}/historical-sales/summary?group_by=${salesGroupBy}`).then(r => setSalesSummary(r.data)).catch(() => {});
    }
  }, [salesGroupBy]);

  useEffect(() => {
    if (activeTab === "historical" && historicalProdStats) {
      axios.get(`${API}/historical-production/summary?group_by=${prodGroupBy}`).then(r => setProdSummary(r.data)).catch(() => {});
    }
  }, [prodGroupBy]);

  const handleSalesUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSalesUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await axios.post(`${API}/historical-sales/upload?mode=${uploadMode}`, formData, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(res.data.message);
      if (res.data.errors?.length) toast.error(`${res.data.errors.length} errors`);
      fetchHistoricalData();
    } catch (err) {
      toast.error(`Upload failed: ${err.response?.data?.detail || err.message}`);
    }
    setSalesUploading(false);
    e.target.value = "";
  };

  const handleProdUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProdUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await axios.post(`${API}/historical-production/upload?mode=${uploadMode}`, formData, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(res.data.message);
      if (res.data.errors?.length) toast.error(`${res.data.errors.length} errors`);
      if (res.data.skus_without_asp?.length) toast.info(`${res.data.skus_without_asp.length} SKUs have no ASP data`);
      fetchHistoricalData();
    } catch (err) {
      toast.error(`Upload failed: ${err.response?.data?.detail || err.message}`);
    }
    setProdUploading(false);
    e.target.value = "";
  };

  const downloadTemplate = async (type) => {
    const wb = XLSX.utils.book_new();
    if (type === "sales") {
      const data = [["Buyer SKU", "Customer ID", "Qty", "Month", "ASP"], ["EL_KS_BE_001", "ABC Toys", 500, "Jun 2025", 1200], ["EL_KS_BE_001", "XYZ Corp", 300, "Jun 2025", 1150]];
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 10 }, { wch: 12 }, { wch: 10 }];
      XLSX.utils.book_append_sheet(wb, ws, "Historical Sales");

      // Customer reference tab
      try {
        const res = await axios.get(`${API}/buyers`);
        const customers = res.data || [];
        const custRows = [["Customer ID", "Customer Name"]];
        customers.forEach(c => custRows.push([c.customer_code || c.code || c.id || "", c.name || ""]));
        const wsCust = XLSX.utils.aoa_to_sheet(custRows);
        wsCust['!cols'] = [{ wch: 16 }, { wch: 40 }];
        XLSX.utils.book_append_sheet(wb, wsCust, "Customers");
      } catch (err) {
        console.error("Failed to fetch customers for template", err);
      }
    } else {
      const data = [["Buyer SKU", "Branch ID", "Qty", "Month"], ["EL_KS_BE_001", "Unit 1 Vedica", 800, "Jun 2025"], ["EL_KS_BE_001", "Unit 4 Goa", 200, "Jun 2025"]];
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 10 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, ws, "Historical Production");

      // Branch reference tab
      try {
        const res = await axios.get(`${API}/branches`);
        const branches = res.data || [];
        const bRows = [["Branch ID", "Branch Name"]];
        branches.forEach(b => bRows.push([b.branch_id || b.id || "", b.name || ""]));
        const wsB = XLSX.utils.aoa_to_sheet(bRows);
        wsB['!cols'] = [{ wch: 18 }, { wch: 30 }];
        XLSX.utils.book_append_sheet(wb, wsB, "Branches");
      } catch (err) {
        console.error("Failed to fetch branches for template", err);
      }
    }
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}_upload_template.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportToExcel = (data, filename) => {
    if (!data) return;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `${filename}.xlsx`);
    toast.success("Exported to Excel");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">Analytics and insights across operations</p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="text-xs text-muted-foreground">Start Date</label>
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                className="w-40"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">End Date</label>
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                className="w-40"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Branch</label>
              <Input
                placeholder="Branch name..."
                value={filters.branch}
                onChange={(e) => setFilters({...filters, branch: e.target.value})}
                className="w-40"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Buyer</label>
              <Input
                placeholder="Buyer name..."
                value={filters.buyerName}
                onChange={(e) => setFilters({...filters, buyerName: e.target.value})}
                className="w-40"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleRefresh} size="sm">Apply</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-6 w-full max-w-4xl">
          <TabsTrigger value="dispatch-origin" className="text-xs">
            <Package className="h-3 w-3 mr-1" />
            Dispatch Origin
          </TabsTrigger>
          <TabsTrigger value="production-unit" className="text-xs">
            <Factory className="h-3 w-3 mr-1" />
            Production by Unit
          </TabsTrigger>
          <TabsTrigger value="forecast-actual" className="text-xs">
            <TrendingUp className="h-3 w-3 mr-1" />
            Forecast vs Actual
          </TabsTrigger>
          <TabsTrigger value="buyer-history" className="text-xs">
            <Users className="h-3 w-3 mr-1" />
            Buyer History
          </TabsTrigger>
          <TabsTrigger value="historical" className="text-xs" data-testid="historical-tab">
            <FileText className="h-3 w-3 mr-1" />
            Historical Data
          </TabsTrigger>
          <TabsTrigger value="margin" className="text-xs" data-testid="margin-tab">
            <TrendingUp className="h-3 w-3 mr-1" />
            Margin Report
          </TabsTrigger>
        </TabsList>

        {/* Dispatch by Manufacturing Origin */}
        <TabsContent value="dispatch-origin" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Dispatch by Manufacturing Origin</CardTitle>
                  <CardDescription>Track where dispatched goods were originally manufactured</CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => exportToExcel(dispatchOriginData?.detailed_records, "dispatch_origin_report")}
                  disabled={!dispatchOriginData}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : dispatchOriginData ? (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {dispatchOriginData.summary?.map((item, idx) => (
                      <Card key={idx} className="bg-purple-50 border-purple-200">
                        <CardContent className="pt-4">
                          <div className="text-2xl font-bold text-purple-700">{item.total_quantity.toLocaleString()}</div>
                          <div className="text-sm font-medium">{item.manufacturing_unit}</div>
                          <div className="text-xs text-muted-foreground">{item.sku_count} SKUs</div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  
                  {/* Detailed Table */}
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Lot ID</TableHead>
                          <TableHead>Dispatched</TableHead>
                          <TableHead>From</TableHead>
                          <TableHead>Buyer</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead>Made At</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dispatchOriginData.detailed_records?.slice(0, 50).map((record, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-xs">{record.lot_id}</TableCell>
                            <TableCell className="text-xs">{record.dispatched_at?.split('T')[0] || '-'}</TableCell>
                            <TableCell>{record.dispatch_from}</TableCell>
                            <TableCell>{record.buyer}</TableCell>
                            <TableCell className="font-mono text-xs">{record.sku_id}</TableCell>
                            <TableCell className="text-right font-medium">{record.quantity}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                                {record.manufacturing_unit}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Showing {Math.min(50, dispatchOriginData.detailed_records?.length || 0)} of {dispatchOriginData.total_records} records
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">No data available</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Production by Unit */}
        <TabsContent value="production-unit" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Production Output by Unit</CardTitle>
                  <CardDescription>What each branch/unit manufactured</CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => exportToExcel(productionByUnitData?.detailed_records, "production_by_unit")}
                  disabled={!productionByUnitData}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : productionByUnitData ? (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {productionByUnitData.summary?.map((item, idx) => (
                      <Card key={idx} className="bg-green-50 border-green-200">
                        <CardContent className="pt-4">
                          <div className="text-2xl font-bold text-green-700">{item.total_produced.toLocaleString()}</div>
                          <div className="text-sm font-medium">{item.branch}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.schedule_count} schedules • {item.unique_skus} SKUs
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  
                  {/* Top SKUs per Branch */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {productionByUnitData.summary?.slice(0, 4).map((branch, idx) => (
                      <Card key={idx}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">{branch.branch} - Top SKUs</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-1">
                            {branch.top_skus?.slice(0, 5).map((sku, i) => (
                              <div key={i} className="flex justify-between text-sm">
                                <span className="font-mono text-xs">{sku.sku_id}</span>
                                <span className="font-medium">{sku.quantity.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    Total: {productionByUnitData.total_schedules} completed schedules
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">No data available</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Forecast vs Actual */}
        <TabsContent value="forecast-actual" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Forecast vs Actual</CardTitle>
                  <CardDescription>Demand forecast accuracy analysis</CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => exportToExcel(forecastVsActualData?.detailed_records, "forecast_vs_actual")}
                  disabled={!forecastVsActualData}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : forecastVsActualData ? (
                <div className="space-y-6">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="pt-4">
                        <div className="text-2xl font-bold text-blue-700">
                          {forecastVsActualData.summary?.total_forecast?.toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">Total Forecast</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-green-50 border-green-200">
                      <CardContent className="pt-4">
                        <div className="text-2xl font-bold text-green-700">
                          {forecastVsActualData.summary?.total_actual?.toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">Total Actual</div>
                      </CardContent>
                    </Card>
                    <Card className={forecastVsActualData.summary?.overall_variance >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}>
                      <CardContent className="pt-4">
                        <div className={`text-2xl font-bold ${forecastVsActualData.summary?.overall_variance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {forecastVsActualData.summary?.overall_variance >= 0 ? '+' : ''}{forecastVsActualData.summary?.overall_variance?.toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">Variance</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-purple-50 border-purple-200">
                      <CardContent className="pt-4">
                        <div className="text-2xl font-bold text-purple-700">
                          {forecastVsActualData.summary?.overall_accuracy_pct}%
                        </div>
                        <div className="text-xs text-muted-foreground">Accuracy</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex gap-2 text-sm">
                          <Badge className="bg-green-100 text-green-700">{forecastVsActualData.summary?.items_on_track} On Track</Badge>
                          <Badge className="bg-orange-100 text-orange-700">{forecastVsActualData.summary?.items_over} Over</Badge>
                          <Badge className="bg-red-100 text-red-700">{forecastVsActualData.summary?.items_under} Under</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {/* Detailed Table */}
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>SKU</TableHead>
                          <TableHead>Buyer</TableHead>
                          <TableHead className="text-right">Forecast</TableHead>
                          <TableHead className="text-right">Actual</TableHead>
                          <TableHead className="text-right">Variance</TableHead>
                          <TableHead className="text-right">Variance %</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {forecastVsActualData.detailed_records?.slice(0, 50).map((record, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-xs">{record.sku_id}</TableCell>
                            <TableCell className="text-xs">{record.buyer}</TableCell>
                            <TableCell className="text-right">{record.forecast_qty.toLocaleString()}</TableCell>
                            <TableCell className="text-right font-medium">{record.actual_qty.toLocaleString()}</TableCell>
                            <TableCell className={`text-right ${record.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {record.variance >= 0 ? '+' : ''}{record.variance.toLocaleString()}
                            </TableCell>
                            <TableCell className={`text-right ${record.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {record.variance_pct}%
                            </TableCell>
                            <TableCell>
                              <Badge variant={record.status === 'On Track' ? 'success' : record.status === 'Over' ? 'warning' : 'destructive'}
                                className={record.status === 'On Track' ? 'bg-green-100 text-green-700' : record.status === 'Over' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}>
                                {record.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Showing {Math.min(50, forecastVsActualData.detailed_records?.length || 0)} of {forecastVsActualData.total_records} records
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">No data available</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Buyer Dispatch History */}
        <TabsContent value="buyer-history" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Buyer Dispatch History</CardTitle>
                  <CardDescription>Dispatch history grouped by buyer/customer</CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => exportToExcel(buyerHistoryData?.summary, "buyer_dispatch_history")}
                  disabled={!buyerHistoryData}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : buyerHistoryData ? (
                <div className="space-y-6">
                  {/* Grand Summary */}
                  <div className="grid grid-cols-3 gap-4">
                    <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="pt-4">
                        <div className="text-2xl font-bold text-blue-700">{buyerHistoryData.total_buyers}</div>
                        <div className="text-xs text-muted-foreground">Total Buyers</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-green-50 border-green-200">
                      <CardContent className="pt-4">
                        <div className="text-2xl font-bold text-green-700">{buyerHistoryData.grand_total_lots}</div>
                        <div className="text-xs text-muted-foreground">Total Dispatch Lots</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-purple-50 border-purple-200">
                      <CardContent className="pt-4">
                        <div className="text-2xl font-bold text-purple-700">{buyerHistoryData.grand_total_quantity?.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">Total Quantity</div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {/* Buyer Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {buyerHistoryData.summary?.slice(0, 10).map((buyer, idx) => (
                      <Card key={idx}>
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-base">{buyer.buyer_name}</CardTitle>
                              <CardDescription className="text-xs">{buyer.buyer_id}</CardDescription>
                            </div>
                            <Badge variant="outline">{buyer.total_lots} lots</Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex justify-between">
                              <span className="text-sm text-muted-foreground">Total Quantity</span>
                              <span className="font-bold">{buyer.total_quantity.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-muted-foreground">Unique SKUs</span>
                              <span className="font-medium">{buyer.unique_skus}</span>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground">Top SKUs:</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {buyer.top_skus?.slice(0, 3).map((sku, i) => (
                                  <Badge key={i} variant="secondary" className="text-xs">
                                    {sku.sku_id} ({sku.quantity})
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">No data available</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Historical Data Tab */}
        <TabsContent value="historical">
          <div className="space-y-6">
            {/* Upload Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Sales Upload */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Historical Sales Upload</CardTitle>
                  <CardDescription className="text-xs">Buyer SKU | Customer ID | Qty | Month | ASP</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Select value={uploadMode} onValueChange={setUploadMode}>
                      <SelectTrigger className="w-32 h-8 text-xs" data-testid="upload-mode-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="append">Append</SelectItem>
                        <SelectItem value="overwrite">Overwrite</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="file" accept=".xlsx,.xls" onChange={handleSalesUpload} disabled={salesUploading} className="text-xs h-8" data-testid="sales-upload-input" />
                  </div>
                  <Button variant="link" className="px-0 text-xs h-auto" onClick={() => downloadTemplate("sales")} data-testid="download-sales-template">
                    <Download className="w-3 h-3 mr-1" /> Download Template
                  </Button>
                  {historicalSalesStats && historicalSalesStats.total_records > 0 && (
                    <div className="text-xs text-muted-foreground bg-zinc-50 rounded p-2">
                      <span className="font-medium">{historicalSalesStats.total_records}</span> records | 
                      <span className="font-medium ml-1">{historicalSalesStats.months?.length}</span> months | 
                      Revenue: <span className="font-medium text-emerald-600">Rs {(historicalSalesStats.total_revenue || 0).toLocaleString()}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Production Upload */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Historical Production Upload</CardTitle>
                  <CardDescription className="text-xs">Buyer SKU | Branch ID | Qty | Month</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Select value={uploadMode} onValueChange={setUploadMode}>
                      <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="append">Append</SelectItem>
                        <SelectItem value="overwrite">Overwrite</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="file" accept=".xlsx,.xls" onChange={handleProdUpload} disabled={prodUploading} className="text-xs h-8" data-testid="prod-upload-input" />
                  </div>
                  <Button variant="link" className="px-0 text-xs h-auto" onClick={() => downloadTemplate("production")} data-testid="download-prod-template">
                    <Download className="w-3 h-3 mr-1" /> Download Template
                  </Button>
                  {historicalProdStats && historicalProdStats.total_records > 0 && (
                    <div className="text-xs text-muted-foreground bg-zinc-50 rounded p-2">
                      <span className="font-medium">{historicalProdStats.total_records}</span> records | 
                      <span className="font-medium ml-1">{historicalProdStats.months?.length}</span> months |
                      Value: <span className="font-medium text-emerald-600">Rs {(historicalProdStats.total_value || 0).toLocaleString()}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sales Summary */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base">Sales Summary</CardTitle>
                  <Select value={salesGroupBy} onValueChange={setSalesGroupBy}>
                    <SelectTrigger className="w-36 h-8 text-xs" data-testid="sales-group-by">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">By Customer</SelectItem>
                      <SelectItem value="model">By Model</SelectItem>
                      <SelectItem value="vertical">By Vertical</SelectItem>
                      <SelectItem value="bidso_sku">By Bidso SKU</SelectItem>
                      <SelectItem value="month">By Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {salesSummary?.data?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">{salesGroupBy === "customer" ? "Customer" : salesGroupBy === "model" ? "Model" : salesGroupBy === "vertical" ? "Vertical" : salesGroupBy === "bidso_sku" ? "Bidso SKU" : "Month"}</TableHead>
                          <TableHead className="text-xs text-right">Qty</TableHead>
                          <TableHead className="text-xs text-right">Revenue (Rs)</TableHead>
                          <TableHead className="text-xs text-right">Avg ASP</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {salesSummary.data.map((row, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-xs font-medium">{row.customer_name || row.model_code || row.vertical_code || row.bidso_sku_id || row.month_key || "-"}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{row.total_qty?.toLocaleString()}</TableCell>
                            <TableCell className="text-xs text-right font-mono text-emerald-600">{row.total_revenue?.toLocaleString()}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{row.avg_asp?.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-bold bg-zinc-50">
                          <TableCell className="text-xs">TOTAL</TableCell>
                          <TableCell className="text-xs text-right font-mono">{salesSummary.totals?.total_qty?.toLocaleString()}</TableCell>
                          <TableCell className="text-xs text-right font-mono text-emerald-600">{salesSummary.totals?.total_revenue?.toLocaleString()}</TableCell>
                          <TableCell className="text-xs text-right">-</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground text-sm">No historical sales data. Upload to get started.</div>
                )}
              </CardContent>
            </Card>

            {/* Production Summary */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base">Production Summary</CardTitle>
                  <Select value={prodGroupBy} onValueChange={setProdGroupBy}>
                    <SelectTrigger className="w-36 h-8 text-xs" data-testid="prod-group-by">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="branch">By Branch</SelectItem>
                      <SelectItem value="model">By Model</SelectItem>
                      <SelectItem value="vertical">By Vertical</SelectItem>
                      <SelectItem value="month">By Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {prodSummary?.data?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">{prodGroupBy === "branch" ? "Branch" : prodGroupBy === "model" ? "Model" : prodGroupBy === "vertical" ? "Vertical" : "Month"}</TableHead>
                          <TableHead className="text-xs text-right">Production Qty</TableHead>
                          <TableHead className="text-xs text-right">Value (Rs)</TableHead>
                          <TableHead className="text-xs text-right">Avg ASP</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {prodSummary.data.map((row, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-xs font-medium">{row.branch_name || row.model_code || row.vertical_code || row.month_key || "-"}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{row.total_qty?.toLocaleString()}</TableCell>
                            <TableCell className="text-xs text-right font-mono text-emerald-600">{row.total_value?.toLocaleString()}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{row.avg_asp?.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-bold bg-zinc-50">
                          <TableCell className="text-xs">TOTAL</TableCell>
                          <TableCell className="text-xs text-right font-mono">{prodSummary.totals?.total_qty?.toLocaleString()}</TableCell>
                          <TableCell className="text-xs text-right font-mono text-emerald-600">{prodSummary.totals?.total_value?.toLocaleString()}</TableCell>
                          <TableCell className="text-xs text-right">-</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground text-sm">No historical production data. Upload to get started.</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Margin Report Tab */}
        <TabsContent value="margin" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Margin Report (ASP vs Derived BOM Cost)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Margin % = (Avg ASP − BOM Cost) / Avg ASP × 100. Uses 3-month rolling avg RM prices.
                  </CardDescription>
                </div>
                <div className="flex items-end gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">From (YYYY-MM)</label>
                    <Input
                      placeholder="2025-06"
                      value={marginFilters.from_month}
                      onChange={(e) => setMarginFilters({ ...marginFilters, from_month: e.target.value })}
                      className="w-32 h-8 text-xs"
                      data-testid="margin-from-month"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">To (YYYY-MM)</label>
                    <Input
                      placeholder="2025-09"
                      value={marginFilters.to_month}
                      onChange={(e) => setMarginFilters({ ...marginFilters, to_month: e.target.value })}
                      className="w-32 h-8 text-xs"
                      data-testid="margin-to-month"
                    />
                  </div>
                  <Button size="sm" onClick={fetchMarginReport} disabled={marginLoading} data-testid="margin-apply">
                    Apply
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => marginReport && exportToExcel(marginReport.items, "margin_report")}
                    disabled={!marginReport?.items?.length}
                  >
                    <Download className="h-4 w-4 mr-1" /> Export
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {marginLoading ? (
                <div className="text-center py-8 text-muted-foreground">Calculating margins...</div>
              ) : marginReport ? (
                <div className="space-y-4">
                  {/* Totals Row */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="p-3 bg-blue-50 rounded">
                      <div className="text-xs text-muted-foreground">SKUs</div>
                      <div className="text-xl font-bold text-blue-700">{marginReport.count}</div>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded">
                      <div className="text-xs text-muted-foreground">Total Revenue</div>
                      <div className="text-xl font-bold text-emerald-700">
                        Rs {marginReport.totals?.total_revenue?.toLocaleString()}
                      </div>
                    </div>
                    <div className="p-3 bg-amber-50 rounded">
                      <div className="text-xs text-muted-foreground">Total COGS</div>
                      <div className="text-xl font-bold text-amber-700">
                        Rs {marginReport.totals?.total_cogs?.toLocaleString()}
                      </div>
                    </div>
                    <div className="p-3 bg-purple-50 rounded">
                      <div className="text-xs text-muted-foreground">Gross Profit</div>
                      <div className="text-xl font-bold text-purple-700">
                        Rs {marginReport.totals?.gross_profit?.toLocaleString()}
                      </div>
                    </div>
                    <div className="p-3 bg-indigo-50 rounded">
                      <div className="text-xs text-muted-foreground">Overall Margin %</div>
                      <div className="text-xl font-bold text-indigo-700" data-testid="overall-margin-pct">
                        {marginReport.totals?.overall_margin_pct}%
                      </div>
                    </div>
                  </div>

                  {marginReport.items?.length > 0 ? (
                    <div className="overflow-x-auto border rounded max-h-[60vh]">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-zinc-50 sticky top-0">
                            <TableHead className="text-xs">Buyer SKU</TableHead>
                            <TableHead className="text-xs">Name</TableHead>
                            <TableHead className="text-xs">Brand</TableHead>
                            <TableHead className="text-xs">Model</TableHead>
                            <TableHead className="text-xs text-right">Avg ASP</TableHead>
                            <TableHead className="text-xs text-right">BOM Cost</TableHead>
                            <TableHead className="text-xs text-right">Margin</TableHead>
                            <TableHead className="text-xs text-right">Margin %</TableHead>
                            <TableHead className="text-xs text-right">Qty Sold</TableHead>
                            <TableHead className="text-xs text-right">Revenue</TableHead>
                            <TableHead className="text-xs text-right">Gross Profit</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {marginReport.items.map((r, idx) => {
                            const pctClass = r.margin_pct >= 30 ? "text-emerald-700"
                              : r.margin_pct >= 10 ? "text-amber-700"
                              : "text-red-600";
                            return (
                              <TableRow key={idx}>
                                <TableCell className="font-mono text-xs">{r.buyer_sku_id}</TableCell>
                                <TableCell className="text-xs max-w-[180px] truncate" title={r.buyer_sku_name}>{r.buyer_sku_name}</TableCell>
                                <TableCell className="text-xs">{r.brand_code}</TableCell>
                                <TableCell className="text-xs">{r.model_code}</TableCell>
                                <TableCell className="text-xs text-right font-mono">Rs {r.avg_asp?.toLocaleString()}</TableCell>
                                <TableCell className="text-xs text-right font-mono">
                                  {r.bom_cost > 0 ? `Rs ${r.bom_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : <span className="text-amber-600">No price</span>}
                                  {r.missing_price_count > 0 && r.bom_cost > 0 && (
                                    <div className="text-[10px] text-amber-600">({r.missing_price_count} RM missing)</div>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs text-right font-mono">Rs {r.margin_value?.toLocaleString()}</TableCell>
                                <TableCell className={`text-xs text-right font-mono font-semibold ${pctClass}`} data-testid={`margin-pct-${r.buyer_sku_id}`}>
                                  {r.margin_pct}%
                                </TableCell>
                                <TableCell className="text-xs text-right">{r.total_qty?.toLocaleString()}</TableCell>
                                <TableCell className="text-xs text-right font-mono text-emerald-700">Rs {r.total_revenue?.toLocaleString()}</TableCell>
                                <TableCell className="text-xs text-right font-mono text-purple-700">Rs {r.gross_profit?.toLocaleString()}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center text-sm text-muted-foreground py-6">
                      No margin data. Upload Historical Sales + RM Prices to populate this report.
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">Click Apply to load margin data.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;

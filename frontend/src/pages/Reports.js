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
  }, [activeTab]);

  const handleRefresh = () => {
    if (activeTab === "dispatch-origin") fetchDispatchOriginReport();
    else if (activeTab === "production-unit") fetchProductionByUnitReport();
    else if (activeTab === "forecast-actual") fetchForecastVsActualReport();
    else if (activeTab === "buyer-history") fetchBuyerHistoryReport();
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
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
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
      </Tabs>
    </div>
  );
};

export default Reports;

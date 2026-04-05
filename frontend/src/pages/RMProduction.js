import { useState, useEffect } from "react";
import axios from "axios";
import useAuthStore from "@/store/authStore";
import useBranchStore from "@/store/branchStore";
import { 
  Factory, Package, AlertTriangle, CheckCircle, Loader2, 
  Search, Filter, Calendar, FileText, ChevronDown, ChevronUp,
  RefreshCw, Download, Plus, Eye, ArrowRight, Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const RMProduction = () => {
  const { token, user } = useAuthStore();
  const { selectedBranch: globalBranch } = useBranchStore();
  
  // State
  const [activeTab, setActiveTab] = useState("produce");
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(globalBranch || "");
  
  // Produce RM state
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [manufacturableRMs, setManufacturableRMs] = useState([]);
  const [selectedRM, setSelectedRM] = useState(null);
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [productionDate, setProductionDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Preview state
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  
  // Production log state
  const [productionLog, setProductionLog] = useState([]);
  const [logFilters, setLogFilters] = useState({
    category: "",
    rm_id: "",
    start_date: "",
    end_date: ""
  });
  const [logPage, setLogPage] = useState(1);
  const [logTotal, setLogTotal] = useState(0);
  const [logTotalPages, setLogTotalPages] = useState(0);
  
  // Summary state
  const [summary, setSummary] = useState(null);
  const [summaryPeriod, setSummaryPeriod] = useState({
    start: new Date(new Date().setDate(1)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  
  // Consumption report state
  const [consumptionReport, setConsumptionReport] = useState(null);
  
  // Expanded log rows
  const [expandedRows, setExpandedRows] = useState(new Set());

  const getHeaders = () => token ? { Authorization: `Bearer ${token}` } : {};

  // Sync with global branch
  useEffect(() => {
    if (globalBranch && globalBranch !== selectedBranch) {
      setSelectedBranch(globalBranch);
    }
  }, [globalBranch]);

  // Fetch branches on mount
  useEffect(() => {
    fetchBranches();
  }, [token]);

  // Fetch data when branch changes
  useEffect(() => {
    if (selectedBranch) {
      fetchActiveCategories();
      if (activeTab === "log") fetchProductionLog();
      if (activeTab === "reports") {
        fetchSummary();
        fetchConsumptionReport();
      }
    }
  }, [selectedBranch]);

  // Fetch manufacturable RMs when branch or category changes
  useEffect(() => {
    if (selectedBranch) {
      fetchManufacturableRMs();
    }
  }, [selectedBranch, selectedCategory]);

  // Fetch log when filters change
  useEffect(() => {
    if (activeTab === "log" && selectedBranch) {
      fetchProductionLog();
    }
  }, [logFilters, logPage, activeTab]);

  // Fetch reports when period changes
  useEffect(() => {
    if (activeTab === "reports" && selectedBranch) {
      fetchSummary();
      fetchConsumptionReport();
    }
  }, [summaryPeriod, activeTab]);

  const fetchBranches = async () => {
    try {
      const res = await axios.get(`${API}/branches`, { headers: getHeaders() });
      setBranches(res.data || []);
      if (!selectedBranch && res.data.length > 0) {
        setSelectedBranch(res.data[0].code);
      }
    } catch (err) {
      console.error("Failed to fetch branches:", err);
    }
  };

  const fetchActiveCategories = async () => {
    if (!selectedBranch) return;
    try {
      const res = await axios.get(`${API}/rm-production/active-categories?branch=${selectedBranch}`, { 
        headers: getHeaders() 
      });
      setCategories(res.data || []);
    } catch (err) {
      console.error("Failed to fetch categories:", err);
      setCategories([]);
    }
  };

  const fetchManufacturableRMs = async () => {
    if (!selectedBranch) return;
    setLoading(true);
    try {
      let url = `${API}/rm-production/manufacturable-rms?branch=${selectedBranch}`;
      if (selectedCategory) url += `&category=${selectedCategory}`;
      const res = await axios.get(url, { headers: getHeaders() });
      setManufacturableRMs(res.data || []);
    } catch (err) {
      console.error("Failed to fetch manufacturable RMs:", err);
      setManufacturableRMs([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProductionLog = async () => {
    if (!selectedBranch) return;
    setLoading(true);
    try {
      let url = `${API}/rm-production/log?branch=${selectedBranch}&page=${logPage}&page_size=20`;
      if (logFilters.category) url += `&category=${logFilters.category}`;
      if (logFilters.rm_id) url += `&rm_id=${logFilters.rm_id}`;
      if (logFilters.start_date) url += `&start_date=${logFilters.start_date}`;
      if (logFilters.end_date) url += `&end_date=${logFilters.end_date}`;
      
      const res = await axios.get(url, { headers: getHeaders() });
      setProductionLog(res.data.items || []);
      setLogTotal(res.data.total || 0);
      setLogTotalPages(res.data.total_pages || 0);
    } catch (err) {
      console.error("Failed to fetch production log:", err);
      setProductionLog([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    if (!selectedBranch || !summaryPeriod.start || !summaryPeriod.end) return;
    try {
      const res = await axios.get(
        `${API}/rm-production/summary?branch=${selectedBranch}&start_date=${summaryPeriod.start}&end_date=${summaryPeriod.end}`,
        { headers: getHeaders() }
      );
      setSummary(res.data);
    } catch (err) {
      console.error("Failed to fetch summary:", err);
      setSummary(null);
    }
  };

  const fetchConsumptionReport = async () => {
    if (!selectedBranch || !summaryPeriod.start || !summaryPeriod.end) return;
    try {
      const res = await axios.get(
        `${API}/rm-production/consumption-report?branch=${selectedBranch}&start_date=${summaryPeriod.start}&end_date=${summaryPeriod.end}`,
        { headers: getHeaders() }
      );
      setConsumptionReport(res.data);
    } catch (err) {
      console.error("Failed to fetch consumption report:", err);
      setConsumptionReport(null);
    }
  };

  const handlePreview = async () => {
    if (!selectedRM || !quantity || parseFloat(quantity) <= 0) {
      toast.error("Please select an RM and enter a valid quantity");
      return;
    }
    
    setPreviewing(true);
    try {
      const res = await axios.post(
        `${API}/rm-production/preview`,
        {
          branch: selectedBranch,
          rm_id: selectedRM.rm_id,
          quantity_to_produce: parseFloat(quantity)
        },
        { headers: getHeaders() }
      );
      setPreviewData(res.data);
      setShowPreviewDialog(true);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to preview production");
    } finally {
      setPreviewing(false);
    }
  };

  const handleConfirmProduction = async () => {
    if (!previewData || !previewData.can_produce) return;
    
    setConfirming(true);
    try {
      const res = await axios.post(
        `${API}/rm-production/confirm`,
        {
          branch: selectedBranch,
          rm_id: previewData.rm_id,
          quantity_produced: previewData.quantity_to_produce,
          production_date: productionDate,
          notes: notes
        },
        { headers: getHeaders() }
      );
      
      toast.success(res.data.message || "Production confirmed successfully");
      setShowPreviewDialog(false);
      setPreviewData(null);
      setSelectedRM(null);
      setQuantity("");
      setNotes("");
      
      // Refresh data
      fetchManufacturableRMs();
      if (activeTab === "log") fetchProductionLog();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to confirm production");
    } finally {
      setConfirming(false);
    }
  };

  const toggleRowExpand = (id) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const exportProductionLog = () => {
    if (productionLog.length === 0) {
      toast.error("No data to export");
      return;
    }
    
    const exportData = productionLog.map(log => ({
      "Production Code": log.production_code,
      "Date": log.production_date,
      "RM ID": log.rm_id,
      "RM Name": log.rm_name,
      "Category": log.category,
      "BOM Level": `L${log.bom_level}`,
      "Quantity Produced": log.quantity_produced,
      "UOM": log.uom,
      "Stock Before": log.stock_before,
      "Stock After": log.stock_after,
      "Produced By": log.produced_by_name,
      "Notes": log.notes || ""
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    ws['!cols'] = [
      { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 30 }, { wch: 10 },
      { wch: 10 }, { wch: 15 }, { wch: 8 }, { wch: 12 }, { wch: 12 },
      { wch: 20 }, { wch: 30 }
    ];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Production Log");
    
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    saveAs(new Blob([buf]), `RM_Production_Log_${selectedBranch}_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success("Production log exported");
  };

  const exportConsumptionReport = () => {
    if (!consumptionReport?.consumption?.length) {
      toast.error("No data to export");
      return;
    }
    
    const exportData = consumptionReport.consumption.map(item => ({
      "RM ID": item.rm_id,
      "RM Name": item.name,
      "Total Consumed": item.total_consumed,
      "UOM": item.uom,
      "Used In (Count)": item.used_in_count
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Consumption Report");
    
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    saveAs(new Blob([buf]), `RM_Consumption_Report_${selectedBranch}_${summaryPeriod.start}_to_${summaryPeriod.end}.xlsx`);
    toast.success("Consumption report exported");
  };

  return (
    <div className="p-6 space-y-6" data-testid="rm-production-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Factory className="w-6 h-6 text-orange-500" />
            RM Production Inward
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Manufacture RMs from components using defined BOMs
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="w-[200px]">
            <Label className="text-xs text-gray-500">Branch</Label>
            <Select value={selectedBranch || "select"} onValueChange={setSelectedBranch}>
              <SelectTrigger data-testid="branch-select">
                <SelectValue placeholder="Select Branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.filter(b => b.code).map(b => (
                  <SelectItem key={b.code} value={b.code}>{b.name || b.code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-[500px] grid-cols-3">
          <TabsTrigger value="produce" data-testid="produce-tab">
            <Plus className="w-4 h-4 mr-2" />
            Produce RM
          </TabsTrigger>
          <TabsTrigger value="log" data-testid="log-tab">
            <FileText className="w-4 h-4 mr-2" />
            Production Log
          </TabsTrigger>
          <TabsTrigger value="reports" data-testid="reports-tab">
            <Factory className="w-4 h-4 mr-2" />
            Reports
          </TabsTrigger>
        </TabsList>

        {/* Produce RM Tab */}
        <TabsContent value="produce" className="space-y-6">
          {!selectedBranch ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <Factory className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Please select a branch to start production</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: RM Selection */}
              <div className="lg:col-span-2 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Select RM to Produce</CardTitle>
                    <CardDescription>
                      Choose a category and select an RM with an active BOM
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <Label>Category</Label>
                        <Select value={selectedCategory || "all"} onValueChange={(v) => {
                          setSelectedCategory(v === "all" ? "" : v);
                          setSelectedRM(null);
                        }}>
                          <SelectTrigger data-testid="category-select">
                            <SelectValue placeholder="All Categories" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Categories</SelectItem>
                            {categories.map(c => (
                              <SelectItem key={c.code} value={c.code}>{c.code} - {c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end">
                        <Button variant="outline" onClick={fetchManufacturableRMs} disabled={loading}>
                          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                          Refresh
                        </Button>
                      </div>
                    </div>
                    
                    {/* RM List */}
                    <div className="border rounded-lg max-h-[400px] overflow-auto">
                      {loading ? (
                        <div className="p-8 text-center text-gray-500">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                          Loading manufacturable RMs...
                        </div>
                      ) : manufacturableRMs.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                          <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p>No manufacturable RMs found</p>
                          <p className="text-xs mt-1">Ensure BOMs are defined for manufactured RMs</p>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[50px]"></TableHead>
                              <TableHead>RM ID</TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead>Category</TableHead>
                              <TableHead>Level</TableHead>
                              <TableHead>Current Stock</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {manufacturableRMs.map(rm => (
                              <TableRow 
                                key={rm.rm_id}
                                className={`cursor-pointer ${selectedRM?.rm_id === rm.rm_id ? 'bg-orange-50' : 'hover:bg-gray-50'}`}
                                onClick={() => setSelectedRM(rm)}
                                data-testid={`rm-row-${rm.rm_id}`}
                              >
                                <TableCell>
                                  <input 
                                    type="radio" 
                                    checked={selectedRM?.rm_id === rm.rm_id}
                                    onChange={() => setSelectedRM(rm)}
                                    className="w-4 h-4 text-orange-500"
                                  />
                                </TableCell>
                                <TableCell className="font-mono text-sm">{rm.rm_id}</TableCell>
                                <TableCell className="max-w-[200px] truncate">{rm.rm_name}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{rm.category}</Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge className="bg-blue-100 text-blue-700">L{rm.bom_level}</Badge>
                                </TableCell>
                                <TableCell>
                                  <span className={rm.current_stock > 0 ? 'text-green-600' : 'text-gray-400'}>
                                    {rm.current_stock} {rm.uom}
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              {/* Right: Production Input */}
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Production Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedRM ? (
                      <>
                        <div className="p-3 bg-orange-50 rounded-lg">
                          <p className="font-medium text-orange-800">{selectedRM.rm_id}</p>
                          <p className="text-sm text-orange-600">{selectedRM.rm_name}</p>
                          <div className="flex gap-2 mt-2">
                            <Badge variant="outline">{selectedRM.category}</Badge>
                            <Badge className="bg-blue-100 text-blue-700">L{selectedRM.bom_level}</Badge>
                          </div>
                        </div>
                        
                        <div>
                          <Label>Quantity to Produce *</Label>
                          <Input
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            placeholder={`Enter quantity in ${selectedRM.uom}`}
                            min="0.01"
                            step="0.01"
                            data-testid="quantity-input"
                          />
                        </div>
                        
                        <div>
                          <Label>Production Date</Label>
                          <Input
                            type="date"
                            value={productionDate}
                            onChange={(e) => setProductionDate(e.target.value)}
                            data-testid="production-date-input"
                          />
                        </div>
                        
                        <div>
                          <Label>Notes (Optional)</Label>
                          <Textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Add production notes..."
                            rows={3}
                            data-testid="notes-input"
                          />
                        </div>
                        
                        <Button 
                          className="w-full bg-orange-500 hover:bg-orange-600"
                          onClick={handlePreview}
                          disabled={previewing || !quantity || parseFloat(quantity) <= 0}
                          data-testid="preview-production-btn"
                        >
                          {previewing ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Eye className="w-4 h-4 mr-2" />
                          )}
                          Preview Production
                        </Button>
                      </>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>Select an RM to produce</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Production Log Tab */}
        <TabsContent value="log" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Production Log</CardTitle>
                  <CardDescription>History of all RM production entries</CardDescription>
                </div>
                <Button variant="outline" onClick={exportProductionLog}>
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-4">
                <div className="w-[150px]">
                  <Label className="text-xs">Category</Label>
                  <Select value={logFilters.category || "all"} onValueChange={(v) => {
                    setLogFilters(f => ({ ...f, category: v === "all" ? "" : v }));
                    setLogPage(1);
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map(c => (
                        <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-[150px]">
                  <Label className="text-xs">RM ID</Label>
                  <Input
                    value={logFilters.rm_id}
                    onChange={(e) => {
                      setLogFilters(f => ({ ...f, rm_id: e.target.value }));
                      setLogPage(1);
                    }}
                    placeholder="Search RM ID"
                  />
                </div>
                <div className="w-[150px]">
                  <Label className="text-xs">Start Date</Label>
                  <Input
                    type="date"
                    value={logFilters.start_date}
                    onChange={(e) => {
                      setLogFilters(f => ({ ...f, start_date: e.target.value }));
                      setLogPage(1);
                    }}
                  />
                </div>
                <div className="w-[150px]">
                  <Label className="text-xs">End Date</Label>
                  <Input
                    type="date"
                    value={logFilters.end_date}
                    onChange={(e) => {
                      setLogFilters(f => ({ ...f, end_date: e.target.value }));
                      setLogPage(1);
                    }}
                  />
                </div>
                <div className="flex items-end">
                  <Button variant="outline" onClick={() => {
                    setLogFilters({ category: "", rm_id: "", start_date: "", end_date: "" });
                    setLogPage(1);
                  }}>
                    Clear
                  </Button>
                </div>
              </div>
              
              {/* Log Table */}
              <div className="border rounded-lg">
                {loading ? (
                  <div className="p-8 text-center text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  </div>
                ) : productionLog.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No production logs found</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]"></TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>RM ID</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Qty Produced</TableHead>
                        <TableHead>Stock Before</TableHead>
                        <TableHead>Stock After</TableHead>
                        <TableHead>By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productionLog.map(log => (
                        <>
                          <TableRow key={log.id} className="cursor-pointer hover:bg-gray-50" onClick={() => toggleRowExpand(log.id)}>
                            <TableCell>
                              {expandedRows.has(log.id) ? (
                                <ChevronUp className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{log.production_code}</TableCell>
                            <TableCell>{log.production_date}</TableCell>
                            <TableCell className="font-mono">{log.rm_id}</TableCell>
                            <TableCell><Badge variant="outline">{log.category}</Badge></TableCell>
                            <TableCell className="font-medium text-green-600">
                              +{log.quantity_produced} {log.uom}
                            </TableCell>
                            <TableCell>{log.stock_before}</TableCell>
                            <TableCell className="font-medium">{log.stock_after}</TableCell>
                            <TableCell className="text-sm text-gray-500">{log.produced_by_name}</TableCell>
                          </TableRow>
                          {expandedRows.has(log.id) && (
                            <TableRow key={`${log.id}-expanded`}>
                              <TableCell colSpan={9} className="bg-gray-50 p-4">
                                <div className="space-y-2">
                                  <p className="text-sm font-medium">Components Consumed:</p>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {log.components_consumed?.map((comp, idx) => (
                                      <div key={idx} className="p-2 bg-white border rounded text-sm">
                                        <p className="font-mono text-xs text-gray-500">{comp.rm_id}</p>
                                        <p className="font-medium text-red-600">
                                          -{comp.quantity_consumed} {comp.uom}
                                        </p>
                                        <p className="text-xs text-gray-400">
                                          {comp.stock_before} → {comp.stock_after}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                  {log.notes && (
                                    <p className="text-sm text-gray-500 mt-2">
                                      <span className="font-medium">Notes:</span> {log.notes}
                                    </p>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
              
              {/* Pagination */}
              {logTotalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    Showing page {logPage} of {logTotalPages} ({logTotal} total entries)
                  </p>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      disabled={logPage <= 1}
                      onClick={() => setLogPage(p => p - 1)}
                    >
                      Previous
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      disabled={logPage >= logTotalPages}
                      onClick={() => setLogPage(p => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-6">
          {/* Period Selection */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium">Report Period:</span>
                </div>
                <Input
                  type="date"
                  value={summaryPeriod.start}
                  onChange={(e) => setSummaryPeriod(p => ({ ...p, start: e.target.value }))}
                  className="w-[160px]"
                />
                <span className="text-gray-400">to</span>
                <Input
                  type="date"
                  value={summaryPeriod.end}
                  onChange={(e) => setSummaryPeriod(p => ({ ...p, end: e.target.value }))}
                  className="w-[160px]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Total Produced</p>
                      <p className="text-2xl font-bold text-orange-600">{summary.totals?.total_produced || 0}</p>
                    </div>
                    <Factory className="w-8 h-8 text-orange-200" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Production Entries</p>
                      <p className="text-2xl font-bold">{summary.totals?.total_entries || 0}</p>
                    </div>
                    <FileText className="w-8 h-8 text-gray-200" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Categories Active</p>
                      <p className="text-2xl font-bold text-blue-600">{summary.categories?.length || 0}</p>
                    </div>
                    <Package className="w-8 h-8 text-blue-200" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Category Summary */}
          {summary?.categories?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Production by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Total Produced</TableHead>
                      <TableHead>Entries</TableHead>
                      <TableHead>Unique Items</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.categories.map(cat => (
                      <TableRow key={cat.category}>
                        <TableCell>
                          <Badge variant="outline">{cat.category}</Badge>
                        </TableCell>
                        <TableCell className="font-medium text-green-600">
                          {cat.total_produced}
                        </TableCell>
                        <TableCell>{cat.production_count}</TableCell>
                        <TableCell>{cat.unique_items}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Consumption Report */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Component Consumption Report</CardTitle>
                  <CardDescription>L1 materials consumed during production</CardDescription>
                </div>
                <Button variant="outline" onClick={exportConsumptionReport}>
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {consumptionReport?.consumption?.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>RM ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Total Consumed</TableHead>
                      <TableHead>UOM</TableHead>
                      <TableHead>Used In</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consumptionReport.consumption.map(item => (
                      <TableRow key={item.rm_id}>
                        <TableCell className="font-mono">{item.rm_id}</TableCell>
                        <TableCell>{item.name}</TableCell>
                        <TableCell className="font-medium text-red-600">
                          -{item.total_consumed}
                        </TableCell>
                        <TableCell>{item.uom}</TableCell>
                        <TableCell>{item.used_in_count} productions</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No consumption data for this period</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Production Preview
            </DialogTitle>
            <DialogDescription>
              Review component requirements and stock availability before confirming
            </DialogDescription>
          </DialogHeader>
          
          {previewData && (
            <div className="space-y-4">
              {/* Output Info */}
              <div className="p-4 bg-orange-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-sm text-gray-500">{previewData.rm_id}</p>
                    <p className="font-medium text-lg">{previewData.rm_name}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline">{previewData.category}</Badge>
                      <Badge className="bg-blue-100 text-blue-700">L{previewData.bom_level}</Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Producing</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {previewData.quantity_to_produce} {previewData.output_uom}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Status Banner */}
              {previewData.can_produce ? (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-green-700 font-medium">All components available - Ready to produce</span>
                </div>
              ) : (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <span className="text-red-700 font-medium">
                    Insufficient stock for: {previewData.blocking_components?.join(", ")}
                  </span>
                </div>
              )}
              
              {/* Components Table */}
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Component</TableHead>
                      <TableHead>Required</TableHead>
                      <TableHead>Available</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.components?.map(comp => (
                      <TableRow key={comp.rm_id}>
                        <TableCell>
                          <p className="font-mono text-xs text-gray-500">{comp.rm_id}</p>
                          <p className="text-sm">{comp.name}</p>
                        </TableCell>
                        <TableCell className="font-medium">
                          {comp.required_qty} {comp.uom}
                        </TableCell>
                        <TableCell>
                          {comp.available_stock} {comp.uom}
                        </TableCell>
                        <TableCell>
                          {comp.is_sufficient ? (
                            <Badge className="bg-green-100 text-green-700">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              OK
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Short {comp.shortage}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {/* Production Date & Notes */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Production Date</Label>
                  <Input type="date" value={productionDate} onChange={(e) => setProductionDate(e.target.value)} />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
              Cancel
            </Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600"
              onClick={handleConfirmProduction}
              disabled={confirming || !previewData?.can_produce}
              data-testid="confirm-production-btn"
            >
              {confirming ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Confirm Production
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RMProduction;

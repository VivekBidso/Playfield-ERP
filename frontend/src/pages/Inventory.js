import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  Package, 
  Box, 
  Upload, 
  Download, 
  Search, 
  Filter,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function Inventory() {
  const [activeTab, setActiveTab] = useState('rm');
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ branches: [], categories: [], models: [] });
  const [summary, setSummary] = useState({ rm: {}, fg: {} });
  
  // RM State
  const [rmInventory, setRmInventory] = useState([]);
  const [rmTotal, setRmTotal] = useState(0);
  const [rmFilters, setRmFilters] = useState({ branch_id: '', category: '', search: '' });
  
  // FG State
  const [fgInventory, setFgInventory] = useState([]);
  const [fgTotal, setFgTotal] = useState(0);
  const [fgFilters, setFgFilters] = useState({ branch_id: '', model_id: '', search: '' });
  
  // Import Dialog
  const [importDialog, setImportDialog] = useState(false);
  const [importType, setImportType] = useState('rm');
  const [importMode, setImportMode] = useState('add');
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const getHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Fetch filters
  const fetchFilters = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/api/inventory/filters`, { headers: getHeaders() });
      setFilters(response.data);
    } catch (error) {
      console.error('Error fetching filters:', error);
    }
  }, []);

  // Fetch summary
  const fetchSummary = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/api/inventory/summary`, { headers: getHeaders() });
      setSummary(response.data);
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  }, []);

  // Fetch RM Inventory
  const fetchRmInventory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (rmFilters.branch_id) params.append('branch_id', rmFilters.branch_id);
      if (rmFilters.category) params.append('category', rmFilters.category);
      if (rmFilters.search) params.append('search', rmFilters.search);
      params.append('limit', '200');
      
      const response = await axios.get(`${API}/api/inventory/rm?${params}`, { headers: getHeaders() });
      setRmInventory(response.data.items || []);
      setRmTotal(response.data.total || 0);
    } catch (error) {
      toast.error('Failed to fetch RM inventory');
    }
    setLoading(false);
  }, [rmFilters]);

  // Fetch FG Inventory
  const fetchFgInventory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fgFilters.branch_id) params.append('branch_id', fgFilters.branch_id);
      if (fgFilters.model_id) params.append('model_id', fgFilters.model_id);
      if (fgFilters.search) params.append('search', fgFilters.search);
      params.append('limit', '200');
      
      const response = await axios.get(`${API}/api/inventory/fg?${params}`, { headers: getHeaders() });
      setFgInventory(response.data.items || []);
      setFgTotal(response.data.total || 0);
    } catch (error) {
      toast.error('Failed to fetch FG inventory');
    }
    setLoading(false);
  }, [fgFilters]);

  useEffect(() => {
    fetchFilters();
    fetchSummary();
  }, [fetchFilters, fetchSummary]);

  useEffect(() => {
    if (activeTab === 'rm') {
      fetchRmInventory();
    } else {
      fetchFgInventory();
    }
  }, [activeTab, fetchRmInventory, fetchFgInventory]);

  // Download template
  const downloadTemplate = async (type) => {
    try {
      const response = await axios.get(`${API}/api/inventory/${type}/template`, {
        headers: getHeaders(),
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}_inventory_template.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Template downloaded');
    } catch (error) {
      toast.error('Failed to download template');
    }
  };

  // Handle import
  const handleImport = async () => {
    if (!importFile) {
      toast.error('Please select a file');
      return;
    }

    setImporting(true);
    setImportResult(null);
    
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      
      const response = await axios.post(
        `${API}/api/inventory/${importType}/bulk-import?mode=${importMode}`,
        formData,
        { headers: { ...getHeaders(), 'Content-Type': 'multipart/form-data' } }
      );
      
      setImportResult(response.data);
      
      if (response.data.success) {
        toast.success(`Import complete: ${response.data.processed} records processed`);
        // Refresh data
        if (importType === 'rm') {
          fetchRmInventory();
        } else {
          fetchFgInventory();
        }
        fetchSummary();
      } else {
        toast.error('Import completed with errors');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Import failed');
      setImportResult({ errors: [error.response?.data?.detail || 'Import failed'], success: false });
    }
    
    setImporting(false);
  };

  // Open import dialog
  const openImportDialog = (type) => {
    setImportType(type);
    setImportMode('add');
    setImportFile(null);
    setImportResult(null);
    setImportDialog(true);
  };

  return (
    <div className="p-6 space-y-6" data-testid="inventory-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-sm text-gray-500 mt-1">View and import RM & Finished Goods inventory</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Package className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">RM Items</p>
                <p className="text-xl font-bold">{summary.rm?.unique_items || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Package className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">RM Records</p>
                <p className="text-xl font-bold">{summary.rm?.total_records || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Box className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">FG SKUs</p>
                <p className="text-xl font-bold">{summary.fg?.unique_items || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Box className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">FG Records</p>
                <p className="text-xl font-bold">{summary.fg?.total_records || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <TabsList>
                <TabsTrigger value="rm" className="gap-2">
                  <Package className="h-4 w-4" />
                  Raw Materials
                </TabsTrigger>
                <TabsTrigger value="fg" className="gap-2">
                  <Box className="h-4 w-4" />
                  Finished Goods
                </TabsTrigger>
              </TabsList>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadTemplate(activeTab)}
                  data-testid="download-template-btn"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Template
                </Button>
                <Button
                  size="sm"
                  onClick={() => openImportDialog(activeTab)}
                  data-testid="import-inventory-btn"
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Import
                </Button>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            {/* RM Tab */}
            <TabsContent value="rm" className="mt-0">
              {/* Filters */}
              <div className="flex gap-3 mb-4 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search RM ID or Name..."
                    value={rmFilters.search}
                    onChange={(e) => setRmFilters(f => ({ ...f, search: e.target.value }))}
                    className="pl-9"
                    data-testid="rm-search-input"
                  />
                </div>
                <Select
                  value={rmFilters.branch_id || "all"}
                  onValueChange={(v) => setRmFilters(f => ({ ...f, branch_id: v === "all" ? "" : v }))}
                >
                  <SelectTrigger className="w-[180px]" data-testid="rm-branch-filter">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="All Branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {filters.branches.map(b => (
                      <SelectItem key={b.branch_id} value={b.branch_id}>
                        {b.name} ({b.branch_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={rmFilters.category || "all"}
                  onValueChange={(v) => setRmFilters(f => ({ ...f, category: v === "all" ? "" : v }))}
                >
                  <SelectTrigger className="w-[180px]" data-testid="rm-category-filter">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {filters.categories.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={fetchRmInventory}
                  data-testid="rm-refresh-btn"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              {/* Table */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">RM ID</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Category</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Branch</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">Quantity</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                          Loading...
                        </td>
                      </tr>
                    ) : rmInventory.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                          No inventory records found. Import data to get started.
                        </td>
                      </tr>
                    ) : (
                      rmInventory.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-xs">{item.rm_id}</td>
                          <td className="px-4 py-3">{item.rm_name || '-'}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline">{item.category || '-'}</Badge>
                          </td>
                          <td className="px-4 py-3">{item.branch_id}</td>
                          <td className="px-4 py-3 text-right font-medium">{item.quantity?.toLocaleString()}</td>
                          <td className="px-4 py-3">{item.unit}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 text-sm text-gray-500">
                Showing {rmInventory.length} of {rmTotal} records
              </div>
            </TabsContent>

            {/* FG Tab */}
            <TabsContent value="fg" className="mt-0">
              {/* Filters */}
              <div className="flex gap-3 mb-4 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search SKU ID or Name..."
                    value={fgFilters.search}
                    onChange={(e) => setFgFilters(f => ({ ...f, search: e.target.value }))}
                    className="pl-9"
                    data-testid="fg-search-input"
                  />
                </div>
                <Select
                  value={fgFilters.branch_id || "all"}
                  onValueChange={(v) => setFgFilters(f => ({ ...f, branch_id: v === "all" ? "" : v }))}
                >
                  <SelectTrigger className="w-[180px]" data-testid="fg-branch-filter">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="All Branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {filters.branches.map(b => (
                      <SelectItem key={b.branch_id} value={b.branch_id}>
                        {b.name} ({b.branch_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={fgFilters.model_id || "all"}
                  onValueChange={(v) => setFgFilters(f => ({ ...f, model_id: v === "all" ? "" : v }))}
                >
                  <SelectTrigger className="w-[180px]" data-testid="fg-model-filter">
                    <SelectValue placeholder="All Models" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Models</SelectItem>
                    {filters.models.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={fetchFgInventory}
                  data-testid="fg-refresh-btn"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              {/* Table */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Buyer SKU ID</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Branch</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {loading ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                          Loading...
                        </td>
                      </tr>
                    ) : fgInventory.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                          No inventory records found. Import data to get started.
                        </td>
                      </tr>
                    ) : (
                      fgInventory.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-xs">{item.buyer_sku_id}</td>
                          <td className="px-4 py-3">{item.sku_name || '-'}</td>
                          <td className="px-4 py-3">{item.branch_id}</td>
                          <td className="px-4 py-3 text-right font-medium">{item.quantity?.toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 text-sm text-gray-500">
                Showing {fgInventory.length} of {fgTotal} records
              </div>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {/* Import Dialog */}
      <Dialog open={importDialog} onOpenChange={setImportDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              Import {importType === 'rm' ? 'Raw Material' : 'Finished Goods'} Inventory
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Mode Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Import Mode</label>
              <Select value={importMode} onValueChange={setImportMode}>
                <SelectTrigger data-testid="import-mode-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">
                    <div className="flex flex-col">
                      <span className="font-medium">Add to Existing</span>
                      <span className="text-xs text-gray-500">Quantities will be added to current stock</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="replace">
                    <div className="flex flex-col">
                      <span className="font-medium">Replace Stock</span>
                      <span className="text-xs text-gray-500">Uploaded quantities will replace current stock</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Excel File</label>
              <div className="border-2 border-dashed rounded-lg p-4 text-center">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => {
                    setImportFile(e.target.files?.[0] || null);
                    setImportResult(null);
                  }}
                  className="hidden"
                  id="import-file"
                  data-testid="import-file-input"
                />
                <label htmlFor="import-file" className="cursor-pointer">
                  {importFile ? (
                    <div className="flex items-center justify-center gap-2 text-green-600">
                      <CheckCircle className="h-5 w-5" />
                      <span>{importFile.name}</span>
                    </div>
                  ) : (
                    <div className="text-gray-500">
                      <Upload className="h-8 w-8 mx-auto mb-2" />
                      <p>Click to select file</p>
                      <p className="text-xs">.xlsx or .xls</p>
                    </div>
                  )}
                </label>
              </div>
              <Button
                variant="link"
                size="sm"
                onClick={() => downloadTemplate(importType)}
                className="text-xs"
              >
                Download template with reference data
              </Button>
            </div>

            {/* Import Result */}
            {importResult && (
              <div className={`p-4 rounded-lg ${importResult.success ? 'bg-green-50' : 'bg-red-50'}`}>
                <div className="flex items-start gap-2">
                  {importResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className={`font-medium ${importResult.success ? 'text-green-800' : 'text-red-800'}`}>
                      {importResult.success ? 'Import Successful' : 'Import Failed'}
                    </p>
                    {importResult.processed > 0 && (
                      <p className="text-sm text-gray-600 mt-1">
                        Processed: {importResult.processed} | Added: {importResult.added} | Updated: {importResult.updated}
                      </p>
                    )}
                    {importResult.errors?.length > 0 && (
                      <div className="mt-2 max-h-32 overflow-y-auto">
                        <p className="text-sm font-medium text-red-700">Errors:</p>
                        {importResult.errors.slice(0, 10).map((err, idx) => (
                          <p key={idx} className="text-xs text-red-600">{err}</p>
                        ))}
                        {importResult.errors.length > 10 && (
                          <p className="text-xs text-red-600">...and {importResult.errors.length - 10} more</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!importFile || importing}
              data-testid="confirm-import-btn"
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

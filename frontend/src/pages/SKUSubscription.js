import { useState, useEffect, useRef } from "react";
import axios from "axios";
import useBranchStore from "@/store/branchStore";
import useAuthStore from "@/store/authStore";
import { Upload, Download, Package, Trash2, Search, Filter, Layers, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SKUSubscription = () => {
  const { selectedBranch } = useBranchStore();
  const { token } = useAuthStore();
  const [assignments, setAssignments] = useState([]);
  const [filteredAssignments, setFilteredAssignments] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [bulkResult, setBulkResult] = useState(null);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const fileInputRef = useRef(null);

  // Bulk subscription states
  const [verticals, setVerticals] = useState([]);
  const [models, setModels] = useState([]);
  const [selectedVertical, setSelectedVertical] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [previewCount, setPreviewCount] = useState(0);

  useEffect(() => {
    fetchAssignments();
    fetchFilterOptions();
  }, [selectedBranch]);

  useEffect(() => {
    if (searchQuery) {
      const filtered = assignments.filter(a => 
        a.sku_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.buyer_sku_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredAssignments(filtered);
    } else {
      setFilteredAssignments(assignments);
    }
  }, [searchQuery, assignments]);

  // Fetch models when vertical changes
  useEffect(() => {
    if (selectedVertical) {
      fetchModelsByVertical(selectedVertical);
      fetchPreviewCount();
    } else {
      setModels([]);
      setSelectedModel("");
      setPreviewCount(0);
    }
  }, [selectedVertical]);

  // Update preview count when model changes
  useEffect(() => {
    if (selectedVertical) {
      fetchPreviewCount();
    }
  }, [selectedModel]);

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${API}/sku-branch-assignments?branch=${encodeURIComponent(selectedBranch)}`,
        { headers: { Authorization: `Bearer ${token}` }}
      );
      setAssignments(response.data);
      setFilteredAssignments(response.data);
    } catch (error) {
      toast.error("Failed to fetch SKU assignments");
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const response = await axios.get(`${API}/skus/filter-options`);
      setVerticals(response.data.verticals);
    } catch (error) {
      console.error("Failed to fetch filter options", error);
    }
  };

  const fetchModelsByVertical = async (vertical) => {
    try {
      const response = await axios.get(`${API}/skus/models-by-vertical?vertical=${encodeURIComponent(vertical)}`);
      setModels(response.data.models);
      setSelectedModel("");
    } catch (error) {
      console.error("Failed to fetch models", error);
    }
  };

  const fetchPreviewCount = async () => {
    if (!selectedVertical) {
      setPreviewCount(0);
      return;
    }
    try {
      let url = `${API}/skus/filtered?vertical=${encodeURIComponent(selectedVertical)}`;
      if (selectedModel) {
        url += `&model=${encodeURIComponent(selectedModel)}`;
      }
      const response = await axios.get(url);
      setPreviewCount(response.data.length);
    } catch (error) {
      console.error("Failed to get preview count", error);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setLoading(true);
    try {
      const response = await axios.post(
        `${API}/sku-branch-assignments/upload?branch=${encodeURIComponent(selectedBranch)}`,
        formData,
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      setUploadResult(response.data);
      setBulkResult(null);
      
      if (response.data.assigned > 0) {
        toast.success(`Assigned ${response.data.assigned} SKUs to ${selectedBranch}`);
      }
      if (response.data.not_found.length > 0) {
        toast.warning(`${response.data.total_not_found} SKU IDs not found in system`);
      }
      
      fetchAssignments();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Upload failed");
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleBulkSubscribe = async () => {
    if (!selectedVertical) {
      toast.error("Please select a vertical");
      return;
    }

    setLoading(true);
    try {
      let url = `${API}/sku-branch-assignments/bulk-subscribe?branch=${encodeURIComponent(selectedBranch)}&vertical=${encodeURIComponent(selectedVertical)}`;
      if (selectedModel) {
        url += `&model=${encodeURIComponent(selectedModel)}`;
      }
      
      const response = await axios.post(url, null, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setBulkResult(response.data);
      setUploadResult(null);
      
      if (response.data.assigned > 0) {
        toast.success(`Subscribed ${response.data.assigned} SKUs to ${selectedBranch}. ${response.data.rms_activated || 0} RMs activated.`);
      } else if (response.data.skipped > 0) {
        toast.info(`All ${response.data.skipped} matching SKUs already assigned`);
      }
      
      setShowBulkDialog(false);
      setSelectedVertical("");
      setSelectedModel("");
      fetchAssignments();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Bulk subscription failed");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUnsubscribe = async () => {
    if (!selectedVertical) {
      toast.error("Please select a vertical");
      return;
    }

    if (!window.confirm(`Remove all ${selectedModel || selectedVertical} SKUs from ${selectedBranch}?`)) {
      return;
    }

    setLoading(true);
    try {
      let url = `${API}/sku-branch-assignments/bulk-unsubscribe?branch=${encodeURIComponent(selectedBranch)}&vertical=${encodeURIComponent(selectedVertical)}`;
      if (selectedModel) {
        url += `&model=${encodeURIComponent(selectedModel)}`;
      }
      
      const response = await axios.delete(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(`Removed ${response.data.removed} SKU assignments`);
      
      setShowBulkDialog(false);
      setSelectedVertical("");
      setSelectedModel("");
      fetchAssignments();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Bulk unsubscribe failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAssignment = async (skuId) => {
    if (!window.confirm(`Remove ${skuId} from ${selectedBranch}?`)) return;
    
    try {
      await axios.delete(
        `${API}/sku-branch-assignments/${skuId}/${encodeURIComponent(selectedBranch)}`,
        { headers: { Authorization: `Bearer ${token}` }}
      );
      toast.success("Assignment removed");
      fetchAssignments();
    } catch (error) {
      toast.error("Failed to remove assignment");
    }
  };

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(filteredAssignments.map(a => ({
      'Buyer SKU ID': a.buyer_sku_id,
      'SKU ID': a.sku_id,
      'Bidso SKU': a.bidso_sku,
      'Description': a.description,
      'Brand': a.brand,
      'Model': a.model,
      'Branch': selectedBranch,
      'Assigned At': new Date(a.assigned_at).toLocaleDateString()
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SKU Assignments');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `sku_assignments_${selectedBranch}.xlsx`);
    toast.success("Exported to Excel");
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Buyer_SKU_ID'],
      ['Example_SKU_001'],
      ['Example_SKU_002']
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SKU Assignment');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'sku_assignment_template.xlsx');
    toast.success("Template downloaded");
  };

  // Count SKUs by vertical for display
  const getVerticalStats = () => {
    const stats = {};
    assignments.forEach(a => {
      const v = a.vertical || 'Other';
      stats[v] = (stats[v] || 0) + 1;
    });
    return stats;
  };

  const verticalStats = getVerticalStats();

  return (
    <div className="p-6 md:p-8" data-testid="sku-subscription-page">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight uppercase">SKU Subscription</h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">
            Assign SKUs to {selectedBranch}
          </p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="secondary" 
            onClick={downloadTemplate}
            className="uppercase text-xs tracking-wide"
          >
            <Download className="w-4 h-4 mr-2" strokeWidth={1.5} />
            Template
          </Button>
          <Button 
            variant="secondary" 
            onClick={handleExport}
            className="uppercase text-xs tracking-wide"
          >
            <Download className="w-4 h-4 mr-2" strokeWidth={1.5} />
            Export
          </Button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleUpload} 
            accept=".xlsx,.xls"
            className="hidden"
          />
          <Button 
            onClick={() => fileInputRef.current.click()}
            disabled={loading}
            variant="secondary"
            className="uppercase text-xs tracking-wide"
            data-testid="upload-sku-btn"
          >
            <Upload className="w-4 h-4 mr-2" strokeWidth={1.5} />
            Upload SKUs
          </Button>
          
          {/* Bulk Subscribe Dialog */}
          <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
            <DialogTrigger asChild>
              <Button 
                className="uppercase text-xs tracking-wide"
                data-testid="bulk-subscribe-btn"
              >
                <Layers className="w-4 h-4 mr-2" strokeWidth={1.5} />
                Bulk Subscribe
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-bold uppercase">Bulk SKU Subscription</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                <p className="text-sm text-zinc-600">
                  Subscribe all SKUs from a specific Vertical or Model to <span className="font-bold">{selectedBranch}</span>
                </p>
                
                <div className="bg-zinc-50 p-4 rounded-sm border border-zinc-200">
                  <div className="flex items-center gap-2 mb-4">
                    <Filter className="w-4 h-4 text-zinc-500" strokeWidth={1.5} />
                    <span className="text-xs uppercase tracking-widest font-bold text-zinc-600">
                      Select Criteria
                    </span>
                  </div>
                  
                  <div className="space-y-4">
                    {/* Vertical Selection */}
                    <div>
                      <Label className="text-xs text-zinc-500">Vertical *</Label>
                      <select 
                        className="flex h-10 w-full rounded-sm border border-input bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                        value={selectedVertical}
                        onChange={(e) => setSelectedVertical(e.target.value)}
                        data-testid="bulk-vertical-select"
                      >
                        <option value="">Select Vertical</option>
                        {verticals.map(v => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Model Selection (Optional) */}
                    <div>
                      <Label className="text-xs text-zinc-500">Model (Optional - for more specific selection)</Label>
                      <select 
                        className="flex h-10 w-full rounded-sm border border-input bg-white px-3 py-2 text-sm font-mono disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-primary"
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        disabled={!selectedVertical}
                        data-testid="bulk-model-select"
                      >
                        <option value="">All Models in {selectedVertical || 'Vertical'}</option>
                        {models.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  {/* Preview */}
                  {selectedVertical && (
                    <div className="mt-4 p-3 bg-white border border-zinc-200 rounded-sm">
                      <div className="text-xs text-zinc-500 mb-1">Preview</div>
                      <div className="font-mono text-lg font-bold text-primary">
                        {previewCount} SKUs
                      </div>
                      <div className="text-xs text-zinc-500">
                        will be subscribed to {selectedBranch}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-3">
                  <Button 
                    onClick={handleBulkSubscribe}
                    disabled={!selectedVertical || loading}
                    className="flex-1 uppercase text-xs tracking-wide"
                    data-testid="confirm-bulk-subscribe-btn"
                  >
                    {loading ? "Processing..." : "Subscribe All"}
                  </Button>
                  <Button 
                    variant="destructive"
                    onClick={handleBulkUnsubscribe}
                    disabled={!selectedVertical || loading}
                    className="uppercase text-xs tracking-wide"
                    data-testid="bulk-unsubscribe-btn"
                  >
                    <Trash2 className="w-4 h-4 mr-1" strokeWidth={1.5} />
                    Unsubscribe
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Upload/Bulk Result */}
      {(uploadResult || bulkResult) && (
        <div className="mb-6 p-4 bg-zinc-50 border border-zinc-200 rounded-sm">
          <h3 className="font-bold text-sm mb-2">Last Operation Result</h3>
          <div className="grid grid-cols-4 gap-4 text-sm font-mono">
            <div>
              <span className="text-green-600 font-bold">
                {uploadResult?.assigned || bulkResult?.assigned || 0}
              </span> SKUs assigned
            </div>
            <div>
              <span className="text-yellow-600 font-bold">
                {uploadResult?.skipped || bulkResult?.skipped || 0}
              </span> skipped
            </div>
            <div>
              <span className="text-blue-600 font-bold">
                {uploadResult?.rms_activated || bulkResult?.rms_activated || 0}
              </span> RMs activated
            </div>
            {uploadResult && (
              <div>
                <span className="text-red-600 font-bold">{uploadResult.total_not_found}</span> not found
              </div>
            )}
            {bulkResult && (
              <div>
                <span className="text-zinc-600 font-bold">{bulkResult.total_matching}</span> total matching
              </div>
            )}
          </div>
          {uploadResult?.not_found?.length > 0 && (
            <div className="mt-2 text-xs text-zinc-500">
              Not found: {uploadResult.not_found.slice(0, 5).join(', ')}
              {uploadResult.not_found.length > 5 && ` and ${uploadResult.total_not_found - 5} more...`}
            </div>
          )}
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-border border border-border mb-8">
        <div className="bg-white p-6">
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">
            Total SKUs Assigned
          </div>
          <div className="text-3xl font-black font-mono text-primary">
            {assignments.length}
          </div>
        </div>
        <div className="bg-white p-6">
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">
            Unique Verticals
          </div>
          <div className="text-3xl font-black font-mono text-zinc-700">
            {Object.keys(verticalStats).length}
          </div>
        </div>
        <div className="bg-white p-6">
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">
            Unique Brands
          </div>
          <div className="text-3xl font-black font-mono text-zinc-700">
            {new Set(assignments.map(a => a.brand)).size}
          </div>
        </div>
        <div className="bg-white p-6">
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">
            Current Branch
          </div>
          <div className="text-xl font-black font-mono text-zinc-700">
            {selectedBranch}
          </div>
        </div>
      </div>

      {/* Vertical Distribution (if we have assignments) */}
      {Object.keys(verticalStats).length > 0 && (
        <div className="mb-6 bg-white border border-border p-4 rounded-sm">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-4 h-4 text-zinc-500" strokeWidth={1.5} />
            <span className="text-xs uppercase tracking-widest font-bold text-zinc-600">
              Subscribed by Vertical
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(verticalStats).map(([vertical, count]) => (
              <span key={vertical} className="text-xs font-mono px-3 py-1 bg-zinc-100 text-zinc-700 rounded">
                {vertical}: <span className="font-bold text-primary">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
          <Input 
            placeholder="Search by SKU ID, Buyer SKU, Description..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 font-mono"
          />
        </div>
      </div>

      {/* Table */}
      <div className="border border-border bg-white rounded-sm overflow-hidden">
        <div className="p-6 border-b border-border flex items-center gap-3">
          <Package className="w-5 h-5 text-primary" strokeWidth={1.5} />
          <h2 className="text-lg font-bold uppercase tracking-tight">Assigned SKUs</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="sku-assignments-table">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Buyer SKU ID</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">SKU ID</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Description</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Vertical</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Model</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Brand</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Assigned</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssignments.map((assignment) => (
                <tr key={assignment.id} className="border-b border-zinc-100 hover:bg-zinc-50/50">
                  <td className="p-4 align-middle font-mono text-sm font-bold text-primary">
                    {assignment.buyer_sku_id}
                  </td>
                  <td className="p-4 align-middle font-mono text-sm text-zinc-700">
                    {assignment.sku_id}
                  </td>
                  <td className="p-4 align-middle text-sm text-zinc-600 max-w-xs truncate">
                    {assignment.description || '-'}
                  </td>
                  <td className="p-4 align-middle">
                    <span className="text-xs font-mono px-2 py-1 bg-blue-50 text-blue-700 rounded">
                      {assignment.vertical || '-'}
                    </span>
                  </td>
                  <td className="p-4 align-middle font-mono text-xs text-zinc-600">
                    {assignment.model || '-'}
                  </td>
                  <td className="p-4 align-middle">
                    <span className="text-xs font-mono text-primary px-2 py-1 bg-zinc-50 border border-zinc-200 rounded">
                      {assignment.brand || '-'}
                    </span>
                  </td>
                  <td className="p-4 align-middle font-mono text-xs text-zinc-500">
                    {new Date(assignment.assigned_at).toLocaleDateString()}
                  </td>
                  <td className="p-4 align-middle">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleRemoveAssignment(assignment.sku_id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" strokeWidth={1.5} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && (
            <div className="p-12 text-center text-muted-foreground font-mono text-sm">
              Loading...
            </div>
          )}
          {!loading && filteredAssignments.length === 0 && (
            <div className="p-12 text-center text-muted-foreground font-mono text-sm">
              No SKUs assigned to {selectedBranch}. Upload a file or use Bulk Subscribe to assign SKUs.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SKUSubscription;

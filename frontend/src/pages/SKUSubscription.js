import { useState, useEffect, useRef } from "react";
import axios from "axios";
import useAuthStore from "@/store/authStore";
import { Upload, Download, Package, Trash2, Search, Layers, Building2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SKUSubscription = () => {
  const { token } = useAuthStore();
  const [allBranches, setAllBranches] = useState([]);
  const [branchAssignments, setBranchAssignments] = useState({});
  const [expandedBranches, setExpandedBranches] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const fileInputRef = useRef(null);

  // Bulk subscription states
  const [verticals, setVerticals] = useState([]);
  const [models, setModels] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedVertical, setSelectedVertical] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [previewCount, setPreviewCount] = useState(0);
  const [bulkResult, setBulkResult] = useState(null);

  // Upload dialog
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadBranch, setUploadBranch] = useState("");

  useEffect(() => {
    fetchAllData();
  }, []);

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

  const fetchAllData = async () => {
    setLoading(true);
    try {
      // Fetch all branches
      const branchRes = await axios.get(`${API}/branches`);
      const branches = branchRes.data.filter(b => b.is_active);
      setAllBranches(branches);

      // Fetch assignments for each branch
      const assignmentPromises = branches.map(branch =>
        axios.get(`${API}/sku-branch-assignments?branch=${encodeURIComponent(branch.name)}`)
          .then(res => ({ branch: branch.name, assignments: res.data }))
          .catch(() => ({ branch: branch.name, assignments: [] }))
      );

      const results = await Promise.all(assignmentPromises);
      const assignmentsByBranch = {};
      results.forEach(r => {
        assignmentsByBranch[r.branch] = r.assignments;
      });
      setBranchAssignments(assignmentsByBranch);

      // Auto-expand first branch with assignments
      const firstWithAssignments = results.find(r => r.assignments.length > 0);
      if (firstWithAssignments) {
        setExpandedBranches({ [firstWithAssignments.branch]: true });
      }

      // Fetch filter options
      const filterRes = await axios.get(`${API}/skus/filter-options`);
      setVerticals(filterRes.data.verticals || []);
    } catch (error) {
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const fetchModelsByVertical = async (vertical) => {
    try {
      const response = await axios.get(`${API}/skus/models-by-vertical?vertical=${encodeURIComponent(vertical)}`);
      setModels(response.data.models || []);
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
    if (!file || !uploadBranch) return;

    const formData = new FormData();
    formData.append('file', file);

    setLoading(true);
    try {
      const response = await axios.post(
        `${API}/sku-branch-assignments/upload?branch=${encodeURIComponent(uploadBranch)}`,
        formData,
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      if (response.data.assigned > 0) {
        toast.success(`Assigned ${response.data.assigned} SKUs to ${uploadBranch}. ${response.data.rms_activated || 0} RMs activated.`);
      }
      if (response.data.not_found?.length > 0) {
        toast.warning(`${response.data.total_not_found} SKU IDs not found in system`);
      }
      
      setShowUploadDialog(false);
      setUploadBranch("");
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Upload failed");
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleBulkSubscribe = async () => {
    if (!selectedBranch) {
      toast.error("Please select a branch");
      return;
    }
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
      
      if (response.data.assigned > 0) {
        toast.success(`Subscribed ${response.data.assigned} SKUs to ${selectedBranch}. ${response.data.rms_activated || 0} RMs activated.`);
      } else if (response.data.skipped > 0) {
        toast.info(`All ${response.data.skipped} matching SKUs already assigned`);
      }
      
      setShowBulkDialog(false);
      resetBulkForm();
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Bulk subscription failed");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUnsubscribe = async () => {
    if (!selectedBranch || !selectedVertical) return;

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
      
      toast.success(`Removed ${response.data.removed} SKU assignments from ${selectedBranch}`);
      
      setShowBulkDialog(false);
      resetBulkForm();
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Bulk unsubscription failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAssignment = async (skuId, branch) => {
    if (!window.confirm(`Remove ${skuId} from ${branch}?`)) return;
    
    try {
      await axios.delete(`${API}/sku-branch-assignments/${encodeURIComponent(skuId)}/${encodeURIComponent(branch)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Assignment removed");
      fetchAllData();
    } catch (error) {
      toast.error("Failed to remove assignment");
    }
  };

  const resetBulkForm = () => {
    setSelectedBranch("");
    setSelectedVertical("");
    setSelectedModel("");
    setPreviewCount(0);
    setBulkResult(null);
  };

  const toggleBranchExpand = (branch) => {
    setExpandedBranches(prev => ({
      ...prev,
      [branch]: !prev[branch]
    }));
  };

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const templateData = [
      ["SKU_ID"],
      ["FC_KS_BE_115"],
      ["GE_KS_SR_186"],
      ["CC_KS_BE_189"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    XLSX.utils.book_append_sheet(wb, ws, "SKUs");
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'sku_subscription_template.xlsx');
    toast.success("Template downloaded");
  };

  const exportAssignments = (branch) => {
    const data = branchAssignments[branch] || [];
    if (data.length === 0) {
      toast.error("No assignments to export");
      return;
    }
    
    const exportData = data.map(a => ({
      "Buyer SKU ID": a.buyer_sku_id,
      "SKU ID": a.sku_id,
      "Description": a.description,
      "Vertical": a.vertical,
      "Model": a.model,
      "Brand": a.brand,
      "Assigned Date": a.assigned_at?.split('T')[0] || ''
    }));
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, "Assignments");
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `sku_assignments_${branch.replace(/\s+/g, '_')}.xlsx`);
    toast.success("Exported successfully");
  };

  // Filter assignments by search
  const getFilteredAssignments = (assignments) => {
    if (!searchQuery) return assignments;
    return assignments.filter(a =>
      a.sku_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.buyer_sku_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  // Summary stats
  const totalAssignments = Object.values(branchAssignments).reduce((sum, arr) => sum + arr.length, 0);
  const branchesWithAssignments = Object.keys(branchAssignments).filter(k => branchAssignments[k].length > 0).length;

  if (loading && Object.keys(branchAssignments).length === 0) {
    return (
      <div className="p-8 flex items-center justify-center" data-testid="sku-subscription-loading">
        <Package className="w-6 h-6 animate-spin mr-2" />
        Loading SKU Subscriptions...
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8" data-testid="sku-subscription-page">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight uppercase">SKU Subscription</h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">Manage SKU assignments across all branches</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadTemplate} className="uppercase text-xs" data-testid="template-btn">
            <Download className="w-4 h-4 mr-2" />
            Template
          </Button>
          <Button variant="outline" onClick={() => setShowUploadDialog(true)} className="uppercase text-xs" data-testid="upload-skus-btn">
            <Upload className="w-4 h-4 mr-2" />
            Upload SKUs
          </Button>
          <Button onClick={() => setShowBulkDialog(true)} className="uppercase text-xs" data-testid="bulk-subscribe-btn">
            <Layers className="w-4 h-4 mr-2" />
            Bulk Subscribe
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase text-muted-foreground">Total Branches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{allBranches.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase text-muted-foreground">Branches with SKUs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-green-600">{branchesWithAssignments}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase text-muted-foreground">Total Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-primary">{totalAssignments.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by SKU ID, Buyer SKU, Description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 font-mono"
            data-testid="search-input"
          />
        </div>
      </div>

      {/* Branch Cards - Expandable */}
      <div className="space-y-4">
        {allBranches.map((branch) => {
          const assignments = branchAssignments[branch.name] || [];
          const filtered = getFilteredAssignments(assignments);
          const isExpanded = expandedBranches[branch.name];
          
          // Group by vertical
          const byVertical = {};
          assignments.forEach(a => {
            const v = a.vertical || 'Unknown';
            if (!byVertical[v]) byVertical[v] = 0;
            byVertical[v]++;
          });

          return (
            <Card key={branch.name} className="overflow-hidden">
              <div 
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-50 transition-colors"
                onClick={() => toggleBranchExpand(branch.name)}
                data-testid={`branch-header-${branch.name.replace(/\s+/g, '-')}`}
              >
                <div className="flex items-center gap-4">
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  )}
                  <Building2 className="w-5 h-5 text-primary" />
                  <div>
                    <h3 className="font-bold text-lg">{branch.name}</h3>
                    <div className="flex gap-2 mt-1">
                      {Object.entries(byVertical).map(([v, count]) => (
                        <Badge key={v} variant="outline" className="text-xs">
                          {v}: {count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-2xl font-black">{assignments.length}</div>
                    <div className="text-xs text-muted-foreground">SKUs assigned</div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); exportAssignments(branch.name); }}
                    disabled={assignments.length === 0}
                    data-testid={`export-${branch.name.replace(/\s+/g, '-')}`}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              {isExpanded && (
                <CardContent className="pt-0 border-t">
                  {filtered.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      {assignments.length === 0 ? "No SKUs assigned to this branch" : "No SKUs match your search"}
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-96">
                      <table className="w-full text-sm">
                        <thead className="bg-zinc-50 sticky top-0">
                          <tr>
                            <th className="h-10 px-4 text-left font-mono text-xs uppercase">Buyer SKU ID</th>
                            <th className="h-10 px-4 text-left font-mono text-xs uppercase">SKU ID</th>
                            <th className="h-10 px-4 text-left font-mono text-xs uppercase">Description</th>
                            <th className="h-10 px-4 text-left font-mono text-xs uppercase">Vertical</th>
                            <th className="h-10 px-4 text-left font-mono text-xs uppercase">Model</th>
                            <th className="h-10 px-4 text-left font-mono text-xs uppercase">Brand</th>
                            <th className="h-10 px-4 text-center font-mono text-xs uppercase">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.slice(0, 50).map((a, idx) => (
                            <tr key={`${a.sku_id}-${idx}`} className="border-t hover:bg-zinc-50/50">
                              <td className="p-4 font-mono text-sm text-primary font-bold">{a.buyer_sku_id || '-'}</td>
                              <td className="p-4 font-mono text-sm">{a.sku_id}</td>
                              <td className="p-4 text-sm truncate max-w-[250px]">{a.description || '-'}</td>
                              <td className="p-4"><Badge variant="secondary">{a.vertical || '-'}</Badge></td>
                              <td className="p-4 text-sm">{a.model || '-'}</td>
                              <td className="p-4"><Badge variant="outline">{a.brand || '-'}</Badge></td>
                              <td className="p-4 text-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveAssignment(a.sku_id, branch.name)}
                                  className="text-red-600 hover:text-red-800"
                                  data-testid={`remove-${a.sku_id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {filtered.length > 50 && (
                        <div className="p-4 text-center text-sm text-muted-foreground border-t">
                          Showing 50 of {filtered.length} assignments. Use search to filter.
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Upload SKUs Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload SKUs to Branch
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Branch *</Label>
              <Select value={uploadBranch} onValueChange={setUploadBranch}>
                <SelectTrigger data-testid="upload-branch-select">
                  <SelectValue placeholder="Select a branch..." />
                </SelectTrigger>
                <SelectContent>
                  {allBranches.map(b => (
                    <SelectItem key={b.name} value={b.name}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {uploadBranch && (
              <div>
                <Label>Upload Excel File</Label>
                <Input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleUpload}
                  className="cursor-pointer"
                  data-testid="upload-file-input"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Excel file with SKU IDs in first column. RMs will be auto-activated.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Subscribe Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={(open) => { setShowBulkDialog(open); if (!open) resetBulkForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5" />
              Bulk SKU Subscription
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-bold">1. Select Branch *</Label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger data-testid="bulk-branch-select">
                  <SelectValue placeholder="Select a branch..." />
                </SelectTrigger>
                <SelectContent>
                  {allBranches.map(b => (
                    <SelectItem key={b.name} value={b.name}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedBranch && (
              <>
                <div>
                  <Label className="text-sm font-bold">2. Select Vertical *</Label>
                  <Select value={selectedVertical} onValueChange={setSelectedVertical}>
                    <SelectTrigger data-testid="bulk-vertical-select">
                      <SelectValue placeholder="Select vertical..." />
                    </SelectTrigger>
                    <SelectContent>
                      {verticals.map(v => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedVertical && (
                  <div>
                    <Label className="text-sm font-bold">3. Select Model (Optional)</Label>
                    <Select value={selectedModel || "_all"} onValueChange={(v) => setSelectedModel(v === "_all" ? "" : v)}>
                      <SelectTrigger data-testid="bulk-model-select">
                        <SelectValue placeholder="All models" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_all">All {selectedVertical} models</SelectItem>
                        {models.map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

            {selectedBranch && selectedVertical && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-sm text-blue-800">
                  <span className="font-bold">{previewCount} SKUs</span> will be subscribed to <span className="font-bold">{selectedBranch}</span>
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  Filter: {selectedVertical} {selectedModel ? `→ ${selectedModel}` : '(all models)'}
                </div>
              </div>
            )}

            {bulkResult && (
              <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-sm">
                <div className="font-bold text-green-800">Result:</div>
                <div className="text-green-700">
                  Assigned: {bulkResult.assigned}, Skipped: {bulkResult.skipped}, RMs Activated: {bulkResult.rms_activated || 0}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button 
                onClick={handleBulkSubscribe}
                disabled={!selectedBranch || !selectedVertical || loading || previewCount === 0}
                className="flex-1 uppercase text-xs"
                data-testid="bulk-subscribe-confirm-btn"
              >
                <Layers className="w-4 h-4 mr-2" />
                Subscribe {previewCount > 0 ? `(${previewCount})` : ''}
              </Button>
              <Button 
                variant="destructive"
                onClick={handleBulkUnsubscribe}
                disabled={!selectedBranch || !selectedVertical || loading}
                className="uppercase text-xs"
                data-testid="bulk-unsubscribe-btn"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Unsubscribe
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SKUSubscription;

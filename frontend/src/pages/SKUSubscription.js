import { useState, useEffect, useRef } from "react";
import axios from "axios";
import useBranchStore from "@/store/branchStore";
import useAuthStore from "@/store/authStore";
import { Upload, Download, Package, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchAssignments();
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
            className="uppercase text-xs tracking-wide"
            data-testid="upload-sku-btn"
          >
            <Upload className="w-4 h-4 mr-2" strokeWidth={1.5} />
            Upload SKUs
          </Button>
        </div>
      </div>

      {/* Upload Result */}
      {uploadResult && (
        <div className="mb-6 p-4 bg-zinc-50 border border-zinc-200 rounded-sm">
          <h3 className="font-bold text-sm mb-2">Last Upload Result</h3>
          <div className="grid grid-cols-3 gap-4 text-sm font-mono">
            <div>
              <span className="text-green-600 font-bold">{uploadResult.assigned}</span> assigned
            </div>
            <div>
              <span className="text-yellow-600 font-bold">{uploadResult.skipped}</span> skipped (already assigned)
            </div>
            <div>
              <span className="text-red-600 font-bold">{uploadResult.total_not_found}</span> not found
            </div>
          </div>
          {uploadResult.not_found.length > 0 && (
            <div className="mt-2 text-xs text-zinc-500">
              Not found: {uploadResult.not_found.slice(0, 5).join(', ')}
              {uploadResult.not_found.length > 5 && ` and ${uploadResult.total_not_found - 5} more...`}
            </div>
          )}
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border border border-border mb-8">
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
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Bidso SKU</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Description</th>
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
                  <td className="p-4 align-middle font-mono text-sm text-zinc-600">
                    {assignment.bidso_sku || '-'}
                  </td>
                  <td className="p-4 align-middle text-sm text-zinc-600 max-w-xs truncate">
                    {assignment.description || '-'}
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
              No SKUs assigned to {selectedBranch}. Upload a file to assign SKUs.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SKUSubscription;

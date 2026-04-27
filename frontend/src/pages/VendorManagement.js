import { useState, useEffect, useRef } from "react";
import axios from "axios";
import useAuthStore from "@/store/authStore";
import { Plus, Search, Trash2, Edit, Building2, Package, TrendingDown, ChevronRight, X, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Allowed vendor-level payment terms (mirrors backend ALLOWED_PAYMENT_TERMS).
// Order matters — first item is the default for new vendors.
const PAYMENT_TERMS_OPTIONS = [
  { value: "DUE_ON_RECEIPT", label: "Due on Receipt" },
  { value: "NET_15", label: "Net 15" },
  { value: "NET_30", label: "Net 30" },
  { value: "NET_45", label: "Net 45" },
  { value: "NET_60", label: "Net 60" },
];
const DEFAULT_PAYMENT_TERMS = "DUE_ON_RECEIPT";

const VendorManagement = () => {
  const { token } = useAuthStore();
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [vendorRMPrices, setVendorRMPrices] = useState([]);
  const [comparisonReport, setComparisonReport] = useState([]);
  const [rmVendors, setRmVendors] = useState([]);
  const [selectedRM, setSelectedRM] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [rmSearchQuery, setRmSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const fileInputRef = useRef(null);
  const priceFileInputRef = useRef(null);
  
  const [showAddVendorDialog, setShowAddVendorDialog] = useState(false);
  const [showAddPriceDialog, setShowAddPriceDialog] = useState(false);
  const [showRMVendorsDialog, setShowRMVendorsDialog] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);

  const [vendorForm, setVendorForm] = useState({
    name: "", gst: "", address: "", poc: "", email: "", phone: "", payment_terms: DEFAULT_PAYMENT_TERMS
  });

  const [priceForm, setPriceForm] = useState({
    rm_id: "", price: "", currency: "INR", notes: ""
  });

  // Available RMs for dropdown
  const [availableRMs, setAvailableRMs] = useState([]);
  const [rmSearch, setRmSearch] = useState("");

  useEffect(() => {
    fetchVendors();
    fetchComparisonReport();
    fetchAvailableRMs();
  }, []);

  const fetchVendors = async () => {
    try {
      const response = await axios.get(`${API}/vendors`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVendors(response.data);
    } catch (error) {
      toast.error("Failed to fetch vendors");
    }
  };

  const fetchComparisonReport = async () => {
    try {
      const response = await axios.get(`${API}/vendor-rm-prices/comparison`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setComparisonReport(response.data);
    } catch (error) {
      console.error("Failed to fetch comparison report");
    }
  };

  const fetchAvailableRMs = async () => {
    try {
      const response = await axios.get(`${API}/raw-materials`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAvailableRMs(response.data);
    } catch (error) {
      console.error("Failed to fetch RMs");
    }
  };

  const fetchVendorDetails = async (vendorId) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/vendors/${vendorId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedVendor(response.data.vendor);
      setVendorRMPrices(response.data.rm_prices);
    } catch (error) {
      toast.error("Failed to fetch vendor details");
    } finally {
      setLoading(false);
    }
  };

  const fetchRMVendors = async (rmId) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/vendor-rm-prices/by-rm/${rmId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRmVendors(response.data);
      setSelectedRM(rmId);
      setShowRMVendorsDialog(true);
    } catch (error) {
      toast.error("Failed to fetch vendors for RM");
    } finally {
      setLoading(false);
    }
  };

  const handleAddVendor = async () => {
    if (!vendorForm.name) {
      toast.error("Vendor name is required");
      return;
    }
    if (!vendorForm.payment_terms) {
      toast.error("Payment Terms is required");
      return;
    }

    try {
      if (editingVendor) {
        await axios.put(`${API}/vendors/${editingVendor.id}`, vendorForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success("Vendor updated");
      } else {
        await axios.post(`${API}/vendors`, vendorForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success("Vendor added");
      }
      
      setShowAddVendorDialog(false);
      resetVendorForm();
      fetchVendors();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save vendor");
    }
  };

  const handleDeleteVendor = async (vendorId) => {
    if (!window.confirm("Delete this vendor and all associated prices?")) return;
    
    try {
      await axios.delete(`${API}/vendors/${vendorId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Vendor deleted");
      fetchVendors();
      setSelectedVendor(null);
      fetchComparisonReport();
    } catch (error) {
      toast.error("Failed to delete vendor");
    }
  };

  const handleAddPrice = async () => {
    if (!priceForm.rm_id || !priceForm.price) {
      toast.error("RM ID and Price are required");
      return;
    }

    try {
      await axios.post(`${API}/vendor-rm-prices`, {
        vendor_id: selectedVendor.id,
        rm_id: priceForm.rm_id,
        price: parseFloat(priceForm.price),
        currency: priceForm.currency,
        notes: priceForm.notes
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success("Price added/updated");
      setShowAddPriceDialog(false);
      resetPriceForm();
      fetchVendorDetails(selectedVendor.id);
      fetchComparisonReport();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to add price");
    }
  };

  const handleDeletePrice = async (vendorId, rmId) => {
    if (!window.confirm("Remove this price mapping?")) return;
    
    try {
      await axios.delete(`${API}/vendor-rm-prices/${vendorId}/${rmId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Price removed");
      fetchVendorDetails(vendorId);
      fetchComparisonReport();
    } catch (error) {
      toast.error("Failed to remove price");
    }
  };

  const resetVendorForm = () => {
    setVendorForm({ name: "", gst: "", address: "", poc: "", email: "", phone: "", payment_terms: DEFAULT_PAYMENT_TERMS });
    setEditingVendor(null);
  };

  const resetPriceForm = () => {
    setPriceForm({ rm_id: "", price: "", currency: "INR", notes: "" });
    setRmSearch("");
  };

  const openEditVendor = (vendor) => {
    setVendorForm({
      name: vendor.name,
      gst: vendor.gst || "",
      address: vendor.address || "",
      poc: vendor.poc || "",
      email: vendor.email || "",
      phone: vendor.phone || "",
      payment_terms: vendor.payment_terms || DEFAULT_PAYMENT_TERMS,
    });
    setEditingVendor(vendor);
    setShowAddVendorDialog(true);
  };

  const exportComparisonReport = () => {
    const ws = XLSX.utils.json_to_sheet(comparisonReport.map(r => ({
      'RM ID': r.rm_id,
      'Category': r.rm_category,
      'Lowest Price': r.lowest_price,
      'Currency': r.currency,
      'Best Vendor': r.lowest_vendor_name,
      'Total Vendors': r.total_vendors
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Price Comparison');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'rm_price_comparison.xlsx');
    toast.success("Exported to Excel");
  };

  const filteredVendors = vendors.filter(v => 
    v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.gst?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.vendor_id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setLoading(true);
    try {
      const response = await axios.post(`${API}/vendors/bulk-upload`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setUploadResult(response.data);
      
      if (response.data.created > 0) {
        toast.success(`Created ${response.data.created} vendors`);
      }
      if (response.data.skipped > 0) {
        toast.info(`${response.data.skipped} vendors skipped (already exist)`);
      }
      
      fetchVendors();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Upload failed");
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handlePriceBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setLoading(true);
    try {
      const response = await axios.post(`${API}/vendor-rm-prices/bulk-upload?mode=upsert`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUploadResult({
        created: response.data.created,
        skipped: response.data.updated,
        total_errors: response.data.error_count,
        errors: response.data.errors,
        _type: 'price',
      });
      if (response.data.created + response.data.updated > 0) {
        toast.success(`${response.data.created} new, ${response.data.updated} updated price records`);
      }
      if (response.data.error_count > 0) {
        toast.error(`${response.data.error_count} rows had errors — see Last Upload Result`);
      }
      if (selectedVendor) fetchVendorDetails(selectedVendor.vendor_id);
      fetchComparisonReport();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Price upload failed");
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const downloadPriceTemplate = () => {
    window.open(`${API}/vendor-rm-prices/template`, '_blank');
  };

  const downloadVendorTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Name', 'Payment Terms', 'GST', 'Address', 'POC', 'Email', 'Phone'],
      ['Sample Vendor', 'Net 30', 'GSTIN123456', '123 Main St, City', 'John Doe', 'vendor@example.com', '9876543210'],
      ['Allowed values for Payment Terms:', 'Due on Receipt | Net 15 | Net 30 | Net 45 | Net 60', '', '', '', '', '']
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vendors');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'vendor_upload_template.xlsx');
    toast.success("Template downloaded");
  };

  const exportVendors = () => {
    const ptLabel = (code) => (PAYMENT_TERMS_OPTIONS.find(p => p.value === code)?.label) || code || 'Due on Receipt';
    const ws = XLSX.utils.json_to_sheet(vendors.map(v => ({
      'Vendor ID': v.vendor_id,
      'Name': v.name,
      'Payment Terms': ptLabel(v.payment_terms),
      'GST': v.gst || '',
      'Address': v.address || '',
      'POC': v.poc || '',
      'Email': v.email || '',
      'Phone': v.phone || ''
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vendors');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'vendors_export.xlsx');
    toast.success("Exported to Excel");
  };

  const exportVendorRMPrices = async () => {
    try {
      const response = await axios.get(`${API}/vendor-rm-prices/export`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vendor_rm_prices_${new Date().toISOString().slice(0,10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("Vendor × RM price mappings exported");
    } catch (error) {
      if (error.response?.status === 404) {
        toast.error("No vendor-RM price mappings exist yet");
      } else {
        toast.error(error.response?.data?.detail || "Export failed");
      }
    }
  };

  const filteredComparison = comparisonReport.filter(r =>
    r.rm_id.toLowerCase().includes(rmSearchQuery.toLowerCase()) ||
    r.rm_category?.toLowerCase().includes(rmSearchQuery.toLowerCase())
  );

  const filteredRMsForDropdown = availableRMs.filter(rm =>
    rm.rm_id.toLowerCase().includes(rmSearch.toLowerCase())
  ).slice(0, 50);

  return (
    <div className="p-6 md:p-8" data-testid="vendor-management-page">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight uppercase">Vendor Management</h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">
            Manage vendors and RM pricing • {vendors.length} vendors
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" onClick={downloadVendorTemplate} className="uppercase text-xs">
            <Download className="w-4 h-4 mr-2" /> Vendor Template
          </Button>
          <Button variant="secondary" onClick={downloadPriceTemplate} className="uppercase text-xs" data-testid="download-price-template">
            <Download className="w-4 h-4 mr-2" /> Price Template
          </Button>
          <Button variant="secondary" onClick={exportVendors} className="uppercase text-xs">
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
          <Button 
            variant="secondary" 
            onClick={exportVendorRMPrices} 
            className="uppercase text-xs"
            data-testid="export-vendor-rm-prices"
          >
            <Download className="w-4 h-4 mr-2" /> Export Prices
          </Button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleBulkUpload} 
            accept=".xlsx,.xls"
            className="hidden"
          />
          <input
            type="file"
            ref={priceFileInputRef}
            onChange={handlePriceBulkUpload}
            accept=".xlsx,.xls"
            className="hidden"
          />
          <Button 
            onClick={() => fileInputRef.current.click()}
            disabled={loading}
            className="uppercase text-xs"
            variant="outline"
          >
            <Upload className="w-4 h-4 mr-2" /> Bulk Upload Vendors
          </Button>
          <Button 
            onClick={() => priceFileInputRef.current.click()}
            disabled={loading}
            className="uppercase text-xs"
            data-testid="bulk-upload-prices-btn"
          >
            <Upload className="w-4 h-4 mr-2" /> Bulk Upload Prices
          </Button>
        </div>
      </div>

      {/* Upload Result */}
      {uploadResult && (
        <div className="mb-6 p-4 bg-zinc-50 border border-zinc-200 rounded-sm" data-testid="upload-result">
          <h3 className="font-bold text-sm mb-2">
            Last Upload Result {uploadResult._type === 'price' ? '(Vendor RM Prices)' : '(Vendors)'}
          </h3>
          <div className="grid grid-cols-3 gap-4 text-sm font-mono">
            <div><span className="text-green-600 font-bold">{uploadResult.created}</span> {uploadResult._type === 'price' ? 'new' : 'created'}</div>
            <div><span className="text-yellow-600 font-bold">{uploadResult.skipped}</span> {uploadResult._type === 'price' ? 'updated' : 'skipped'}</div>
            <div><span className="text-red-600 font-bold">{uploadResult.total_errors}</span> errors</div>
          </div>
          {uploadResult.errors && uploadResult.errors.length > 0 && (
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-red-600 font-medium">View first {uploadResult.errors.length} errors</summary>
              <ul className="mt-2 space-y-0.5 font-mono text-red-700 max-h-40 overflow-y-auto">
                {uploadResult.errors.map((err, idx) => (<li key={idx}>· {err}</li>))}
              </ul>
            </details>
          )}
        </div>
      )}

      <Tabs defaultValue="vendors" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="vendors" className="uppercase text-xs">
            <Building2 className="w-4 h-4 mr-2" />
            Vendors
          </TabsTrigger>
          <TabsTrigger value="comparison" className="uppercase text-xs">
            <TrendingDown className="w-4 h-4 mr-2" />
            Price Comparison
          </TabsTrigger>
        </TabsList>

        {/* Vendors Tab */}
        <TabsContent value="vendors">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Vendor List */}
            <div className="lg:col-span-1 border border-border bg-white rounded-sm">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h2 className="font-bold uppercase text-sm">Vendors</h2>
                <Dialog open={showAddVendorDialog} onOpenChange={(open) => {
                  setShowAddVendorDialog(open);
                  if (!open) resetVendorForm();
                }}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="uppercase text-xs">
                      <Plus className="w-4 h-4 mr-1" /> Add
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="font-bold uppercase">
                        {editingVendor ? "Edit Vendor" : "Add Vendor"}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Vendor Name *</Label>
                        <Input 
                          value={vendorForm.name}
                          onChange={(e) => setVendorForm({...vendorForm, name: e.target.value})}
                          placeholder="Vendor name"
                        />
                      </div>
                      <div>
                        <Label>GST Number</Label>
                        <Input 
                          value={vendorForm.gst}
                          onChange={(e) => setVendorForm({...vendorForm, gst: e.target.value})}
                          placeholder="GSTIN"
                        />
                      </div>
                      <div>
                        <Label>Address</Label>
                        <Textarea 
                          value={vendorForm.address}
                          onChange={(e) => setVendorForm({...vendorForm, address: e.target.value})}
                          placeholder="Full address"
                          rows={2}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Point of Contact</Label>
                          <Input 
                            value={vendorForm.poc}
                            onChange={(e) => setVendorForm({...vendorForm, poc: e.target.value})}
                            placeholder="Contact person"
                          />
                        </div>
                        <div>
                          <Label>Phone</Label>
                          <Input 
                            value={vendorForm.phone}
                            onChange={(e) => setVendorForm({...vendorForm, phone: e.target.value})}
                            placeholder="Phone number"
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Email</Label>
                        <Input 
                          type="email"
                          value={vendorForm.email}
                          onChange={(e) => setVendorForm({...vendorForm, email: e.target.value})}
                          placeholder="Email address"
                        />
                      </div>
                      <div>
                        <Label>Payment Terms *</Label>
                        <Select
                          value={vendorForm.payment_terms || DEFAULT_PAYMENT_TERMS}
                          onValueChange={(v) => setVendorForm({...vendorForm, payment_terms: v})}
                        >
                          <SelectTrigger data-testid="vendor-payment-terms-select">
                            <SelectValue placeholder="Select payment terms" />
                          </SelectTrigger>
                          <SelectContent>
                            {PAYMENT_TERMS_OPTIONS.map(pt => (
                              <SelectItem key={pt.value} value={pt.value} data-testid={`pt-option-${pt.value}`}>
                                {pt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">
                          Auto-populated in RM Inward when this vendor is selected.
                        </p>
                      </div>
                      <Button onClick={handleAddVendor} className="w-full uppercase text-xs" data-testid="save-vendor-btn">
                        {editingVendor ? "Update Vendor" : "Add Vendor"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              
              <div className="p-2">
                <Input 
                  placeholder="Search vendors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mb-2"
                />
              </div>
              
              <div className="max-h-[500px] overflow-y-auto">
                {filteredVendors.map((vendor) => (
                  <div 
                    key={vendor.id}
                    className={`p-4 border-b border-zinc-100 cursor-pointer hover:bg-zinc-50 flex items-center justify-between ${selectedVendor?.id === vendor.id ? 'bg-zinc-100' : ''}`}
                    onClick={() => fetchVendorDetails(vendor.id)}
                  >
                    <div>
                      <div className="text-xs font-mono text-primary font-bold">{vendor.vendor_id || 'N/A'}</div>
                      <div className="font-bold text-sm">{vendor.name}</div>
                      <div className="text-xs text-zinc-500 font-mono">{vendor.gst || 'No GST'}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-400" />
                  </div>
                ))}
                {filteredVendors.length === 0 && (
                  <div className="p-4 text-center text-sm text-zinc-500">No vendors found</div>
                )}
              </div>
            </div>

            {/* Vendor Details */}
            <div className="lg:col-span-2 border border-border bg-white rounded-sm">
              {selectedVendor ? (
                <>
                  <div className="p-4 border-b border-border flex items-center justify-between">
                    <div>
                      <div className="text-xs font-mono text-primary font-bold mb-1">{selectedVendor.vendor_id || 'N/A'}</div>
                      <h2 className="font-bold text-lg">{selectedVendor.name}</h2>
                      <div className="text-xs text-zinc-500 font-mono">
                        {selectedVendor.gst && `GST: ${selectedVendor.gst}`}
                        {selectedVendor.phone && ` • ${selectedVendor.phone}`}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEditVendor(selectedVendor)} data-testid="edit-vendor-btn">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDeleteVendor(selectedVendor.id)} data-testid="delete-vendor-btn">
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                      <Dialog open={showAddPriceDialog} onOpenChange={(open) => {
                        setShowAddPriceDialog(open);
                        if (!open) resetPriceForm();
                      }}>
                        <DialogTrigger asChild>
                          <Button size="sm" className="uppercase text-xs">
                            <Plus className="w-4 h-4 mr-1" /> Add Price
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle className="font-bold uppercase">Add RM Price</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label>Search RM ID</Label>
                              <Input 
                                value={rmSearch}
                                onChange={(e) => setRmSearch(e.target.value)}
                                placeholder="Type to search RM..."
                                className="mb-2"
                              />
                              <Label>Select RM *</Label>
                              <select
                                value={priceForm.rm_id}
                                onChange={(e) => setPriceForm({...priceForm, rm_id: e.target.value})}
                                className="flex h-10 w-full rounded-sm border border-input bg-transparent px-3 py-2 text-sm font-mono"
                              >
                                <option value="">Select RM ({filteredRMsForDropdown.length} shown)</option>
                                {filteredRMsForDropdown.map(rm => (
                                  <option key={rm.rm_id} value={rm.rm_id}>
                                    {rm.rm_id} - {rm.category}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>Price *</Label>
                                <Input 
                                  type="number"
                                  step="0.01"
                                  value={priceForm.price}
                                  onChange={(e) => setPriceForm({...priceForm, price: e.target.value})}
                                  placeholder="0.00"
                                />
                              </div>
                              <div>
                                <Label>Currency</Label>
                                <select
                                  value={priceForm.currency}
                                  onChange={(e) => setPriceForm({...priceForm, currency: e.target.value})}
                                  className="flex h-10 w-full rounded-sm border border-input bg-transparent px-3 py-2 text-sm"
                                >
                                  <option value="INR">INR</option>
                                  <option value="USD">USD</option>
                                </select>
                              </div>
                            </div>
                            <div>
                              <Label>Notes</Label>
                              <Textarea 
                                value={priceForm.notes}
                                onChange={(e) => setPriceForm({...priceForm, notes: e.target.value})}
                                placeholder="Additional notes..."
                                rows={2}
                              />
                            </div>
                            <Button onClick={handleAddPrice} className="w-full uppercase text-xs">
                              Add/Update Price
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                  
                  {/* Vendor Info */}
                  {(selectedVendor.address || selectedVendor.poc || selectedVendor.email) && (
                    <div className="p-4 bg-zinc-50 border-b border-zinc-200 text-sm">
                      {selectedVendor.address && <div className="mb-1">{selectedVendor.address}</div>}
                      {selectedVendor.poc && <div>POC: {selectedVendor.poc}</div>}
                      {selectedVendor.email && <div>Email: {selectedVendor.email}</div>}
                    </div>
                  )}
                  
                  {/* RM Prices Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-zinc-50 border-b border-zinc-200">
                        <tr>
                          <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase">RM ID</th>
                          <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase">Category</th>
                          <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase">Price</th>
                          <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase">Notes</th>
                          <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vendorRMPrices.map((price) => (
                          <tr key={price.id} className="border-b border-zinc-100 hover:bg-zinc-50/50">
                            <td className="p-4 align-middle font-mono text-sm font-bold text-primary cursor-pointer hover:underline" onClick={() => fetchRMVendors(price.rm_id)}>
                              {price.rm_id}
                            </td>
                            <td className="p-4 align-middle">
                              <span className="text-xs font-mono px-2 py-1 bg-zinc-100 rounded">
                                {price.rm_category}
                              </span>
                            </td>
                            <td className="p-4 align-middle font-mono text-sm font-bold text-green-600">
                              {price.currency} {price.price.toFixed(2)}
                            </td>
                            <td className="p-4 align-middle text-xs text-zinc-500">
                              {price.notes || '-'}
                            </td>
                            <td className="p-4 align-middle">
                              <Button variant="ghost" size="sm" onClick={() => handleDeletePrice(selectedVendor.id, price.rm_id)}>
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {vendorRMPrices.length === 0 && (
                      <div className="p-8 text-center text-zinc-500 text-sm">
                        No RM prices added yet. Click "Add Price" to start.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="p-12 text-center text-zinc-500">
                  <Building2 className="w-12 h-12 mx-auto mb-4 text-zinc-300" />
                  <div className="text-sm">Select a vendor to view details and RM prices</div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Price Comparison Tab */}
        <TabsContent value="comparison">
          <div className="mb-4 flex items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search by RM ID or Category..."
                value={rmSearchQuery}
                onChange={(e) => setRmSearchQuery(e.target.value)}
                className="pl-10 font-mono"
              />
            </div>
            <Button variant="secondary" onClick={exportComparisonReport} className="uppercase text-xs">
              <Download className="w-4 h-4 mr-2" /> Export Report
            </Button>
          </div>

          <div className="border border-border bg-white rounded-sm overflow-hidden">
            <div className="p-4 border-b border-border bg-zinc-50">
              <h3 className="font-bold uppercase text-sm flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-green-600" />
                Lowest Price per RM (for Procurement)
              </h3>
              <p className="text-xs text-zinc-500 mt-1">Click on RM ID to see all vendors and their prices</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-zinc-50 border-b border-zinc-200">
                  <tr>
                    <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase">RM ID</th>
                    <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase">Category</th>
                    <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase">Lowest Price</th>
                    <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase">Best Vendor</th>
                    <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase">Total Vendors</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredComparison.map((item) => (
                    <tr key={item.rm_id} className="border-b border-zinc-100 hover:bg-zinc-50/50">
                      <td className="p-4 align-middle font-mono text-sm font-bold text-primary cursor-pointer hover:underline" onClick={() => fetchRMVendors(item.rm_id)}>
                        {item.rm_id}
                      </td>
                      <td className="p-4 align-middle">
                        <span className="text-xs font-mono px-2 py-1 bg-zinc-100 rounded">
                          {item.rm_category}
                        </span>
                      </td>
                      <td className="p-4 align-middle font-mono text-sm font-bold text-green-600">
                        {item.currency} {item.lowest_price.toFixed(2)}
                      </td>
                      <td className="p-4 align-middle text-sm">
                        {item.lowest_vendor_name}
                      </td>
                      <td className="p-4 align-middle">
                        <span className="text-xs font-mono px-2 py-1 bg-primary/10 text-primary rounded">
                          {item.total_vendors} vendor{item.total_vendors > 1 ? 's' : ''}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredComparison.length === 0 && (
                <div className="p-12 text-center text-zinc-500 text-sm">
                  No RM prices found. Add vendors and prices to see comparison.
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* RM Vendors Dialog */}
      <Dialog open={showRMVendorsDialog} onOpenChange={setShowRMVendorsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-bold uppercase flex items-center gap-2">
              <Package className="w-5 h-5" />
              Vendors for {selectedRM}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="h-10 px-4 text-left font-mono text-xs font-medium text-zinc-500 uppercase">Vendor</th>
                  <th className="h-10 px-4 text-left font-mono text-xs font-medium text-zinc-500 uppercase">Price</th>
                  <th className="h-10 px-4 text-left font-mono text-xs font-medium text-zinc-500 uppercase">Phone</th>
                </tr>
              </thead>
              <tbody>
                {rmVendors.map((v, idx) => (
                  <tr key={idx} className={`border-b border-zinc-100 ${idx === 0 ? 'bg-green-50' : ''}`}>
                    <td className="p-4 align-middle">
                      <div className="font-bold text-sm">{v.vendor_name}</div>
                      <div className="text-xs text-zinc-500 font-mono">{v.vendor_gst || ''}</div>
                    </td>
                    <td className="p-4 align-middle font-mono text-sm font-bold text-green-600">
                      {v.currency} {v.price.toFixed(2)}
                      {idx === 0 && <span className="ml-2 text-xs bg-green-600 text-white px-1 rounded">LOWEST</span>}
                    </td>
                    <td className="p-4 align-middle text-sm text-zinc-600">
                      {v.vendor_phone || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rmVendors.length === 0 && (
              <div className="p-8 text-center text-zinc-500 text-sm">
                No vendors found for this RM
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendorManagement;

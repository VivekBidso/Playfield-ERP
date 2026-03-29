import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { 
  Plus, Search, Download, Upload, Check, X, Star, 
  Palette, Building2, ChevronDown, ChevronRight, Edit, Trash2,
  FileSpreadsheet, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import useAuthStore from "../store/authStore";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const COLOR_FAMILIES = [
  "RED", "BLUE", "GREEN", "YELLOW", "ORANGE", "PURPLE", 
  "PINK", "BROWN", "BLACK", "WHITE", "GREY", "METALLIC", "OTHER"
];

const CATEGORIES = ["INP", "INM", "ACC"];

const PantoneLibrary = () => {
  const { token } = useAuthStore();
  
  // State
  const [shades, setShades] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [colorFamilyFilter, setColorFamilyFilter] = useState("all");
  const [expandedShade, setExpandedShade] = useState(null);
  
  // Dialogs
  const [showAddShadeDialog, setShowAddShadeDialog] = useState(false);
  const [showAddVendorDialog, setShowAddVendorDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [editingShade, setEditingShade] = useState(null);
  const [selectedShadeForVendor, setSelectedShadeForVendor] = useState(null);
  
  // Forms
  const [shadeForm, setShadeForm] = useState({
    pantone_code: "",
    pantone_name: "",
    color_hex: "#808080",
    color_family: "OTHER",
    applicable_categories: ["INP", "INM", "ACC"],
    notes: ""
  });
  
  const [vendorForm, setVendorForm] = useState({
    vendor_id: "",
    master_batch_code: "",
    delta_e_value: "",
    lead_time_days: 14,
    moq: 100,
    notes: ""
  });
  
  const fileInputRef = useRef(null);

  const getHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }), [token]);

  // Fetch data
  useEffect(() => {
    fetchShades();
    fetchVendors();
  }, [token]);

  const fetchShades = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (categoryFilter !== "all") params.append("category", categoryFilter);
      if (colorFamilyFilter !== "all") params.append("color_family", colorFamilyFilter);
      
      const res = await axios.get(`${API}/pantone/shades?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShades(res.data.items || []);
    } catch (err) {
      toast.error("Failed to fetch Pantone shades");
    }
    setLoading(false);
  };

  const fetchVendors = async () => {
    try {
      const res = await axios.get(`${API}/vendors`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVendors(res.data || []);
    } catch (err) {
      console.error("Failed to fetch vendors");
    }
  };

  const fetchShadeDetails = async (shadeId) => {
    try {
      const res = await axios.get(`${API}/pantone/shades/${shadeId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Update the shade in the list with vendor mappings
      setShades(prev => prev.map(s => 
        s.id === shadeId ? { ...s, vendor_mappings: res.data.vendor_mappings } : s
      ));
    } catch (err) {
      toast.error("Failed to fetch shade details");
    }
  };

  // Search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchShades();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, categoryFilter, colorFamilyFilter]);

  // Handlers
  const handleCreateShade = async () => {
    try {
      if (editingShade) {
        await axios.put(`${API}/pantone/shades/${editingShade.id}`, shadeForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success("Pantone shade updated");
      } else {
        await axios.post(`${API}/pantone/shades`, shadeForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success("Pantone shade created");
      }
      setShowAddShadeDialog(false);
      resetShadeForm();
      fetchShades();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save shade");
    }
  };

  const handleAddVendorMapping = async () => {
    if (!selectedShadeForVendor) return;
    
    try {
      await axios.post(`${API}/pantone/vendor-masterbatch`, {
        pantone_id: selectedShadeForVendor.id,
        ...vendorForm,
        delta_e_value: vendorForm.delta_e_value ? parseFloat(vendorForm.delta_e_value) : null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Vendor mapping added (pending QC approval)");
      setShowAddVendorDialog(false);
      resetVendorForm();
      fetchShadeDetails(selectedShadeForVendor.id);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to add vendor mapping");
    }
  };

  const handleApprove = async (mappingId) => {
    try {
      await axios.put(`${API}/pantone/vendor-masterbatch/${mappingId}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Vendor master batch approved");
      if (expandedShade) fetchShadeDetails(expandedShade);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to approve");
    }
  };

  const handleReject = async (mappingId) => {
    const reason = prompt("Enter rejection reason:");
    if (!reason) return;
    
    try {
      await axios.put(`${API}/pantone/vendor-masterbatch/${mappingId}/reject`, 
        { rejection_reason: reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Vendor master batch rejected");
      if (expandedShade) fetchShadeDetails(expandedShade);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to reject");
    }
  };

  const handleSetPreferred = async (mappingId) => {
    try {
      await axios.put(`${API}/pantone/vendor-masterbatch/${mappingId}/set-preferred`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Vendor set as preferred");
      if (expandedShade) fetchShadeDetails(expandedShade);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to set preferred");
    }
  };

  const handleDeleteShade = async (shadeId) => {
    if (!confirm("Are you sure you want to deprecate this Pantone shade?")) return;
    
    try {
      await axios.delete(`${API}/pantone/shades/${shadeId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Pantone shade deprecated");
      fetchShades();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete shade");
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const res = await axios.post(`${API}/pantone/shades/bulk-import`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      toast.success(`Import complete: ${res.data.shades_created} created, ${res.data.vendor_mappings_created} vendor mappings`);
      if (res.data.errors?.length > 0) {
        toast.warning(`${res.data.errors.length} rows had errors`);
      }
      setShowImportDialog(false);
      fetchShades();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Import failed");
    }
    e.target.value = null;
  };

  const handleExport = async () => {
    try {
      const res = await axios.get(`${API}/pantone/shades/export`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Pantone_Export.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error("Export failed");
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await axios.get(`${API}/pantone/shades/download-template`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Pantone_Import_Template.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error("Download failed");
    }
  };

  const resetShadeForm = () => {
    setShadeForm({
      pantone_code: "",
      pantone_name: "",
      color_hex: "#808080",
      color_family: "OTHER",
      applicable_categories: ["INP", "INM", "ACC"],
      notes: ""
    });
    setEditingShade(null);
  };

  const resetVendorForm = () => {
    setVendorForm({
      vendor_id: "",
      master_batch_code: "",
      delta_e_value: "",
      lead_time_days: 14,
      moq: 100,
      notes: ""
    });
    setSelectedShadeForVendor(null);
  };

  const toggleExpand = (shadeId) => {
    if (expandedShade === shadeId) {
      setExpandedShade(null);
    } else {
      setExpandedShade(shadeId);
      fetchShadeDetails(shadeId);
    }
  };

  const toggleCategory = (cat) => {
    const current = shadeForm.applicable_categories;
    if (current.includes(cat)) {
      setShadeForm({ ...shadeForm, applicable_categories: current.filter(c => c !== cat) });
    } else {
      setShadeForm({ ...shadeForm, applicable_categories: [...current, cat] });
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      APPROVED: "bg-green-100 text-green-800",
      PENDING: "bg-yellow-100 text-yellow-800",
      REJECTED: "bg-red-100 text-red-800",
      DEPRECATED: "bg-gray-100 text-gray-800"
    };
    return <Badge className={styles[status] || "bg-gray-100"}>{status}</Badge>;
  };

  return (
    <div className="space-y-6" data-testid="pantone-library">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Palette className="w-6 h-6 text-purple-600" />
            Pantone Library
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage Pantone shades and vendor master batch mappings
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" onClick={() => setShowImportDialog(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          <Button onClick={() => { resetShadeForm(); setShowAddShadeDialog(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Add Pantone
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search Pantone code or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="pantone-search"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={colorFamilyFilter} onValueChange={setColorFamilyFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Color Family" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Colors</SelectItem>
            {COLOR_FAMILIES.map(cf => (
              <SelectItem key={cf} value={cf}>{cf}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{shades.length}</div>
            <div className="text-sm text-muted-foreground">Total Shades</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">
              {shades.filter(s => s.approved_vendor_count > 0).length}
            </div>
            <div className="text-sm text-muted-foreground">With Approved Vendors</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-yellow-600">
              {shades.filter(s => !s.approved_vendor_count).length}
            </div>
            <div className="text-sm text-muted-foreground">Pending Vendor Setup</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-purple-600">
              {shades.reduce((sum, s) => sum + (s.approved_vendor_count || 0), 0)}
            </div>
            <div className="text-sm text-muted-foreground">Total Vendor Mappings</div>
          </CardContent>
        </Card>
      </div>

      {/* Shades List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : shades.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No Pantone shades found. Add your first shade or import from Excel.
            </div>
          ) : (
            <div className="divide-y">
              {shades.map(shade => (
                <div key={shade.id} className="hover:bg-gray-50">
                  {/* Shade Row */}
                  <div 
                    className="flex items-center gap-4 p-4 cursor-pointer"
                    onClick={() => toggleExpand(shade.id)}
                    data-testid={`pantone-row-${shade.pantone_code}`}
                  >
                    {expandedShade === shade.id ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                    
                    {/* Color Swatch */}
                    <div 
                      className="w-10 h-10 rounded-lg border-2 border-gray-200 shadow-sm"
                      style={{ backgroundColor: shade.color_hex }}
                      title={shade.color_hex}
                    />
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{shade.pantone_code}</span>
                        <span className="text-gray-500">-</span>
                        <span>{shade.pantone_name}</span>
                      </div>
                      <div className="flex gap-1 mt-1">
                        {shade.applicable_categories?.map(cat => (
                          <Badge key={cat} variant="outline" className="text-xs">{cat}</Badge>
                        ))}
                      </div>
                    </div>
                    
                    <Badge variant="secondary">{shade.color_family}</Badge>
                    
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {shade.approved_vendor_count || 0} vendors
                      </div>
                      <div className="text-xs text-gray-500">approved</div>
                    </div>
                    
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => {
                          setEditingShade(shade);
                          setShadeForm({
                            pantone_code: shade.pantone_code,
                            pantone_name: shade.pantone_name,
                            color_hex: shade.color_hex,
                            color_family: shade.color_family,
                            applicable_categories: shade.applicable_categories || [],
                            notes: shade.notes || ""
                          });
                          setShowAddShadeDialog(true);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => handleDeleteShade(shade.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Expanded Vendor Mappings */}
                  {expandedShade === shade.id && (
                    <div className="bg-gray-50 px-4 pb-4">
                      <div className="ml-9 p-4 bg-white rounded-lg border">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            Vendor Master Batches
                          </h4>
                          <Button 
                            size="sm"
                            onClick={() => {
                              setSelectedShadeForVendor(shade);
                              resetVendorForm();
                              setShowAddVendorDialog(true);
                            }}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add Vendor
                          </Button>
                        </div>
                        
                        {shade.vendor_mappings?.length > 0 ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-8"></TableHead>
                                <TableHead>Vendor</TableHead>
                                <TableHead>Master Batch</TableHead>
                                <TableHead>Delta E</TableHead>
                                <TableHead>Lead Time</TableHead>
                                <TableHead>MOQ</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {shade.vendor_mappings.map(vm => (
                                <TableRow key={vm.id}>
                                  <TableCell>
                                    {vm.is_preferred && (
                                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                    )}
                                  </TableCell>
                                  <TableCell className="font-medium">{vm.vendor_name}</TableCell>
                                  <TableCell className="font-mono text-sm">{vm.master_batch_code}</TableCell>
                                  <TableCell>
                                    {vm.delta_e_value !== null ? (
                                      <span className={vm.delta_e_value <= 1 ? "text-green-600" : vm.delta_e_value <= 2 ? "text-yellow-600" : "text-red-600"}>
                                        {vm.delta_e_value}
                                      </span>
                                    ) : "-"}
                                  </TableCell>
                                  <TableCell>{vm.lead_time_days} days</TableCell>
                                  <TableCell>{vm.moq}</TableCell>
                                  <TableCell>{getStatusBadge(vm.approval_status)}</TableCell>
                                  <TableCell>
                                    <div className="flex gap-1">
                                      {vm.approval_status === "PENDING" && (
                                        <>
                                          <Button size="sm" variant="ghost" className="text-green-600" onClick={() => handleApprove(vm.id)}>
                                            <Check className="w-4 h-4" />
                                          </Button>
                                          <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleReject(vm.id)}>
                                            <X className="w-4 h-4" />
                                          </Button>
                                        </>
                                      )}
                                      {vm.approval_status === "APPROVED" && !vm.is_preferred && (
                                        <Button size="sm" variant="ghost" onClick={() => handleSetPreferred(vm.id)} title="Set as preferred">
                                          <Star className="w-4 h-4" />
                                        </Button>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) : (
                          <div className="text-center py-4 text-gray-500">
                            No vendor mappings yet. Add a vendor to get started.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Shade Dialog */}
      <Dialog open={showAddShadeDialog} onOpenChange={setShowAddShadeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingShade ? "Edit Pantone Shade" : "Add Pantone Shade"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Pantone Code *</Label>
                <Input
                  value={shadeForm.pantone_code}
                  onChange={(e) => setShadeForm({ ...shadeForm, pantone_code: e.target.value })}
                  placeholder="e.g., 485 C"
                  disabled={!!editingShade}
                  data-testid="pantone-code-input"
                />
              </div>
              <div>
                <Label>Name *</Label>
                <Input
                  value={shadeForm.pantone_name}
                  onChange={(e) => setShadeForm({ ...shadeForm, pantone_name: e.target.value })}
                  placeholder="e.g., Bright Red"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Color (Hex)</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={shadeForm.color_hex}
                    onChange={(e) => setShadeForm({ ...shadeForm, color_hex: e.target.value })}
                    className="w-12 h-10 p-1"
                  />
                  <Input
                    value={shadeForm.color_hex}
                    onChange={(e) => setShadeForm({ ...shadeForm, color_hex: e.target.value })}
                    placeholder="#DA291C"
                  />
                </div>
              </div>
              <div>
                <Label>Color Family</Label>
                <Select 
                  value={shadeForm.color_family} 
                  onValueChange={(v) => setShadeForm({ ...shadeForm, color_family: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLOR_FAMILIES.map(cf => (
                      <SelectItem key={cf} value={cf}>{cf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label>Applicable Categories</Label>
              <div className="flex gap-2 mt-2">
                {CATEGORIES.map(cat => (
                  <Button
                    key={cat}
                    type="button"
                    variant={shadeForm.applicable_categories.includes(cat) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleCategory(cat)}
                  >
                    {cat}
                  </Button>
                ))}
              </div>
            </div>
            
            <div>
              <Label>Notes</Label>
              <Textarea
                value={shadeForm.notes}
                onChange={(e) => setShadeForm({ ...shadeForm, notes: e.target.value })}
                placeholder="Optional notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddShadeDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateShade} data-testid="save-pantone-btn">
              {editingShade ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Vendor Mapping Dialog */}
      <Dialog open={showAddVendorDialog} onOpenChange={setShowAddVendorDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Vendor Master Batch</DialogTitle>
            <DialogDescription>
              For Pantone: {selectedShadeForVendor?.pantone_code} - {selectedShadeForVendor?.pantone_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Vendor *</Label>
              <Select 
                value={vendorForm.vendor_id} 
                onValueChange={(v) => setVendorForm({ ...vendorForm, vendor_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Master Batch Code *</Label>
              <Input
                value={vendorForm.master_batch_code}
                onChange={(e) => setVendorForm({ ...vendorForm, master_batch_code: e.target.value })}
                placeholder="e.g., CT-RED-485"
              />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Delta E</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={vendorForm.delta_e_value}
                  onChange={(e) => setVendorForm({ ...vendorForm, delta_e_value: e.target.value })}
                  placeholder="0.8"
                />
              </div>
              <div>
                <Label>Lead Time (days)</Label>
                <Input
                  type="number"
                  value={vendorForm.lead_time_days}
                  onChange={(e) => setVendorForm({ ...vendorForm, lead_time_days: parseInt(e.target.value) || 14 })}
                />
              </div>
              <div>
                <Label>MOQ</Label>
                <Input
                  type="number"
                  value={vendorForm.moq}
                  onChange={(e) => setVendorForm({ ...vendorForm, moq: parseInt(e.target.value) || 100 })}
                />
              </div>
            </div>
            
            <div>
              <Label>Notes</Label>
              <Textarea
                value={vendorForm.notes}
                onChange={(e) => setVendorForm({ ...vendorForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddVendorDialog(false)}>Cancel</Button>
            <Button onClick={handleAddVendorMapping}>Add Vendor</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Pantone Data</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                Upload an Excel file with Pantone shades and vendor mappings.
                Download the template first to see the required format.
              </p>
            </div>
            
            <Button variant="outline" onClick={handleDownloadTemplate} className="w-full">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Download Import Template
            </Button>
            
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImport}
                className="hidden"
              />
              <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-600 mb-2">Click to upload or drag and drop</p>
              <Button onClick={() => fileInputRef.current?.click()}>
                Select File
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PantoneLibrary;

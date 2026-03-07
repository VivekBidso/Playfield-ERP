import { useState, useEffect } from "react";
import axios from "axios";
import useBranchStore from "@/store/branchStore";
import { Plus, Search, Trash2, Download, Edit, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SKUs = () => {
  const { selectedBranch } = useBranchStore();
  const [skus, setSkus] = useState([]);
  const [filteredSkus, setFilteredSkus] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedSKU, setSelectedSKU] = useState(null);

  // Filter states
  const [verticals, setVerticals] = useState([]);
  const [models, setModels] = useState([]);
  const [brands, setBrands] = useState([]);
  
  const [selectedVertical, setSelectedVertical] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");

  const [formData, setFormData] = useState({
    sku_id: "",
    bidso_sku: "",
    buyer_sku_id: "",
    description: "",
    brand: "",
    vertical: "",
    model: "",
    low_stock_threshold: 5
  });

  useEffect(() => {
    fetchSKUs();
    fetchFilterOptions();
  }, [selectedBranch]);

  // Fetch models when vertical changes
  useEffect(() => {
    if (selectedVertical) {
      fetchModelsByVertical(selectedVertical);
    } else {
      setModels([]);
      setSelectedModel("");
    }
  }, [selectedVertical]);

  // Fetch brands when model changes
  useEffect(() => {
    if (selectedVertical) {
      fetchBrandsByVerticalModel(selectedVertical, selectedModel);
    } else {
      setBrands([]);
      setSelectedBrand("");
    }
  }, [selectedVertical, selectedModel]);

  // Apply filters when any filter changes
  useEffect(() => {
    applyFilters();
  }, [selectedVertical, selectedModel, selectedBrand, searchQuery, skus]);

  const fetchSKUs = async () => {
    try {
      const response = await axios.get(`${API}/skus`);
      setSkus(response.data);
      setFilteredSkus(response.data);
    } catch (error) {
      toast.error("Failed to fetch SKUs");
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
      setSelectedBrand("");
    } catch (error) {
      console.error("Failed to fetch models", error);
    }
  };

  const fetchBrandsByVerticalModel = async (vertical, model) => {
    try {
      let url = `${API}/skus/brands-by-vertical-model?vertical=${encodeURIComponent(vertical)}`;
      if (model) {
        url += `&model=${encodeURIComponent(model)}`;
      }
      const response = await axios.get(url);
      setBrands(response.data.brands);
      setSelectedBrand("");
    } catch (error) {
      console.error("Failed to fetch brands", error);
    }
  };

  const applyFilters = async () => {
    // If any filter is active, fetch filtered SKUs from API
    if (selectedVertical || selectedModel || selectedBrand || searchQuery) {
      try {
        let url = `${API}/skus/filtered?`;
        if (selectedVertical) url += `&vertical=${encodeURIComponent(selectedVertical)}`;
        if (selectedModel) url += `&model=${encodeURIComponent(selectedModel)}`;
        if (selectedBrand) url += `&brand=${encodeURIComponent(selectedBrand)}`;
        if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
        
        const response = await axios.get(url);
        setFilteredSkus(response.data);
      } catch (error) {
        console.error("Failed to apply filters", error);
      }
    } else {
      setFilteredSkus(skus);
    }
  };

  const clearFilters = () => {
    setSelectedVertical("");
    setSelectedModel("");
    setSelectedBrand("");
    setSearchQuery("");
    setFilteredSkus(skus);
  };

  const handleSubmit = async () => {
    try {
      if (editMode) {
        await axios.put(`${API}/skus/${selectedSKU.sku_id}`, formData);
        toast.success("SKU updated");
      } else {
        await axios.post(`${API}/skus`, formData);
        toast.success("SKU added");
      }
      setShowDialog(false);
      resetForm();
      fetchSKUs();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Operation failed");
    }
  };

  const handleEdit = (sku) => {
    setSelectedSKU(sku);
    setFormData({
      sku_id: sku.sku_id,
      bidso_sku: sku.bidso_sku || "",
      buyer_sku_id: sku.buyer_sku_id || "",
      description: sku.description || "",
      brand: sku.brand || "",
      vertical: sku.vertical || "",
      model: sku.model || "",
      low_stock_threshold: sku.low_stock_threshold
    });
    setEditMode(true);
    setShowDialog(true);
  };

  const handleDelete = async (sku_id) => {
    if (!window.confirm('Are you sure you want to delete this SKU?')) return;
    try {
      await axios.delete(`${API}/skus/${sku_id}`);
      toast.success("SKU deleted");
      fetchSKUs();
    } catch (error) {
      toast.error("Failed to delete");
    }
  };

  const resetForm = () => {
    setFormData({ 
      sku_id: "", 
      bidso_sku: "",
      buyer_sku_id: "",
      description: "", 
      brand: "",
      vertical: "",
      model: "",
      low_stock_threshold: 5 
    });
    setEditMode(false);
    setSelectedSKU(null);
  };

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(filteredSkus.map(s => ({
      'SKU ID': s.sku_id,
      'Buyer SKU ID': s.buyer_sku_id,
      'Bidso SKU': s.bidso_sku,
      'Description': s.description,
      'Brand': s.brand,
      'Vertical': s.vertical,
      'Model': s.model,
      'Current Stock': s.current_stock || 0,
      'Low Stock Threshold': s.low_stock_threshold
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SKUs');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'skus.xlsx');
    toast.success("Exported to Excel");
  };

  const hasActiveFilters = selectedVertical || selectedModel || selectedBrand || searchQuery;

  return (
    <div className="p-6 md:p-8" data-testid="skus-page">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight uppercase">SKUs</h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">
            {filteredSkus.length} of {skus.length} finished goods
          </p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="secondary" 
            onClick={handleExport}
            data-testid="export-skus-btn"
            className="uppercase text-xs tracking-wide"
          >
            <Download className="w-4 h-4 mr-2" strokeWidth={1.5} />
            Export
          </Button>
          <Dialog open={showDialog} onOpenChange={(open) => {
            setShowDialog(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button data-testid="add-sku-btn" className="uppercase text-xs tracking-wide">
                <Plus className="w-4 h-4 mr-2" strokeWidth={1.5} />
                Add SKU
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-bold uppercase">
                  {editMode ? "Edit SKU" : "Add SKU"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>SKU ID *</Label>
                    <Input 
                      value={formData.sku_id} 
                      onChange={(e) => setFormData({...formData, sku_id: e.target.value})}
                      data-testid="sku-id-input"
                      className="font-mono"
                      disabled={editMode}
                    />
                  </div>
                  <div>
                    <Label>Buyer SKU ID</Label>
                    <Input 
                      value={formData.buyer_sku_id} 
                      onChange={(e) => setFormData({...formData, buyer_sku_id: e.target.value})}
                      data-testid="buyer-sku-input"
                      className="font-mono"
                    />
                  </div>
                </div>
                <div>
                  <Label>Bidso SKU</Label>
                  <Input 
                    value={formData.bidso_sku} 
                    onChange={(e) => setFormData({...formData, bidso_sku: e.target.value})}
                    data-testid="bidso-sku-input"
                    className="font-mono"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea 
                    value={formData.description} 
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    data-testid="sku-description-input"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Vertical</Label>
                    <Input 
                      value={formData.vertical} 
                      onChange={(e) => setFormData({...formData, vertical: e.target.value})}
                      data-testid="sku-vertical-input"
                    />
                  </div>
                  <div>
                    <Label>Model</Label>
                    <Input 
                      value={formData.model} 
                      onChange={(e) => setFormData({...formData, model: e.target.value})}
                      data-testid="sku-model-input"
                    />
                  </div>
                  <div>
                    <Label>Brand</Label>
                    <Input 
                      value={formData.brand} 
                      onChange={(e) => setFormData({...formData, brand: e.target.value})}
                      data-testid="sku-brand-input"
                    />
                  </div>
                </div>
                <div>
                  <Label>Low Stock Threshold</Label>
                  <Input 
                    type="number" 
                    value={formData.low_stock_threshold} 
                    onChange={(e) => setFormData({...formData, low_stock_threshold: parseFloat(e.target.value)})}
                    data-testid="sku-threshold-input"
                  />
                </div>
                <Button onClick={handleSubmit} data-testid="submit-sku-btn" className="w-full uppercase text-xs tracking-wide">
                  {editMode ? "Update SKU" : "Add SKU"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
          <Input 
            placeholder="Search by SKU ID, description, buyer SKU..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="search-sku-input"
            className="pl-10 font-mono"
          />
        </div>
      </div>

      {/* Dropdown Filters */}
      <div className="mb-6 bg-white border border-border p-4 rounded-sm">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-zinc-500" strokeWidth={1.5} />
          <span className="text-xs uppercase tracking-widest font-bold text-zinc-600">
            Filter SKUs
          </span>
          {hasActiveFilters && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearFilters}
              className="ml-auto text-xs"
              data-testid="clear-filters-btn"
            >
              <X className="w-3 h-3 mr-1" />
              Clear
            </Button>
          )}
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          {/* Vertical Filter */}
          <div>
            <Label className="text-xs text-zinc-500">Vertical</Label>
            <select 
              className="flex h-9 w-full rounded-sm border border-input bg-white px-3 py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              value={selectedVertical}
              onChange={(e) => setSelectedVertical(e.target.value)}
              data-testid="vertical-filter"
            >
              <option value="">All Verticals</option>
              {verticals.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
          
          {/* Model Filter */}
          <div>
            <Label className="text-xs text-zinc-500">Model</Label>
            <select 
              className="flex h-9 w-full rounded-sm border border-input bg-white px-3 py-1 text-sm font-mono disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-primary"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={!selectedVertical}
              data-testid="model-filter"
            >
              <option value="">All Models</option>
              {models.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          
          {/* Brand Filter */}
          <div>
            <Label className="text-xs text-zinc-500">Brand</Label>
            <select 
              className="flex h-9 w-full rounded-sm border border-input bg-white px-3 py-1 text-sm font-mono disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-primary"
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              disabled={!selectedVertical}
              data-testid="brand-filter"
            >
              <option value="">All Brands</option>
              {brands.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="mt-2 text-xs text-zinc-500 font-mono">
          {filteredSkus.length} SKUs found
        </div>
      </div>

      {/* Table */}
      <div className="border border-border bg-white rounded-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="sku-table">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">SKU ID</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Buyer SKU</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Description</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Brand</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Vertical</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Model</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Stock</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSkus.map((sku) => (
                <tr key={sku.id} className="border-b border-zinc-100 hover:bg-zinc-50/50" data-testid={`sku-row-${sku.sku_id}`}>
                  <td className="p-4 align-middle font-mono text-sm font-bold text-zinc-700">{sku.sku_id}</td>
                  <td className="p-4 align-middle font-mono text-sm text-zinc-600">{sku.buyer_sku_id || '-'}</td>
                  <td className="p-4 align-middle text-sm text-zinc-600 max-w-xs truncate">{sku.description || '-'}</td>
                  <td className="p-4 align-middle font-mono text-xs text-zinc-600">{sku.brand || '-'}</td>
                  <td className="p-4 align-middle">
                    <span className="font-mono text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded">
                      {sku.vertical || '-'}
                    </span>
                  </td>
                  <td className="p-4 align-middle font-mono text-xs text-zinc-600">{sku.model || '-'}</td>
                  <td className="p-4 align-middle font-mono text-zinc-700">{sku.current_stock || 0}</td>
                  <td className="p-4 align-middle">
                    {(sku.current_stock || 0) < sku.low_stock_threshold ? (
                      <span className="text-xs font-mono text-red-600 border border-red-600 px-2 py-1 uppercase tracking-wider">
                        Low Stock
                      </span>
                    ) : (
                      <span className="text-xs font-mono text-green-600 border border-green-600 px-2 py-1 uppercase tracking-wider">
                        OK
                      </span>
                    )}
                  </td>
                  <td className="p-4 align-middle">
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleEdit(sku)}
                        data-testid={`edit-sku-${sku.sku_id}`}
                      >
                        <Edit className="w-4 h-4 text-primary" strokeWidth={1.5} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleDelete(sku.sku_id)}
                        data-testid={`delete-sku-${sku.sku_id}`}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" strokeWidth={1.5} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredSkus.length === 0 && (
            <div className="p-12 text-center text-muted-foreground font-mono text-sm">
              No SKUs found. {hasActiveFilters ? "Try clearing filters." : "Add your finished goods."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SKUs;

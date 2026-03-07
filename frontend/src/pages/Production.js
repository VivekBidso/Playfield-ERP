import { useState, useEffect } from "react";
import axios from "axios";
import useBranchStore from "@/store/branchStore";
import { Plus, Download, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Production = () => {
  const { selectedBranch } = useBranchStore();
  const [entries, setEntries] = useState([]);
  const [skus, setSkus] = useState([]);
  const [filteredSkus, setFilteredSkus] = useState([]);
  const [showDialog, setShowDialog] = useState(false);

  // Filter states
  const [verticals, setVerticals] = useState([]);
  const [models, setModels] = useState([]);
  const [brands, setBrands] = useState([]);
  
  const [selectedVertical, setSelectedVertical] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [formData, setFormData] = useState({
    sku_id: "",
    quantity: 0,
    date: new Date().toISOString().split('T')[0],
    notes: ""
  });

  useEffect(() => {
    fetchData();
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

  // Apply filters
  useEffect(() => {
    applyFilters();
  }, [selectedVertical, selectedModel, selectedBrand, searchQuery, skus]);

  const fetchData = async () => {
    try {
      const [entriesRes, skusRes] = await Promise.all([
        axios.get(`${API}/production-entries?branch=${encodeURIComponent(selectedBranch)}`),
        axios.get(`${API}/skus?branch=${encodeURIComponent(selectedBranch)}`)
      ]);
      setEntries(entriesRes.data);
      setSkus(skusRes.data);
      setFilteredSkus(skusRes.data);
    } catch (error) {
      toast.error("Failed to fetch data");
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
        let url = `${API}/skus/filtered?branch=${encodeURIComponent(selectedBranch)}`;
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
    if (!formData.sku_id) {
      toast.error("Please select a SKU");
      return;
    }
    if (formData.quantity <= 0) {
      toast.error("Please enter a valid quantity");
      return;
    }
    
    try {
      const payload = {
        ...formData,
        branch: selectedBranch,
        date: new Date(formData.date).toISOString()
      };
      await axios.post(`${API}/production-entries`, payload);
      toast.success("Production entry added. Inventory updated.");
      setShowDialog(false);
      setFormData({ sku_id: "", quantity: 0, date: new Date().toISOString().split('T')[0], notes: "" });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to add production entry");
    }
  };

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(entries.map(e => ({
      'Date': new Date(e.date).toLocaleDateString(),
      'SKU ID': e.sku_id,
      'Quantity': e.quantity,
      'Notes': e.notes || ''
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Production');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'production_entries.xlsx');
    toast.success("Exported to Excel");
  };

  const hasActiveFilters = selectedVertical || selectedModel || selectedBrand || searchQuery;

  return (
    <div className="p-6 md:p-8" data-testid="production-page">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight uppercase">Production</h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">
            Record production & auto-consume materials • {selectedBranch}
          </p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="secondary" 
            onClick={handleExport}
            data-testid="export-production-btn"
            className="uppercase text-xs tracking-wide"
          >
            <Download className="w-4 h-4 mr-2" strokeWidth={1.5} />
            Export
          </Button>
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button data-testid="add-production-btn" className="uppercase text-xs tracking-wide">
                <Plus className="w-4 h-4 mr-2" strokeWidth={1.5} />
                Add Production
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="font-bold uppercase">Add Production Entry</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                {/* Cascading Filters */}
                <div className="bg-zinc-50 p-4 rounded-sm border border-zinc-200">
                  <div className="flex items-center gap-2 mb-4">
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
                  
                  <div className="grid grid-cols-3 gap-3">
                    {/* Vertical Filter */}
                    <div>
                      <Label className="text-xs text-zinc-500">Vertical</Label>
                      <select 
                        className="flex h-9 w-full rounded-sm border border-input bg-white px-3 py-1 text-sm font-mono"
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
                        className="flex h-9 w-full rounded-sm border border-input bg-white px-3 py-1 text-sm font-mono disabled:opacity-50"
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
                        className="flex h-9 w-full rounded-sm border border-input bg-white px-3 py-1 text-sm font-mono disabled:opacity-50"
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
                  
                  {/* Search */}
                  <div className="mt-3">
                    <Input 
                      placeholder="Search SKU ID, description..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="font-mono text-sm"
                      data-testid="sku-search-input"
                    />
                  </div>
                  
                  <div className="mt-2 text-xs text-zinc-500 font-mono">
                    {filteredSkus.length} SKUs available
                  </div>
                </div>

                {/* SKU Selection */}
                <div>
                  <Label>SKU *</Label>
                  <select 
                    className="flex h-10 w-full rounded-sm border border-input bg-transparent px-3 py-2 text-sm font-mono"
                    value={formData.sku_id}
                    onChange={(e) => setFormData({...formData, sku_id: e.target.value})}
                    data-testid="production-sku-select"
                  >
                    <option value="">Select SKU ({filteredSkus.length} available)</option>
                    {filteredSkus.map(s => (
                      <option key={s.sku_id} value={s.sku_id}>
                        {s.sku_id} - {s.description || s.buyer_sku_id}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Quantity *</Label>
                    <Input 
                      type="number" 
                      value={formData.quantity} 
                      onChange={(e) => setFormData({...formData, quantity: parseFloat(e.target.value) || 0})}
                      data-testid="production-quantity-input"
                      className="font-mono"
                    />
                  </div>
                  <div>
                    <Label>Date *</Label>
                    <Input 
                      type="date" 
                      value={formData.date} 
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      data-testid="production-date-input"
                    />
                  </div>
                </div>
                
                <div>
                  <Label>Notes</Label>
                  <Input 
                    value={formData.notes} 
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    data-testid="production-notes-input"
                  />
                </div>
                
                <Button onClick={handleSubmit} data-testid="submit-production-btn" className="w-full uppercase text-xs tracking-wide">
                  Add Production
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Table */}
      <div className="border border-border bg-white rounded-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="production-table">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Date</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">SKU ID</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Quantity</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Notes</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-zinc-100 hover:bg-zinc-50/50" data-testid={`production-row-${entry.id}`}>
                  <td className="p-4 align-middle font-mono text-zinc-700">
                    {new Date(entry.date).toLocaleDateString()}
                  </td>
                  <td className="p-4 align-middle font-mono text-zinc-700">{entry.sku_id}</td>
                  <td className="p-4 align-middle font-mono text-zinc-700">{entry.quantity}</td>
                  <td className="p-4 align-middle text-sm text-zinc-600">{entry.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {entries.length === 0 && (
            <div className="p-12 text-center text-muted-foreground font-mono text-sm">
              No production entries yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Production;

import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Upload, Plus, Search, Trash2, Download, Filter, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import useBranchStore from "@/store/branchStore";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const RM_CATEGORIES = {
  "INP": { name: "In-house Plastic", fields: ["mould_code", "model_name", "part_name", "colour", "mb", "per_unit_weight", "unit"] },
  "ACC": { name: "Accessories", fields: ["type", "model_name", "specs", "colour", "per_unit_weight", "unit"] },
  "ELC": { name: "Electric Components", fields: ["model", "type", "specs", "per_unit_weight", "unit"] },
  "SP": { name: "Spares", fields: ["type", "specs", "per_unit_weight", "unit"] },
  "BS": { name: "Brand Assets", fields: ["position", "type", "brand", "buyer_sku", "per_unit_weight", "unit"] },
  "PM": { name: "Packaging", fields: ["model", "type", "specs", "brand", "per_unit_weight", "unit"] },
  "LB": { name: "Labels", fields: ["type", "buyer_sku", "per_unit_weight", "unit"] }
};

const RawMaterials = () => {
  const { selectedBranch } = useBranchStore();
  const [materials, setMaterials] = useState([]);
  const [branchInventory, setBranchInventory] = useState({});
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const fileInputRef = useRef(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 100;

  // Filters
  const [filters, setFilters] = useState({
    search: "",
    category: "",
    type: "",
    model: "",
    colour: "",
    brand: ""
  });
  const [filterOptions, setFilterOptions] = useState({
    categories: [],
    types: [],
    models: [],
    colours: [],
    brands: []
  });
  const [showFilters, setShowFilters] = useState(false);

  const [categoryData, setCategoryData] = useState({});
  const [lowStockThreshold, setLowStockThreshold] = useState(10);

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    fetchMaterials();
  }, [currentPage, filters]);

  useEffect(() => {
    fetchBranchInventory();
  }, [selectedBranch, materials]);

  const fetchFilterOptions = async () => {
    try {
      const response = await axios.get(`${API}/raw-materials/filter-options`);
      setFilterOptions(response.data);
    } catch (error) {
      console.error("Failed to fetch filter options");
    }
  };

  const fetchBranchInventory = async () => {
    if (!selectedBranch || materials.length === 0) return;
    try {
      const response = await axios.get(`${API}/raw-materials?branch=${encodeURIComponent(selectedBranch)}`);
      const inventoryMap = {};
      response.data.forEach(rm => {
        inventoryMap[rm.rm_id] = rm.current_stock || 0;
      });
      setBranchInventory(inventoryMap);
    } catch (error) {
      console.error("Failed to fetch branch inventory");
    }
  };

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', currentPage);
      params.append('page_size', pageSize);
      if (filters.search) params.append('search', filters.search);
      if (filters.category) params.append('category', filters.category);
      if (filters.type) params.append('type_filter', filters.type);
      if (filters.model) params.append('model_filter', filters.model);
      if (filters.colour) params.append('colour_filter', filters.colour);
      if (filters.brand) params.append('brand_filter', filters.brand);

      const response = await axios.get(`${API}/raw-materials/filtered?${params.toString()}`);
      setMaterials(response.data.items);
      setTotalPages(response.data.total_pages);
      setTotalItems(response.data.total);
    } catch (error) {
      toast.error("Failed to fetch raw materials");
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({ search: "", category: "", type: "", model: "", colour: "", brand: "" });
    setCurrentPage(1);
  };

  const activeFilterCount = Object.values(filters).filter(v => v).length;

  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API}/raw-materials/bulk-upload`, formData);
      toast.success(`Uploaded: ${response.data.created} created, ${response.data.skipped} skipped`);
      fetchMaterials();
      fetchFilterOptions();
    } catch (error) {
      toast.error("Upload failed");
    }
  };

  const handleAddRM = async () => {
    if (!selectedCategory) {
      toast.error("Please select a category");
      return;
    }

    try {
      await axios.post(`${API}/raw-materials`, {
        category: selectedCategory,
        category_data: categoryData,
        low_stock_threshold: lowStockThreshold
      });
      toast.success("Raw material added successfully");
      setShowAddDialog(false);
      resetForm();
      fetchMaterials();
      fetchFilterOptions();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to add raw material");
    }
  };

  const handleDelete = async (rmId) => {
    if (!window.confirm(`Delete ${rmId}?`)) return;
    try {
      await axios.delete(`${API}/raw-materials/${rmId}`);
      toast.success("Raw material deleted");
      fetchMaterials();
    } catch (error) {
      toast.error("Failed to delete");
    }
  };

  const resetForm = () => {
    setSelectedCategory("");
    setCategoryData({});
    setLowStockThreshold(10);
  };

  const handleCategoryChange = (cat) => {
    setSelectedCategory(cat);
    setCategoryData({});
  };

  const updateCategoryField = (field, value) => {
    setCategoryData(prev => ({ ...prev, [field]: value }));
  };

  const formatFieldName = (field) => {
    return field.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(materials.map(m => ({
      'RM ID': m.rm_id,
      'Category': m.category,
      ...m.category_data,
      'Threshold': m.low_stock_threshold
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Raw Materials');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'raw_materials.xlsx');
    toast.success("Exported to Excel");
  };

  const downloadCategoryTemplate = (category) => {
    const fields = ['Category', ...RM_CATEGORIES[category].fields, 'Low Stock Threshold'];
    const ws = XLSX.utils.aoa_to_sheet([fields, [category, ...RM_CATEGORIES[category].fields.map(() => ''), 10]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, category);
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `${category}_template.xlsx`);
    toast.success(`Downloaded ${category} template`);
  };

  // Filter dropdown component
  const FilterDropdown = ({ label, value, options, onChange, placeholder }) => {
    const [search, setSearch] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    
    const filteredOptions = options.filter(opt => 
      opt.toLowerCase().includes(search.toLowerCase())
    );

    return (
      <div className="relative">
        <Label className="text-xs uppercase tracking-wider font-bold mb-1 block">{label}</Label>
        <div 
          className="flex h-9 w-full rounded-sm border border-input bg-white px-3 py-2 text-sm cursor-pointer items-center justify-between"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className={value ? "text-zinc-900" : "text-zinc-400"}>
            {value || placeholder}
          </span>
          <ChevronDown className="w-4 h-4 text-zinc-400" />
        </div>
        
        {isOpen && (
          <div className="absolute z-50 mt-1 w-full bg-white border border-zinc-200 rounded-sm shadow-lg max-h-60 overflow-hidden">
            <div className="p-2 border-b">
              <Input
                placeholder="Type to search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-sm"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div className="max-h-40 overflow-y-auto">
              <div 
                className="px-3 py-2 hover:bg-zinc-50 cursor-pointer text-sm text-zinc-500"
                onClick={() => { onChange(""); setIsOpen(false); setSearch(""); }}
              >
                Clear filter
              </div>
              {filteredOptions.map((opt, idx) => (
                <div 
                  key={idx}
                  className={`px-3 py-2 hover:bg-zinc-50 cursor-pointer text-sm ${value === opt ? 'bg-zinc-100 font-medium' : ''}`}
                  onClick={() => { onChange(opt); setIsOpen(false); setSearch(""); }}
                >
                  {opt}
                </div>
              ))}
              {filteredOptions.length === 0 && (
                <div className="px-3 py-2 text-sm text-zinc-400">No matches</div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 md:p-8" data-testid="raw-materials-page">
      <div className="mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight uppercase">Raw Materials</h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">
            Global RM management with auto-generated IDs • {totalItems} total
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={handleExport} className="uppercase text-xs tracking-wide">
            <Download className="w-4 h-4 mr-2" strokeWidth={1.5} />
            Export
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary" className="uppercase text-xs tracking-wide">
                Templates
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="font-bold uppercase">Download Category Templates</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(RM_CATEGORIES).map(([code, info]) => (
                  <Button
                    key={code}
                    variant="outline"
                    onClick={() => downloadCategoryTemplate(code)}
                    className="justify-start text-left h-auto py-3"
                  >
                    <div>
                      <div className="font-mono text-sm font-bold text-primary">{code}</div>
                      <div className="text-xs text-muted-foreground">{info.name}</div>
                    </div>
                  </Button>
                ))}
              </div>
            </DialogContent>
          </Dialog>
          <input type="file" ref={fileInputRef} onChange={handleBulkUpload} accept=".xlsx,.xls" className="hidden" />
          <Button variant="secondary" onClick={() => fileInputRef.current.click()} className="uppercase text-xs tracking-wide">
            <Upload className="w-4 h-4 mr-2" strokeWidth={1.5} />
            Bulk Upload
          </Button>
          <Dialog open={showAddDialog} onOpenChange={(open) => { setShowAddDialog(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="uppercase text-xs tracking-wide">
                <Plus className="w-4 h-4 mr-2" strokeWidth={1.5} />
                Add RM
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-bold uppercase">Add Raw Material</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Category *</Label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="flex h-10 w-full rounded-sm border border-input bg-transparent px-3 py-2 text-sm font-mono"
                  >
                    <option value="">Select Category</option>
                    {Object.entries(RM_CATEGORIES).map(([code, info]) => (
                      <option key={code} value={code}>{code} - {info.name}</option>
                    ))}
                  </select>
                </div>
                {selectedCategory && (
                  <>
                    <div className="border-t border-border pt-4">
                      <Label className="text-base mb-3 block">Category Details</Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {RM_CATEGORIES[selectedCategory].fields.map((field) => (
                          <div key={field}>
                            <Label className="text-xs">{formatFieldName(field)}</Label>
                            <Input
                              value={categoryData[field] || ""}
                              onChange={(e) => updateCategoryField(field, e.target.value)}
                              className="font-mono"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label>Low Stock Threshold</Label>
                      <Input type="number" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(parseFloat(e.target.value))} />
                    </div>
                    <Button onClick={handleAddRM} className="w-full uppercase text-xs tracking-wide">
                      Add Raw Material
                    </Button>
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="mb-6 space-y-4">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
            <Input 
              placeholder="Search by RM ID..." 
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="pl-10 font-mono"
            />
          </div>
          <Button 
            variant={showFilters ? "default" : "outline"}
            onClick={() => setShowFilters(!showFilters)}
            className="uppercase text-xs"
          >
            <Filter className="w-4 h-4 mr-2" strokeWidth={1.5} />
            Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
          </Button>
          {activeFilterCount > 0 && (
            <Button variant="ghost" onClick={clearFilters} className="text-xs">
              <X className="w-4 h-4 mr-1" /> Clear
            </Button>
          )}
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-zinc-50 border border-zinc-200 rounded-sm">
            <FilterDropdown
              label="Category"
              value={filters.category}
              options={filterOptions.categories}
              onChange={(v) => handleFilterChange('category', v)}
              placeholder="All categories"
            />
            <FilterDropdown
              label="Type"
              value={filters.type}
              options={filterOptions.types}
              onChange={(v) => handleFilterChange('type', v)}
              placeholder="All types"
            />
            <FilterDropdown
              label="Model"
              value={filters.model}
              options={filterOptions.models}
              onChange={(v) => handleFilterChange('model', v)}
              placeholder="All models"
            />
            <FilterDropdown
              label="Colour"
              value={filters.colour}
              options={filterOptions.colours}
              onChange={(v) => handleFilterChange('colour', v)}
              placeholder="All colours"
            />
            <FilterDropdown
              label="Brand"
              value={filters.brand}
              options={filterOptions.brands}
              onChange={(v) => handleFilterChange('brand', v)}
              placeholder="All brands"
            />
          </div>
        )}
      </div>

      {/* Table */}
      <div className="border border-border bg-white rounded-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="rm-table">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">RM ID</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Category</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Type</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Model</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Colour</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Branch Inventory</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Safety Stock</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((material) => {
                const currentStock = branchInventory[material.rm_id] || 0;
                const isBelowSafety = currentStock < material.low_stock_threshold;
                return (
                  <tr key={material.id} className="border-b border-zinc-100 hover:bg-zinc-50/50">
                    <td className={`p-4 align-middle font-mono text-sm font-bold ${isBelowSafety ? 'text-red-600' : 'text-zinc-700'}`}>
                      {material.rm_id}
                    </td>
                    <td className="p-4 align-middle">
                      <div className="text-xs font-mono text-primary font-bold">{material.category}</div>
                      <div className="text-xs text-muted-foreground">{RM_CATEGORIES[material.category]?.name}</div>
                    </td>
                    <td className="p-4 align-middle text-xs text-zinc-600 font-mono">
                      {material.category_data?.type || '-'}
                    </td>
                    <td className="p-4 align-middle text-xs text-zinc-600 font-mono">
                      {material.category_data?.model || material.category_data?.model_name || '-'}
                    </td>
                    <td className="p-4 align-middle text-xs text-zinc-600 font-mono">
                      {material.category_data?.colour || '-'}
                    </td>
                    <td className={`p-4 align-middle font-mono ${isBelowSafety ? 'text-red-600 font-bold' : 'text-zinc-700'}`}>
                      {currentStock}
                    </td>
                    <td className="p-4 align-middle font-mono text-zinc-700">{material.low_stock_threshold}</td>
                    <td className="p-4 align-middle">
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(material.rm_id)}>
                        <Trash2 className="w-4 h-4 text-red-600" strokeWidth={1.5} />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {loading && (
            <div className="p-12 text-center text-muted-foreground font-mono text-sm">Loading...</div>
          )}
          {!loading && materials.length === 0 && (
            <div className="p-12 text-center text-muted-foreground font-mono text-sm">
              No raw materials found. Try adjusting filters.
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-zinc-200 flex items-center justify-between">
            <p className="text-sm text-zinc-500 font-mono">
              Page {currentPage} of {totalPages} • {totalItems} items
            </p>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RawMaterials;

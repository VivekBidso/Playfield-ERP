import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Upload, Plus, Search, Trash2, Download, Filter, X, ChevronDown, Database, ArrowUpDown, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import useBranchStore from "@/store/branchStore";
import useAuthStore from "@/store/authStore";

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
  const { hasRole, isMasterAdmin } = useAuthStore();
  const isAdmin = isMasterAdmin();
  const canManageRMs = isAdmin || hasRole('TECH_OPS_ENGINEER'); // Only admin/tech ops can add/edit RMs
  
  const [materials, setMaterials] = useState([]);
  const [branchInventory, setBranchInventory] = useState({});
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showMigrateDialog, setShowMigrateDialog] = useState(false);
  const [showCreatedDialog, setShowCreatedDialog] = useState(false);
  const [createdRMs, setCreatedRMs] = useState([]);
  const [migrating, setMigrating] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const fileInputRef = useRef(null);
  const migrateFileInputRef = useRef(null);

  // Branch filter - explicit dropdown
  const [branches, setBranches] = useState([]);
  const [branchFilter, setBranchFilter] = useState(selectedBranch || "");

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
    fetchBranches();
  }, []);

  useEffect(() => {
    // Initialize branch filter from store if available
    if (selectedBranch && !branchFilter) {
      setBranchFilter(selectedBranch);
    }
  }, [selectedBranch]);

  useEffect(() => {
    fetchMaterials();
  }, [currentPage, filters, branchFilter]);

  useEffect(() => {
    fetchBranchInventory();
  }, [branchFilter, materials]);

  const fetchBranches = async () => {
    try {
      const response = await axios.get(`${API}/branches`);
      const activeOnly = (response.data || []).filter(b => b.is_active !== false);
      setBranches(activeOnly);
    } catch (error) {
      console.error("Failed to fetch branches");
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const response = await axios.get(`${API}/raw-materials/filter-options`);
      setFilterOptions(response.data);
    } catch (error) {
      console.error("Failed to fetch filter options");
    }
  };

  const fetchBranchInventory = async () => {
    if (!branchFilter || materials.length === 0) return;
    try {
      const response = await axios.get(`${API}/raw-materials?branch=${encodeURIComponent(branchFilter)}`);
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
      if (branchFilter) params.append('branch', branchFilter);
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
      const { created, skipped, errors, total_errors, total_duplicates, mode, created_rms } = response.data;
      
      // Check for duplicates (shown as warning, not error - since some items may have been created)
      if (total_duplicates > 0) {
        if (created > 0) {
          toast.success(`Created ${created} RMs. ${total_duplicates} duplicates skipped.`, { duration: 4000 });
          // Show created RMs dialog
          setCreatedRMs(created_rms || []);
          setShowCreatedDialog(true);
        } else {
          const dupList = response.data.duplicates?.slice(0, 5).map(d => d.rm_id).join(", ") || '';
          toast.warning(
            `All ${total_duplicates} RMs already exist. Duplicates: ${dupList}${total_duplicates > 5 ? '...' : ''}`,
            { duration: 8000 }
          );
        }
      } else if (created > 0) {
        const modeText = mode === 'import_with_ids' ? ' (with existing codes)' : ' (new codes generated)';
        toast.success(`Created ${created} raw materials${modeText}`, { duration: 4000 });
        // Show created RMs dialog
        setCreatedRMs(created_rms || []);
        setShowCreatedDialog(true);
      } else if (total_errors > 0) {
        // No items created and there were errors
        const errorMsg = errors?.slice(0, 2).join('; ') || 'Check file format';
        toast.error(`0 RMs created. ${total_errors} errors: ${errorMsg}`, { duration: 10000 });
      } else {
        toast.warning('No data found in file. Ensure file has data rows with RM Code or Category column.');
      }
      
      fetchMaterials();
      fetchFilterOptions();
    } catch (error) {
      const errData = error.response?.data;
      toast.error(errData?.detail || errData?.message || "Upload failed - check file format", { duration: 8000 });
    }
    
    // Reset file input
    e.target.value = null;
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

  const handleExport = async () => {
    try {
      toast.info("Preparing export...");
      const params = new URLSearchParams();
      // Pass branch filter - if empty, exports all branches with Branch ID column
      if (branchFilter) params.append('branch', branchFilter);
      if (filters.search) params.append('search', filters.search);
      if (filters.category) params.append('category', filters.category);
      if (filters.type) params.append('type_filter', filters.type);
      if (filters.model) params.append('model_filter', filters.model);
      if (filters.colour) params.append('colour_filter', filters.colour);
      if (filters.brand) params.append('brand_filter', filters.brand);

      const response = await axios.get(`${API}/raw-materials/export?${params.toString()}`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const filename = response.headers['content-disposition']?.split('filename=')[1] || 'raw_materials_export.xlsx';
      saveAs(blob, filename);
      
      if (branchFilter) {
        toast.success(`Exported ${totalItems} RMs for ${branchFilter}`);
      } else {
        toast.success(`Exported RMs across all branches`);
      }
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export raw materials");
    }
  };

  // Data Migration Functions
  const handleMigrateExport = async () => {
    setMigrating(true);
    try {
      toast.info("Preparing migration export...");
      const response = await axios.get(`${API}/raw-materials/migrate/export`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'application/json' });
      const filename = response.headers['content-disposition']?.split('filename=')[1] || 'rm_migration_export.json';
      saveAs(blob, filename);
      toast.success(`Migration file downloaded with ${totalItems} raw materials`);
    } catch (error) {
      console.error("Migration export failed:", error);
      toast.error("Failed to export migration data");
    }
    setMigrating(false);
  };

  const handleMigrateImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.name.endsWith('.json')) {
      toast.error('Please upload a JSON file (exported from migration)');
      e.target.value = null;
      return;
    }
    
    setMigrating(true);
    toast.info(`Importing ${file.name}... This may take a moment.`);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post(`${API}/raw-materials/migrate/import`, formData, {
        timeout: 120000 // 2 minute timeout for large files
      });
      
      const { results, totals, message, success } = response.data;
      
      if (success === false) {
        toast.error(message || 'Import failed - check file format');
      } else if (results.raw_materials.imported > 0) {
        toast.success(
          `Import complete! ${results.raw_materials.imported} RMs added, ${results.raw_materials.skipped} duplicates skipped. Total: ${totals.raw_materials}`,
          { duration: 8000 }
        );
        fetchMaterials();
        setShowMigrateDialog(false);
      } else if (results.raw_materials.skipped > 0) {
        toast.warning(
          `All ${results.raw_materials.skipped} RMs already exist in database. No new items imported.`,
          { duration: 6000 }
        );
      } else {
        toast.warning(message || 'No items were imported. Check the file format.');
      }
      
      // Show any errors
      if (results.raw_materials.errors?.length > 0) {
        console.error('Import errors:', results.raw_materials.errors);
      }
      
    } catch (error) {
      console.error("Migration import failed:", error);
      const errMsg = error.response?.data?.detail || error.response?.data?.message || error.message || "Failed to import";
      toast.error(`Import failed: ${errMsg}`, { duration: 8000 });
    }
    setMigrating(false);
    e.target.value = null;
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
          <h1 className="text-4xl font-black tracking-tight uppercase">RM Stock View</h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">
            Branch inventory levels • {branchFilter || "All Branches"} • {totalItems} items
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {/* Branch Filter Dropdown */}
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <Select 
              value={branchFilter || "_all"} 
              onValueChange={(v) => {
                setBranchFilter(v === "_all" ? "" : v);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[200px]" data-testid="branch-filter">
                <SelectValue placeholder="All Branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All Branches</SelectItem>
                {branches.map(b => (
                  <SelectItem key={b.name} value={b.name}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="secondary" onClick={handleExport} className="uppercase text-xs tracking-wide" data-testid="export-btn">
            <Download className="w-4 h-4 mr-2" strokeWidth={1.5} />
            Export {branchFilter ? branchFilter : "All"}
          </Button>
          
          {/* Add RM & Bulk Upload - Only for Tech Ops / Admin */}
          {canManageRMs && (
            <>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleBulkUpload}
                accept=".xlsx,.xls"
                className="hidden"
                data-testid="bulk-upload-input"
              />
              <Button 
                variant="outline" 
                onClick={() => fileInputRef.current?.click()}
                className="uppercase text-xs tracking-wide"
                data-testid="bulk-upload-btn"
              >
                <Upload className="w-4 h-4 mr-2" strokeWidth={1.5} />
                Bulk Upload
              </Button>
              <Button 
                onClick={() => setShowAddDialog(true)}
                className="uppercase text-xs tracking-wide"
                data-testid="add-rm-btn"
              >
                <Plus className="w-4 h-4 mr-2" strokeWidth={1.5} />
                Add RM
              </Button>
            </>
          )}
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

      {/* Add RM Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Raw Material</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Category *</Label>
              <Select 
                value={selectedCategory || undefined} 
                onValueChange={setSelectedCategory}
              >
                <SelectTrigger data-testid="category-select">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RM_CATEGORIES).map(([code, cat]) => (
                    <SelectItem key={code} value={code}>{code} - {cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {selectedCategory && (
              <>
                <div className="p-3 bg-zinc-50 border rounded-sm">
                  <p className="text-sm font-medium mb-2">Required fields for {selectedCategory}:</p>
                  <div className="flex flex-wrap gap-2">
                    {RM_CATEGORIES[selectedCategory]?.fields.map(field => (
                      <span key={field} className="text-xs bg-zinc-200 px-2 py-1 rounded">{field}</span>
                    ))}
                  </div>
                </div>
                
                {RM_CATEGORIES[selectedCategory]?.fields.map(field => (
                  <div key={field}>
                    <Label className="capitalize">{field.replace(/_/g, ' ')}</Label>
                    <Input
                      placeholder={`Enter ${field.replace(/_/g, ' ')}`}
                      value={categoryData[field] || ''}
                      onChange={(e) => setCategoryData({...categoryData, [field]: e.target.value})}
                    />
                  </div>
                ))}
                
                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={() => downloadCategoryTemplate(selectedCategory)}>
                    <Download className="w-4 h-4 mr-2" />
                    Download Template
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => { setShowAddDialog(false); setSelectedCategory(''); setCategoryData({}); }}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddRM} data-testid="save-rm-btn">
                      Create RM
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Created RMs Dialog - Shows after successful bulk upload */}
      <Dialog open={showCreatedDialog} onOpenChange={setShowCreatedDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Created Raw Materials</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {createdRMs.length} new RMs created successfully
            </p>
            <div className="border rounded-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="p-2 text-left font-bold">RM ID</th>
                    <th className="p-2 text-left font-bold">Category</th>
                    <th className="p-2 text-left font-bold">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {createdRMs.map((rm, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-2 font-mono">{rm.rm_id}</td>
                      <td className="p-2">{rm.category}</td>
                      <td className="p-2 text-muted-foreground">
                        {Object.entries(rm.category_data || {}).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setShowCreatedDialog(false)}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Migration Dialog */}
      <Dialog open={showMigrateDialog} onOpenChange={setShowMigrateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Migrate RM Data</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Import RM data from a JSON export file. This is used for migrating data between environments.
            </p>
            <input
              type="file"
              ref={migrateFileInputRef}
              onChange={handleMigrateImport}
              accept=".json"
              className="hidden"
            />
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => migrateFileInputRef.current?.click()}
                disabled={migrating}
                className="flex-1"
              >
                <Database className="w-4 h-4 mr-2" />
                {migrating ? "Importing..." : "Select JSON File"}
              </Button>
              <Button variant="outline" onClick={() => setShowMigrateDialog(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RawMaterials;

import { useState, useEffect } from "react";
import axios from "axios";
import { Search, Download, Filter, X, ChevronDown, ArrowUpDown, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

// Simple category name lookup for display
const RM_CATEGORY_NAMES = {
  "INP": "In-house Plastic",
  "ACC": "Accessories",
  "ELC": "Electric Components",
  "SP": "Spares",
  "BS": "Brand Assets",
  "PM": "Packaging",
  "LB": "Labels",
  "INM": "Input Materials",
  "STK": "Stickers",
  "POLY": "Polymer Grades",
  "MB": "Master Batch",
  "PWD": "Powder Coating",
  "PIPE": "Metal Pipes"
};

const RawMaterials = () => {
  const { selectedBranch } = useBranchStore();
  const { hasRole, isMasterAdmin } = useAuthStore();
  const isAdmin = isMasterAdmin();
  
  const [materials, setMaterials] = useState([]);
  const [branchInventory, setBranchInventory] = useState({});
  const [loading, setLoading] = useState(false);

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
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Description</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Branch Inventory</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Safety Stock</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((material) => {
                const currentStock = material.branch_stock ?? branchInventory[material.rm_id] ?? 0;
                const isBelowSafety = currentStock < material.low_stock_threshold;
                return (
                  <tr key={material.id} className="border-b border-zinc-100 hover:bg-zinc-50/50">
                    <td className={`p-4 align-middle font-mono text-sm font-bold ${isBelowSafety ? 'text-red-600' : 'text-zinc-700'}`}>
                      {material.rm_id}
                    </td>
                    <td className="p-4 align-middle">
                      <div className="text-xs font-mono text-primary font-bold">{material.category}</div>
                      <div className="text-xs text-muted-foreground">{RM_CATEGORY_NAMES[material.category] || material.category}</div>
                    </td>
                    <td className="p-4 align-middle text-sm text-zinc-700 max-w-[300px]">
                      <span className="truncate block" title={material.description || material.category_data?.name || '-'}>
                        {material.description || material.category_data?.name || '-'}
                      </span>
                    </td>
                    <td className={`p-4 align-middle font-mono ${isBelowSafety ? 'text-red-600 font-bold' : 'text-zinc-700'}`}>
                      {currentStock}
                    </td>
                    <td className="p-4 align-middle font-mono text-zinc-700">{material.low_stock_threshold}</td>
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

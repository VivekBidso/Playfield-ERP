import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Upload, Plus, Search, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const RM_CATEGORIES = {
  "INP": { 
    name: "In-house Plastic", 
    fields: ["mould_code", "model_name", "part_name", "colour", "mb", "per_unit_weight", "unit"]
  },
  "ACC": { 
    name: "Accessories", 
    fields: ["type", "model_name", "specs", "colour", "per_unit_weight", "unit"]
  },
  "ELC": { 
    name: "Electric Components", 
    fields: ["model", "type", "specs", "per_unit_weight", "unit"]
  },
  "SP": { 
    name: "Spares", 
    fields: ["type", "specs", "per_unit_weight", "unit"]
  },
  "BS": { 
    name: "Brand Assets", 
    fields: ["position", "type", "brand", "buyer_sku", "per_unit_weight", "unit"]
  },
  "PM": { 
    name: "Packaging", 
    fields: ["model", "type", "specs", "brand", "per_unit_weight", "unit"]
  },
  "LB": { 
    name: "Labels", 
    fields: ["type", "buyer_sku", "per_unit_weight", "unit"]
  }
};

const RawMaterials = () => {
  const [materials, setMaterials] = useState([]);
  const [filteredMaterials, setFilteredMaterials] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const fileInputRef = useRef(null);

  const [categoryData, setCategoryData] = useState({});
  const [lowStockThreshold, setLowStockThreshold] = useState(10);

  useEffect(() => {
    fetchMaterials();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const filtered = materials.filter(m => 
        m.rm_id.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredMaterials(filtered);
    } else {
      setFilteredMaterials(materials);
    }
  }, [searchQuery, materials]);

  const fetchMaterials = async () => {
    try {
      const response = await axios.get(`${API}/raw-materials`);
      setMaterials(response.data);
      setFilteredMaterials(response.data);
    } catch (error) {
      toast.error("Failed to fetch raw materials");
    }
  };

  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API}/raw-materials/bulk-upload`, formData);
      toast.success(`Uploaded: ${response.data.created} created, ${response.data.skipped} skipped`);
      if (response.data.errors.length > 0) {
        console.error('Upload errors:', response.data.errors);
      }
      fetchMaterials();
    } catch (error) {
      toast.error("Upload failed");
    }
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
      toast.success("Raw material added with auto-generated ID");
      setShowAddDialog(false);
      resetForm();
      fetchMaterials();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to add raw material");
    }
  };

  const resetForm = () => {
    setSelectedCategory("");
    setCategoryData({});
    setLowStockThreshold(10);
  };

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    const fields = RM_CATEGORIES[category].fields;
    const initialData = {};
    fields.forEach(field => {
      initialData[field] = "";
    });
    setCategoryData(initialData);
  };

  const updateCategoryField = (field, value) => {
    setCategoryData({...categoryData, [field]: value});
  };

  const handleDelete = async (rm_id) => {
    if (!window.confirm('Are you sure you want to delete this raw material?')) return;
    try {
      await axios.delete(`${API}/raw-materials/${rm_id}`);
      toast.success("Raw material deleted");
      fetchMaterials();
    } catch (error) {
      toast.error("Failed to delete");
    }
  };

  const downloadCategoryTemplate = (category) => {
    const categoryInfo = RM_CATEGORIES[category];
    const headers = ["Category", ...categoryInfo.fields, "low_stock_threshold"];
    const sampleRow = [category, ...categoryInfo.fields.map(() => "sample_value"), 10];
    
    const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, categoryInfo.name);
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(
      new Blob([wbout], { type: 'application/octet-stream' }), 
      `rm_template_${category}_${categoryInfo.name.replace(/\s+/g, '_')}.xlsx`
    );
  };

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(materials.map(m => ({
      'RM ID': m.rm_id,
      'Category': m.category,
      'Low Stock Threshold': m.low_stock_threshold
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Raw Materials');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'raw_materials.xlsx');
    toast.success("Exported to Excel");
  };

  const formatFieldName = (field) => {
    return field.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <div className="p-6 md:p-8" data-testid="raw-materials-page">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight uppercase">Raw Materials</h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">Global RM management with auto-generated IDs</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="secondary" 
            onClick={handleExport}
            data-testid="export-rm-btn"
            className="uppercase text-xs tracking-wide"
          >
            <Download className="w-4 h-4 mr-2" strokeWidth={1.5} />
            Export
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button 
                variant="secondary"
                data-testid="templates-btn"
                className="uppercase text-xs tracking-wide"
              >
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
                    data-testid={`template-${code}`}
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
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleBulkUpload} 
            accept=".xlsx,.xls"
            className="hidden"
          />
          <Button 
            variant="secondary" 
            onClick={() => fileInputRef.current.click()}
            data-testid="bulk-upload-btn"
            className="uppercase text-xs tracking-wide"
          >
            <Upload className="w-4 h-4 mr-2" strokeWidth={1.5} />
            Bulk Upload
          </Button>
          <Dialog open={showAddDialog} onOpenChange={(open) => {
            setShowAddDialog(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button data-testid="add-rm-btn" className="uppercase text-xs tracking-wide">
                <Plus className="w-4 h-4 mr-2" strokeWidth={1.5} />
                Add RM
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-bold uppercase">Add Raw Material</DialogTitle>
                <p className="text-xs text-muted-foreground font-mono">RM ID will be auto-generated</p>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Category *</Label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="flex h-10 w-full rounded-sm border border-input bg-transparent px-3 py-2 text-sm font-mono"
                    data-testid="rm-category-select"
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
                              data-testid={`rm-field-${field}`}
                              className="font-mono"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label>Low Stock Threshold</Label>
                      <Input 
                        type="number" 
                        value={lowStockThreshold} 
                        onChange={(e) => setLowStockThreshold(parseFloat(e.target.value))}
                        data-testid="rm-threshold-input"
                      />
                    </div>

                    <Button 
                      onClick={handleAddRM} 
                      data-testid="submit-rm-btn" 
                      className="w-full uppercase text-xs tracking-wide"
                    >
                      Add Raw Material
                    </Button>
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
          <Input 
            placeholder="Search by RM ID..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="search-rm-input"
            className="pl-10 font-mono"
          />
        </div>
      </div>

      {/* Table */}
      <div className="border border-border bg-white rounded-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="rm-table">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">RM ID</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Category</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Details</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Threshold</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMaterials.map((material) => (
                <tr key={material.id} className="border-b border-zinc-100 hover:bg-zinc-50/50" data-testid={`rm-row-${material.rm_id}`}>
                  <td className="p-4 align-middle font-mono text-sm font-bold text-zinc-700">{material.rm_id}</td>
                  <td className="p-4 align-middle">
                    <div className="text-xs font-mono text-primary font-bold">{material.category}</div>
                    <div className="text-xs text-muted-foreground">{RM_CATEGORIES[material.category]?.name}</div>
                  </td>
                  <td className="p-4 align-middle text-xs text-zinc-600">
                    {Object.entries(material.category_data || {}).slice(0, 3).map(([key, value]) => (
                      <div key={key} className="font-mono">{key}: {value}</div>
                    ))}
                  </td>
                  <td className="p-4 align-middle font-mono text-zinc-700">{material.low_stock_threshold}</td>
                  <td className="p-4 align-middle">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleDelete(material.rm_id)}
                      data-testid={`delete-rm-${material.rm_id}`}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" strokeWidth={1.5} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredMaterials.length === 0 && (
            <div className="p-12 text-center text-muted-foreground font-mono text-sm">
              No raw materials found. Upload or add manually.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RawMaterials;

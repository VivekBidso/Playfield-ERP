import { useState, useEffect, useRef } from "react";
import axios from "axios";
import useAuthStore from "@/store/authStore";
import { 
  Package, Plus, Search, Clock, CheckCircle, XCircle, 
  Tag, Box, FileText, ChevronRight, AlertCircle, Layers,
  Upload, Paperclip, Trash2, Download, File, Copy, Eye, RefreshCw
} from "lucide-react";
import CloneBidsoSKU from "@/components/CloneBidsoSKU";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Categories that support artwork file uploads
const ARTWORK_CATEGORIES = ["LB", "BS", "PM"];

// Default fallback categories (used only if API fails)
const DEFAULT_RM_CATEGORIES = {
  "LB": { 
    name: "Labels", 
    description: "Product labels and stickers",
    nameFormat: ["type", "buyer_sku"],
    fields: [
      { key: "type", label: "Type", required: true, placeholder: "e.g., Main Label, Warning Label" },
      { key: "buyer_sku", label: "Buyer SKU", required: true, placeholder: "e.g., BE_KS_PE_001" },
      { key: "per_unit_weight", label: "Weight (grams)", required: false, placeholder: "e.g., 5", type: "number" },
      { key: "unit", label: "Unit", required: false, placeholder: "e.g., pcs, sheets" }
    ]
  },
  "PM": { 
    name: "Packaging", 
    description: "Boxes, cartons, packaging materials",
    nameFormat: ["model", "type", "specs", "brand"],
    fields: [
      { key: "model", label: "Model", required: true, placeholder: "e.g., Kids Scooter Box" },
      { key: "type", label: "Type", required: true, placeholder: "e.g., Inner Box, Outer Carton" },
      { key: "specs", label: "Specifications", required: true, placeholder: "e.g., 45x30x20 cm, 5-ply" },
      { key: "brand", label: "Brand", required: true, placeholder: "e.g., Baybee, Firstcry" },
      { key: "per_unit_weight", label: "Weight (grams)", required: false, placeholder: "e.g., 500", type: "number" },
      { key: "unit", label: "Unit", required: false, placeholder: "e.g., pcs" }
    ]
  },
  "BS": { 
    name: "Brand Assets", 
    description: "Brand-specific inserts, manuals, etc.",
    nameFormat: ["position", "type", "brand", "buyer_sku"],
    fields: [
      { key: "position", label: "Position/Location", required: true, placeholder: "e.g., Inside Box, On Product" },
      { key: "type", label: "Type", required: true, placeholder: "e.g., Manual, Warranty Card, Insert" },
      { key: "brand", label: "Brand", required: true, placeholder: "e.g., Baybee" },
      { key: "buyer_sku", label: "Buyer SKU", required: true, placeholder: "e.g., BE_KS_PE_001" },
      { key: "per_unit_weight", label: "Weight (grams)", required: false, placeholder: "e.g., 20", type: "number" },
      { key: "unit", label: "Unit", required: false, placeholder: "e.g., pcs" }
    ]
  }
};

// Helper to convert database category to frontend format
const convertDbCategoryForDemandHub = (dbCat) => {
  const fields = (dbCat.description_columns || []).map(col => ({
    key: col.key,
    label: col.label || col.key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    required: col.required || false,
    placeholder: col.placeholder || `Enter ${col.label || col.key}`,
    type: col.type || 'text'
  }));
  
  const nameFormat = (dbCat.description_columns || [])
    .filter(col => col.include_in_name)
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map(col => col.key);
  
  return {
    name: dbCat.name,
    description: dbCat.description || "",
    nameFormat: nameFormat,
    fields: fields,
    default_uom: dbCat.default_uom,
    rm_id_prefix: dbCat.rm_id_prefix
  };
};

// Generate RM name from category_data based on nomenclature
const generateRmName = (category, categoryData, rmCategories) => {
  const config = rmCategories[category];
  if (!config || !config.nameFormat || config.nameFormat.length === 0) return "";
  
  const parts = config.nameFormat
    .map(key => categoryData[key] || "")
    .filter(val => val.trim() !== "");
  
  return parts.join("_");
};

const DemandHub = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState("buyer-sku");
  
  // Data
  const [summary, setSummary] = useState({ total_pending: 0, total_approved: 0 });
  const [myRequests, setMyRequests] = useState([]);
  const [bidsoSkus, setBidsoSkus] = useState([]);
  const [brands, setBrands] = useState([]);
  const [verticals, setVerticals] = useState([]);
  const [models, setModels] = useState([]);
  const [rmCategoriesMap, setRmCategoriesMap] = useState(DEFAULT_RM_CATEGORIES);
  const [rmCategoriesList, setRmCategoriesList] = useState([]);
  
  // Loading
  const [loading, setLoading] = useState(false);
  
  // Filters for Bidso SKU lookup
  const [skuFilters, setSkuFilters] = useState({
    vertical_id: "",
    model_id: "",
    search: ""
  });
  
  // Selected Bidso SKU for Buyer SKU request
  const [selectedBidso, setSelectedBidso] = useState(null);
  const [existingBuyerSkus, setExistingBuyerSkus] = useState({ existing: [], pending_requests: [] });
  
  // Buyer SKU Request Form
  const [buyerSkuForm, setBuyerSkuForm] = useState({
    bidso_sku_id: "",
    brand_id: "",
    notes: ""
  });
  
  // RM Request Form
  const [rmForm, setRmForm] = useState({
    category: "LB",
    description: "",
    brand_ids: [],
    category_data: {},
    artwork_files: []  // Array of uploaded file references
  });
  
  // File upload state
  const fileInputRef = useRef(null);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  
  // Buyer SKU search for RM form
  const [buyerSkuSearch, setBuyerSkuSearch] = useState([]);
  
  // Dialogs
  const [showBuyerSkuDialog, setShowBuyerSkuDialog] = useState(false);
  const [showRmDialog, setShowRmDialog] = useState(false);
  
  // Clone request detail view
  const [showCloneDetailDialog, setShowCloneDetailDialog] = useState(false);
  const [selectedCloneRequest, setSelectedCloneRequest] = useState(null);
  
  // Resubmit clone request
  const [resubmitSourceRequest, setResubmitSourceRequest] = useState(null);

  useEffect(() => {
    fetchMasterData();
    fetchSummary();
    fetchMyRequests();
  }, []);

  useEffect(() => {
    if (activeTab === "buyer-sku") {
      fetchBidsoSkus();
    }
  }, [activeTab, skuFilters]);

  const fetchMasterData = async () => {
    try {
      const [brandsRes, verticalsRes, modelsRes, categoriesRes] = await Promise.all([
        axios.get(`${API}/brands`),
        axios.get(`${API}/verticals`),
        axios.get(`${API}/models`),
        axios.get(`${API}/rm-categories`)
      ]);
      setBrands(brandsRes.data.filter(b => b.status === 'ACTIVE'));
      setVerticals(verticalsRes.data.filter(v => v.status === 'ACTIVE'));
      setModels(modelsRes.data.filter(m => m.status === 'ACTIVE'));
      
      // API returns categories in format: {code: {name, fields: string[], nameFormat: string[]}}
      const dbCategories = categoriesRes.data || {};
      
      // Enrich categories with detailed field objects for forms
      const enrichedCategories = {};
      Object.entries(dbCategories).forEach(([code, config]) => {
        enrichedCategories[code] = {
          name: config.name,
          nameFormat: config.nameFormat || [],
          // Convert string fields to field objects
          fields: (config.fields || []).map(fieldKey => {
            // Check if we have a detailed definition in defaults
            const defaultField = DEFAULT_RM_CATEGORIES[code]?.fields?.find(f => f.key === fieldKey);
            if (defaultField) {
              return defaultField;
            }
            // Create basic field object from string
            return {
              key: fieldKey,
              label: fieldKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
              required: config.nameFormat?.includes(fieldKey) || false,
              placeholder: `Enter ${fieldKey.replace(/_/g, ' ')}`,
              type: fieldKey.includes('weight') || fieldKey.includes('qty') ? 'number' : 'text'
            };
          })
        };
      });
      
      // Store as list for dropdowns
      const categoriesList = Object.entries(enrichedCategories).map(([code, config]) => ({
        code,
        name: config.name,
        description: config.description || DEFAULT_RM_CATEGORIES[code]?.description || '',
        fields: config.fields,
        nameFormat: config.nameFormat
      }));
      setRmCategoriesList(categoriesList);
      
      // Merge with defaults to ensure critical categories are available
      setRmCategoriesMap({ ...DEFAULT_RM_CATEGORIES, ...enrichedCategories });
    } catch (error) {
      console.error("Failed to fetch master data:", error);
      setRmCategoriesMap(DEFAULT_RM_CATEGORIES);
      // Also set the list from defaults so the UI has data
      const defaultList = Object.entries(DEFAULT_RM_CATEGORIES).map(([code, config]) => ({
        code,
        name: config.name,
        description: config.description || '',
        fields: config.fields,
        nameFormat: config.nameFormat
      }));
      setRmCategoriesList(defaultList);
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await axios.get(`${API}/demand-hub/my-requests/summary`);
      setSummary(res.data);
    } catch (error) {
      console.error("Failed to fetch summary");
    }
  };

  const fetchMyRequests = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/demand-hub/my-requests`);
      setMyRequests(res.data);
    } catch (error) {
      toast.error("Failed to fetch requests");
    } finally {
      setLoading(false);
    }
  };

  const fetchBidsoSkus = async () => {
    try {
      let url = `${API}/demand-hub/bidso-skus?`;
      if (skuFilters.vertical_id) url += `vertical_id=${skuFilters.vertical_id}&`;
      if (skuFilters.model_id) url += `model_id=${skuFilters.model_id}&`;
      if (skuFilters.search) url += `search=${encodeURIComponent(skuFilters.search)}&`;
      
      const res = await axios.get(url);
      // Handle paginated response
      const data = res.data;
      setBidsoSkus(data.items || data || []);
    } catch (error) {
      console.error("Failed to fetch Bidso SKUs");
      setBidsoSkus([]);
    }
  };

  const handleViewCloneRequest = async (request) => {
    try {
      const res = await axios.get(`${API}/demand-hub/bidso-clone-requests/${request.id}`);
      setSelectedCloneRequest(res.data);
      setShowCloneDetailDialog(true);
    } catch (error) {
      toast.error("Failed to load request details");
    }
  };

  const handleResubmitClone = (request) => {
    // Set the source request for resubmission
    setResubmitSourceRequest(request);
    setShowCloneDetailDialog(false);
    // Switch to clone tab with the pre-filled data
    setActiveTab("clone-sku");
    toast.info("Edit the clone request and submit again");
  };

  const handleSelectBidsoSku = async (sku) => {
    setSelectedBidso(sku);
    setBuyerSkuForm({ ...buyerSkuForm, bidso_sku_id: sku.bidso_sku_id });
    
    // Fetch existing Buyer SKUs for this Bidso SKU
    try {
      const res = await axios.get(`${API}/demand-hub/existing-buyer-skus/${sku.bidso_sku_id}`);
      setExistingBuyerSkus(res.data);
    } catch (error) {
      setExistingBuyerSkus({ existing: [], pending_requests: [] });
    }
  };

  const handleCreateBuyerSkuRequest = async () => {
    if (!buyerSkuForm.bidso_sku_id || !buyerSkuForm.brand_id) {
      toast.error("Please select a Bidso SKU and Brand");
      return;
    }
    
    try {
      const res = await axios.post(`${API}/demand-hub/buyer-sku-requests`, buyerSkuForm);
      toast.success(`Request created for ${res.data.buyer_sku_id}`);
      setShowBuyerSkuDialog(false);
      setBuyerSkuForm({ bidso_sku_id: "", brand_id: "", notes: "" });
      setSelectedBidso(null);
      fetchSummary();
      fetchMyRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create request");
    }
  };

  const handleCreateRmRequest = async () => {
    // Validate required fields
    const categoryConfig = rmCategoriesMap[rmForm.category];
    const missingFields = [];
    
    if (rmForm.brand_ids.length === 0) missingFields.push("Brands");
    
    // Check category-specific required fields
    categoryConfig.fields.forEach(field => {
      if (field.required && !rmForm.category_data[field.key]) {
        missingFields.push(field.label);
      }
    });
    
    if (missingFields.length > 0) {
      toast.error(`Please fill required fields: ${missingFields.join(", ")}`);
      return;
    }
    
    // Auto-generate RM name from category_data based on nomenclature
    const generatedName = generateRmName(rmForm.category, rmForm.category_data, rmCategoriesMap);
    
    if (!generatedName) {
      toast.error("Could not generate RM name. Please fill all required fields.");
      return;
    }
    
    try {
      await axios.post(`${API}/rm-requests`, {
        ...rmForm,
        requested_name: generatedName,
        category_data: rmForm.category_data,
        artwork_files: rmForm.artwork_files
      });
      toast.success("RM request created");
      setShowRmDialog(false);
      setRmForm({ category: "LB", description: "", brand_ids: [], category_data: {}, artwork_files: [] });
      fetchSummary();
      fetchMyRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create request");
    }
  };

  const handleRmCategoryChange = (newCategory) => {
    setRmForm({ 
      ...rmForm, 
      category: newCategory,
      category_data: {}, // Reset category data when category changes
      artwork_files: []  // Reset artwork files when category changes
    });
  };

  const updateCategoryData = (key, value) => {
    setRmForm({
      ...rmForm,
      category_data: {
        ...rmForm.category_data,
        [key]: value
      }
    });
  };

  // File upload handlers
  const handleFileUpload = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const allowedExtensions = ['.ai', '.pdf', '.cdr', '.eps', '.svg', '.psd'];
    const validFiles = Array.from(files).filter(file => {
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      return allowedExtensions.includes(ext);
    });
    
    if (validFiles.length === 0) {
      toast.error(`Invalid file type. Allowed: ${allowedExtensions.join(', ')}`);
      return;
    }
    
    setUploadingFiles(true);
    
    try {
      const formData = new FormData();
      validFiles.forEach(file => formData.append('files', file));
      
      const res = await axios.post(`${API}/uploads/rm-artwork`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (res.data.uploaded && res.data.uploaded.length > 0) {
        setRmForm({
          ...rmForm,
          artwork_files: [...rmForm.artwork_files, ...res.data.uploaded]
        });
        toast.success(`${res.data.uploaded.length} file(s) uploaded`);
      }
      
      if (res.data.errors && res.data.errors.length > 0) {
        res.data.errors.forEach(err => toast.error(`${err.filename}: ${err.error}`));
      }
    } catch (error) {
      toast.error("Failed to upload files");
    } finally {
      setUploadingFiles(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveFile = async (storedName) => {
    try {
      await axios.delete(`${API}/uploads/rm-artwork/${storedName}`);
      setRmForm({
        ...rmForm,
        artwork_files: rmForm.artwork_files.filter(f => f.stored_name !== storedName)
      });
      toast.success("File removed");
    } catch (error) {
      toast.error("Failed to remove file");
    }
  };

  const getFileIcon = (fileType) => {
    switch (fileType) {
      case 'PDF': return <FileText className="h-4 w-4 text-red-500" />;
      case 'AI': return <File className="h-4 w-4 text-orange-500" />;
      case 'CDR': return <File className="h-4 w-4 text-green-500" />;
      default: return <File className="h-4 w-4 text-gray-500" />;
    }
  };

  const getFilteredModels = () => {
    if (!skuFilters.vertical_id) return models;
    return models.filter(m => m.vertical_id === skuFilters.vertical_id);
  };

  const getBrandName = (id) => brands.find(b => b.id === id)?.name || id;
  const getBrandCode = (id) => brands.find(b => b.id === id)?.code || "";

  // Check if brand already has a Buyer SKU or pending request
  const isBrandTaken = (brandId) => {
    const existing = existingBuyerSkus.existing.some(s => s.brand_id === brandId);
    const pending = existingBuyerSkus.pending_requests.some(r => r.brand_id === brandId);
    return existing || pending;
  };

  return (
    <div className="p-6 space-y-6" data-testid="demand-hub-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Demand Hub</h1>
          <p className="text-gray-500 mt-1">Request new Buyer SKUs and Raw Materials</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Pending Requests</p>
                <p className="text-2xl font-bold">{summary.total_pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Approved</p>
                <p className="text-2xl font-bold">{summary.total_approved}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Box className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">SKU Requests</p>
                <p className="text-2xl font-bold">{summary.buyer_sku_requests?.total || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Tag className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">RM Requests</p>
                <p className="text-2xl font-bold">{summary.rm_requests?.total || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="buyer-sku" data-testid="buyer-sku-tab">
            <Box className="h-4 w-4 mr-2" />
            Request Buyer SKU
          </TabsTrigger>
          <TabsTrigger value="rm-request" data-testid="rm-request-tab">
            <Tag className="h-4 w-4 mr-2" />
            Request RM
          </TabsTrigger>
          <TabsTrigger value="clone-sku" data-testid="clone-sku-tab">
            <Copy className="h-4 w-4 mr-2" />
            Clone Bidso SKU
          </TabsTrigger>
          <TabsTrigger value="my-requests" data-testid="my-requests-tab">
            <FileText className="h-4 w-4 mr-2" />
            My Requests
            {summary.total_pending > 0 && (
              <Badge className="ml-2 bg-orange-500">{summary.total_pending}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Request Buyer SKU Tab */}
        <TabsContent value="buyer-sku" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Request New Buyer SKU</CardTitle>
              <CardDescription>
                Select a base product (Bidso SKU) and a brand to create a new branded variant.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-4 items-end">
                <div className="w-[200px]">
                  <Label className="text-xs text-gray-500">Vertical</Label>
                  <Select 
                    value={skuFilters.vertical_id} 
                    onValueChange={(v) => setSkuFilters({ ...skuFilters, vertical_id: v === "all" ? "" : v, model_id: "" })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Verticals" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Verticals</SelectItem>
                      {verticals.filter(v => v.id).map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.code} - {v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="w-[200px]">
                  <Label className="text-xs text-gray-500">Model</Label>
                  <Select 
                    value={skuFilters.model_id || "all"} 
                    onValueChange={(v) => setSkuFilters({ ...skuFilters, model_id: v === "all" ? "" : v })}
                    disabled={!skuFilters.vertical_id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Models" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Models</SelectItem>
                      {getFilteredModels().filter(m => m.id).map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.code} - {m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex-1 min-w-[200px]">
                  <Label className="text-xs text-gray-500">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search Bidso SKU..."
                      value={skuFilters.search}
                      onChange={(e) => setSkuFilters({ ...skuFilters, search: e.target.value })}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              {/* Bidso SKU Table */}
              <div className="border rounded-lg max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bidso SKU</TableHead>
                      <TableHead>Vertical</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bidsoSkus.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                          No Bidso SKUs found. Adjust filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      bidsoSkus.slice(0, 50).map(sku => (
                        <TableRow 
                          key={sku.bidso_sku_id} 
                          className={selectedBidso?.bidso_sku_id === sku.bidso_sku_id ? "bg-blue-50" : ""}
                        >
                          <TableCell>
                            <span className="font-mono font-medium">{sku.bidso_sku_id}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{sku.vertical?.code || "-"}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{sku.model?.code || "-"}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {sku.name || "-"}
                          </TableCell>
                          <TableCell>
                            <Button 
                              size="sm" 
                              variant={selectedBidso?.bidso_sku_id === sku.bidso_sku_id ? "default" : "outline"}
                              onClick={() => handleSelectBidsoSku(sku)}
                              data-testid={`select-bidso-${sku.bidso_sku_id}`}
                            >
                              {selectedBidso?.bidso_sku_id === sku.bidso_sku_id ? "Selected" : "Select"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Selected SKU Info */}
              {selectedBidso && (
                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold">Selected: {selectedBidso.bidso_sku_id}</h3>
                        <p className="text-sm text-gray-600">{selectedBidso.name}</p>
                        
                        {/* Existing Buyer SKUs */}
                        {existingBuyerSkus.existing.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs text-gray-500 font-medium">Existing Buyer SKUs:</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {existingBuyerSkus.existing.map(s => (
                                <Badge key={s.buyer_sku_id} variant="secondary">
                                  {s.buyer_sku_id}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Pending Requests */}
                        {existingBuyerSkus.pending_requests.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-gray-500 font-medium">Pending Requests:</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {existingBuyerSkus.pending_requests.map(r => (
                                <Badge key={r.buyer_sku_id} className="bg-orange-100 text-orange-700">
                                  {r.buyer_sku_id}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <Button onClick={() => setShowBuyerSkuDialog(true)} data-testid="open-buyer-sku-dialog">
                        <Plus className="h-4 w-4 mr-2" />
                        Request Buyer SKU
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Request RM Tab */}
        <TabsContent value="rm-request" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Request New Raw Material</CardTitle>
              <CardDescription>
                Request brand-specific raw materials like labels, packaging, or brand assets.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Category Cards */}
                {rmCategoriesList.map(cat => (
                  <Card 
                    key={cat.code} 
                    className={`cursor-pointer transition-all hover:border-primary ${rmForm.category === cat.code ? 'border-primary bg-primary/5' : ''}`}
                    onClick={() => setRmForm({ ...rmForm, category: cat.code })}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${rmForm.category === cat.code ? 'bg-primary text-white' : 'bg-gray-100'}`}>
                          {cat.code === "LB" && <Tag className="h-5 w-5" />}
                          {cat.code === "PM" && <Package className="h-5 w-5" />}
                          {cat.code === "BS" && <Layers className="h-5 w-5" />}
                          {cat.code === "STK" && <FileText className="h-5 w-5" />}
                        </div>
                        <div>
                          <h3 className="font-semibold">{cat.name}</h3>
                          <p className="text-sm text-gray-500">{cat.description}</p>
                        </div>
                        {rmForm.category === cat.code && (
                          <CheckCircle className="h-5 w-5 text-primary ml-auto" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              <div className="mt-6 flex justify-end">
                <Button onClick={() => setShowRmDialog(true)} data-testid="open-rm-dialog">
                  <Plus className="h-4 w-4 mr-2" />
                  Create RM Request
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Clone Bidso SKU Tab */}
        <TabsContent value="clone-sku" className="space-y-4">
          <CloneBidsoSKU 
            resubmitSourceRequest={resubmitSourceRequest}
            onResubmitClear={() => setResubmitSourceRequest(null)}
          />
        </TabsContent>

        {/* My Requests Tab */}
        <TabsContent value="my-requests" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Request Details</TableHead>
                    <TableHead>Brands</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead>Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : myRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        No requests yet. Create your first request above.
                      </TableCell>
                    </TableRow>
                  ) : (
                    myRequests.map(req => (
                      <TableRow key={req.id} data-testid={`request-row-${req.id}`}>
                        <TableCell>
                          {req.type === "BUYER_SKU" ? (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700">
                              <Box className="h-3 w-3 mr-1" />
                              Buyer SKU
                            </Badge>
                          ) : req.type === "BIDSO_CLONE" ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700">
                              <Copy className="h-3 w-3 mr-1" />
                              Clone SKU
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-purple-50 text-purple-700">
                              <Tag className="h-3 w-3 mr-1" />
                              RM
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {req.type === "BUYER_SKU" ? (
                            <div>
                              <span className="font-mono font-medium">{req.buyer_sku_id}</span>
                              <p className="text-xs text-gray-500">Base: {req.bidso_sku_id}</p>
                            </div>
                          ) : req.type === "BIDSO_CLONE" ? (
                            <div>
                              <span className="font-medium">{req.proposed_name}</span>
                              <p className="text-xs text-gray-500">Source: {req.source_bidso_sku_id}</p>
                            </div>
                          ) : (
                            <div>
                              <span className="font-medium">{req.requested_name}</span>
                              <p className="text-xs text-gray-500">{req.category}</p>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {req.type === "BUYER_SKU" ? (
                              <Badge variant="secondary">{req.brand_code}</Badge>
                            ) : req.type === "BIDSO_CLONE" ? (
                              <Badge variant="secondary">{req.bom_modifications?.length || 0} mods</Badge>
                            ) : (
                              req.brands?.map(b => (
                                <Badge key={b.code} variant="secondary">{b.code}</Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {req.status === "PENDING" && (
                            <Badge className="bg-orange-100 text-orange-700">
                              <Clock className="h-3 w-3 mr-1" />
                              Pending
                            </Badge>
                          )}
                          {req.status === "APPROVED" && (
                            <Badge className="bg-green-100 text-green-700">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Approved
                            </Badge>
                          )}
                          {req.status === "REJECTED" && (
                            <Badge className="bg-red-100 text-red-700">
                              <XCircle className="h-3 w-3 mr-1" />
                              Rejected
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {new Date(req.requested_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {req.status === "APPROVED" && (
                            <div>
                              <span className="font-mono text-xs text-green-600 font-medium">
                                {req.type === "BUYER_SKU" ? req.buyer_sku_id : req.type === "BIDSO_CLONE" ? req.created_bidso_sku_id : req.created_rm_id}
                              </span>
                              {req.type === "BIDSO_CLONE" && req.created_rm_ids && req.created_rm_ids.length > 0 && (
                                <p className="text-xs text-gray-400 mt-0.5">
                                  +{req.created_rm_ids.length} new RM
                                </p>
                              )}
                            </div>
                          )}
                          {req.status === "REJECTED" && (
                            <div className="space-y-1">
                              {req.review_notes && (
                                <p className="text-xs text-red-600" title={req.review_notes}>
                                  {req.review_notes.substring(0, 40)}...
                                </p>
                              )}
                              {req.type === "BIDSO_CLONE" && (
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 text-xs"
                                    onClick={() => handleViewCloneRequest(req)}
                                  >
                                    <Eye className="h-3 w-3 mr-1" />
                                    View
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="h-6 text-xs bg-blue-600 hover:bg-blue-700"
                                    onClick={() => handleResubmitClone(req)}
                                  >
                                    <RefreshCw className="h-3 w-3 mr-1" />
                                    Resubmit
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                          {req.status === "PENDING" && req.type === "BIDSO_CLONE" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-xs"
                              onClick={() => handleViewCloneRequest(req)}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Buyer SKU Request Dialog */}
      <Dialog open={showBuyerSkuDialog} onOpenChange={setShowBuyerSkuDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Buyer SKU</DialogTitle>
            <DialogDescription>
              Create a branded variant of {selectedBidso?.bidso_sku_id}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div>
              <Label>Base Product (Bidso SKU)</Label>
              <Input value={selectedBidso?.bidso_sku_id || ""} disabled className="font-mono" />
            </div>
            
            <div>
              <Label>Brand *</Label>
              <Select 
                value={buyerSkuForm.brand_id} 
                onValueChange={(v) => setBuyerSkuForm({ ...buyerSkuForm, brand_id: v })}
              >
                <SelectTrigger data-testid="buyer-sku-brand-select">
                  <SelectValue placeholder="Select brand" />
                </SelectTrigger>
                <SelectContent>
                  {brands.map(b => (
                    <SelectItem 
                      key={b.id} 
                      value={b.id}
                      disabled={isBrandTaken(b.id)}
                    >
                      {b.code} - {b.name}
                      {isBrandTaken(b.id) && " (Already exists)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {buyerSkuForm.brand_id && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium">Proposed Buyer SKU ID:</p>
                <p className="font-mono text-lg text-blue-700">
                  {getBrandCode(buyerSkuForm.brand_id)}_{selectedBidso?.bidso_sku_id}
                </p>
              </div>
            )}
            
            <div>
              <Label>Notes (Optional)</Label>
              <Textarea
                value={buyerSkuForm.notes}
                onChange={(e) => setBuyerSkuForm({ ...buyerSkuForm, notes: e.target.value })}
                placeholder="Any additional notes for Tech Ops..."
                rows={2}
              />
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowBuyerSkuDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateBuyerSkuRequest}
                disabled={!buyerSkuForm.brand_id}
                data-testid="submit-buyer-sku-request"
              >
                Submit Request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* RM Request Dialog */}
      <Dialog open={showRmDialog} onOpenChange={setShowRmDialog}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request New Raw Material</DialogTitle>
            <DialogDescription>
              Request a {rmCategoriesMap[rmForm.category]?.name || rmForm.category} for Tech Ops to create.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            {/* Category Selection */}
            <div>
              <Label>Category *</Label>
              <Select value={rmForm.category || undefined} onValueChange={handleRmCategoryChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(rmCategoriesMap).filter(([code]) => code).map(([code, config]) => (
                    <SelectItem key={code} value={code}>{code} - {config.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">{rmCategoriesMap[rmForm.category]?.description}</p>
            </div>
            
            {/* Category-Specific Fields */}
            <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {rmCategoriesMap[rmForm.category]?.name} Details
                </h4>
                <span className="text-xs text-gray-400">
                  Naming: {rmCategoriesMap[rmForm.category]?.nameFormat?.join("_")}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {rmCategoriesMap[rmForm.category]?.fields?.map(field => (
                  <div key={field.key} className={field.key === 'specs' || field.key === 'buyer_sku' ? 'col-span-2' : ''}>
                    <Label className="text-xs">
                      {field.label} {field.required && <span className="text-red-500">*</span>}
                    </Label>
                    <Input
                      type={field.type || "text"}
                      value={rmForm.category_data[field.key] || ""}
                      onChange={(e) => updateCategoryData(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="h-9 text-sm"
                      data-testid={`rm-field-${field.key}`}
                    />
                  </div>
                ))}
              </div>
              
              {/* Auto-generated RM Name Preview */}
              {generateRmName(rmForm.category, rmForm.category_data, rmCategoriesMap) && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-600 font-medium">Generated RM Name:</p>
                  <p className="font-mono text-sm text-blue-800 mt-1">
                    {generateRmName(rmForm.category, rmForm.category_data, rmCategoriesMap)}
                  </p>
                </div>
              )}
            </div>
            
            {/* Brands */}
            <div>
              <Label>For Brands *</Label>
              <div className="flex flex-wrap gap-2 mt-2 p-3 border rounded-lg min-h-[50px] bg-white">
                {rmForm.brand_ids.length === 0 && (
                  <span className="text-xs text-gray-400">No brands selected</span>
                )}
                {rmForm.brand_ids.map(bid => (
                  <Badge key={bid} variant="secondary" className="pr-1">
                    {getBrandCode(bid)} - {getBrandName(bid)}
                    <button 
                      className="ml-1 hover:text-red-500"
                      onClick={() => setRmForm({ 
                        ...rmForm, 
                        brand_ids: rmForm.brand_ids.filter(id => id !== bid) 
                      })}
                    >
                      <XCircle className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <Select onValueChange={(v) => {
                if (v && !rmForm.brand_ids.includes(v)) {
                  setRmForm({ ...rmForm, brand_ids: [...rmForm.brand_ids, v] });
                }
              }}>
                <SelectTrigger className="mt-2" data-testid="rm-brand-select">
                  <SelectValue placeholder="Add brand..." />
                </SelectTrigger>
                <SelectContent>
                  {brands.filter(b => b.id && !rmForm.brand_ids.includes(b.id)).map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.code} - {b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Additional Notes */}
            <div>
              <Label>Additional Notes</Label>
              <Textarea
                value={rmForm.description}
                onChange={(e) => setRmForm({ ...rmForm, description: e.target.value })}
                placeholder="Any additional specifications, artwork references, color codes..."
                rows={2}
                className="text-sm"
              />
            </div>
            
            {/* Artwork File Upload - Only for LB, BS, PM */}
            {ARTWORK_CATEGORIES.includes(rmForm.category) && (
              <div className="border rounded-lg p-4 bg-blue-50 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Paperclip className="h-4 w-4" />
                    Artwork Files
                  </h4>
                  <span className="text-xs text-gray-500">Accepts: .ai, .pdf, .cdr, .eps, .svg, .psd</span>
                </div>
                
                {/* Uploaded Files List */}
                {rmForm.artwork_files.length > 0 && (
                  <div className="space-y-2">
                    {rmForm.artwork_files.map((file, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-center justify-between bg-white p-2 rounded border"
                      >
                        <div className="flex items-center gap-2">
                          {getFileIcon(file.file_type)}
                          <div>
                            <p className="text-sm font-medium truncate max-w-[200px]">{file.original_name}</p>
                            <p className="text-xs text-gray-500">{file.file_type} • {file.size_display}</p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => window.open(`${API}/uploads/rm-artwork/${file.stored_name}`, '_blank')}
                            title="Download"
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                            onClick={() => handleRemoveFile(file.stored_name)}
                            title="Remove"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Upload Button */}
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".ai,.pdf,.cdr,.eps,.svg,.psd"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    data-testid="artwork-file-input"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFiles}
                    className="w-full"
                  >
                    {uploadingFiles ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Artwork Files
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-gray-500 mt-1 text-center">Max 50MB per file</p>
                </div>
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowRmDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateRmRequest}
                data-testid="submit-rm-request"
              >
                Submit Request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Clone Request Detail Dialog (for Demand KAM) */}
      <Dialog open={showCloneDetailDialog} onOpenChange={setShowCloneDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5" />
              Clone Request Details
              {selectedCloneRequest?.status === "REJECTED" && (
                <Badge className="bg-red-100 text-red-700 ml-2">Rejected</Badge>
              )}
              {selectedCloneRequest?.status === "APPROVED" && (
                <Badge className="bg-green-100 text-green-700 ml-2">Approved</Badge>
              )}
              {selectedCloneRequest?.status === "PENDING" && (
                <Badge className="bg-orange-100 text-orange-700 ml-2">Pending</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {selectedCloneRequest && (
            <div className="space-y-4 mt-4">
              {/* Request Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-gray-500">Proposed Name</Label>
                  <p className="font-medium">{selectedCloneRequest.proposed_name}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Source SKU</Label>
                  <p className="font-mono">{selectedCloneRequest.source_bidso_sku_id}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Submitted</Label>
                  <p>{new Date(selectedCloneRequest.requested_at).toLocaleString()}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Modifications</Label>
                  <p>{selectedCloneRequest.bom_modifications?.length || 0} items</p>
                </div>
              </div>

              {selectedCloneRequest.proposed_description && (
                <div>
                  <Label className="text-xs text-gray-500">Description</Label>
                  <p className="text-sm text-gray-600">{selectedCloneRequest.proposed_description}</p>
                </div>
              )}

              {/* Rejection Reason - Prominent Display */}
              {selectedCloneRequest.status === "REJECTED" && selectedCloneRequest.review_notes && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <Label className="text-xs text-red-600 font-medium">Rejection Reason</Label>
                  <p className="text-sm text-red-800 mt-1 whitespace-pre-wrap">
                    {selectedCloneRequest.review_notes}
                  </p>
                  <p className="text-xs text-red-500 mt-2">
                    Rejected by: {selectedCloneRequest.reviewer_name || "Tech Ops"} on {new Date(selectedCloneRequest.reviewed_at).toLocaleString()}
                  </p>
                </div>
              )}

              {/* Approval Result */}
              {selectedCloneRequest.status === "APPROVED" && (
                <div className="space-y-3">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <Label className="text-xs text-green-600">Created Bidso SKU</Label>
                    <p className="font-mono text-lg font-bold text-green-700 mt-1">
                      {selectedCloneRequest.created_bidso_sku_id}
                    </p>
                  </div>
                  
                  {selectedCloneRequest.created_rm_ids && selectedCloneRequest.created_rm_ids.length > 0 && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <Label className="text-xs text-blue-600">New Raw Materials Created ({selectedCloneRequest.created_rm_ids.length})</Label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selectedCloneRequest.created_rm_ids.map((rmId, idx) => (
                          <Badge key={idx} variant="outline" className="font-mono bg-white">
                            {rmId}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* BOM Modifications */}
              {selectedCloneRequest.bom_modifications?.length > 0 && (
                <div>
                  <Label className="text-xs text-gray-500 mb-2 block">BOM Modifications</Label>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Action</TableHead>
                          <TableHead className="text-xs">Original RM</TableHead>
                          <TableHead className="text-xs">New RM / Colour</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedCloneRequest.bom_modifications.map((mod, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              <Badge variant="outline" className={
                                mod.action === "CREATE_NEW" ? "bg-blue-50 text-blue-700 text-xs" :
                                mod.action === "SWAP_COLOUR" ? "bg-purple-50 text-purple-700 text-xs" :
                                "bg-orange-50 text-orange-700 text-xs"
                              }>
                                {mod.action?.replace("_", " ")}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{mod.original_rm_id}</TableCell>
                            <TableCell className="text-xs">
                              {mod.action === "CREATE_NEW" ? (
                                <span className="text-blue-600">{mod.new_rm_name || "New RM"}</span>
                              ) : (
                                <span className="font-mono">{mod.new_rm_id || mod.new_colour}</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setShowCloneDetailDialog(false)}>
                  Close
                </Button>
                {selectedCloneRequest.status === "REJECTED" && (
                  <Button 
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={() => handleResubmitClone(selectedCloneRequest)}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Edit & Resubmit
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DemandHub;

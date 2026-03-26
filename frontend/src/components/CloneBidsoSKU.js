import { useState, useEffect } from "react";
import axios from "axios";
import { 
  Package, Search, Clock, CheckCircle, XCircle, 
  Copy, Lock, Unlock, ChevronRight, ChevronLeft,
  Plus, Edit, ArrowRight, Eye, Palette, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// RM Categories with nomenclature for creating new RMs
const RM_NOMENCLATURE = {
  "INP": {
    name: "In-house Plastic",
    nameFormat: ["mould_code", "model_name", "part_name", "colour", "mb"],
    fields: [
      { key: "mould_code", label: "Mould Code", required: true },
      { key: "model_name", label: "Model Name", required: true },
      { key: "part_name", label: "Part Name", required: true },
      { key: "colour", label: "Colour", required: true },
      { key: "mb", label: "Masterbatch", required: true },
      { key: "per_unit_weight", label: "Weight (g)", required: false },
      { key: "unit", label: "Unit", required: false }
    ]
  },
  "INM": {
    name: "In-house Metal",
    nameFormat: ["model_name", "part_name", "colour", "mb"],
    fields: [
      { key: "model_name", label: "Model Name", required: true },
      { key: "part_name", label: "Part Name", required: true },
      { key: "colour", label: "Colour", required: true },
      { key: "mb", label: "Masterbatch", required: true },
      { key: "per_unit_weight", label: "Weight (g)", required: false },
      { key: "unit", label: "Unit", required: false }
    ]
  },
  "ACC": {
    name: "Accessories",
    nameFormat: ["type", "model_name", "specs", "colour"],
    fields: [
      { key: "type", label: "Type", required: true },
      { key: "model_name", label: "Model Name", required: true },
      { key: "specs", label: "Specifications", required: true },
      { key: "colour", label: "Colour", required: false },
      { key: "per_unit_weight", label: "Weight (g)", required: false },
      { key: "unit", label: "Unit", required: false }
    ]
  }
};

const generateRmName = (category, categoryData) => {
  const config = RM_NOMENCLATURE[category];
  if (!config || !config.nameFormat) return "";
  const parts = config.nameFormat
    .map(key => categoryData[key] || "")
    .filter(val => val.trim() !== "");
  return parts.join("_");
};

const CloneBidsoSKU = () => {
  // Wizard steps
  const [step, setStep] = useState(1); // 1: Select Source, 2: Modify BOM, 3: Preview & Submit
  
  // Data
  const [bidsoSkus, setBidsoSkus] = useState([]);
  const [verticals, setVerticals] = useState([]);
  const [models, setModels] = useState([]);
  
  // Selected source
  const [selectedSource, setSelectedSource] = useState(null);
  const [sourceBom, setSourceBom] = useState(null);
  
  // Modifications
  const [modifications, setModifications] = useState({}); // rm_id -> modification
  
  // New SKU details
  const [newSkuName, setNewSkuName] = useState("");
  const [newSkuDescription, setNewSkuDescription] = useState("");
  
  // Filters
  const [filters, setFilters] = useState({ vertical_id: "", model_id: "", search: "" });
  
  // Dialogs
  const [showColourDialog, setShowColourDialog] = useState(false);
  const [showSwapDialog, setShowSwapDialog] = useState(false);
  const [showCreateRmDialog, setShowCreateRmDialog] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  // Colour variants and swap search
  const [colourVariants, setColourVariants] = useState([]);
  const [swapSearchResults, setSwapSearchResults] = useState([]);
  const [swapSearch, setSwapSearch] = useState("");
  const [swapFilterByModel, setSwapFilterByModel] = useState(true);
  
  // New RM form
  const [newRmForm, setNewRmForm] = useState({});
  
  // Loading
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchMasterData();
    fetchBidsoSkus();
  }, []);

  useEffect(() => {
    fetchBidsoSkus();
  }, [filters]);

  const fetchMasterData = async () => {
    try {
      const [verticalsRes, modelsRes] = await Promise.all([
        axios.get(`${API}/verticals`),
        axios.get(`${API}/models`)
      ]);
      setVerticals(verticalsRes.data.filter(v => v.status === 'ACTIVE'));
      setModels(modelsRes.data.filter(m => m.status === 'ACTIVE'));
    } catch (error) {
      console.error("Failed to fetch master data");
    }
  };

  const fetchBidsoSkus = async () => {
    setLoading(true);
    try {
      let url = `${API}/demand-hub/bidso-skus-for-clone?`;
      if (filters.vertical_id) url += `vertical_id=${filters.vertical_id}&`;
      if (filters.model_id) url += `model_id=${filters.model_id}&`;
      if (filters.search) url += `search=${encodeURIComponent(filters.search)}&`;
      
      const res = await axios.get(url);
      setBidsoSkus(res.data);
    } catch (error) {
      toast.error("Failed to fetch Bidso SKUs");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSource = async (sku) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/demand-hub/bidso-skus/${sku.bidso_sku_id}/bom-for-clone`);
      setSelectedSource(sku);
      setSourceBom(res.data);
      setModifications({});
      setNewSkuName(`${sku.name || sku.bidso_sku_id} - Variant`);
      setNewSkuDescription("");
      setStep(2);
    } catch (error) {
      toast.error("Failed to load BOM");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenColourDialog = async (item) => {
    setEditingItem(item);
    setLoading(true);
    try {
      const res = await axios.get(`${API}/demand-hub/colour-variants/${item.rm_id}`);
      setColourVariants(res.data.variants);
      setShowColourDialog(true);
    } catch (error) {
      toast.error("Failed to load colour variants");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectColourVariant = (variant) => {
    setModifications({
      ...modifications,
      [editingItem.rm_id]: {
        original_rm_id: editingItem.rm_id,
        action: "SWAP_COLOUR",
        new_rm_id: variant.rm_id,
        new_rm_name: variant.name,
        new_colour: variant.colour
      }
    });
    setShowColourDialog(false);
    setEditingItem(null);
    toast.success(`Changed to ${variant.colour} variant`);
  };

  const handleOpenSwapDialog = async (item) => {
    setEditingItem(item);
    setSwapSearch("");
    setSwapFilterByModel(true);
    await searchForSwap(item.category, item.model_name, "", true);
    setShowSwapDialog(true);
  };

  const searchForSwap = async (category, modelName, search, filterByModel) => {
    try {
      let url = `${API}/demand-hub/search-rm-for-swap?category=${category}`;
      if (filterByModel && modelName) url += `&model_name=${encodeURIComponent(modelName)}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      
      const res = await axios.get(url);
      setSwapSearchResults(res.data.results);
    } catch (error) {
      console.error("Search failed");
    }
  };

  const handleSwapSearch = (value) => {
    setSwapSearch(value);
    if (editingItem) {
      searchForSwap(editingItem.category, editingItem.model_name, value, swapFilterByModel);
    }
  };

  const handleToggleSwapFilter = () => {
    const newFilter = !swapFilterByModel;
    setSwapFilterByModel(newFilter);
    if (editingItem) {
      searchForSwap(editingItem.category, editingItem.model_name, swapSearch, newFilter);
    }
  };

  const handleSelectSwapRm = (rm) => {
    setModifications({
      ...modifications,
      [editingItem.rm_id]: {
        original_rm_id: editingItem.rm_id,
        action: "SWAP_RM",
        new_rm_id: rm.rm_id,
        new_rm_name: rm.name,
        new_colour: rm.colour
      }
    });
    setShowSwapDialog(false);
    setEditingItem(null);
    toast.success(`Swapped to ${rm.rm_id}`);
  };

  const handleOpenCreateRmDialog = (item) => {
    setEditingItem(item);
    // Pre-fill form from source RM - try category_data first, then fall back to flat fields
    const categoryData = item.category_data || {};
    const prefill = {
      // For INP
      mould_code: categoryData.mould_code || item.mould_code || "",
      model_name: categoryData.model_name || item.model_name || "",
      part_name: categoryData.part_name || item.part_name || "",
      colour: "", // Clear colour for new variant - user must enter new colour
      mb: "", // Clear masterbatch - user must enter new one
      per_unit_weight: categoryData.per_unit_weight || item.per_unit_weight || "",
      unit: categoryData.unit || item.unit || "",
      // For ACC
      type: categoryData.type || item.type || "",
      specs: categoryData.specs || item.specs || "",
    };
    setNewRmForm(prefill);
    setShowCreateRmDialog(true);
  };

  const handleCreateNewRm = () => {
    const category = editingItem.category;
    const config = RM_NOMENCLATURE[category];
    
    // Validate required fields
    const missingFields = config.fields
      .filter(f => f.required && !newRmForm[f.key])
      .map(f => f.label);
    
    if (missingFields.length > 0) {
      toast.error(`Missing required fields: ${missingFields.join(", ")}`);
      return;
    }
    
    const generatedName = generateRmName(category, newRmForm);
    
    setModifications({
      ...modifications,
      [editingItem.rm_id]: {
        original_rm_id: editingItem.rm_id,
        action: "CREATE_NEW",
        new_rm_id: null,
        new_rm_name: generatedName,
        new_colour: newRmForm.colour,
        new_rm_definition: {
          category: category,
          category_data: { ...newRmForm }
        }
      }
    });
    
    setShowCreateRmDialog(false);
    setEditingItem(null);
    setNewRmForm({});
    toast.success("New RM definition added");
  };

  const handleUndoModification = (rmId) => {
    const newMods = { ...modifications };
    delete newMods[rmId];
    setModifications(newMods);
    toast.success("Modification removed");
  };

  const handleSubmit = async () => {
    if (!newSkuName.trim()) {
      toast.error("Please enter a name for the new SKU");
      return;
    }
    
    setSubmitting(true);
    try {
      const bomModifications = Object.values(modifications);
      
      const res = await axios.post(`${API}/demand-hub/bidso-clone-requests`, {
        source_bidso_sku_id: selectedSource.bidso_sku_id,
        proposed_name: newSkuName,
        proposed_description: newSkuDescription,
        bom_modifications: bomModifications
      });
      
      toast.success("Clone request submitted for Tech Ops approval");
      
      // Reset and go back to step 1
      setStep(1);
      setSelectedSource(null);
      setSourceBom(null);
      setModifications({});
      setNewSkuName("");
      setNewSkuDescription("");
      
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  const getFilteredModels = () => {
    if (!filters.vertical_id) return models;
    return models.filter(m => m.vertical_id === filters.vertical_id);
  };

  const getModificationForItem = (rmId) => modifications[rmId];

  const getModifiedCount = () => Object.keys(modifications).length;
  const getNewRmsCount = () => Object.values(modifications).filter(m => m.action === "CREATE_NEW").length;

  return (
    <div className="space-y-4">
      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-4 py-4">
        <div className={`flex items-center gap-2 ${step >= 1 ? 'text-primary' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 1 ? 'bg-primary text-white' : 'bg-gray-200'}`}>1</div>
          <span className="text-sm font-medium">Select Source</span>
        </div>
        <ChevronRight className="h-4 w-4 text-gray-400" />
        <div className={`flex items-center gap-2 ${step >= 2 ? 'text-primary' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 2 ? 'bg-primary text-white' : 'bg-gray-200'}`}>2</div>
          <span className="text-sm font-medium">Modify BOM</span>
        </div>
        <ChevronRight className="h-4 w-4 text-gray-400" />
        <div className={`flex items-center gap-2 ${step >= 3 ? 'text-primary' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 3 ? 'bg-primary text-white' : 'bg-gray-200'}`}>3</div>
          <span className="text-sm font-medium">Preview & Submit</span>
        </div>
      </div>

      {/* Step 1: Select Source SKU */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5" />
              Select Source Bidso SKU
            </CardTitle>
            <CardDescription>
              Choose a Bidso SKU to clone. Only SKUs with existing BOMs are shown.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-4">
              <div className="w-[200px]">
                <Label className="text-xs text-gray-500">Vertical</Label>
                <Select 
                  value={filters.vertical_id} 
                  onValueChange={(v) => setFilters({ ...filters, vertical_id: v === "all" ? "" : v, model_id: "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Verticals" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Verticals</SelectItem>
                    {verticals.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.code} - {v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="w-[200px]">
                <Label className="text-xs text-gray-500">Model</Label>
                <Select 
                  value={filters.model_id} 
                  onValueChange={(v) => setFilters({ ...filters, model_id: v === "all" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Models" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Models</SelectItem>
                    {getFilteredModels().map(m => (
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
                    placeholder="Search by SKU ID or name..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            {/* SKU Table */}
            <div className="border rounded-lg max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bidso SKU</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>BOM Items</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-gray-500">Loading...</TableCell>
                    </TableRow>
                  ) : bidsoSkus.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                        No Bidso SKUs found with BOMs
                      </TableCell>
                    </TableRow>
                  ) : (
                    bidsoSkus.slice(0, 50).map(sku => (
                      <TableRow key={sku.bidso_sku_id}>
                        <TableCell className="font-mono font-medium">{sku.bidso_sku_id}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{sku.name || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{sku.model?.code || sku.model_code || "-"}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{sku.bom_item_count} items</Badge>
                        </TableCell>
                        <TableCell>
                          <Button 
                            size="sm" 
                            onClick={() => handleSelectSource(sku)}
                            data-testid={`select-source-${sku.bidso_sku_id}`}
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            Clone
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Modify BOM */}
      {step === 2 && sourceBom && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Edit className="h-5 w-5" />
                  Modify BOM
                </CardTitle>
                <CardDescription>
                  Cloning: <span className="font-mono font-bold">{selectedSource?.bidso_sku_id}</span> - {selectedSource?.name}
                </CardDescription>
              </div>
              <div className="flex gap-2 text-sm">
                <Badge variant="outline" className="bg-green-50">
                  <Unlock className="h-3 w-3 mr-1" />
                  Editable: {sourceBom.editable_count}
                </Badge>
                <Badge variant="outline" className="bg-gray-50">
                  <Lock className="h-3 w-3 mr-1" />
                  Locked: {sourceBom.locked_count}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* BOM Table */}
            <div className="border rounded-lg max-h-[350px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Status</TableHead>
                    <TableHead>RM ID</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Name / Part</TableHead>
                    <TableHead>Colour</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sourceBom.bom_items.map(item => {
                    const mod = getModificationForItem(item.rm_id);
                    const isModified = !!mod;
                    
                    return (
                      <TableRow 
                        key={item.rm_id} 
                        className={isModified ? "bg-blue-50" : ""}
                      >
                        <TableCell>
                          {item.edit_type === "LOCKED" ? (
                            <Lock className="h-4 w-4 text-gray-400" />
                          ) : (
                            <Unlock className="h-4 w-4 text-green-500" />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {isModified ? (
                            <div className="flex items-center gap-1">
                              <span className="line-through text-gray-400">{item.rm_id}</span>
                              <ArrowRight className="h-3 w-3" />
                              <span className="text-blue-600 font-bold">
                                {mod.new_rm_id || "[NEW]"}
                              </span>
                            </div>
                          ) : (
                            item.rm_id
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.edit_type !== "LOCKED" ? "default" : "secondary"}>
                            {item.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm">
                          {isModified ? (
                            <span className="text-blue-600">{mod.new_rm_name}</span>
                          ) : (
                            item.rm_name || item.part_name || item.model_name || "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {isModified ? (
                            <Badge className="bg-blue-100 text-blue-700">{mod.new_colour || "-"}</Badge>
                          ) : (
                            <span className="text-gray-500">{item.colour || "-"}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.edit_type !== "LOCKED" && (
                            isModified ? (
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => handleUndoModification(item.rm_id)}
                                className="text-red-500 hover:text-red-700"
                              >
                                Undo
                              </Button>
                            ) : (
                              <div className="flex gap-1">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleOpenColourDialog(item)}
                                  title="Change Colour"
                                >
                                  <Palette className="h-3 w-3" />
                                </Button>
                                {item.edit_type === "COLOUR_OR_SWAP" && (
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => handleOpenSwapDialog(item)}
                                    title="Swap RM"
                                  >
                                    <RefreshCw className="h-3 w-3" />
                                  </Button>
                                )}
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleOpenCreateRmDialog(item)}
                                  title="Create New"
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            )
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Modifications Summary */}
            {getModifiedCount() > 0 && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium text-blue-800">
                  {getModifiedCount()} modification(s) • {getNewRmsCount()} new RM(s) to create
                </p>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Button onClick={() => setStep(3)}>
                Continue
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview & Submit */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Preview & Submit
            </CardTitle>
            <CardDescription>
              Review your changes and submit for Tech Ops approval
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* New SKU Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>New SKU Name *</Label>
                <Input
                  value={newSkuName}
                  onChange={(e) => setNewSkuName(e.target.value)}
                  placeholder="e.g., Kids Scooter - Red"
                  data-testid="new-sku-name"
                />
              </div>
              <div>
                <Label>Description (Optional)</Label>
                <Input
                  value={newSkuDescription}
                  onChange={(e) => setNewSkuDescription(e.target.value)}
                  placeholder="e.g., Red colour variant"
                />
              </div>
            </div>

            {/* Summary Card */}
            <Card className="bg-gray-50">
              <CardContent className="pt-4">
                <h4 className="font-semibold mb-3">Summary</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Source SKU</p>
                    <p className="font-mono font-medium">{selectedSource?.bidso_sku_id}</p>
                    <p className="text-gray-600">{selectedSource?.name}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">New SKU ID (auto-generated)</p>
                    <p className="font-mono font-medium text-green-600">
                      {selectedSource?.vertical_code}_{selectedSource?.model_code}_XXX
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Total BOM Items</p>
                    <p className="font-medium">{sourceBom?.total_items}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Items Modified</p>
                    <p className="font-medium">{getModifiedCount()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">New RMs to Create</p>
                    <p className="font-medium">{getNewRmsCount()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Locked Items</p>
                    <p className="font-medium">{sourceBom?.locked_count}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Modifications List */}
            {getModifiedCount() > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Modifications</h4>
                <div className="space-y-2">
                  {Object.values(modifications).map((mod, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm p-2 bg-blue-50 rounded">
                      <Badge variant="outline">{mod.action.replace("_", " ")}</Badge>
                      <span className="font-mono">{mod.original_rm_id}</span>
                      <ArrowRight className="h-3 w-3" />
                      <span className="font-mono text-blue-600">
                        {mod.new_rm_id || "[NEW RM]"}
                      </span>
                      {mod.new_colour && (
                        <Badge className="bg-blue-100 text-blue-700">{mod.new_colour}</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warning */}
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              ⚠️ This request will be sent to <strong>Tech Ops</strong> for review and approval.
            </div>

            {/* Navigation */}
            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={submitting || !newSkuName.trim()}
                data-testid="submit-clone-request"
              >
                {submitting ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Colour Variant Dialog */}
      <Dialog open={showColourDialog} onOpenChange={setShowColourDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select Colour Variant</DialogTitle>
            <DialogDescription>
              Choose a different colour variant for {editingItem?.rm_id}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 mt-4 max-h-[300px] overflow-auto">
            {colourVariants.length === 0 ? (
              <p className="text-center text-gray-500 py-4">
                No other colour variants found. Use "Create New" instead.
              </p>
            ) : (
              colourVariants.map(v => (
                <div 
                  key={v.rm_id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleSelectColourVariant(v)}
                >
                  <div>
                    <p className="font-mono font-medium">{v.rm_id}</p>
                    <p className="text-sm text-gray-500">{v.name}</p>
                  </div>
                  <Badge>{v.colour}</Badge>
                </div>
              ))
            )}
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowColourDialog(false)}>Cancel</Button>
            <Button variant="outline" onClick={() => { setShowColourDialog(false); handleOpenCreateRmDialog(editingItem); }}>
              <Plus className="h-4 w-4 mr-1" />
              Create New
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Swap RM Dialog */}
      <Dialog open={showSwapDialog} onOpenChange={setShowSwapDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Swap Accessory</DialogTitle>
            <DialogDescription>
              Replace {editingItem?.rm_id} with a different accessory
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search by type, model, specs..."
                value={swapSearch}
                onChange={(e) => handleSwapSearch(e.target.value)}
                className="flex-1"
              />
              <Button 
                variant={swapFilterByModel ? "default" : "outline"}
                size="sm"
                onClick={handleToggleSwapFilter}
              >
                {swapFilterByModel ? "Filtered" : "Show All"}
              </Button>
            </div>
            <div className="max-h-[250px] overflow-auto space-y-2">
              {swapSearchResults.length === 0 ? (
                <p className="text-center text-gray-500 py-4">No matching accessories found</p>
              ) : (
                swapSearchResults.map(rm => (
                  <div 
                    key={rm.rm_id}
                    className={`flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer ${rm.rm_id === editingItem?.rm_id ? 'bg-gray-100' : ''}`}
                    onClick={() => rm.rm_id !== editingItem?.rm_id && handleSelectSwapRm(rm)}
                  >
                    <div>
                      <p className="font-mono font-medium">{rm.rm_id}</p>
                      <p className="text-sm text-gray-500">{rm.name || `${rm.type} - ${rm.model_name}`}</p>
                    </div>
                    {rm.rm_id === editingItem?.rm_id ? (
                      <Badge variant="secondary">Current</Badge>
                    ) : (
                      <Badge variant="outline">{rm.colour || "N/A"}</Badge>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowSwapDialog(false)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create New RM Dialog */}
      <Dialog open={showCreateRmDialog} onOpenChange={setShowCreateRmDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Colour Variant</DialogTitle>
            <DialogDescription>
              Based on: {editingItem?.rm_id} ({editingItem?.category})
            </DialogDescription>
          </DialogHeader>
          {editingItem && RM_NOMENCLATURE[editingItem.category] && (
            <div className="space-y-4 mt-4">
              {/* Show warning if source RM has no category data */}
              {(!editingItem.category_data || Object.keys(editingItem.category_data).length === 0) && 
               !editingItem.mould_code && !editingItem.model_name && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                  <strong>Note:</strong> Source RM ({editingItem.rm_id}) has no structured data. 
                  Please fill in all fields for the new variant.
                </div>
              )}
              <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                Naming: {RM_NOMENCLATURE[editingItem.category].nameFormat.join("_")}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {RM_NOMENCLATURE[editingItem.category].fields.map(field => (
                  <div key={field.key} className={field.key === 'specs' ? 'col-span-2' : ''}>
                    <Label className="text-xs">
                      {field.label} {field.required && <span className="text-red-500">*</span>}
                    </Label>
                    <Input
                      value={newRmForm[field.key] || ""}
                      onChange={(e) => setNewRmForm({ ...newRmForm, [field.key]: e.target.value })}
                      placeholder={field.label}
                      className="h-9 text-sm"
                    />
                  </div>
                ))}
              </div>
              {generateRmName(editingItem.category, newRmForm) && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600 font-medium">Generated Name:</p>
                  <p className="font-mono text-sm">{generateRmName(editingItem.category, newRmForm)}</p>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowCreateRmDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateNewRm}>Add to BOM</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CloneBidsoSKU;

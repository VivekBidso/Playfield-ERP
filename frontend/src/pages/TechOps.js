import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Plus, Settings, Package, Link, Layers, Pencil, Trash2, Users, Upload, Tag, Palette, Factory, FileText, Download } from "lucide-react";
import PantoneLibrary from "../components/PantoneLibrary";
import StockItemSearch from "../components/StockItemSearch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const TechOps = () => {
  const [activeTab, setActiveTab] = useState("verticals");
  
  // Master Data
  const [verticals, setVerticals] = useState([]);
  const [models, setModels] = useState([]);
  const [brands, setBrands] = useState([]);
  const [buyers, setBuyers] = useState([]);
  
  // RM Categories & BOM
  const [rmCategories, setRmCategories] = useState([]);
  const [rmBoms, setRmBoms] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  
  // Dialogs
  const [showVerticalDialog, setShowVerticalDialog] = useState(false);
  const [showModelDialog, setShowModelDialog] = useState(false);
  const [showBrandDialog, setShowBrandDialog] = useState(false);
  const [showBuyerDialog, setShowBuyerDialog] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showBomDialog, setShowBomDialog] = useState(false);
  
  // Edit mode
  const [editingItem, setEditingItem] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  
  // Form Data
  const [verticalForm, setVerticalForm] = useState({ code: "", name: "", description: "" });
  const [modelForm, setModelForm] = useState({ vertical_id: "", code: "", name: "", description: "" });
  const [brandForm, setBrandForm] = useState({ code: "", name: "" });
  const [buyerForm, setBuyerForm] = useState({ name: "", gst: "", email: "", phone_no: "", poc_name: "" });
  const [categoryForm, setCategoryForm] = useState({ 
    code: "", name: "", description: "", 
    default_source_type: "PURCHASED", default_bom_level: 1,
    default_uom: "PCS", rm_id_prefix: "", description_columns: []
  });
  const [bomForm, setBomForm] = useState({
    rm_id: "", category: "", bom_level: 2, output_qty: 1, output_uom: "PCS",
    yield_factor: 1.0, components: []
  });
  const [bomComponent, setBomComponent] = useState({
    component_rm_id: "", quantity: 0, uom: "KG", percentage: 0, wastage_factor: 1.0
  });
  
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const fileInputRef = useRef(null);

  // Download functions for each tab
  const handleDownload = async (type) => {
    setDownloading(true);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      let data = [];
      let filename = '';
      let sheetName = '';
      
      switch(type) {
        case 'verticals':
          data = [['Code', 'Name', 'Description', 'Status']];
          verticals.forEach(v => data.push([v.code, v.name, v.description || '', v.status]));
          filename = 'verticals';
          sheetName = 'Verticals';
          break;
          
        case 'models':
          data = [['Code', 'Name', 'Vertical', 'Description', 'Status']];
          models.forEach(m => {
            const vert = verticals.find(v => v.id === m.vertical_id);
            data.push([m.code, m.name, vert?.name || '', m.description || '', m.status]);
          });
          filename = 'models';
          sheetName = 'Models';
          break;
          
        case 'brands':
          data = [['Code', 'Name', 'Status']];
          brands.forEach(b => data.push([b.code, b.name, b.status]));
          filename = 'brands';
          sheetName = 'Brands';
          break;
          
        case 'buyers':
          data = [['Customer Code', 'Name', 'GST', 'Email', 'Phone', 'POC Name', 'Status']];
          buyers.forEach(b => data.push([
            b.customer_code || b.code || '', 
            b.name, 
            b.gst || '', 
            b.email || '', 
            b.phone_no || '', 
            b.poc_name || '',
            b.status
          ]));
          filename = 'buyers';
          sheetName = 'Buyers';
          break;
          
        default:
          toast.error('Unknown download type');
          return;
      }
      
      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0,10)}.xlsx`);
      toast.success(`Downloaded ${data.length - 1} ${type}`);
      
    } catch (error) {
      toast.error('Failed to download');
      console.error(error);
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      const [verticalsRes, modelsRes, brandsRes, buyersRes, categoriesRes, bomsRes, rmsRes] = await Promise.all([
        axios.get(`${API}/verticals`),
        axios.get(`${API}/models`),
        axios.get(`${API}/brands`),
        axios.get(`${API}/buyers`),
        axios.get(`${API}/production/rm-categories`).catch(() => ({ data: [] })),
        axios.get(`${API}/rm-bom`).catch(() => ({ data: [] })),
        axios.get(`${API}/raw-materials?page_size=5000`).catch(() => ({ data: [] }))
      ]);
      setVerticals(verticalsRes.data.filter(v => v.status === 'ACTIVE'));
      setModels(modelsRes.data.filter(m => m.status === 'ACTIVE'));
      setBrands(brandsRes.data.filter(b => b.status === 'ACTIVE'));
      setBuyers(buyersRes.data.filter(b => b.status === 'ACTIVE'));
      setRmCategories(categoriesRes.data || []);
      setRmBoms(bomsRes.data || []);
      setRawMaterials(rmsRes.data || []);
    } catch (error) {
      toast.error("Failed to fetch data");
    }
  };

  // Vertical CRUD
  const handleCreateVertical = async () => {
    try {
      if (editingItem) {
        await axios.put(`${API}/verticals/${editingItem.id}`, verticalForm);
        toast.success("Vertical updated");
      } else {
        await axios.post(`${API}/verticals`, verticalForm);
        toast.success("Vertical created");
      }
      setShowVerticalDialog(false);
      setVerticalForm({ code: "", name: "", description: "" });
      setEditingItem(null);
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save vertical");
    }
  };

  const handleEditVertical = (v) => {
    setVerticalForm({ code: v.code, name: v.name, description: v.description || "" });
    setEditingItem(v);
    setShowVerticalDialog(true);
  };

  const handleDeleteVertical = async (id) => {
    try {
      await axios.delete(`${API}/verticals/${id}`);
      toast.success("Vertical deleted");
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete vertical");
    }
    setDeleteConfirm(null);
  };

  // Model CRUD
  const handleCreateModel = async () => {
    try {
      if (editingItem) {
        await axios.put(`${API}/models/${editingItem.id}`, modelForm);
        toast.success("Model updated");
      } else {
        await axios.post(`${API}/models`, modelForm);
        toast.success("Model created");
      }
      setShowModelDialog(false);
      setModelForm({ vertical_id: "", code: "", name: "", description: "" });
      setEditingItem(null);
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save model");
    }
  };

  const handleEditModel = (m) => {
    setModelForm({ vertical_id: m.vertical_id, code: m.code, name: m.name, description: m.description || "" });
    setEditingItem(m);
    setShowModelDialog(true);
  };

  const handleDeleteModel = async (id) => {
    try {
      await axios.delete(`${API}/models/${id}`);
      toast.success("Model deleted");
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete model");
    }
    setDeleteConfirm(null);
  };

  // Brand CRUD
  const handleCreateBrand = async () => {
    try {
      if (editingItem) {
        await axios.put(`${API}/brands/${editingItem.id}`, brandForm);
        toast.success("Brand updated");
      } else {
        await axios.post(`${API}/brands`, brandForm);
        toast.success("Brand created");
      }
      setShowBrandDialog(false);
      setBrandForm({ code: "", name: "" });
      setEditingItem(null);
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save brand");
    }
  };

  const handleEditBrand = (b) => {
    setBrandForm({ code: b.code, name: b.name });
    setEditingItem(b);
    setShowBrandDialog(true);
  };

  const handleDeleteBrand = async (id) => {
    try {
      await axios.delete(`${API}/brands/${id}`);
      toast.success("Brand deleted");
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete brand");
    }
    setDeleteConfirm(null);
  };

  // Buyer CRUD
  const handleCreateBuyer = async () => {
    try {
      if (editingItem) {
        await axios.put(`${API}/buyers/${editingItem.id}`, buyerForm);
        toast.success("Buyer updated");
      } else {
        await axios.post(`${API}/buyers`, buyerForm);
        toast.success("Buyer created with auto-generated code");
      }
      setShowBuyerDialog(false);
      setBuyerForm({ name: "", gst: "", email: "", phone_no: "", poc_name: "" });
      setEditingItem(null);
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save buyer");
    }
  };

  const handleEditBuyer = (b) => {
    setBuyerForm({ 
      name: b.name || "", 
      gst: b.gst || "", 
      email: b.email || "", 
      phone_no: b.phone_no || "", 
      poc_name: b.poc_name || "" 
    });
    setEditingItem(b);
    setShowBuyerDialog(true);
  };

  const handleDeleteBuyer = async (id) => {
    try {
      await axios.delete(`${API}/buyers/${id}`);
      toast.success("Buyer deleted");
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete buyer");
    }
    setDeleteConfirm(null);
  };

  const handleBuyerImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImportLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await axios.post(`${API}/buyers/bulk-import`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      // Check for duplicates
      if (res.data.duplicates && res.data.duplicates.length > 0) {
        const dupCount = res.data.duplicates.length;
        const dupList = res.data.duplicates.slice(0, 5).map(d => d.name).join(", ");
        toast.error(
          `${res.data.created} created, ${dupCount} skipped (duplicates). No overwrites allowed.\nDuplicates: ${dupList}${dupCount > 5 ? '...' : ''}`,
          { duration: 8000 }
        );
      } else {
        toast.success(res.data.message);
      }
      
      setShowImportDialog(false);
      fetchAllData();
    } catch (error) {
      const errData = error.response?.data;
      if (errData?.duplicates && errData.duplicates.length > 0) {
        const dupCount = errData.duplicates.length;
        const dupList = errData.duplicates.slice(0, 5).map(d => d.name).join(", ");
        toast.error(
          `Upload blocked: ${dupCount} duplicate(s) found. No overwrites allowed.\nDuplicates: ${dupList}${dupCount > 5 ? '...' : ''}`,
          { duration: 8000 }
        );
      } else {
        toast.error(errData?.detail || errData?.message || "Import failed");
      }
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const getVerticalName = (id) => verticals.find(v => v.id === id)?.name || id;
  const getBuyerName = (id) => buyers.find(b => b.id === id)?.name || id;
  const getRmName = (rmId) => rawMaterials.find(r => r.rm_id === rmId)?.description || rmId;

  // RM Category CRUD
  const handleSaveCategory = async () => {
    try {
      const payload = {
        ...categoryForm,
        rm_id_prefix: categoryForm.rm_id_prefix || categoryForm.code.toUpperCase(),
        description_columns: categoryForm.description_columns || []
      };
      
      if (editingItem) {
        await axios.put(`${API}/production/rm-categories/${editingItem.code}`, payload);
        toast.success("Category updated");
      } else {
        await axios.post(`${API}/production/rm-categories`, payload);
        toast.success("Category created");
      }
      setShowCategoryDialog(false);
      setCategoryForm({ 
        code: "", name: "", description: "", 
        default_source_type: "PURCHASED", default_bom_level: 1,
        default_uom: "PCS", rm_id_prefix: "", description_columns: []
      });
      setEditingItem(null);
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save category");
    }
  };

  const openEditCategory = (cat) => {
    setEditingItem(cat);
    setCategoryForm({
      code: cat.code,
      name: cat.name,
      description: cat.description || "",
      default_source_type: cat.default_source_type,
      default_bom_level: cat.default_bom_level,
      default_uom: cat.default_uom || "PCS",
      rm_id_prefix: cat.rm_id_prefix || cat.code,
      description_columns: cat.description_columns || []
    });
    setShowCategoryDialog(true);
  };

  // Add/Remove description column
  const addDescriptionColumn = () => {
    setCategoryForm({
      ...categoryForm,
      description_columns: [
        ...categoryForm.description_columns,
        { key: "", label: "", type: "text", required: false, options: [], include_in_name: false, order: categoryForm.description_columns.length }
      ]
    });
  };

  const updateDescriptionColumn = (index, field, value) => {
    const updated = [...categoryForm.description_columns];
    updated[index] = { ...updated[index], [field]: value };
    setCategoryForm({ ...categoryForm, description_columns: updated });
  };

  const removeDescriptionColumn = (index) => {
    setCategoryForm({
      ...categoryForm,
      description_columns: categoryForm.description_columns.filter((_, i) => i !== index)
    });
  };

  // RM BOM CRUD
  const [bomUploadOpen, setBomUploadOpen] = useState(false);
  const [bomUploadMode, setBomUploadMode] = useState("skip");
  const [bomUploading, setBomUploading] = useState(false);
  const bomFileRef = useRef(null);
  
  const handleBomBulkUpload = async () => {
    const file = bomFileRef.current?.files?.[0];
    if (!file) { toast.error("Select a file"); return; }
    
    setBomUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const res = await axios.post(
        `${API}/rm-bom/bulk-upload?mode=${bomUploadMode}`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      
      const d = res.data;
      toast.success(`${d.message}`);
      
      if (d.errors?.length > 0) {
        toast.error(`${d.errors.length} errors: ${d.errors.slice(0, 3).join(", ")}`);
      }
      
      setBomUploadOpen(false);
      if (bomFileRef.current) bomFileRef.current.value = "";
      fetchAllData();
    } catch (error) {
      const msg = error.response?.data?.detail || error.message;
      toast.error(`Upload failed: ${msg}`);
    }
    setBomUploading(false);
  };

  const downloadBomTemplate = () => {
    const XLSX = require('xlsx');
    const wb = XLSX.utils.book_new();
    const data = [
      ["RM ID", "BOM RM ID", "Weight in gm / Pc", "Wastage %"],
      ["INP_001", "POLY_001", 100, "2%"],
      ["INP_001", "POLY_002", 100, "2%"],
      ["INP_001", "MB_001", 20, "2%"],
      ["INMFAB_001", "MTL_001", 100, "2%"],
      ["INMFAB_001", "MTL_002", 50, "2%"],
      ["INM_001", "INMFAB_001", 1, "0%"],
      ["INM_001", "PWD_001", 50, "2%"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, "RM BOM Template");
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'RM_BOM_Upload_Template.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSaveBom = async () => {
    try {
      if (bomForm.components.length === 0) {
        toast.error("Add at least one component to the BOM");
        return;
      }
      
      const payload = {
        ...bomForm,
        rm_id: bomForm.rm_id.toUpperCase()
      };
      
      if (editingItem) {
        await axios.put(`${API}/rm-bom/${editingItem.rm_id}`, payload);
        toast.success("BOM updated");
      } else {
        await axios.post(`${API}/rm-bom`, payload);
        toast.success("BOM created");
      }
      setShowBomDialog(false);
      setBomForm({ rm_id: "", category: "", bom_level: 2, output_qty: 1, output_uom: "PCS", yield_factor: 1.0, components: [] });
      setEditingItem(null);
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save BOM");
    }
  };

  const handleDeleteBom = async (rmId) => {
    try {
      await axios.delete(`${API}/rm-bom/${rmId}`);
      toast.success("BOM deleted");
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete BOM");
    }
  };

  const openEditBom = (bom) => {
    setEditingItem(bom);
    setBomForm({
      rm_id: bom.rm_id,
      category: bom.category,
      bom_level: bom.bom_level,
      output_qty: bom.output_qty,
      output_uom: bom.output_uom,
      yield_factor: bom.yield_factor,
      components: bom.components || []
    });
    setShowBomDialog(true);
  };

  const addBomComponent = () => {
    if (!bomComponent.component_rm_id) {
      toast.error("Select a component RM");
      return;
    }
    if (bomForm.components.find(c => c.component_rm_id === bomComponent.component_rm_id.toUpperCase())) {
      toast.error("Component already added");
      return;
    }
    const rm = rawMaterials.find(r => r.rm_id === bomComponent.component_rm_id.toUpperCase());
    setBomForm({
      ...bomForm,
      components: [...bomForm.components, {
        ...bomComponent,
        component_rm_id: bomComponent.component_rm_id.toUpperCase(),
        component_name: rm?.description || bomComponent.component_rm_id
      }]
    });
    setBomComponent({ component_rm_id: "", quantity: 0, uom: "KG", percentage: 0, wastage_factor: 1.0 });
  };

  const removeBomComponent = (rmId) => {
    setBomForm({
      ...bomForm,
      components: bomForm.components.filter(c => c.component_rm_id !== rmId)
    });
  };

  const openAddDialog = (type) => {
    setEditingItem(null);
    if (type === 'vertical') {
      setVerticalForm({ code: "", name: "", description: "" });
      setShowVerticalDialog(true);
    } else if (type === 'model') {
      setModelForm({ vertical_id: "", code: "", name: "", description: "" });
      setShowModelDialog(true);
    } else if (type === 'brand') {
      setBrandForm({ code: "", name: "" });
      setShowBrandDialog(true);
    } else if (type === 'buyer') {
      setBuyerForm({ name: "", gst: "", email: "", phone_no: "", poc_name: "" });
      setShowBuyerDialog(true);
    } else if (type === 'category') {
      setCategoryForm({ code: "", name: "", description: "", default_source_type: "PURCHASED", default_bom_level: 1 });
      setShowCategoryDialog(true);
    } else if (type === 'bom') {
      setBomForm({ rm_id: "", category: "", bom_level: 2, output_qty: 1, output_uom: "PCS", yield_factor: 1.0, components: [] });
      setShowBomDialog(true);
    }
  };

  return (
    <div className="p-6 md:p-8" data-testid="tech-ops-page">
      <div className="mb-8">
        <h1 className="text-4xl font-black tracking-tight uppercase">Tech Ops</h1>
        <p className="text-sm text-muted-foreground mt-1 font-mono">Master Data Management</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="verticals" className="uppercase text-xs tracking-wide">
            <Layers className="w-4 h-4 mr-2" />
            Verticals ({verticals.length})
          </TabsTrigger>
          <TabsTrigger value="models" className="uppercase text-xs tracking-wide">
            <Package className="w-4 h-4 mr-2" />
            Models ({models.length})
          </TabsTrigger>
          <TabsTrigger value="brands" className="uppercase text-xs tracking-wide">
            <Settings className="w-4 h-4 mr-2" />
            Brands ({brands.length})
          </TabsTrigger>
          <TabsTrigger value="buyers" className="uppercase text-xs tracking-wide">
            <Users className="w-4 h-4 mr-2" />
            Buyers ({buyers.length})
          </TabsTrigger>
          <TabsTrigger value="pantone" className="uppercase text-xs tracking-wide">
            <Palette className="w-4 h-4 mr-2" />
            Pantone Library
          </TabsTrigger>
          <TabsTrigger value="rm-categories" className="uppercase text-xs tracking-wide">
            <Factory className="w-4 h-4 mr-2" />
            RM Categories ({rmCategories.length})
          </TabsTrigger>
          <TabsTrigger value="rm-bom" className="uppercase text-xs tracking-wide">
            <FileText className="w-4 h-4 mr-2" />
            RM BOM ({rmBoms.length})
          </TabsTrigger>
        </TabsList>

        {/* Verticals Tab */}
        <TabsContent value="verticals">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold">Product Verticals</h2>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleDownload('verticals')} disabled={downloading || verticals.length === 0}>
                <Download className="w-4 h-4 mr-2" />
                {downloading ? "..." : `Download (${verticals.length})`}
              </Button>
              <Button onClick={() => openAddDialog('vertical')} className="uppercase text-xs tracking-wide" data-testid="add-vertical-btn">
                <Plus className="w-4 h-4 mr-2" />
                Add Vertical
              </Button>
            </div>
          </div>
          
          <div className="border rounded-sm">
            <table className="w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Code</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Name</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Description</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Models</th>
                  <th className="h-10 px-4 text-right font-mono text-xs uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {verticals.map((v) => (
                  <tr key={v.id} className="border-t">
                    <td className="p-4 font-mono font-bold">{v.code}</td>
                    <td className="p-4">{v.name}</td>
                    <td className="p-4 text-sm text-muted-foreground">{v.description}</td>
                    <td className="p-4 font-mono">{models.filter(m => m.vertical_id === v.id).length}</td>
                    <td className="p-4 text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleEditVertical(v)} data-testid={`edit-vertical-${v.code}`}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm({ type: 'vertical', id: v.id, name: v.name })} data-testid={`delete-vertical-${v.code}`}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {verticals.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No verticals defined</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Models Tab */}
        <TabsContent value="models">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold">Product Models</h2>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleDownload('models')} disabled={downloading || models.length === 0}>
                <Download className="w-4 h-4 mr-2" />
                {downloading ? "..." : `Download (${models.length})`}
              </Button>
              <Button onClick={() => openAddDialog('model')} className="uppercase text-xs tracking-wide" data-testid="add-model-btn">
                <Plus className="w-4 h-4 mr-2" />
                Add Model
              </Button>
            </div>
          </div>
          
          <div className="border rounded-sm">
            <table className="w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Vertical</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Code</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Name</th>
                  <th className="h-10 px-4 text-right font-mono text-xs uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {models.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="p-4 text-sm">{getVerticalName(m.vertical_id)}</td>
                    <td className="p-4 font-mono font-bold">{m.code}</td>
                    <td className="p-4">{m.name}</td>
                    <td className="p-4 text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleEditModel(m)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm({ type: 'model', id: m.id, name: m.name })}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {models.length === 0 && (
                  <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No models defined</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Brands Tab */}
        <TabsContent value="brands">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold">Brands</h2>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleDownload('brands')} disabled={downloading || brands.length === 0}>
                <Download className="w-4 h-4 mr-2" />
                {downloading ? "..." : `Download (${brands.length})`}
              </Button>
              <Button onClick={() => openAddDialog('brand')} className="uppercase text-xs tracking-wide" data-testid="add-brand-btn">
                <Plus className="w-4 h-4 mr-2" />
                Add Brand
              </Button>
            </div>
          </div>
          
          <div className="border rounded-sm">
            <table className="w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Code</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Brand Name</th>
                  <th className="h-10 px-4 text-right font-mono text-xs uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {brands.map((b) => (
                  <tr key={b.id} className="border-t">
                    <td className="p-4 font-mono font-bold">{b.code}</td>
                    <td className="p-4">{b.name}</td>
                    <td className="p-4 text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleEditBrand(b)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm({ type: 'brand', id: b.id, name: b.name })}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {brands.length === 0 && (
                  <tr><td colSpan={3} className="p-8 text-center text-muted-foreground">No brands defined</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Buyers Tab */}
        <TabsContent value="buyers">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold">Buyers / Customers</h2>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleDownload('buyers')} disabled={downloading || buyers.length === 0}>
                <Download className="w-4 h-4 mr-2" />
                {downloading ? "..." : `Download (${buyers.length})`}
              </Button>
              <Button variant="outline" onClick={() => setShowImportDialog(true)} className="uppercase text-xs tracking-wide" data-testid="import-buyers-btn">
                <Upload className="w-4 h-4 mr-2" />
                Import Excel
              </Button>
              <Button onClick={() => openAddDialog('buyer')} className="uppercase text-xs tracking-wide" data-testid="add-buyer-btn">
                <Plus className="w-4 h-4 mr-2" />
                Add Buyer
              </Button>
            </div>
          </div>
          
          <div className="border rounded-sm overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Customer Code</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Customer Name</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">GST</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Email</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Phone No</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">POC Name</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Brands</th>
                  <th className="h-10 px-4 text-right font-mono text-xs uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {buyers.map((b) => (
                  <tr key={b.id} className="border-t">
                    <td className="p-4 font-mono font-bold">{b.customer_code || b.code || '-'}</td>
                    <td className="p-4">{b.name}</td>
                    <td className="p-4 text-sm font-mono">{b.gst || '-'}</td>
                    <td className="p-4 text-sm">{b.email || b.contact_email || '-'}</td>
                    <td className="p-4 text-sm font-mono">{b.phone_no || '-'}</td>
                    <td className="p-4 text-sm">{b.poc_name || '-'}</td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {(b.brands_dispatched || []).length > 0 ? (
                          b.brands_dispatched.slice(0, 3).map((brand, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              <Tag className="w-3 h-3 mr-1" />{brand}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                        {(b.brands_dispatched || []).length > 3 && (
                          <Badge variant="outline" className="text-xs">+{b.brands_dispatched.length - 3}</Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleEditBuyer(b)} data-testid={`edit-buyer-${b.customer_code || b.code}`}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm({ type: 'buyer', id: b.id, name: b.name })} data-testid={`delete-buyer-${b.customer_code || b.code}`}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {buyers.length === 0 && (
                  <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No buyers defined</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Pantone Library Tab */}
        <TabsContent value="pantone">
          <PantoneLibrary />
        </TabsContent>

        {/* RM Categories Tab */}
        <TabsContent value="rm-categories">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-bold">RM Categories</h2>
              <p className="text-sm text-muted-foreground">Define source types, BOM levels, UOM, and description columns for raw material categories</p>
            </div>
            <Button onClick={() => openAddDialog('category')} className="uppercase text-xs tracking-wide" data-testid="add-category-btn">
              <Plus className="w-4 h-4 mr-2" />
              Add Category
            </Button>
          </div>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 text-xs uppercase font-bold">Code</th>
                  <th className="text-left p-3 text-xs uppercase font-bold">Name</th>
                  <th className="text-center p-3 text-xs uppercase font-bold">UOM</th>
                  <th className="text-center p-3 text-xs uppercase font-bold">ID Prefix</th>
                  <th className="text-center p-3 text-xs uppercase font-bold">Source Type</th>
                  <th className="text-center p-3 text-xs uppercase font-bold">Level</th>
                  <th className="text-center p-3 text-xs uppercase font-bold">Columns</th>
                  <th className="text-center p-3 text-xs uppercase font-bold">Status</th>
                  <th className="text-right p-3 text-xs uppercase font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rmCategories.map(cat => (
                  <tr key={cat.code} className="hover:bg-gray-50" data-testid={`category-row-${cat.code}`}>
                    <td className="p-3 font-mono font-bold">{cat.code}</td>
                    <td className="p-3">{cat.name}</td>
                    <td className="p-3 text-center font-mono text-sm">{cat.default_uom || 'PCS'}</td>
                    <td className="p-3 text-center font-mono text-sm">{cat.rm_id_prefix || cat.code}_###</td>
                    <td className="p-3 text-center">
                      <Badge variant={cat.default_source_type === 'MANUFACTURED' ? 'default' : cat.default_source_type === 'BOTH' ? 'secondary' : 'outline'}>
                        {cat.default_source_type}
                      </Badge>
                    </td>
                    <td className="p-3 text-center font-mono">L{cat.default_bom_level}</td>
                    <td className="p-3 text-center">
                      <Badge variant="outline" className="text-xs">
                        {cat.description_columns?.length || 0} cols
                      </Badge>
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant={cat.is_active ? 'default' : 'destructive'}>
                        {cat.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEditCategory(cat)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {rmCategories.length === 0 && (
                  <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No categories defined</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* RM BOM Tab */}
        <TabsContent value="rm-bom">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-bold">RM Bill of Materials</h2>
              <p className="text-sm text-muted-foreground">Define component recipes for manufactured RMs</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button 
                variant="secondary" 
                onClick={() => window.open(`${API}/rm-bom/export?level=2`, '_blank')} 
                className="uppercase text-xs tracking-wide"
                data-testid="export-l2-bom-btn"
                title="Download all L2 (INP) RMs and their BOMs"
              >
                <Download className="w-4 h-4 mr-2" />
                Export L2
              </Button>
              <Button 
                variant="secondary" 
                onClick={() => window.open(`${API}/rm-bom/export?level=3`, '_blank')} 
                className="uppercase text-xs tracking-wide"
                data-testid="export-l3-bom-btn"
                title="Download all L3 (INM) RMs and their BOMs"
              >
                <Download className="w-4 h-4 mr-2" />
                Export L3
              </Button>
              <Button 
                variant="secondary" 
                onClick={() => window.open(`${API}/rm-bom/export?level=all`, '_blank')} 
                className="uppercase text-xs tracking-wide"
                data-testid="export-all-bom-btn"
                title="Download all L2 + L3 RMs and their BOMs"
              >
                <Download className="w-4 h-4 mr-2" />
                Export L2 + L3
              </Button>
              <Button variant="outline" onClick={() => setBomUploadOpen(true)} className="uppercase text-xs tracking-wide" data-testid="bulk-upload-bom-btn">
                <Upload className="w-4 h-4 mr-2" />
                Bulk Upload
              </Button>
              <Button onClick={() => openAddDialog('bom')} className="uppercase text-xs tracking-wide" data-testid="add-bom-btn">
                <Plus className="w-4 h-4 mr-2" />
                Add BOM
              </Button>
            </div>
          </div>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 text-xs uppercase font-bold">RM ID</th>
                  <th className="text-left p-3 text-xs uppercase font-bold">Name</th>
                  <th className="text-center p-3 text-xs uppercase font-bold">Category</th>
                  <th className="text-center p-3 text-xs uppercase font-bold">Level</th>
                  <th className="text-center p-3 text-xs uppercase font-bold">Components</th>
                  <th className="text-center p-3 text-xs uppercase font-bold">Yield</th>
                  <th className="text-right p-3 text-xs uppercase font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rmBoms.map(bom => (
                  <tr key={bom.rm_id} className="hover:bg-gray-50" data-testid={`bom-row-${bom.rm_id}`}>
                    <td className="p-3 font-mono font-bold">{bom.rm_id}</td>
                    <td className="p-3">{bom.rm_name || getRmName(bom.rm_id)}</td>
                    <td className="p-3 text-center">
                      <Badge variant="outline">{bom.category}</Badge>
                    </td>
                    <td className="p-3 text-center font-mono">L{bom.bom_level}</td>
                    <td className="p-3 text-center">
                      <span className="text-sm">{bom.components?.length || 0} items</span>
                    </td>
                    <td className="p-3 text-center font-mono">{((bom.yield_factor || 1) * 100).toFixed(0)}%</td>
                    <td className="p-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEditBom(bom)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteBom(bom.rm_id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {rmBoms.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No BOMs defined. Create BOMs for manufactured RMs.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Vertical Dialog */}
      <Dialog open={showVerticalDialog} onOpenChange={(open) => { setShowVerticalDialog(open); if (!open) setEditingItem(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Vertical' : 'Create Vertical'}</DialogTitle>
            <DialogDescription>Product category grouping (e.g., Scooter, Trike, Walker)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Code</Label>
              <Input 
                value={verticalForm.code}
                onChange={(e) => setVerticalForm({...verticalForm, code: e.target.value})}
                placeholder="e.g., SCOOTER"
                className="font-mono uppercase"
              />
            </div>
            <div>
              <Label>Name</Label>
              <Input 
                value={verticalForm.name}
                onChange={(e) => setVerticalForm({...verticalForm, name: e.target.value})}
                placeholder="Display name"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input 
                value={verticalForm.description}
                onChange={(e) => setVerticalForm({...verticalForm, description: e.target.value})}
              />
            </div>
            <Button onClick={handleCreateVertical} className="w-full">{editingItem ? 'Update' : 'Create'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Model Dialog */}
      <Dialog open={showModelDialog} onOpenChange={(open) => { setShowModelDialog(open); if (!open) setEditingItem(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Model' : 'Create Model'}</DialogTitle>
            <DialogDescription>Product model under a vertical (e.g., Blaze, Astro)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Vertical</Label>
              <Select value={modelForm.vertical_id} onValueChange={(v) => setModelForm({...modelForm, vertical_id: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select vertical" />
                </SelectTrigger>
                <SelectContent>
                  {verticals.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Code</Label>
              <Input 
                value={modelForm.code}
                onChange={(e) => setModelForm({...modelForm, code: e.target.value})}
                placeholder="e.g., BLAZE"
                className="font-mono uppercase"
              />
            </div>
            <div>
              <Label>Name</Label>
              <Input 
                value={modelForm.name}
                onChange={(e) => setModelForm({...modelForm, name: e.target.value})}
              />
            </div>
            <Button onClick={handleCreateModel} className="w-full">{editingItem ? 'Update' : 'Create'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Brand Dialog */}
      <Dialog open={showBrandDialog} onOpenChange={(open) => { setShowBrandDialog(open); if (!open) setEditingItem(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Brand' : 'Create Brand'}</DialogTitle>
            <DialogDescription>Brand definition (Code + Name)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Code</Label>
              <Input 
                value={brandForm.code}
                onChange={(e) => setBrandForm({...brandForm, code: e.target.value.toUpperCase()})}
                placeholder="e.g., FC"
                className="font-mono uppercase"
                maxLength={10}
              />
            </div>
            <div>
              <Label>Brand Name</Label>
              <Input 
                value={brandForm.name}
                onChange={(e) => setBrandForm({...brandForm, name: e.target.value})}
                placeholder="e.g., Firstcry"
              />
            </div>
            <Button onClick={handleCreateBrand} className="w-full">{editingItem ? 'Update' : 'Create'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Buyer Dialog */}
      <Dialog open={showBuyerDialog} onOpenChange={(open) => { setShowBuyerDialog(open); if (!open) setEditingItem(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Buyer' : 'Create Buyer'}</DialogTitle>
            <DialogDescription>
              {editingItem 
                ? `Editing buyer: ${editingItem.customer_code || editingItem.code}` 
                : 'Customer code will be auto-generated (e.g., CUST001)'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {editingItem && (
              <div>
                <Label>Customer Code</Label>
                <Input 
                  value={editingItem.customer_code || editingItem.code || ''}
                  disabled
                  className="font-mono bg-zinc-100"
                />
                <p className="text-xs text-muted-foreground mt-1">Auto-generated, cannot be changed</p>
              </div>
            )}
            <div>
              <Label>Customer Name *</Label>
              <Input 
                value={buyerForm.name}
                onChange={(e) => setBuyerForm({...buyerForm, name: e.target.value})}
                placeholder="Enter customer name"
              />
            </div>
            <div>
              <Label>GST Number</Label>
              <Input 
                value={buyerForm.gst}
                onChange={(e) => setBuyerForm({...buyerForm, gst: e.target.value.toUpperCase()})}
                placeholder="e.g., 22AAAAA0000A1Z5"
                className="font-mono uppercase"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input 
                value={buyerForm.email}
                onChange={(e) => setBuyerForm({...buyerForm, email: e.target.value})}
                type="email"
                placeholder="contact@company.com"
              />
            </div>
            <div>
              <Label>Phone Number</Label>
              <Input 
                value={buyerForm.phone_no}
                onChange={(e) => setBuyerForm({...buyerForm, phone_no: e.target.value})}
                placeholder="+91 98765 43210"
              />
            </div>
            <div>
              <Label>POC Name (Point of Contact)</Label>
              <Input 
                value={buyerForm.poc_name}
                onChange={(e) => setBuyerForm({...buyerForm, poc_name: e.target.value})}
                placeholder="Contact person name"
              />
            </div>
            <Button onClick={handleCreateBuyer} className="w-full" disabled={!buyerForm.name.trim()}>
              {editingItem ? 'Update' : 'Create Buyer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Buyer Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import Buyers from Excel</DialogTitle>
            <DialogDescription>
              Upload an Excel file with buyer data. Expected columns: Customer Name (required), GST, Email, Phone No, POC Name
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleBuyerImport}
                className="hidden"
                id="buyer-file-input"
              />
              <label htmlFor="buyer-file-input" className="cursor-pointer">
                <Button variant="outline" disabled={importLoading} asChild>
                  <span>{importLoading ? 'Importing...' : 'Select Excel File'}</span>
                </Button>
              </label>
              <p className="text-xs text-muted-foreground mt-2">Supports .xlsx and .xls files</p>
            </div>
            <div className="bg-zinc-50 rounded p-3 text-sm">
              <p className="font-medium mb-1">Expected columns:</p>
              <ul className="text-muted-foreground space-y-1 text-xs">
                <li>• <span className="font-mono">Customer Name</span> or <span className="font-mono">Name</span> (required)</li>
                <li>• <span className="font-mono">GST</span></li>
                <li>• <span className="font-mono">Email</span></li>
                <li>• <span className="font-mono">Phone No</span> or <span className="font-mono">Phone</span></li>
                <li>• <span className="font-mono">POC Name</span> or <span className="font-mono">Contact</span></li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteConfirm?.type}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.name}"? This action cannot be undone if there are no dependencies.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (deleteConfirm?.type === 'vertical') handleDeleteVertical(deleteConfirm.id);
                else if (deleteConfirm?.type === 'model') handleDeleteModel(deleteConfirm.id);
                else if (deleteConfirm?.type === 'brand') handleDeleteBrand(deleteConfirm.id);
                else if (deleteConfirm?.type === 'buyer') handleDeleteBuyer(deleteConfirm.id);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* RM Category Dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={(open) => { setShowCategoryDialog(open); if (!open) setEditingItem(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit RM Category' : 'Create RM Category'}</DialogTitle>
            <DialogDescription>Define source type, BOM level, UOM, and description columns for this category</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category Code *</Label>
                <Input 
                  value={categoryForm.code}
                  onChange={(e) => setCategoryForm({...categoryForm, code: e.target.value.toUpperCase()})}
                  placeholder="e.g., POLY, MB, INP"
                  className="font-mono uppercase"
                  disabled={!!editingItem}
                />
              </div>
              <div>
                <Label>Name *</Label>
                <Input 
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({...categoryForm, name: e.target.value})}
                  placeholder="e.g., Polymer Grades"
                />
              </div>
            </div>
            
            <div>
              <Label>Description</Label>
              <Textarea 
                value={categoryForm.description}
                onChange={(e) => setCategoryForm({...categoryForm, description: e.target.value})}
                placeholder="Brief description of this category"
                rows={2}
              />
            </div>
            
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label>Default UOM</Label>
                <Select 
                  value={categoryForm.default_uom || "PCS"}
                  onValueChange={(v) => setCategoryForm({...categoryForm, default_uom: v})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select UOM" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PCS">PCS (Pieces)</SelectItem>
                    <SelectItem value="KG">KG (Kilograms)</SelectItem>
                    <SelectItem value="GM">GM (Grams)</SelectItem>
                    <SelectItem value="MTR">MTR (Meters)</SelectItem>
                    <SelectItem value="LTR">LTR (Liters)</SelectItem>
                    <SelectItem value="SET">SET</SelectItem>
                    <SelectItem value="BOX">BOX</SelectItem>
                    <SelectItem value="ROLL">ROLL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>RM ID Prefix</Label>
                <Input 
                  value={categoryForm.rm_id_prefix}
                  onChange={(e) => setCategoryForm({...categoryForm, rm_id_prefix: e.target.value.toUpperCase()})}
                  placeholder={categoryForm.code || "PREFIX"}
                  className="font-mono uppercase"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  IDs: {categoryForm.rm_id_prefix || categoryForm.code || 'XXX'}_001, _002...
                </p>
              </div>
              <div>
                <Label>Source Type</Label>
                <Select 
                  value={categoryForm.default_source_type || "PURCHASED"}
                  onValueChange={(v) => setCategoryForm({...categoryForm, default_source_type: v})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PURCHASED">PURCHASED</SelectItem>
                    <SelectItem value="MANUFACTURED">MANUFACTURED</SelectItem>
                    <SelectItem value="BOTH">BOTH</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>BOM Level</Label>
                <Select 
                  value={String(categoryForm.default_bom_level) || "1"}
                  onValueChange={(v) => setCategoryForm({...categoryForm, default_bom_level: parseInt(v)})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">L1 - Raw</SelectItem>
                    <SelectItem value="2">L2 - Transform 1</SelectItem>
                    <SelectItem value="3">L3 - Transform 2</SelectItem>
                    <SelectItem value="4">L4 - Transform 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Description Columns Section */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <Label className="text-sm font-bold">Description Columns</Label>
                  <p className="text-xs text-muted-foreground">
                    Define fields for category_data when creating RMs via upload
                  </p>
                </div>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={addDescriptionColumn}
                >
                  <Plus className="w-4 h-4 mr-1" /> Add Column
                </Button>
              </div>
              
              {categoryForm.description_columns?.length > 0 ? (
                <div className="space-y-2">
                  {categoryForm.description_columns.map((col, idx) => (
                    <div key={idx} className="flex gap-2 items-center bg-white p-2 rounded border">
                      <Input 
                        value={col.key}
                        onChange={(e) => updateDescriptionColumn(idx, 'key', e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                        placeholder="field_key"
                        className="w-[120px] font-mono text-xs"
                      />
                      <Input 
                        value={col.label}
                        onChange={(e) => updateDescriptionColumn(idx, 'label', e.target.value)}
                        placeholder="Display Label"
                        className="flex-1"
                      />
                      <Select 
                        value={col.type || "text"}
                        onValueChange={(v) => updateDescriptionColumn(idx, 'type', v)}
                      >
                        <SelectTrigger className="w-[100px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="number">Number</SelectItem>
                          <SelectItem value="select">Select</SelectItem>
                        </SelectContent>
                      </Select>
                      <label className="flex items-center gap-1 text-xs">
                        <input 
                          type="checkbox" 
                          checked={col.required} 
                          onChange={(e) => updateDescriptionColumn(idx, 'required', e.target.checked)}
                          className="w-4 h-4"
                        />
                        Req
                      </label>
                      <label className="flex items-center gap-1 text-xs">
                        <input 
                          type="checkbox" 
                          checked={col.include_in_name} 
                          onChange={(e) => updateDescriptionColumn(idx, 'include_in_name', e.target.checked)}
                          className="w-4 h-4"
                        />
                        In Name
                      </label>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm"
                        onClick={() => removeDescriptionColumn(idx)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No columns defined. Add columns to configure the RM upload template.
                </p>
              )}
            </div>
            
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>Cancel</Button>
              <Button onClick={handleSaveCategory} data-testid="save-category-btn">
                {editingItem ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* RM BOM Dialog */}
      <Dialog open={showBomDialog} onOpenChange={(open) => { setShowBomDialog(open); if (!open) setEditingItem(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit RM BOM' : 'Create RM BOM'}</DialogTitle>
            <DialogDescription>Define the components and quantities needed to produce this RM</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>RM ID (Output)</Label>
                <StockItemSearch
                  searchEndpoint={`${API}/raw-materials/search?source_type=NOT_PURCHASED`}
                  value={bomForm.rm_id}
                  onSelect={(item) => {
                    const cat = item.category || item.item_id?.split('_')[0] || '';
                    setBomForm({...bomForm, rm_id: item.item_id, category: cat});
                  }}
                  disabled={!!editingItem}
                  placeholder="Type RM ID (e.g. INP_654)..."
                  testId="bom-output-rm-search"
                />
              </div>
              <div>
                <Label>Category</Label>
                <Select 
                  value={bomForm.category || undefined}
                  onValueChange={(v) => setBomForm({...bomForm, category: v})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {rmCategories.filter(c => c.default_source_type !== 'PURCHASED').map(c => (
                      <SelectItem key={c.code} value={c.code}>{c.code} - {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label>BOM Level</Label>
                <Select 
                  value={String(bomForm.bom_level) || undefined}
                  onValueChange={(v) => setBomForm({...bomForm, bom_level: parseInt(v)})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">L2</SelectItem>
                    <SelectItem value="3">L3</SelectItem>
                    <SelectItem value="4">L4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Output Qty</Label>
                <Input 
                  type="number"
                  value={bomForm.output_qty}
                  onChange={(e) => setBomForm({...bomForm, output_qty: parseFloat(e.target.value) || 1})}
                  min="0.01"
                  step="0.01"
                />
              </div>
              <div>
                <Label>Output UOM</Label>
                <Select 
                  value={bomForm.output_uom || undefined}
                  onValueChange={(v) => setBomForm({...bomForm, output_uom: v})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="UOM" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PCS">PCS</SelectItem>
                    <SelectItem value="KG">KG</SelectItem>
                    <SelectItem value="MTR">MTR</SelectItem>
                    <SelectItem value="SET">SET</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Yield Factor</Label>
                <Input 
                  type="number"
                  value={bomForm.yield_factor}
                  onChange={(e) => setBomForm({...bomForm, yield_factor: parseFloat(e.target.value) || 1})}
                  min="0.01"
                  max="1"
                  step="0.01"
                />
              </div>
            </div>

            {/* Components Section */}
            <div className="border rounded-lg p-4">
              <Label className="text-sm font-bold uppercase mb-2 block">Components (Input Materials)</Label>
              
              {/* Add Component Form */}
              <div className="grid grid-cols-6 gap-2 mb-3 items-end">
                <div className="col-span-2">
                  <Label className="text-xs">RM ID</Label>
                  <StockItemSearch
                    searchEndpoint={`${API}/raw-materials/search?max_bom_level=${Math.max(1, bomForm.bom_level - 1)}`}
                    value={bomComponent.component_rm_id}
                    onSelect={(item) => setBomComponent({...bomComponent, component_rm_id: item.item_id})}
                    placeholder="Type component RM ID..."
                    testId="bom-component-rm-search"
                  />
                </div>
                <div>
                  <Label className="text-xs">Qty</Label>
                  <Input 
                    type="number"
                    value={bomComponent.quantity}
                    onChange={(e) => setBomComponent({...bomComponent, quantity: parseFloat(e.target.value) || 0})}
                    min="0"
                    step="0.001"
                    className="text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">UOM</Label>
                  <Select 
                    value={bomComponent.uom || undefined}
                    onValueChange={(v) => setBomComponent({...bomComponent, uom: v})}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="KG">KG</SelectItem>
                      <SelectItem value="PCS">PCS</SelectItem>
                      <SelectItem value="MTR">MTR</SelectItem>
                      <SelectItem value="LTR">LTR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Wastage %</Label>
                  <Input 
                    type="number"
                    value={((bomComponent.wastage_factor - 1) * 100).toFixed(0)}
                    onChange={(e) => setBomComponent({...bomComponent, wastage_factor: 1 + (parseFloat(e.target.value) || 0) / 100})}
                    min="0"
                    max="50"
                    className="text-xs"
                  />
                </div>
                <div>
                  <Button size="sm" onClick={addBomComponent} className="w-full">
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {/* Components List */}
              {bomForm.components.length > 0 && (
                <div className="border rounded overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="p-2 text-left">RM ID</th>
                        <th className="p-2 text-left">Name</th>
                        <th className="p-2 text-right">Qty</th>
                        <th className="p-2 text-center">UOM</th>
                        <th className="p-2 text-right">Wastage</th>
                        <th className="p-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {bomForm.components.map((comp, idx) => (
                        <tr key={idx}>
                          <td className="p-2 font-mono">{comp.component_rm_id}</td>
                          <td className="p-2">{comp.component_name || getRmName(comp.component_rm_id)}</td>
                          <td className="p-2 text-right">{comp.quantity}</td>
                          <td className="p-2 text-center">{comp.uom}</td>
                          <td className="p-2 text-right">{((comp.wastage_factor - 1) * 100).toFixed(0)}%</td>
                          <td className="p-2 text-center">
                            <Button variant="ghost" size="sm" onClick={() => removeBomComponent(comp.component_rm_id)}>
                              <Trash2 className="w-3 h-3 text-red-500" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {bomForm.components.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No components added. Add at least one component.</p>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowBomDialog(false)}>Cancel</Button>
              <Button onClick={handleSaveBom} data-testid="save-bom-btn">
                {editingItem ? 'Update BOM' : 'Create BOM'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* BOM Bulk Upload Dialog */}
      <Dialog open={bomUploadOpen} onOpenChange={setBomUploadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Upload RM BOMs</DialogTitle>
            <DialogDescription>
              Upload Excel with columns: RM ID, BOM RM ID, Weight in gm / Pc, Wastage %
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Excel File</Label>
              <Input 
                ref={bomFileRef} 
                type="file" 
                accept=".xlsx,.xls" 
                className="mt-1"
                data-testid="bom-upload-file"
              />
              <Button variant="link" className="px-0 text-xs h-auto mt-1" onClick={downloadBomTemplate} data-testid="download-bom-template">
                <Download className="w-3 h-3 mr-1" /> Download Template
              </Button>
            </div>
            <div>
              <Label>If BOM already exists</Label>
              <Select value={bomUploadMode} onValueChange={setBomUploadMode}>
                <SelectTrigger data-testid="bom-upload-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="skip">Skip (keep existing)</SelectItem>
                  <SelectItem value="replace">Replace (overwrite)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>- Multiple rows with same RM ID are grouped into one BOM</p>
              <p>- UOM auto-detected from component RM category</p>
              <p>- BOM level auto-detected from output RM category</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBomUploadOpen(false)}>Cancel</Button>
              <Button onClick={handleBomBulkUpload} disabled={bomUploading} data-testid="bom-upload-submit">
                {bomUploading ? "Uploading..." : "Upload BOMs"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TechOps;

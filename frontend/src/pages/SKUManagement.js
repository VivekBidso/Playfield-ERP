import { useState, useEffect, useRef } from "react";
import axios from "axios";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { 
  Package, Layers, Plus, Search, ChevronRight, Lock, Unlock, 
  Edit, Trash2, Copy, FileSpreadsheet, ArrowRight, Download, Upload, RefreshCw, Database, Tag, AlertTriangle, Check, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import useAuthStore from "../store/authStore";
import Pagination from "../components/Pagination";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SKUManagement = () => {
  // Get token from zustand auth store
  const token = useAuthStore((state) => state.token);
  
  // Helper to get auth headers
  const getHeaders = () => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const [activeTab, setActiveTab] = useState("bidso");
  
  // Data
  const [bidsoSKUs, setBidsoSKUs] = useState([]);
  const [buyerSKUs, setBuyerSKUs] = useState([]);
  const [verticals, setVerticals] = useState([]);
  const [models, setModels] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Filters
  const [filterVertical, setFilterVertical] = useState("");
  const [filterModel, setFilterModel] = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Selected items
  const [selectedBidso, setSelectedBidso] = useState(null);
  const [selectedBuyer, setSelectedBuyer] = useState(null);
  
  // Dialogs
  const [showBidsoDialog, setShowBidsoDialog] = useState(false);
  const [showBuyerDialog, setShowBuyerDialog] = useState(false);
  const [showBOMDialog, setShowBOMDialog] = useState(false);
  const [showBulkCreateDialog, setShowBulkCreateDialog] = useState(false);
  
  // Forms
  const [bidsoForm, setBidsoForm] = useState({
    vertical_id: "",
    model_id: "",
    numeric_code: "",
    name: "",
    description: ""
  });
  const [buyerForm, setBuyerForm] = useState({
    bidso_sku_id: "",
    brand_id: "",
    name: "",
    description: ""
  });
  const [suggestedCode, setSuggestedCode] = useState("");
  const [previewSKUID, setPreviewSKUID] = useState("");
  
  // BOM
  const [commonBOM, setCommonBOM] = useState([]);
  const [brandSpecificBOM, setBrandSpecificBOM] = useState([]);
  const [bomLocked, setBomLocked] = useState(false);
  
  // Buyer SKU Full BOM
  const [showBuyerBOMDialog, setShowBuyerBOMDialog] = useState(false);
  const [selectedBuyerSKU, setSelectedBuyerSKU] = useState(null);
  const [buyerFullBOM, setBuyerFullBOM] = useState(null);
  const [buyerBOMLoading, setBuyerBOMLoading] = useState(false);
  
  // BOM Item Edit
  const [editingBOMItem, setEditingBOMItem] = useState(null);
  const [showBOMEditDialog, setShowBOMEditDialog] = useState(false);
  const [bomEditForm, setBomEditForm] = useState({ rm_id: "", new_rm_id: "", quantity: 1, unit: "PCS" });
  const [bomEditLoading, setBomEditLoading] = useState(false);
  const [scheduleWarning, setScheduleWarning] = useState(null);
  
  // Edit Buyer SKU (HSN/GST)
  const [showEditBuyerDialog, setShowEditBuyerDialog] = useState(false);
  const [editBuyerForm, setEditBuyerForm] = useState({ hsn_code: "", gst_rate: 18 });
  const [editBuyerLoading, setEditBuyerLoading] = useState(false);
  
  // Bulk HSN/GST Upload
  const [showBulkHSNDialog, setShowBulkHSNDialog] = useState(false);
  const [bulkHSNFile, setBulkHSNFile] = useState(null);
  const [bulkHSNLoading, setBulkHSNLoading] = useState(false);
  
  // Stats
  const [stats, setStats] = useState({
    bidso_skus: 0,
    buyer_skus: 0,
    common_boms: 0
  });
  
  // Data Sync
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  
  // Bulk Delete
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [bulkDeletePreview, setBulkDeletePreview] = useState(null);
  const [bulkDeleteFile, setBulkDeleteFile] = useState(null);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const bulkDeleteFileRef = useRef(null);
  const [exportLoading, setExportLoading] = useState(false);
  const syncFileInputRef = useRef(null);
  
  // Bulk BOM Upload
  const [showBOMUploadDialog, setShowBOMUploadDialog] = useState(false);
  const [bomUploadLoading, setBomUploadLoading] = useState(false);
  const [bomUploadResult, setBomUploadResult] = useState(null);
  const bomFileInputRef = useRef(null);

  // Pagination state for Bidso SKUs
  const [bidsoPage, setBidsoPage] = useState(1);
  const [bidsoPageSize, setBidsoPageSize] = useState(50);
  const [bidsoTotal, setBidsoTotal] = useState(0);
  const [bidsoTotalPages, setBidsoTotalPages] = useState(1);

  // Pagination state for Buyer SKUs
  const [buyerPage, setBuyerPage] = useState(1);
  const [buyerPageSize, setBuyerPageSize] = useState(50);
  const [buyerTotal, setBuyerTotal] = useState(0);
  const [buyerTotalPages, setBuyerTotalPages] = useState(1);

  useEffect(() => {
    fetchMasterData();
    fetchStats();
  }, []);

  useEffect(() => {
    if (activeTab === "bidso") {
      fetchBidsoSKUs();
    } else {
      fetchBuyerSKUs();
    }
  }, [activeTab, filterVertical, filterModel, filterBrand, bidsoPage, bidsoPageSize, buyerPage, buyerPageSize]);

  // Clear selectedBidso when switching to buyer tab without a specific selection
  useEffect(() => {
    if (activeTab === "buyer" && !filterBrand) {
      setSelectedBidso(null);
    }
  }, [activeTab]);

  const fetchMasterData = async () => {
    try {
      const headers = getHeaders();
      const [verticalsRes, modelsRes, brandsRes] = await Promise.all([
        axios.get(`${API}/verticals`, { headers }),
        axios.get(`${API}/models`, { headers }),
        axios.get(`${API}/brands`, { headers })
      ]);
      setVerticals(verticalsRes.data.filter(v => v.status === 'ACTIVE'));
      setModels(modelsRes.data.filter(m => m.status === 'ACTIVE'));
      setBrands(brandsRes.data.filter(b => b.status === 'ACTIVE'));
    } catch (error) {
      toast.error("Failed to fetch master data");
    }
  };

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API}/sku-management/migration-stats`, { headers: getHeaders() });
      setStats(res.data);
    } catch (error) {
      console.error("Failed to fetch stats");
    }
  };

  const fetchBidsoSKUs = async () => {
    setLoading(true);
    try {
      let url = `${API}/sku-management/bidso-skus?page=${bidsoPage}&page_size=${bidsoPageSize}`;
      if (filterVertical) url += `&vertical_id=${filterVertical}`;
      if (filterModel) url += `&model_id=${filterModel}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
      
      const res = await axios.get(url, { headers: getHeaders() });
      setBidsoSKUs(res.data.items || []);
      setBidsoTotal(res.data.total || 0);
      setBidsoTotalPages(res.data.total_pages || 1);
    } catch (error) {
      toast.error("Failed to fetch Bidso SKUs");
    } finally {
      setLoading(false);
    }
  };

  const fetchBuyerSKUs = async () => {
    setLoading(true);
    try {
      let url = `${API}/sku-management/buyer-skus?page=${buyerPage}&page_size=${buyerPageSize}`;
      if (filterBrand) url += `&brand_id=${filterBrand}`;
      if (selectedBidso) url += `&bidso_sku_id=${selectedBidso.bidso_sku_id}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
      
      const res = await axios.get(url, { headers: getHeaders() });
      setBuyerSKUs(res.data.items || []);
      setBuyerTotal(res.data.total || 0);
      setBuyerTotalPages(res.data.total_pages || 1);
    } catch (error) {
      toast.error("Failed to fetch Buyer SKUs");
    } finally {
      setLoading(false);
    }
  };

  const fetchNextCode = async (verticalId, modelId) => {
    if (!verticalId || !modelId) return;
    try {
      const res = await axios.get(`${API}/sku-management/bidso-skus/next-code?vertical_id=${verticalId}&model_id=${modelId}`, { headers: getHeaders() });
      setSuggestedCode(res.data.suggested_code);
      setPreviewSKUID(res.data.preview_sku_id);
      setBidsoForm(prev => ({ ...prev, numeric_code: res.data.suggested_code }));
    } catch (error) {
      console.error("Failed to get next code");
    }
  };

  // Pagination handlers
  const handleBidsoPageChange = (page) => {
    setBidsoPage(page);
  };

  const handleBidsoPageSizeChange = (size) => {
    setBidsoPageSize(size);
    setBidsoPage(1); // Reset to first page when changing page size
  };

  const handleBuyerPageChange = (page) => {
    setBuyerPage(page);
  };

  const handleBuyerPageSizeChange = (size) => {
    setBuyerPageSize(size);
    setBuyerPage(1);
  };

  // Reset pagination when filters change
  const handleFilterVerticalChange = (value) => {
    setFilterVertical(value);
    setBidsoPage(1);
  };

  const handleFilterModelChange = (value) => {
    setFilterModel(value);
    setBidsoPage(1);
  };

  const handleFilterBrandChange = (value) => {
    setFilterBrand(value);
    setBuyerPage(1);
  };

  const handleSearch = () => {
    if (activeTab === "bidso") {
      setBidsoPage(1);
      fetchBidsoSKUs();
    } else {
      setBuyerPage(1);
      fetchBuyerSKUs();
    }
  };

  const handleCreateBidso = async () => {
    try {
      // Use suggested code if numeric_code is not set
      const payload = {
        ...bidsoForm,
        numeric_code: bidsoForm.numeric_code || suggestedCode
      };
      await axios.post(`${API}/sku-management/bidso-skus`, payload, { headers: getHeaders() });
      toast.success("Bidso SKU created successfully");
      setShowBidsoDialog(false);
      setBidsoForm({ vertical_id: "", model_id: "", numeric_code: "", name: "", description: "" });
      setSuggestedCode("");
      setPreviewSKUID("");
      fetchBidsoSKUs();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create Bidso SKU");
    }
  };

  const handleCreateBuyer = async () => {
    try {
      await axios.post(`${API}/sku-management/buyer-skus`, buyerForm, { headers: getHeaders() });
      toast.success("Buyer SKU created successfully");
      setShowBuyerDialog(false);
      setBuyerForm({ bidso_sku_id: "", brand_id: "", name: "", description: "" });
      fetchBuyerSKUs();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create Buyer SKU");
    }
  };

  const handleBulkCreateBuyerSKUs = async (brandIds) => {
    if (!selectedBidso || brandIds.length === 0) return;
    try {
      const res = await axios.post(
        `${API}/sku-management/buyer-skus/bulk-create?bidso_sku_id=${selectedBidso.bidso_sku_id}`,
        brandIds,
        { headers: getHeaders() }
      );
      toast.success(`Created ${res.data.created} Buyer SKUs, ${res.data.skipped} skipped`);
      setShowBulkCreateDialog(false);
      fetchBuyerSKUs();
      fetchStats();
    } catch (error) {
      toast.error("Failed to bulk create Buyer SKUs");
    }
  };

  const handleViewBOM = async (bidsoSKU) => {
    setSelectedBidso(bidsoSKU);
    try {
      const res = await axios.get(`${API}/sku-management/bom/common/${bidsoSKU.bidso_sku_id}`, { headers: getHeaders() });
      setCommonBOM(res.data.items || []);
      setBomLocked(res.data.is_locked || false);
      setShowBOMDialog(true);
    } catch (error) {
      toast.error("Failed to fetch BOM");
    }
  };

  const handleViewBuyerBOM = async (buyerSKU) => {
    setSelectedBuyerSKU(buyerSKU);
    setBuyerBOMLoading(true);
    setShowBuyerBOMDialog(true);
    try {
      const res = await axios.get(`${API}/sku-management/bom/full/${buyerSKU.buyer_sku_id}`, { headers: getHeaders() });
      setBuyerFullBOM(res.data);
    } catch (error) {
      toast.error("Failed to fetch Buyer SKU BOM");
      setBuyerFullBOM(null);
    } finally {
      setBuyerBOMLoading(false);
    }
  };

  const handleEditBOMItem = async (item) => {
    if (!selectedBuyerSKU) return;
    setEditingBOMItem(item);
    setBomEditForm({
      rm_id: item.rm_id,
      new_rm_id: item.rm_id,
      quantity: item.quantity,
      unit: item.unit || "PCS"
    });
    setScheduleWarning(null);
    
    // Check if scheduled for production in next 10 days
    try {
      const res = await axios.get(
        `${API}/sku-management/bom/buyer-sku/${selectedBuyerSKU.buyer_sku_id}/check-schedule`,
        { headers: getHeaders() }
      );
      if (res.data.is_scheduled) {
        setScheduleWarning({
          count: res.data.schedule_count,
          branches: res.data.branches
        });
      }
    } catch (error) {
      console.error("Failed to check schedule:", error);
    }
    
    setShowBOMEditDialog(true);
  };

  const handleSaveBOMEdit = async () => {
    if (!selectedBuyerSKU || !editingBOMItem) return;
    setBomEditLoading(true);
    
    try {
      const res = await axios.put(
        `${API}/sku-management/bom/buyer-sku/${selectedBuyerSKU.buyer_sku_id}/item`,
        {
          rm_id: editingBOMItem.rm_id,
          new_rm_id: bomEditForm.new_rm_id !== editingBOMItem.rm_id ? bomEditForm.new_rm_id : null,
          quantity: parseFloat(bomEditForm.quantity),
          unit: bomEditForm.unit
        },
        { headers: getHeaders() }
      );
      
      if (res.data.status === "PENDING_APPROVAL") {
        toast.info(res.data.message);
      } else {
        toast.success("BOM item updated successfully");
        // Refresh BOM data
        const bomRes = await axios.get(`${API}/sku-management/bom/full/${selectedBuyerSKU.buyer_sku_id}`, { headers: getHeaders() });
        setBuyerFullBOM(bomRes.data);
      }
      
      setShowBOMEditDialog(false);
      setEditingBOMItem(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update BOM item");
    } finally {
      setBomEditLoading(false);
    }
  };

  const handleDeleteBOMItem = async (item) => {
    if (!selectedBuyerSKU) return;
    if (!confirm(`Are you sure you want to remove ${item.rm_id} from the BOM?`)) return;
    
    try {
      const res = await axios.delete(
        `${API}/sku-management/bom/buyer-sku/${selectedBuyerSKU.buyer_sku_id}/item/${item.rm_id}`,
        { headers: getHeaders() }
      );
      
      if (res.data.status === "PENDING_APPROVAL") {
        toast.info("Removal requires Master Admin approval. Request submitted.");
      } else {
        toast.success("BOM item removed successfully");
        const bomRes = await axios.get(`${API}/sku-management/bom/full/${selectedBuyerSKU.buyer_sku_id}`, { headers: getHeaders() });
        setBuyerFullBOM(bomRes.data);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to remove BOM item");
    }
  };

  const handleLockBOM = async () => {
    if (!selectedBidso) return;
    try {
      await axios.post(`${API}/sku-management/bom/common/${selectedBidso.bidso_sku_id}/lock`, {}, { headers: getHeaders() });
      toast.success("BOM locked successfully");
      setBomLocked(true);
    } catch (error) {
      toast.error("Failed to lock BOM");
    }
  };

  const handleUnlockBOM = async () => {
    if (!selectedBidso) return;
    try {
      await axios.post(`${API}/sku-management/bom/common/${selectedBidso.bidso_sku_id}/unlock`, {}, { headers: getHeaders() });
      toast.success("BOM unlocked");
      setBomLocked(false);
    } catch (error) {
      toast.error("Failed to unlock BOM");
    }
  };

  const getVerticalName = (id) => verticals.find(v => v.id === id)?.name || "";
  const getModelName = (id) => models.find(m => m.id === id)?.name || "";
  const getBrandName = (id) => brands.find(b => b.id === id)?.name || "";
  const getFilteredModels = () => filterVertical ? models.filter(m => m.vertical_id === filterVertical) : models;

  // Edit Buyer SKU (HSN/GST)
  const handleEditBuyerSKU = (sku) => {
    setSelectedBuyerSKU(sku);
    setEditBuyerForm({
      hsn_code: sku.hsn_code || "",
      gst_rate: sku.gst_rate || 18
    });
    setShowEditBuyerDialog(true);
  };

  const handleSaveBuyerHSNGST = async () => {
    if (!selectedBuyerSKU) return;
    
    setEditBuyerLoading(true);
    try {
      await axios.put(
        `${API}/sku-management/buyer-skus/${selectedBuyerSKU.buyer_sku_id}/hsn-gst`,
        {
          hsn_code: editBuyerForm.hsn_code,
          gst_rate: parseFloat(editBuyerForm.gst_rate) || 18
        },
        { headers: getHeaders() }
      );
      
      toast.success(`HSN/GST updated for ${selectedBuyerSKU.buyer_sku_id}`);
      setShowEditBuyerDialog(false);
      fetchBuyerSKUs();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update HSN/GST");
    } finally {
      setEditBuyerLoading(false);
    }
  };

  // Bulk HSN/GST Upload
  const handleDownloadHSNTemplate = () => {
    const template = [
      { buyer_sku_id: "EXAMPLE_SKU_001", hsn_code: "87141090", gst_rate: 18 },
      { buyer_sku_id: "EXAMPLE_SKU_002", hsn_code: "87149990", gst_rate: 18 }
    ];
    
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "HSN_GST_Template");
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(data, 'hsn_gst_template.xlsx');
    toast.success("Template downloaded");
  };

  const handleBulkHSNUpload = async () => {
    if (!bulkHSNFile) {
      toast.error("Please select a file");
      return;
    }
    
    setBulkHSNLoading(true);
    const formData = new FormData();
    formData.append("file", bulkHSNFile);
    
    try {
      const res = await axios.post(`${API}/sku-management/buyer-skus/bulk-hsn-gst`, formData, {
        headers: { ...getHeaders(), "Content-Type": "multipart/form-data" }
      });
      
      toast.success(`Updated ${res.data.updated} SKUs, ${res.data.errors?.length || 0} errors`);
      setShowBulkHSNDialog(false);
      setBulkHSNFile(null);
      fetchBuyerSKUs();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to upload HSN/GST data");
    } finally {
      setBulkHSNLoading(false);
    }
  };

  // Data Sync Functions
  const handleExportData = async () => {
    setExportLoading(true);
    try {
      const response = await axios.get(`${API}/demand-hub/export-all-sku-data/download`, {
        headers: getHeaders(),
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `sku_data_export_${new Date().toISOString().slice(0,10)}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Data exported successfully');
    } catch (error) {
      toast.error('Failed to export data');
    }
    setExportLoading(false);
  };

  const handleImportData = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setSyncLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post(`${API}/demand-hub/import-sku-data/upload`, formData, {
        headers: { ...getHeaders(), 'Content-Type': 'multipart/form-data' }
      });
      
      const results = response.data.results;
      const summary = Object.entries(results)
        .map(([key, val]) => `${key}: ${val.imported} imported, ${val.skipped} skipped`)
        .join('\n');
      
      toast.success('Data imported successfully', { description: summary });
      setShowSyncDialog(false);
      fetchMasterData();
      fetchBidsoSKUs();
      fetchBuyerSKUs();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to import data');
    }
    setSyncLoading(false);
    event.target.value = '';
  };

  // BOM Upload Functions
  const handleDownloadBOMTemplate = async () => {
    try {
      const response = await axios.get(`${API}/sku-management/bom/bulk-upload/template`, {
        headers: getHeaders(),
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'BOM_Upload_Template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Template downloaded');
    } catch (error) {
      toast.error('Failed to download template');
    }
  };

  const handleBOMUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setBomUploadLoading(true);
    setBomUploadResult(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post(`${API}/sku-management/bom/bulk-upload`, formData, {
        headers: { ...getHeaders(), 'Content-Type': 'multipart/form-data' }
      });
      
      setBomUploadResult(response.data);
      
      // Show appropriate toast based on success status
      if (response.data.success === false) {
        toast.error('BOM upload failed - see errors below');
      } else if (response.data.errors?.length > 0) {
        toast.warning(`BOM upload completed with ${response.data.errors.length} errors`);
      } else {
        toast.success('BOM upload completed successfully');
      }
      
      fetchBidsoSKUs();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload BOM');
      // Also set the result if there's error data in the response
      if (error.response?.data) {
        setBomUploadResult(error.response.data);
      }
    }
    
    setBomUploadLoading(false);
    event.target.value = '';
  };

  const handleExportBOM = async () => {
    try {
      const response = await axios.get(`${API}/sku-management/bom/export`, {
        headers: getHeaders(),
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `BOM_Export_${new Date().toISOString().slice(0,10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('BOM data exported');
    } catch (error) {
      toast.error('Failed to export BOM');
    }
  };

  // Bulk Delete Handlers
  const handleBulkDeleteFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setBulkDeleteFile(file);
    setBulkDeleteLoading(true);
    setBulkDeletePreview(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post(`${API}/sku-management/buyer-skus/bulk-delete/preview`, formData, {
        headers: getHeaders()
      });
      
      setBulkDeletePreview(response.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to preview delete file');
      setBulkDeleteFile(null);
    }
    setBulkDeleteLoading(false);
    e.target.value = null;
  };

  const handleConfirmBulkDelete = async () => {
    if (!bulkDeleteFile) return;
    
    setBulkDeleteLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', bulkDeleteFile);
      
      const response = await axios.post(`${API}/sku-management/buyer-skus/bulk-delete/confirm`, formData, {
        headers: getHeaders()
      });
      
      toast.success(`Deleted ${response.data.deleted} Buyer SKUs`);
      setShowBulkDeleteDialog(false);
      setBulkDeletePreview(null);
      setBulkDeleteFile(null);
      fetchBuyerSKUs();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete');
    }
    setBulkDeleteLoading(false);
  };

  const closeBulkDeleteDialog = () => {
    setShowBulkDeleteDialog(false);
    setBulkDeletePreview(null);
    setBulkDeleteFile(null);
  };

  return (
    <div className="p-6 space-y-6" data-testid="sku-management-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SKU Management</h1>
          <p className="text-gray-500 mt-1">Manage Bidso SKUs (base products) and Buyer SKUs (branded variants)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowBOMUploadDialog(true)} data-testid="bom-upload-btn">
            <Upload className="h-4 w-4 mr-2" />
            BOM Upload
          </Button>
          <Button variant="outline" onClick={() => setShowSyncDialog(true)} data-testid="sync-data-btn">
            <Database className="h-4 w-4 mr-2" />
            Data Sync
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Bidso SKUs</p>
                <p className="text-2xl font-bold">{stats.bidso_skus}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Layers className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Buyer SKUs</p>
                <p className="text-2xl font-bold">{stats.buyer_skus}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FileSpreadsheet className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Common BOMs</p>
                <p className="text-2xl font-bold">{stats.common_boms}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Layers className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Brands</p>
                <p className="text-2xl font-bold">{brands.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="bidso" data-testid="bidso-tab">
            <Package className="h-4 w-4 mr-2" />
            Bidso SKUs (Base Products)
          </TabsTrigger>
          <TabsTrigger value="buyer" data-testid="buyer-tab">
            <Layers className="h-4 w-4 mr-2" />
            Buyer SKUs (Branded Variants)
          </TabsTrigger>
        </TabsList>

        {/* Bidso SKUs Tab */}
        <TabsContent value="bidso" className="space-y-4">
          {/* Filters & Actions */}
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-3 flex-wrap">
              <Select value={filterVertical} onValueChange={(v) => { handleFilterVerticalChange(v === "all" ? "" : v); setFilterModel(""); }}>
                <SelectTrigger className="w-[180px]" data-testid="filter-vertical">
                  <SelectValue placeholder="All Verticals" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Verticals</SelectItem>
                  {verticals.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.code} - {v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={filterModel} onValueChange={(v) => handleFilterModelChange(v === "all" ? "" : v)} disabled={!filterVertical}>
                <SelectTrigger className="w-[180px]" data-testid="filter-model">
                  <SelectValue placeholder="All Models" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Models</SelectItem>
                  {getFilteredModels().map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.code} - {m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search SKU ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10 w-[200px]"
                  data-testid="search-input"
                />
              </div>
              
              <Button variant="outline" onClick={handleSearch}>
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>
            
            <Button onClick={() => setShowBidsoDialog(true)} data-testid="create-bidso-btn">
              <Plus className="h-4 w-4 mr-2" />
              Create Bidso SKU
            </Button>
          </div>

          {/* Bidso SKUs Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bidso SKU ID</TableHead>
                    <TableHead>Vertical</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Buyer SKUs</TableHead>
                    <TableHead>BOM Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : bidsoSKUs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        No Bidso SKUs found. Create your first one!
                      </TableCell>
                    </TableRow>
                  ) : (
                    bidsoSKUs.map(sku => (
                      <TableRow key={sku.id} data-testid={`bidso-row-${sku.bidso_sku_id}`}>
                        <TableCell>
                          <span className="font-mono font-medium text-blue-600">{sku.bidso_sku_id}</span>
                        </TableCell>
                        <TableCell>{sku.vertical_name || sku.vertical_code}</TableCell>
                        <TableCell>{sku.model_name || sku.model_code}</TableCell>
                        <TableCell>{sku.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{sku.buyer_sku_count || 0} variants</Badge>
                        </TableCell>
                        <TableCell>
                          {sku.has_bom ? (
                            sku.bom_locked ? (
                              <Badge className="bg-green-100 text-green-700">
                                <Lock className="h-3 w-3 mr-1" />
                                Locked
                              </Badge>
                            ) : (
                              <Badge variant="outline">BOM Set</Badge>
                            )
                          ) : (
                            <Badge variant="outline" className="text-gray-400">No BOM</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleViewBOM(sku)}
                              data-testid={`view-bom-${sku.bidso_sku_id}`}
                            >
                              <FileSpreadsheet className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setSelectedBidso(sku);
                                setBuyerForm({ ...buyerForm, bidso_sku_id: sku.bidso_sku_id });
                                setShowBuyerDialog(true);
                              }}
                              data-testid={`add-buyer-${sku.bidso_sku_id}`}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setSelectedBidso(sku);
                                setShowBulkCreateDialog(true);
                              }}
                              data-testid={`bulk-create-${sku.bidso_sku_id}`}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {/* Pagination for Bidso SKUs */}
              <Pagination
                currentPage={bidsoPage}
                totalPages={bidsoTotalPages}
                totalItems={bidsoTotal}
                pageSize={bidsoPageSize}
                onPageChange={handleBidsoPageChange}
                onPageSizeChange={handleBidsoPageSizeChange}
                loading={loading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Buyer SKUs Tab */}
        <TabsContent value="buyer" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-3 flex-wrap">
              <Select value={filterBrand} onValueChange={(v) => handleFilterBrandChange(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[180px]" data-testid="filter-brand">
                  <SelectValue placeholder="All Brands" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Brands</SelectItem>
                  {brands.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.code} - {b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search Buyer SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10 w-[200px]"
                />
              </div>
              
              <Button variant="outline" onClick={handleSearch}>
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => setShowBulkDeleteDialog(true)}
                data-testid="bulk-delete-btn"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Bulk Delete
              </Button>
              <Button 
                variant="outline"
                onClick={() => setShowBulkHSNDialog(true)}
                data-testid="bulk-hsn-btn"
              >
                <Upload className="h-4 w-4 mr-2" />
                Bulk HSN/GST
              </Button>
            </div>
          </div>

          {/* Buyer SKUs Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Buyer SKU ID</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>HSN Code</TableHead>
                    <TableHead>GST %</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : buyerSKUs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        No Buyer SKUs found. Create from a Bidso SKU first.
                      </TableCell>
                    </TableRow>
                  ) : (
                    buyerSKUs.map(sku => (
                      <TableRow key={sku.id} data-testid={`buyer-row-${sku.buyer_sku_id}`}>
                        <TableCell>
                          <span className="font-mono font-medium text-green-600">{sku.buyer_sku_id}</span>
                        </TableCell>
                        <TableCell>
                          <Badge>{sku.brand_code}</Badge>
                          <span className="ml-2 text-sm text-gray-500">{sku.brand_name}</span>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={sku.name}>{sku.name}</TableCell>
                        <TableCell>
                          {sku.hsn_code ? (
                            <span className="font-mono text-sm">{sku.hsn_code}</span>
                          ) : (
                            <span className="text-amber-500 text-xs">Not set</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {sku.gst_rate ? (
                            <Badge variant="outline">{sku.gst_rate}%</Badge>
                          ) : (
                            <span className="text-amber-500 text-xs">Not set</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={sku.status === 'ACTIVE' ? 'default' : 'secondary'}>
                            {sku.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleViewBuyerBOM(sku)}
                              data-testid={`view-bom-${sku.buyer_sku_id}`}
                              title="View Full BOM"
                            >
                              <FileSpreadsheet className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              title="Edit HSN/GST"
                              onClick={() => handleEditBuyerSKU(sku)}
                              data-testid={`edit-hsn-${sku.buyer_sku_id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {/* Pagination for Buyer SKUs */}
              <Pagination
                currentPage={buyerPage}
                totalPages={buyerTotalPages}
                totalItems={buyerTotal}
                pageSize={buyerPageSize}
                onPageChange={handleBuyerPageChange}
                onPageSizeChange={handleBuyerPageSizeChange}
                loading={loading}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Bidso SKU Dialog */}
      <Dialog open={showBidsoDialog} onOpenChange={setShowBidsoDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Bidso SKU</DialogTitle>
            <DialogDescription>
              Create a base product (Bidso SKU) that can have multiple branded variants (Buyer SKUs).
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Vertical *</Label>
                <Select 
                  value={bidsoForm.vertical_id} 
                  onValueChange={(v) => {
                    setBidsoForm({ ...bidsoForm, vertical_id: v, model_id: "" });
                    setSuggestedCode("");
                    setPreviewSKUID("");
                  }}
                >
                  <SelectTrigger data-testid="bidso-vertical-select">
                    <SelectValue placeholder="Select Vertical" />
                  </SelectTrigger>
                  <SelectContent>
                    {verticals.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.code} - {v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Model *</Label>
                <Select 
                  value={bidsoForm.model_id} 
                  onValueChange={(v) => {
                    setBidsoForm({ ...bidsoForm, model_id: v });
                    fetchNextCode(bidsoForm.vertical_id, v);
                  }}
                  disabled={!bidsoForm.vertical_id}
                >
                  <SelectTrigger data-testid="bidso-model-select">
                    <SelectValue placeholder="Select Model" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.filter(m => m.vertical_id === bidsoForm.vertical_id).map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.code} - {m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label>Numeric Code (Auto-generated)</Label>
              <div className="flex gap-2">
                <Input 
                  value={bidsoForm.numeric_code || suggestedCode || ""}
                  readOnly
                  disabled
                  className="bg-gray-100 font-mono"
                  placeholder="Select Model to generate"
                  data-testid="bidso-numeric-code"
                />
                {suggestedCode && (
                  <Badge variant="outline" className="whitespace-nowrap bg-green-50 text-green-700">
                    Auto: {suggestedCode}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">Numeric code is auto-generated based on sequence</p>
            </div>
            
            {previewSKUID && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600">Preview SKU ID:</p>
                <p className="text-lg font-mono font-bold text-blue-600">{previewSKUID}</p>
              </div>
            )}
            
            <div>
              <Label>Name</Label>
              <Input 
                value={bidsoForm.name}
                onChange={(e) => setBidsoForm({ ...bidsoForm, name: e.target.value })}
                placeholder="Product name"
                data-testid="bidso-name"
              />
            </div>
            
            <div>
              <Label>Description</Label>
              <Input 
                value={bidsoForm.description}
                onChange={(e) => setBidsoForm({ ...bidsoForm, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowBidsoDialog(false)}>Cancel</Button>
              <Button 
                onClick={handleCreateBidso}
                disabled={!bidsoForm.vertical_id || !bidsoForm.model_id}
                data-testid="create-bidso-submit"
              >
                Create Bidso SKU
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Buyer SKU Dialog */}
      <Dialog open={showBuyerDialog} onOpenChange={setShowBuyerDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Buyer SKU</DialogTitle>
            <DialogDescription>
              Create a branded variant of {selectedBidso?.bidso_sku_id || "a Bidso SKU"}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            {selectedBidso && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Parent Bidso SKU:</p>
                <p className="font-mono font-bold text-blue-600">{selectedBidso.bidso_sku_id}</p>
                <p className="text-sm text-gray-500">{selectedBidso.name}</p>
              </div>
            )}
            
            <div>
              <Label>Brand *</Label>
              <Select 
                value={buyerForm.brand_id} 
                onValueChange={(v) => setBuyerForm({ ...buyerForm, brand_id: v })}
              >
                <SelectTrigger data-testid="buyer-brand-select">
                  <SelectValue placeholder="Select Brand" />
                </SelectTrigger>
                <SelectContent>
                  {brands.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.code} - {b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {buyerForm.brand_id && selectedBidso && (
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-sm text-gray-600">Buyer SKU ID will be:</p>
                <p className="text-lg font-mono font-bold text-green-600">
                  {brands.find(b => b.id === buyerForm.brand_id)?.code}_{selectedBidso.bidso_sku_id}
                </p>
              </div>
            )}
            
            <div>
              <Label>Name (optional)</Label>
              <Input 
                value={buyerForm.name}
                onChange={(e) => setBuyerForm({ ...buyerForm, name: e.target.value })}
                placeholder="Auto-generated from brand + product"
              />
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowBuyerDialog(false)}>Cancel</Button>
              <Button 
                onClick={handleCreateBuyer}
                disabled={!buyerForm.brand_id || !buyerForm.bidso_sku_id}
                data-testid="create-buyer-submit"
              >
                Create Buyer SKU
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Create Buyer SKUs Dialog */}
      <Dialog open={showBulkCreateDialog} onOpenChange={setShowBulkCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Create Buyer SKUs</DialogTitle>
            <DialogDescription>
              Create Buyer SKUs for multiple brands from {selectedBidso?.bidso_sku_id}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <p className="text-sm text-gray-600">Select brands to create Buyer SKUs:</p>
            
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {brands.map(brand => (
                <label 
                  key={brand.id} 
                  className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50 cursor-pointer"
                >
                  <input 
                    type="checkbox" 
                    id={`brand-${brand.id}`}
                    className="rounded"
                    data-brand-id={brand.id}
                  />
                  <span className="font-mono text-sm">{brand.code}</span>
                  <span className="text-sm text-gray-500">{brand.name}</span>
                </label>
              ))}
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowBulkCreateDialog(false)}>Cancel</Button>
              <Button 
                onClick={() => {
                  const selectedBrands = Array.from(document.querySelectorAll('[data-brand-id]:checked'))
                    .map(el => el.dataset.brandId);
                  handleBulkCreateBuyerSKUs(selectedBrands);
                }}
                data-testid="bulk-create-submit"
              >
                Create Selected
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View BOM Dialog */}
      <Dialog open={showBOMDialog} onOpenChange={setShowBOMDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Common BOM - {selectedBidso?.bidso_sku_id}</DialogTitle>
            <DialogDescription>
              This BOM is shared by all Buyer SKU variants of this Bidso SKU.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {bomLocked ? (
                  <Badge className="bg-green-100 text-green-700">
                    <Lock className="h-3 w-3 mr-1" />
                    BOM Locked
                  </Badge>
                ) : (
                  <Badge variant="outline">BOM Editable</Badge>
                )}
              </div>
              
              <div className="flex gap-2">
                {bomLocked ? (
                  <Button variant="outline" size="sm" onClick={handleUnlockBOM}>
                    <Unlock className="h-4 w-4 mr-2" />
                    Unlock BOM
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={handleLockBOM} disabled={commonBOM.length === 0}>
                    <Lock className="h-4 w-4 mr-2" />
                    Lock BOM
                  </Button>
                )}
              </div>
            </div>
            
            <Separator />
            
            {commonBOM.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileSpreadsheet className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>No BOM items defined yet.</p>
                <p className="text-sm">Add raw materials to define the common BOM.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>RM ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Unit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commonBOM.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono">{item.rm_id}</TableCell>
                      <TableCell>{item.rm_name || "-"}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* View Buyer SKU Full BOM Dialog */}
      <Dialog open={showBuyerBOMDialog} onOpenChange={setShowBuyerBOMDialog}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Full BOM - {selectedBuyerSKU?.buyer_sku_id}
            </DialogTitle>
            <DialogDescription>
              Complete Bill of Materials for this Buyer SKU (Common + Brand-Specific)
            </DialogDescription>
          </DialogHeader>
          
          {buyerBOMLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : buyerFullBOM ? (
            <div className="flex-1 overflow-y-auto space-y-6 mt-4 pr-2">
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 bg-blue-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-700">{buyerFullBOM.total_items?.length || 0}</p>
                  <p className="text-xs text-blue-600">Total Items</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-gray-700">{buyerFullBOM.common_items?.length || 0}</p>
                  <p className="text-xs text-gray-600">Common Items</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-700">{buyerFullBOM.brand_specific_items?.length || 0}</p>
                  <p className="text-xs text-green-600">Brand-Specific</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg text-center">
                  <p className="text-sm font-mono font-bold text-purple-700">{buyerFullBOM.bidso_sku_id}</p>
                  <p className="text-xs text-purple-600">Parent Bidso SKU</p>
                </div>
              </div>
              
              <Separator />
              
              {/* Common BOM Section */}
              <div>
                <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Common BOM (from {buyerFullBOM.bidso_sku_id})
                  {buyerFullBOM.is_common_bom_locked && (
                    <Badge className="bg-green-100 text-green-700 text-xs">
                      <Lock className="h-3 w-3 mr-1" />
                      Locked
                    </Badge>
                  )}
                </h4>
                {buyerFullBOM.common_items?.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="w-[120px]">RM ID</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="w-[80px] text-right">Qty</TableHead>
                          <TableHead className="w-[60px]">Unit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {buyerFullBOM.common_items.map((item, idx) => (
                          <TableRow key={`common-${idx}`}>
                            <TableCell className="font-mono text-sm">{item.rm_id}</TableCell>
                            <TableCell className="text-sm text-gray-600">{item.rm_name || "-"}</TableCell>
                            <TableCell className="text-right font-medium">{item.quantity}</TableCell>
                            <TableCell className="text-sm text-gray-500">{item.unit}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">No common BOM items defined for the parent Bidso SKU.</p>
                )}
              </div>
              
              {/* Brand-Specific BOM Section */}
              <div>
                <h4 className="font-medium text-green-700 mb-2 flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Brand-Specific BOM ({buyerFullBOM.brand_code})
                  <Badge variant="outline" className="ml-2 text-xs">Editable</Badge>
                </h4>
                {buyerFullBOM.brand_specific_items?.length > 0 ? (
                  <div className="border border-green-200 rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-green-50">
                          <TableHead className="w-[120px]">RM ID</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="w-[80px] text-right">Qty</TableHead>
                          <TableHead className="w-[60px]">Unit</TableHead>
                          <TableHead className="w-[80px] text-center">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {buyerFullBOM.brand_specific_items.map((item, idx) => (
                          <TableRow key={`brand-${idx}`} className="bg-green-50/30 group">
                            <TableCell className="font-mono text-sm text-green-700">{item.rm_id}</TableCell>
                            <TableCell className="text-sm text-gray-600">{item.rm_name || "-"}</TableCell>
                            <TableCell className="text-right font-medium">{item.quantity}</TableCell>
                            <TableCell className="text-sm text-gray-500">{item.unit}</TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() => handleEditBOMItem(item)}
                                  title="Edit item"
                                  data-testid={`edit-bom-item-${item.rm_id}`}
                                >
                                  <Edit className="h-3.5 w-3.5 text-blue-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() => handleDeleteBOMItem(item)}
                                  title="Remove item"
                                  data-testid={`delete-bom-item-${item.rm_id}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-red-600" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">No brand-specific BOM items defined for this Buyer SKU.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>Failed to load BOM data.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* BOM Item Edit Dialog */}
      <Dialog open={showBOMEditDialog} onOpenChange={setShowBOMEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Edit BOM Item
            </DialogTitle>
            <DialogDescription>
              Modify the brand-specific BOM item for {selectedBuyerSKU?.buyer_sku_id}
            </DialogDescription>
          </DialogHeader>
          
          {scheduleWarning && (
            <Alert className="bg-amber-50 border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                <strong>Production Scheduled!</strong> This SKU is scheduled for production at {scheduleWarning.count} location(s) 
                in the next 10 days ({scheduleWarning.branches.join(", ")}). 
                <br />
                <span className="text-sm">This change will require <strong>Master Admin approval</strong> and notify CPC & Branch Ops.</span>
              </AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-4 py-4">
            <div>
              <Label>Current RM ID</Label>
              <Input value={editingBOMItem?.rm_id || ""} disabled className="bg-gray-50 font-mono" />
            </div>
            
            <div>
              <Label>New RM ID (leave same if not changing)</Label>
              <Input 
                value={bomEditForm.new_rm_id} 
                onChange={(e) => setBomEditForm({...bomEditForm, new_rm_id: e.target.value.toUpperCase()})}
                placeholder="e.g., LB_001"
                className="font-mono"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Quantity *</Label>
                <Input 
                  type="number"
                  step="0.01"
                  min="0"
                  value={bomEditForm.quantity} 
                  onChange={(e) => setBomEditForm({...bomEditForm, quantity: e.target.value})}
                />
              </div>
              <div>
                <Label>Unit *</Label>
                <Select value={bomEditForm.unit} onValueChange={(v) => setBomEditForm({...bomEditForm, unit: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PCS">PCS</SelectItem>
                    <SelectItem value="nos">nos</SelectItem>
                    <SelectItem value="KG">KG</SelectItem>
                    <SelectItem value="MTR">MTR</SelectItem>
                    <SelectItem value="SET">SET</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBOMEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveBOMEdit} disabled={bomEditLoading}>
              {bomEditLoading ? "Saving..." : scheduleWarning ? "Submit for Approval" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Data Sync Dialog */}
      <Dialog open={showSyncDialog} onOpenChange={setShowSyncDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Data Sync</DialogTitle>
            <DialogDescription>
              Export data from preview or import data to production
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Export Section */}
            <div className="p-4 border rounded-lg bg-blue-50">
              <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                <Download className="h-5 w-5" />
                Export Data (Preview → File)
              </h4>
              <p className="text-sm text-blue-700 mb-3">
                Download all SKU data as a JSON file. Use this on the preview environment.
              </p>
              <Button 
                onClick={handleExportData} 
                disabled={exportLoading}
                className="w-full"
                variant="outline"
              >
                {exportLoading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Download Export File
              </Button>
            </div>

            {/* Import Section */}
            <div className="p-4 border rounded-lg bg-green-50">
              <h4 className="font-medium text-green-900 mb-2 flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Import Data (File → Database)
              </h4>
              <p className="text-sm text-green-700 mb-3">
                Upload the exported JSON file to import all SKU data. Use this on production.
              </p>
              <input
                type="file"
                accept=".json"
                ref={syncFileInputRef}
                onChange={handleImportData}
                className="hidden"
              />
              <Button 
                onClick={() => syncFileInputRef.current?.click()} 
                disabled={syncLoading}
                className="w-full"
                variant="outline"
              >
                {syncLoading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Upload Import File
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSyncDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BOM Upload Dialog */}
      <Dialog open={showBOMUploadDialog} onOpenChange={setShowBOMUploadDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Bulk BOM Upload
            </DialogTitle>
            <DialogDescription>
              Upload Bill of Materials for multiple SKUs at once
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Download Template */}
            <div className="p-4 border rounded-lg bg-gray-50">
              <h4 className="font-medium mb-2">Step 1: Download Template</h4>
              <p className="text-sm text-gray-600 mb-3">
                Get the Excel template with instructions and sample data.
              </p>
              <Button variant="outline" onClick={handleDownloadBOMTemplate} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Download BOM Template
              </Button>
            </div>

            {/* Upload BOM */}
            <div className="p-4 border rounded-lg bg-blue-50">
              <h4 className="font-medium text-blue-900 mb-2">Step 2: Upload Filled Template</h4>
              <p className="text-sm text-blue-700 mb-3">
                Fill in the template and upload. For Buyer SKU BOM:<br/>
                • Items marked <strong>NOT brand-specific</strong> → Common BOM (Bidso SKU)<br/>
                • Items marked <strong>brand-specific</strong> → Brand-specific BOM
              </p>
              <input
                type="file"
                accept=".xlsx,.xls"
                ref={bomFileInputRef}
                onChange={handleBOMUpload}
                className="hidden"
              />
              <Button 
                onClick={() => bomFileInputRef.current?.click()} 
                disabled={bomUploadLoading}
                className="w-full"
              >
                {bomUploadLoading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Upload BOM Excel
              </Button>
            </div>

            {/* Export Existing BOM */}
            <div className="p-4 border rounded-lg bg-green-50">
              <h4 className="font-medium text-green-900 mb-2">Export Existing BOM</h4>
              <p className="text-sm text-green-700 mb-3">
                Download all current BOM data as Excel.
              </p>
              <Button variant="outline" onClick={handleExportBOM} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Export All BOM Data
              </Button>
            </div>

            {/* Upload Results */}
            {bomUploadResult && (
              <div className="p-4 border rounded-lg bg-white">
                <h4 className="font-medium mb-2">Upload Results</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="p-2 bg-blue-100 rounded">
                    <span className="font-medium">{bomUploadResult.buyer_sku_processed}</span>
                    <span className="text-gray-600 ml-1">Buyer SKUs processed</span>
                  </div>
                  <div className="p-2 bg-purple-100 rounded">
                    <span className="font-medium">{bomUploadResult.bidso_sku_processed}</span>
                    <span className="text-gray-600 ml-1">Bidso SKUs processed</span>
                  </div>
                  <div className="p-2 bg-green-100 rounded">
                    <span className="font-medium">{bomUploadResult.common_bom_updated}</span>
                    <span className="text-gray-600 ml-1">Common BOMs updated</span>
                  </div>
                  <div className="p-2 bg-orange-100 rounded">
                    <span className="font-medium">{bomUploadResult.brand_bom_updated}</span>
                    <span className="text-gray-600 ml-1">Brand BOMs updated</span>
                  </div>
                </div>
                {bomUploadResult.errors?.length > 0 && (
                  <div className="mt-3">
                    <h5 className="text-sm font-medium text-red-600">Errors:</h5>
                    <ul className="text-xs text-red-500 max-h-32 overflow-y-auto">
                      {bomUploadResult.errors.slice(0, 10).map((err, i) => (
                        <li key={i}>• {err}</li>
                      ))}
                      {bomUploadResult.errors.length > 10 && (
                        <li>... and {bomUploadResult.errors.length - 10} more</li>
                      )}
                    </ul>
                  </div>
                )}
                {bomUploadResult.warnings?.length > 0 && (
                  <div className="mt-3">
                    <h5 className="text-sm font-medium text-yellow-600">Warnings:</h5>
                    <ul className="text-xs text-yellow-600 max-h-32 overflow-y-auto">
                      {bomUploadResult.warnings.slice(0, 5).map((w, i) => (
                        <li key={i}>• {w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowBOMUploadDialog(false); setBomUploadResult(null); }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Dialog */}
      <Dialog open={showBulkDeleteDialog} onOpenChange={closeBulkDeleteDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Bulk Delete Buyer SKUs
            </DialogTitle>
            <DialogDescription>
              Upload a file containing Buyer SKU IDs to delete. Supports Excel (.xlsx) with 'buyer_sku_id' column or text file with one ID per line.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* File Upload */}
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <input
                type="file"
                ref={bulkDeleteFileRef}
                onChange={handleBulkDeleteFileSelect}
                accept=".xlsx,.xls,.csv,.txt"
                className="hidden"
              />
              <Upload className="h-10 w-10 mx-auto text-gray-400 mb-3" />
              <p className="text-sm text-gray-600 mb-2">
                {bulkDeleteFile ? bulkDeleteFile.name : 'Upload file with SKU IDs to delete'}
              </p>
              <Button
                variant="outline"
                onClick={() => bulkDeleteFileRef.current?.click()}
                disabled={bulkDeleteLoading}
              >
                {bulkDeleteLoading ? 'Processing...' : 'Select File'}
              </Button>
            </div>

            {/* Preview Results */}
            {bulkDeletePreview && (
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">Preview Summary</p>
                    <p className="text-sm text-gray-500">{bulkDeletePreview.message}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-red-600">{bulkDeletePreview.found}</p>
                    <p className="text-xs text-gray-500">SKUs to delete</p>
                  </div>
                </div>

                {bulkDeletePreview.found > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="max-h-[250px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-red-50">
                            <TableHead className="text-red-700">#</TableHead>
                            <TableHead className="text-red-700">Buyer SKU ID</TableHead>
                            <TableHead className="text-red-700">Brand</TableHead>
                            <TableHead className="text-red-700">Name</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bulkDeletePreview.skus_to_delete.map((sku, idx) => (
                            <TableRow key={sku.buyer_sku_id}>
                              <TableCell className="text-gray-500">{idx + 1}</TableCell>
                              <TableCell className="font-mono font-medium">{sku.buyer_sku_id}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{sku.brand_code || '-'}</Badge>
                              </TableCell>
                              <TableCell className="truncate max-w-[200px]">{sku.name || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {bulkDeletePreview.not_found > 0 && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm font-medium text-yellow-700">
                      {bulkDeletePreview.not_found} SKU IDs not found or already inactive
                    </p>
                    <p className="text-xs text-yellow-600 mt-1">
                      {bulkDeletePreview.not_found_ids?.slice(0, 5).join(', ')}
                      {bulkDeletePreview.not_found > 5 && '...'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeBulkDeleteDialog}>
              Cancel
            </Button>
            {bulkDeletePreview?.found > 0 && (
              <Button
                variant="destructive"
                onClick={handleConfirmBulkDelete}
                disabled={bulkDeleteLoading}
              >
                {bulkDeleteLoading ? 'Deleting...' : `Delete ${bulkDeletePreview.found} SKUs`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Buyer SKU HSN/GST Dialog */}
      <Dialog open={showEditBuyerDialog} onOpenChange={setShowEditBuyerDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit HSN/GST</DialogTitle>
            <DialogDescription>
              Update tax details for {selectedBuyerSKU?.buyer_sku_id}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm text-gray-600">{selectedBuyerSKU?.name}</p>
              <p className="text-xs text-gray-400">Brand: {selectedBuyerSKU?.brand_code}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>HSN Code</Label>
                <Input
                  placeholder="e.g., 87141090"
                  value={editBuyerForm.hsn_code}
                  onChange={(e) => setEditBuyerForm({ ...editBuyerForm, hsn_code: e.target.value })}
                  data-testid="hsn-code-input"
                />
                <p className="text-xs text-gray-400 mt-1">8-digit HSN code</p>
              </div>
              <div>
                <Label>GST Rate (%)</Label>
                <Select 
                  value={String(editBuyerForm.gst_rate)} 
                  onValueChange={(v) => setEditBuyerForm({ ...editBuyerForm, gst_rate: parseInt(v) })}
                >
                  <SelectTrigger data-testid="gst-rate-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0% (Exempt)</SelectItem>
                    <SelectItem value="5">5%</SelectItem>
                    <SelectItem value="12">12%</SelectItem>
                    <SelectItem value="18">18%</SelectItem>
                    <SelectItem value="28">28%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditBuyerDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveBuyerHSNGST} disabled={editBuyerLoading}>
              {editBuyerLoading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk HSN/GST Upload Dialog */}
      <Dialog open={showBulkHSNDialog} onOpenChange={setShowBulkHSNDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Upload HSN/GST</DialogTitle>
            <DialogDescription>
              Upload an Excel file to update HSN codes and GST rates for multiple SKUs
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-700 mb-2">Template Format</h4>
              <p className="text-sm text-blue-600 mb-3">
                Excel must have columns: <code className="bg-blue-100 px-1 rounded">buyer_sku_id</code>, <code className="bg-blue-100 px-1 rounded">hsn_code</code>, <code className="bg-blue-100 px-1 rounded">gst_rate</code>
              </p>
              <Button variant="outline" size="sm" onClick={handleDownloadHSNTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
            </div>
            
            <div>
              <Label>Select Excel File</Label>
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setBulkHSNFile(e.target.files?.[0] || null)}
                className="mt-1"
                data-testid="hsn-upload-input"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowBulkHSNDialog(false); setBulkHSNFile(null); }}>
              Cancel
            </Button>
            <Button onClick={handleBulkHSNUpload} disabled={bulkHSNLoading || !bulkHSNFile}>
              {bulkHSNLoading ? "Uploading..." : "Upload & Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SKUManagement;

import { useState, useEffect, useRef } from "react";
import axios from "axios";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { 
  Package, Search, Filter, Tag, Check, X, Edit, 
  ChevronDown, ChevronRight, Bell, Clock, CheckCircle,
  XCircle, AlertCircle, Layers, Box, Copy, Eye, Download,
  Upload, Plus, Trash2, Database
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import Pagination from "../components/Pagination";
import useAuthStore from "@/store/authStore";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Helper to convert database category to frontend format
const convertDbCategory = (dbCat) => {
  const fields = (dbCat.description_columns || []).map(col => col.key);
  const nameFormat = (dbCat.description_columns || [])
    .filter(col => col.include_in_name)
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map(col => col.key);
  
  return {
    name: dbCat.name,
    fields: fields,
    nameFormat: nameFormat,
    description_columns: dbCat.description_columns || [],
    default_uom: dbCat.default_uom,
    rm_id_prefix: dbCat.rm_id_prefix
  };
};

// Helper function to get category display name
const getCategoryName = (code, rmCategories) => {
  return rmCategories[code]?.name || code;
};

const RMRepository = () => {
  const [activeTab, setActiveTab] = useState("repository");
  const { hasRole, isMasterAdmin } = useAuthStore();
  const isAdmin = isMasterAdmin();
  const canManageRMs = isAdmin || hasRole('TECH_OPS_ENGINEER');
  
  // RM Categories from database (Tech Ops is single source of truth)
  const [rmCategories, setRmCategories] = useState({});
  
  // File input refs for upload
  const fileInputRef = useRef(null);
  const migrateFileInputRef = useRef(null);
  
  // Data
  const [materials, setMaterials] = useState([]);
  const [brands, setBrands] = useState([]);
  const [verticals, setVerticals] = useState([]);
  const [models, setModels] = useState([]);
  const [rmRequests, setRmRequests] = useState([]);
  const [buyerSkuRequests, setBuyerSkuRequests] = useState([]);
  const [bidsoCloneRequests, setBidsoCloneRequests] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingSkuCount, setPendingSkuCount] = useState(0);
  const [pendingCloneCount, setPendingCloneCount] = useState(0);
  
  // Clone request detail
  const [showCloneDetailDialog, setShowCloneDetailDialog] = useState(false);
  const [selectedCloneRequest, setSelectedCloneRequest] = useState(null);
  
  // Clone rejection dialog
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectingRequestId, setRejectingRequestId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  
  // Clone approval result dialog
  const [showApprovalResultDialog, setShowApprovalResultDialog] = useState(false);
  const [approvalResult, setApprovalResult] = useState(null);
  
  // Add RM dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showCreatedDialog, setShowCreatedDialog] = useState(false);
  const [showMigrateDialog, setShowMigrateDialog] = useState(false);
  const [createdRMs, setCreatedRMs] = useState([]);
  const [migrating, setMigrating] = useState(false);
  const [selectedAddCategory, setSelectedAddCategory] = useState("");
  const [categoryData, setCategoryData] = useState({});
  const [lowStockThreshold, setLowStockThreshold] = useState(10);
  const [addUom, setAddUom] = useState("");
  const [addSourceType, setAddSourceType] = useState("");
  const [addDualUom, setAddDualUom] = useState(false);
  const [addProcurementUom, setAddProcurementUom] = useState("");
  const [addConsumptionUom, setAddConsumptionUom] = useState("");
  const [addConversionFactor, setAddConversionFactor] = useState("");
  
  // Loading
  const [loading, setLoading] = useState(false);
  
  // Filters
  const [filters, setFilters] = useState({
    search: "",
    category: "",
    brand_id: "",
    vertical_id: "",
    model_id: "",
    is_brand_specific: "",
    source_type: "",
    bom_level: ""
  });
  
  // Selection for bulk operations
  const [selectedRMs, setSelectedRMs] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);
  
  // Dialogs
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [showBulkTagDialog, setShowBulkTagDialog] = useState(false);
  const [showRequestDetailDialog, setShowRequestDetailDialog] = useState(false);
  
  // Editing
  const [editingRM, setEditingRM] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  
  // Tag form
  const [tagForm, setTagForm] = useState({
    brand_ids: [],
    vertical_ids: [],
    model_ids: [],
    is_brand_specific: false,
    uom: "",
    source_type: "",
    dual_uom: false,
    procurement_uom: "",
    consumption_uom: "",
    conversion_factor: ""
  });
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Price History tab state
  const [priceStats, setPriceStats] = useState(null);
  const [avgPrices, setAvgPrices] = useState([]);
  const [priceHistory, setPriceHistory] = useState([]);
  const [priceFilter, setPriceFilter] = useState({ rm_id: "", vendor_id: "" });
  const [priceUploading, setPriceUploading] = useState(false);
  const [priceUploadMode, setPriceUploadMode] = useState("append");
  const priceFileInputRef = useRef(null);

  useEffect(() => {
    fetchMasterData();
    fetchRmCategories();
    fetchPendingCount();
    fetchPendingSkuCount();
    fetchPendingCloneCount();
  }, []);

  useEffect(() => {
    if (activeTab === "repository") {
      fetchMaterials();
    } else if (activeTab === "requests") {
      fetchRMRequests();
    } else if (activeTab === "sku-requests") {
      fetchBuyerSkuRequests();
    } else if (activeTab === "clone-requests") {
      fetchBidsoCloneRequests();
    } else if (activeTab === "price-history") {
      fetchPriceData();
    }
  }, [activeTab, filters, currentPage, pageSize]);

  // Fetch RM Categories from database
  const fetchRmCategories = async () => {
    try {
      const response = await axios.get(`${API}/rm-categories`);
      const dbCategories = response.data || {};
      setRmCategories(dbCategories);
    } catch (error) {
      console.error("Failed to fetch RM categories:", error);
      setRmCategories({});
    }
  };

  const fetchMasterData = async () => {
    try {
      const [brandsRes, verticalsRes, modelsRes] = await Promise.all([
        axios.get(`${API}/brands`),
        axios.get(`${API}/verticals`),
        axios.get(`${API}/models`)
      ]);
      setBrands(brandsRes.data.filter(b => b.status === 'ACTIVE'));
      setVerticals(verticalsRes.data.filter(v => v.status === 'ACTIVE'));
      setModels(modelsRes.data.filter(m => m.status === 'ACTIVE'));
    } catch (error) {
      console.error("Failed to fetch master data");
    }
  };

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      // Build query params
      let url = `${API}/raw-materials/by-tags?page=${currentPage}&page_size=${pageSize}`;
      if (filters.brand_id) url += `&brand_id=${filters.brand_id}`;
      if (filters.vertical_id) url += `&vertical_id=${filters.vertical_id}`;
      if (filters.model_id) url += `&model_id=${filters.model_id}`;
      if (filters.is_brand_specific === "true") url += `&is_brand_specific=true`;
      if (filters.is_brand_specific === "false") url += `&is_brand_specific=false`;
      if (filters.category) url += `&category=${filters.category}`;
      if (filters.source_type) url += `&source_type=${filters.source_type}`;
      if (filters.bom_level) url += `&bom_level=${filters.bom_level}`;
      if (filters.search) url += `&search=${encodeURIComponent(filters.search)}`;
      
      const res = await axios.get(url);
      setMaterials(res.data.items || []);
      setTotalItems(res.data.total || 0);
      setTotalPages(res.data.total_pages || 1);
      setSelectedRMs(new Set());
      setSelectAll(false);
    } catch (error) {
      toast.error("Failed to fetch materials");
    } finally {
      setLoading(false);
    }
  };

  // Export all RMs to Excel with each category as a separate sheet
  const handleExportRepository = async () => {
    try {
      toast.info("Preparing RM Repository export...");
      
      // Fetch ALL raw materials (no pagination)
      const res = await axios.get(`${API}/raw-materials?page_size=50000`);
      const allRMs = res.data || [];
      
      if (allRMs.length === 0) {
        toast.error("No raw materials to export");
        return;
      }
      
      // Group RMs by category
      const categorizedRMs = {};
      allRMs.forEach(rm => {
        const cat = rm.category || rm.rm_id?.split('_')[0] || 'OTHER';
        if (!categorizedRMs[cat]) {
          categorizedRMs[cat] = [];
        }
        categorizedRMs[cat].push(rm);
      });
      
      // Create workbook
      const wb = XLSX.utils.book_new();
      
      // Add summary sheet first
      const summaryData = Object.entries(categorizedRMs).sort((a, b) => a[0].localeCompare(b[0])).map(([cat, rms]) => ({
        'Category Code': cat,
        'Category Name': getCategoryName(cat, rmCategories),
        'Total RMs': rms.length
      }));
      summaryData.push({ 'Category Code': '', 'Category Name': 'TOTAL', 'Total RMs': allRMs.length });
      const summaryWs = XLSX.utils.json_to_sheet(summaryData);
      summaryWs['!cols'] = [{ wch: 15 }, { wch: 25 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');
      
      // Define columns to export
      const columns = [
        { key: 'rm_id', header: 'RM ID' },
        { key: 'description', header: 'Description' },
        { key: 'category', header: 'Category' },
        { key: 'source_type', header: 'Source Type' },
        { key: 'bom_level', header: 'BOM Level' },
        { key: 'uom', header: 'UOM' },
        { key: 'hsn_code', header: 'HSN Code' },
        { key: 'gst_rate', header: 'GST Rate (%)' },
        { key: 'min_order_qty', header: 'Min Order Qty' },
        { key: 'lead_time_days', header: 'Lead Time (Days)' },
        { key: 'status', header: 'Status' },
        { key: 'created_at', header: 'Created At' }
      ];
      
      // Create a sheet for each category
      Object.entries(categorizedRMs).sort((a, b) => a[0].localeCompare(b[0])).forEach(([category, rms]) => {
        const sheetData = rms.map(rm => {
          const row = {};
          columns.forEach(col => {
            let value = rm[col.key];
            if (col.key === 'created_at' && value) {
              try { value = new Date(value).toLocaleDateString(); } catch(e) { /* keep raw */ }
            }
            row[col.header] = value ?? '';
          });
          return row;
        });
        
        const ws = XLSX.utils.json_to_sheet(sheetData);
        ws['!cols'] = columns.map(() => ({ wch: 15 }));
        
        // Sheet name: max 31 chars, no special chars
        const catName = getCategoryName(category, rmCategories);
        const sheetName = `${category} - ${catName}`.replace(/[\\/?*[\]]/g, '').slice(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      });
      
      // Generate and download file using native approach
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const filename = `RM_Repository_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      // Use native download link (more reliable than file-saver in some environments)
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success(`Exported ${allRMs.length} RMs across ${Object.keys(categorizedRMs).length} categories`);
    } catch (error) {
      console.error("Export failed:", error?.message, error?.stack);
      toast.error(`Failed to export RM repository: ${error?.message || 'Unknown error'}`);
    }
  };

  const fetchRMRequests = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/rm-requests`);
      setRmRequests(res.data);
    } catch (error) {
      toast.error("Failed to fetch RM requests");
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingCount = async () => {
    try {
      const res = await axios.get(`${API}/rm-requests/pending-count`);
      setPendingCount(res.data.pending_count);
    } catch (error) {
      console.error("Failed to fetch pending count");
    }
  };

  const fetchPendingSkuCount = async () => {
    try {
      const res = await axios.get(`${API}/demand-hub/buyer-sku-requests/pending-count`);
      setPendingSkuCount(res.data.pending_count);
    } catch (error) {
      console.error("Failed to fetch pending SKU count");
    }
  };

  const fetchBuyerSkuRequests = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/demand-hub/buyer-sku-requests`);
      setBuyerSkuRequests(res.data);
    } catch (error) {
      toast.error("Failed to fetch Buyer SKU requests");
    } finally {
      setLoading(false);
    }
  };

  const handleReviewBuyerSkuRequest = async (requestId, action, notes = "") => {
    try {
      await axios.post(`${API}/demand-hub/buyer-sku-requests/${requestId}/review`, {
        action,
        review_notes: notes
      });
      toast.success(`Request ${action.toLowerCase()}ed`);
      fetchBuyerSkuRequests();
      fetchPendingSkuCount();
    } catch (error) {
      toast.error(`Failed to ${action.toLowerCase()} request`);
    }
  };

  // Bidso Clone Request functions
  const fetchPendingCloneCount = async () => {
    try {
      const res = await axios.get(`${API}/demand-hub/bidso-clone-requests/pending-count`);
      setPendingCloneCount(res.data.pending_count);
    } catch (error) {
      console.error("Failed to fetch pending clone count");
    }
  };

  const fetchBidsoCloneRequests = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/demand-hub/bidso-clone-requests`);
      setBidsoCloneRequests(res.data);
    } catch (error) {
      toast.error("Failed to fetch Bidso Clone requests");
    } finally {
      setLoading(false);
    }
  };

  // ============ Price History handlers ============
  const fetchPriceData = async () => {
    try {
      const [statsRes, avgRes] = await Promise.all([
        axios.get(`${API}/rm-prices/stats`),
        axios.get(`${API}/rm-prices/avg-prices`)
      ]);
      setPriceStats(statsRes.data);
      setAvgPrices(avgRes.data.items || []);
      await fetchPriceHistory();
    } catch (error) {
      toast.error("Failed to fetch price data");
    }
  };

  const fetchPriceHistory = async (overrides = {}) => {
    try {
      const params = new URLSearchParams({ page_size: 200 });
      const rmFilter = overrides.rm_id !== undefined ? overrides.rm_id : priceFilter.rm_id;
      const vFilter = overrides.vendor_id !== undefined ? overrides.vendor_id : priceFilter.vendor_id;
      if (rmFilter) params.append("rm_id", rmFilter);
      if (vFilter) params.append("vendor_id", vFilter);
      const res = await axios.get(`${API}/rm-prices/history?${params}`);
      setPriceHistory(res.data.items || []);
    } catch (error) {
      console.error("Failed to fetch price history", error);
    }
  };

  const handlePriceUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPriceUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await axios.post(
        `${API}/rm-prices/upload?mode=${priceUploadMode}`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      toast.success(res.data.message);
      if (res.data.error_count > 0) {
        toast.error(`${res.data.error_count} rows had errors. First: ${res.data.errors?.[0] || ""}`);
      }
      await fetchPriceData();
    } catch (err) {
      toast.error(`Upload failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setPriceUploading(false);
      e.target.value = "";
    }
  };

  const downloadPriceTemplate = () => {
    window.open(`${API}/rm-prices/template`, "_blank");
  };

  const handleViewCloneDetail = async (request) => {
    try {
      const res = await axios.get(`${API}/demand-hub/bidso-clone-requests/${request.id}`);
      setSelectedCloneRequest(res.data);
      setShowCloneDetailDialog(true);
    } catch (error) {
      toast.error("Failed to load request details");
    }
  };

  const openRejectDialog = (requestId) => {
    setRejectingRequestId(requestId);
    setRejectionReason("");
    setShowRejectDialog(true);
  };

  const handleConfirmReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error("Please enter a rejection reason");
      return;
    }
    
    try {
      await axios.post(`${API}/demand-hub/bidso-clone-requests/${rejectingRequestId}/review`, {
        action: "REJECT",
        review_notes: rejectionReason
      });
      toast.success("Request rejected");
      setShowRejectDialog(false);
      setShowCloneDetailDialog(false);
      setRejectingRequestId(null);
      setRejectionReason("");
      fetchBidsoCloneRequests();
      fetchPendingCloneCount();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to reject request");
    }
  };

  const handleApproveBidsoCloneRequest = async (requestId) => {
    try {
      const response = await axios.post(`${API}/demand-hub/bidso-clone-requests/${requestId}/review`, {
        action: "APPROVE",
        review_notes: ""
      });
      
      // Show approval result dialog with created items
      setApprovalResult(response.data);
      setShowApprovalResultDialog(true);
      setShowCloneDetailDialog(false);
      fetchBidsoCloneRequests();
      fetchPendingCloneCount();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to approve request");
    }
  };

  const handleReviewBidsoCloneRequest = async (requestId, action, notes = "") => {
    if (action === "REJECT") {
      openRejectDialog(requestId);
      return;
    }
    
    // For approve, use the new function
    await handleApproveBidsoCloneRequest(requestId);
  };

  const handleSelectRM = (rmId) => {
    const newSelected = new Set(selectedRMs);
    if (newSelected.has(rmId)) {
      newSelected.delete(rmId);
    } else {
      newSelected.add(rmId);
    }
    setSelectedRMs(newSelected);
    setSelectAll(newSelected.size === materials.length);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedRMs(new Set());
    } else {
      setSelectedRMs(new Set(materials.map(m => m.rm_id)));
    }
    setSelectAll(!selectAll);
  };

  const handleEditTags = (rm) => {
    setEditingRM(rm);
    // Get category default UOM and source_type for display
    const catConfig = rmCategories[rm.category] || {};
    setTagForm({
      brand_ids: rm.brand_ids || [],
      vertical_ids: rm.vertical_ids || [],
      model_ids: rm.model_ids || [],
      is_brand_specific: rm.is_brand_specific || false,
      uom: rm.uom || catConfig.default_uom || "PCS",
      source_type: rm.source_type || catConfig.default_source_type || "PURCHASED",
      dual_uom: rm.dual_uom || false,
      procurement_uom: rm.procurement_uom || "",
      consumption_uom: rm.consumption_uom || "",
      conversion_factor: rm.conversion_factor || ""
    });
    setShowTagDialog(true);
  };

  const handleSaveTags = async () => {
    if (!editingRM) return;
    
    try {
      await axios.put(`${API}/raw-materials/${editingRM.rm_id}`, tagForm);
      toast.success(`Tags updated for ${editingRM.rm_id}`);
      setShowTagDialog(false);
      setEditingRM(null);
      fetchMaterials();
    } catch (error) {
      toast.error("Failed to update tags");
    }
  };

  const handleBulkTag = async () => {
    if (selectedRMs.size === 0) {
      toast.error("No RMs selected");
      return;
    }
    
    try {
      // Update each selected RM
      const promises = Array.from(selectedRMs).map(rmId => 
        axios.post(`${API}/raw-materials/${rmId}/tag`, tagForm)
      );
      await Promise.all(promises);
      
      toast.success(`Tags added to ${selectedRMs.size} RMs`);
      setShowBulkTagDialog(false);
      setTagForm({ brand_ids: [], vertical_ids: [], model_ids: [], is_brand_specific: false });
      fetchMaterials();
    } catch (error) {
      toast.error("Failed to bulk tag RMs");
    }
  };

  const handleReviewRequest = async (requestId, action, notes = "") => {
    try {
      await axios.post(`${API}/rm-requests/${requestId}/review`, {
        action,
        review_notes: notes
      });
      toast.success(`Request ${action.toLowerCase()}ed`);
      fetchRMRequests();
      fetchPendingCount();
      setShowRequestDetailDialog(false);
    } catch (error) {
      toast.error(`Failed to ${action.toLowerCase()} request`);
    }
  };

  const getFilteredModels = () => {
    if (!filters.vertical_id) return models;
    return models.filter(m => m.vertical_id === filters.vertical_id);
  };

  const getBrandName = (id) => brands.find(b => b.id === id)?.name || id;
  const getBrandCode = (id) => brands.find(b => b.id === id)?.code || "";
  const getVerticalName = (id) => verticals.find(v => v.id === id)?.name || id;
  const getVerticalCode = (id) => verticals.find(v => v.id === id)?.code || "";
  const getModelName = (id) => models.find(m => m.id === id)?.name || id;
  const getModelCode = (id) => models.find(m => m.id === id)?.code || "";

  const clearFilters = () => {
    setFilters({
      search: "",
      category: "",
      brand_id: "",
      vertical_id: "",
      model_id: "",
      is_brand_specific: "",
      source_type: "",
      bom_level: ""
    });
    setCurrentPage(1);
  };

  // Pagination handlers
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  // Handle filter changes with page reset
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  // ==================== BULK UPLOAD & ADD RM FUNCTIONS ====================
  
  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      toast.info("Processing upload...");
      const response = await axios.post(`${API}/raw-materials/bulk-upload`, formData);
      const { created, skipped, errors, total_errors, total_duplicates, mode, created_rms } = response.data;
      
      if (total_duplicates > 0) {
        if (created > 0) {
          toast.success(`Created ${created} RMs. ${total_duplicates} duplicates skipped.`, { duration: 4000 });
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
        setCreatedRMs(created_rms || []);
        setShowCreatedDialog(true);
      } else if (total_errors > 0) {
        const errorMsg = errors?.slice(0, 2).join('; ') || 'Check file format';
        toast.error(`0 RMs created. ${total_errors} errors: ${errorMsg}`, { duration: 10000 });
      } else {
        toast.warning('No data found in file. Ensure file has data rows with RM Code or Category column.');
      }
      
      fetchMaterials();
    } catch (error) {
      const errData = error.response?.data;
      toast.error(errData?.detail || errData?.message || "Upload failed - check file format", { duration: 8000 });
    }
    
    e.target.value = null;
  };

  const handleAddRM = async () => {
    if (!selectedAddCategory) {
      toast.error("Please select a category");
      return;
    }

    try {
      await axios.post(`${API}/raw-materials`, {
        category: selectedAddCategory,
        category_data: categoryData,
        low_stock_threshold: lowStockThreshold,
        uom: addUom || undefined,
        source_type: addSourceType || undefined,
        dual_uom: addDualUom,
        procurement_uom: addDualUom ? addProcurementUom : undefined,
        consumption_uom: addDualUom ? addConsumptionUom : undefined,
        conversion_factor: addDualUom && addConversionFactor ? parseFloat(addConversionFactor) : undefined
      });
      toast.success("Raw material added successfully");
      setShowAddDialog(false);
      resetAddForm();
      fetchMaterials();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to add raw material");
    }
  };

  const resetAddForm = () => {
    setSelectedAddCategory("");
    setCategoryData({});
    setLowStockThreshold(10);
    setAddUom("");
    setAddSourceType("");
    setAddDualUom(false);
    setAddProcurementUom("");
    setAddConsumptionUom("");
    setAddConversionFactor("");
  };

  const downloadCategoryTemplate = (category) => {
    if (!rmCategories[category]) {
      toast.error("Category not found");
      return;
    }
    const fields = ['Category', ...rmCategories[category].fields, 'Low Stock Threshold'];
    const ws = XLSX.utils.aoa_to_sheet([fields, [category, ...rmCategories[category].fields.map(() => ''), 10]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, category);
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `${category}_template.xlsx`);
    toast.success(`Downloaded ${category} template`);
  };

  const handleMigrateImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
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
        timeout: 120000
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
      } else {
        toast.warning(message || 'No new items imported. Items may already exist.');
      }
      setShowMigrateDialog(false);
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        toast.warning('Import is taking longer than expected. It may still complete - refresh to check.', { duration: 10000 });
      } else {
        const errMsg = error.response?.data?.message || error.response?.data?.detail || 'Import failed';
        toast.error(errMsg, { duration: 8000 });
      }
    }
    setMigrating(false);
    e.target.value = null;
  };

  const handleDeleteRM = async (rmId) => {
    if (!window.confirm(`Delete ${rmId}? This action cannot be undone.`)) return;
    try {
      await axios.delete(`${API}/raw-materials/${rmId}`);
      toast.success("Raw material deleted");
      fetchMaterials();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete");
    }
  };

  const [backfilling, setBackfilling] = useState(false);
  
  const handleBackfillDescriptions = async () => {
    if (!window.confirm("This will regenerate descriptions for ALL RMs using the latest format. Continue?")) {
      return;
    }
    
    setBackfilling(true);
    try {
      // First sync category formats to ensure correct configuration
      toast.info("Syncing category formats...");
      await axios.post(`${API}/raw-materials/sync-category-formats`);
      
      // Then run backfill with force mode
      toast.info("Starting description backfill (force mode)...");
      const response = await axios.post(`${API}/raw-materials/backfill-descriptions?force=true`);
      const { updated, skipped, message } = response.data;
      toast.success(message || `Updated ${updated} RMs, skipped ${skipped}`, { duration: 5000 });
      fetchMaterials(); // Refresh to show new descriptions
    } catch (error) {
      toast.error(error.response?.data?.detail || "Backfill failed");
    } finally {
      setBackfilling(false);
    }
  };

  const formatFieldName = (field) => {
    return field.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  return (
    <div className="p-6 space-y-6" data-testid="rm-repository-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">RM Repository</h1>
          <p className="text-gray-500 mt-1">Manage raw material master data, tags, and approve RM requests</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Hidden file inputs */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleBulkUpload}
            accept=".xlsx,.xls"
            className="hidden"
            data-testid="bulk-upload-input"
          />
          
          {canManageRMs && (
            <>
              <Button 
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2"
                data-testid="bulk-upload-btn"
              >
                <Upload className="h-4 w-4" />
                Bulk Upload
              </Button>
              <Button 
                onClick={() => setShowAddDialog(true)}
                className="flex items-center gap-2"
                data-testid="add-rm-btn"
              >
                <Plus className="h-4 w-4" />
                Add RM
              </Button>
            </>
          )}
          {isAdmin && (
            <Button 
              onClick={handleBackfillDescriptions}
              variant="outline"
              disabled={backfilling}
              className="flex items-center gap-2"
              data-testid="backfill-descriptions-btn"
            >
              <Database className="h-4 w-4" />
              {backfilling ? "Backfilling..." : "Backfill Descriptions"}
            </Button>
          )}
          <Button 
            onClick={handleExportRepository}
            variant="outline"
            className="flex items-center gap-2"
            data-testid="export-rm-repository-btn"
          >
            <Download className="h-4 w-4" />
            Export All RMs
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
                <p className="text-sm text-gray-500">Total RMs</p>
                <p className="text-2xl font-bold">{materials.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Tag className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Tagged RMs</p>
                <p className="text-2xl font-bold">
                  {materials.filter(m => (m.brand_ids?.length > 0 || m.vertical_ids?.length > 0)).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Layers className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Brand Specific</p>
                <p className="text-2xl font-bold">
                  {materials.filter(m => m.is_brand_specific).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={pendingCount > 0 ? "border-orange-300 bg-orange-50" : ""}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${pendingCount > 0 ? "bg-orange-100" : "bg-gray-100"}`}>
                <Bell className={`h-5 w-5 ${pendingCount > 0 ? "text-orange-600" : "text-gray-600"}`} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Pending Requests</p>
                <p className="text-2xl font-bold">{pendingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="repository" data-testid="repository-tab">
            <Package className="h-4 w-4 mr-2" />
            RM Repository
          </TabsTrigger>
          <TabsTrigger value="requests" data-testid="requests-tab">
            <Bell className="h-4 w-4 mr-2" />
            RM Requests
            {pendingCount > 0 && (
              <Badge className="ml-2 bg-orange-500">{pendingCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="sku-requests" data-testid="sku-requests-tab">
            <Box className="h-4 w-4 mr-2" />
            Buyer SKU Requests
            {pendingSkuCount > 0 && (
              <Badge className="ml-2 bg-blue-500">{pendingSkuCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="clone-requests" data-testid="clone-requests-tab">
            <Copy className="h-4 w-4 mr-2" />
            Bidso SKU Clone
            {pendingCloneCount > 0 && (
              <Badge className="ml-2 bg-green-500">{pendingCloneCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="price-history" data-testid="price-history-tab">
            <Database className="h-4 w-4 mr-2" />
            Price History
          </TabsTrigger>
        </TabsList>

        {/* Repository Tab */}
        <TabsContent value="repository" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                  <Label className="text-xs text-gray-500">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search RM ID or name..."
                      value={filters.search}
                      onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && fetchMaterials()}
                      className="pl-10"
                      data-testid="rm-search"
                    />
                  </div>
                </div>
                
                <div className="w-[150px]">
                  <Label className="text-xs text-gray-500">Category</Label>
                  <Select value={filters.category} onValueChange={(v) => handleFilterChange('category', v === "all" ? "" : v)}>
                    <SelectTrigger data-testid="filter-category">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {Object.entries(rmCategories).map(([code, cat]) => (
                        <SelectItem key={code} value={code}>{code} - {cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="w-[180px]">
                  <Label className="text-xs text-gray-500">Brand</Label>
                  <Select value={filters.brand_id} onValueChange={(v) => handleFilterChange('brand_id', v === "all" ? "" : v)}>
                    <SelectTrigger data-testid="filter-brand">
                      <SelectValue placeholder="All Brands" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Brands</SelectItem>
                      {brands.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.code} - {b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="w-[180px]">
                  <Label className="text-xs text-gray-500">Vertical</Label>
                  <Select value={filters.vertical_id} onValueChange={(v) => { handleFilterChange('vertical_id', v === "all" ? "" : v); setFilters(prev => ({ ...prev, model_id: "" })); }}>
                    <SelectTrigger data-testid="filter-vertical">
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
                
                <div className="w-[180px]">
                  <Label className="text-xs text-gray-500">Model</Label>
                  <Select value={filters.model_id} onValueChange={(v) => handleFilterChange('model_id', v === "all" ? "" : v)} disabled={!filters.vertical_id}>
                    <SelectTrigger data-testid="filter-model">
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
                
                <div className="w-[150px]">
                  <Label className="text-xs text-gray-500">Source Type</Label>
                  <Select value={filters.source_type || "all"} onValueChange={(v) => handleFilterChange('source_type', v === "all" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="PURCHASED">PURCHASED</SelectItem>
                      <SelectItem value="MANUFACTURED">MANUFACTURED</SelectItem>
                      <SelectItem value="BOTH">BOTH</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="w-[120px]">
                  <Label className="text-xs text-gray-500">BOM Level</Label>
                  <Select value={filters.bom_level || "all"} onValueChange={(v) => handleFilterChange('bom_level', v === "all" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Levels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Levels</SelectItem>
                      <SelectItem value="1">L1</SelectItem>
                      <SelectItem value="2">L2</SelectItem>
                      <SelectItem value="3">L3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="w-[150px]">
                  <Label className="text-xs text-gray-500">Brand Specific</Label>
                  <Select value={filters.is_brand_specific || "all"} onValueChange={(v) => handleFilterChange('is_brand_specific', v === "all" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Button variant="outline" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-2" />
                  Clear
                </Button>
                
                <Button onClick={fetchMaterials}>
                  <Search className="h-4 w-4 mr-2" />
                  Apply
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Bulk Actions */}
          {selectedRMs.size > 0 && (
            <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <span className="text-sm font-medium text-blue-700">
                {selectedRMs.size} RM(s) selected
              </span>
              <Button size="sm" onClick={() => {
                setTagForm({ brand_ids: [], vertical_ids: [], model_ids: [], is_brand_specific: false });
                setShowBulkTagDialog(true);
              }}>
                <Tag className="h-4 w-4 mr-2" />
                Bulk Add Tags
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSelectedRMs(new Set())}>
                Clear Selection
              </Button>
            </div>
          )}

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox 
                        checked={selectAll}
                        onCheckedChange={handleSelectAll}
                        data-testid="select-all"
                      />
                    </TableHead>
                    <TableHead>RM ID</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Brands</TableHead>
                    <TableHead>Verticals</TableHead>
                    <TableHead>Models</TableHead>
                    <TableHead>Brand Specific</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-gray-500">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : materials.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-gray-500">
                        No raw materials found
                      </TableCell>
                    </TableRow>
                  ) : (
                    materials.map(rm => (
                      <TableRow key={rm.rm_id} data-testid={`rm-row-${rm.rm_id}`}>
                        <TableCell>
                          <Checkbox 
                            checked={selectedRMs.has(rm.rm_id)}
                            onCheckedChange={() => handleSelectRM(rm.rm_id)}
                          />
                        </TableCell>
                        <TableCell>
                          <span className="font-mono font-medium">{rm.rm_id}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{rm.category}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[250px]">
                          <span className="truncate block" title={rm.description || rm.category_data?.name || "-"}>
                            {rm.description || rm.category_data?.name || "-"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {rm.source_type ? (
                            <Badge 
                              variant={rm.source_type === 'MANUFACTURED' ? 'default' : rm.source_type === 'BOTH' ? 'secondary' : 'outline'}
                              className={rm.source_type === 'MANUFACTURED' ? 'bg-orange-500' : rm.source_type === 'BOTH' ? 'bg-blue-100 text-blue-700' : ''}
                            >
                              {rm.source_type}
                            </Badge>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {rm.bom_level ? (
                            <Badge variant="outline" className="font-mono">
                              L{rm.bom_level}
                            </Badge>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(rm.brands || []).slice(0, 3).map(b => (
                              <Badge key={b.code} variant="secondary" className="text-xs">
                                {b.code}
                              </Badge>
                            ))}
                            {(rm.brands || []).length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{rm.brands.length - 3}
                              </Badge>
                            )}
                            {(!rm.brands || rm.brands.length === 0) && (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(rm.verticals || []).slice(0, 2).map(v => (
                              <Badge key={v.code} variant="outline" className="text-xs bg-blue-50">
                                {v.code}
                              </Badge>
                            ))}
                            {(rm.verticals || []).length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{rm.verticals.length - 2}
                              </Badge>
                            )}
                            {(!rm.verticals || rm.verticals.length === 0) && (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(rm.models || []).slice(0, 2).map(m => (
                              <Badge key={m.code} variant="outline" className="text-xs bg-green-50">
                                {m.code}
                              </Badge>
                            ))}
                            {(rm.models || []).length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{rm.models.length - 2}
                              </Badge>
                            )}
                            {(!rm.models || rm.models.length === 0) && (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {rm.is_brand_specific ? (
                            <Badge className="bg-purple-100 text-purple-700">Yes</Badge>
                          ) : (
                            <span className="text-gray-400">No</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleEditTags(rm)}
                            data-testid={`edit-tags-${rm.rm_id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {/* Pagination */}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={pageSize}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                loading={loading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* RM Requests Tab */}
        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Requested Name</TableHead>
                    <TableHead>For Brands</TableHead>
                    <TableHead>Buyer SKU</TableHead>
                    <TableHead>Requested By</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : rmRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                        No RM requests
                      </TableCell>
                    </TableRow>
                  ) : (
                    rmRequests.map(req => (
                      <TableRow key={req.id} data-testid={`request-row-${req.id}`}>
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
                        <TableCell>
                          <Badge variant="outline">{req.category}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <span className="font-medium">{req.requested_name}</span>
                          {req.description && (
                            <p className="text-xs text-gray-500 truncate">{req.description}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(req.brands || []).map(b => (
                              <Badge key={b.code} variant="secondary" className="text-xs">
                                {b.code}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {req.buyer_sku_id ? (
                            <span className="font-mono text-xs">{req.buyer_sku_id}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {req.requester_name || "Unknown"}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {new Date(req.requested_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {req.status === "PENDING" ? (
                            <div className="flex gap-1">
                              <Button 
                                size="sm" 
                                variant="default"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => handleReviewRequest(req.id, "APPROVE")}
                                data-testid={`approve-${req.id}`}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="destructive"
                                onClick={() => handleReviewRequest(req.id, "REJECT")}
                                data-testid={`reject-${req.id}`}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500">
                              {req.created_rm_id && (
                                <span className="font-mono">{req.created_rm_id}</span>
                              )}
                            </div>
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

        {/* Buyer SKU Requests Tab */}
        <TabsContent value="sku-requests" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Buyer SKU</TableHead>
                    <TableHead>Base SKU</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Requested By</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : buyerSkuRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                        No Buyer SKU requests
                      </TableCell>
                    </TableRow>
                  ) : (
                    buyerSkuRequests.map(req => (
                      <TableRow key={req.id} data-testid={`sku-request-row-${req.id}`}>
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
                        <TableCell>
                          <span className="font-mono font-medium">{req.buyer_sku_id}</span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm text-gray-600">{req.bidso_sku_id}</span>
                          {req.bidso_sku_name && (
                            <p className="text-xs text-gray-400">{req.bidso_sku_name}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{req.brand_code} - {req.brand_name}</Badge>
                        </TableCell>
                        <TableCell>
                          {req.requester_name || "Unknown"}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {new Date(req.requested_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="max-w-[150px]">
                          <span className="text-xs text-gray-500 truncate">{req.notes || "-"}</span>
                        </TableCell>
                        <TableCell>
                          {req.status === "PENDING" ? (
                            <div className="flex gap-1">
                              <Button 
                                size="sm" 
                                variant="default"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => handleReviewBuyerSkuRequest(req.id, "APPROVE")}
                                data-testid={`approve-sku-${req.id}`}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="destructive"
                                onClick={() => handleReviewBuyerSkuRequest(req.id, "REJECT")}
                                data-testid={`reject-sku-${req.id}`}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-500">
                              {req.review_notes || "-"}
                            </span>
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

        {/* Bidso Clone Requests Tab */}
        <TabsContent value="clone-requests" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Proposed Name</TableHead>
                    <TableHead>Source SKU</TableHead>
                    <TableHead>Modifications</TableHead>
                    <TableHead>Requested By</TableHead>
                    <TableHead>Date</TableHead>
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
                  ) : bidsoCloneRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        No Bidso SKU clone requests
                      </TableCell>
                    </TableRow>
                  ) : (
                    bidsoCloneRequests.map(req => (
                      <TableRow key={req.id} data-testid={`clone-request-row-${req.id}`}>
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
                        <TableCell>
                          <span className="font-medium">{req.proposed_name}</span>
                          {req.proposed_description && (
                            <p className="text-xs text-gray-500 truncate max-w-[200px]">{req.proposed_description}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <span className="font-mono text-sm">{req.source_bidso_sku_id}</span>
                            <p className="text-xs text-gray-400">{req.source_bidso_sku_name}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge variant="outline" className="text-xs">
                              {req.bom_modifications?.length || 0} modified
                            </Badge>
                            {req.bom_modifications?.filter(m => m.action === "CREATE_NEW").length > 0 && (
                              <Badge className="bg-blue-100 text-blue-700 text-xs ml-1">
                                +{req.bom_modifications.filter(m => m.action === "CREATE_NEW").length} new RM
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {req.requester_name || "Unknown"}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {new Date(req.requested_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {req.status === "PENDING" ? (
                            <div className="flex gap-1">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleViewCloneDetail(req)}
                                data-testid={`view-clone-${req.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="default"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => handleReviewBidsoCloneRequest(req.id, "APPROVE")}
                                data-testid={`approve-clone-${req.id}`}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="destructive"
                                onClick={() => handleReviewBidsoCloneRequest(req.id, "REJECT")}
                                data-testid={`reject-clone-${req.id}`}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="text-xs space-y-1">
                              {req.status === "APPROVED" && (
                                <>
                                  <div className="font-mono text-green-600 font-medium">
                                    {req.created_bidso_sku_id}
                                  </div>
                                  {req.created_rm_ids && req.created_rm_ids.length > 0 && (
                                    <div className="text-gray-500">
                                      +{req.created_rm_ids.length} RM: {req.created_rm_ids.slice(0, 2).join(", ")}
                                      {req.created_rm_ids.length > 2 && "..."}
                                    </div>
                                  )}
                                </>
                              )}
                              {req.status === "REJECTED" && req.review_notes && (
                                <div className="text-red-600" title={req.review_notes}>
                                  Reason: {req.review_notes.substring(0, 40)}...
                                </div>
                              )}
                            </div>
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

        {/* Price History Tab */}
        <TabsContent value="price-history" className="space-y-4">
          {/* Upload + Stats */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-4 w-4" /> Upload RM Prices
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Expected columns: <span className="font-mono">Date | Invoice No | Vendor ID | RM ID | Price</span>.
                Price is per unit. System computes a simple 3-month rolling average per RM and uses it to derive BOM cost.
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Mode</Label>
                  <Select value={priceUploadMode} onValueChange={setPriceUploadMode}>
                    <SelectTrigger className="w-32 h-9 text-xs" data-testid="price-upload-mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="append">Append</SelectItem>
                      <SelectItem value="overwrite">Overwrite All</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  ref={priceFileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handlePriceUpload}
                  disabled={priceUploading}
                  className="max-w-xs text-xs"
                  data-testid="price-upload-input"
                />
                <Button variant="outline" size="sm" onClick={downloadPriceTemplate} data-testid="download-price-template">
                  <Download className="h-4 w-4 mr-1" /> Template
                </Button>
              </div>
              {priceStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                  <div className="border rounded p-3 bg-zinc-50">
                    <div className="text-xs text-muted-foreground">Total Records</div>
                    <div className="text-xl font-semibold">{priceStats.total_records?.toLocaleString()}</div>
                  </div>
                  <div className="border rounded p-3 bg-zinc-50">
                    <div className="text-xs text-muted-foreground">Unique RMs</div>
                    <div className="text-xl font-semibold">{priceStats.unique_rms?.toLocaleString()}</div>
                  </div>
                  <div className="border rounded p-3 bg-zinc-50">
                    <div className="text-xs text-muted-foreground">Unique Vendors</div>
                    <div className="text-xl font-semibold">{priceStats.unique_vendors}</div>
                  </div>
                  <div className="border rounded p-3 bg-emerald-50">
                    <div className="text-xs text-muted-foreground">RMs with Avg Price</div>
                    <div className="text-xl font-semibold text-emerald-700">{priceStats.rms_with_avg_price}</div>
                  </div>
                </div>
              )}
              {priceStats?.date_range?.min && (
                <div className="text-xs text-muted-foreground">
                  Data range: {priceStats.date_range.min?.slice(0,10)} → {priceStats.date_range.max?.slice(0,10)} ·
                  Rolling window start: {priceStats.window_start?.slice(0,10)}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Avg Prices Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Average Prices (3-Month Rolling)</CardTitle>
            </CardHeader>
            <CardContent>
              {avgPrices.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-6">
                  No price data yet. Upload an Excel file to get started.
                </div>
              ) : (
                <div className="overflow-x-auto max-h-96 border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-zinc-50 sticky top-0">
                        <TableHead className="text-xs">RM ID</TableHead>
                        <TableHead className="text-xs">Name</TableHead>
                        <TableHead className="text-xs">Category</TableHead>
                        <TableHead className="text-xs text-right">Avg Price</TableHead>
                        <TableHead className="text-xs text-right">Records</TableHead>
                        <TableHead className="text-xs">Latest Invoice</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {avgPrices.map((r) => (
                        <TableRow key={r.rm_id}>
                          <TableCell className="font-mono text-xs">{r.rm_id}</TableCell>
                          <TableCell className="text-xs">{r.rm_name || "-"}</TableCell>
                          <TableCell className="text-xs">{r.category || "-"}</TableCell>
                          <TableCell className="text-xs text-right font-mono text-emerald-700">
                            Rs {r.avg_price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                          </TableCell>
                          <TableCell className="text-xs text-right">{r.record_count}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {r.latest_date?.slice(0,10)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Price History Log */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base">Invoice History</CardTitle>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Filter by RM ID"
                    value={priceFilter.rm_id}
                    onChange={(e) => setPriceFilter({ ...priceFilter, rm_id: e.target.value })}
                    className="h-8 text-xs w-40"
                    data-testid="price-filter-rm"
                  />
                  <Input
                    placeholder="Filter by Vendor ID"
                    value={priceFilter.vendor_id}
                    onChange={(e) => setPriceFilter({ ...priceFilter, vendor_id: e.target.value })}
                    className="h-8 text-xs w-40"
                    data-testid="price-filter-vendor"
                  />
                  <Button size="sm" variant="outline" onClick={() => fetchPriceHistory()}>Apply</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {priceHistory.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-6">No history records.</div>
              ) : (
                <div className="overflow-x-auto max-h-96 border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-zinc-50 sticky top-0">
                        <TableHead className="text-xs">Date</TableHead>
                        <TableHead className="text-xs">Invoice No</TableHead>
                        <TableHead className="text-xs">Vendor</TableHead>
                        <TableHead className="text-xs">RM ID</TableHead>
                        <TableHead className="text-xs text-right">Price/Unit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {priceHistory.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs">{r.date?.slice(0,10)}</TableCell>
                          <TableCell className="text-xs font-mono">{r.invoice_no}</TableCell>
                          <TableCell className="text-xs" title={r.vendor_name}>
                            <span className="font-mono">{r.vendor_id}</span>
                            <span className="text-muted-foreground ml-1 truncate">· {r.vendor_name}</span>
                          </TableCell>
                          <TableCell className="text-xs font-mono">{r.rm_id}</TableCell>
                          <TableCell className="text-xs text-right font-mono">Rs {r.price_per_unit?.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <Dialog open={showTagDialog} onOpenChange={setShowTagDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit RM - {editingRM?.rm_id}</DialogTitle>
            <DialogDescription>
              Update UOM, source type, and brand/vertical/model tags.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            {/* Brands */}
            <div>
              <Label>Brands</Label>
              <div className="flex flex-wrap gap-2 mt-2 p-3 border rounded-lg min-h-[60px]">
                {tagForm.brand_ids.map(bid => (
                  <Badge key={bid} variant="secondary" className="pr-1">
                    {getBrandCode(bid)} - {getBrandName(bid)}
                    <button 
                      className="ml-1 hover:text-red-500"
                      onClick={() => setTagForm({ 
                        ...tagForm, 
                        brand_ids: tagForm.brand_ids.filter(id => id !== bid) 
                      })}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <Select onValueChange={(v) => {
                if (v && !tagForm.brand_ids.includes(v)) {
                  setTagForm({ ...tagForm, brand_ids: [...tagForm.brand_ids, v] });
                }
              }}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Add brand..." />
                </SelectTrigger>
                <SelectContent>
                  {brands.filter(b => !tagForm.brand_ids.includes(b.id)).map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.code} - {b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Verticals */}
            <div>
              <Label>Verticals</Label>
              <div className="flex flex-wrap gap-2 mt-2 p-3 border rounded-lg min-h-[60px]">
                {tagForm.vertical_ids.map(vid => (
                  <Badge key={vid} variant="outline" className="bg-blue-50 pr-1">
                    {getVerticalCode(vid)} - {getVerticalName(vid)}
                    <button 
                      className="ml-1 hover:text-red-500"
                      onClick={() => setTagForm({ 
                        ...tagForm, 
                        vertical_ids: tagForm.vertical_ids.filter(id => id !== vid) 
                      })}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <Select onValueChange={(v) => {
                if (v && !tagForm.vertical_ids.includes(v)) {
                  setTagForm({ ...tagForm, vertical_ids: [...tagForm.vertical_ids, v] });
                }
              }}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Add vertical..." />
                </SelectTrigger>
                <SelectContent>
                  {verticals.filter(v => !tagForm.vertical_ids.includes(v.id)).map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.code} - {v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Models */}
            <div>
              <Label>Models</Label>
              <div className="flex flex-wrap gap-2 mt-2 p-3 border rounded-lg min-h-[60px]">
                {tagForm.model_ids.map(mid => (
                  <Badge key={mid} variant="outline" className="bg-green-50 pr-1">
                    {getModelCode(mid)} - {getModelName(mid)}
                    <button 
                      className="ml-1 hover:text-red-500"
                      onClick={() => setTagForm({ 
                        ...tagForm, 
                        model_ids: tagForm.model_ids.filter(id => id !== mid) 
                      })}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <Select onValueChange={(v) => {
                if (v && !tagForm.model_ids.includes(v)) {
                  setTagForm({ ...tagForm, model_ids: [...tagForm.model_ids, v] });
                }
              }}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Add model..." />
                </SelectTrigger>
                <SelectContent>
                  {models.filter(m => !tagForm.model_ids.includes(m.id)).map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.code} - {m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* UOM and Source Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>UOM</Label>
                <Select value={tagForm.uom} onValueChange={(v) => setTagForm({...tagForm, uom: v})}>
                  <SelectTrigger data-testid="edit-uom-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PCS">PCS (Pieces)</SelectItem>
                    <SelectItem value="KG">KG (Kilograms)</SelectItem>
                    <SelectItem value="GM">GM (Grams)</SelectItem>
                    <SelectItem value="MTR">MTR (Meters)</SelectItem>
                    <SelectItem value="LTR">LTR (Litres)</SelectItem>
                    <SelectItem value="SET">SET</SelectItem>
                    <SelectItem value="PAIR">PAIR</SelectItem>
                    <SelectItem value="ROLL">ROLL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Source Type</Label>
                <Select value={tagForm.source_type} onValueChange={(v) => setTagForm({...tagForm, source_type: v})}>
                  <SelectTrigger data-testid="edit-source-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PURCHASED">Purchased</SelectItem>
                    <SelectItem value="MANUFACTURED">Manufactured</SelectItem>
                    <SelectItem value="BOTH">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Dual UOM Toggle */}
            <div className="space-y-3 border-t pt-3">
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="edit-dual-uom" 
                  checked={tagForm.dual_uom} 
                  onChange={(e) => setTagForm({...tagForm, dual_uom: e.target.checked})}
                  className="h-4 w-4 rounded border-gray-300"
                  data-testid="edit-dual-uom-toggle"
                />
                <Label htmlFor="edit-dual-uom" className="text-sm cursor-pointer">
                  Different UOM for procurement & consumption
                </Label>
              </div>
              
              {tagForm.dual_uom && (
                <div className="grid grid-cols-3 gap-3 pl-6">
                  <div>
                    <Label className="text-xs">Procurement UOM</Label>
                    <Select value={tagForm.procurement_uom || "KG"} onValueChange={(v) => setTagForm({...tagForm, procurement_uom: v})}>
                      <SelectTrigger className="h-8 text-xs" data-testid="edit-procurement-uom">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="KG">KG</SelectItem>
                        <SelectItem value="GM">GM</SelectItem>
                        <SelectItem value="MTR">MTR</SelectItem>
                        <SelectItem value="LTR">LTR</SelectItem>
                        <SelectItem value="ROLL">ROLL</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Consumption UOM</Label>
                    <Select value={tagForm.consumption_uom || "PCS"} onValueChange={(v) => setTagForm({...tagForm, consumption_uom: v})}>
                      <SelectTrigger className="h-8 text-xs" data-testid="edit-consumption-uom">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PCS">PCS</SelectItem>
                        <SelectItem value="GM">GM</SelectItem>
                        <SelectItem value="SET">SET</SelectItem>
                        <SelectItem value="PAIR">PAIR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Conversion Factor</Label>
                    <Input 
                      type="number" 
                      step="0.0001"
                      value={tagForm.conversion_factor} 
                      onChange={(e) => setTagForm({...tagForm, conversion_factor: e.target.value})}
                      placeholder="e.g. 0.005"
                      className="h-8 text-xs font-mono"
                      data-testid="edit-conversion-factor"
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">1 consumption unit = X procurement units</p>
                  </div>
                </div>
              )}
            </div>

            {/* Brand Specific Flag */}
            <div className="flex items-center gap-2">
              <Checkbox 
                checked={tagForm.is_brand_specific}
                onCheckedChange={(checked) => setTagForm({ ...tagForm, is_brand_specific: checked })}
              />
              <Label>Mark as Brand Specific RM</Label>
            </div>

            <Separator />

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowTagDialog(false)}>Cancel</Button>
              <Button onClick={handleSaveTags} data-testid="save-tags-btn">
                Save Tags
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Tag Dialog */}
      <Dialog open={showBulkTagDialog} onOpenChange={setShowBulkTagDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk Add Tags</DialogTitle>
            <DialogDescription>
              Add tags to {selectedRMs.size} selected raw materials. Existing tags will be preserved.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            {/* Brands */}
            <div>
              <Label>Add Brands</Label>
              <div className="flex flex-wrap gap-2 mt-2 p-3 border rounded-lg min-h-[40px]">
                {tagForm.brand_ids.map(bid => (
                  <Badge key={bid} variant="secondary" className="pr-1">
                    {getBrandCode(bid)}
                    <button 
                      className="ml-1 hover:text-red-500"
                      onClick={() => setTagForm({ 
                        ...tagForm, 
                        brand_ids: tagForm.brand_ids.filter(id => id !== bid) 
                      })}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <Select onValueChange={(v) => {
                if (v && !tagForm.brand_ids.includes(v)) {
                  setTagForm({ ...tagForm, brand_ids: [...tagForm.brand_ids, v] });
                }
              }}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select brand..." />
                </SelectTrigger>
                <SelectContent>
                  {brands.filter(b => !tagForm.brand_ids.includes(b.id)).map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.code} - {b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Verticals */}
            <div>
              <Label>Add Verticals</Label>
              <Select onValueChange={(v) => {
                if (v && !tagForm.vertical_ids.includes(v)) {
                  setTagForm({ ...tagForm, vertical_ids: [...tagForm.vertical_ids, v] });
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select vertical..." />
                </SelectTrigger>
                <SelectContent>
                  {verticals.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.code} - {v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap gap-1 mt-2">
                {tagForm.vertical_ids.map(vid => (
                  <Badge key={vid} variant="outline" className="bg-blue-50">
                    {getVerticalCode(vid)}
                    <button className="ml-1" onClick={() => setTagForm({ ...tagForm, vertical_ids: tagForm.vertical_ids.filter(id => id !== vid) })}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Models */}
            <div>
              <Label>Add Models</Label>
              <Select onValueChange={(v) => {
                if (v && !tagForm.model_ids.includes(v)) {
                  setTagForm({ ...tagForm, model_ids: [...tagForm.model_ids, v] });
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select model..." />
                </SelectTrigger>
                <SelectContent>
                  {models.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.code} - {m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap gap-1 mt-2">
                {tagForm.model_ids.map(mid => (
                  <Badge key={mid} variant="outline" className="bg-green-50">
                    {getModelCode(mid)}
                    <button className="ml-1" onClick={() => setTagForm({ ...tagForm, model_ids: tagForm.model_ids.filter(id => id !== mid) })}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Brand Specific */}
            <div className="flex items-center gap-2">
              <Checkbox 
                checked={tagForm.is_brand_specific}
                onCheckedChange={(checked) => setTagForm({ ...tagForm, is_brand_specific: checked })}
              />
              <Label>Mark as Brand Specific</Label>
            </div>

            <Separator />

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowBulkTagDialog(false)}>Cancel</Button>
              <Button onClick={handleBulkTag} data-testid="bulk-tag-btn">
                Add Tags to {selectedRMs.size} RMs
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Clone Request Detail Dialog */}
      <Dialog open={showCloneDetailDialog} onOpenChange={setShowCloneDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5" />
              Bidso SKU Clone Request
            </DialogTitle>
            <DialogDescription>
              Review the clone request details and BOM modifications
            </DialogDescription>
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
                  <Label className="text-xs text-gray-500">Requested By</Label>
                  <p>{selectedCloneRequest.requester_name}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Requested At</Label>
                  <p>{new Date(selectedCloneRequest.requested_at).toLocaleString()}</p>
                </div>
              </div>

              {selectedCloneRequest.proposed_description && (
                <div>
                  <Label className="text-xs text-gray-500">Description</Label>
                  <p className="text-sm text-gray-600">{selectedCloneRequest.proposed_description}</p>
                </div>
              )}

              {/* BOM Summary */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <h4 className="font-semibold text-sm mb-2">BOM Summary</h4>
                <div className="flex gap-4 text-sm">
                  <span>Total Items: <strong>{selectedCloneRequest.total_bom_items}</strong></span>
                  <span>Locked: <strong>{selectedCloneRequest.locked_items_count}</strong></span>
                  <span>Modified: <strong>{selectedCloneRequest.bom_modifications?.length || 0}</strong></span>
                </div>
              </div>

              {/* Modifications List */}
              {selectedCloneRequest.bom_modifications?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">BOM Modifications</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Action</TableHead>
                          <TableHead>Original RM</TableHead>
                          <TableHead>New RM</TableHead>
                          <TableHead>New Colour</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedCloneRequest.bom_modifications.map((mod, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              <Badge variant="outline" className={
                                mod.action === "CREATE_NEW" ? "bg-blue-50 text-blue-700" :
                                mod.action === "SWAP_COLOUR" ? "bg-purple-50 text-purple-700" :
                                "bg-orange-50 text-orange-700"
                              }>
                                {mod.action.replace("_", " ")}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{mod.original_rm_id}</TableCell>
                            <TableCell>
                              {mod.action === "CREATE_NEW" ? (
                                <div>
                                  <span className="text-blue-600 font-medium">[NEW]</span>
                                  <p className="text-xs text-gray-500">{mod.new_rm_name}</p>
                                </div>
                              ) : (
                                <span className="font-mono text-sm">{mod.new_rm_id}</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {mod.new_colour && <Badge variant="secondary">{mod.new_colour}</Badge>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* What will happen on approval */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                <h5 className="font-semibold text-blue-800 mb-1">On Approval:</h5>
                <ul className="list-disc list-inside text-blue-700 space-y-1">
                  <li>New Bidso SKU will be created: <code>{selectedCloneRequest.source_vertical_code}_{selectedCloneRequest.source_model_code}_XXX</code></li>
                  {selectedCloneRequest.bom_modifications?.filter(m => m.action === "CREATE_NEW").length > 0 && (
                    <li>{selectedCloneRequest.bom_modifications.filter(m => m.action === "CREATE_NEW").length} new RM(s) will be created</li>
                  )}
                  <li>Common BOM will be copied with modifications applied</li>
                </ul>
              </div>

              {/* Actions */}
              {selectedCloneRequest.status === "PENDING" && (
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setShowCloneDetailDialog(false)}>
                    Cancel
                  </Button>
                  <Button 
                    variant="destructive"
                    onClick={() => handleReviewBidsoCloneRequest(selectedCloneRequest.id, "REJECT")}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                  <Button 
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => handleReviewBidsoCloneRequest(selectedCloneRequest.id, "APPROVE")}
                    data-testid="approve-clone-detail"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Approve & Create
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              Reject Clone Request
            </DialogTitle>
            <DialogDescription>
              Please provide a reason for rejection. This will be visible to the requester.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div>
              <Label>Rejection Reason <span className="text-red-500">*</span></Label>
              <textarea
                className="w-full mt-1 p-3 border rounded-lg text-sm min-h-[120px] focus:ring-2 focus:ring-red-500 focus:border-red-500"
                placeholder="Explain why this request is being rejected and what changes are needed..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                data-testid="rejection-reason-input"
              />
            </div>
            
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={handleConfirmReject}
                disabled={!rejectionReason.trim()}
                data-testid="confirm-reject-btn"
              >
                <X className="h-4 w-4 mr-2" />
                Confirm Rejection
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Approval Result Dialog */}
      <Dialog open={showApprovalResultDialog} onOpenChange={setShowApprovalResultDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              Clone Request Approved Successfully
            </DialogTitle>
          </DialogHeader>
          
          {approvalResult && (
            <div className="space-y-4 mt-4">
              {/* New Bidso SKU */}
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <Label className="text-xs text-green-600">New Bidso SKU Created</Label>
                <p className="font-mono text-lg font-bold text-green-700 mt-1">
                  {approvalResult.created_bidso_sku_id}
                </p>
                <p className="text-sm text-green-600 mt-1">
                  BOM Items: {approvalResult.bom_items_count}
                </p>
              </div>
              
              {/* Created RMs */}
              {approvalResult.created_rm_ids && approvalResult.created_rm_ids.length > 0 && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <Label className="text-xs text-blue-600">New Raw Materials Created ({approvalResult.created_rm_ids.length})</Label>
                  <div className="mt-2 space-y-1">
                    {approvalResult.created_rm_ids.map((rmId, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono bg-white">
                          {rmId}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {(!approvalResult.created_rm_ids || approvalResult.created_rm_ids.length === 0) && (
                <div className="p-3 bg-gray-50 border rounded-lg text-sm text-gray-600">
                  No new RMs created - only existing RMs were swapped/modified.
                </div>
              )}
              
              <div className="flex justify-end pt-2">
                <Button onClick={() => setShowApprovalResultDialog(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add RM Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { setShowAddDialog(open); if (!open) resetAddForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Add New Raw Material</DialogTitle>
            <DialogDescription>Create a new RM with auto-generated code</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Category *</Label>
              <Select 
                value={selectedAddCategory || "select"} 
                onValueChange={(v) => { 
                  const cat = v === "select" ? "" : v;
                  setSelectedAddCategory(cat); 
                  setCategoryData({}); 
                  if (cat && rmCategories[cat]) {
                    setAddUom(rmCategories[cat].default_uom || "PCS");
                    setAddSourceType(rmCategories[cat].default_source_type || "PURCHASED");
                  } else {
                    setAddUom("");
                    setAddSourceType("");
                  }
                }}
              >
                <SelectTrigger data-testid="add-category-select">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(rmCategories).map(([code, cat]) => (
                    <SelectItem key={code} value={code}>{code} - {cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {selectedAddCategory && rmCategories[selectedAddCategory] && (
              <>
                <div className="p-3 bg-gray-50 border rounded-lg">
                  <p className="text-sm font-medium mb-2">Required fields for {selectedAddCategory}:</p>
                  <div className="flex flex-wrap gap-2">
                    {rmCategories[selectedAddCategory].fields.map(field => (
                      <span key={field} className="text-xs bg-gray-200 px-2 py-1 rounded">{formatFieldName(field)}</span>
                    ))}
                  </div>
                </div>
                
                {rmCategories[selectedAddCategory].fields.map(field => (
                  <div key={field}>
                    <Label>{formatFieldName(field)}</Label>
                    <Input
                      placeholder={`Enter ${formatFieldName(field).toLowerCase()}`}
                      value={categoryData[field] || ''}
                      onChange={(e) => setCategoryData({...categoryData, [field]: e.target.value})}
                    />
                  </div>
                ))}
                
                <div>
                  <Label>Low Stock Threshold</Label>
                  <Input
                    type="number"
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(parseInt(e.target.value) || 10)}
                    min="1"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>UOM</Label>
                    <Select value={addUom || "PCS"} onValueChange={setAddUom}>
                      <SelectTrigger data-testid="add-uom-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PCS">PCS (Pieces)</SelectItem>
                        <SelectItem value="KG">KG (Kilograms)</SelectItem>
                        <SelectItem value="GM">GM (Grams)</SelectItem>
                        <SelectItem value="MTR">MTR (Meters)</SelectItem>
                        <SelectItem value="LTR">LTR (Litres)</SelectItem>
                        <SelectItem value="SET">SET</SelectItem>
                        <SelectItem value="PAIR">PAIR</SelectItem>
                        <SelectItem value="ROLL">ROLL</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Source Type</Label>
                    <Select value={addSourceType || "PURCHASED"} onValueChange={setAddSourceType}>
                      <SelectTrigger data-testid="add-source-type-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PURCHASED">Purchased</SelectItem>
                        <SelectItem value="MANUFACTURED">Manufactured</SelectItem>
                        <SelectItem value="BOTH">Both</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Dual UOM Toggle */}
                <div className="space-y-3 border-t pt-3">
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="add-dual-uom" 
                      checked={addDualUom} 
                      onChange={(e) => setAddDualUom(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                      data-testid="add-dual-uom-toggle"
                    />
                    <Label htmlFor="add-dual-uom" className="text-sm cursor-pointer">
                      Different UOM for procurement & consumption
                    </Label>
                  </div>
                  
                  {addDualUom && (
                    <div className="grid grid-cols-3 gap-3 pl-6">
                      <div>
                        <Label className="text-xs">Procurement UOM</Label>
                        <Select value={addProcurementUom || "KG"} onValueChange={setAddProcurementUom}>
                          <SelectTrigger className="h-8 text-xs" data-testid="add-procurement-uom">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="KG">KG</SelectItem>
                            <SelectItem value="GM">GM</SelectItem>
                            <SelectItem value="MTR">MTR</SelectItem>
                            <SelectItem value="LTR">LTR</SelectItem>
                            <SelectItem value="ROLL">ROLL</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Consumption UOM</Label>
                        <Select value={addConsumptionUom || "PCS"} onValueChange={setAddConsumptionUom}>
                          <SelectTrigger className="h-8 text-xs" data-testid="add-consumption-uom">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PCS">PCS</SelectItem>
                            <SelectItem value="GM">GM</SelectItem>
                            <SelectItem value="SET">SET</SelectItem>
                            <SelectItem value="PAIR">PAIR</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Conversion Factor</Label>
                        <Input 
                          type="number" 
                          step="0.0001"
                          value={addConversionFactor} 
                          onChange={(e) => setAddConversionFactor(e.target.value)}
                          placeholder="e.g. 0.005"
                          className="h-8 text-xs font-mono"
                          data-testid="add-conversion-factor"
                        />
                        <p className="text-[10px] text-muted-foreground mt-0.5">1 consumption unit = X procurement units</p>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={() => downloadCategoryTemplate(selectedAddCategory)}>
                    <Download className="w-4 h-4 mr-2" />
                    Download Template
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => { setShowAddDialog(false); resetAddForm(); }}>
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
            <DialogDescription>{createdRMs.length} new RMs created successfully</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>RM ID</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {createdRMs.map((rm, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono">{rm.rm_id}</TableCell>
                      <TableCell><Badge variant="outline">{rm.category}</Badge></TableCell>
                      <TableCell className="text-gray-500 text-sm">
                        {Object.entries(rm.category_data || {}).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(', ')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
            <DialogDescription>Import RM data from a JSON export file</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              This is used for migrating data between environments.
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

export default RMRepository;

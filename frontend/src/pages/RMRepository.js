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

// Default fallback categories (used only if API fails)
const DEFAULT_RM_CATEGORIES = {
  "INP": { name: "In-house Plastic", fields: ["mould_code", "model_name", "part_name", "colour", "mb", "per_unit_weight", "unit"] },
  "ACC": { name: "Accessories", fields: ["type", "model_name", "specs", "colour", "per_unit_weight", "unit"] },
  "ELC": { name: "Electric Components", fields: ["model", "type", "specs", "per_unit_weight", "unit"] },
  "SP": { name: "Spares", fields: ["type", "specs", "per_unit_weight", "unit"] },
  "BS": { name: "Brand Assets", fields: ["position", "type", "brand", "buyer_sku", "per_unit_weight", "unit"] },
  "PM": { name: "Packaging", fields: ["model", "type", "specs", "brand", "per_unit_weight", "unit"] },
  "LB": { name: "Labels", fields: ["type", "buyer_sku", "per_unit_weight", "unit"] },
  "INM": { name: "Input Materials", fields: ["type", "specs", "per_unit_weight", "unit"] },
  "POLY": { name: "Polymer Grades", fields: ["grade", "manufacturer", "mfi"] },
  "MB": { name: "Master Batch", fields: ["colour_name", "pantone_code", "polymer_base"] },
  "PWD": { name: "Powder Coating", fields: ["colour_name", "finish_type", "manufacturer"] },
  "PIPE": { name: "Metal Pipes", fields: ["material", "diameter", "thickness", "length"] }
};

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
  
  // RM Categories from database
  const [rmCategories, setRmCategories] = useState(DEFAULT_RM_CATEGORIES);
  
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
    is_brand_specific: false
  });
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

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
    }
  }, [activeTab, filters, currentPage, pageSize]);

  // Fetch RM Categories from database
  const fetchRmCategories = async () => {
    try {
      const response = await axios.get(`${API}/rm-categories`);
      const dbCategories = response.data || {};
      
      // API already returns in the correct format {code: {name, fields, nameFormat}}
      // Merge with defaults to ensure all categories are available
      setRmCategories({ ...DEFAULT_RM_CATEGORIES, ...dbCategories });
    } catch (error) {
      console.error("Failed to fetch RM categories, using defaults:", error);
      setRmCategories(DEFAULT_RM_CATEGORIES);
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
        const category = rm.rm_id?.split('_')[0] || 'OTHER';
        if (!categorizedRMs[category]) {
          categorizedRMs[category] = [];
        }
        categorizedRMs[category].push(rm);
      });
      
      // Create workbook
      const wb = XLSX.utils.book_new();
      
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
        // Map data to rows
        const sheetData = rms.map(rm => {
          const row = {};
          columns.forEach(col => {
            let value = rm[col.key];
            // Format dates
            if (col.key === 'created_at' && value) {
              value = new Date(value).toLocaleDateString();
            }
            row[col.header] = value || '';
          });
          return row;
        });
        
        // Create worksheet
        const ws = XLSX.utils.json_to_sheet(sheetData);
        
        // Set column widths
        ws['!cols'] = [
          { wch: 15 },  // RM ID
          { wch: 50 },  // Description
          { wch: 12 },  // Category
          { wch: 14 },  // Source Type
          { wch: 10 },  // BOM Level
          { wch: 8 },   // UOM
          { wch: 12 },  // HSN Code
          { wch: 12 },  // GST Rate
          { wch: 12 },  // Min Order Qty
          { wch: 15 },  // Lead Time
          { wch: 10 },  // Status
          { wch: 12 }   // Created At
        ];
        
        // Add sheet with category name (max 31 chars for Excel)
        const sheetName = `${category} - ${getCategoryName(category, rmCategories)}`.slice(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      });
      
      // Add summary sheet at the beginning
      const summaryData = Object.entries(categorizedRMs).map(([cat, rms]) => ({
        'Category Code': cat,
        'Category Name': getCategoryName(cat, rmCategories),
        'Total RMs': rms.length
      }));
      summaryData.push({ 'Category Code': '', 'Category Name': 'TOTAL', 'Total RMs': allRMs.length });
      
      const summaryWs = XLSX.utils.json_to_sheet(summaryData);
      summaryWs['!cols'] = [{ wch: 15 }, { wch: 25 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary', true); // Insert at beginning
      
      // Generate file
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      // Download
      const filename = `RM_Repository_${new Date().toISOString().split('T')[0]}.xlsx`;
      saveAs(blob, filename);
      
      toast.success(`Exported ${allRMs.length} RMs across ${Object.keys(categorizedRMs).length} categories`);
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export RM repository");
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
    setTagForm({
      brand_ids: rm.brand_ids || [],
      vertical_ids: rm.vertical_ids || [],
      model_ids: rm.model_ids || [],
      is_brand_specific: rm.is_brand_specific || false
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
        low_stock_threshold: lowStockThreshold
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
      </Tabs>

      {/* Edit Tags Dialog */}
      <Dialog open={showTagDialog} onOpenChange={setShowTagDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Tags - {editingRM?.rm_id}</DialogTitle>
            <DialogDescription>
              Add or remove brand, vertical, and model tags for this raw material.
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
                onValueChange={(v) => { setSelectedAddCategory(v === "select" ? "" : v); setCategoryData({}); }}
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

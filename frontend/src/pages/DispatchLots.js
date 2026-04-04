import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { 
  Package, Plus, Search, Send, FileText, Truck, Upload, Download, 
  Eye, Edit, Trash2, Check, X, AlertTriangle, Building, Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import useAuthStore from "@/store/authStore";

const API = process.env.REACT_APP_BACKEND_URL;

const STATUS_COLORS = {
  DRAFT: "bg-gray-100 text-gray-700",
  PENDING_FINANCE: "bg-yellow-100 text-yellow-700",
  INVOICED: "bg-blue-100 text-blue-700",
  DISPATCHED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700"
};

const PAYMENT_TERMS = [
  { value: "DUE_ON_RECEIPT", label: "Due on Receipt", days: 0 },
  { value: "NET_15", label: "Net 15", days: 15 },
  { value: "NET_30", label: "Net 30", days: 30 },
  { value: "NET_45", label: "Net 45", days: 45 },
  { value: "NET_60", label: "Net 60", days: 60 }
];

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Puducherry", "Chandigarh"
];

const DispatchLots = () => {
  const { hasRole, isMasterAdmin, token } = useAuthStore();
  const isAdmin = isMasterAdmin();
  const isDemandTeam = hasRole('DEMAND_PLANNER') || isAdmin;
  const isFinanceTeam = hasRole('FINANCE_VIEWER') || hasRole('finance_viewer') || isAdmin;
  
  const [lots, setLots] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [buyerSkus, setBuyerSkus] = useState([]);
  const [branches, setBranches] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  
  // Create Lot Dialog (Demand Team)
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [lotLines, setLotLines] = useState([{ buyer_sku_id: "", quantity: 1 }]);
  const [lotNotes, setLotNotes] = useState("");
  
  // Invoice Dialog (Finance Team)
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [selectedLot, setSelectedLot] = useState(null);
  const [inventoryCheck, setInventoryCheck] = useState(null);
  const [invoiceData, setInvoiceData] = useState({
    branch_id: "",
    source_of_supply: "",
    order_number: "",
    invoice_date: new Date().toISOString().split('T')[0],
    payment_terms: "NET_30",
    due_date: "",
    accounts_receivable: "Accounts Receivable",
    salesperson: "",
    subject: "",
    customer_notes: "",
    terms_conditions: ""
  });
  const [invoiceLines, setInvoiceLines] = useState([]);
  const [invoiceTotals, setInvoiceTotals] = useState({
    sub_total: 0,
    discount_type: "percentage",
    discount_value: 0,
    discount_amount: 0,
    tds_tcs_type: null,
    tds_tcs_rate: 0,
    tds_tcs_amount: 0,
    adjustment: 0,
    grand_total: 0
  });
  
  const fileInputRef = useRef(null);
  
  // Finance Create Lot Dialog
  const [showFinanceCreateDialog, setShowFinanceCreateDialog] = useState(false);
  const [financeCreateData, setFinanceCreateData] = useState({
    customer_id: "",
    branch_id: "",
    order_number: "",
    notes: ""
  });
  const [financeLines, setFinanceLines] = useState([{ buyer_sku_id: "", quantity: 1, rate: 0 }]);
  const [financeCreating, setFinanceCreating] = useState(false);
  
  // Add Line Dialog
  const [showAddLineDialog, setShowAddLineDialog] = useState(false);
  const [addLineData, setAddLineData] = useState({ buyer_sku_id: "", quantity: 1 });
  const [addLineLotId, setAddLineLotId] = useState(null);
  const [addingLine, setAddingLine] = useState(false);
  const [skuLookup, setSkuLookup] = useState(null);

  // Fetch data
  useEffect(() => {
    fetchLots();
    fetchSummary();
    fetchCustomers();
    fetchBuyerSkus();
    fetchBranches();
  }, [statusFilter, customerFilter]);

  // Calculate due date when payment terms change
  useEffect(() => {
    if (invoiceData.payment_terms && invoiceData.invoice_date) {
      const term = PAYMENT_TERMS.find(t => t.value === invoiceData.payment_terms);
      if (term) {
        const invoiceDate = new Date(invoiceData.invoice_date);
        const dueDate = new Date(invoiceDate);
        dueDate.setDate(dueDate.getDate() + term.days);
        setInvoiceData(prev => ({ ...prev, due_date: dueDate.toISOString().split('T')[0] }));
      }
    }
  }, [invoiceData.payment_terms, invoiceData.invoice_date]);

  // Calculate invoice totals
  useEffect(() => {
    let subTotal = 0;
    let taxTotal = 0;
    
    invoiceLines.forEach(line => {
      const lineAmount = (line.quantity || 0) * (line.rate || 0);
      const lineTax = lineAmount * ((line.gst_rate || 0) / 100);
      subTotal += lineAmount;
      taxTotal += lineTax;
    });
    
    let discountAmount = 0;
    if (invoiceTotals.discount_type === "percentage") {
      discountAmount = subTotal * (invoiceTotals.discount_value / 100);
    } else {
      discountAmount = invoiceTotals.discount_value;
    }
    
    let tdsTcsAmount = 0;
    if (invoiceTotals.tds_tcs_type && invoiceTotals.tds_tcs_rate) {
      tdsTcsAmount = (subTotal - discountAmount) * (invoiceTotals.tds_tcs_rate / 100);
    }
    
    const grandTotal = subTotal - discountAmount + taxTotal - tdsTcsAmount + invoiceTotals.adjustment;
    
    setInvoiceTotals(prev => ({
      ...prev,
      sub_total: subTotal,
      discount_amount: discountAmount,
      tds_tcs_amount: tdsTcsAmount,
      grand_total: grandTotal
    }));
  }, [invoiceLines, invoiceTotals.discount_type, invoiceTotals.discount_value, invoiceTotals.tds_tcs_type, invoiceTotals.tds_tcs_rate, invoiceTotals.adjustment]);

  const fetchLots = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "ALL") params.append("status", statusFilter);
      if (customerFilter && customerFilter !== "ALL") params.append("customer_id", customerFilter);
      
      const res = await axios.get(`${API}/api/dispatch-lots-v2?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLots(res.data.lots || []);
    } catch (err) {
      console.error("Error fetching lots:", err);
    }
    setLoading(false);
  };

  const fetchSummary = async () => {
    try {
      const res = await axios.get(`${API}/api/dispatch-lots-v2/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSummary(res.data);
    } catch (err) {
      console.error("Error fetching summary:", err);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await axios.get(`${API}/api/buyers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCustomers(res.data || []);
    } catch (err) {
      console.error("Error fetching customers:", err);
    }
  };

  const fetchBuyerSkus = async () => {
    try {
      const res = await axios.get(`${API}/api/sku-management/buyer-skus?page_size=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBuyerSkus(res.data.items || res.data.buyer_skus || []);
    } catch (err) {
      console.error("Error fetching SKUs:", err);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await axios.get(`${API}/api/branches`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBranches(res.data || []);
    } catch (err) {
      console.error("Error fetching branches:", err);
    }
  };

  // Demand Team Actions
  const handleCreateLot = async () => {
    if (!selectedCustomer) {
      toast.error("Please select a customer");
      return;
    }
    
    const validLines = lotLines.filter(l => l.buyer_sku_id && l.quantity > 0);
    if (validLines.length === 0) {
      toast.error("Please add at least one valid line item");
      return;
    }
    
    try {
      const res = await axios.post(`${API}/api/dispatch-lots-v2`, {
        customer_id: selectedCustomer,
        lines: validLines,
        notes: lotNotes
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(`Lot ${res.data.lot_number} created`);
      setShowCreateDialog(false);
      resetLotForm();
      fetchLots();
      fetchSummary();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create lot");
    }
  };

  const handleSendToFinance = async (lotId) => {
    try {
      await axios.post(`${API}/api/dispatch-lots-v2/${lotId}/send-to-finance`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Lot sent to finance");
      fetchLots();
      fetchSummary();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to send to finance");
    }
  };

  const handleDeleteLot = async (lotId) => {
    if (!window.confirm("Are you sure you want to delete this lot?")) return;
    
    try {
      await axios.delete(`${API}/api/dispatch-lots-v2/${lotId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Lot deleted");
      fetchLots();
      fetchSummary();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete lot");
    }
  };

  // ============ Finance Create Lot Functions ============
  
  const handleFinanceCreateLot = async () => {
    if (!financeCreateData.customer_id || !financeCreateData.branch_id) {
      toast.error("Please select customer and branch");
      return;
    }
    
    const validLines = financeLines.filter(l => l.buyer_sku_id && l.quantity > 0);
    if (validLines.length === 0) {
      toast.error("Please add at least one line item");
      return;
    }
    
    setFinanceCreating(true);
    try {
      const res = await axios.post(`${API}/api/dispatch-lots-v2/finance/create-lot`, {
        customer_id: financeCreateData.customer_id,
        branch_id: financeCreateData.branch_id,
        lines: validLines.map(l => ({
          buyer_sku_id: l.buyer_sku_id,
          quantity: parseInt(l.quantity),
          rate: l.rate || undefined
        })),
        order_number: financeCreateData.order_number || undefined,
        notes: financeCreateData.notes || undefined
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(`Dispatch lot ${res.data.lot_number} created`);
      setShowFinanceCreateDialog(false);
      setFinanceCreateData({ customer_id: "", branch_id: "", order_number: "", notes: "" });
      setFinanceLines([{ buyer_sku_id: "", quantity: 1, rate: 0 }]);
      fetchLots();
      fetchSummary();
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (detail?.error === "INSUFFICIENT_INVENTORY") {
        toast.error(`Insufficient inventory: ${detail.shortages?.length} item(s) short`);
      } else {
        toast.error(typeof detail === 'string' ? detail : "Failed to create lot");
      }
    } finally {
      setFinanceCreating(false);
    }
  };

  const handleFinanceLineSkuChange = async (index, skuId) => {
    const newLines = [...financeLines];
    newLines[index].buyer_sku_id = skuId;
    
    // Lookup SKU details
    if (skuId && financeCreateData.customer_id) {
      try {
        const res = await axios.get(
          `${API}/api/dispatch-lots-v2/sku-lookup/${skuId}?customer_id=${financeCreateData.customer_id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        newLines[index].rate = res.data.rate || 0;
        newLines[index].sku_name = res.data.name;
        newLines[index].hsn_code = res.data.hsn_code;
        newLines[index].gst_rate = res.data.gst_rate;
      } catch (err) {
        // SKU not found or error - just update the ID
      }
    }
    
    setFinanceLines(newLines);
  };

  const addFinanceLine = () => {
    setFinanceLines([...financeLines, { buyer_sku_id: "", quantity: 1, rate: 0 }]);
  };

  const removeFinanceLine = (index) => {
    if (financeLines.length > 1) {
      setFinanceLines(financeLines.filter((_, i) => i !== index));
    }
  };

  // ============ Add Line to Existing Lot Functions ============
  
  const openAddLineDialog = (lot) => {
    setAddLineLotId(lot.id);
    setAddLineData({ buyer_sku_id: "", quantity: 1 });
    setSkuLookup(null);
    setShowAddLineDialog(true);
  };

  const handleAddLineLookup = async (skuId) => {
    setAddLineData({ ...addLineData, buyer_sku_id: skuId });
    
    if (!skuId) {
      setSkuLookup(null);
      return;
    }
    
    // Find the lot to get customer_id
    const lot = lots.find(l => l.id === addLineLotId);
    if (!lot) return;
    
    try {
      const res = await axios.get(
        `${API}/api/dispatch-lots-v2/sku-lookup/${skuId}?customer_id=${lot.buyer_id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSkuLookup(res.data);
    } catch (err) {
      setSkuLookup(null);
      toast.error("SKU not found");
    }
  };

  const handleAddLineSubmit = async () => {
    if (!addLineData.buyer_sku_id || addLineData.quantity <= 0) {
      toast.error("Please enter valid SKU and quantity");
      return;
    }
    
    setAddingLine(true);
    try {
      const res = await axios.post(`${API}/api/dispatch-lots-v2/${addLineLotId}/add-line`, {
        buyer_sku_id: addLineData.buyer_sku_id,
        quantity: parseInt(addLineData.quantity)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(`Added ${res.data.sku_name} (${res.data.quantity} units)`);
      setShowAddLineDialog(false);
      fetchLots();
      
      // If invoice dialog is open, refresh it
      if (showInvoiceDialog && selectedLot?.id === addLineLotId) {
        openInvoiceDialog(selectedLot);
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (detail?.error === "INSUFFICIENT_INVENTORY") {
        toast.error(`Insufficient inventory: ${detail.shortage} units short`);
      } else {
        toast.error(typeof detail === 'string' ? detail : "Failed to add line");
      }
    } finally {
      setAddingLine(false);
    }
  };

  // Finance Team Actions
  const openInvoiceDialog = async (lot) => {
    setSelectedLot(lot);
    
    // Fetch enriched lot details
    try {
      const res = await axios.get(`${API}/api/dispatch-lots-v2/${lot.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const enrichedLot = res.data;
      
      // Initialize invoice lines from lot lines
      const lines = enrichedLot.lines.map(l => ({
        buyer_sku_id: l.buyer_sku_id,
        sku_name: l.sku_name,
        quantity: l.quantity,
        rate: l.unit_price || 0,
        hsn_code: l.hsn_code || "",
        gst_rate: l.gst_rate || 18,
        amount: l.quantity * (l.unit_price || 0)
      }));
      
      setInvoiceLines(lines);
      setSelectedLot(enrichedLot);
      setShowInvoiceDialog(true);
    } catch (err) {
      toast.error("Failed to load lot details");
    }
  };

  const checkInventory = async () => {
    if (!invoiceData.branch_id || !selectedLot) return;
    
    try {
      const res = await axios.get(
        `${API}/api/dispatch-lots-v2/${selectedLot.id}/inventory-check?branch_id=${invoiceData.branch_id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setInventoryCheck(res.data);
    } catch (err) {
      toast.error("Failed to check inventory");
    }
  };

  useEffect(() => {
    if (invoiceData.branch_id && selectedLot) {
      checkInventory();
    }
  }, [invoiceData.branch_id]);

  const handleCreateInvoice = async () => {
    if (!invoiceData.branch_id) {
      toast.error("Please select a branch");
      return;
    }
    
    if (!invoiceData.source_of_supply) {
      toast.error("Please select source of supply");
      return;
    }
    
    if (inventoryCheck && !inventoryCheck.can_proceed) {
      toast.error("Cannot proceed - insufficient inventory");
      return;
    }
    
    try {
      const payload = {
        ...invoiceData,
        line_items: invoiceLines.map(l => ({
          buyer_sku_id: l.buyer_sku_id,
          sku_name: l.sku_name,
          quantity: l.quantity,
          rate: l.rate,
          hsn_code: l.hsn_code,
          gst_rate: l.gst_rate,
          tax_amount: l.quantity * l.rate * (l.gst_rate / 100),
          amount: l.quantity * l.rate
        })),
        totals: invoiceTotals
      };
      
      await axios.post(`${API}/api/dispatch-lots-v2/${selectedLot.id}/create-invoice`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success("Invoice created successfully");
      setShowInvoiceDialog(false);
      resetInvoiceForm();
      fetchLots();
      fetchSummary();
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (typeof detail === 'object' && detail.items) {
        toast.error(`Insufficient inventory: ${detail.items.map(i => i.buyer_sku_id).join(', ')}`);
      } else {
        toast.error(detail || "Failed to create invoice");
      }
    }
  };

  const handleMarkDispatched = async (lotId) => {
    try {
      await axios.post(`${API}/api/dispatch-lots-v2/${lotId}/dispatch`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Marked as dispatched");
      fetchLots();
      fetchSummary();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to mark as dispatched");
    }
  };

  // Bulk Upload
  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const res = await axios.post(`${API}/api/dispatch-lots-v2/bulk-upload`, formData, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" }
      });
      
      toast.success(res.data.message);
      if (res.data.errors?.length > 0) {
        toast.warning(`${res.data.errors.length} errors occurred`);
      }
      fetchLots();
      fetchSummary();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Upload failed");
    }
    
    e.target.value = null;
  };

  const downloadTemplate = () => {
    const template = [
      { customer_id: "CUST_0001", buyer_sku_id: "ERW001_TVS", quantity: 100 },
      { customer_id: "CUST_0001", buyer_sku_id: "ERW002_TVS", quantity: 50 },
      { customer_id: "CUST_0002", buyer_sku_id: "TRK001_HERO", quantity: 75 }
    ];
    
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dispatch Lots");
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: "application/octet-stream" }), "dispatch_lots_template.xlsx");
  };

  const resetLotForm = () => {
    setSelectedCustomer("");
    setLotLines([{ buyer_sku_id: "", quantity: 1 }]);
    setLotNotes("");
  };

  const resetInvoiceForm = () => {
    setSelectedLot(null);
    setInventoryCheck(null);
    setInvoiceData({
      branch_id: "",
      source_of_supply: "",
      order_number: "",
      invoice_date: new Date().toISOString().split('T')[0],
      payment_terms: "NET_30",
      due_date: "",
      accounts_receivable: "Accounts Receivable",
      salesperson: "",
      subject: "",
      customer_notes: "",
      terms_conditions: ""
    });
    setInvoiceLines([]);
    setInvoiceTotals({
      sub_total: 0,
      discount_type: "percentage",
      discount_value: 0,
      discount_amount: 0,
      tds_tcs_type: null,
      tds_tcs_rate: 0,
      tds_tcs_amount: 0,
      adjustment: 0,
      grand_total: 0
    });
  };

  return (
    <div className="p-6 md:p-8" data-testid="dispatch-lots-page">
      {/* Header */}
      <div className="mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight uppercase">Dispatch Lots</h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">
            {isDemandTeam && "Create dispatch requests"} {isDemandTeam && isFinanceTeam && "•"} {isFinanceTeam && "Process invoices"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isDemandTeam && (
            <>
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="w-4 h-4 mr-2" />
                Template
              </Button>
              <input type="file" ref={fileInputRef} onChange={handleBulkUpload} accept=".xlsx,.xls" className="hidden" />
              <Button variant="outline" onClick={() => fileInputRef.current.click()}>
                <Upload className="w-4 h-4 mr-2" />
                Bulk Upload
              </Button>
              <Button onClick={() => setShowCreateDialog(true)} data-testid="create-lot-btn">
                <Plus className="w-4 h-4 mr-2" />
                New Lot
              </Button>
            </>
          )}
          {isFinanceTeam && !isDemandTeam && (
            <Button onClick={() => setShowFinanceCreateDialog(true)} data-testid="finance-create-lot-btn">
              <Plus className="w-4 h-4 mr-2" />
              Create Dispatch Lot
            </Button>
          )}
          {isFinanceTeam && isDemandTeam && (
            <Button variant="outline" onClick={() => setShowFinanceCreateDialog(true)} data-testid="finance-create-lot-btn">
              <FileText className="w-4 h-4 mr-2" />
              Quick Invoice Lot
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white border rounded-lg p-4">
          <div className="text-2xl font-bold">{summary.total || 0}</div>
          <div className="text-xs text-muted-foreground uppercase">Total Lots</div>
        </div>
        <div className="bg-gray-50 border rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-700">{summary.DRAFT || 0}</div>
          <div className="text-xs text-muted-foreground uppercase">Draft</div>
        </div>
        <div className="bg-yellow-50 border rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-700">{summary.PENDING_FINANCE || 0}</div>
          <div className="text-xs text-muted-foreground uppercase">Pending Finance</div>
        </div>
        <div className="bg-blue-50 border rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-700">{summary.INVOICED || 0}</div>
          <div className="text-xs text-muted-foreground uppercase">Invoiced</div>
        </div>
        <div className="bg-green-50 border rounded-lg p-4">
          <div className="text-2xl font-bold text-green-700">{summary.DISPATCHED || 0}</div>
          <div className="text-xs text-muted-foreground uppercase">Dispatched</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="PENDING_FINANCE">Pending Finance</SelectItem>
            <SelectItem value="INVOICED">Invoiced</SelectItem>
            <SelectItem value="DISPATCHED">Dispatched</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={customerFilter} onValueChange={setCustomerFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Customers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Customers</SelectItem>
            {customers.slice(0, 100).map(c => (
              <SelectItem key={c.id} value={c.customer_code || c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lots Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-50">
              <TableHead>Lot #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-center">Items</TableHead>
              <TableHead className="text-right">Total Qty</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lots.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No dispatch lots found
                </TableCell>
              </TableRow>
            ) : (
              lots.map(lot => (
                <TableRow key={lot.id}>
                  <TableCell className="font-mono font-medium">{lot.lot_number}</TableCell>
                  <TableCell>{lot.customer_name}</TableCell>
                  <TableCell className="text-center">{lot.lines?.length || 0}</TableCell>
                  <TableCell className="text-right font-mono">{lot.total_quantity}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[lot.status]}>{lot.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(lot.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {lot.status === "DRAFT" && isDemandTeam && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => handleSendToFinance(lot.id)} title="Send to Finance">
                            <Send className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteLot(lot.id)} title="Delete">
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </>
                      )}
                      {(lot.status === "PENDING_FINANCE" || lot.status === "DRAFT") && isFinanceTeam && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => openAddLineDialog(lot)} title="Add Line Item">
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openInvoiceDialog(lot)}>
                            <FileText className="h-4 w-4 mr-1" />
                            Invoice
                          </Button>
                        </>
                      )}
                      {lot.status === "INVOICED" && isFinanceTeam && (
                        <Button size="sm" variant="outline" onClick={() => handleMarkDispatched(lot.id)}>
                          <Truck className="h-4 w-4 mr-1" />
                          Dispatch
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Lot Dialog - Demand Team */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => { setShowCreateDialog(open); if (!open) resetLotForm(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-bold uppercase flex items-center gap-2">
              <Package className="h-5 w-5" />
              Create Dispatch Lot
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Customer *</Label>
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.customer_code || c.id}>
                      {c.name} ({c.customer_code || c.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Line Items *</Label>
                <Button size="sm" variant="outline" onClick={() => setLotLines([...lotLines, { buyer_sku_id: "", quantity: 1 }])}>
                  <Plus className="h-3 w-3 mr-1" /> Add Line
                </Button>
              </div>
              
              <div className="space-y-2">
                {lotLines.map((line, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Select 
                      value={line.buyer_sku_id} 
                      onValueChange={(v) => {
                        const updated = [...lotLines];
                        updated[idx].buyer_sku_id = v;
                        setLotLines(updated);
                      }}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select Buyer SKU" />
                      </SelectTrigger>
                      <SelectContent>
                        {buyerSkus.map(sku => (
                          <SelectItem key={sku.buyer_sku_id} value={sku.buyer_sku_id}>
                            {sku.buyer_sku_id} - {sku.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min="1"
                      value={line.quantity}
                      onChange={(e) => {
                        const updated = [...lotLines];
                        updated[idx].quantity = parseInt(e.target.value) || 1;
                        setLotLines(updated);
                      }}
                      className="w-24 text-right"
                      placeholder="Qty"
                    />
                    {lotLines.length > 1 && (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => setLotLines(lotLines.filter((_, i) => i !== idx))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <Label>Notes</Label>
              <Textarea 
                value={lotNotes} 
                onChange={(e) => setLotNotes(e.target.value)}
                placeholder="Optional notes..."
                rows={2}
              />
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button onClick={handleCreateLot}>Create Lot</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invoice Dialog - Finance Team */}
      <Dialog open={showInvoiceDialog} onOpenChange={(open) => { setShowInvoiceDialog(open); if (!open) resetInvoiceForm(); }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-bold uppercase flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Create Invoice - {selectedLot?.lot_number}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Header Info */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-xs uppercase">Customer</Label>
                <div className="font-medium">{selectedLot?.customer_name}</div>
              </div>
              
              <div>
                <Label className="text-xs uppercase">Branch *</Label>
                <Select value={invoiceData.branch_id} onValueChange={(v) => setInvoiceData({...invoiceData, branch_id: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map(b => (
                      <SelectItem key={b.branch_id} value={b.branch_id}>
                        {b.name} ({b.branch_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className="text-xs uppercase">Source of Supply *</Label>
                <Select value={invoiceData.source_of_supply} onValueChange={(v) => setInvoiceData({...invoiceData, source_of_supply: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDIAN_STATES.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label className="text-xs uppercase">Order Number</Label>
                <Input 
                  value={invoiceData.order_number} 
                  onChange={(e) => setInvoiceData({...invoiceData, order_number: e.target.value})}
                  placeholder="PO-12345"
                />
              </div>
              <div>
                <Label className="text-xs uppercase">Invoice Date *</Label>
                <Input 
                  type="date"
                  value={invoiceData.invoice_date} 
                  onChange={(e) => setInvoiceData({...invoiceData, invoice_date: e.target.value})}
                />
              </div>
              <div>
                <Label className="text-xs uppercase">Payment Terms</Label>
                <Select value={invoiceData.payment_terms} onValueChange={(v) => setInvoiceData({...invoiceData, payment_terms: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TERMS.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs uppercase">Due Date</Label>
                <Input 
                  type="date"
                  value={invoiceData.due_date} 
                  onChange={(e) => setInvoiceData({...invoiceData, due_date: e.target.value})}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-xs uppercase">Accounts Receivable</Label>
                <Input 
                  value={invoiceData.accounts_receivable} 
                  onChange={(e) => setInvoiceData({...invoiceData, accounts_receivable: e.target.value})}
                />
              </div>
              <div>
                <Label className="text-xs uppercase">Salesperson</Label>
                <Input 
                  value={invoiceData.salesperson} 
                  onChange={(e) => setInvoiceData({...invoiceData, salesperson: e.target.value})}
                  placeholder="Optional"
                />
              </div>
              <div>
                <Label className="text-xs uppercase">Subject</Label>
                <Input 
                  value={invoiceData.subject} 
                  onChange={(e) => setInvoiceData({...invoiceData, subject: e.target.value})}
                  placeholder="Invoice description"
                />
              </div>
            </div>
            
            <Separator />
            
            {/* Inventory Check */}
            {inventoryCheck && (
              <div className={`p-4 rounded-lg ${inventoryCheck.can_proceed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border`}>
                <div className="flex items-center gap-2 mb-2">
                  {inventoryCheck.can_proceed ? (
                    <Check className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  )}
                  <span className="font-semibold">
                    {inventoryCheck.can_proceed ? "Inventory Available" : "Insufficient Inventory"}
                  </span>
                </div>
                <div className="space-y-1 text-sm">
                  {inventoryCheck.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span>{item.buyer_sku_id}</span>
                      <span className={item.sufficient ? "text-green-600" : "text-red-600"}>
                        Required: {item.required} | Available: {item.available}
                        {item.sufficient ? " ✓" : " ✗"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Line Items */}
            <div>
              <Label className="text-xs uppercase mb-2 block">Item Details</Label>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-zinc-50">
                      <TableHead>Item</TableHead>
                      <TableHead className="w-20 text-right">Qty</TableHead>
                      <TableHead className="w-24 text-right">Rate</TableHead>
                      <TableHead className="w-24">HSN</TableHead>
                      <TableHead className="w-20 text-right">GST %</TableHead>
                      <TableHead className="w-28 text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoiceLines.map((line, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono text-sm">
                          {line.buyer_sku_id}
                          <div className="text-xs text-muted-foreground">{line.sku_name}</div>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={line.quantity}
                            onChange={(e) => {
                              const updated = [...invoiceLines];
                              updated[idx].quantity = parseInt(e.target.value) || 0;
                              updated[idx].amount = updated[idx].quantity * updated[idx].rate;
                              setInvoiceLines(updated);
                            }}
                            className="w-20 text-right"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={line.rate}
                            onChange={(e) => {
                              const updated = [...invoiceLines];
                              updated[idx].rate = parseFloat(e.target.value) || 0;
                              updated[idx].amount = updated[idx].quantity * updated[idx].rate;
                              setInvoiceLines(updated);
                            }}
                            className="w-24 text-right"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={line.hsn_code}
                            onChange={(e) => {
                              const updated = [...invoiceLines];
                              updated[idx].hsn_code = e.target.value;
                              setInvoiceLines(updated);
                            }}
                            className="w-24 font-mono"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={line.gst_rate}
                            onChange={(e) => {
                              const updated = [...invoiceLines];
                              updated[idx].gst_rate = parseFloat(e.target.value) || 0;
                              setInvoiceLines(updated);
                            }}
                            className="w-20 text-right"
                          />
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ₹{(line.quantity * line.rate).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            
            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-80 space-y-2">
                <div className="flex justify-between">
                  <span>Sub Total</span>
                  <span className="font-mono">₹{invoiceTotals.sub_total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span>Discount</span>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={invoiceTotals.discount_value}
                      onChange={(e) => setInvoiceTotals({...invoiceTotals, discount_value: parseFloat(e.target.value) || 0})}
                      className="w-16 text-right"
                    />
                    <Select 
                      value={invoiceTotals.discount_type} 
                      onValueChange={(v) => setInvoiceTotals({...invoiceTotals, discount_type: v})}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">%</SelectItem>
                        <SelectItem value="amount">₹</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="font-mono w-24 text-right">-₹{invoiceTotals.discount_amount.toFixed(2)}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span>TDS/TCS</span>
                  <div className="flex items-center gap-1">
                    <Select 
                      value={invoiceTotals.tds_tcs_type || "NONE"} 
                      onValueChange={(v) => setInvoiceTotals({...invoiceTotals, tds_tcs_type: v === "NONE" ? null : v})}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE">None</SelectItem>
                        <SelectItem value="TDS">TDS</SelectItem>
                        <SelectItem value="TCS">TCS</SelectItem>
                      </SelectContent>
                    </Select>
                    {invoiceTotals.tds_tcs_type && (
                      <Input
                        type="number"
                        step="0.1"
                        value={invoiceTotals.tds_tcs_rate}
                        onChange={(e) => setInvoiceTotals({...invoiceTotals, tds_tcs_rate: parseFloat(e.target.value) || 0})}
                        className="w-16 text-right"
                        placeholder="%"
                      />
                    )}
                    <span className="font-mono w-24 text-right">-₹{invoiceTotals.tds_tcs_amount.toFixed(2)}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span>Adjustment</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={invoiceTotals.adjustment}
                    onChange={(e) => setInvoiceTotals({...invoiceTotals, adjustment: parseFloat(e.target.value) || 0})}
                    className="w-28 text-right font-mono"
                  />
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Grand Total</span>
                  <span className="font-mono">₹{invoiceTotals.grand_total.toFixed(2)}</span>
                </div>
              </div>
            </div>
            
            {/* Notes */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs uppercase">Customer Notes</Label>
                <Textarea 
                  value={invoiceData.customer_notes}
                  onChange={(e) => setInvoiceData({...invoiceData, customer_notes: e.target.value})}
                  placeholder="Notes visible on invoice..."
                  rows={2}
                />
              </div>
              <div>
                <Label className="text-xs uppercase">Terms & Conditions</Label>
                <Textarea 
                  value={invoiceData.terms_conditions}
                  onChange={(e) => setInvoiceData({...invoiceData, terms_conditions: e.target.value})}
                  placeholder="Payment terms, delivery conditions..."
                  rows={2}
                />
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowInvoiceDialog(false)}>Cancel</Button>
              <Button 
                onClick={handleCreateInvoice}
                disabled={!inventoryCheck?.can_proceed || !invoiceData.branch_id || !invoiceData.source_of_supply}
              >
                Create Invoice
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Finance Create Dispatch Lot Dialog */}
      <Dialog open={showFinanceCreateDialog} onOpenChange={setShowFinanceCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Create Dispatch Lot (Finance)
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Customer *</Label>
                <Select 
                  value={financeCreateData.customer_id} 
                  onValueChange={(v) => setFinanceCreateData({ ...financeCreateData, customer_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.customer_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Branch (for inventory) *</Label>
                <Select 
                  value={financeCreateData.branch_id} 
                  onValueChange={(v) => setFinanceCreateData({ ...financeCreateData, branch_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map(b => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Order Number</Label>
                <Input 
                  placeholder="PO-12345"
                  value={financeCreateData.order_number}
                  onChange={(e) => setFinanceCreateData({ ...financeCreateData, order_number: e.target.value })}
                />
              </div>
              <div>
                <Label>Notes</Label>
                <Input 
                  placeholder="Optional notes"
                  value={financeCreateData.notes}
                  onChange={(e) => setFinanceCreateData({ ...financeCreateData, notes: e.target.value })}
                />
              </div>
            </div>
            
            <Separator />
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Line Items *</Label>
                <Button size="sm" variant="outline" onClick={addFinanceLine}>
                  <Plus className="w-4 h-4 mr-1" /> Add Line
                </Button>
              </div>
              
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-[300px]">SKU</TableHead>
                      <TableHead className="w-[100px]">Qty</TableHead>
                      <TableHead className="w-[120px]">Rate</TableHead>
                      <TableHead className="w-[100px]">HSN</TableHead>
                      <TableHead className="w-[80px]">GST %</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {financeLines.map((line, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Select 
                            value={line.buyer_sku_id} 
                            onValueChange={(v) => handleFinanceLineSkuChange(idx, v)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select SKU" />
                            </SelectTrigger>
                            <SelectContent>
                              {buyerSkus.map(s => (
                                <SelectItem key={s.buyer_sku_id} value={s.buyer_sku_id}>
                                  {s.buyer_sku_id} - {s.name?.substring(0, 30)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="number" 
                            min="1"
                            value={line.quantity}
                            onChange={(e) => {
                              const newLines = [...financeLines];
                              newLines[idx].quantity = parseInt(e.target.value) || 1;
                              setFinanceLines(newLines);
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="number" 
                            min="0"
                            step="0.01"
                            value={line.rate || ""}
                            placeholder="Auto"
                            onChange={(e) => {
                              const newLines = [...financeLines];
                              newLines[idx].rate = parseFloat(e.target.value) || 0;
                              setFinanceLines(newLines);
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {line.hsn_code || "-"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {line.gst_rate || 18}%
                        </TableCell>
                        <TableCell>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => removeFinanceLine(idx)}
                            disabled={financeLines.length === 1}
                          >
                            <X className="w-4 h-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              <p className="text-xs text-muted-foreground mt-2">
                Rate, HSN, and GST will auto-populate from master data. Inventory will be validated at selected branch.
              </p>
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowFinanceCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleFinanceCreateLot} disabled={financeCreating}>
                {financeCreating ? "Creating..." : "Create Lot"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Line Item Dialog */}
      <Dialog open={showAddLineDialog} onOpenChange={setShowAddLineDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add Line Item
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>SKU *</Label>
              <Select value={addLineData.buyer_sku_id} onValueChange={handleAddLineLookup}>
                <SelectTrigger>
                  <SelectValue placeholder="Select SKU" />
                </SelectTrigger>
                <SelectContent>
                  {buyerSkus.map(s => (
                    <SelectItem key={s.buyer_sku_id} value={s.buyer_sku_id}>
                      {s.buyer_sku_id} - {s.name?.substring(0, 40)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {skuLookup && (
              <div className="bg-gray-50 p-3 rounded-lg text-sm space-y-1">
                <p><strong>Name:</strong> {skuLookup.name}</p>
                <p><strong>HSN:</strong> {skuLookup.hsn_code || "Not set"}</p>
                <p><strong>GST:</strong> {skuLookup.gst_rate}%</p>
                <p><strong>Rate:</strong> {skuLookup.rate > 0 ? `₹${skuLookup.rate.toLocaleString()}` : "Not set in Price Master"}</p>
              </div>
            )}
            
            <div>
              <Label>Quantity *</Label>
              <Input 
                type="number" 
                min="1"
                value={addLineData.quantity}
                onChange={(e) => setAddLineData({ ...addLineData, quantity: parseInt(e.target.value) || 1 })}
              />
            </div>
            
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAddLineDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddLineSubmit} disabled={addingLine || !addLineData.buyer_sku_id}>
                {addingLine ? "Adding..." : "Add Line"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DispatchLots;

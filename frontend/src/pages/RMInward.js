import { useState, useEffect } from "react";
import axios from "axios";
import useBranchStore from "@/store/branchStore";
import useAuthStore from "@/store/authStore";
import { Plus, Download, Package, Trash2, Calculator, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PAYMENT_TERMS = [
  { value: "NET_15", label: "Net 15", days: 15 },
  { value: "NET_30", label: "Net 30", days: 30 },
  { value: "NET_45", label: "Net 45", days: 45 },
  { value: "NET_60", label: "Net 60", days: 60 },
  { value: "DUE_ON_RECEIPT", label: "Due on Receipt", days: 0 },
  { value: "CUSTOM", label: "Custom", days: null }
];

const TAX_OPTIONS = [
  { value: "NONE", label: "None", rate: 0 },
  { value: "GST_5", label: "GST 5%", rate: 5 },
  { value: "GST_12", label: "GST 12%", rate: 12 },
  { value: "GST_18", label: "GST 18%", rate: 18 },
  { value: "GST_28", label: "GST 28%", rate: 28 }
];

// Map local tax values to approximate rates for amount calculation
const LOCAL_TAX_RATES = {
  "NONE": 0, "GST_5": 5, "GST_12": 12, "GST_18": 18, "GST_28": 28
};

const TDS_TCS_OPTIONS = [
  { value: "NONE", label: "None", rate: 0 },
  { value: "TDS_1", label: "TDS 1%", rate: 1 },
  { value: "TDS_2", label: "TDS 2%", rate: 2 },
  { value: "TDS_10", label: "TDS 10%", rate: 10 },
  { value: "TCS_1", label: "TCS 1%", rate: 1 }
];

const RMInward = () => {
  const { selectedBranch } = useBranchStore();
  const { token } = useAuthStore();
  const [entries, setEntries] = useState([]);
  const [availableRMs, setAvailableRMs] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchInventory, setBranchInventory] = useState({});
  const [filteredRMs, setFilteredRMs] = useState([]);
  const [rmSearch, setRmSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [vendorSearch, setVendorSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  
  // Zoho integration state
  const [zohoAccounts, setZohoAccounts] = useState([]);
  const [zohoConfigured, setZohoConfigured] = useState(false);
  const [defaultAccountId, setDefaultAccountId] = useState("");
  const [zohoAccountsError, setZohoAccountsError] = useState("");
  const [zohoTaxes, setZohoTaxes] = useState([]);
  const [defaultTaxId, setDefaultTaxId] = useState("");

  // Bill/Invoice Form State
  const [billData, setBillData] = useState({
    vendor_id: "",
    vendor_name: "",
    branch_id: "",
    bill_number: "",
    order_number: "",
    bill_date: new Date().toISOString().split('T')[0],
    due_date: "",
    payment_terms: "NET_30",
    accounts_payable: "Trade Payables",
    reverse_charge: false,
    notes: ""
  });

  // Line Items State - now includes description, hsn, gst, account_id
  const [lineItems, setLineItems] = useState([
    { rm_id: "", rm_search: "", description: "", hsn: "", quantity: 1, rate: 0, tax: "GST_18", tax_id: "", amount: 0, account_id: "" }
  ]);

  // Totals State
  const [totals, setTotals] = useState({
    sub_total: 0,
    discount_type: "percentage", // "percentage" or "amount"
    discount_value: 0,
    discount_amount: 0,
    tds_tcs: "NONE",
    tds_tcs_amount: 0,
    tax_total: 0,
    grand_total: 0
  });

  useEffect(() => {
    fetchEntries();
    fetchAvailableRMs();
    fetchBranchInventory();
    fetchVendors();
    fetchBranches();
    fetchZohoAccounts();
    fetchZohoTaxes();
  }, [selectedBranch]);

  // Calculate totals when line items or discount changes
  useEffect(() => {
    let subTotal = 0;
    let taxTotal = 0;

    lineItems.forEach(item => {
      const lineAmount = item.quantity * item.rate;
      let taxRate = 0;
      if (item.tax_id && zohoTaxes.length > 0) {
        taxRate = parseFloat(zohoTaxes.find(t => t.tax_id === item.tax_id)?.tax_percentage) || 0;
      } else {
        taxRate = TAX_OPTIONS.find(t => t.value === item.tax)?.rate || 0;
      }
      const lineTax = lineAmount * (taxRate / 100);
      subTotal += lineAmount;
      taxTotal += lineTax;
    });

    // Calculate discount
    let discountAmount = 0;
    if (totals.discount_type === "percentage") {
      discountAmount = subTotal * (totals.discount_value / 100);
    } else {
      discountAmount = totals.discount_value;
    }

    // Calculate TDS/TCS
    const tdsTcsRate = TDS_TCS_OPTIONS.find(t => t.value === totals.tds_tcs)?.rate || 0;
    const tdsTcsAmount = (subTotal - discountAmount) * (tdsTcsRate / 100);

    // Grand total
    const grandTotal = subTotal - discountAmount + taxTotal - tdsTcsAmount;

    setTotals(prev => ({
      ...prev,
      sub_total: subTotal,
      discount_amount: discountAmount,
      tds_tcs_amount: tdsTcsAmount,
      tax_total: taxTotal,
      grand_total: grandTotal
    }));
  }, [lineItems, totals.discount_type, totals.discount_value, totals.tds_tcs, zohoTaxes]);

  // Auto-calculate due date when payment terms or bill date changes
  useEffect(() => {
    if (billData.payment_terms === "CUSTOM") return; // Don't auto-calculate for custom
    
    const paymentTerm = PAYMENT_TERMS.find(t => t.value === billData.payment_terms);
    if (paymentTerm && paymentTerm.days !== null && billData.bill_date) {
      const billDate = new Date(billData.bill_date);
      const dueDate = new Date(billDate);
      dueDate.setDate(dueDate.getDate() + paymentTerm.days);
      setBillData(prev => ({
        ...prev,
        due_date: dueDate.toISOString().split('T')[0]
      }));
    }
  }, [billData.payment_terms, billData.bill_date]);

  // Fetch Zoho accounts for expense/asset selection
  const fetchZohoAccounts = async () => {
    try {
      // First check if Zoho is configured
      const statusRes = await axios.get(`${API}/zoho/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setZohoConfigured(statusRes.data.configured);
      
      if (statusRes.data.configured) {
        // Fetch expense accounts (most common for purchases)
        const response = await axios.get(`${API}/zoho/accounts?account_type=expense`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const accounts = response.data.accounts || [];
        setZohoAccounts(accounts);
        
        // Check for auth error
        if (response.data.auth_error) {
          setZohoAccountsError(response.data.message || "Authorization failed for Chart of Accounts");
          return;
        }
        
        if (accounts.length === 0 && response.data.message && response.data.message !== "OK") {
          setZohoAccountsError(response.data.message);
          return;
        }
        
        setZohoAccountsError("");
        
        // Set default account (first one or "Cost of Goods Sold" if available)
        const defaultAcc = accounts.find(a => 
          a.account_name.toLowerCase().includes('cost of goods') ||
          a.account_name.toLowerCase().includes('purchases') ||
          a.account_name.toLowerCase().includes('raw material')
        ) || accounts[0];
        
        if (defaultAcc) {
          setDefaultAccountId(defaultAcc.account_id);
        }
      }
    } catch (error) {
      console.log("Zoho accounts fetch skipped:", error.message);
    }
  };

  const fetchZohoTaxes = async () => {
    try {
      if (!zohoConfigured) {
        // Wait for zoho status check — will be called after fetchZohoAccounts sets zohoConfigured
        const statusRes = await axios.get(`${API}/zoho/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!statusRes.data.configured) return;
      }
      const response = await axios.get(`${API}/zoho/taxes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const taxes = response.data.taxes || [];
      setZohoTaxes(taxes);
      // Set default tax (GST18 group or GST 18%)
      const defaultTax = taxes.find(t =>
        t.tax_name === "GST18" || t.tax_name === "GST 18%"
      ) || taxes[0];
      if (defaultTax) {
        setDefaultTaxId(defaultTax.tax_id);
      }
    } catch (error) {
      console.log("Zoho taxes fetch skipped:", error.message);
    }
  };


  const fetchBranchInventory = async () => {
    try {
      const response = await axios.get(
        `${API}/raw-materials?branch=${encodeURIComponent(selectedBranch)}`,
        { headers: { Authorization: `Bearer ${token}` }}
      );
      const inventoryMap = {};
      response.data.forEach(rm => {
        inventoryMap[rm.rm_id] = rm.current_stock || 0;
      });
      setBranchInventory(inventoryMap);
    } catch (error) {
      console.error("Failed to fetch branch inventory");
    }
  };

  const fetchEntries = async () => {
    try {
      const response = await axios.get(
        `${API}/purchase-entries?branch=${encodeURIComponent(selectedBranch)}`,
        { headers: { Authorization: `Bearer ${token}` }}
      );
      setEntries(response.data);
    } catch (error) {
      toast.error("Failed to fetch inward entries");
    }
  };

  const fetchAvailableRMs = async () => {
    try {
      const response = await axios.get(
        `${API}/raw-materials`,
        { headers: { Authorization: `Bearer ${token}` }}
      );
      setAvailableRMs(response.data);
      setFilteredRMs(response.data.slice(0, 100));
    } catch (error) {
      toast.error("Failed to fetch available RMs");
    }
  };

  const fetchVendors = async () => {
    try {
      const response = await axios.get(`${API}/vendors`, { headers: { Authorization: `Bearer ${token}` }});
      setVendors(response.data.vendors || response.data || []);
    } catch (error) {
      console.error("Failed to fetch vendors");
    }
  };

  const fetchBranches = async () => {
    try {
      const response = await axios.get(`${API}/branches/reference`, { headers: { Authorization: `Bearer ${token}` }});
      setBranches(response.data.branches || []);
    } catch (error) {
      console.error("Failed to fetch branches");
    }
  };

  const filterRMsForLine = (search) => {
    if (search.length >= 2) {
      return availableRMs.filter(rm => 
        rm.rm_id.toLowerCase().includes(search.toLowerCase()) ||
        rm.category.toLowerCase().includes(search.toLowerCase()) ||
        (rm.category_data?.part_name || "").toLowerCase().includes(search.toLowerCase())
      ).slice(0, 50);
    }
    return availableRMs.slice(0, 50);
  };

  // Filter vendors based on search
  const filteredVendors = vendorSearch.length >= 1
    ? vendors.filter(v => 
        v.name.toLowerCase().includes(vendorSearch.toLowerCase()) ||
        (v.vendor_code || "").toLowerCase().includes(vendorSearch.toLowerCase())
      )
    : vendors;

  // Get RM description from category_data
  const getRMDescription = (rm) => {
    if (!rm) return "";
    const cat = rm.category_data || {};
    if (rm.category === "INP" || rm.category === "INM") {
      return cat.part_name || cat.type || rm.category;
    }
    return cat.part_name || cat.type || cat.name || rm.category;
  };

  // Get default GST for RM based on category
  const getDefaultGST = (rm) => {
    if (!rm) return "GST_18";
    // Default GST mapping by category
    const gstMapping = {
      "INP": "GST_18",
      "INM": "GST_18", 
      "ACC": "GST_18",
      "ELC": "GST_18",
      "LB": "GST_12",
      "PM": "GST_12",
      "BS": "GST_5",
      "SP": "GST_18"
    };
    return rm.hsn_gst || gstMapping[rm.category] || "GST_18";
  };

  // Get HSN code for RM
  const getHSNCode = (rm) => {
    if (!rm) return "";
    // Default HSN mapping by category
    const hsnMapping = {
      "INP": "3926",
      "INM": "7326",
      "ACC": "8714",
      "ELC": "8544",
      "LB": "4821",
      "PM": "4819",
      "BS": "4911",
      "SP": "8714"
    };
    return rm.hsn_code || hsnMapping[rm.category] || "";
  };

  // Handle RM selection - auto-populate description, HSN, GST
  const handleRMSelect = (index, rmId) => {
    const rm = availableRMs.find(r => r.rm_id === rmId);
    const updated = [...lineItems];
    updated[index] = {
      ...updated[index],
      rm_id: rmId,
      rm_search: rmId,
      description: getRMDescription(rm),
      hsn: getHSNCode(rm),
      tax: getDefaultGST(rm)
    };
    setLineItems(updated);
  };

  const handleAddLineItem = () => {
    setLineItems([...lineItems, { rm_id: "", rm_search: "", description: "", hsn: "", quantity: 1, rate: 0, tax: "GST_18", tax_id: defaultTaxId || "", amount: 0, account_id: defaultAccountId || "" }]);
  };

  const handleRemoveLineItem = (index) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const handleLineItemChange = (index, field, value) => {
    const updated = [...lineItems];
    updated[index][field] = value;
    
    // Auto-calculate amount when quantity or rate changes
    if (field === "quantity" || field === "rate") {
      updated[index].amount = updated[index].quantity * updated[index].rate;
    }
    
    // When user types in rm_search, try to auto-select the RM
    if (field === "rm_search" && value) {
      // Extract RM ID if the value contains " - " (from datalist selection)
      const rmIdMatch = value.match(/^([A-Z]+_\d+)/);
      if (rmIdMatch) {
        const rmId = rmIdMatch[1];
        const rm = availableRMs.find(r => r.rm_id === rmId);
        if (rm) {
          updated[index].rm_id = rmId;
          updated[index].description = getRMDescription(rm);
          updated[index].hsn = getHSNCode(rm);
          updated[index].tax = getDefaultGST(rm);
        }
      }
    }
    
    setLineItems(updated);
  };

  const handleSubmit = async () => {
    // Validation
    if (!billData.vendor_id) {
      toast.error("Please select a vendor");
      return;
    }
    if (!billData.bill_number) {
      toast.error("Please enter bill number");
      return;
    }
    if (!billData.bill_date) {
      toast.error("Please enter bill date");
      return;
    }
    
    const validItems = lineItems.filter(item => item.rm_id && item.quantity > 0);
    if (validItems.length === 0) {
      toast.error("Please add at least one valid line item (select RM ID from dropdown)");
      return;
    }

    try {
      setSubmitting(true);
      toast.info("Creating bill...", { duration: 10000 });
      
      const payload = {
        ...billData,
        branch: billData.branch_id ? branches.find(b => b.branch_id === billData.branch_id)?.name : selectedBranch,
        branch_id: billData.branch_id || null,
        line_items: validItems.map(item => ({
          rm_id: item.rm_id,
          description: item.description,
          hsn: item.hsn,
          quantity: parseFloat(item.quantity),
          rate: parseFloat(item.rate),
          tax: item.tax,
          tax_id: item.tax_id || undefined,
          tax_amount: item.amount * (
            item.tax_id 
              ? (parseFloat(zohoTaxes.find(t => t.tax_id === item.tax_id)?.tax_percentage) || 0) / 100
              : (TAX_OPTIONS.find(t => t.value === item.tax)?.rate || 0) / 100
          ),
          amount: item.amount,
          account_id: item.account_id || defaultAccountId || undefined
        })),
        totals: {
          sub_total: totals.sub_total,
          discount_type: totals.discount_type,
          discount_value: totals.discount_value,
          discount_amount: totals.discount_amount,
          tds_tcs: totals.tds_tcs,
          tds_tcs_amount: totals.tds_tcs_amount,
          tax_total: totals.tax_total,
          grand_total: totals.grand_total
        },
        date: new Date(billData.bill_date).toISOString()
      };

      const response = await axios.post(`${API}/rm-inward/bills`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Check for Zoho sync status
      if (response.data.zoho_synced) {
        toast.success(`Bill ${billData.bill_number} recorded & synced to Zoho Books!`, { duration: 5000 });
      } else {
        toast.success(`Bill ${billData.bill_number} recorded successfully (Zoho sync not configured)`);
      }
      
      setShowDialog(false);
      resetForm();
      fetchEntries();
      fetchBranchInventory();
    } catch (error) {
      const errorMsg = error.response?.data?.detail || "Failed to record bill";
      // Check if it's a Zoho error
      if (errorMsg.includes("Zoho")) {
        toast.error(`Zoho Books Error: ${errorMsg}`, { duration: 8000 });
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setBillData({
      vendor_id: "",
      vendor_name: "",
      branch_id: "",
      bill_number: "",
      order_number: "",
      bill_date: new Date().toISOString().split('T')[0],
      due_date: "",
      payment_terms: "NET_30",
      accounts_payable: "Trade Payables",
      reverse_charge: false,
      notes: ""
    });
    setLineItems([{ rm_id: "", rm_search: "", description: "", hsn: "", quantity: 1, rate: 0, tax: "GST_18", amount: 0 }]);
    setVendorSearch("");
    setTotals({
      sub_total: 0,
      discount_type: "percentage",
      discount_value: 0,
      discount_amount: 0,
      tds_tcs: "NONE",
      tds_tcs_amount: 0,
      tax_total: 0,
      grand_total: 0
    });
  };

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(entries.map(e => ({
      'Date': new Date(e.date).toLocaleDateString(),
      'Bill #': e.bill_number || '-',
      'Vendor': e.vendor_name || '-',
      'RM ID': e.rm_id,
      'Quantity': e.quantity,
      'Rate': e.rate || 0,
      'Amount': e.amount || 0,
      'Branch': e.branch,
      'Notes': e.notes || ''
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'RM Inward');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `rm_inward_${selectedBranch}.xlsx`);
    toast.success("Exported to Excel");
  };

  const getCurrentStock = (rm_id) => {
    return branchInventory[rm_id] || 0;
  };

  return (
    <div className="p-6 md:p-8" data-testid="rm-inward-page">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight uppercase">RM Inward / Purchase Bill</h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">
            Record incoming raw materials and vendor bills for {selectedBranch}
          </p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="secondary" 
            onClick={handleExport}
            data-testid="export-inward-btn"
            className="uppercase text-xs tracking-wide"
          >
            <Download className="w-4 h-4 mr-2" strokeWidth={1.5} />
            Export
          </Button>
          <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button data-testid="add-inward-btn" className="uppercase text-xs tracking-wide">
                <Plus className="w-4 h-4 mr-2" strokeWidth={1.5} />
                New Bill / Inward
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" aria-describedby="purchase-bill-description">
              <DialogHeader>
                <DialogTitle className="font-bold uppercase flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  New Purchase Bill
                </DialogTitle>
                <p id="purchase-bill-description" className="sr-only">
                  Create a new purchase bill to record incoming raw materials and update inventory
                </p>
              </DialogHeader>
              
              {/* Bill Header Section */}
              <div className="grid grid-cols-3 gap-4 mt-4">
                {/* Left Column */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs font-bold uppercase">Vendor Name *</Label>
                    <Input
                      value={vendorSearch}
                      onChange={(e) => {
                        setVendorSearch(e.target.value);
                        // Auto-select vendor if exact match found
                        const exactMatch = vendors.find(v => 
                          v.name.toLowerCase() === e.target.value.toLowerCase() ||
                          `${v.name} (${v.vendor_code || v.vendor_id})`.toLowerCase() === e.target.value.toLowerCase()
                        );
                        if (exactMatch) {
                          setBillData({...billData, vendor_id: exactMatch.id, vendor_name: exactMatch.name});
                        }
                      }}
                      placeholder="Type vendor name..."
                      className="font-mono text-sm"
                      list="vendor-datalist"
                      data-testid="vendor-search"
                    />
                    <datalist id="vendor-datalist">
                      {filteredVendors.slice(0, 100).map(v => (
                        <option key={v.id} value={v.name}>{v.vendor_code || v.vendor_id}</option>
                      ))}
                    </datalist>
                    {billData.vendor_id && (
                      <div className="text-xs text-green-600 mt-1">✓ {billData.vendor_name}</div>
                    )}
                    {vendorSearch && !billData.vendor_id && filteredVendors.length > 0 && (
                      <div className="text-xs text-gray-500 mt-1">{filteredVendors.length} vendors match</div>
                    )}
                  </div>
                  
                  <div>
                    <Label className="text-xs font-bold uppercase">Branch</Label>
                    <Select 
                      value={billData.branch_id || undefined} 
                      onValueChange={(v) => setBillData({...billData, branch_id: v})}
                    >
                      <SelectTrigger data-testid="branch-select">
                        <SelectValue placeholder={selectedBranch} />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.filter(b => b.branch_id).map(b => (
                          <SelectItem key={b.branch_id} value={b.branch_id}>{b.name} ({b.branch_id})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Middle Column */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs font-bold uppercase">Bill # *</Label>
                    <Input 
                      value={billData.bill_number}
                      onChange={(e) => setBillData({...billData, bill_number: e.target.value})}
                      placeholder="e.g., INV-2026-001"
                      data-testid="bill-number-input"
                      className="font-mono"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-bold uppercase">Order Number</Label>
                    <Input 
                      value={billData.order_number}
                      onChange={(e) => setBillData({...billData, order_number: e.target.value})}
                      placeholder="PO reference"
                      className="font-mono"
                    />
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs font-bold uppercase">Bill Date *</Label>
                    <Input 
                      type="date"
                      value={billData.bill_date}
                      onChange={(e) => setBillData({...billData, bill_date: e.target.value})}
                      data-testid="bill-date-input"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-bold uppercase">Due Date</Label>
                    <Input 
                      type="date"
                      value={billData.due_date}
                      onChange={(e) => setBillData({...billData, due_date: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Second Row - Payment Terms, Accounts Payable, Reverse Charge */}
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div>
                  <Label className="text-xs font-bold uppercase">Payment Terms</Label>
                  <Select 
                    value={billData.payment_terms || undefined} 
                    onValueChange={(v) => setBillData({...billData, payment_terms: v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment terms" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_TERMS.filter(pt => pt.value).map(pt => (
                        <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-bold uppercase">Accounts Payable</Label>
                  <Select 
                    value={billData.accounts_payable || undefined} 
                    onValueChange={(v) => setBillData({...billData, accounts_payable: v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Trade Payables">Trade Payables</SelectItem>
                      <SelectItem value="Sundry Creditors">Sundry Creditors</SelectItem>
                      <SelectItem value="Other Payables">Other Payables</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2 mt-6">
                  <Checkbox 
                    id="reverse-charge"
                    checked={billData.reverse_charge}
                    onCheckedChange={(checked) => setBillData({...billData, reverse_charge: checked})}
                  />
                  <Label htmlFor="reverse-charge" className="text-sm">
                    This transaction is applicable for reverse charge
                  </Label>
                </div>
              </div>

              <Separator className="my-4" />

              {/* Line Items Table */}
              <div>
                {zohoConfigured && zohoAccountsError && (
                  <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800" data-testid="zoho-accounts-warning">
                    <strong>Zoho Accounts Warning:</strong> {zohoAccountsError}
                    <br />
                    <span className="text-xs">You can still enter Account IDs manually, or re-authorize Zoho with the required scope.</span>
                  </div>
                )}
                <div className="flex justify-between items-center mb-2">
                  <Label className="text-xs font-bold uppercase">Item Details</Label>
                  <Button size="sm" variant="outline" onClick={handleAddLineItem}>
                    <Plus className="h-3 w-3 mr-1" /> Add Line
                  </Button>
                </div>
                
                <div className="border rounded-lg overflow-hidden overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="w-[160px]">RM ID</TableHead>
                        <TableHead className="w-[180px]">Description</TableHead>
                        <TableHead className="w-[80px]">HSN</TableHead>
                        <TableHead className="w-[80px] text-right">Qty</TableHead>
                        <TableHead className="w-[90px] text-right">Rate</TableHead>
                        <TableHead className="w-[100px]">Tax</TableHead>
                        {zohoConfigured && <TableHead className="w-[160px]">Account</TableHead>}
                        <TableHead className="w-[100px] text-right">Amount</TableHead>
                        <TableHead className="w-[40px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineItems.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="p-2">
                            <Input
                              value={item.rm_search || item.rm_id}
                              onChange={(e) => handleLineItemChange(idx, "rm_search", e.target.value)}
                              placeholder="Type RM ID..."
                              className="font-mono text-xs h-8"
                              list={`rm-list-${idx}`}
                            />
                            <datalist id={`rm-list-${idx}`}>
                              {filterRMsForLine(item.rm_search || "").map(rm => (
                                <option key={rm.rm_id} value={rm.rm_id}>{getRMDescription(rm)}</option>
                              ))}
                            </datalist>
                            {item.rm_search && !item.rm_id && (
                              <select
                                className="w-full text-xs border rounded px-1 py-1 bg-gray-50 mt-1"
                                value={item.rm_id}
                                onChange={(e) => handleRMSelect(idx, e.target.value)}
                              >
                                <option value="">Select from matches</option>
                                {filterRMsForLine(item.rm_search || "").map(rm => (
                                  <option key={rm.rm_id} value={rm.rm_id}>
                                    {rm.rm_id} - {getRMDescription(rm)}
                                  </option>
                                ))}
                              </select>
                            )}
                            {item.rm_id && (
                              <div className="text-xs text-green-600 mt-1">✓ {item.rm_id}</div>
                            )}
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              value={item.description}
                              onChange={(e) => handleLineItemChange(idx, "description", e.target.value)}
                              placeholder="Auto-filled"
                              className="text-xs h-8"
                              readOnly={!!item.rm_id}
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              value={item.hsn}
                              onChange={(e) => handleLineItemChange(idx, "hsn", e.target.value)}
                              placeholder="HSN"
                              className="text-xs h-8 font-mono"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.quantity}
                              onChange={(e) => handleLineItemChange(idx, "quantity", parseFloat(e.target.value) || 0)}
                              className="text-right font-mono text-xs h-8"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.rate}
                              onChange={(e) => handleLineItemChange(idx, "rate", parseFloat(e.target.value) || 0)}
                              className="text-right font-mono text-xs h-8"
                              placeholder="0.00"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            {zohoTaxes.length > 0 ? (
                              <Select 
                                value={item.tax_id || defaultTaxId || undefined} 
                                onValueChange={(v) => {
                                  const tax = zohoTaxes.find(t => t.tax_id === v);
                                  const updated = [...lineItems];
                                  updated[idx].tax_id = v;
                                  updated[idx].tax = tax?.tax_name || "";
                                  // Recalculate amount with tax rate
                                  const taxRate = parseFloat(tax?.tax_percentage) || 0;
                                  updated[idx].amount = updated[idx].quantity * updated[idx].rate;
                                  setLineItems(updated);
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs" data-testid={`tax-select-${idx}`}>
                                  <SelectValue placeholder="Tax" />
                                </SelectTrigger>
                                <SelectContent>
                                  {zohoTaxes.map(t => (
                                    <SelectItem key={t.tax_id} value={t.tax_id}>
                                      {t.tax_name} ({t.tax_percentage}%)
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Select 
                                value={item.tax || undefined} 
                                onValueChange={(v) => handleLineItemChange(idx, "tax", v)}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Tax" />
                                </SelectTrigger>
                                <SelectContent>
                                  {TAX_OPTIONS.filter(t => t.value).map(t => (
                                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          {zohoConfigured && (
                            <TableCell className="p-2">
                              {zohoAccounts.length > 0 ? (
                                <Select 
                                  value={item.account_id || defaultAccountId || undefined} 
                                  onValueChange={(v) => handleLineItemChange(idx, "account_id", v)}
                                >
                                  <SelectTrigger className="h-8 text-xs" data-testid={`account-select-${idx}`}>
                                    <SelectValue placeholder="Select account" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {zohoAccounts.map(acc => (
                                      <SelectItem key={acc.account_id} value={acc.account_id}>
                                        {acc.account_name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input
                                  value={item.account_id || ""}
                                  onChange={(e) => handleLineItemChange(idx, "account_id", e.target.value)}
                                  placeholder="Account ID"
                                  className="text-xs h-8 font-mono"
                                  data-testid={`account-input-${idx}`}
                                />
                              )}
                            </TableCell>
                          )}
                          <TableCell className="p-2 text-right font-mono text-sm font-medium">
                            ₹{item.amount.toFixed(2)}
                          </TableCell>
                          <TableCell className="p-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleRemoveLineItem(idx)}
                              disabled={lineItems.length === 1}
                              className="h-8 w-8 p-0"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <Separator className="my-4" />

              {/* Totals Section */}
              <div className="grid grid-cols-2 gap-8">
                {/* Notes */}
                <div>
                  <Label className="text-xs font-bold uppercase">Notes / Remarks</Label>
                  <Textarea 
                    value={billData.notes}
                    onChange={(e) => setBillData({...billData, notes: e.target.value})}
                    placeholder="Additional notes, truck details, GRN reference..."
                    rows={4}
                  />
                </div>

                {/* Calculations */}
                <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span>Sub Total</span>
                    <span className="font-mono font-medium">₹{totals.sub_total.toFixed(2)}</span>
                  </div>
                  
                  {/* Discount */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm w-20">Discount</span>
                    <Select 
                      value={totals.discount_type || undefined} 
                      onValueChange={(v) => setTotals({...totals, discount_type: v})}
                    >
                      <SelectTrigger className="w-20 h-8">
                        <SelectValue placeholder="%" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">%</SelectItem>
                        <SelectItem value="amount">₹</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={totals.discount_value}
                      onChange={(e) => setTotals({...totals, discount_value: parseFloat(e.target.value) || 0})}
                      className="w-24 h-8 text-right font-mono"
                    />
                    <span className="font-mono text-sm ml-auto">-₹{totals.discount_amount.toFixed(2)}</span>
                  </div>

                  {/* TDS/TCS */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm w-20">TDS/TCS</span>
                    <Select 
                      value={totals.tds_tcs || undefined} 
                      onValueChange={(v) => setTotals({...totals, tds_tcs: v})}
                    >
                      <SelectTrigger className="w-32 h-8">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        {TDS_TCS_OPTIONS.filter(t => t.value).map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="font-mono text-sm ml-auto">-₹{totals.tds_tcs_amount.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span>Tax Total</span>
                    <span className="font-mono">+₹{totals.tax_total.toFixed(2)}</span>
                  </div>

                  <Separator />

                  <div className="flex justify-between text-lg font-bold">
                    <span>Grand Total</span>
                    <span className="font-mono text-primary">₹{totals.grand_total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end mt-6 gap-3">
                <Button variant="outline" onClick={() => setShowDialog(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={submitting} data-testid="submit-bill-btn" className="uppercase">
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating Bill...
                    </>
                  ) : (
                    <>
                      <Calculator className="w-4 h-4 mr-2" />
                      Save Bill & Update Inventory
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-border border border-border mb-8">
        <div className="bg-white p-6">
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">
            Bills This Month
          </div>
          <div className="text-3xl font-black font-mono text-zinc-700">
            {entries.filter(e => new Date(e.date).getMonth() === new Date().getMonth()).length}
          </div>
        </div>
        <div className="bg-white p-6">
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">
            Active RMs in Branch
          </div>
          <div className="text-3xl font-black font-mono text-primary">
            {Object.keys(branchInventory).length}
          </div>
        </div>
        <div className="bg-white p-6">
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">
            Total Qty (This Month)
          </div>
          <div className="text-3xl font-black font-mono text-zinc-700">
            {entries
              .filter(e => new Date(e.date).getMonth() === new Date().getMonth())
              .reduce((sum, e) => sum + e.quantity, 0)
              .toFixed(0)}
          </div>
        </div>
        <div className="bg-white p-6">
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">
            Total Value (This Month)
          </div>
          <div className="text-3xl font-black font-mono text-green-600">
            ₹{entries
              .filter(e => new Date(e.date).getMonth() === new Date().getMonth())
              .reduce((sum, e) => sum + (e.amount || 0), 0)
              .toLocaleString()}
          </div>
        </div>
      </div>

      {/* Inward Entries Table */}
      <div className="border border-border bg-white rounded-sm overflow-hidden">
        <div className="p-6 border-b border-border flex items-center gap-3">
          <Package className="w-5 h-5 text-primary" strokeWidth={1.5} />
          <h2 className="text-lg font-bold uppercase tracking-tight">Recent Inward Entries / Bills</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="inward-table">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Date</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Bill #</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Vendor</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">RM ID</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Qty</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Rate</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Amount</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Stock</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => (
                <tr key={entry.id || idx} className="border-b border-zinc-100 hover:bg-zinc-50/50" data-testid={`inward-row-${entry.rm_id}`}>
                  <td className="p-4 align-middle font-mono text-zinc-700">
                    {new Date(entry.date).toLocaleDateString()}
                  </td>
                  <td className="p-4 align-middle font-mono text-sm text-primary">
                    {entry.bill_number || '-'}
                  </td>
                  <td className="p-4 align-middle text-sm">
                    {entry.vendor_name || '-'}
                  </td>
                  <td className="p-4 align-middle font-mono text-sm font-bold text-zinc-700">
                    {entry.rm_id}
                  </td>
                  <td className="p-4 align-middle font-mono text-primary font-bold">
                    +{entry.quantity}
                  </td>
                  <td className="p-4 align-middle font-mono text-sm">
                    ₹{(entry.rate || 0).toFixed(2)}
                  </td>
                  <td className="p-4 align-middle font-mono text-sm font-medium">
                    ₹{(entry.amount || 0).toFixed(2)}
                  </td>
                  <td className="p-4 align-middle font-mono text-zinc-700">
                    {getCurrentStock(entry.rm_id)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {entries.length === 0 && (
            <div className="p-12 text-center text-muted-foreground font-mono text-sm">
              No inward entries recorded yet for {selectedBranch}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RMInward;

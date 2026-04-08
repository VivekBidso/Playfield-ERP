import { useState, useEffect } from "react";
import axios from "axios";
import { 
  Plus, 
  ArrowRight, 
  CheckCircle, 
  Truck,
  Package,
  RefreshCw,
  ArrowLeftRight,
  Clock,
  XCircle,
  AlertTriangle,
  Eye,
  Send,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import useAuthStore from "@/store/authStore";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const IBT = () => {
  const { user, token } = useAuthStore();
  
  // Data
  const [transfers, setTransfers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [buyerSkus, setBuyerSkus] = useState([]);
  const [shortages, setShortages] = useState([]);
  
  // Dialogs
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [showDispatchDialog, setShowDispatchDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  
  // Selected transfer
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  
  // Create form
  const [form, setForm] = useState({
    transfer_type: "RM",
    source_branch: "",
    destination_branch: "",
    notes: "",
    vehicle_number: "",
    driver_name: "",
    driver_contact: "",
    expected_arrival: ""
  });
  
  // Multi-item support
  const [itemsToTransfer, setItemsToTransfer] = useState([]);
  const [currentItem, setCurrentItem] = useState({ item_id: "", quantity: 0 });
  
  // Inventory check
  const [availableStock, setAvailableStock] = useState(null);
  const [checkingStock, setCheckingStock] = useState(false);
  
  // Receive form - supports both single and multi-item
  const [receiveForm, setReceiveForm] = useState({
    received_quantity: 0,
    items: [], // For multi-item transfers: [{item_id, received_quantity}]
    received_notes: "",
    damage_notes: ""
  });
  
  // Dispatch form
  const [dispatchForm, setDispatchForm] = useState({
    vehicle_number: "",
    driver_name: "",
    driver_contact: "",
    expected_arrival: ""
  });
  
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [submitting, setSubmitting] = useState(false);

  const getHeaders = () => ({ Authorization: `Bearer ${token}` });

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [ibtRes, branchRes, rmRes, skuRes, shortRes] = await Promise.all([
        axios.get(`${API}/ibt-transfers`, { headers: getHeaders() }),
        axios.get(`${API}/branches/names`, { headers: getHeaders() }),
        axios.get(`${API}/raw-materials`, { headers: getHeaders() }),
        axios.get(`${API}/sku-management/buyer-skus?page_size=100`, { headers: getHeaders() }),
        axios.get(`${API}/ibt-shortages`, { headers: getHeaders() }).catch(() => ({ data: [] }))
      ]);
      setTransfers(ibtRes.data);
      setBranches(branchRes.data.branches || []);
      setRawMaterials(rmRes.data || []);
      // Handle both response formats: {buyer_skus: [...]} or {items: [...]}
      const skuData = skuRes.data;
      setBuyerSkus(skuData.buyer_skus || skuData.items || skuData || []);
      setShortages(shortRes.data || []);
    } catch (error) {
      toast.error("Failed to fetch IBT data");
    }
    setLoading(false);
  };

  // Check inventory when source branch and item change
  const checkInventory = async (itemId) => {
    if (!form.source_branch || !itemId) {
      return null;
    }
    
    try {
      const res = await axios.get(
        `${API}/ibt-transfers/check-inventory/${form.transfer_type}/${itemId}/${encodeURIComponent(form.source_branch)}`,
        { headers: getHeaders() }
      );
      return res.data.available_stock;
    } catch (err) {
      return 0;
    }
  };
  
  // Check stock for current item being added
  const checkCurrentItemStock = async () => {
    if (!form.source_branch || !currentItem.item_id) {
      setAvailableStock(null);
      return;
    }
    setCheckingStock(true);
    const stock = await checkInventory(currentItem.item_id);
    setAvailableStock(stock);
    setCheckingStock(false);
  };

  useEffect(() => {
    checkCurrentItemStock();
  }, [form.source_branch, currentItem.item_id, form.transfer_type]);
  
  // Add item to transfer list
  const handleAddItem = async () => {
    if (!currentItem.item_id || currentItem.quantity <= 0) {
      toast.error("Select an item and enter a valid quantity");
      return;
    }
    
    // Check if item already added
    if (itemsToTransfer.some(i => i.item_id === currentItem.item_id)) {
      toast.error("Item already added to transfer");
      return;
    }
    
    // Validate stock
    const stock = await checkInventory(currentItem.item_id);
    if (stock !== null && currentItem.quantity > stock) {
      toast.error(`Insufficient stock. Only ${stock} available.`);
      return;
    }
    
    // Get item name for display
    let itemName = currentItem.item_id;
    if (form.transfer_type === "RM") {
      const rm = rawMaterials.find(r => r.rm_id === currentItem.item_id);
      itemName = rm ? `${rm.rm_id} - ${rm.description?.substring(0, 30) || ''}` : currentItem.item_id;
    } else {
      const sku = buyerSkus.find(s => s.buyer_sku_id === currentItem.item_id);
      itemName = sku ? `${sku.buyer_sku_id} - ${sku.name?.substring(0, 30) || ''}` : currentItem.item_id;
    }
    
    setItemsToTransfer([...itemsToTransfer, {
      item_id: currentItem.item_id,
      item_name: itemName,
      quantity: parseFloat(currentItem.quantity),
      available_stock: stock
    }]);
    
    setCurrentItem({ item_id: "", quantity: 0 });
    setAvailableStock(null);
    toast.success("Item added to transfer");
  };
  
  // Remove item from transfer list
  const handleRemoveItem = (itemId) => {
    setItemsToTransfer(itemsToTransfer.filter(i => i.item_id !== itemId));
  };

  const handleCreateTransfer = async () => {
    if (!form.source_branch || !form.destination_branch || itemsToTransfer.length === 0) {
      toast.error("Please select branches and add at least one item");
      return;
    }
    
    if (form.source_branch === form.destination_branch) {
      toast.error("Source and destination cannot be the same");
      return;
    }
    
    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/ibt-transfers`, {
        transfer_type: form.transfer_type,
        source_branch: form.source_branch,
        destination_branch: form.destination_branch,
        items: itemsToTransfer.map(i => ({ item_id: i.item_id, quantity: i.quantity })),
        notes: form.notes,
        vehicle_number: form.vehicle_number || null,
        driver_name: form.driver_name || null,
        driver_contact: form.driver_contact || null,
        expected_arrival: form.expected_arrival || null
      }, { headers: getHeaders() });
      
      toast.success(`Transfer ${res.data.transfer?.transfer_code} created with ${itemsToTransfer.length} item(s)`);
      setShowCreateDialog(false);
      resetForm();
      fetchAllData();
    } catch (error) {
      const detail = error.response?.data?.detail;
      if (detail?.error === "INSUFFICIENT_INVENTORY") {
        toast.error(detail.message || "Insufficient stock for one or more items");
      } else {
        toast.error(typeof detail === 'string' ? detail : "Failed to create transfer");
      }
    }
    setSubmitting(false);
  };

  const resetForm = () => {
    setForm({
      transfer_type: "RM",
      source_branch: "",
      destination_branch: "",
      notes: "",
      vehicle_number: "",
      driver_name: "",
      driver_contact: "",
      expected_arrival: ""
    });
    setItemsToTransfer([]);
    setCurrentItem({ item_id: "", quantity: 0 });
    setAvailableStock(null);
  };

  // Note: Approval step removed - IBT can be dispatched directly after creation
  // The handleApprove function is kept for backward compatibility but is no longer used in UI

  const openDispatchDialog = (transfer) => {
    setSelectedTransfer(transfer);
    setDispatchForm({
      vehicle_number: transfer.vehicle_number || "",
      driver_name: transfer.driver_name || "",
      driver_contact: transfer.driver_contact || "",
      expected_arrival: transfer.expected_arrival || ""
    });
    setShowDispatchDialog(true);
  };

  const handleDispatch = async () => {
    if (!selectedTransfer) return;
    
    setSubmitting(true);
    try {
      let url = `${API}/ibt-transfers/${selectedTransfer.id}/dispatch`;
      const params = new URLSearchParams();
      if (dispatchForm.vehicle_number) params.append("vehicle_number", dispatchForm.vehicle_number);
      if (dispatchForm.driver_name) params.append("driver_name", dispatchForm.driver_name);
      if (dispatchForm.driver_contact) params.append("driver_contact", dispatchForm.driver_contact);
      if (dispatchForm.expected_arrival) params.append("expected_arrival", dispatchForm.expected_arrival);
      
      if (params.toString()) url += `?${params.toString()}`;
      
      await axios.put(url, {}, { headers: getHeaders() });
      toast.success("Transfer dispatched - stock deducted from source");
      setShowDispatchDialog(false);
      fetchAllData();
    } catch (error) {
      const detail = error.response?.data?.detail;
      if (detail?.error === "INSUFFICIENT_INVENTORY") {
        toast.error(`Cannot dispatch: Only ${detail.available} available`);
      } else {
        toast.error(typeof detail === 'string' ? detail : "Failed to dispatch");
      }
    }
    setSubmitting(false);
  };

  const openReceiveDialog = (transfer) => {
    setSelectedTransfer(transfer);
    
    // Check if multi-item transfer
    if (transfer.items?.length > 0) {
      // Initialize receive form with all items at their dispatched quantities
      setReceiveForm({
        items: transfer.items.map(item => ({
          item_id: item.item_id,
          item_name: item.item_name || item.item_id,
          dispatched_quantity: item.dispatched_quantity || item.quantity,
          received_quantity: item.dispatched_quantity || item.quantity
        })),
        received_notes: "",
        damage_notes: ""
      });
    } else {
      // Legacy single-item format
      setReceiveForm({
        received_quantity: transfer.dispatched_quantity || transfer.quantity,
        items: [],
        received_notes: "",
        damage_notes: ""
      });
    }
    setShowReceiveDialog(true);
  };

  const handleReceive = async () => {
    if (!selectedTransfer) return;
    
    setSubmitting(true);
    try {
      // Build request body based on transfer type
      let requestBody = {
        received_notes: receiveForm.received_notes,
        damage_notes: receiveForm.damage_notes
      };
      
      if (receiveForm.items?.length > 0) {
        // Multi-item format
        requestBody.items = receiveForm.items.map(item => ({
          item_id: item.item_id,
          received_quantity: item.received_quantity
        }));
      } else {
        // Legacy single-item format
        requestBody.received_quantity = receiveForm.received_quantity;
      }
      
      const res = await axios.put(
        `${API}/ibt-transfers/${selectedTransfer.id}/receive`,
        requestBody,
        { headers: getHeaders() }
      );
      
      if (res.data.variance > 0) {
        toast.warning(`Received with variance: ${res.data.variance} units short. Shortage record created.`);
      } else {
        toast.success("Transfer received - stock added to destination");
      }
      setShowReceiveDialog(false);
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to receive");
    }
    setSubmitting(false);
  };

  const handleCancel = async (transferId) => {
    if (!window.confirm("Are you sure you want to cancel this transfer?")) return;
    
    try {
      await axios.put(`${API}/ibt-transfers/${transferId}/cancel`, {}, { headers: getHeaders() });
      toast.success("Transfer cancelled");
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to cancel");
    }
  };

  const openDetailDialog = (transfer) => {
    setSelectedTransfer(transfer);
    setShowDetailDialog(true);
  };

  const getStatusBadge = (status) => {
    const colors = {
      INITIATED: "bg-gray-100 text-gray-700",
      READY_FOR_DISPATCH: "bg-blue-100 text-blue-700",
      APPROVED: "bg-blue-100 text-blue-700", // Legacy support
      IN_TRANSIT: "bg-purple-100 text-purple-700",
      COMPLETED: "bg-green-100 text-green-700",
      CANCELLED: "bg-red-100 text-red-700"
    };
    const displayStatus = status === "READY_FOR_DISPATCH" ? "READY" : status?.replace("_", " ");
    return <Badge className={colors[status] || "bg-gray-200"}>{displayStatus}</Badge>;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'INITIATED': return <Clock className="w-4 h-4 text-gray-500" />;
      case 'READY_FOR_DISPATCH': return <CheckCircle className="w-4 h-4 text-blue-500" />;
      case 'APPROVED': return <CheckCircle className="w-4 h-4 text-blue-500" />; // Legacy
      case 'IN_TRANSIT': return <Truck className="w-4 h-4 text-purple-500" />;
      case 'COMPLETED': return <Package className="w-4 h-4 text-green-500" />;
      case 'CANCELLED': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return null;
    }
  };

  const getItemName = (transfer) => {
    if (transfer.item_name) return transfer.item_name;
    if (transfer.transfer_type === "RM") {
      const rm = rawMaterials.find(r => r.rm_id === transfer.item_id);
      return rm?.description || transfer.item_id;
    } else {
      const sku = buyerSkus.find(s => s.buyer_sku_id === transfer.item_id);
      return sku?.name || transfer.item_id;
    }
  };

  const filteredTransfers = transfers.filter(t => {
    if (filter === "all") return true;
    if (filter === "pending") return t.status === "INITIATED" || t.status === "READY_FOR_DISPATCH" || t.status === "APPROVED";
    if (filter === "in_transit") return t.status === "IN_TRANSIT";
    if (filter === "completed") return t.status === "COMPLETED";
    return true;
  });

  const pendingShortages = shortages.filter(s => s.status === "PENDING_INVESTIGATION").length;

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="ibt-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ArrowLeftRight className="w-6 h-6" />
            Inter-Branch Transfers
          </h1>
          <p className="text-sm text-zinc-500">Transfer inventory between branches</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} data-testid="create-ibt-btn">
          <Plus className="w-4 h-4 mr-2" />
          New Transfer
        </Button>
      </div>

      {/* Shortage Alert */}
      {pendingShortages > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <div>
            <p className="font-medium text-amber-800">{pendingShortages} Pending Shortage Investigation(s)</p>
            <p className="text-sm text-amber-600">Some transfers had variance between dispatched and received quantities.</p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className={`cursor-pointer ${filter === 'all' ? 'ring-2 ring-blue-500' : ''}`} onClick={() => setFilter('all')}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{transfers.length}</p>
            <p className="text-sm text-zinc-500">Total</p>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer ${filter === 'pending' ? 'ring-2 ring-blue-500' : ''}`} onClick={() => setFilter('pending')}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">
              {transfers.filter(t => t.status === "INITIATED" || t.status === "READY_FOR_DISPATCH" || t.status === "APPROVED").length}
            </p>
            <p className="text-sm text-zinc-500">Ready to Dispatch</p>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer ${filter === 'in_transit' ? 'ring-2 ring-blue-500' : ''}`} onClick={() => setFilter('in_transit')}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">
              {transfers.filter(t => t.status === "IN_TRANSIT").length}
            </p>
            <p className="text-sm text-zinc-500">In Transit</p>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer ${filter === 'completed' ? 'ring-2 ring-blue-500' : ''}`} onClick={() => setFilter('completed')}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">
              {transfers.filter(t => t.status === "COMPLETED").length}
            </p>
            <p className="text-sm text-zinc-500">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{pendingShortages}</p>
            <p className="text-sm text-zinc-500">Shortages</p>
          </CardContent>
        </Card>
      </div>

      {/* Transfers Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b">
                <tr>
                  <th className="text-left p-3">Transfer Code</th>
                  <th className="text-left p-3">Type</th>
                  <th className="text-left p-3">From → To</th>
                  <th className="text-left p-3">Item</th>
                  <th className="text-right p-3">Qty</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Date</th>
                  <th className="text-left p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransfers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-zinc-500">
                      No transfers found
                    </td>
                  </tr>
                ) : (
                  filteredTransfers.map(transfer => (
                    <tr key={transfer.id} className="border-b hover:bg-zinc-50">
                      <td className="p-3">
                        <span className="font-mono font-bold text-blue-600">{transfer.transfer_code}</span>
                        {transfer.variance > 0 && (
                          <Badge className="ml-2 bg-amber-100 text-amber-700">Shortage</Badge>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline">{transfer.transfer_type}</Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1 text-xs">
                          <span>{transfer.source_branch}</span>
                          <ArrowRight className="w-3 h-3 text-zinc-400" />
                          <span>{transfer.destination_branch}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        {transfer.items?.length > 0 ? (
                          <div>
                            <Badge variant="outline" className="text-xs">{transfer.items.length} item(s)</Badge>
                            <div className="text-xs text-zinc-500 mt-1 truncate max-w-[200px]">
                              {transfer.items.map(i => i.item_id).join(", ")}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="max-w-[200px] truncate" title={getItemName(transfer)}>
                              {transfer.item_id}
                            </div>
                            <div className="text-xs text-zinc-500 truncate">{getItemName(transfer)}</div>
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono">
                        {transfer.items?.length > 0 ? (
                          <span>
                            {transfer.total_received !== undefined && transfer.status === "COMPLETED" ? (
                              <>
                                {transfer.total_received}
                                {transfer.total_variance > 0 && (
                                  <span className="text-red-500 text-xs ml-1">(-{transfer.total_variance})</span>
                                )}
                              </>
                            ) : (
                              transfer.total_quantity || transfer.items.reduce((sum, i) => sum + i.quantity, 0)
                            )}
                          </span>
                        ) : (
                          transfer.received_quantity !== undefined && transfer.status === "COMPLETED" ? (
                            <span>
                              {transfer.received_quantity}
                              {transfer.variance > 0 && (
                                <span className="text-red-500 text-xs ml-1">(-{transfer.variance})</span>
                              )}
                            </span>
                          ) : (
                            transfer.quantity
                          )
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(transfer.status)}
                          {getStatusBadge(transfer.status)}
                        </div>
                      </td>
                      <td className="p-3 text-xs text-zinc-500">
                        {new Date(transfer.initiated_at).toLocaleDateString()}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openDetailDialog(transfer)} title="View Details">
                            <Eye className="w-4 h-4" />
                          </Button>
                          
                          {/* Dispatch button - available immediately after creation */}
                          {(transfer.status === "INITIATED" || transfer.status === "READY_FOR_DISPATCH" || transfer.status === "APPROVED") && (
                            <Button size="sm" variant="outline" onClick={() => openDispatchDialog(transfer)}>
                              <Send className="w-4 h-4 mr-1" />
                              Dispatch
                            </Button>
                          )}
                          
                          {transfer.status === "IN_TRANSIT" && (
                            <Button size="sm" variant="outline" className="text-green-600" onClick={() => openReceiveDialog(transfer)}>
                              <Package className="w-4 h-4 mr-1" />
                              Receive
                            </Button>
                          )}
                          
                          {(transfer.status === "INITIATED" || transfer.status === "READY_FOR_DISPATCH" || transfer.status === "APPROVED") && (
                            <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleCancel(transfer.id)}>
                              <XCircle className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create Transfer Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Inter-Branch Transfer</DialogTitle>
            <DialogDescription>Transfer RM or Finished Goods between branches</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Transfer Type</Label>
              <Select value={form.transfer_type} onValueChange={(v) => setForm({ ...form, transfer_type: v, item_id: "" })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RM">Raw Material</SelectItem>
                  <SelectItem value="FG">Finished Goods (SKU)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Source Branch *</Label>
                <Select value={form.source_branch} onValueChange={(v) => { setForm({ ...form, source_branch: v }); setItemsToTransfer([]); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="From..." />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map(b => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Destination Branch *</Label>
                <Select value={form.destination_branch} onValueChange={(v) => setForm({ ...form, destination_branch: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="To..." />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.filter(b => b !== form.source_branch).map(b => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <Separator />
            
            {/* Items Section */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-base font-medium">Items to Transfer</Label>
                <Badge variant="outline">{itemsToTransfer.length} item(s)</Badge>
              </div>
              
              {/* Added Items List */}
              {itemsToTransfer.length > 0 && (
                <div className="bg-zinc-50 rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
                  {itemsToTransfer.map((item, idx) => (
                    <div key={item.item_id} className="flex items-center justify-between bg-white p-2 rounded border">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.item_name}</p>
                        <p className="text-xs text-zinc-500">Qty: {item.quantity}</p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-red-500 hover:text-red-700 ml-2"
                        onClick={() => handleRemoveItem(item.item_id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Add Item Form */}
              <div className="bg-blue-50 p-3 rounded-lg space-y-3">
                <p className="text-sm font-medium text-blue-700">Add Item</p>
                <div>
                  <Label className="text-xs">Select Item</Label>
                  <Select 
                    value={currentItem.item_id} 
                    onValueChange={(v) => setCurrentItem({ ...currentItem, item_id: v })}
                    disabled={!form.source_branch}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={form.source_branch ? "Select item..." : "Select source branch first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {form.transfer_type === "RM" 
                        ? rawMaterials
                            .filter(rm => !itemsToTransfer.some(i => i.item_id === rm.rm_id))
                            .slice(0, 200).map(rm => (
                              <SelectItem key={rm.rm_id} value={rm.rm_id}>
                                {rm.rm_id} - {rm.description?.substring(0, 40)}
                              </SelectItem>
                            ))
                        : buyerSkus
                            .filter(sku => !itemsToTransfer.some(i => i.item_id === sku.buyer_sku_id))
                            .slice(0, 200).map(sku => (
                              <SelectItem key={sku.buyer_sku_id} value={sku.buyer_sku_id}>
                                {sku.buyer_sku_id} - {sku.name?.substring(0, 40)}
                              </SelectItem>
                            ))
                      }
                    </SelectContent>
                  </Select>
                  
                  {availableStock !== null && form.source_branch && currentItem.item_id && (
                    <p className={`text-xs mt-1 ${availableStock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      Available at {form.source_branch}: {availableStock}
                    </p>
                  )}
                </div>
                
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label className="text-xs">Quantity</Label>
                    <Input 
                      type="number" 
                      min="0"
                      placeholder="Enter qty"
                      value={currentItem.quantity || ""}
                      onChange={(e) => setCurrentItem({ ...currentItem, quantity: e.target.value })}
                      className={currentItem.quantity > availableStock && availableStock !== null ? 'border-red-500' : ''}
                    />
                  </div>
                  <Button 
                    type="button"
                    onClick={handleAddItem}
                    disabled={!currentItem.item_id || !currentItem.quantity || currentItem.quantity <= 0}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                </div>
                {currentItem.quantity > availableStock && availableStock !== null && (
                  <p className="text-xs text-red-600">Exceeds available stock!</p>
                )}
              </div>
            </div>
            
            <Separator />
            
            <p className="text-sm font-medium text-zinc-600">Transit Details (Optional)</p>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Vehicle Number</Label>
                <Input 
                  placeholder="MH-12-AB-1234"
                  value={form.vehicle_number}
                  onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })}
                />
              </div>
              <div>
                <Label>Expected Arrival</Label>
                <Input 
                  type="date"
                  value={form.expected_arrival}
                  onChange={(e) => setForm({ ...form, expected_arrival: e.target.value })}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Driver Name</Label>
                <Input 
                  placeholder="Driver name"
                  value={form.driver_name}
                  onChange={(e) => setForm({ ...form, driver_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Driver Contact</Label>
                <Input 
                  placeholder="Phone number"
                  value={form.driver_contact}
                  onChange={(e) => setForm({ ...form, driver_contact: e.target.value })}
                />
              </div>
            </div>
            
            <div>
              <Label>Notes</Label>
              <Textarea 
                placeholder="Additional notes..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); }}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateTransfer} 
              disabled={submitting || !form.source_branch || !form.destination_branch || itemsToTransfer.length === 0}
            >
              {submitting ? "Creating..." : `Create Transfer (${itemsToTransfer.length} items)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispatch Dialog */}
      <Dialog open={showDispatchDialog} onOpenChange={setShowDispatchDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Dispatch Transfer</DialogTitle>
            <DialogDescription>
              Dispatching {selectedTransfer?.transfer_code} - {selectedTransfer?.items?.length || 1} item(s)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-blue-50 p-3 rounded-lg text-sm">
              <p><strong>From:</strong> {selectedTransfer?.source_branch}</p>
              <p><strong>To:</strong> {selectedTransfer?.destination_branch}</p>
              {selectedTransfer?.items?.length > 0 ? (
                <div className="mt-2">
                  <p className="font-medium">Items:</p>
                  <ul className="list-disc list-inside text-xs mt-1 max-h-32 overflow-y-auto">
                    {selectedTransfer.items.map((item, idx) => (
                      <li key={idx}>{item.item_id} - Qty: {item.quantity}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <>
                  <p><strong>Item:</strong> {selectedTransfer?.item_id}</p>
                  <p><strong>Quantity:</strong> {selectedTransfer?.quantity}</p>
                </>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Vehicle Number</Label>
                <Input 
                  placeholder="MH-12-AB-1234"
                  value={dispatchForm.vehicle_number}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, vehicle_number: e.target.value })}
                />
              </div>
              <div>
                <Label>Expected Arrival</Label>
                <Input 
                  type="date"
                  value={dispatchForm.expected_arrival}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, expected_arrival: e.target.value })}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Driver Name</Label>
                <Input 
                  value={dispatchForm.driver_name}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, driver_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Driver Contact</Label>
                <Input 
                  value={dispatchForm.driver_contact}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, driver_contact: e.target.value })}
                />
              </div>
            </div>
            
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <strong>Warning:</strong> Dispatching will deduct {selectedTransfer?.quantity} units from {selectedTransfer?.source_branch} inventory.
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDispatchDialog(false)}>Cancel</Button>
            <Button onClick={handleDispatch} disabled={submitting} className="bg-purple-600 hover:bg-purple-700">
              {submitting ? "Dispatching..." : "Dispatch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receive Dialog */}
      <Dialog open={showReceiveDialog} onOpenChange={setShowReceiveDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Receive Transfer</DialogTitle>
            <DialogDescription>
              Receiving {selectedTransfer?.transfer_code} at {selectedTransfer?.destination_branch}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-green-50 p-3 rounded-lg text-sm">
              <p><strong>From:</strong> {selectedTransfer?.source_branch}</p>
              {selectedTransfer?.items?.length > 0 ? (
                <p><strong>Items:</strong> {selectedTransfer.items.length} item(s)</p>
              ) : (
                <>
                  <p><strong>Item:</strong> {selectedTransfer?.item_id}</p>
                  <p><strong>Dispatched Qty:</strong> {selectedTransfer?.dispatched_quantity || selectedTransfer?.quantity}</p>
                </>
              )}
            </div>
            
            {/* Multi-item receive */}
            {receiveForm.items?.length > 0 ? (
              <div className="space-y-3">
                <Label>Received Quantities *</Label>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {receiveForm.items.map((item, idx) => (
                    <div key={item.item_id} className="bg-zinc-50 p-3 rounded-lg">
                      <p className="text-sm font-medium truncate">{item.item_name}</p>
                      <p className="text-xs text-zinc-500 mb-2">Dispatched: {item.dispatched_quantity}</p>
                      <Input 
                        type="number"
                        min="0"
                        max={item.dispatched_quantity}
                        value={item.received_quantity}
                        onChange={(e) => {
                          const newItems = [...receiveForm.items];
                          newItems[idx].received_quantity = parseFloat(e.target.value) || 0;
                          setReceiveForm({ ...receiveForm, items: newItems });
                        }}
                      />
                      {item.received_quantity < item.dispatched_quantity && (
                        <p className="text-xs text-amber-600 mt-1">
                          Shortage: {item.dispatched_quantity - item.received_quantity} units
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <Label>Received Quantity *</Label>
                <Input 
                  type="number"
                  min="0"
                  max={selectedTransfer?.dispatched_quantity || selectedTransfer?.quantity}
                  value={receiveForm.received_quantity}
                  onChange={(e) => setReceiveForm({ ...receiveForm, received_quantity: parseFloat(e.target.value) || 0 })}
                />
                {receiveForm.received_quantity < (selectedTransfer?.dispatched_quantity || selectedTransfer?.quantity) && (
                  <p className="text-xs text-amber-600 mt-1">
                    Variance: {(selectedTransfer?.dispatched_quantity || selectedTransfer?.quantity) - receiveForm.received_quantity} units will be recorded as shortage
                  </p>
                )}
              </div>
            )}
            
            <div>
              <Label>Damage Notes (if any)</Label>
              <Textarea 
                placeholder="Describe any damage..."
                value={receiveForm.damage_notes}
                onChange={(e) => setReceiveForm({ ...receiveForm, damage_notes: e.target.value })}
              />
            </div>
            
            <div>
              <Label>Receipt Notes</Label>
              <Textarea 
                placeholder="Additional notes..."
                value={receiveForm.received_notes}
                onChange={(e) => setReceiveForm({ ...receiveForm, received_notes: e.target.value })}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReceiveDialog(false)}>Cancel</Button>
            <Button onClick={handleReceive} disabled={submitting} className="bg-green-600 hover:bg-green-700">
              {submitting ? "Receiving..." : "Confirm Receipt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {getStatusIcon(selectedTransfer?.status)}
              Transfer {selectedTransfer?.transfer_code}
            </DialogTitle>
          </DialogHeader>
          
          {selectedTransfer && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-zinc-500">Status</p>
                  <p>{getStatusBadge(selectedTransfer.status)}</p>
                </div>
                <div>
                  <p className="text-zinc-500">Type</p>
                  <p><Badge variant="outline">{selectedTransfer.transfer_type}</Badge></p>
                </div>
                <div>
                  <p className="text-zinc-500">Source Branch</p>
                  <p className="font-medium">{selectedTransfer.source_branch}</p>
                </div>
                <div>
                  <p className="text-zinc-500">Destination Branch</p>
                  <p className="font-medium">{selectedTransfer.destination_branch}</p>
                </div>
              </div>
              
              {/* Items Section */}
              {selectedTransfer.items?.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-zinc-500 text-sm">Items ({selectedTransfer.items.length})</p>
                  <div className="bg-zinc-50 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                    {selectedTransfer.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-white p-2 rounded border text-sm">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.item_id}</p>
                          <p className="text-xs text-zinc-500 truncate">{item.item_name}</p>
                        </div>
                        <div className="text-right ml-2">
                          <p className="font-mono">{item.dispatched_quantity || item.quantity}</p>
                          {item.received_quantity !== undefined && (
                            <p className="text-xs">
                              Rcvd: {item.received_quantity}
                              {item.variance > 0 && <span className="text-red-500 ml-1">(-{item.variance})</span>}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-sm font-medium">
                    <span>Total:</span>
                    <span>
                      {selectedTransfer.total_quantity || selectedTransfer.items.reduce((sum, i) => sum + (i.dispatched_quantity || i.quantity), 0)}
                      {selectedTransfer.total_received !== undefined && (
                        <span className="text-zinc-500 ml-2">
                          (Received: {selectedTransfer.total_received})
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="col-span-2">
                    <p className="text-zinc-500">Item</p>
                    <p className="font-medium">{selectedTransfer.item_id}</p>
                    <p className="text-xs text-zinc-500">{getItemName(selectedTransfer)}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Quantity</p>
                    <p className="font-medium">{selectedTransfer.quantity}</p>
                  </div>
                  {selectedTransfer.received_quantity !== undefined && (
                    <div>
                      <p className="text-zinc-500">Received</p>
                      <p className="font-medium">
                        {selectedTransfer.received_quantity}
                        {selectedTransfer.variance > 0 && (
                          <span className="text-red-500 ml-1">(-{selectedTransfer.variance})</span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              <Separator />
              
              <div className="text-sm space-y-2">
                <p className="font-medium">Timeline</p>
                <div className="space-y-1 text-xs">
                  <p><span className="text-zinc-500">Initiated:</span> {new Date(selectedTransfer.initiated_at).toLocaleString()}</p>
                  {selectedTransfer.approved_at && <p><span className="text-zinc-500">Approved:</span> {new Date(selectedTransfer.approved_at).toLocaleString()}</p>}
                  {selectedTransfer.dispatched_at && <p><span className="text-zinc-500">Dispatched:</span> {new Date(selectedTransfer.dispatched_at).toLocaleString()}</p>}
                  {selectedTransfer.received_at && <p><span className="text-zinc-500">Received:</span> {new Date(selectedTransfer.received_at).toLocaleString()}</p>}
                </div>
              </div>
              
              {(selectedTransfer.vehicle_number || selectedTransfer.driver_name) && (
                <>
                  <Separator />
                  <div className="text-sm space-y-1">
                    <p className="font-medium">Transit Details</p>
                    {selectedTransfer.vehicle_number && <p><span className="text-zinc-500">Vehicle:</span> {selectedTransfer.vehicle_number}</p>}
                    {selectedTransfer.driver_name && <p><span className="text-zinc-500">Driver:</span> {selectedTransfer.driver_name}</p>}
                    {selectedTransfer.driver_contact && <p><span className="text-zinc-500">Contact:</span> {selectedTransfer.driver_contact}</p>}
                    {selectedTransfer.expected_arrival && <p><span className="text-zinc-500">Expected:</span> {selectedTransfer.expected_arrival}</p>}
                  </div>
                </>
              )}
              
              {selectedTransfer.notes && (
                <>
                  <Separator />
                  <div className="text-sm">
                    <p className="font-medium">Notes</p>
                    <p className="text-zinc-600">{selectedTransfer.notes}</p>
                  </div>
                </>
              )}
              
              {selectedTransfer.variance > 0 && (
                <>
                  <Separator />
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                    <p className="font-medium text-amber-800">Shortage Recorded</p>
                    <p className="text-amber-700">
                      {selectedTransfer.variance} units short. 
                      {selectedTransfer.damage_notes && ` Damage: ${selectedTransfer.damage_notes}`}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IBT;

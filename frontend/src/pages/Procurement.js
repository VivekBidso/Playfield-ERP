import { useState, useEffect } from "react";
import axios from "axios";
import { 
  Plus, 
  Send, 
  Package, 
  CheckCircle, 
  Clock,
  FileText,
  Building2,
  RefreshCw,
  Eye,
  DollarSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import BranchSelector from "@/components/BranchSelector";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Procurement = () => {
  const [activeTab, setActiveTab] = useState("purchase-orders");
  const [selectedBranch, setSelectedBranch] = useState("");
  
  // Data
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [vendorPrices, setVendorPrices] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  
  // Dialogs
  const [showPODialog, setShowPODialog] = useState(false);
  const [showLineDialog, setShowLineDialog] = useState(false);
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [showPriceDialog, setShowPriceDialog] = useState(false);
  const [showPODetail, setShowPODetail] = useState(null);
  
  // Forms
  const [poForm, setPOForm] = useState({
    vendor_id: "",
    branch: "",
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery_date: "",
    notes: ""
  });
  const [lineForm, setLineForm] = useState({
    rm_id: "",
    quantity_ordered: 0,
    unit_price: 0,
    unit_of_measure: "PCS"
  });
  const [receiveForm, setReceiveForm] = useState({
    line_id: "",
    quantity_received: 0
  });
  const [priceForm, setPriceForm] = useState({
    vendor_id: "",
    rm_id: "",
    price: 0,
    min_order_qty: 1,
    lead_time_days: 7
  });
  
  const [loading, setLoading] = useState(true);
  const [selectedPO, setSelectedPO] = useState(null);

  useEffect(() => {
    fetchAllData();
  }, [selectedBranch]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [poRes, vendorRes, priceRes, rmRes] = await Promise.all([
        axios.get(`${API}/purchase-orders${selectedBranch ? `?branch=${encodeURIComponent(selectedBranch)}` : ''}`),
        axios.get(`${API}/vendors`),
        axios.get(`${API}/vendor-rm-prices`),
        axios.get(`${API}/raw-materials`)
      ]);
      setPurchaseOrders(poRes.data);
      setVendors(vendorRes.data);
      setVendorPrices(priceRes.data);
      setRawMaterials(rmRes.data);
    } catch (error) {
      toast.error("Failed to fetch procurement data");
    }
    setLoading(false);
  };

  const handleCreatePO = async () => {
    try {
      const payload = {
        ...poForm,
        order_date: new Date(poForm.order_date).toISOString(),
        expected_delivery_date: poForm.expected_delivery_date ? new Date(poForm.expected_delivery_date).toISOString() : null
      };
      const res = await axios.post(`${API}/purchase-orders`, payload);
      toast.success("Purchase Order created");
      setShowPODialog(false);
      setPOForm({ vendor_id: "", branch: selectedBranch, order_date: new Date().toISOString().split('T')[0], expected_delivery_date: "", notes: "" });
      fetchAllData();
      // Open PO detail to add lines
      setShowPODetail(res.data.purchase_order);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create PO");
    }
  };

  const handleAddLine = async () => {
    if (!showPODetail) return;
    try {
      await axios.post(`${API}/purchase-orders/${showPODetail.id}/lines`, lineForm);
      toast.success("Line item added");
      setShowLineDialog(false);
      setLineForm({ rm_id: "", quantity_ordered: 0, unit_price: 0, unit_of_measure: "PCS" });
      // Refresh PO detail
      const res = await axios.get(`${API}/purchase-orders/${showPODetail.id}`);
      setShowPODetail(res.data);
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to add line");
    }
  };

  const handleSendPO = async (poId) => {
    try {
      await axios.put(`${API}/purchase-orders/${poId}/send`);
      toast.success("PO sent to vendor");
      fetchAllData();
      if (showPODetail?.id === poId) {
        const res = await axios.get(`${API}/purchase-orders/${poId}`);
        setShowPODetail(res.data);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to send PO");
    }
  };

  const handleReceiveLine = async () => {
    if (!showPODetail) return;
    try {
      await axios.put(`${API}/purchase-orders/${showPODetail.id}/receive?line_id=${receiveForm.line_id}&quantity_received=${receiveForm.quantity_received}`);
      toast.success("Goods received");
      setShowReceiveDialog(false);
      setReceiveForm({ line_id: "", quantity_received: 0 });
      const res = await axios.get(`${API}/purchase-orders/${showPODetail.id}`);
      setShowPODetail(res.data);
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to receive goods");
    }
  };

  const handleCreatePrice = async () => {
    try {
      await axios.post(`${API}/vendor-rm-prices`, priceForm);
      toast.success("Vendor price created");
      setShowPriceDialog(false);
      setPriceForm({ vendor_id: "", rm_id: "", price: 0, min_order_qty: 1, lead_time_days: 7 });
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create price");
    }
  };

  const openPODetail = async (po) => {
    try {
      const res = await axios.get(`${API}/purchase-orders/${po.id}`);
      setShowPODetail(res.data);
    } catch (error) {
      toast.error("Failed to load PO details");
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      DRAFT: "bg-zinc-200 text-zinc-800",
      SENT: "bg-blue-100 text-blue-800",
      ACKNOWLEDGED: "bg-purple-100 text-purple-800",
      PARTIAL: "bg-yellow-100 text-yellow-800",
      RECEIVED: "bg-green-100 text-green-800",
      CANCELLED: "bg-red-100 text-red-800"
    };
    return <Badge className={colors[status] || "bg-zinc-200"}>{status}</Badge>;
  };

  const getRMDescription = (rmId) => {
    const rm = rawMaterials.find(r => r.rm_id === rmId);
    if (!rm) return rmId;
    const cd = rm.category_data || {};
    return cd.part_name || cd.type || cd.model_name || rmId;
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center" data-testid="procurement-loading">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        Loading procurement data...
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8" data-testid="procurement-page">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-black tracking-tight uppercase">Procurement</h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">Purchase Orders & Vendor Pricing</p>
        </div>
        <BranchSelector selectedBranch={selectedBranch} onBranchChange={setSelectedBranch} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="purchase-orders" className="uppercase text-xs tracking-wide">
            <FileText className="w-4 h-4 mr-2" />
            Purchase Orders ({purchaseOrders.length})
          </TabsTrigger>
          <TabsTrigger value="vendor-prices" className="uppercase text-xs tracking-wide">
            <DollarSign className="w-4 h-4 mr-2" />
            Vendor Prices ({vendorPrices.length})
          </TabsTrigger>
        </TabsList>

        {/* Purchase Orders Tab */}
        <TabsContent value="purchase-orders">
          <div className="flex justify-end mb-4">
            <Button onClick={() => { setPOForm({...poForm, branch: selectedBranch}); setShowPODialog(true); }} data-testid="create-po-btn">
              <Plus className="w-4 h-4 mr-2" />
              New Purchase Order
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono uppercase text-muted-foreground">Draft</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black">{purchaseOrders.filter(p => p.status === 'DRAFT').length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono uppercase text-muted-foreground">Sent</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-blue-600">{purchaseOrders.filter(p => p.status === 'SENT').length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono uppercase text-muted-foreground">Partial</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-yellow-600">{purchaseOrders.filter(p => p.status === 'PARTIAL').length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono uppercase text-muted-foreground">Received</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-green-600">{purchaseOrders.filter(p => p.status === 'RECEIVED').length}</div>
              </CardContent>
            </Card>
          </div>

          <div className="border rounded-sm">
            <table className="w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">PO Number</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Vendor</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Branch</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Order Date</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Total</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Status</th>
                  <th className="h-10 px-4 text-right font-mono text-xs uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrders.map((po) => {
                  const vendor = vendors.find(v => v.vendor_id === po.vendor_id);
                  return (
                    <tr key={po.id} className="border-t">
                      <td className="p-4 font-mono font-bold">{po.po_number}</td>
                      <td className="p-4">{vendor?.name || po.vendor_id}</td>
                      <td className="p-4 text-sm">{po.branch}</td>
                      <td className="p-4 text-sm">{po.order_date ? new Date(po.order_date).toLocaleDateString() : '-'}</td>
                      <td className="p-4 font-mono">₹{(po.total_amount || 0).toLocaleString()}</td>
                      <td className="p-4">{getStatusBadge(po.status)}</td>
                      <td className="p-4 text-right space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => openPODetail(po)} data-testid={`view-po-${po.po_number}`}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        {po.status === 'DRAFT' && (
                          <Button variant="outline" size="sm" onClick={() => handleSendPO(po.id)} data-testid={`send-po-${po.po_number}`}>
                            <Send className="w-4 h-4 mr-1" />
                            Send
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {purchaseOrders.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No purchase orders</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Vendor Prices Tab */}
        <TabsContent value="vendor-prices">
          <div className="flex justify-end mb-4">
            <Button onClick={() => setShowPriceDialog(true)} data-testid="create-price-btn">
              <Plus className="w-4 h-4 mr-2" />
              Add Vendor Price
            </Button>
          </div>

          <div className="border rounded-sm">
            <table className="w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Vendor</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">RM ID</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Description</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Price</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Min Qty</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Lead Time</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {vendorPrices.map((price) => {
                  const vendor = vendors.find(v => v.vendor_id === price.vendor_id);
                  return (
                    <tr key={price.id} className="border-t">
                      <td className="p-4">{vendor?.name || price.vendor_id}</td>
                      <td className="p-4 font-mono">{price.rm_id}</td>
                      <td className="p-4 text-sm">{getRMDescription(price.rm_id)}</td>
                      <td className="p-4 font-mono font-bold">₹{price.price}</td>
                      <td className="p-4 font-mono">{price.min_order_qty}</td>
                      <td className="p-4 text-sm">{price.lead_time_days} days</td>
                      <td className="p-4">
                        <Badge className={price.is_active ? "bg-green-100 text-green-800" : "bg-zinc-200"}>
                          {price.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
                {vendorPrices.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No vendor prices</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create PO Dialog */}
      <Dialog open={showPODialog} onOpenChange={setShowPODialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Purchase Order</DialogTitle>
            <DialogDescription>Create a new purchase order for a vendor</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Vendor *</Label>
              <Select value={poForm.vendor_id} onValueChange={(v) => setPOForm({...poForm, vendor_id: v})}>
                <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                <SelectContent>
                  {vendors.map(v => (
                    <SelectItem key={v.vendor_id} value={v.vendor_id}>{v.name} ({v.vendor_id})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Branch *</Label>
              <Input value={poForm.branch || selectedBranch} onChange={(e) => setPOForm({...poForm, branch: e.target.value})} />
            </div>
            <div>
              <Label>Order Date *</Label>
              <Input type="date" value={poForm.order_date} onChange={(e) => setPOForm({...poForm, order_date: e.target.value})} />
            </div>
            <div>
              <Label>Expected Delivery</Label>
              <Input type="date" value={poForm.expected_delivery_date} onChange={(e) => setPOForm({...poForm, expected_delivery_date: e.target.value})} />
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={poForm.notes} onChange={(e) => setPOForm({...poForm, notes: e.target.value})} />
            </div>
            <Button onClick={handleCreatePO} className="w-full" disabled={!poForm.vendor_id || !poForm.branch} data-testid="submit-po-btn">
              Create PO
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* PO Detail Dialog */}
      <Dialog open={!!showPODetail} onOpenChange={() => setShowPODetail(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Purchase Order: {showPODetail?.po_number}</DialogTitle>
            <DialogDescription>
              {vendors.find(v => v.vendor_id === showPODetail?.vendor_id)?.name} | {showPODetail?.branch}
            </DialogDescription>
          </DialogHeader>
          
          {showPODetail && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex gap-4">
                  {getStatusBadge(showPODetail.status)}
                  <span className="text-sm text-muted-foreground">
                    Total: <strong>₹{(showPODetail.total_amount || 0).toLocaleString()}</strong>
                  </span>
                </div>
                <div className="space-x-2">
                  {showPODetail.status === 'DRAFT' && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setShowLineDialog(true)}>
                        <Plus className="w-4 h-4 mr-1" /> Add Line
                      </Button>
                      <Button size="sm" onClick={() => handleSendPO(showPODetail.id)}>
                        <Send className="w-4 h-4 mr-1" /> Send PO
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div className="border rounded-sm">
                <table className="w-full">
                  <thead className="bg-zinc-50">
                    <tr>
                      <th className="h-8 px-3 text-left font-mono text-xs uppercase">RM ID</th>
                      <th className="h-8 px-3 text-left font-mono text-xs uppercase">Description</th>
                      <th className="h-8 px-3 text-left font-mono text-xs uppercase">Ordered</th>
                      <th className="h-8 px-3 text-left font-mono text-xs uppercase">Received</th>
                      <th className="h-8 px-3 text-left font-mono text-xs uppercase">Unit Price</th>
                      <th className="h-8 px-3 text-left font-mono text-xs uppercase">Total</th>
                      <th className="h-8 px-3 text-left font-mono text-xs uppercase">Status</th>
                      <th className="h-8 px-3 text-right font-mono text-xs uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(showPODetail.lines || []).map((line) => (
                      <tr key={line.id} className="border-t">
                        <td className="p-3 font-mono">{line.rm_id}</td>
                        <td className="p-3 text-sm">{getRMDescription(line.rm_id)}</td>
                        <td className="p-3 font-mono">{line.quantity_ordered}</td>
                        <td className="p-3 font-mono text-green-600">{line.quantity_received || 0}</td>
                        <td className="p-3 font-mono">₹{line.unit_price}</td>
                        <td className="p-3 font-mono">₹{(line.line_total || line.quantity_ordered * line.unit_price).toLocaleString()}</td>
                        <td className="p-3">{getStatusBadge(line.status)}</td>
                        <td className="p-3 text-right">
                          {(showPODetail.status === 'SENT' || showPODetail.status === 'PARTIAL') && line.status !== 'RECEIVED' && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                setReceiveForm({ line_id: line.id, quantity_received: line.quantity_ordered - (line.quantity_received || 0) });
                                setShowReceiveDialog(true);
                              }}
                            >
                              <Package className="w-4 h-4 mr-1" /> Receive
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {(!showPODetail.lines || showPODetail.lines.length === 0) && (
                      <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">No line items. Add items to this PO.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Line Dialog */}
      <Dialog open={showLineDialog} onOpenChange={setShowLineDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Line Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Raw Material *</Label>
              <Select value={lineForm.rm_id} onValueChange={(v) => {
                setLineForm({...lineForm, rm_id: v});
                // Auto-fill price if vendor price exists
                const price = vendorPrices.find(p => p.rm_id === v && p.vendor_id === showPODetail?.vendor_id && p.is_active);
                if (price) {
                  setLineForm(f => ({...f, rm_id: v, unit_price: price.price}));
                }
              }}>
                <SelectTrigger><SelectValue placeholder="Select RM" /></SelectTrigger>
                <SelectContent>
                  {rawMaterials.slice(0, 100).map(rm => (
                    <SelectItem key={rm.rm_id} value={rm.rm_id}>
                      {rm.rm_id} - {getRMDescription(rm.rm_id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantity *</Label>
              <Input type="number" value={lineForm.quantity_ordered} onChange={(e) => setLineForm({...lineForm, quantity_ordered: parseFloat(e.target.value)})} />
            </div>
            <div>
              <Label>Unit Price *</Label>
              <Input type="number" step="0.01" value={lineForm.unit_price} onChange={(e) => setLineForm({...lineForm, unit_price: parseFloat(e.target.value)})} />
            </div>
            <div>
              <Label>Unit of Measure</Label>
              <Select value={lineForm.unit_of_measure} onValueChange={(v) => setLineForm({...lineForm, unit_of_measure: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PCS">PCS</SelectItem>
                  <SelectItem value="KG">KG</SelectItem>
                  <SelectItem value="SET">SET</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAddLine} className="w-full" disabled={!lineForm.rm_id || !lineForm.quantity_ordered}>
              Add Line
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receive Dialog */}
      <Dialog open={showReceiveDialog} onOpenChange={setShowReceiveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Receive Goods</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Quantity to Receive</Label>
              <Input type="number" value={receiveForm.quantity_received} onChange={(e) => setReceiveForm({...receiveForm, quantity_received: parseFloat(e.target.value)})} />
            </div>
            <Button onClick={handleReceiveLine} className="w-full">
              <CheckCircle className="w-4 h-4 mr-2" /> Confirm Receipt
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Vendor Price Dialog */}
      <Dialog open={showPriceDialog} onOpenChange={setShowPriceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Vendor Price</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Vendor *</Label>
              <Select value={priceForm.vendor_id} onValueChange={(v) => setPriceForm({...priceForm, vendor_id: v})}>
                <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                <SelectContent>
                  {vendors.map(v => (
                    <SelectItem key={v.vendor_id} value={v.vendor_id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Raw Material *</Label>
              <Select value={priceForm.rm_id} onValueChange={(v) => setPriceForm({...priceForm, rm_id: v})}>
                <SelectTrigger><SelectValue placeholder="Select RM" /></SelectTrigger>
                <SelectContent>
                  {rawMaterials.slice(0, 100).map(rm => (
                    <SelectItem key={rm.rm_id} value={rm.rm_id}>{rm.rm_id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Price *</Label>
              <Input type="number" step="0.01" value={priceForm.price} onChange={(e) => setPriceForm({...priceForm, price: parseFloat(e.target.value)})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Min Order Qty</Label>
                <Input type="number" value={priceForm.min_order_qty} onChange={(e) => setPriceForm({...priceForm, min_order_qty: parseFloat(e.target.value)})} />
              </div>
              <div>
                <Label>Lead Time (days)</Label>
                <Input type="number" value={priceForm.lead_time_days} onChange={(e) => setPriceForm({...priceForm, lead_time_days: parseInt(e.target.value)})} />
              </div>
            </div>
            <Button onClick={handleCreatePrice} className="w-full" disabled={!priceForm.vendor_id || !priceForm.rm_id || !priceForm.price}>
              Add Price
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Procurement;

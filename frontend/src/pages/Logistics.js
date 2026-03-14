import { useState, useEffect } from "react";
import axios from "axios";
import { 
  Plus, 
  Truck, 
  FileText, 
  Send,
  CheckCircle,
  Package,
  RefreshCw,
  DollarSign,
  MapPin
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

const Logistics = () => {
  const [activeTab, setActiveTab] = useState("dispatches");
  const [selectedBranch, setSelectedBranch] = useState("");
  
  // Data
  const [dispatches, setDispatches] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [dispatchLots, setDispatchLots] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [skus, setSkus] = useState([]);
  
  // Dialogs
  const [showDispatchDialog, setShowDispatchDialog] = useState(false);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [showShipDialog, setShowShipDialog] = useState(false);
  
  // Forms
  const [dispatchForm, setDispatchForm] = useState({
    dispatch_lot_id: "",
    branch: "",
    buyer_id: "",
    sku_id: "",
    quantity: 0,
    dispatch_date: new Date().toISOString().split('T')[0],
    shipping_method: ""
  });
  const [invoiceForm, setInvoiceForm] = useState({
    dispatch_id: "",
    buyer_id: "",
    subtotal: 0,
    tax_percent: 18
  });
  const [shipForm, setShipForm] = useState({
    dispatch_id: "",
    tracking_number: ""
  });
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllData();
  }, [selectedBranch]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [dispRes, invRes, lotRes, buyerRes, skuRes] = await Promise.all([
        axios.get(`${API}/dispatches${selectedBranch ? `?branch=${encodeURIComponent(selectedBranch)}` : ''}`),
        axios.get(`${API}/invoices`),
        axios.get(`${API}/dispatch-lots`),
        axios.get(`${API}/buyers`),
        axios.get(`${API}/skus`)
      ]);
      setDispatches(dispRes.data);
      setInvoices(invRes.data);
      setDispatchLots(lotRes.data);
      setBuyers(buyerRes.data);
      setSkus(skuRes.data);
    } catch (error) {
      toast.error("Failed to fetch logistics data");
    }
    setLoading(false);
  };

  const handleCreateDispatch = async () => {
    try {
      const payload = {
        ...dispatchForm,
        dispatch_date: new Date(dispatchForm.dispatch_date).toISOString()
      };
      await axios.post(`${API}/dispatches`, payload);
      toast.success("Dispatch created");
      setShowDispatchDialog(false);
      setDispatchForm({ dispatch_lot_id: "", branch: selectedBranch, buyer_id: "", sku_id: "", quantity: 0, dispatch_date: new Date().toISOString().split('T')[0], shipping_method: "" });
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create dispatch");
    }
  };

  const handleShipDispatch = async () => {
    try {
      await axios.put(`${API}/dispatches/${shipForm.dispatch_id}/ship?tracking_number=${encodeURIComponent(shipForm.tracking_number)}`);
      toast.success("Dispatch shipped");
      setShowShipDialog(false);
      setShipForm({ dispatch_id: "", tracking_number: "" });
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to ship dispatch");
    }
  };

  const handleDeliverDispatch = async (dispatchId) => {
    try {
      await axios.put(`${API}/dispatches/${dispatchId}/deliver`);
      toast.success("Dispatch delivered");
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to mark as delivered");
    }
  };

  const handleCreateInvoice = async () => {
    try {
      const taxAmount = (invoiceForm.subtotal * invoiceForm.tax_percent) / 100;
      const payload = {
        dispatch_id: invoiceForm.dispatch_id || null,
        buyer_id: invoiceForm.buyer_id,
        invoice_date: new Date().toISOString(),
        subtotal: invoiceForm.subtotal,
        tax_amount: taxAmount,
        total_amount: invoiceForm.subtotal + taxAmount
      };
      await axios.post(`${API}/invoices`, payload);
      toast.success("Invoice created");
      setShowInvoiceDialog(false);
      setInvoiceForm({ dispatch_id: "", buyer_id: "", subtotal: 0, tax_percent: 18 });
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create invoice");
    }
  };

  const handleSendInvoice = async (invoiceId) => {
    try {
      await axios.put(`${API}/invoices/${invoiceId}/send`);
      toast.success("Invoice sent");
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to send invoice");
    }
  };

  const handlePayInvoice = async (invoiceId) => {
    try {
      await axios.put(`${API}/invoices/${invoiceId}/pay`);
      toast.success("Invoice marked as paid");
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to mark as paid");
    }
  };

  const getDispatchStatusBadge = (status) => {
    const colors = {
      PENDING: "bg-zinc-200 text-zinc-800",
      SHIPPED: "bg-blue-100 text-blue-800",
      IN_TRANSIT: "bg-yellow-100 text-yellow-800",
      DELIVERED: "bg-green-100 text-green-800",
      RETURNED: "bg-red-100 text-red-800"
    };
    return <Badge className={colors[status] || "bg-zinc-200"}>{status}</Badge>;
  };

  const getInvoiceStatusBadge = (status) => {
    const colors = {
      DRAFT: "bg-zinc-200 text-zinc-800",
      SENT: "bg-blue-100 text-blue-800",
      PAID: "bg-green-100 text-green-800",
      OVERDUE: "bg-red-100 text-red-800",
      CANCELLED: "bg-zinc-400 text-white"
    };
    return <Badge className={colors[status] || "bg-zinc-200"}>{status}</Badge>;
  };

  const getBuyerName = (buyerId) => {
    const buyer = buyers.find(b => b.id === buyerId);
    return buyer?.name || buyerId;
  };

  const getSKUDescription = (skuId) => {
    const sku = skus.find(s => s.sku_id === skuId);
    return sku?.description || skuId;
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center" data-testid="logistics-loading">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        Loading logistics data...
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8" data-testid="logistics-page">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-black tracking-tight uppercase">Logistics</h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">Dispatches & Invoices</p>
        </div>
        <BranchSelector selectedBranch={selectedBranch} onBranchChange={setSelectedBranch} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="dispatches" className="uppercase text-xs tracking-wide">
            <Truck className="w-4 h-4 mr-2" />
            Dispatches ({dispatches.length})
          </TabsTrigger>
          <TabsTrigger value="invoices" className="uppercase text-xs tracking-wide">
            <FileText className="w-4 h-4 mr-2" />
            Invoices ({invoices.length})
          </TabsTrigger>
        </TabsList>

        {/* Dispatches Tab */}
        <TabsContent value="dispatches">
          <div className="flex justify-end mb-4">
            <Button onClick={() => { setDispatchForm({...dispatchForm, branch: selectedBranch}); setShowDispatchDialog(true); }} data-testid="create-dispatch-btn">
              <Plus className="w-4 h-4 mr-2" />
              New Dispatch
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono uppercase text-muted-foreground">Pending</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black">{dispatches.filter(d => d.status === 'PENDING').length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono uppercase text-muted-foreground">Shipped</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-blue-600">{dispatches.filter(d => d.status === 'SHIPPED' || d.status === 'IN_TRANSIT').length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono uppercase text-muted-foreground">Delivered</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-green-600">{dispatches.filter(d => d.status === 'DELIVERED').length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono uppercase text-muted-foreground">Total Units</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black">{dispatches.reduce((sum, d) => sum + (d.quantity || 0), 0)}</div>
              </CardContent>
            </Card>
          </div>

          <div className="border rounded-sm">
            <table className="w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Code</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Buyer</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">SKU</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Qty</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Branch</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Dispatch Date</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Tracking</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Status</th>
                  <th className="h-10 px-4 text-right font-mono text-xs uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {dispatches.map((dispatch) => (
                  <tr key={dispatch.id} className="border-t">
                    <td className="p-4 font-mono font-bold">{dispatch.dispatch_code}</td>
                    <td className="p-4 text-sm">{getBuyerName(dispatch.buyer_id)}</td>
                    <td className="p-4 text-sm">
                      <div>{dispatch.sku_id}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[200px]">{getSKUDescription(dispatch.sku_id)}</div>
                    </td>
                    <td className="p-4 font-mono">{dispatch.quantity}</td>
                    <td className="p-4 text-sm">{dispatch.branch}</td>
                    <td className="p-4 text-sm">{dispatch.dispatch_date ? new Date(dispatch.dispatch_date).toLocaleDateString() : '-'}</td>
                    <td className="p-4 font-mono text-xs">{dispatch.tracking_number || '-'}</td>
                    <td className="p-4">{getDispatchStatusBadge(dispatch.status)}</td>
                    <td className="p-4 text-right space-x-2">
                      {dispatch.status === 'PENDING' && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => { setShipForm({ dispatch_id: dispatch.id, tracking_number: "" }); setShowShipDialog(true); }}
                          data-testid={`ship-${dispatch.dispatch_code}`}
                        >
                          <Truck className="w-4 h-4 mr-1" /> Ship
                        </Button>
                      )}
                      {(dispatch.status === 'SHIPPED' || dispatch.status === 'IN_TRANSIT') && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleDeliverDispatch(dispatch.id)}
                          data-testid={`deliver-${dispatch.dispatch_code}`}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" /> Deliver
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {dispatches.length === 0 && (
                  <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No dispatches</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices">
          <div className="flex justify-end mb-4">
            <Button onClick={() => setShowInvoiceDialog(true)} data-testid="create-invoice-btn">
              <Plus className="w-4 h-4 mr-2" />
              New Invoice
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono uppercase text-muted-foreground">Draft</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black">{invoices.filter(i => i.status === 'DRAFT').length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono uppercase text-muted-foreground">Sent</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-blue-600">{invoices.filter(i => i.status === 'SENT').length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono uppercase text-muted-foreground">Paid</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-green-600">{invoices.filter(i => i.status === 'PAID').length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono uppercase text-muted-foreground">Total Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black">₹{invoices.filter(i => i.status === 'PAID').reduce((sum, i) => sum + (i.total_amount || 0), 0).toLocaleString()}</div>
              </CardContent>
            </Card>
          </div>

          <div className="border rounded-sm">
            <table className="w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Invoice #</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Buyer</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Date</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Subtotal</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Tax</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Total</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Status</th>
                  <th className="h-10 px-4 text-right font-mono text-xs uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-t">
                    <td className="p-4 font-mono font-bold">{invoice.invoice_number}</td>
                    <td className="p-4 text-sm">{getBuyerName(invoice.buyer_id)}</td>
                    <td className="p-4 text-sm">{invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString() : '-'}</td>
                    <td className="p-4 font-mono">₹{(invoice.subtotal || 0).toLocaleString()}</td>
                    <td className="p-4 font-mono text-sm">₹{(invoice.tax_amount || 0).toLocaleString()}</td>
                    <td className="p-4 font-mono font-bold">₹{(invoice.total_amount || 0).toLocaleString()}</td>
                    <td className="p-4">{getInvoiceStatusBadge(invoice.status)}</td>
                    <td className="p-4 text-right space-x-2">
                      {invoice.status === 'DRAFT' && (
                        <Button variant="outline" size="sm" onClick={() => handleSendInvoice(invoice.id)} data-testid={`send-inv-${invoice.invoice_number}`}>
                          <Send className="w-4 h-4 mr-1" /> Send
                        </Button>
                      )}
                      {invoice.status === 'SENT' && (
                        <Button variant="outline" size="sm" onClick={() => handlePayInvoice(invoice.id)} data-testid={`pay-inv-${invoice.invoice_number}`}>
                          <DollarSign className="w-4 h-4 mr-1" /> Mark Paid
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No invoices</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Dispatch Dialog */}
      <Dialog open={showDispatchDialog} onOpenChange={setShowDispatchDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Dispatch</DialogTitle>
            <DialogDescription>Ship goods to a buyer</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Dispatch Lot</Label>
              <Select value={dispatchForm.dispatch_lot_id} onValueChange={(v) => {
                const lot = dispatchLots.find(l => l.id === v);
                setDispatchForm({
                  ...dispatchForm, 
                  dispatch_lot_id: v,
                  buyer_id: lot?.buyer_id || "",
                  sku_id: lot?.sku_id || "",
                  quantity: lot ? (lot.qc_passed_quantity - lot.dispatched_quantity) : 0
                });
              }}>
                <SelectTrigger><SelectValue placeholder="Select lot (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {dispatchLots.filter(l => l.status === 'QC_CLEARED' || l.status === 'DISPATCH_READY').map(lot => (
                    <SelectItem key={lot.id} value={lot.id}>
                      {lot.lot_code} - {lot.sku_id} ({lot.qc_passed_quantity - lot.dispatched_quantity} ready)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Buyer *</Label>
              <Select value={dispatchForm.buyer_id} onValueChange={(v) => setDispatchForm({...dispatchForm, buyer_id: v})}>
                <SelectTrigger><SelectValue placeholder="Select buyer" /></SelectTrigger>
                <SelectContent>
                  {buyers.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>SKU *</Label>
              <Select value={dispatchForm.sku_id} onValueChange={(v) => setDispatchForm({...dispatchForm, sku_id: v})}>
                <SelectTrigger><SelectValue placeholder="Select SKU" /></SelectTrigger>
                <SelectContent>
                  {skus.slice(0, 50).map(s => (
                    <SelectItem key={s.sku_id} value={s.sku_id}>{s.sku_id} - {s.description}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Branch *</Label>
              <Input value={dispatchForm.branch || selectedBranch} onChange={(e) => setDispatchForm({...dispatchForm, branch: e.target.value})} />
            </div>
            <div>
              <Label>Quantity *</Label>
              <Input type="number" value={dispatchForm.quantity} onChange={(e) => setDispatchForm({...dispatchForm, quantity: parseInt(e.target.value)})} />
            </div>
            <div>
              <Label>Dispatch Date</Label>
              <Input type="date" value={dispatchForm.dispatch_date} onChange={(e) => setDispatchForm({...dispatchForm, dispatch_date: e.target.value})} />
            </div>
            <div>
              <Label>Shipping Method</Label>
              <Input value={dispatchForm.shipping_method} onChange={(e) => setDispatchForm({...dispatchForm, shipping_method: e.target.value})} placeholder="e.g., FedEx, DHL" />
            </div>
            <Button 
              onClick={handleCreateDispatch} 
              className="w-full" 
              disabled={!dispatchForm.buyer_id || !dispatchForm.sku_id || !dispatchForm.quantity || !dispatchForm.branch}
              data-testid="submit-dispatch-btn"
            >
              Create Dispatch
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ship Dialog */}
      <Dialog open={showShipDialog} onOpenChange={setShowShipDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ship Dispatch</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tracking Number</Label>
              <Input value={shipForm.tracking_number} onChange={(e) => setShipForm({...shipForm, tracking_number: e.target.value})} placeholder="Enter tracking number" />
            </div>
            <Button onClick={handleShipDispatch} className="w-full" data-testid="confirm-ship-btn">
              <Truck className="w-4 h-4 mr-2" /> Confirm Shipment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Invoice Dialog */}
      <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Linked Dispatch (Optional)</Label>
              <Select value={dispatchForm.dispatch_id} onValueChange={(v) => setInvoiceForm({...invoiceForm, dispatch_id: v})}>
                <SelectTrigger><SelectValue placeholder="Link to dispatch" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {dispatches.filter(d => d.status === 'DELIVERED').map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.dispatch_code} - {d.sku_id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Buyer *</Label>
              <Select value={invoiceForm.buyer_id} onValueChange={(v) => setInvoiceForm({...invoiceForm, buyer_id: v})}>
                <SelectTrigger><SelectValue placeholder="Select buyer" /></SelectTrigger>
                <SelectContent>
                  {buyers.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subtotal *</Label>
              <Input type="number" step="0.01" value={invoiceForm.subtotal} onChange={(e) => setInvoiceForm({...invoiceForm, subtotal: parseFloat(e.target.value)})} />
            </div>
            <div>
              <Label>Tax %</Label>
              <Input type="number" value={invoiceForm.tax_percent} onChange={(e) => setInvoiceForm({...invoiceForm, tax_percent: parseFloat(e.target.value)})} />
            </div>
            <div className="bg-zinc-50 p-3 rounded">
              <div className="flex justify-between text-sm">
                <span>Tax Amount:</span>
                <span>₹{((invoiceForm.subtotal * invoiceForm.tax_percent) / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold mt-1">
                <span>Total:</span>
                <span>₹{(invoiceForm.subtotal + (invoiceForm.subtotal * invoiceForm.tax_percent) / 100).toFixed(2)}</span>
              </div>
            </div>
            <Button 
              onClick={handleCreateInvoice} 
              className="w-full" 
              disabled={!invoiceForm.buyer_id || !invoiceForm.subtotal}
              data-testid="submit-invoice-btn"
            >
              Create Invoice
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Logistics;

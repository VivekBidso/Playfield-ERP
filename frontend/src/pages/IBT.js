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
  XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import useAuthStore from "@/store/authStore";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const IBT = () => {
  const { user } = useAuthStore();
  
  // Data
  const [transfers, setTransfers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  
  // Dialogs
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  
  // Form
  const [form, setForm] = useState({
    from_branch: "",
    to_branch: "",
    rm_id: "",
    quantity: 0,
    notes: ""
  });
  
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all, pending, in_transit, completed

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [ibtRes, branchRes, rmRes] = await Promise.all([
        axios.get(`${API}/ibt-transfers`),
        axios.get(`${API}/branches/names`),
        axios.get(`${API}/raw-materials`)
      ]);
      setTransfers(ibtRes.data);
      setBranches(branchRes.data.branches || []);
      setRawMaterials(rmRes.data);
    } catch (error) {
      toast.error("Failed to fetch IBT data");
    }
    setLoading(false);
  };

  const handleCreateTransfer = async () => {
    try {
      await axios.post(`${API}/ibt-transfers`, {
        from_branch: form.from_branch,
        to_branch: form.to_branch,
        rm_id: form.rm_id,
        quantity: form.quantity,
        notes: form.notes
      });
      toast.success("Transfer request created");
      setShowCreateDialog(false);
      setForm({ from_branch: "", to_branch: "", rm_id: "", quantity: 0, notes: "" });
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create transfer");
    }
  };

  const handleApprove = async (transferId) => {
    try {
      await axios.put(`${API}/ibt-transfers/${transferId}/approve`);
      toast.success("Transfer approved");
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to approve transfer");
    }
  };

  const handleShip = async (transferId) => {
    try {
      await axios.put(`${API}/ibt-transfers/${transferId}/ship`);
      toast.success("Transfer shipped - stock deducted from source");
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to ship transfer");
    }
  };

  const handleReceive = async (transferId) => {
    try {
      await axios.put(`${API}/ibt-transfers/${transferId}/receive`);
      toast.success("Transfer received - stock added to destination");
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to receive transfer");
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      PENDING: "bg-yellow-100 text-yellow-800",
      APPROVED: "bg-blue-100 text-blue-800",
      IN_TRANSIT: "bg-purple-100 text-purple-800",
      COMPLETED: "bg-green-100 text-green-800",
      REJECTED: "bg-red-100 text-red-800",
      CANCELLED: "bg-zinc-200 text-zinc-800"
    };
    return <Badge className={colors[status] || "bg-zinc-200"}>{status}</Badge>;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'PENDING': return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'APPROVED': return <CheckCircle className="w-4 h-4 text-blue-600" />;
      case 'IN_TRANSIT': return <Truck className="w-4 h-4 text-purple-600" />;
      case 'COMPLETED': return <Package className="w-4 h-4 text-green-600" />;
      case 'REJECTED': return <XCircle className="w-4 h-4 text-red-600" />;
      default: return null;
    }
  };

  const getRMDescription = (rmId) => {
    const rm = rawMaterials.find(r => r.rm_id === rmId);
    if (!rm) return rmId;
    const cd = rm.category_data || {};
    return cd.part_name || cd.type || cd.model_name || rmId;
  };

  const filteredTransfers = transfers.filter(t => {
    if (filter === "all") return true;
    if (filter === "pending") return t.status === "PENDING" || t.status === "APPROVED";
    if (filter === "in_transit") return t.status === "IN_TRANSIT";
    if (filter === "completed") return t.status === "COMPLETED";
    return true;
  });

  const canUserApprove = user?.role === "master_admin";

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center" data-testid="ibt-loading">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        Loading IBT data...
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8" data-testid="ibt-page">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-black tracking-tight uppercase">IBT</h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">Inter-Branch Transfers</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} data-testid="create-ibt-btn">
          <Plus className="w-4 h-4 mr-2" />
          New Transfer
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card className={`cursor-pointer ${filter === 'all' ? 'ring-2 ring-primary' : ''}`} onClick={() => setFilter('all')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{transfers.length}</div>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer ${filter === 'pending' ? 'ring-2 ring-primary' : ''}`} onClick={() => setFilter('pending')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-yellow-600">{transfers.filter(t => t.status === 'PENDING' || t.status === 'APPROVED').length}</div>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer ${filter === 'in_transit' ? 'ring-2 ring-primary' : ''}`} onClick={() => setFilter('in_transit')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase text-muted-foreground">In Transit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-purple-600">{transfers.filter(t => t.status === 'IN_TRANSIT').length}</div>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer ${filter === 'completed' ? 'ring-2 ring-primary' : ''}`} onClick={() => setFilter('completed')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-green-600">{transfers.filter(t => t.status === 'COMPLETED').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase text-muted-foreground">Total Qty</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{transfers.reduce((sum, t) => sum + (t.quantity || 0), 0)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Transfers Table */}
      <div className="border rounded-sm">
        <table className="w-full">
          <thead className="bg-zinc-50">
            <tr>
              <th className="h-10 px-4 text-left font-mono text-xs uppercase">Transfer Code</th>
              <th className="h-10 px-4 text-left font-mono text-xs uppercase">From → To</th>
              <th className="h-10 px-4 text-left font-mono text-xs uppercase">RM</th>
              <th className="h-10 px-4 text-left font-mono text-xs uppercase">Qty</th>
              <th className="h-10 px-4 text-left font-mono text-xs uppercase">Status</th>
              <th className="h-10 px-4 text-left font-mono text-xs uppercase">Created</th>
              <th className="h-10 px-4 text-right font-mono text-xs uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransfers.map((transfer) => (
              <tr key={transfer.id} className="border-t">
                <td className="p-4 font-mono font-bold">{transfer.transfer_code}</td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{transfer.from_branch}</span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{transfer.to_branch}</span>
                  </div>
                </td>
                <td className="p-4">
                  <div className="font-mono text-sm">{transfer.rm_id}</div>
                  <div className="text-xs text-muted-foreground">{getRMDescription(transfer.rm_id)}</div>
                </td>
                <td className="p-4 font-mono">{transfer.quantity}</td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(transfer.status)}
                    {getStatusBadge(transfer.status)}
                  </div>
                </td>
                <td className="p-4 text-sm text-muted-foreground">
                  {transfer.created_at ? new Date(transfer.created_at).toLocaleDateString() : '-'}
                </td>
                <td className="p-4 text-right space-x-2">
                  {transfer.status === 'PENDING' && canUserApprove && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleApprove(transfer.id)}
                      data-testid={`approve-${transfer.transfer_code}`}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" /> Approve
                    </Button>
                  )}
                  {transfer.status === 'APPROVED' && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleShip(transfer.id)}
                      data-testid={`ship-${transfer.transfer_code}`}
                    >
                      <Truck className="w-4 h-4 mr-1" /> Ship
                    </Button>
                  )}
                  {transfer.status === 'IN_TRANSIT' && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleReceive(transfer.id)}
                      data-testid={`receive-${transfer.transfer_code}`}
                    >
                      <Package className="w-4 h-4 mr-1" /> Receive
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {filteredTransfers.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  <ArrowLeftRight className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No transfers found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Transfer Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Inter-Branch Transfer</DialogTitle>
            <DialogDescription>Transfer raw materials between branches</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>From Branch *</Label>
              <Select value={form.from_branch} onValueChange={(v) => setForm({...form, from_branch: v})}>
                <SelectTrigger><SelectValue placeholder="Select source branch" /></SelectTrigger>
                <SelectContent>
                  {branches.map(b => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>To Branch *</Label>
              <Select value={form.to_branch} onValueChange={(v) => setForm({...form, to_branch: v})}>
                <SelectTrigger><SelectValue placeholder="Select destination branch" /></SelectTrigger>
                <SelectContent>
                  {branches.filter(b => b !== form.from_branch).map(b => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Raw Material *</Label>
              <Select value={form.rm_id} onValueChange={(v) => setForm({...form, rm_id: v})}>
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
              <Input 
                type="number" 
                value={form.quantity} 
                onChange={(e) => setForm({...form, quantity: parseFloat(e.target.value)})}
                placeholder="Enter quantity"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Input 
                value={form.notes} 
                onChange={(e) => setForm({...form, notes: e.target.value})}
                placeholder="Optional notes"
              />
            </div>

            {form.from_branch && form.to_branch && (
              <div className="bg-zinc-50 p-3 rounded flex items-center justify-center gap-4">
                <span className="font-mono text-sm">{form.from_branch}</span>
                <ArrowRight className="w-5 h-5 text-primary" />
                <span className="font-mono text-sm">{form.to_branch}</span>
              </div>
            )}

            <Button 
              onClick={handleCreateTransfer} 
              className="w-full" 
              disabled={!form.from_branch || !form.to_branch || !form.rm_id || !form.quantity}
              data-testid="submit-ibt-btn"
            >
              <ArrowLeftRight className="w-4 h-4 mr-2" />
              Create Transfer Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IBT;

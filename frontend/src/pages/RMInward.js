import { useState, useEffect } from "react";
import axios from "axios";
import useBranchStore from "@/store/branchStore";
import useAuthStore from "@/store/authStore";
import { Plus, Download, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const RMInward = () => {
  const { selectedBranch } = useBranchStore();
  const { token } = useAuthStore();
  const [entries, setEntries] = useState([]);
  const [availableRMs, setAvailableRMs] = useState([]);
  const [branchInventory, setBranchInventory] = useState({}); // {rm_id: current_stock}
  const [filteredRMs, setFilteredRMs] = useState([]);
  const [rmSearch, setRmSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);

  const [formData, setFormData] = useState({
    rm_id: "",
    quantity: 0,
    date: new Date().toISOString().split('T')[0],
    notes: ""
  });

  useEffect(() => {
    fetchEntries();
    fetchAvailableRMs();
    fetchBranchInventory();
  }, [selectedBranch]);

  const fetchBranchInventory = async () => {
    try {
      const response = await axios.get(
        `${API}/raw-materials?branch=${encodeURIComponent(selectedBranch)}`,
        { headers: { Authorization: `Bearer ${token}` }}
      );
      // Build a map of rm_id -> current_stock
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
      // Fetch ALL global RMs (not just branch-specific) for inward entry
      const response = await axios.get(
        `${API}/raw-materials`,
        { headers: { Authorization: `Bearer ${token}` }}
      );
      setAvailableRMs(response.data);
      setFilteredRMs(response.data.slice(0, 100)); // Show first 100 by default
    } catch (error) {
      toast.error("Failed to fetch available RMs");
    }
  };

  // Filter RMs based on search
  useEffect(() => {
    if (rmSearch.length >= 2) {
      const filtered = availableRMs.filter(rm => 
        rm.rm_id.toLowerCase().includes(rmSearch.toLowerCase()) ||
        rm.category.toLowerCase().includes(rmSearch.toLowerCase()) ||
        JSON.stringify(rm.category_data).toLowerCase().includes(rmSearch.toLowerCase())
      );
      setFilteredRMs(filtered.slice(0, 100));
    } else if (rmSearch.length === 0) {
      setFilteredRMs(availableRMs.slice(0, 100));
    }
  }, [rmSearch, availableRMs]);

  const handleSubmit = async () => {
    if (!formData.rm_id || formData.quantity <= 0) {
      toast.error("Please select RM and enter valid quantity");
      return;
    }

    try {
      const payload = {
        rm_id: formData.rm_id,
        branch: selectedBranch,
        quantity: parseFloat(formData.quantity),
        date: new Date(formData.date).toISOString(),
        notes: formData.notes
      };

      await axios.post(`${API}/purchase-entries`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success(`Added ${formData.quantity} units of ${formData.rm_id} to ${selectedBranch} inventory`);
      setShowDialog(false);
      setFormData({ rm_id: "", quantity: 0, date: new Date().toISOString().split('T')[0], notes: "" });
      fetchEntries();
      fetchAvailableRMs();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to add inward entry");
    }
  };

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(entries.map(e => ({
      'Date': new Date(e.date).toLocaleDateString(),
      'RM ID': e.rm_id,
      'Quantity': e.quantity,
      'Branch': e.branch,
      'Notes': e.notes || ''
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'RM Inward');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `rm_inward_${selectedBranch}.xlsx`);
    toast.success("Exported to Excel");
  };

  const getRMDetails = (rm_id) => {
    const rm = availableRMs.find(r => r.rm_id === rm_id);
    return rm ? `${rm.rm_id} (${rm.category})` : rm_id;
  };

  const getCurrentStock = (rm_id) => {
    return branchInventory[rm_id] || 0;
  };

  return (
    <div className="p-6 md:p-8" data-testid="rm-inward-page">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight uppercase">RM Inward Entry</h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">
            Record incoming raw materials for {selectedBranch}
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
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button data-testid="add-inward-btn" className="uppercase text-xs tracking-wide">
                <Plus className="w-4 h-4 mr-2" strokeWidth={1.5} />
                Add Inward Entry
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-bold uppercase">RM Inward Entry</DialogTitle>
                <p className="text-xs text-muted-foreground font-mono">
                  Branch: {selectedBranch}
                </p>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Search Raw Material</Label>
                  <Input
                    type="text"
                    value={rmSearch}
                    onChange={(e) => setRmSearch(e.target.value)}
                    placeholder="Type to search RM ID, category..."
                    className="font-mono mb-2"
                    data-testid="rm-search-input"
                  />
                  <Label>Select Raw Material *</Label>
                  <select 
                    className="flex h-10 w-full rounded-sm border border-input bg-transparent px-3 py-2 text-sm font-mono"
                    value={formData.rm_id}
                    onChange={(e) => setFormData({...formData, rm_id: e.target.value})}
                    data-testid="inward-rm-select"
                  >
                    <option value="">Select RM ({filteredRMs.length} shown)</option>
                    {filteredRMs.map(rm => (
                      <option key={rm.rm_id} value={rm.rm_id}>
                        {rm.rm_id} - {rm.category}
                      </option>
                    ))}
                  </select>
                  {rmSearch.length > 0 && rmSearch.length < 2 && (
                    <p className="text-xs text-yellow-600 mt-1">Type at least 2 characters to search</p>
                  )}
                  {formData.rm_id && (
                    <p className="text-xs text-muted-foreground mt-2 font-mono">
                      Selected: {formData.rm_id} | Current Stock in {selectedBranch}: {getCurrentStock(formData.rm_id)} units
                    </p>
                  )}
                </div>
                <div>
                  <Label>Quantity Received *</Label>
                  <Input 
                    type="number" 
                    step="0.01"
                    value={formData.quantity} 
                    onChange={(e) => setFormData({...formData, quantity: parseFloat(e.target.value)})}
                    data-testid="inward-quantity-input"
                    className="font-mono"
                    placeholder="Enter quantity"
                  />
                </div>
                <div>
                  <Label>Inward Date *</Label>
                  <Input 
                    type="date" 
                    value={formData.date} 
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    data-testid="inward-date-input"
                  />
                </div>
                <div>
                  <Label>Notes (Optional)</Label>
                  <Textarea 
                    value={formData.notes} 
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    data-testid="inward-notes-input"
                    placeholder="Supplier, PO number, truck details, etc."
                    rows={3}
                  />
                </div>
                <div className="bg-zinc-50 border border-zinc-200 rounded-sm p-3">
                  <div className="text-xs text-zinc-600 font-mono">
                    <strong>Summary:</strong><br/>
                    {formData.rm_id && formData.quantity > 0 && (
                      <>
                        Adding <strong>{formData.quantity}</strong> units of <strong>{formData.rm_id}</strong><br/>
                        New Stock: {getCurrentStock(formData.rm_id) + formData.quantity} units
                      </>
                    )}
                  </div>
                </div>
                <Button 
                  onClick={handleSubmit} 
                  data-testid="submit-inward-btn" 
                  className="w-full uppercase text-xs tracking-wide"
                >
                  Confirm Inward Entry
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border border border-border mb-8">
        <div className="bg-white p-6">
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">
            Total Entries (This Month)
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
            {availableRMs.length}
          </div>
        </div>
        <div className="bg-white p-6">
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">
            Total Quantity (This Month)
          </div>
          <div className="text-3xl font-black font-mono text-zinc-700">
            {entries
              .filter(e => new Date(e.date).getMonth() === new Date().getMonth())
              .reduce((sum, e) => sum + e.quantity, 0)
              .toFixed(0)}
          </div>
        </div>
      </div>

      {/* Inward Entries Table */}
      <div className="border border-border bg-white rounded-sm overflow-hidden">
        <div className="p-6 border-b border-border flex items-center gap-3">
          <Package className="w-5 h-5 text-primary" strokeWidth={1.5} />
          <h2 className="text-lg font-bold uppercase tracking-tight">Recent Inward Entries</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="inward-table">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Date</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">RM ID</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Category</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Quantity</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Notes</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Current Stock</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => (
                <tr key={entry.id || idx} className="border-b border-zinc-100 hover:bg-zinc-50/50" data-testid={`inward-row-${entry.rm_id}`}>
                  <td className="p-4 align-middle font-mono text-zinc-700">
                    {new Date(entry.date).toLocaleDateString()}
                  </td>
                  <td className="p-4 align-middle font-mono text-sm font-bold text-zinc-700">
                    {entry.rm_id}
                  </td>
                  <td className="p-4 align-middle">
                    <span className="text-xs font-mono text-primary px-2 py-1 bg-zinc-50 border border-zinc-200 rounded">
                      {availableRMs.find(rm => rm.rm_id === entry.rm_id)?.category || '-'}
                    </span>
                  </td>
                  <td className="p-4 align-middle font-mono text-primary font-bold">
                    +{entry.quantity}
                  </td>
                  <td className="p-4 align-middle text-sm text-zinc-600 max-w-xs truncate">
                    {entry.notes || '-'}
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

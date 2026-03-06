import { useState, useEffect } from "react";
import axios from "axios";
import { Plus, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Dispatch = () => {
  const [entries, setEntries] = useState([]);
  const [skus, setSkus] = useState([]);
  const [showDialog, setShowDialog] = useState(false);

  const [formData, setFormData] = useState({
    sku_id: "",
    quantity: 0,
    date: new Date().toISOString().split('T')[0],
    notes: ""
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [entriesRes, skusRes] = await Promise.all([
        axios.get(`${API}/dispatch-entries`),
        axios.get(`${API}/skus`)
      ]);
      setEntries(entriesRes.data);
      setSkus(skusRes.data);
    } catch (error) {
      toast.error("Failed to fetch data");
    }
  };

  const handleSubmit = async () => {
    try {
      const payload = {
        ...formData,
        date: new Date(formData.date).toISOString()
      };
      await axios.post(`${API}/dispatch-entries`, payload);
      toast.success("Dispatch entry added. SKU inventory updated.");
      setShowDialog(false);
      setFormData({ sku_id: "", quantity: 0, date: new Date().toISOString().split('T')[0], notes: "" });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to add dispatch entry");
    }
  };

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(entries.map(e => ({
      'Date': new Date(e.date).toLocaleDateString(),
      'SKU ID': e.sku_id,
      'Quantity': e.quantity,
      'Notes': e.notes || ''
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dispatch');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'dispatch_entries.xlsx');
    toast.success("Exported to Excel");
  };

  return (
    <div className="p-6 md:p-8" data-testid="dispatch-page">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight uppercase">Dispatch</h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">Track outgoing SKU shipments</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="secondary" 
            onClick={handleExport}
            data-testid="export-dispatch-btn"
            className="uppercase text-xs tracking-wide"
          >
            <Download className="w-4 h-4 mr-2" strokeWidth={1.5} />
            Export
          </Button>
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button data-testid="add-dispatch-btn" className="uppercase text-xs tracking-wide">
                <Plus className="w-4 h-4 mr-2" strokeWidth={1.5} />
                Add Dispatch
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-bold uppercase">Add Dispatch Entry</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>SKU *</Label>
                  <select 
                    className="flex h-10 w-full rounded-sm border border-input bg-transparent px-3 py-2 text-sm font-mono"
                    value={formData.sku_id}
                    onChange={(e) => setFormData({...formData, sku_id: e.target.value})}
                    data-testid="dispatch-sku-select"
                  >
                    <option value="">Select SKU</option>
                    {skus.map(s => (
                      <option key={s.sku_id} value={s.sku_id}>{s.sku_id} - {s.name} (Stock: {s.current_stock})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Quantity *</Label>
                  <Input 
                    type="number" 
                    value={formData.quantity} 
                    onChange={(e) => setFormData({...formData, quantity: parseFloat(e.target.value)})}
                    data-testid="dispatch-quantity-input"
                    className="font-mono"
                  />
                </div>
                <div>
                  <Label>Date *</Label>
                  <Input 
                    type="date" 
                    value={formData.date} 
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    data-testid="dispatch-date-input"
                  />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Input 
                    value={formData.notes} 
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    data-testid="dispatch-notes-input"
                  />
                </div>
                <Button onClick={handleSubmit} data-testid="submit-dispatch-btn" className="w-full uppercase text-xs tracking-wide">
                  Add Dispatch
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Table */}
      <div className="border border-border bg-white rounded-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="dispatch-table">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Date</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">SKU ID</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Quantity</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Notes</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-zinc-100 hover:bg-zinc-50/50" data-testid={`dispatch-row-${entry.id}`}>
                  <td className="p-4 align-middle font-mono text-zinc-700">
                    {new Date(entry.date).toLocaleDateString()}
                  </td>
                  <td className="p-4 align-middle font-mono text-zinc-700">{entry.sku_id}</td>
                  <td className="p-4 align-middle font-mono text-zinc-700">{entry.quantity}</td>
                  <td className="p-4 align-middle text-sm text-zinc-600">{entry.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {entries.length === 0 && (
            <div className="p-12 text-center text-muted-foreground font-mono text-sm">
              No dispatch entries yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dispatch;
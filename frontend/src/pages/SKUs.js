import { useState, useEffect } from "react";
import axios from "axios";
import { Plus, Search, Trash2, Download, Edit } from "lucide-react";
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

const SKUs = () => {
  const [skus, setSkus] = useState([]);
  const [filteredSkus, setFilteredSkus] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedSKU, setSelectedSKU] = useState(null);

  const [formData, setFormData] = useState({
    sku_id: "",
    name: "",
    description: "",
    low_stock_threshold: 5
  });

  useEffect(() => {
    fetchSKUs();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const filtered = skus.filter(s => 
        s.sku_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredSkus(filtered);
    } else {
      setFilteredSkus(skus);
    }
  }, [searchQuery, skus]);

  const fetchSKUs = async () => {
    try {
      const response = await axios.get(`${API}/skus`);
      setSkus(response.data);
      setFilteredSkus(response.data);
    } catch (error) {
      toast.error("Failed to fetch SKUs");
    }
  };

  const handleSubmit = async () => {
    try {
      if (editMode) {
        await axios.put(`${API}/skus/${selectedSKU.sku_id}`, formData);
        toast.success("SKU updated");
      } else {
        await axios.post(`${API}/skus`, formData);
        toast.success("SKU added");
      }
      setShowDialog(false);
      resetForm();
      fetchSKUs();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Operation failed");
    }
  };

  const handleEdit = (sku) => {
    setSelectedSKU(sku);
    setFormData({
      sku_id: sku.sku_id,
      name: sku.name,
      description: sku.description || "",
      low_stock_threshold: sku.low_stock_threshold
    });
    setEditMode(true);
    setShowDialog(true);
  };

  const handleDelete = async (sku_id) => {
    if (!window.confirm('Are you sure you want to delete this SKU?')) return;
    try {
      await axios.delete(`${API}/skus/${sku_id}`);
      toast.success("SKU deleted");
      fetchSKUs();
    } catch (error) {
      toast.error("Failed to delete");
    }
  };

  const resetForm = () => {
    setFormData({ sku_id: "", name: "", description: "", low_stock_threshold: 5 });
    setEditMode(false);
    setSelectedSKU(null);
  };

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(skus.map(s => ({
      'SKU ID': s.sku_id,
      'Name': s.name,
      'Description': s.description,
      'Current Stock': s.current_stock,
      'Low Stock Threshold': s.low_stock_threshold
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SKUs');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'skus.xlsx');
    toast.success("Exported to Excel");
  };

  return (
    <div className="p-6 md:p-8" data-testid="skus-page">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight uppercase">SKUs</h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">Finished goods management</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="secondary" 
            onClick={handleExport}
            data-testid="export-skus-btn"
            className="uppercase text-xs tracking-wide"
          >
            <Download className="w-4 h-4 mr-2" strokeWidth={1.5} />
            Export
          </Button>
          <Dialog open={showDialog} onOpenChange={(open) => {
            setShowDialog(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button data-testid="add-sku-btn" className="uppercase text-xs tracking-wide">
                <Plus className="w-4 h-4 mr-2" strokeWidth={1.5} />
                Add SKU
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-bold uppercase">
                  {editMode ? "Edit SKU" : "Add SKU"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>SKU ID *</Label>
                  <Input 
                    value={formData.sku_id} 
                    onChange={(e) => setFormData({...formData, sku_id: e.target.value})}
                    data-testid="sku-id-input"
                    className="font-mono"
                    disabled={editMode}
                  />
                </div>
                <div>
                  <Label>Name *</Label>
                  <Input 
                    value={formData.name} 
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    data-testid="sku-name-input"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea 
                    value={formData.description} 
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    data-testid="sku-description-input"
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Low Stock Threshold</Label>
                  <Input 
                    type="number" 
                    value={formData.low_stock_threshold} 
                    onChange={(e) => setFormData({...formData, low_stock_threshold: parseFloat(e.target.value)})}
                    data-testid="sku-threshold-input"
                  />
                </div>
                <Button onClick={handleSubmit} data-testid="submit-sku-btn" className="w-full uppercase text-xs tracking-wide">
                  {editMode ? "Update SKU" : "Add SKU"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
          <Input 
            placeholder="Search by SKU ID or Name..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="search-sku-input"
            className="pl-10 font-mono"
          />
        </div>
      </div>

      {/* Table */}
      <div className="border border-border bg-white rounded-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="sku-table">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Buyer SKU ID</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Bidso SKU</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Description</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Brand</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Vertical</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Model</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Stock</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSkus.map((sku) => (
                <tr key={sku.id} className="border-b border-zinc-100 hover:bg-zinc-50/50" data-testid={`sku-row-${sku.sku_id}`}>
                  <td className="p-4 align-middle font-mono text-sm font-bold text-zinc-700">{sku.sku_id}</td>
                  <td className="p-4 align-middle font-mono text-sm text-zinc-700">{sku.bidso_sku}</td>
                  <td className="p-4 align-middle text-sm text-zinc-600 max-w-xs truncate">{sku.description || '-'}</td>
                  <td className="p-4 align-middle font-mono text-xs text-zinc-600">{sku.brand}</td>
                  <td className="p-4 align-middle font-mono text-xs text-zinc-600">{sku.vertical}</td>
                  <td className="p-4 align-middle font-mono text-xs text-zinc-600">{sku.model}</td>
                  <td className="p-4 align-middle font-mono text-zinc-700">{sku.current_stock || 0}</td>
                  <td className="p-4 align-middle">
                    {(sku.current_stock || 0) < sku.low_stock_threshold ? (
                      <span className="text-xs font-mono text-red-600 border border-red-600 px-2 py-1 uppercase tracking-wider">
                        Low Stock
                      </span>
                    ) : (
                      <span className="text-xs font-mono text-green-600 border border-green-600 px-2 py-1 uppercase tracking-wider">
                        OK
                      </span>
                    )}
                  </td>
                  <td className="p-4 align-middle">
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleEdit(sku)}
                        data-testid={`edit-sku-${sku.sku_id}`}
                      >
                        <Edit className="w-4 h-4 text-primary" strokeWidth={1.5} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleDelete(sku.sku_id)}
                        data-testid={`delete-sku-${sku.sku_id}`}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" strokeWidth={1.5} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredSkus.length === 0 && (
            <div className="p-12 text-center text-muted-foreground font-mono text-sm">
              No SKUs found. Add your finished goods.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SKUs;
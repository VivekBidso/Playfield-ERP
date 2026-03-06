import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Upload, Plus, Search, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const RawMaterials = () => {
  const [materials, setMaterials] = useState([]);
  const [filteredMaterials, setFilteredMaterials] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [selectedRM, setSelectedRM] = useState(null);
  const fileInputRef = useRef(null);

  const [newRM, setNewRM] = useState({
    rm_id: "",
    name: "",
    unit: "",
    low_stock_threshold: 10
  });

  const [purchaseEntry, setPurchaseEntry] = useState({
    rm_id: "",
    quantity: 0,
    date: new Date().toISOString().split('T')[0],
    notes: ""
  });

  useEffect(() => {
    fetchMaterials();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const filtered = materials.filter(m => 
        m.rm_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredMaterials(filtered);
    } else {
      setFilteredMaterials(materials);
    }
  }, [searchQuery, materials]);

  const fetchMaterials = async () => {
    try {
      const response = await axios.get(`${API}/raw-materials`);
      setMaterials(response.data);
      setFilteredMaterials(response.data);
    } catch (error) {
      toast.error("Failed to fetch raw materials");
    }
  };

  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API}/raw-materials/bulk-upload`, formData);
      toast.success(`Uploaded: ${response.data.created} created, ${response.data.skipped} skipped`);
      if (response.data.errors.length > 0) {
        console.error('Upload errors:', response.data.errors);
      }
      fetchMaterials();
    } catch (error) {
      toast.error("Upload failed");
    }
    e.target.value = null;
  };

  const handleAddRM = async () => {
    try {
      await axios.post(`${API}/raw-materials`, newRM);
      toast.success("Raw material added");
      setShowAddDialog(false);
      setNewRM({ rm_id: "", name: "", unit: "", low_stock_threshold: 10 });
      fetchMaterials();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to add raw material");
    }
  };

  const handleAddPurchase = async () => {
    try {
      const payload = {
        ...purchaseEntry,
        date: new Date(purchaseEntry.date).toISOString()
      };
      await axios.post(`${API}/purchase-entries`, payload);
      toast.success("Purchase entry added");
      setShowPurchaseDialog(false);
      setPurchaseEntry({ rm_id: "", quantity: 0, date: new Date().toISOString().split('T')[0], notes: "" });
      fetchMaterials();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to add purchase entry");
    }
  };

  const handleDelete = async (rm_id) => {
    if (!window.confirm('Are you sure you want to delete this raw material?')) return;
    try {
      await axios.delete(`${API}/raw-materials/${rm_id}`);
      toast.success("Raw material deleted");
      fetchMaterials();
    } catch (error) {
      toast.error("Failed to delete");
    }
  };

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(materials.map(m => ({
      'RM ID': m.rm_id,
      'Name': m.name,
      'Unit': m.unit,
      'Current Stock': m.current_stock,
      'Low Stock Threshold': m.low_stock_threshold
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Raw Materials');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'raw_materials.xlsx');
    toast.success("Exported to Excel");
  };

  const downloadTemplate = () => {
    const template = [{ rm_id: 'RM001', name: 'Sample Material', unit: 'kg', low_stock_threshold: 10 }];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'rm_upload_template.xlsx');
  };

  return (
    <div className="p-6 md:p-8" data-testid="raw-materials-page">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight uppercase">Raw Materials</h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">Manage inventory & purchases</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="secondary" 
            onClick={handleExport}
            data-testid="export-rm-btn"
            className="uppercase text-xs tracking-wide"
          >
            <Download className="w-4 h-4 mr-2" strokeWidth={1.5} />
            Export
          </Button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleBulkUpload} 
            accept=".xlsx,.xls"
            className="hidden"
          />
          <Button 
            variant="secondary" 
            onClick={() => fileInputRef.current.click()}
            data-testid="bulk-upload-btn"
            className="uppercase text-xs tracking-wide"
          >
            <Upload className="w-4 h-4 mr-2" strokeWidth={1.5} />
            Bulk Upload
          </Button>
          <Button 
            variant="secondary" 
            onClick={downloadTemplate}
            data-testid="download-template-btn"
            className="uppercase text-xs tracking-wide"
          >
            Template
          </Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button data-testid="add-rm-btn" className="uppercase text-xs tracking-wide">
                <Plus className="w-4 h-4 mr-2" strokeWidth={1.5} />
                Add RM
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-bold uppercase">Add Raw Material</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>RM ID *</Label>
                  <Input 
                    value={newRM.rm_id} 
                    onChange={(e) => setNewRM({...newRM, rm_id: e.target.value})}
                    data-testid="rm-id-input"
                    className="font-mono"
                  />
                </div>
                <div>
                  <Label>Name *</Label>
                  <Input 
                    value={newRM.name} 
                    onChange={(e) => setNewRM({...newRM, name: e.target.value})}
                    data-testid="rm-name-input"
                  />
                </div>
                <div>
                  <Label>Unit *</Label>
                  <Input 
                    value={newRM.unit} 
                    onChange={(e) => setNewRM({...newRM, unit: e.target.value})}
                    data-testid="rm-unit-input"
                    placeholder="e.g., kg, liters, units"
                  />
                </div>
                <div>
                  <Label>Low Stock Threshold</Label>
                  <Input 
                    type="number" 
                    value={newRM.low_stock_threshold} 
                    onChange={(e) => setNewRM({...newRM, low_stock_threshold: parseFloat(e.target.value)})}
                    data-testid="rm-threshold-input"
                  />
                </div>
                <Button onClick={handleAddRM} data-testid="submit-rm-btn" className="w-full uppercase text-xs tracking-wide">
                  Add Raw Material
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button 
            onClick={() => {
              setShowPurchaseDialog(true);
              if (materials.length > 0) {
                setPurchaseEntry({...purchaseEntry, rm_id: materials[0].rm_id});
              }
            }}
            data-testid="add-purchase-btn"
            className="uppercase text-xs tracking-wide"
          >
            <Plus className="w-4 h-4 mr-2" strokeWidth={1.5} />
            Add Purchase
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
          <Input 
            placeholder="Search by RM ID or Name..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="search-rm-input"
            className="pl-10 font-mono"
          />
        </div>
      </div>

      {/* Table */}
      <div className="border border-border bg-white rounded-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="rm-table">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">RM ID</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Name</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Unit</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Current Stock</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Threshold</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMaterials.map((material) => (
                <tr key={material.id} className="border-b border-zinc-100 hover:bg-zinc-50/50" data-testid={`rm-row-${material.rm_id}`}>
                  <td className="p-4 align-middle font-mono text-zinc-700">{material.rm_id}</td>
                  <td className="p-4 align-middle font-mono text-zinc-700">{material.name}</td>
                  <td className="p-4 align-middle font-mono text-zinc-700">{material.unit}</td>
                  <td className="p-4 align-middle font-mono text-zinc-700">{material.current_stock}</td>
                  <td className="p-4 align-middle font-mono text-zinc-700">{material.low_stock_threshold}</td>
                  <td className="p-4 align-middle">
                    {material.current_stock < material.low_stock_threshold ? (
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
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleDelete(material.rm_id)}
                      data-testid={`delete-rm-${material.rm_id}`}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" strokeWidth={1.5} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredMaterials.length === 0 && (
            <div className="p-12 text-center text-muted-foreground font-mono text-sm">
              No raw materials found. Upload or add manually.
            </div>
          )}
        </div>
      </div>

      {/* Purchase Dialog */}
      <Dialog open={showPurchaseDialog} onOpenChange={setShowPurchaseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-bold uppercase">Add Purchase Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>RM ID *</Label>
              <select 
                className="flex h-10 w-full rounded-sm border border-input bg-transparent px-3 py-2 text-sm font-mono"
                value={purchaseEntry.rm_id}
                onChange={(e) => setPurchaseEntry({...purchaseEntry, rm_id: e.target.value})}
                data-testid="purchase-rm-select"
              >
                <option value="">Select RM</option>
                {materials.map(m => (
                  <option key={m.rm_id} value={m.rm_id}>{m.rm_id} - {m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Quantity *</Label>
              <Input 
                type="number" 
                value={purchaseEntry.quantity} 
                onChange={(e) => setPurchaseEntry({...purchaseEntry, quantity: parseFloat(e.target.value)})}
                data-testid="purchase-quantity-input"
                className="font-mono"
              />
            </div>
            <div>
              <Label>Date *</Label>
              <Input 
                type="date" 
                value={purchaseEntry.date} 
                onChange={(e) => setPurchaseEntry({...purchaseEntry, date: e.target.value})}
                data-testid="purchase-date-input"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Input 
                value={purchaseEntry.notes} 
                onChange={(e) => setPurchaseEntry({...purchaseEntry, notes: e.target.value})}
                data-testid="purchase-notes-input"
              />
            </div>
            <Button onClick={handleAddPurchase} data-testid="submit-purchase-btn" className="w-full uppercase text-xs tracking-wide">
              Add Purchase
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RawMaterials;
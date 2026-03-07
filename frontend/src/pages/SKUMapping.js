import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Plus, Trash2, Upload, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SKUMapping = () => {
  const [skus, setSkus] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [showDialog, setShowDialog] = useState(false);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    sku_id: "",
    rm_mappings: [{ rm_id: "", quantity_required: 0 }]
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [skusRes, rmRes, mappingsRes] = await Promise.all([
        axios.get(`${API}/skus`),
        axios.get(`${API}/raw-materials`),
        axios.get(`${API}/sku-mappings`)
      ]);
      setSkus(skusRes.data);
      setRawMaterials(rmRes.data);
      setMappings(mappingsRes.data);
    } catch (error) {
      toast.error("Failed to fetch data");
    }
  };

  const addRMMapping = () => {
    setFormData({
      ...formData,
      rm_mappings: [...formData.rm_mappings, { rm_id: "", quantity_required: 0 }]
    });
  };

  const removeRMMapping = (index) => {
    const newMappings = formData.rm_mappings.filter((_, i) => i !== index);
    setFormData({ ...formData, rm_mappings: newMappings });
  };

  const updateRMMapping = (index, field, value) => {
    const newMappings = [...formData.rm_mappings];
    newMappings[index][field] = value;
    setFormData({ ...formData, rm_mappings: newMappings });
  };

  const handleSubmit = async () => {
    if (!formData.sku_id) {
      toast.error("Please select a SKU");
      return;
    }
    if (formData.rm_mappings.some(m => !m.rm_id || m.quantity_required <= 0)) {
      toast.error("Please fill all RM mappings with valid quantities");
      return;
    }

    try {
      await axios.post(`${API}/sku-mappings`, formData);
      toast.success("Mapping saved");
      setShowDialog(false);
      setFormData({ sku_id: "", rm_mappings: [{ rm_id: "", quantity_required: 0 }] });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save mapping");
    }
  };

  const loadExistingMapping = async (sku_id) => {
    try {
      const response = await axios.get(`${API}/sku-mappings/${sku_id}`);
      setFormData({
        sku_id: response.data.sku_id,
        rm_mappings: response.data.rm_mappings
      });
      setShowDialog(true);
    } catch (error) {
      // No existing mapping, start fresh
      setFormData({
        sku_id: sku_id,
        rm_mappings: [{ rm_id: "", quantity_required: 0 }]
      });
      setShowDialog(true);
    }
  };

  const getSKUName = (sku_id) => {
    const sku = skus.find(s => s.sku_id === sku_id);
    return sku ? sku.name : sku_id;
  };

  const getRMName = (rm_id) => {
    const rm = rawMaterials.find(r => r.rm_id === rm_id);
    return rm ? `${rm.name} (${rm.unit})` : rm_id;
  };

  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API}/sku-mappings/bulk-upload`, formData);
      toast.success(`Uploaded: ${response.data.created} created, ${response.data.updated} updated`);
      if (response.data.errors.length > 0) {
        console.error('Upload errors:', response.data.errors);
        toast.warning(`${response.data.errors.length} rows had errors. Check console.`);
      }
      fetchData();
    } catch (error) {
      toast.error("Upload failed");
    }
    e.target.value = null;
  };

  const downloadTemplate = () => {
    const template = [
      { SKU_ID: 'SKU001', RM_ID: 'INP_001', Qty: 2 },
      { SKU_ID: 'SKU001', RM_ID: 'ACC_001', Qty: 1 },
      { SKU_ID: 'SKU002', RM_ID: 'INP_001', Qty: 3 }
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'sku_mapping_template.xlsx');
  };

  const exportMappings = () => {
    const data = [];
    mappings.forEach(mapping => {
      mapping.rm_mappings.forEach(rm => {
        data.push({
          SKU_ID: mapping.sku_id,
          RM_ID: rm.rm_id,
          Qty: rm.quantity_required
        });
      });
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mappings');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'sku_mappings.xlsx');
    toast.success("Mappings exported");
  };

  const exportUnmappedSKUs = async () => {
    try {
      const response = await axios.get(`${API}/skus/unmapped`);
      const unmappedSKUs = response.data.skus;
      
      if (unmappedSKUs.length === 0) {
        toast.info("All SKUs have RM mappings!");
        return;
      }
      
      const data = unmappedSKUs.map(s => ({
        'SKU ID': s.sku_id,
        'Buyer SKU ID': s.buyer_sku_id || '',
        'Bidso SKU': s.bidso_sku || '',
        'Description': s.description || '',
        'Brand': s.brand || '',
        'Model': s.model || ''
      }));
      
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Unmapped SKUs');
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'skus_without_rm_mapping.xlsx');
      toast.success(`Exported ${unmappedSKUs.length} SKUs without RM mapping`);
    } catch (error) {
      toast.error("Failed to export unmapped SKUs");
    }
  };

  return (
    <div className="p-6 md:p-8" data-testid="sku-mapping-page">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight uppercase">RM-SKU Mapping</h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">Define bill of materials • {mappings.length} SKUs mapped</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={exportUnmappedSKUs}
            data-testid="export-unmapped-btn"
            className="uppercase text-xs tracking-wide text-orange-600 border-orange-300 hover:bg-orange-50"
          >
            <Download className="w-4 h-4 mr-2" strokeWidth={1.5} />
            Export Unmapped
          </Button>
          <Button 
            variant="secondary" 
            onClick={exportMappings}
            data-testid="export-mappings-btn"
            className="uppercase text-xs tracking-wide"
          >
            <Download className="w-4 h-4 mr-2" strokeWidth={1.5} />
            Export
          </Button>
          <Button 
            variant="secondary" 
            onClick={downloadTemplate}
            data-testid="download-mapping-template-btn"
            className="uppercase text-xs tracking-wide"
          >
            Template
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
            data-testid="bulk-upload-mapping-btn"
            className="uppercase text-xs tracking-wide"
          >
            <Upload className="w-4 h-4 mr-2" strokeWidth={1.5} />
            Bulk Upload
          </Button>
          <Dialog open={showDialog} onOpenChange={(open) => {
            setShowDialog(open);
            if (!open) setFormData({ sku_id: "", rm_mappings: [{ rm_id: "", quantity_required: 0 }] });
          }}>
            <DialogTrigger asChild>
              <Button data-testid="create-mapping-btn" className="uppercase text-xs tracking-wide">
                <Plus className="w-4 h-4 mr-2" strokeWidth={1.5} />
                Create Mapping
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-bold uppercase">SKU to RM Mapping</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>SKU *</Label>
                <select 
                  className="flex h-10 w-full rounded-sm border border-input bg-transparent px-3 py-2 text-sm font-mono"
                  value={formData.sku_id}
                  onChange={(e) => setFormData({...formData, sku_id: e.target.value})}
                  data-testid="mapping-sku-select"
                >
                  <option value="">Select SKU</option>
                  {skus.map(s => (
                    <option key={s.sku_id} value={s.sku_id}>{s.sku_id} - {s.name}</option>
                  ))}
                </select>
              </div>

              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between mb-4">
                  <Label className="text-base">Raw Material Requirements</Label>
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={addRMMapping}
                    data-testid="add-rm-mapping-btn"
                    className="uppercase text-xs tracking-wide"
                  >
                    <Plus className="w-3 h-3 mr-1" strokeWidth={1.5} />
                    Add RM
                  </Button>
                </div>

                {formData.rm_mappings.map((mapping, index) => (
                  <div key={index} className="flex gap-3 mb-3 items-end" data-testid={`rm-mapping-${index}`}>
                    <div className="flex-1">
                      <Label className="text-xs">Raw Material</Label>
                      <select 
                        className="flex h-10 w-full rounded-sm border border-input bg-transparent px-3 py-2 text-sm font-mono"
                        value={mapping.rm_id}
                        onChange={(e) => updateRMMapping(index, 'rm_id', e.target.value)}
                        data-testid={`rm-select-${index}`}
                      >
                        <option value="">Select RM</option>
                        {rawMaterials.map(rm => (
                          <option key={rm.rm_id} value={rm.rm_id}>{rm.rm_id} - {rm.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="w-32">
                      <Label className="text-xs">Quantity</Label>
                      <Input 
                        type="number" 
                        step="0.01"
                        value={mapping.quantity_required} 
                        onChange={(e) => updateRMMapping(index, 'quantity_required', parseFloat(e.target.value))}
                        data-testid={`rm-quantity-${index}`}
                        className="font-mono"
                      />
                    </div>
                    {formData.rm_mappings.length > 1 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => removeRMMapping(index)}
                        data-testid={`remove-rm-${index}`}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" strokeWidth={1.5} />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <Button onClick={handleSubmit} data-testid="submit-mapping-btn" className="w-full uppercase text-xs tracking-wide">
                Save Mapping
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Mappings List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {mappings.map((mapping) => (
          <div key={mapping.id} className="border border-border bg-white rounded-sm" data-testid={`mapping-card-${mapping.sku_id}`}>
            <div className="p-6 border-b border-border bg-zinc-50">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1">SKU</div>
                  <div className="font-mono text-lg font-bold text-zinc-700">{mapping.sku_id}</div>
                  <div className="text-sm text-zinc-600 mt-1">{getSKUName(mapping.sku_id)}</div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => loadExistingMapping(mapping.sku_id)}
                  data-testid={`edit-mapping-${mapping.sku_id}`}
                >
                  Edit
                </Button>
              </div>
            </div>
            <div className="p-6">
              <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-3">Required Materials</div>
              <div className="space-y-3">
                {mapping.rm_mappings.map((rm, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2 border-b border-zinc-100 last:border-0">
                    <div>
                      <div className="font-mono text-sm text-zinc-700">{rm.rm_id}</div>
                      <div className="text-xs text-zinc-500">{getRMName(rm.rm_id)}</div>
                    </div>
                    <div className="font-mono text-sm font-bold text-primary">{rm.quantity_required}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {mappings.length === 0 && (
        <div className="border border-border bg-white rounded-sm p-12 text-center">
          <div className="text-muted-foreground font-mono text-sm mb-4">
            No mappings created yet. Define how much raw material is needed for each SKU.
          </div>
        </div>
      )}
    </div>
  );
};

export default SKUMapping;
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Plus, Settings, Package, Link, Layers, Pencil, Trash2, Users, Upload, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const TechOps = () => {
  const [activeTab, setActiveTab] = useState("verticals");
  
  // Master Data
  const [verticals, setVerticals] = useState([]);
  const [models, setModels] = useState([]);
  const [brands, setBrands] = useState([]);
  const [buyers, setBuyers] = useState([]);
  
  // Dialogs
  const [showVerticalDialog, setShowVerticalDialog] = useState(false);
  const [showModelDialog, setShowModelDialog] = useState(false);
  const [showBrandDialog, setShowBrandDialog] = useState(false);
  const [showBuyerDialog, setShowBuyerDialog] = useState(false);
  
  // Edit mode
  const [editingItem, setEditingItem] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  
  // Form Data
  const [verticalForm, setVerticalForm] = useState({ code: "", name: "", description: "" });
  const [modelForm, setModelForm] = useState({ vertical_id: "", code: "", name: "", description: "" });
  const [brandForm, setBrandForm] = useState({ code: "", name: "" });
  const [buyerForm, setBuyerForm] = useState({ name: "", gst: "", email: "", phone_no: "", poc_name: "" });
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      const [verticalsRes, modelsRes, brandsRes, buyersRes] = await Promise.all([
        axios.get(`${API}/verticals`),
        axios.get(`${API}/models`),
        axios.get(`${API}/brands`),
        axios.get(`${API}/buyers`)
      ]);
      setVerticals(verticalsRes.data.filter(v => v.status === 'ACTIVE'));
      setModels(modelsRes.data.filter(m => m.status === 'ACTIVE'));
      setBrands(brandsRes.data.filter(b => b.status === 'ACTIVE'));
      setBuyers(buyersRes.data.filter(b => b.status === 'ACTIVE'));
    } catch (error) {
      toast.error("Failed to fetch data");
    }
  };

  // Vertical CRUD
  const handleCreateVertical = async () => {
    try {
      if (editingItem) {
        await axios.put(`${API}/verticals/${editingItem.id}`, verticalForm);
        toast.success("Vertical updated");
      } else {
        await axios.post(`${API}/verticals`, verticalForm);
        toast.success("Vertical created");
      }
      setShowVerticalDialog(false);
      setVerticalForm({ code: "", name: "", description: "" });
      setEditingItem(null);
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save vertical");
    }
  };

  const handleEditVertical = (v) => {
    setVerticalForm({ code: v.code, name: v.name, description: v.description || "" });
    setEditingItem(v);
    setShowVerticalDialog(true);
  };

  const handleDeleteVertical = async (id) => {
    try {
      await axios.delete(`${API}/verticals/${id}`);
      toast.success("Vertical deleted");
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete vertical");
    }
    setDeleteConfirm(null);
  };

  // Model CRUD
  const handleCreateModel = async () => {
    try {
      if (editingItem) {
        await axios.put(`${API}/models/${editingItem.id}`, modelForm);
        toast.success("Model updated");
      } else {
        await axios.post(`${API}/models`, modelForm);
        toast.success("Model created");
      }
      setShowModelDialog(false);
      setModelForm({ vertical_id: "", code: "", name: "", description: "" });
      setEditingItem(null);
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save model");
    }
  };

  const handleEditModel = (m) => {
    setModelForm({ vertical_id: m.vertical_id, code: m.code, name: m.name, description: m.description || "" });
    setEditingItem(m);
    setShowModelDialog(true);
  };

  const handleDeleteModel = async (id) => {
    try {
      await axios.delete(`${API}/models/${id}`);
      toast.success("Model deleted");
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete model");
    }
    setDeleteConfirm(null);
  };

  // Brand CRUD
  const handleCreateBrand = async () => {
    try {
      if (editingItem) {
        await axios.put(`${API}/brands/${editingItem.id}`, brandForm);
        toast.success("Brand updated");
      } else {
        await axios.post(`${API}/brands`, brandForm);
        toast.success("Brand created");
      }
      setShowBrandDialog(false);
      setBrandForm({ code: "", name: "" });
      setEditingItem(null);
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save brand");
    }
  };

  const handleEditBrand = (b) => {
    setBrandForm({ code: b.code, name: b.name });
    setEditingItem(b);
    setShowBrandDialog(true);
  };

  const handleDeleteBrand = async (id) => {
    try {
      await axios.delete(`${API}/brands/${id}`);
      toast.success("Brand deleted");
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete brand");
    }
    setDeleteConfirm(null);
  };

  // Buyer CRUD
  const handleCreateBuyer = async () => {
    try {
      if (editingItem) {
        await axios.put(`${API}/buyers/${editingItem.id}`, buyerForm);
        toast.success("Buyer updated");
      } else {
        await axios.post(`${API}/buyers`, buyerForm);
        toast.success("Buyer created");
      }
      setShowBuyerDialog(false);
      setBuyerForm({ code: "", name: "", country: "", contact_email: "", payment_terms_days: 30 });
      setEditingItem(null);
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save buyer");
    }
  };

  const handleEditBuyer = (b) => {
    setBuyerForm({ code: b.code, name: b.name, country: b.country || "", contact_email: b.contact_email || "", payment_terms_days: b.payment_terms_days || 30 });
    setEditingItem(b);
    setShowBuyerDialog(true);
  };

  const handleDeleteBuyer = async (id) => {
    try {
      await axios.delete(`${API}/buyers/${id}`);
      toast.success("Buyer deleted");
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete buyer");
    }
    setDeleteConfirm(null);
  };

  const getVerticalName = (id) => verticals.find(v => v.id === id)?.name || id;
  const getBuyerName = (id) => buyers.find(b => b.id === id)?.name || id;

  const openAddDialog = (type) => {
    setEditingItem(null);
    if (type === 'vertical') {
      setVerticalForm({ code: "", name: "", description: "" });
      setShowVerticalDialog(true);
    } else if (type === 'model') {
      setModelForm({ vertical_id: "", code: "", name: "", description: "" });
      setShowModelDialog(true);
    } else if (type === 'brand') {
      setBrandForm({ code: "", name: "" });
      setShowBrandDialog(true);
    } else if (type === 'buyer') {
      setBuyerForm({ code: "", name: "", country: "", contact_email: "", payment_terms_days: 30 });
      setShowBuyerDialog(true);
    }
  };

  return (
    <div className="p-6 md:p-8" data-testid="tech-ops-page">
      <div className="mb-8">
        <h1 className="text-4xl font-black tracking-tight uppercase">Tech Ops</h1>
        <p className="text-sm text-muted-foreground mt-1 font-mono">Master Data Management</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="verticals" className="uppercase text-xs tracking-wide">
            <Layers className="w-4 h-4 mr-2" />
            Verticals ({verticals.length})
          </TabsTrigger>
          <TabsTrigger value="models" className="uppercase text-xs tracking-wide">
            <Package className="w-4 h-4 mr-2" />
            Models ({models.length})
          </TabsTrigger>
          <TabsTrigger value="brands" className="uppercase text-xs tracking-wide">
            <Settings className="w-4 h-4 mr-2" />
            Brands ({brands.length})
          </TabsTrigger>
          <TabsTrigger value="buyers" className="uppercase text-xs tracking-wide">
            <Users className="w-4 h-4 mr-2" />
            Buyers ({buyers.length})
          </TabsTrigger>
        </TabsList>

        {/* Verticals Tab */}
        <TabsContent value="verticals">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold">Product Verticals</h2>
            <Button onClick={() => openAddDialog('vertical')} className="uppercase text-xs tracking-wide" data-testid="add-vertical-btn">
              <Plus className="w-4 h-4 mr-2" />
              Add Vertical
            </Button>
          </div>
          
          <div className="border rounded-sm">
            <table className="w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Code</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Name</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Description</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Models</th>
                  <th className="h-10 px-4 text-right font-mono text-xs uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {verticals.map((v) => (
                  <tr key={v.id} className="border-t">
                    <td className="p-4 font-mono font-bold">{v.code}</td>
                    <td className="p-4">{v.name}</td>
                    <td className="p-4 text-sm text-muted-foreground">{v.description}</td>
                    <td className="p-4 font-mono">{models.filter(m => m.vertical_id === v.id).length}</td>
                    <td className="p-4 text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleEditVertical(v)} data-testid={`edit-vertical-${v.code}`}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm({ type: 'vertical', id: v.id, name: v.name })} data-testid={`delete-vertical-${v.code}`}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {verticals.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No verticals defined</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Models Tab */}
        <TabsContent value="models">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold">Product Models</h2>
            <Button onClick={() => openAddDialog('model')} className="uppercase text-xs tracking-wide" data-testid="add-model-btn">
              <Plus className="w-4 h-4 mr-2" />
              Add Model
            </Button>
          </div>
          
          <div className="border rounded-sm">
            <table className="w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Vertical</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Code</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Name</th>
                  <th className="h-10 px-4 text-right font-mono text-xs uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {models.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="p-4 text-sm">{getVerticalName(m.vertical_id)}</td>
                    <td className="p-4 font-mono font-bold">{m.code}</td>
                    <td className="p-4">{m.name}</td>
                    <td className="p-4 text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleEditModel(m)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm({ type: 'model', id: m.id, name: m.name })}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {models.length === 0 && (
                  <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No models defined</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Brands Tab */}
        <TabsContent value="brands">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold">Brands</h2>
            <Button onClick={() => openAddDialog('brand')} className="uppercase text-xs tracking-wide" data-testid="add-brand-btn">
              <Plus className="w-4 h-4 mr-2" />
              Add Brand
            </Button>
          </div>
          
          <div className="border rounded-sm">
            <table className="w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Code</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Brand Name</th>
                  <th className="h-10 px-4 text-right font-mono text-xs uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {brands.map((b) => (
                  <tr key={b.id} className="border-t">
                    <td className="p-4 font-mono font-bold">{b.code}</td>
                    <td className="p-4">{b.name}</td>
                    <td className="p-4 text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleEditBrand(b)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm({ type: 'brand', id: b.id, name: b.name })}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {brands.length === 0 && (
                  <tr><td colSpan={3} className="p-8 text-center text-muted-foreground">No brands defined</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Buyers Tab */}
        <TabsContent value="buyers">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold">Buyers</h2>
            <Button onClick={() => openAddDialog('buyer')} className="uppercase text-xs tracking-wide" data-testid="add-buyer-btn">
              <Plus className="w-4 h-4 mr-2" />
              Add Buyer
            </Button>
          </div>
          
          <div className="border rounded-sm">
            <table className="w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Code</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Name</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Country</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Email</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Brands</th>
                  <th className="h-10 px-4 text-right font-mono text-xs uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {buyers.map((b) => (
                  <tr key={b.id} className="border-t">
                    <td className="p-4 font-mono font-bold">{b.code}</td>
                    <td className="p-4">{b.name}</td>
                    <td className="p-4 text-sm">{b.country || '-'}</td>
                    <td className="p-4 text-sm">{b.contact_email || '-'}</td>
                    <td className="p-4 font-mono">{brands.filter(br => br.buyer_id === b.id).length}</td>
                    <td className="p-4 text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleEditBuyer(b)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm({ type: 'buyer', id: b.id, name: b.name })}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {buyers.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No buyers defined</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Vertical Dialog */}
      <Dialog open={showVerticalDialog} onOpenChange={(open) => { setShowVerticalDialog(open); if (!open) setEditingItem(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Vertical' : 'Create Vertical'}</DialogTitle>
            <DialogDescription>Product category grouping (e.g., Scooter, Trike, Walker)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Code</Label>
              <Input 
                value={verticalForm.code}
                onChange={(e) => setVerticalForm({...verticalForm, code: e.target.value})}
                placeholder="e.g., SCOOTER"
                className="font-mono uppercase"
              />
            </div>
            <div>
              <Label>Name</Label>
              <Input 
                value={verticalForm.name}
                onChange={(e) => setVerticalForm({...verticalForm, name: e.target.value})}
                placeholder="Display name"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input 
                value={verticalForm.description}
                onChange={(e) => setVerticalForm({...verticalForm, description: e.target.value})}
              />
            </div>
            <Button onClick={handleCreateVertical} className="w-full">{editingItem ? 'Update' : 'Create'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Model Dialog */}
      <Dialog open={showModelDialog} onOpenChange={(open) => { setShowModelDialog(open); if (!open) setEditingItem(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Model' : 'Create Model'}</DialogTitle>
            <DialogDescription>Product model under a vertical (e.g., Blaze, Astro)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Vertical</Label>
              <Select value={modelForm.vertical_id} onValueChange={(v) => setModelForm({...modelForm, vertical_id: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select vertical" />
                </SelectTrigger>
                <SelectContent>
                  {verticals.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Code</Label>
              <Input 
                value={modelForm.code}
                onChange={(e) => setModelForm({...modelForm, code: e.target.value})}
                placeholder="e.g., BLAZE"
                className="font-mono uppercase"
              />
            </div>
            <div>
              <Label>Name</Label>
              <Input 
                value={modelForm.name}
                onChange={(e) => setModelForm({...modelForm, name: e.target.value})}
              />
            </div>
            <Button onClick={handleCreateModel} className="w-full">{editingItem ? 'Update' : 'Create'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Brand Dialog */}
      <Dialog open={showBrandDialog} onOpenChange={(open) => { setShowBrandDialog(open); if (!open) setEditingItem(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Brand' : 'Create Brand'}</DialogTitle>
            <DialogDescription>Brand definition (Code + Name)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Code</Label>
              <Input 
                value={brandForm.code}
                onChange={(e) => setBrandForm({...brandForm, code: e.target.value.toUpperCase()})}
                placeholder="e.g., FC"
                className="font-mono uppercase"
                maxLength={10}
              />
            </div>
            <div>
              <Label>Brand Name</Label>
              <Input 
                value={brandForm.name}
                onChange={(e) => setBrandForm({...brandForm, name: e.target.value})}
                placeholder="e.g., Firstcry"
              />
            </div>
            <Button onClick={handleCreateBrand} className="w-full">{editingItem ? 'Update' : 'Create'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Buyer Dialog */}
      <Dialog open={showBuyerDialog} onOpenChange={(open) => { setShowBuyerDialog(open); if (!open) setEditingItem(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Buyer' : 'Create Buyer'}</DialogTitle>
            <DialogDescription>Customer/Buyer information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Code</Label>
              <Input 
                value={buyerForm.code}
                onChange={(e) => setBuyerForm({...buyerForm, code: e.target.value})}
                placeholder="e.g., BUYER_001"
                className="font-mono uppercase"
              />
            </div>
            <div>
              <Label>Name</Label>
              <Input 
                value={buyerForm.name}
                onChange={(e) => setBuyerForm({...buyerForm, name: e.target.value})}
              />
            </div>
            <div>
              <Label>Country</Label>
              <Input 
                value={buyerForm.country}
                onChange={(e) => setBuyerForm({...buyerForm, country: e.target.value})}
              />
            </div>
            <div>
              <Label>Contact Email</Label>
              <Input 
                value={buyerForm.contact_email}
                onChange={(e) => setBuyerForm({...buyerForm, contact_email: e.target.value})}
                type="email"
              />
            </div>
            <Button onClick={handleCreateBuyer} className="w-full">{editingItem ? 'Update' : 'Create'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteConfirm?.type}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.name}"? This action cannot be undone if there are no dependencies.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (deleteConfirm?.type === 'vertical') handleDeleteVertical(deleteConfirm.id);
                else if (deleteConfirm?.type === 'model') handleDeleteModel(deleteConfirm.id);
                else if (deleteConfirm?.type === 'brand') handleDeleteBrand(deleteConfirm.id);
                else if (deleteConfirm?.type === 'buyer') handleDeleteBuyer(deleteConfirm.id);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TechOps;

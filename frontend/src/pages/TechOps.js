import { useState, useEffect } from "react";
import axios from "axios";
import { Plus, Settings, Package, Link, Layers, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  
  // Form Data
  const [verticalForm, setVerticalForm] = useState({ code: "", name: "", description: "" });
  const [modelForm, setModelForm] = useState({ vertical_id: "", code: "", name: "", description: "" });
  const [brandForm, setBrandForm] = useState({ code: "", name: "", buyer_id: "" });
  const [buyerForm, setBuyerForm] = useState({ code: "", name: "", country: "", contact_email: "" });

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
      setVerticals(verticalsRes.data);
      setModels(modelsRes.data);
      setBrands(brandsRes.data);
      setBuyers(buyersRes.data);
    } catch (error) {
      toast.error("Failed to fetch data");
    }
  };

  const handleCreateVertical = async () => {
    try {
      await axios.post(`${API}/verticals`, verticalForm);
      toast.success("Vertical created");
      setShowVerticalDialog(false);
      setVerticalForm({ code: "", name: "", description: "" });
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create vertical");
    }
  };

  const handleCreateModel = async () => {
    try {
      await axios.post(`${API}/models`, modelForm);
      toast.success("Model created");
      setShowModelDialog(false);
      setModelForm({ vertical_id: "", code: "", name: "", description: "" });
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create model");
    }
  };

  const handleCreateBrand = async () => {
    try {
      await axios.post(`${API}/brands`, brandForm);
      toast.success("Brand created");
      setShowBrandDialog(false);
      setBrandForm({ code: "", name: "", buyer_id: "" });
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create brand");
    }
  };

  const handleCreateBuyer = async () => {
    try {
      await axios.post(`${API}/buyers`, buyerForm);
      toast.success("Buyer created");
      setShowBuyerDialog(false);
      setBuyerForm({ code: "", name: "", country: "", contact_email: "" });
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create buyer");
    }
  };

  const getVerticalName = (id) => verticals.find(v => v.id === id)?.name || id;
  const getBuyerName = (id) => buyers.find(b => b.id === id)?.name || id;

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
            Verticals
          </TabsTrigger>
          <TabsTrigger value="models" className="uppercase text-xs tracking-wide">
            <Package className="w-4 h-4 mr-2" />
            Models
          </TabsTrigger>
          <TabsTrigger value="brands" className="uppercase text-xs tracking-wide">
            <Settings className="w-4 h-4 mr-2" />
            Brands
          </TabsTrigger>
          <TabsTrigger value="buyers" className="uppercase text-xs tracking-wide">
            <Link className="w-4 h-4 mr-2" />
            Buyers
          </TabsTrigger>
        </TabsList>

        {/* Verticals Tab */}
        <TabsContent value="verticals">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold">Product Verticals</h2>
            <Dialog open={showVerticalDialog} onOpenChange={setShowVerticalDialog}>
              <DialogTrigger asChild>
                <Button className="uppercase text-xs tracking-wide" data-testid="add-vertical-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Vertical
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Vertical</DialogTitle>
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
                  <Button onClick={handleCreateVertical} className="w-full">Create</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          
          <div className="border rounded-sm">
            <table className="w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Code</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Name</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Description</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {verticals.map((v) => (
                  <tr key={v.id} className="border-t">
                    <td className="p-4 font-mono font-bold">{v.code}</td>
                    <td className="p-4">{v.name}</td>
                    <td className="p-4 text-sm text-muted-foreground">{v.description}</td>
                    <td className="p-4">
                      <span className={`text-xs font-mono px-2 py-1 rounded ${v.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-zinc-100'}`}>
                        {v.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {verticals.length === 0 && (
                  <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No verticals defined</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Models Tab */}
        <TabsContent value="models">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold">Product Models</h2>
            <Dialog open={showModelDialog} onOpenChange={setShowModelDialog}>
              <DialogTrigger asChild>
                <Button className="uppercase text-xs tracking-wide" data-testid="add-model-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Model
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Model</DialogTitle>
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
                  <Button onClick={handleCreateModel} className="w-full">Create</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          
          <div className="border rounded-sm">
            <table className="w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Vertical</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Code</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Name</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {models.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="p-4 text-sm">{getVerticalName(m.vertical_id)}</td>
                    <td className="p-4 font-mono font-bold">{m.code}</td>
                    <td className="p-4">{m.name}</td>
                    <td className="p-4">
                      <span className={`text-xs font-mono px-2 py-1 rounded ${m.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-zinc-100'}`}>
                        {m.status}
                      </span>
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
            <Dialog open={showBrandDialog} onOpenChange={setShowBrandDialog}>
              <DialogTrigger asChild>
                <Button className="uppercase text-xs tracking-wide" data-testid="add-brand-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Brand
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Brand</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Code</Label>
                    <Input 
                      value={brandForm.code}
                      onChange={(e) => setBrandForm({...brandForm, code: e.target.value})}
                      placeholder="e.g., FEBER"
                      className="font-mono uppercase"
                    />
                  </div>
                  <div>
                    <Label>Name</Label>
                    <Input 
                      value={brandForm.name}
                      onChange={(e) => setBrandForm({...brandForm, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label>Buyer (Optional)</Label>
                    <Select value={brandForm.buyer_id} onValueChange={(v) => setBrandForm({...brandForm, buyer_id: v})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select buyer" />
                      </SelectTrigger>
                      <SelectContent>
                        {buyers.map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleCreateBrand} className="w-full">Create</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          
          <div className="border rounded-sm">
            <table className="w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Code</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Name</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Buyer</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {brands.map((b) => (
                  <tr key={b.id} className="border-t">
                    <td className="p-4 font-mono font-bold">{b.code}</td>
                    <td className="p-4">{b.name}</td>
                    <td className="p-4 text-sm">{b.buyer_id ? getBuyerName(b.buyer_id) : '-'}</td>
                    <td className="p-4">
                      <span className={`text-xs font-mono px-2 py-1 rounded ${b.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-zinc-100'}`}>
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {brands.length === 0 && (
                  <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No brands defined</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Buyers Tab */}
        <TabsContent value="buyers">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold">Buyers</h2>
            <Dialog open={showBuyerDialog} onOpenChange={setShowBuyerDialog}>
              <DialogTrigger asChild>
                <Button className="uppercase text-xs tracking-wide" data-testid="add-buyer-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Buyer
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Buyer</DialogTitle>
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
                  <Button onClick={handleCreateBuyer} className="w-full">Create</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          
          <div className="border rounded-sm">
            <table className="w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Code</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Name</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Country</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Email</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {buyers.map((b) => (
                  <tr key={b.id} className="border-t">
                    <td className="p-4 font-mono font-bold">{b.code}</td>
                    <td className="p-4">{b.name}</td>
                    <td className="p-4 text-sm">{b.country || '-'}</td>
                    <td className="p-4 text-sm">{b.contact_email || '-'}</td>
                    <td className="p-4">
                      <span className={`text-xs font-mono px-2 py-1 rounded ${b.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-zinc-100'}`}>
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {buyers.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No buyers defined</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TechOps;

import { useState, useEffect } from "react";
import axios from "axios";
import useAuthStore from "@/store/authStore";
import { 
  Package, Plus, Search, Clock, CheckCircle, XCircle, 
  Tag, Box, FileText, ChevronRight, AlertCircle, Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DemandHub = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState("buyer-sku");
  
  // Data
  const [summary, setSummary] = useState({ total_pending: 0, total_approved: 0 });
  const [myRequests, setMyRequests] = useState([]);
  const [bidsoSkus, setBidsoSkus] = useState([]);
  const [brands, setBrands] = useState([]);
  const [verticals, setVerticals] = useState([]);
  const [models, setModels] = useState([]);
  const [rmCategories, setRmCategories] = useState([]);
  
  // Loading
  const [loading, setLoading] = useState(false);
  
  // Filters for Bidso SKU lookup
  const [skuFilters, setSkuFilters] = useState({
    vertical_id: "",
    model_id: "",
    search: ""
  });
  
  // Selected Bidso SKU for Buyer SKU request
  const [selectedBidso, setSelectedBidso] = useState(null);
  const [existingBuyerSkus, setExistingBuyerSkus] = useState({ existing: [], pending_requests: [] });
  
  // Buyer SKU Request Form
  const [buyerSkuForm, setBuyerSkuForm] = useState({
    bidso_sku_id: "",
    brand_id: "",
    notes: ""
  });
  
  // RM Request Form
  const [rmForm, setRmForm] = useState({
    category: "LB",
    requested_name: "",
    description: "",
    brand_ids: [],
    buyer_sku_id: ""
  });
  
  // Dialogs
  const [showBuyerSkuDialog, setShowBuyerSkuDialog] = useState(false);
  const [showRmDialog, setShowRmDialog] = useState(false);

  useEffect(() => {
    fetchMasterData();
    fetchSummary();
    fetchMyRequests();
  }, []);

  useEffect(() => {
    if (activeTab === "buyer-sku") {
      fetchBidsoSkus();
    }
  }, [activeTab, skuFilters]);

  const fetchMasterData = async () => {
    try {
      const [brandsRes, verticalsRes, modelsRes, categoriesRes] = await Promise.all([
        axios.get(`${API}/brands`),
        axios.get(`${API}/verticals`),
        axios.get(`${API}/models`),
        axios.get(`${API}/demand-hub/rm-categories`)
      ]);
      setBrands(brandsRes.data.filter(b => b.status === 'ACTIVE'));
      setVerticals(verticalsRes.data.filter(v => v.status === 'ACTIVE'));
      setModels(modelsRes.data.filter(m => m.status === 'ACTIVE'));
      setRmCategories(categoriesRes.data);
    } catch (error) {
      console.error("Failed to fetch master data");
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await axios.get(`${API}/demand-hub/my-requests/summary`);
      setSummary(res.data);
    } catch (error) {
      console.error("Failed to fetch summary");
    }
  };

  const fetchMyRequests = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/demand-hub/my-requests`);
      setMyRequests(res.data);
    } catch (error) {
      toast.error("Failed to fetch requests");
    } finally {
      setLoading(false);
    }
  };

  const fetchBidsoSkus = async () => {
    try {
      let url = `${API}/demand-hub/bidso-skus?`;
      if (skuFilters.vertical_id) url += `vertical_id=${skuFilters.vertical_id}&`;
      if (skuFilters.model_id) url += `model_id=${skuFilters.model_id}&`;
      if (skuFilters.search) url += `search=${encodeURIComponent(skuFilters.search)}&`;
      
      const res = await axios.get(url);
      setBidsoSkus(res.data);
    } catch (error) {
      console.error("Failed to fetch Bidso SKUs");
    }
  };

  const handleSelectBidsoSku = async (sku) => {
    setSelectedBidso(sku);
    setBuyerSkuForm({ ...buyerSkuForm, bidso_sku_id: sku.bidso_sku_id });
    
    // Fetch existing Buyer SKUs for this Bidso SKU
    try {
      const res = await axios.get(`${API}/demand-hub/existing-buyer-skus/${sku.bidso_sku_id}`);
      setExistingBuyerSkus(res.data);
    } catch (error) {
      setExistingBuyerSkus({ existing: [], pending_requests: [] });
    }
  };

  const handleCreateBuyerSkuRequest = async () => {
    if (!buyerSkuForm.bidso_sku_id || !buyerSkuForm.brand_id) {
      toast.error("Please select a Bidso SKU and Brand");
      return;
    }
    
    try {
      const res = await axios.post(`${API}/demand-hub/buyer-sku-requests`, buyerSkuForm);
      toast.success(`Request created for ${res.data.buyer_sku_id}`);
      setShowBuyerSkuDialog(false);
      setBuyerSkuForm({ bidso_sku_id: "", brand_id: "", notes: "" });
      setSelectedBidso(null);
      fetchSummary();
      fetchMyRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create request");
    }
  };

  const handleCreateRmRequest = async () => {
    if (!rmForm.requested_name || rmForm.brand_ids.length === 0) {
      toast.error("Please enter a name and select at least one brand");
      return;
    }
    
    try {
      await axios.post(`${API}/rm-requests`, rmForm);
      toast.success("RM request created");
      setShowRmDialog(false);
      setRmForm({ category: "LB", requested_name: "", description: "", brand_ids: [], buyer_sku_id: "" });
      fetchSummary();
      fetchMyRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create request");
    }
  };

  const getFilteredModels = () => {
    if (!skuFilters.vertical_id) return models;
    return models.filter(m => m.vertical_id === skuFilters.vertical_id);
  };

  const getBrandName = (id) => brands.find(b => b.id === id)?.name || id;
  const getBrandCode = (id) => brands.find(b => b.id === id)?.code || "";

  // Check if brand already has a Buyer SKU or pending request
  const isBrandTaken = (brandId) => {
    const existing = existingBuyerSkus.existing.some(s => s.brand_id === brandId);
    const pending = existingBuyerSkus.pending_requests.some(r => r.brand_id === brandId);
    return existing || pending;
  };

  return (
    <div className="p-6 space-y-6" data-testid="demand-hub-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Demand Hub</h1>
          <p className="text-gray-500 mt-1">Request new Buyer SKUs and Raw Materials</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Pending Requests</p>
                <p className="text-2xl font-bold">{summary.total_pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Approved</p>
                <p className="text-2xl font-bold">{summary.total_approved}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Box className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">SKU Requests</p>
                <p className="text-2xl font-bold">{summary.buyer_sku_requests?.total || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Tag className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">RM Requests</p>
                <p className="text-2xl font-bold">{summary.rm_requests?.total || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="buyer-sku" data-testid="buyer-sku-tab">
            <Box className="h-4 w-4 mr-2" />
            Request Buyer SKU
          </TabsTrigger>
          <TabsTrigger value="rm-request" data-testid="rm-request-tab">
            <Tag className="h-4 w-4 mr-2" />
            Request RM
          </TabsTrigger>
          <TabsTrigger value="my-requests" data-testid="my-requests-tab">
            <FileText className="h-4 w-4 mr-2" />
            My Requests
            {summary.total_pending > 0 && (
              <Badge className="ml-2 bg-orange-500">{summary.total_pending}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Request Buyer SKU Tab */}
        <TabsContent value="buyer-sku" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Request New Buyer SKU</CardTitle>
              <CardDescription>
                Select a base product (Bidso SKU) and a brand to create a new branded variant.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-4 items-end">
                <div className="w-[200px]">
                  <Label className="text-xs text-gray-500">Vertical</Label>
                  <Select 
                    value={skuFilters.vertical_id} 
                    onValueChange={(v) => setSkuFilters({ ...skuFilters, vertical_id: v === "all" ? "" : v, model_id: "" })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Verticals" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Verticals</SelectItem>
                      {verticals.map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.code} - {v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="w-[200px]">
                  <Label className="text-xs text-gray-500">Model</Label>
                  <Select 
                    value={skuFilters.model_id} 
                    onValueChange={(v) => setSkuFilters({ ...skuFilters, model_id: v === "all" ? "" : v })}
                    disabled={!skuFilters.vertical_id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Models" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Models</SelectItem>
                      {getFilteredModels().map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.code} - {m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex-1 min-w-[200px]">
                  <Label className="text-xs text-gray-500">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search Bidso SKU..."
                      value={skuFilters.search}
                      onChange={(e) => setSkuFilters({ ...skuFilters, search: e.target.value })}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              {/* Bidso SKU Table */}
              <div className="border rounded-lg max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bidso SKU</TableHead>
                      <TableHead>Vertical</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bidsoSkus.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                          No Bidso SKUs found. Adjust filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      bidsoSkus.slice(0, 50).map(sku => (
                        <TableRow 
                          key={sku.bidso_sku_id} 
                          className={selectedBidso?.bidso_sku_id === sku.bidso_sku_id ? "bg-blue-50" : ""}
                        >
                          <TableCell>
                            <span className="font-mono font-medium">{sku.bidso_sku_id}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{sku.vertical?.code || "-"}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{sku.model?.code || "-"}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {sku.name || "-"}
                          </TableCell>
                          <TableCell>
                            <Button 
                              size="sm" 
                              variant={selectedBidso?.bidso_sku_id === sku.bidso_sku_id ? "default" : "outline"}
                              onClick={() => handleSelectBidsoSku(sku)}
                              data-testid={`select-bidso-${sku.bidso_sku_id}`}
                            >
                              {selectedBidso?.bidso_sku_id === sku.bidso_sku_id ? "Selected" : "Select"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Selected SKU Info */}
              {selectedBidso && (
                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold">Selected: {selectedBidso.bidso_sku_id}</h3>
                        <p className="text-sm text-gray-600">{selectedBidso.name}</p>
                        
                        {/* Existing Buyer SKUs */}
                        {existingBuyerSkus.existing.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs text-gray-500 font-medium">Existing Buyer SKUs:</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {existingBuyerSkus.existing.map(s => (
                                <Badge key={s.buyer_sku_id} variant="secondary">
                                  {s.buyer_sku_id}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Pending Requests */}
                        {existingBuyerSkus.pending_requests.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-gray-500 font-medium">Pending Requests:</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {existingBuyerSkus.pending_requests.map(r => (
                                <Badge key={r.buyer_sku_id} className="bg-orange-100 text-orange-700">
                                  {r.buyer_sku_id}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <Button onClick={() => setShowBuyerSkuDialog(true)} data-testid="open-buyer-sku-dialog">
                        <Plus className="h-4 w-4 mr-2" />
                        Request Buyer SKU
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Request RM Tab */}
        <TabsContent value="rm-request" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Request New Raw Material</CardTitle>
              <CardDescription>
                Request brand-specific raw materials like labels, packaging, or brand assets.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Category Cards */}
                {rmCategories.map(cat => (
                  <Card 
                    key={cat.code} 
                    className={`cursor-pointer transition-all hover:border-primary ${rmForm.category === cat.code ? 'border-primary bg-primary/5' : ''}`}
                    onClick={() => setRmForm({ ...rmForm, category: cat.code })}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${rmForm.category === cat.code ? 'bg-primary text-white' : 'bg-gray-100'}`}>
                          {cat.code === "LB" && <Tag className="h-5 w-5" />}
                          {cat.code === "PM" && <Package className="h-5 w-5" />}
                          {cat.code === "BS" && <Layers className="h-5 w-5" />}
                          {cat.code === "STK" && <FileText className="h-5 w-5" />}
                        </div>
                        <div>
                          <h3 className="font-semibold">{cat.name}</h3>
                          <p className="text-sm text-gray-500">{cat.description}</p>
                        </div>
                        {rmForm.category === cat.code && (
                          <CheckCircle className="h-5 w-5 text-primary ml-auto" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              <div className="mt-6 flex justify-end">
                <Button onClick={() => setShowRmDialog(true)} data-testid="open-rm-dialog">
                  <Plus className="h-4 w-4 mr-2" />
                  Create RM Request
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* My Requests Tab */}
        <TabsContent value="my-requests" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Request Details</TableHead>
                    <TableHead>Brands</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead>Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : myRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        No requests yet. Create your first request above.
                      </TableCell>
                    </TableRow>
                  ) : (
                    myRequests.map(req => (
                      <TableRow key={req.id} data-testid={`request-row-${req.id}`}>
                        <TableCell>
                          {req.type === "BUYER_SKU" ? (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700">
                              <Box className="h-3 w-3 mr-1" />
                              Buyer SKU
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-purple-50 text-purple-700">
                              <Tag className="h-3 w-3 mr-1" />
                              RM
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {req.type === "BUYER_SKU" ? (
                            <div>
                              <span className="font-mono font-medium">{req.buyer_sku_id}</span>
                              <p className="text-xs text-gray-500">Base: {req.bidso_sku_id}</p>
                            </div>
                          ) : (
                            <div>
                              <span className="font-medium">{req.requested_name}</span>
                              <p className="text-xs text-gray-500">{req.category}</p>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {req.type === "BUYER_SKU" ? (
                              <Badge variant="secondary">{req.brand_code}</Badge>
                            ) : (
                              req.brands?.map(b => (
                                <Badge key={b.code} variant="secondary">{b.code}</Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {req.status === "PENDING" && (
                            <Badge className="bg-orange-100 text-orange-700">
                              <Clock className="h-3 w-3 mr-1" />
                              Pending
                            </Badge>
                          )}
                          {req.status === "APPROVED" && (
                            <Badge className="bg-green-100 text-green-700">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Approved
                            </Badge>
                          )}
                          {req.status === "REJECTED" && (
                            <Badge className="bg-red-100 text-red-700">
                              <XCircle className="h-3 w-3 mr-1" />
                              Rejected
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {new Date(req.requested_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {req.status === "APPROVED" && (
                            <span className="font-mono text-xs text-green-600">
                              {req.type === "BUYER_SKU" ? req.buyer_sku_id : req.created_rm_id}
                            </span>
                          )}
                          {req.status === "REJECTED" && req.review_notes && (
                            <span className="text-xs text-gray-500" title={req.review_notes}>
                              {req.review_notes.substring(0, 30)}...
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Buyer SKU Request Dialog */}
      <Dialog open={showBuyerSkuDialog} onOpenChange={setShowBuyerSkuDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Buyer SKU</DialogTitle>
            <DialogDescription>
              Create a branded variant of {selectedBidso?.bidso_sku_id}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div>
              <Label>Base Product (Bidso SKU)</Label>
              <Input value={selectedBidso?.bidso_sku_id || ""} disabled className="font-mono" />
            </div>
            
            <div>
              <Label>Brand *</Label>
              <Select 
                value={buyerSkuForm.brand_id} 
                onValueChange={(v) => setBuyerSkuForm({ ...buyerSkuForm, brand_id: v })}
              >
                <SelectTrigger data-testid="buyer-sku-brand-select">
                  <SelectValue placeholder="Select brand" />
                </SelectTrigger>
                <SelectContent>
                  {brands.map(b => (
                    <SelectItem 
                      key={b.id} 
                      value={b.id}
                      disabled={isBrandTaken(b.id)}
                    >
                      {b.code} - {b.name}
                      {isBrandTaken(b.id) && " (Already exists)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {buyerSkuForm.brand_id && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium">Proposed Buyer SKU ID:</p>
                <p className="font-mono text-lg text-blue-700">
                  {getBrandCode(buyerSkuForm.brand_id)}_{selectedBidso?.bidso_sku_id}
                </p>
              </div>
            )}
            
            <div>
              <Label>Notes (Optional)</Label>
              <Textarea
                value={buyerSkuForm.notes}
                onChange={(e) => setBuyerSkuForm({ ...buyerSkuForm, notes: e.target.value })}
                placeholder="Any additional notes for Tech Ops..."
                rows={2}
              />
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowBuyerSkuDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateBuyerSkuRequest}
                disabled={!buyerSkuForm.brand_id}
                data-testid="submit-buyer-sku-request"
              >
                Submit Request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* RM Request Dialog */}
      <Dialog open={showRmDialog} onOpenChange={setShowRmDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Request New Raw Material</DialogTitle>
            <DialogDescription>
              Request a {rmCategories.find(c => c.code === rmForm.category)?.name || rmForm.category} for Tech Ops to create.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div>
              <Label>Category</Label>
              <Select value={rmForm.category} onValueChange={(v) => setRmForm({ ...rmForm, category: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {rmCategories.map(c => (
                    <SelectItem key={c.code} value={c.code}>{c.code} - {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>RM Name *</Label>
              <Input
                value={rmForm.requested_name}
                onChange={(e) => setRmForm({ ...rmForm, requested_name: e.target.value })}
                placeholder="e.g., Baybee Kids Scooter Label - Blue"
                data-testid="rm-name-input"
              />
            </div>
            
            <div>
              <Label>Description</Label>
              <Textarea
                value={rmForm.description}
                onChange={(e) => setRmForm({ ...rmForm, description: e.target.value })}
                placeholder="Detailed specifications, size, color, artwork reference..."
                rows={3}
              />
            </div>
            
            <div>
              <Label>For Brands *</Label>
              <div className="flex flex-wrap gap-2 mt-2 p-3 border rounded-lg min-h-[60px]">
                {rmForm.brand_ids.map(bid => (
                  <Badge key={bid} variant="secondary" className="pr-1">
                    {getBrandCode(bid)} - {getBrandName(bid)}
                    <button 
                      className="ml-1 hover:text-red-500"
                      onClick={() => setRmForm({ 
                        ...rmForm, 
                        brand_ids: rmForm.brand_ids.filter(id => id !== bid) 
                      })}
                    >
                      <XCircle className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <Select onValueChange={(v) => {
                if (v && !rmForm.brand_ids.includes(v)) {
                  setRmForm({ ...rmForm, brand_ids: [...rmForm.brand_ids, v] });
                }
              }}>
                <SelectTrigger className="mt-2" data-testid="rm-brand-select">
                  <SelectValue placeholder="Add brand..." />
                </SelectTrigger>
                <SelectContent>
                  {brands.filter(b => !rmForm.brand_ids.includes(b.id)).map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.code} - {b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>For Buyer SKU (Optional)</Label>
              <Input
                value={rmForm.buyer_sku_id}
                onChange={(e) => setRmForm({ ...rmForm, buyer_sku_id: e.target.value })}
                placeholder="e.g., BE_KS_PE_001"
                className="font-mono"
              />
              <p className="text-xs text-gray-500 mt-1">Link this RM to a specific Buyer SKU</p>
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowRmDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateRmRequest}
                disabled={!rmForm.requested_name || rmForm.brand_ids.length === 0}
                data-testid="submit-rm-request"
              >
                Submit Request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DemandHub;

import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { 
  Package, Search, Filter, Download, Box, Tag,
  ChevronDown, Layers, DollarSign, Plus, Upload, Trash2, Edit, X
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import useAuthStore from "../store/authStore";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

const DemandSKUView = () => {
  // Get token from zustand auth store
  const token = useAuthStore((state) => state.token);
  
  const getHeaders = () => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const [activeTab, setActiveTab] = useState("bidso");
  
  // Data
  const [bidsoSkus, setBidsoSkus] = useState([]);
  const [buyerSkus, setBuyerSkus] = useState([]);
  const [verticals, setVerticals] = useState([]);
  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  const [buyers, setBuyers] = useState([]);
  
  // Filters
  const [bidsoFilters, setBidsoFilters] = useState({
    vertical_id: "",
    brand_id: "",
    model_id: "",
    search: ""
  });
  const [buyerFilters, setBuyerFilters] = useState({
    vertical_id: "",
    brand_id: "",
    model_id: "",
    buyer_id: "",
    search: ""
  });
  
  // Loading
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  
  // Price Master State
  const [prices, setPrices] = useState([]);
  const [priceFilters, setPriceFilters] = useState({ customer_id: "", search: "" });
  const [showPriceDialog, setShowPriceDialog] = useState(false);
  const [editingPrice, setEditingPrice] = useState(null);
  const [priceForm, setPriceForm] = useState({
    customer_id: "",
    buyer_sku_id: "",
    unit_price: "",
    currency: "INR",
    notes: ""
  });
  const priceFileRef = useRef(null);

  useEffect(() => {
    fetchMasterData();
  }, []);

  useEffect(() => {
    if (activeTab === "bidso") {
      fetchBidsoSkus();
    } else if (activeTab === "buyer") {
      fetchBuyerSkus();
    } else if (activeTab === "prices") {
      fetchPrices();
    }
  }, [activeTab, bidsoFilters, buyerFilters, priceFilters]);

  const fetchMasterData = async () => {
    try {
      const headers = getHeaders();
      const [vertRes, brandRes, modelRes, buyerRes] = await Promise.all([
        axios.get(`${API}/verticals`, { headers }),
        axios.get(`${API}/brands`, { headers }),
        axios.get(`${API}/models`, { headers }),
        axios.get(`${API}/buyers`, { headers })
      ]);
      setVerticals(vertRes.data || []);
      setBrands(brandRes.data || []);
      setModels(modelRes.data || []);
      setBuyers(buyerRes.data || []);
    } catch (error) {
      console.error("Failed to fetch master data");
    }
  };

  const fetchBidsoSkus = async () => {
    setLoading(true);
    try {
      let url = `${API}/demand-hub/bidso-skus?`;
      if (bidsoFilters.vertical_id) url += `vertical_id=${bidsoFilters.vertical_id}&`;
      if (bidsoFilters.model_id) url += `model_id=${bidsoFilters.model_id}&`;
      if (bidsoFilters.search) url += `search=${encodeURIComponent(bidsoFilters.search)}&`;
      
      const res = await axios.get(url, { headers: getHeaders() });
      setBidsoSkus(res.data || []);
    } catch (error) {
      toast.error("Failed to fetch Bidso SKUs");
    } finally {
      setLoading(false);
    }
  };

  const fetchBuyerSkus = async () => {
    setLoading(true);
    try {
      let url = `${API}/skus/filtered?`;
      if (buyerFilters.vertical_id) url += `vertical_id=${buyerFilters.vertical_id}&`;
      if (buyerFilters.brand_id) url += `brand_id=${buyerFilters.brand_id}&`;
      if (buyerFilters.model_id) url += `model_id=${buyerFilters.model_id}&`;
      if (buyerFilters.buyer_id) url += `buyer_id=${buyerFilters.buyer_id}&`;
      if (buyerFilters.search) url += `search=${encodeURIComponent(buyerFilters.search)}&`;
      
      const res = await axios.get(url, { headers: getHeaders() });
      setBuyerSkus(res.data || []);
    } catch (error) {
      toast.error("Failed to fetch Buyer SKUs");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (type) => {
    setDownloading(true);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      
      if (type === "bidso") {
        // Prepare Bidso SKU data - API returns enriched data with vertical/model objects
        const headers = ['Bidso SKU ID', 'Name', 'Description', 'Vertical', 'Model', 'Status'];
        const data = [headers];
        
        bidsoSkus.forEach(sku => {
          data.push([
            sku.bidso_sku_id || '',
            sku.name || '',
            sku.description || '',
            sku.vertical?.name || '',
            sku.model?.name || '',
            sku.status || 'ACTIVE'
          ]);
        });
        
        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [
          { wch: 20 }, { wch: 30 }, { wch: 40 }, { wch: 15 }, { wch: 20 }, { wch: 10 }
        ];
        XLSX.utils.book_append_sheet(wb, ws, 'Bidso SKUs');
        XLSX.writeFile(wb, `bidso_skus_${new Date().toISOString().slice(0,10)}.xlsx`);
        
      } else {
        // Prepare Buyer SKU data
        const headers = ['SKU ID', 'Description', 'Vertical', 'Brand', 'Model', 'Buyer', 'Bidso SKU', 'Status'];
        const data = [headers];
        
        buyerSkus.forEach(sku => {
          const vertical = verticals.find(v => v.id === sku.vertical_id);
          const brand = brands.find(b => b.id === sku.brand_id);
          const model = models.find(m => m.id === sku.model_id);
          const buyer = buyers.find(b => b.id === sku.buyer_id);
          data.push([
            sku.sku_id || '',
            sku.description || '',
            vertical?.name || '',
            brand?.name || '',
            model?.name || '',
            buyer?.name || '',
            sku.bidso_sku_id || '',
            sku.status || 'ACTIVE'
          ]);
        });
        
        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [
          { wch: 20 }, { wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 10 }
        ];
        XLSX.utils.book_append_sheet(wb, ws, 'Buyer SKUs');
        XLSX.writeFile(wb, `buyer_skus_${new Date().toISOString().slice(0,10)}.xlsx`);
      }
      
      toast.success(`${type === "bidso" ? "Bidso" : "Buyer"} SKUs downloaded successfully`);
    } catch (error) {
      toast.error("Failed to download SKUs");
    } finally {
      setDownloading(false);
    }
  };

  const getFilteredModels = (verticalId) => {
    if (!verticalId) return models;
    return models.filter(m => m.vertical_id === verticalId);
  };

  const getVerticalName = (id) => verticals.find(v => v.id === id)?.name || '-';
  const getBrandName = (id) => brands.find(b => b.id === id)?.name || '-';
  const getModelName = (id) => models.find(m => m.id === id)?.name || '-';
  const getBuyerName = (id) => buyers.find(b => b.id === id)?.name || '-';

  // ============ Price Master Functions ============
  
  const fetchPrices = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (priceFilters.customer_id && priceFilters.customer_id !== "_all") {
        params.append("customer_id", priceFilters.customer_id);
      }
      params.append("active_only", "true");
      params.append("page_size", "200");
      
      const res = await axios.get(`${API}/price-master?${params}`, { headers: getHeaders() });
      setPrices(res.data.prices || []);
    } catch (error) {
      toast.error("Failed to fetch prices");
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePrice = async () => {
    if (!priceForm.customer_id || !priceForm.buyer_sku_id || !priceForm.unit_price) {
      toast.error("Please fill all required fields");
      return;
    }
    
    try {
      await axios.post(`${API}/price-master`, {
        customer_id: priceForm.customer_id,
        buyer_sku_id: priceForm.buyer_sku_id,
        unit_price: parseFloat(priceForm.unit_price),
        currency: priceForm.currency,
        notes: priceForm.notes
      }, { headers: getHeaders() });
      
      toast.success("Price created successfully");
      setShowPriceDialog(false);
      resetPriceForm();
      fetchPrices();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create price");
    }
  };

  const handleUpdatePrice = async () => {
    if (!editingPrice) return;
    
    try {
      await axios.put(`${API}/price-master/${editingPrice.id}`, {
        unit_price: parseFloat(priceForm.unit_price),
        notes: priceForm.notes
      }, { headers: getHeaders() });
      
      toast.success("Price updated successfully");
      setShowPriceDialog(false);
      setEditingPrice(null);
      resetPriceForm();
      fetchPrices();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update price");
    }
  };

  const handleDeletePrice = async (priceId) => {
    if (!window.confirm("Are you sure you want to deactivate this price?")) return;
    
    try {
      await axios.delete(`${API}/price-master/${priceId}`, { headers: getHeaders() });
      toast.success("Price deactivated");
      fetchPrices();
    } catch (error) {
      toast.error("Failed to delete price");
    }
  };

  const handlePriceBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const res = await axios.post(`${API}/price-master/bulk-upload`, formData, {
        headers: { ...getHeaders(), "Content-Type": "multipart/form-data" }
      });
      
      toast.success(res.data.message);
      if (res.data.errors?.length > 0) {
        toast.warning(`${res.data.errors.length} errors occurred`);
      }
      fetchPrices();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Upload failed");
    }
    
    e.target.value = null;
  };

  const downloadPriceTemplate = () => {
    const template = [
      { customer_id: "CUST_0001", buyer_sku_id: "ERW001_TVS", unit_price: 1500.00, currency: "INR", notes: "FY 2026-27" }
    ];
    
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Price Master");
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: "application/octet-stream" }), "price_master_template.xlsx");
  };

  const exportPrices = () => {
    if (prices.length === 0) {
      toast.error("No prices to export");
      return;
    }
    
    const exportData = prices.map(p => ({
      customer_id: p.customer_id,
      customer_name: p.customer_name,
      buyer_sku_id: p.buyer_sku_id,
      sku_name: p.sku_name,
      unit_price: p.unit_price,
      currency: p.currency,
      effective_from: p.effective_from,
      notes: p.notes
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Price Master");
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: "application/octet-stream" }), `price_master_${new Date().toISOString().slice(0,10)}.xlsx`);
    toast.success("Prices exported");
  };

  const resetPriceForm = () => {
    setPriceForm({
      customer_id: "",
      buyer_sku_id: "",
      unit_price: "",
      currency: "INR",
      notes: ""
    });
  };

  const openEditPrice = (price) => {
    setEditingPrice(price);
    setPriceForm({
      customer_id: price.customer_id,
      buyer_sku_id: price.buyer_sku_id,
      unit_price: price.unit_price.toString(),
      currency: price.currency,
      notes: price.notes || ""
    });
    setShowPriceDialog(true);
  };

  // Filter buyer SKUs by customer
  const getCustomerSkus = (customerId) => {
    // For now, return all buyer SKUs since we don't have brand-customer mapping
    return buyerSkus;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SKU Catalog</h1>
          <p className="text-gray-500 text-sm mt-1">View SKUs and manage customer pricing</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="bidso" data-testid="bidso-tab">
            <Layers className="h-4 w-4 mr-2" />
            Bidso SKUs
            <Badge className="ml-2 bg-gray-200 text-gray-700">{bidsoSkus.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="buyer" data-testid="buyer-tab">
            <Tag className="h-4 w-4 mr-2" />
            Buyer SKUs
            <Badge className="ml-2 bg-gray-200 text-gray-700">{buyerSkus.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="prices" data-testid="prices-tab">
            <DollarSign className="h-4 w-4 mr-2" />
            Price Master
            <Badge className="ml-2 bg-gray-200 text-gray-700">{prices.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* Bidso SKUs Tab */}
        <TabsContent value="bidso" className="space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Layers className="h-5 w-5" />
                  Bidso SKUs (Base Products)
                </CardTitle>
                <Button 
                  variant="outline" 
                  onClick={() => handleDownload("bidso")}
                  disabled={downloading || bidsoSkus.length === 0}
                  data-testid="download-bidso-btn"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {downloading ? "Downloading..." : `Download (${bidsoSkus.length})`}
                </Button>
              </div>
              
              {/* Filters */}
              <div className="flex flex-wrap gap-3 mt-4">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-gray-400" />
                </div>
                <Select 
                  value={bidsoFilters.vertical_id || "_all"} 
                  onValueChange={(v) => setBidsoFilters({...bidsoFilters, vertical_id: v === "_all" ? "" : v, model_id: ""})}
                >
                  <SelectTrigger className="w-[160px]" data-testid="bidso-vertical-filter">
                    <SelectValue placeholder="All Verticals" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All Verticals</SelectItem>
                    {verticals.filter(v => v.id).map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select 
                  value={bidsoFilters.model_id || "_all"} 
                  onValueChange={(v) => setBidsoFilters({...bidsoFilters, model_id: v === "_all" ? "" : v})}
                >
                  <SelectTrigger className="w-[160px]" data-testid="bidso-model-filter">
                    <SelectValue placeholder="All Models" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All Models</SelectItem>
                    {getFilteredModels(bidsoFilters.vertical_id).filter(m => m.id).map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search SKU ID..."
                    value={bidsoFilters.search}
                    onChange={(e) => setBidsoFilters({...bidsoFilters, search: e.target.value})}
                    className="pl-10"
                    data-testid="bidso-search-input"
                  />
                </div>
                
                {(bidsoFilters.vertical_id || bidsoFilters.model_id || bidsoFilters.search) && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setBidsoFilters({vertical_id: "", brand_id: "", model_id: "", search: ""})}
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bidso SKU ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Vertical</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : bidsoSkus.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                        No Bidso SKUs found
                      </TableCell>
                    </TableRow>
                  ) : (
                    bidsoSkus.map(sku => (
                      <TableRow key={sku.id} data-testid={`bidso-row-${sku.bidso_sku_id}`}>
                        <TableCell className="font-mono font-medium">{sku.bidso_sku_id}</TableCell>
                        <TableCell className="max-w-xs truncate">{sku.name || '-'}</TableCell>
                        <TableCell>{sku.vertical?.name || '-'}</TableCell>
                        <TableCell>{sku.model?.name || '-'}</TableCell>
                        <TableCell>
                          <Badge className={sku.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                            {sku.status || 'ACTIVE'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Buyer SKUs Tab */}
        <TabsContent value="buyer" className="space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  Buyer SKUs (Customer-Specific)
                </CardTitle>
                <Button 
                  variant="outline" 
                  onClick={() => handleDownload("buyer")}
                  disabled={downloading || buyerSkus.length === 0}
                  data-testid="download-buyer-btn"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {downloading ? "Downloading..." : `Download (${buyerSkus.length})`}
                </Button>
              </div>
              
              {/* Filters */}
              <div className="flex flex-wrap gap-3 mt-4">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-gray-400" />
                </div>
                <Select 
                  value={buyerFilters.vertical_id || "_all"} 
                  onValueChange={(v) => setBuyerFilters({...buyerFilters, vertical_id: v === "_all" ? "" : v, model_id: ""})}
                >
                  <SelectTrigger className="w-[150px]" data-testid="buyer-vertical-filter">
                    <SelectValue placeholder="All Verticals" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All Verticals</SelectItem>
                    {verticals.filter(v => v.id).map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select 
                  value={buyerFilters.brand_id || "_all"} 
                  onValueChange={(v) => setBuyerFilters({...buyerFilters, brand_id: v === "_all" ? "" : v})}
                >
                  <SelectTrigger className="w-[150px]" data-testid="buyer-brand-filter">
                    <SelectValue placeholder="All Brands" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All Brands</SelectItem>
                    {brands.filter(b => b.id).map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select 
                  value={buyerFilters.model_id || "_all"} 
                  onValueChange={(v) => setBuyerFilters({...buyerFilters, model_id: v === "_all" ? "" : v})}
                >
                  <SelectTrigger className="w-[150px]" data-testid="buyer-model-filter">
                    <SelectValue placeholder="All Models" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All Models</SelectItem>
                    {getFilteredModels(buyerFilters.vertical_id).filter(m => m.id).map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select 
                  value={buyerFilters.buyer_id || "_all"} 
                  onValueChange={(v) => setBuyerFilters({...buyerFilters, buyer_id: v === "_all" ? "" : v})}
                >
                  <SelectTrigger className="w-[180px]" data-testid="buyer-buyer-filter">
                    <SelectValue placeholder="All Buyers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All Buyers</SelectItem>
                    {buyers.filter(b => b.id).map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search SKU ID..."
                    value={buyerFilters.search}
                    onChange={(e) => setBuyerFilters({...buyerFilters, search: e.target.value})}
                    className="pl-10"
                    data-testid="buyer-search-input"
                  />
                </div>
                
                {(buyerFilters.vertical_id || buyerFilters.brand_id || buyerFilters.model_id || buyerFilters.buyer_id || buyerFilters.search) && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setBuyerFilters({vertical_id: "", brand_id: "", model_id: "", buyer_id: "", search: ""})}
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU ID</TableHead>
                    <TableHead>Vertical</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : buyerSkus.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                        No Buyer SKUs found
                      </TableCell>
                    </TableRow>
                  ) : (
                    buyerSkus.map(sku => (
                      <TableRow key={sku.id} data-testid={`buyer-row-${sku.sku_id}`}>
                        <TableCell className="font-mono font-medium">{sku.sku_id}</TableCell>
                        <TableCell>{getVerticalName(sku.vertical_id)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{getBrandName(sku.brand_id)}</Badge>
                        </TableCell>
                        <TableCell>{getModelName(sku.model_id)}</TableCell>
                        <TableCell>
                          <Badge className={sku.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                            {sku.status || 'ACTIVE'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Price Master Tab */}
        <TabsContent value="prices">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Price Master
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={downloadPriceTemplate}>
                    <Download className="h-4 w-4 mr-2" />
                    Template
                  </Button>
                  <input type="file" ref={priceFileRef} onChange={handlePriceBulkUpload} accept=".xlsx,.xls" className="hidden" />
                  <Button variant="outline" size="sm" onClick={() => priceFileRef.current.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    Bulk Upload
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportPrices}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                  <Dialog open={showPriceDialog} onOpenChange={(open) => { 
                    setShowPriceDialog(open); 
                    if (!open) { resetPriceForm(); setEditingPrice(null); }
                  }}>
                    <DialogTrigger asChild>
                      <Button size="sm" data-testid="add-price-btn">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Price
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle className="font-bold uppercase">
                          {editingPrice ? "Edit Price" : "Add New Price"}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div>
                          <Label className="text-xs uppercase">Customer *</Label>
                          <Select 
                            value={priceForm.customer_id} 
                            onValueChange={(v) => setPriceForm({...priceForm, customer_id: v})}
                            disabled={!!editingPrice}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select customer" />
                            </SelectTrigger>
                            <SelectContent>
                              {buyers.filter(b => b.id || b.customer_code).map(b => (
                                <SelectItem key={b.id} value={b.customer_code || b.id}>
                                  {b.name} ({b.customer_code || b.id})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <Label className="text-xs uppercase">Buyer SKU *</Label>
                          <Select 
                            value={priceForm.buyer_sku_id || undefined} 
                            onValueChange={(v) => setPriceForm({...priceForm, buyer_sku_id: v})}
                            disabled={!!editingPrice}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select SKU" />
                            </SelectTrigger>
                            <SelectContent>
                              {buyerSkus.filter(sku => sku.buyer_sku_id || sku.sku_id).slice(0, 200).map(sku => (
                                <SelectItem key={sku.buyer_sku_id || sku.sku_id} value={sku.buyer_sku_id || sku.sku_id}>
                                  {sku.buyer_sku_id || sku.sku_id} - {sku.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <Label className="text-xs uppercase">Unit Price (₹) *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={priceForm.unit_price}
                            onChange={(e) => setPriceForm({...priceForm, unit_price: e.target.value})}
                            placeholder="0.00"
                            className="font-mono"
                          />
                        </div>
                        
                        <div>
                          <Label className="text-xs uppercase">Notes</Label>
                          <Input
                            value={priceForm.notes}
                            onChange={(e) => setPriceForm({...priceForm, notes: e.target.value})}
                            placeholder="FY 2026-27 pricing"
                          />
                        </div>
                        
                        <div className="flex justify-end gap-2 pt-4">
                          <Button variant="outline" onClick={() => { setShowPriceDialog(false); resetPriceForm(); setEditingPrice(null); }}>
                            Cancel
                          </Button>
                          <Button onClick={editingPrice ? handleUpdatePrice : handleCreatePrice}>
                            {editingPrice ? "Update Price" : "Add Price"}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex gap-4 mb-4">
                <Select 
                  value={priceFilters.customer_id || "_all"} 
                  onValueChange={(v) => setPriceFilters({...priceFilters, customer_id: v})}
                >
                  <SelectTrigger className="w-[250px]">
                    <SelectValue placeholder="All Customers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All Customers</SelectItem>
                    {buyers.filter(b => b.id || b.customer_code).map(b => (
                      <SelectItem key={b.id} value={b.customer_code || b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Price Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Buyer SKU</TableHead>
                    <TableHead>SKU Name</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead>Effective From</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">Loading...</TableCell>
                    </TableRow>
                  ) : prices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No prices found. Click "Add Price" to create one.
                      </TableCell>
                    </TableRow>
                  ) : (
                    prices.map(price => (
                      <TableRow key={price.id}>
                        <TableCell>
                          <div className="font-medium">{price.customer_name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{price.customer_id}</div>
                        </TableCell>
                        <TableCell className="font-mono">{price.buyer_sku_id}</TableCell>
                        <TableCell className="text-sm">{price.sku_name}</TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          ₹{price.unit_price?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {price.effective_from ? new Date(price.effective_from).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                          {price.notes || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => openEditPrice(price)} title="Edit">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDeletePrice(price.id)} title="Delete">
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
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
    </div>
  );
};

export default DemandSKUView;

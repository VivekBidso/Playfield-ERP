import { useState, useEffect } from "react";
import axios from "axios";
import { 
  Package, Search, Filter, Download, Box, Tag,
  ChevronDown, Layers
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

  useEffect(() => {
    fetchMasterData();
  }, []);

  useEffect(() => {
    if (activeTab === "bidso") {
      fetchBidsoSkus();
    } else {
      fetchBuyerSkus();
    }
  }, [activeTab, bidsoFilters, buyerFilters]);

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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SKU Catalog</h1>
          <p className="text-gray-500 text-sm mt-1">View Bidso SKUs and Buyer SKUs</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
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
                    {verticals.map(v => (
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
                    {getFilteredModels(bidsoFilters.vertical_id).map(m => (
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
                    {verticals.map(v => (
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
                    {brands.map(b => (
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
                    {getFilteredModels(buyerFilters.vertical_id).map(m => (
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
                    {buyers.map(b => (
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
      </Tabs>
    </div>
  );
};

export default DemandSKUView;

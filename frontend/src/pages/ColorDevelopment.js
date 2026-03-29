import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { 
  Palette, Plus, Search, Clock, CheckCircle, XCircle, 
  AlertCircle, Eye, ChevronDown, ChevronRight, Send,
  Loader2, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import useAuthStore from "../store/authStore";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const COLOR_FAMILIES = [
  "RED", "BLUE", "GREEN", "YELLOW", "ORANGE", "PURPLE", 
  "PINK", "BROWN", "BLACK", "WHITE", "GREY", "METALLIC", "OTHER"
];

const CATEGORIES = ["INP", "INM", "ACC"];

const PRIORITIES = [
  { value: "LOW", label: "Low", color: "bg-gray-100 text-gray-700" },
  { value: "NORMAL", label: "Normal", color: "bg-blue-100 text-blue-700" },
  { value: "HIGH", label: "High", color: "bg-orange-100 text-orange-700" },
  { value: "URGENT", label: "Urgent", color: "bg-red-100 text-red-700" }
];

const STATUS_CONFIG = {
  REQUESTED: { label: "Requested", color: "bg-blue-100 text-blue-800", icon: Clock },
  VENDOR_DEVELOPMENT: { label: "Vendor Development", color: "bg-purple-100 text-purple-800", icon: Loader2 },
  QC_PENDING: { label: "QC Pending", color: "bg-yellow-100 text-yellow-800", icon: AlertCircle },
  APPROVED: { label: "Approved", color: "bg-green-100 text-green-800", icon: CheckCircle },
  REJECTED: { label: "Rejected", color: "bg-red-100 text-red-800", icon: XCircle }
};

const ColorDevelopment = () => {
  const { token } = useAuthStore();
  
  // State
  const [activeTab, setActiveTab] = useState("my-requests");
  const [myRequests, setMyRequests] = useState([]);
  const [allRequests, setAllRequests] = useState([]);
  const [pantoneShades, setPantoneShades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // Summary
  const [summary, setSummary] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0
  });
  
  // Dialogs
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  
  // Form
  const [requestForm, setRequestForm] = useState({
    pantone_code: "",
    pantone_name: "",
    color_hex: "#808080",
    color_family: "OTHER",
    applicable_categories: ["INP", "INM", "ACC"],
    target_models: [],
    priority: "NORMAL",
    notes: ""
  });

  const getHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }), [token]);

  // Fetch data
  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [myReqRes, shadesRes] = await Promise.all([
        axios.get(`${API}/pantone/color-requests?my_requests=true`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/pantone/shades?limit=500`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      
      setMyRequests(myReqRes.data || []);
      setPantoneShades(shadesRes.data.items || []);
      
      // Calculate summary
      const requests = myReqRes.data || [];
      setSummary({
        total: requests.length,
        pending: requests.filter(r => ["REQUESTED", "VENDOR_DEVELOPMENT", "QC_PENDING"].includes(r.status)).length,
        approved: requests.filter(r => r.status === "APPROVED").length,
        rejected: requests.filter(r => r.status === "REJECTED").length
      });
    } catch (err) {
      toast.error("Failed to fetch data");
    }
    setLoading(false);
  };

  const fetchAllRequests = async () => {
    try {
      const res = await axios.get(`${API}/pantone/color-requests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAllRequests(res.data || []);
    } catch (err) {
      toast.error("Failed to fetch all requests");
    }
  };

  // When switching to "all-requests" tab, fetch all
  useEffect(() => {
    if (activeTab === "all-requests") {
      fetchAllRequests();
    }
  }, [activeTab]);

  // Handlers
  const handleCreateRequest = async () => {
    if (!requestForm.pantone_code.trim() || !requestForm.pantone_name.trim()) {
      toast.error("Pantone code and name are required");
      return;
    }
    
    try {
      await axios.post(`${API}/pantone/color-requests`, requestForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Color development request submitted");
      setShowRequestDialog(false);
      resetForm();
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to submit request");
    }
  };

  const resetForm = () => {
    setRequestForm({
      pantone_code: "",
      pantone_name: "",
      color_hex: "#808080",
      color_family: "OTHER",
      applicable_categories: ["INP", "INM", "ACC"],
      target_models: [],
      priority: "NORMAL",
      notes: ""
    });
  };

  const toggleCategory = (cat) => {
    const current = requestForm.applicable_categories;
    if (current.includes(cat)) {
      setRequestForm({ ...requestForm, applicable_categories: current.filter(c => c !== cat) });
    } else {
      setRequestForm({ ...requestForm, applicable_categories: [...current, cat] });
    }
  };

  const getStatusBadge = (status) => {
    const config = STATUS_CONFIG[status] || { label: status, color: "bg-gray-100 text-gray-800" };
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} gap-1`}>
        {Icon && <Icon className="w-3 h-3" />}
        {config.label}
      </Badge>
    );
  };

  const getPriorityBadge = (priority) => {
    const config = PRIORITIES.find(p => p.value === priority) || PRIORITIES[1];
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const filteredRequests = (requests) => {
    return requests.filter(r => {
      const matchesSearch = !searchQuery || 
        r.pantone_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.pantone_name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  };

  return (
    <div className="p-6 md:p-8" data-testid="color-development-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <Palette className="w-8 h-8 text-purple-600" />
            Color Development
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Request new Pantone shades for product development
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => { resetForm(); setShowRequestDialog(true); }} data-testid="request-new-color-btn">
            <Plus className="w-4 h-4 mr-2" />
            Request New Color
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{summary.total}</div>
            <div className="text-sm text-muted-foreground">Total Requests</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-yellow-600">{summary.pending}</div>
            <div className="text-sm text-muted-foreground">In Progress</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{summary.approved}</div>
            <div className="text-sm text-muted-foreground">Approved</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-600">{summary.rejected}</div>
            <div className="text-sm text-muted-foreground">Rejected</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="my-requests">My Requests</TabsTrigger>
          <TabsTrigger value="pantone-library">Available Pantone Shades</TabsTrigger>
          <TabsTrigger value="all-requests">All Requests</TabsTrigger>
        </TabsList>

        {/* Filters */}
        <div className="flex gap-4 items-center mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by Pantone code or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="color-search"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* My Requests Tab */}
        <TabsContent value="my-requests">
          <Card>
            <CardHeader>
              <CardTitle>My Color Development Requests</CardTitle>
              <CardDescription>Track the status of your submitted requests</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="p-8 text-center text-gray-500">Loading...</div>
              ) : filteredRequests(myRequests).length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Palette className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No color development requests yet.</p>
                  <p className="text-sm mt-1">Click "Request New Color" to submit your first request.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Color</TableHead>
                      <TableHead>Pantone Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Categories</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests(myRequests).map(req => (
                      <TableRow key={req.id}>
                        <TableCell>
                          <div 
                            className="w-8 h-8 rounded border-2 border-gray-200"
                            style={{ backgroundColor: req.color_hex || "#808080" }}
                          />
                        </TableCell>
                        <TableCell className="font-mono font-semibold">{req.pantone_code}</TableCell>
                        <TableCell>{req.pantone_name}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {req.applicable_categories?.map(cat => (
                              <Badge key={cat} variant="outline" className="text-xs">{cat}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>{getPriorityBadge(req.priority)}</TableCell>
                        <TableCell>{getStatusBadge(req.status)}</TableCell>
                        <TableCell className="text-sm">{formatDate(req.requested_at)}</TableCell>
                        <TableCell>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => { setSelectedRequest(req); setShowDetailDialog(true); }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pantone Library Tab */}
        <TabsContent value="pantone-library">
          <Card>
            <CardHeader>
              <CardTitle>Available Pantone Shades</CardTitle>
              <CardDescription>Browse existing approved Pantone shades in the system</CardDescription>
            </CardHeader>
            <CardContent>
              {pantoneShades.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No Pantone shades available yet.
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {pantoneShades
                    .filter(s => !searchQuery || 
                      s.pantone_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      s.pantone_name?.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map(shade => (
                      <div 
                        key={shade.id} 
                        className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div 
                          className="w-full h-20 rounded-md border mb-3"
                          style={{ backgroundColor: shade.color_hex }}
                        />
                        <div className="font-mono font-semibold text-sm">{shade.pantone_code}</div>
                        <div className="text-sm text-gray-600 truncate">{shade.pantone_name}</div>
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {shade.applicable_categories?.map(cat => (
                            <Badge key={cat} variant="outline" className="text-xs">{cat}</Badge>
                          ))}
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          {shade.approved_vendor_count || 0} approved vendors
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Requests Tab */}
        <TabsContent value="all-requests">
          <Card>
            <CardHeader>
              <CardTitle>All Color Requests</CardTitle>
              <CardDescription>View all color development requests across the organization</CardDescription>
            </CardHeader>
            <CardContent>
              {allRequests.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No color development requests found.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Color</TableHead>
                      <TableHead>Pantone Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Requested By</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Requested</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests(allRequests).map(req => (
                      <TableRow key={req.id}>
                        <TableCell>
                          <div 
                            className="w-8 h-8 rounded border-2 border-gray-200"
                            style={{ backgroundColor: req.color_hex || "#808080" }}
                          />
                        </TableCell>
                        <TableCell className="font-mono font-semibold">{req.pantone_code}</TableCell>
                        <TableCell>{req.pantone_name}</TableCell>
                        <TableCell className="text-sm">{req.requested_by_name || "-"}</TableCell>
                        <TableCell>{getPriorityBadge(req.priority)}</TableCell>
                        <TableCell>{getStatusBadge(req.status)}</TableCell>
                        <TableCell className="text-sm">{formatDate(req.requested_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Request Dialog */}
      <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-purple-600" />
              Request New Pantone Color
            </DialogTitle>
            <DialogDescription>
              Submit a request for a new Pantone shade to be added to the system
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Pantone Code *</Label>
                <Input
                  value={requestForm.pantone_code}
                  onChange={(e) => setRequestForm({ ...requestForm, pantone_code: e.target.value })}
                  placeholder="e.g., 485 C"
                  data-testid="pantone-code-input"
                />
              </div>
              <div>
                <Label>Color Name *</Label>
                <Input
                  value={requestForm.pantone_name}
                  onChange={(e) => setRequestForm({ ...requestForm, pantone_name: e.target.value })}
                  placeholder="e.g., Bright Red"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Color Preview</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={requestForm.color_hex}
                    onChange={(e) => setRequestForm({ ...requestForm, color_hex: e.target.value })}
                    className="w-14 h-10 p-1"
                  />
                  <Input
                    value={requestForm.color_hex}
                    onChange={(e) => setRequestForm({ ...requestForm, color_hex: e.target.value })}
                    placeholder="#DA291C"
                  />
                </div>
              </div>
              <div>
                <Label>Color Family</Label>
                <Select 
                  value={requestForm.color_family} 
                  onValueChange={(v) => setRequestForm({ ...requestForm, color_family: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLOR_FAMILIES.map(cf => (
                      <SelectItem key={cf} value={cf}>{cf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label>Applicable Categories</Label>
              <div className="flex gap-2 mt-2">
                {CATEGORIES.map(cat => (
                  <Button
                    key={cat}
                    type="button"
                    variant={requestForm.applicable_categories.includes(cat) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleCategory(cat)}
                  >
                    {cat}
                  </Button>
                ))}
              </div>
            </div>
            
            <div>
              <Label>Priority</Label>
              <Select 
                value={requestForm.priority} 
                onValueChange={(v) => setRequestForm({ ...requestForm, priority: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Notes / Justification</Label>
              <Textarea
                value={requestForm.notes}
                onChange={(e) => setRequestForm({ ...requestForm, notes: e.target.value })}
                placeholder="Why is this color needed? Which products will use it?"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRequestDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateRequest} data-testid="submit-color-request-btn">
              <Send className="w-4 h-4 mr-2" />
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Details</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div 
                  className="w-16 h-16 rounded-lg border-2 border-gray-200"
                  style={{ backgroundColor: selectedRequest.color_hex || "#808080" }}
                />
                <div>
                  <div className="font-mono font-bold text-lg">{selectedRequest.pantone_code}</div>
                  <div className="text-gray-600">{selectedRequest.pantone_name}</div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">Status</div>
                  <div className="mt-1">{getStatusBadge(selectedRequest.status)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Priority</div>
                  <div className="mt-1">{getPriorityBadge(selectedRequest.priority)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Color Family</div>
                  <div className="mt-1 font-medium">{selectedRequest.color_family}</div>
                </div>
                <div>
                  <div className="text-gray-500">Requested</div>
                  <div className="mt-1 font-medium">{formatDate(selectedRequest.requested_at)}</div>
                </div>
              </div>
              
              <div>
                <div className="text-gray-500 text-sm">Categories</div>
                <div className="flex gap-1 mt-1">
                  {selectedRequest.applicable_categories?.map(cat => (
                    <Badge key={cat} variant="outline">{cat}</Badge>
                  ))}
                </div>
              </div>
              
              {selectedRequest.notes && (
                <div>
                  <div className="text-gray-500 text-sm">Notes</div>
                  <div className="mt-1 text-sm bg-gray-50 p-3 rounded">{selectedRequest.notes}</div>
                </div>
              )}
              
              {selectedRequest.pantone_id && (
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle className="w-4 h-4" />
                    <span className="font-medium">Pantone shade created in library</span>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ColorDevelopment;

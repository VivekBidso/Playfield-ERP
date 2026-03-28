import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Toaster, toast } from 'sonner';
import {
  Calculator,
  FileText,
  Package,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  RefreshCw,
  Eye,
  Send,
  Loader2,
  Play,
  Settings,
  BarChart3,
  ShoppingCart,
  Plus,
  Upload,
  Edit,
  X,
} from 'lucide-react';
import useAuthStore from '../store/authStore';

const API = process.env.REACT_APP_BACKEND_URL;

export default function MRPDashboard() {
  const { token } = useAuthStore();
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Dashboard state
  const [dashboardStats, setDashboardStats] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // MRP Runs state
  const [mrpRuns, setMrpRuns] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [runDetailOpen, setRunDetailOpen] = useState(false);
  
  // Draft POs state
  const [draftPOs, setDraftPOs] = useState([]);
  const [selectedPO, setSelectedPO] = useState(null);
  const [poDetailOpen, setPODetailOpen] = useState(false);
  
  // Model Forecasts state
  const [modelForecasts, setModelForecasts] = useState([]);
  const [models, setModels] = useState([]);
  const [verticals, setVerticals] = useState([]);
  const [selectedVertical, setSelectedVertical] = useState('');
  
  // RM Parameters state
  const [rmParams, setRmParams] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  
  // Calculation state
  const [calculating, setCalculating] = useState(false);
  const [generatingPOs, setGeneratingPOs] = useState(false);
  const [seeding, setSeeding] = useState(false);
  
  // Add Forecast Dialog
  const [addForecastOpen, setAddForecastOpen] = useState(false);
  const [forecastForm, setForecastForm] = useState({
    model_id: '',
    month_year: '',
    forecast_qty: ''
  });
  const [savingForecast, setSavingForecast] = useState(false);
  
  // Add RM Params Dialog
  const [addRMParamsOpen, setAddRMParamsOpen] = useState(false);
  const [rmParamsForm, setRMParamsForm] = useState({
    rm_id: '',
    safety_stock: 0,
    moq: 1,
    batch_size: 1,
    lead_time_days: 7,
    preferred_vendor_id: ''
  });
  const [savingRMParams, setSavingRMParams] = useState(false);
  const [editingRMParam, setEditingRMParam] = useState(null);

  const getHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }), [token]);

  // Fetch dashboard stats
  const fetchDashboard = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/mrp/dashboard`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setDashboardStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard:', err);
    }
  }, [token, getHeaders]);

  // Fetch MRP runs
  const fetchMRPRuns = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/mrp/runs?limit=50`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setMrpRuns(data);
      }
    } catch (err) {
      console.error('Failed to fetch MRP runs:', err);
    }
  }, [token, getHeaders]);

  // Fetch Draft POs
  const fetchDraftPOs = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/mrp/draft-pos`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setDraftPOs(data);
      }
    } catch (err) {
      console.error('Failed to fetch draft POs:', err);
    }
  }, [token, getHeaders]);

  // Fetch Model Forecasts
  const fetchModelForecasts = useCallback(async () => {
    if (!token) return;
    try {
      let url = `${API}/api/mrp/model-forecasts`;
      if (selectedVertical) {
        url += `?vertical_id=${selectedVertical}`;
      }
      const res = await fetch(url, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setModelForecasts(data);
      }
    } catch (err) {
      console.error('Failed to fetch forecasts:', err);
    }
  }, [token, selectedVertical, getHeaders]);

  // Fetch RM Parameters
  const fetchRMParams = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/mrp/rm-params`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setRmParams(data);
      }
    } catch (err) {
      console.error('Failed to fetch RM params:', err);
    }
  }, [token, getHeaders]);

  // Fetch master data
  const fetchMasterData = useCallback(async () => {
    if (!token) return;
    try {
      const reqHeaders = getHeaders();
      const [verticalsRes, modelsRes, vendorsRes, rmRes] = await Promise.all([
        fetch(`${API}/api/verticals`, { headers: reqHeaders }),
        fetch(`${API}/api/models`, { headers: reqHeaders }),
        fetch(`${API}/api/vendors`, { headers: reqHeaders }),
        fetch(`${API}/api/raw-materials?limit=5000`, { headers: reqHeaders })
      ]);
      
      if (verticalsRes.ok) setVerticals(await verticalsRes.json());
      if (modelsRes.ok) setModels(await modelsRes.json());
      if (vendorsRes.ok) setVendors(await vendorsRes.json());
      if (rmRes.ok) {
        const rmData = await rmRes.json();
        setRawMaterials(rmData.items || rmData || []);
      }
    } catch (err) {
      console.error('Failed to fetch master data:', err);
    }
  }, [token, getHeaders]);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchDashboard(),
        fetchMRPRuns(),
        fetchDraftPOs(),
        fetchMasterData()
      ]);
      setLoading(false);
    };
    if (token) loadData();
  }, [token, fetchDashboard, fetchMRPRuns, fetchDraftPOs, fetchMasterData]);

  // Fetch forecasts when vertical changes
  useEffect(() => {
    if (token) fetchModelForecasts();
  }, [selectedVertical, token, fetchModelForecasts]);

  // Run MRP Calculation
  const runMRPCalculation = async () => {
    setCalculating(true);
    try {
      const res = await fetch(`${API}/api/mrp/runs/calculate`, {
        method: 'POST',
        headers: getHeaders()
      });
      
      const data = await res.json();
      if (res.ok) {
        toast.success(`MRP Calculation Complete`, {
          description: `${data.total_skus} SKUs, ${data.total_rms} RMs, Value: ₹${data.total_order_value?.toLocaleString()}`
        });
        fetchDashboard();
        fetchMRPRuns();
      } else {
        toast.error('Calculation Failed', { description: data.detail || 'Unknown error' });
      }
    } catch (err) {
      toast.error('Error', { description: err.message });
    }
    setCalculating(false);
  };

  // Generate Draft POs
  const generateDraftPOs = async (runId) => {
    setGeneratingPOs(true);
    try {
      const res = await fetch(`${API}/api/mrp/runs/${runId}/generate-pos`, {
        method: 'POST',
        headers: getHeaders()
      });
      
      const data = await res.json();
      if (res.ok) {
        toast.success('Draft POs Generated', {
          description: `${data.draft_pos?.length || 0} POs created`
        });
        fetchDashboard();
        fetchMRPRuns();
        fetchDraftPOs();
        setRunDetailOpen(false);
      } else {
        toast.error('Generation Failed', { description: data.detail || 'Unknown error' });
      }
    } catch (err) {
      toast.error('Error', { description: err.message });
    }
    setGeneratingPOs(false);
  };

  // Approve MRP Run
  const approveMRPRun = async (runId) => {
    try {
      const res = await fetch(`${API}/api/mrp/runs/${runId}/approve`, {
        method: 'POST',
        headers: getHeaders()
      });
      
      if (res.ok) {
        toast.success('MRP Run Approved');
        fetchMRPRuns();
        fetchDashboard();
      } else {
        const data = await res.json();
        toast.error('Approval Failed', { description: data.detail || 'Unknown error' });
      }
    } catch (err) {
      toast.error('Error', { description: err.message });
    }
  };

  // Approve Draft PO
  const approveDraftPO = async (poId) => {
    try {
      const res = await fetch(`${API}/api/mrp/draft-pos/${poId}/approve`, {
        method: 'POST',
        headers: getHeaders()
      });
      
      if (res.ok) {
        toast.success('Draft PO Approved');
        fetchDraftPOs();
        fetchDashboard();
      } else {
        const data = await res.json();
        toast.error('Approval Failed', { description: data.detail || 'Unknown error' });
      }
    } catch (err) {
      toast.error('Error', { description: err.message });
    }
  };

  // Convert Draft PO to PO
  const convertToPO = async (poId) => {
    try {
      const res = await fetch(`${API}/api/mrp/draft-pos/${poId}/convert-to-po`, {
        method: 'POST',
        headers: getHeaders()
      });
      
      const data = await res.json();
      if (res.ok) {
        toast.success('PO Created', { description: `PO Number: ${data.po_number}` });
        fetchDraftPOs();
        setPODetailOpen(false);
      } else {
        toast.error('Conversion Failed', { description: data.detail || 'Unknown error' });
      }
    } catch (err) {
      toast.error('Error', { description: err.message });
    }
  };

  // View run detail
  const viewRunDetail = async (runId) => {
    try {
      const res = await fetch(`${API}/api/mrp/runs/${runId}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSelectedRun(data);
        setRunDetailOpen(true);
      }
    } catch (err) {
      toast.error('Error loading run details');
    }
  };

  // View PO detail
  const viewPODetail = async (poId) => {
    try {
      const res = await fetch(`${API}/api/mrp/draft-pos/${poId}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSelectedPO(data);
        setPODetailOpen(true);
      }
    } catch (err) {
      toast.error('Error loading PO details');
    }
  };

  // Seed test data - FIXED: proper error handling
  const seedTestData = async () => {
    setSeeding(true);
    try {
      const res = await fetch(`${API}/api/mrp/seed-data`, {
        method: 'POST',
        headers: getHeaders()
      });
      
      const data = await res.json();
      if (res.ok) {
        toast.success('Test Data Created', {
          description: `${data.model_forecasts_created} forecasts, ${data.rm_params_created} RM params`
        });
        fetchDashboard();
        fetchModelForecasts();
        fetchRMParams();
      } else {
        toast.error('Seeding Failed', { description: data.detail || 'Unknown error' });
      }
    } catch (err) {
      toast.error('Error', { description: err.message });
    }
    setSeeding(false);
  };

  // Add Model Forecast
  const handleAddForecast = async () => {
    if (!forecastForm.model_id || !forecastForm.month_year || !forecastForm.forecast_qty) {
      toast.error('Please fill all fields');
      return;
    }
    
    setSavingForecast(true);
    try {
      const res = await fetch(`${API}/api/mrp/model-forecasts`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          model_id: forecastForm.model_id,
          month_year: forecastForm.month_year,
          forecast_qty: parseInt(forecastForm.forecast_qty)
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        toast.success('Forecast Added');
        setAddForecastOpen(false);
        setForecastForm({ model_id: '', month_year: '', forecast_qty: '' });
        fetchModelForecasts();
        fetchDashboard();
      } else {
        toast.error('Failed', { description: data.detail || 'Unknown error' });
      }
    } catch (err) {
      toast.error('Error', { description: err.message });
    }
    setSavingForecast(false);
  };

  // Delete Model Forecast
  const handleDeleteForecast = async (forecastId) => {
    if (!window.confirm('Delete this forecast?')) return;
    
    try {
      const res = await fetch(`${API}/api/mrp/model-forecasts/${forecastId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      
      if (res.ok) {
        toast.success('Forecast Deleted');
        fetchModelForecasts();
        fetchDashboard();
      } else {
        const data = await res.json();
        toast.error('Failed', { description: data.detail || 'Unknown error' });
      }
    } catch (err) {
      toast.error('Error', { description: err.message });
    }
  };

  // Add/Update RM Parameters
  const handleSaveRMParams = async () => {
    if (!rmParamsForm.rm_id) {
      toast.error('Please select a Raw Material');
      return;
    }
    
    setSavingRMParams(true);
    try {
      const res = await fetch(`${API}/api/mrp/rm-params`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          rm_id: rmParamsForm.rm_id,
          safety_stock: parseFloat(rmParamsForm.safety_stock) || 0,
          moq: parseFloat(rmParamsForm.moq) || 1,
          batch_size: parseFloat(rmParamsForm.batch_size) || 1,
          lead_time_days: parseInt(rmParamsForm.lead_time_days) || 7,
          preferred_vendor_id: rmParamsForm.preferred_vendor_id && rmParamsForm.preferred_vendor_id !== 'none' ? rmParamsForm.preferred_vendor_id : null
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        toast.success(editingRMParam ? 'Parameters Updated' : 'Parameters Added');
        setAddRMParamsOpen(false);
        setRMParamsForm({ rm_id: '', safety_stock: 0, moq: 1, batch_size: 1, lead_time_days: 7, preferred_vendor_id: '' });
        setEditingRMParam(null);
        fetchRMParams();
        fetchDashboard();
      } else {
        toast.error('Failed', { description: data.detail || 'Unknown error' });
      }
    } catch (err) {
      toast.error('Error', { description: err.message });
    }
    setSavingRMParams(false);
  };

  // Edit RM Params
  const handleEditRMParams = (param) => {
    setEditingRMParam(param);
    setRMParamsForm({
      rm_id: param.rm_id,
      safety_stock: param.safety_stock || 0,
      moq: param.moq || 1,
      batch_size: param.batch_size || 1,
      lead_time_days: param.lead_time_days || 7,
      preferred_vendor_id: param.preferred_vendor_id || ''
    });
    setAddRMParamsOpen(true);
  };

  // Generate month options for the next 12 months
  const getMonthOptions = () => {
    const options = [];
    const now = new Date();
    for (let i = 1; i <= 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      options.push({ value, label });
    }
    return options;
  };

  const getStatusBadge = (status) => {
    const styles = {
      'CALCULATED': 'bg-yellow-100 text-yellow-800',
      'APPROVED': 'bg-green-100 text-green-800',
      'PO_GENERATED': 'bg-blue-100 text-blue-800',
      'DRAFT': 'bg-gray-100 text-gray-800',
      'SENT': 'bg-purple-100 text-purple-800',
      'CANCELLED': 'bg-red-100 text-red-800'
    };
    return <Badge className={styles[status] || 'bg-gray-100'}>{status}</Badge>;
  };

  const formatCurrency = (value) => {
    if (!value) return '₹0';
    return `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-lg">Loading MRP Module...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen" data-testid="mrp-dashboard">
      <Toaster position="top-right" richColors />
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Material Requisition Planning</h1>
          <p className="text-gray-500">12-month rolling forecast with BOM explosion</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={seedTestData}
            disabled={seeding}
            data-testid="seed-data-btn"
          >
            {seeding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Settings className="h-4 w-4 mr-2" />}
            Seed Test Data
          </Button>
          <Button 
            onClick={runMRPCalculation} 
            disabled={calculating}
            data-testid="run-mrp-btn"
          >
            {calculating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Run MRP Calculation
          </Button>
        </div>
      </div>

      {/* Dashboard Stats */}
      {dashboardStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Runs</p>
                  <p className="text-2xl font-bold">{dashboardStats.total_runs}</p>
                </div>
                <Calculator className="h-8 w-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Pending Approval</p>
                  <p className="text-2xl font-bold text-yellow-600">{dashboardStats.pending_approval}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Draft POs</p>
                  <p className="text-2xl font-bold">{dashboardStats.total_draft_pos}</p>
                </div>
                <FileText className="h-8 w-8 text-purple-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">RM Shortages</p>
                  <p className="text-2xl font-bold text-red-600">{dashboardStats.total_rm_shortage}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Model Forecasts</p>
                  <p className="text-2xl font-bold">{dashboardStats.total_model_forecasts}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Pending Value</p>
                  <p className="text-lg font-bold text-blue-600">
                    {formatCurrency(dashboardStats.total_order_value_pending)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">
            <BarChart3 className="h-4 w-4 mr-2" />
            MRP Runs
          </TabsTrigger>
          <TabsTrigger value="draft-pos" data-testid="tab-draft-pos">
            <ShoppingCart className="h-4 w-4 mr-2" />
            Draft POs
          </TabsTrigger>
          <TabsTrigger value="forecasts" data-testid="tab-forecasts">
            <TrendingUp className="h-4 w-4 mr-2" />
            Model Forecasts
          </TabsTrigger>
          <TabsTrigger value="rm-params" data-testid="tab-rm-params">
            <Package className="h-4 w-4 mr-2" />
            RM Parameters
          </TabsTrigger>
        </TabsList>

        {/* MRP Runs Tab */}
        <TabsContent value="dashboard" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>MRP Calculation Runs</CardTitle>
              <CardDescription>
                History of MRP calculations with 12-month projections
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Run Code</TableHead>
                    <TableHead>Run Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">SKUs</TableHead>
                    <TableHead className="text-right">RMs</TableHead>
                    <TableHead className="text-right">Order Value</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mrpRuns.map(run => (
                    <TableRow key={run.id}>
                      <TableCell className="font-mono text-sm">{run.run_code}</TableCell>
                      <TableCell>{formatDate(run.run_date)}</TableCell>
                      <TableCell>{getStatusBadge(run.status)}</TableCell>
                      <TableCell className="text-right">{run.total_skus}</TableCell>
                      <TableCell className="text-right">{run.total_rms}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(run.total_order_value)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => viewRunDetail(run.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {run.status === 'CALCULATED' && (
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => approveMRPRun(run.id)}
                              className="text-green-600"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {mrpRuns.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        No MRP runs yet. Click "Run MRP Calculation" to start.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Draft POs Tab */}
        <TabsContent value="draft-pos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Draft Purchase Orders</CardTitle>
              <CardDescription>
                Auto-generated POs from MRP calculations - consolidated by vendor
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO Code</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>MRP Run</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Order Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {draftPOs.map(po => (
                    <TableRow key={po.id}>
                      <TableCell className="font-mono text-sm">{po.draft_po_code}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={po.vendor_name}>
                        {po.vendor_name}
                      </TableCell>
                      <TableCell className="text-xs">{po.mrp_run_code}</TableCell>
                      <TableCell className="text-right">{po.total_items}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(po.total_amount)}
                      </TableCell>
                      <TableCell>{getStatusBadge(po.status)}</TableCell>
                      <TableCell>{po.suggested_order_date}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => viewPODetail(po.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {po.status === 'DRAFT' && (
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => approveDraftPO(po.id)}
                              className="text-green-600"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                          {po.status === 'APPROVED' && po.vendor_id && (
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => convertToPO(po.id)}
                              className="text-blue-600"
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {draftPOs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                        No draft POs. Generate from an MRP run.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Model Forecasts Tab */}
        <TabsContent value="forecasts" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Model-Level Forecasts</CardTitle>
                  <CardDescription>
                    Monthly forecasts at model level - split to SKUs using rolling ratios
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={selectedVertical} onValueChange={setSelectedVertical}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Filter by Vertical" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Verticals</SelectItem>
                      {verticals.map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={fetchModelForecasts}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button onClick={() => setAddForecastOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Forecast
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vertical</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Forecast Qty</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modelForecasts.slice(0, 50).map(f => (
                    <TableRow key={f.id}>
                      <TableCell>{f.vertical_code}</TableCell>
                      <TableCell>
                        <span className="font-medium">{f.model_code}</span>
                        <span className="text-gray-500 ml-2 text-sm">{f.model_name}</span>
                      </TableCell>
                      <TableCell>{f.month_year}</TableCell>
                      <TableCell className="text-right font-medium">
                        {f.forecast_qty?.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">
                        {formatDate(f.created_at)}
                      </TableCell>
                      <TableCell>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleDeleteForecast(f.id)}
                          className="text-red-500"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {modelForecasts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        No model forecasts. Click "Add Forecast" or "Seed Test Data" to generate sample data.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {modelForecasts.length > 50 && (
                <p className="text-sm text-gray-500 text-center mt-4">
                  Showing 50 of {modelForecasts.length} forecasts
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* RM Parameters Tab */}
        <TabsContent value="rm-params" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>RM Procurement Parameters</CardTitle>
                  <CardDescription>
                    MOQ, lead times, safety stock, and preferred vendors
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={fetchRMParams}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                  <Button onClick={() => {
                    setEditingRMParam(null);
                    setRMParamsForm({ rm_id: '', safety_stock: 0, moq: 1, batch_size: 1, lead_time_days: 7, preferred_vendor_id: '' });
                    setAddRMParamsOpen(true);
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add RM Parameters
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>RM ID</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">MOQ</TableHead>
                    <TableHead className="text-right">Batch Size</TableHead>
                    <TableHead className="text-right">Lead Time</TableHead>
                    <TableHead className="text-right">Safety Stock</TableHead>
                    <TableHead>Preferred Vendor</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rmParams.slice(0, 50).map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono">{p.rm_id}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{p.category}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{p.moq}</TableCell>
                      <TableCell className="text-right">{p.batch_size}</TableCell>
                      <TableCell className="text-right">{p.lead_time_days} days</TableCell>
                      <TableCell className="text-right">{p.safety_stock}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={p.preferred_vendor_name}>
                        {p.preferred_vendor_name || <span className="text-gray-400">Not set</span>}
                      </TableCell>
                      <TableCell>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleEditRMParams(p)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rmParams.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                        No RM parameters. Click "Add RM Parameters" or "Seed Test Data" to generate defaults.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {rmParams.length > 50 && (
                <p className="text-sm text-gray-500 text-center mt-4">
                  Showing 50 of {rmParams.length} parameters
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MRP Run Detail Dialog */}
      <Dialog open={runDetailOpen} onOpenChange={setRunDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>MRP Run Details</DialogTitle>
            <DialogDescription>
              {selectedRun?.run_code} - {formatDate(selectedRun?.run_date)}
            </DialogDescription>
          </DialogHeader>
          
          {selectedRun && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-gray-500">Total SKUs</p>
                    <p className="text-2xl font-bold">{selectedRun.total_skus}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-gray-500">Total RMs</p>
                    <p className="text-2xl font-bold">{selectedRun.total_rms}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-gray-500">Status</p>
                    <p className="mt-1">{getStatusBadge(selectedRun.status)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-gray-500">Order Value</p>
                    <p className="text-xl font-bold text-blue-600">
                      {formatCurrency(selectedRun.total_order_value)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* RM Requirements Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">RM Requirements (Top 20)</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>RM ID</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Required</TableHead>
                        <TableHead className="text-right">Stock</TableHead>
                        <TableHead className="text-right">Net Req</TableHead>
                        <TableHead className="text-right">Order Qty</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedRun.rm_requirements?.slice(0, 20).map((rm, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-xs">{rm.rm_id}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{rm.category}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{rm.total_required?.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{rm.current_stock?.toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            <span className={rm.net_requirement > 0 ? 'text-red-600 font-medium' : ''}>
                              {rm.net_requirement?.toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {rm.order_qty?.toLocaleString()}
                          </TableCell>
                          <TableCell className="max-w-[150px] truncate text-xs" title={rm.vendor_name}>
                            {rm.vendor_name || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(rm.total_cost)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
          
          <DialogFooter>
            {selectedRun?.status === 'CALCULATED' && (
              <Button 
                onClick={() => generateDraftPOs(selectedRun.id)}
                disabled={generatingPOs}
              >
                {generatingPOs ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                Generate Draft POs
              </Button>
            )}
            <Button variant="outline" onClick={() => setRunDetailOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Draft PO Detail Dialog */}
      <Dialog open={poDetailOpen} onOpenChange={setPODetailOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Draft PO Details</DialogTitle>
            <DialogDescription>
              {selectedPO?.draft_po_code} - {selectedPO?.vendor_name}
            </DialogDescription>
          </DialogHeader>
          
          {selectedPO && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  {getStatusBadge(selectedPO.status)}
                </div>
                <div>
                  <p className="text-sm text-gray-500">Order Date</p>
                  <p className="font-medium">{selectedPO.suggested_order_date}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Amount</p>
                  <p className="font-bold text-blue-600">{formatCurrency(selectedPO.total_amount)}</p>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>RM ID</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Line Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedPO.lines?.slice(0, 30).map((line, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-xs">{line.rm_id}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{line.category}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{line.quantity?.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{formatCurrency(line.unit_price)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(line.line_total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {selectedPO.lines?.length > 30 && (
                <p className="text-sm text-gray-500 text-center">
                  Showing 30 of {selectedPO.lines.length} line items
                </p>
              )}
            </div>
          )}
          
          <DialogFooter>
            {selectedPO?.status === 'APPROVED' && selectedPO?.vendor_id && (
              <Button onClick={() => convertToPO(selectedPO.id)}>
                <Send className="h-4 w-4 mr-2" />
                Convert to PO
              </Button>
            )}
            <Button variant="outline" onClick={() => setPODetailOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Model Forecast Dialog */}
      <Dialog open={addForecastOpen} onOpenChange={setAddForecastOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Model Forecast</DialogTitle>
            <DialogDescription>
              Add a monthly forecast quantity for a specific model
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Model *</Label>
              <Select 
                value={forecastForm.model_id} 
                onValueChange={(v) => setForecastForm({...forecastForm, model_id: v})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {models.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.code} - {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Month *</Label>
              <Select 
                value={forecastForm.month_year} 
                onValueChange={(v) => setForecastForm({...forecastForm, month_year: v})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {getMonthOptions().map(m => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Forecast Quantity *</Label>
              <Input
                type="number"
                placeholder="Enter quantity"
                value={forecastForm.forecast_qty}
                onChange={(e) => setForecastForm({...forecastForm, forecast_qty: e.target.value})}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddForecastOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddForecast} disabled={savingForecast}>
              {savingForecast ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Add Forecast
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit RM Parameters Dialog */}
      <Dialog open={addRMParamsOpen} onOpenChange={setAddRMParamsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRMParam ? 'Edit RM Parameters' : 'Add RM Parameters'}</DialogTitle>
            <DialogDescription>
              Configure procurement parameters for a raw material
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Raw Material *</Label>
              <Select 
                value={rmParamsForm.rm_id} 
                onValueChange={(v) => setRMParamsForm({...rmParamsForm, rm_id: v})}
                disabled={!!editingRMParam}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select raw material" />
                </SelectTrigger>
                <SelectContent>
                  {rawMaterials.slice(0, 200).map(rm => (
                    <SelectItem key={rm.rm_id} value={rm.rm_id}>
                      {rm.rm_id} - {rm.name?.substring(0, 30)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>MOQ</Label>
                <Input
                  type="number"
                  value={rmParamsForm.moq}
                  onChange={(e) => setRMParamsForm({...rmParamsForm, moq: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Batch Size</Label>
                <Input
                  type="number"
                  value={rmParamsForm.batch_size}
                  onChange={(e) => setRMParamsForm({...rmParamsForm, batch_size: e.target.value})}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Lead Time (days)</Label>
                <Input
                  type="number"
                  value={rmParamsForm.lead_time_days}
                  onChange={(e) => setRMParamsForm({...rmParamsForm, lead_time_days: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Safety Stock</Label>
                <Input
                  type="number"
                  value={rmParamsForm.safety_stock}
                  onChange={(e) => setRMParamsForm({...rmParamsForm, safety_stock: e.target.value})}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Preferred Vendor (Optional)</Label>
              <Select 
                value={rmParamsForm.preferred_vendor_id} 
                onValueChange={(v) => setRMParamsForm({...rmParamsForm, preferred_vendor_id: v})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select vendor (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No preferred vendor</SelectItem>
                  {vendors.slice(0, 100).map(v => (
                    <SelectItem key={v.id || v.vendor_id} value={v.id || v.vendor_id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAddRMParamsOpen(false);
              setEditingRMParam(null);
            }}>
              Cancel
            </Button>
            <Button onClick={handleSaveRMParams} disabled={savingRMParams}>
              {savingRMParams ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              {editingRMParam ? 'Update' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

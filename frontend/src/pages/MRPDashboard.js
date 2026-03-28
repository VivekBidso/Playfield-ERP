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
  Download,
  Edit,
  X,
  Calendar,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Filter,
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
  const [runViewTab, setRunViewTab] = useState('requirements');
  const [weeklyRequirements, setWeeklyRequirements] = useState(null);
  const [selectedWeeks, setSelectedWeeks] = useState(12);
  
  // Draft POs state
  const [draftPOs, setDraftPOs] = useState([]);
  const [selectedPO, setSelectedPO] = useState(null);
  const [poDetailOpen, setPODetailOpen] = useState(false);
  
  // Model Forecasts state - Pivot format
  const [forecastPivot, setForecastPivot] = useState(null);
  const [verticals, setVerticals] = useState([]);
  const [selectedVertical, setSelectedVertical] = useState('');
  const [editingForecasts, setEditingForecasts] = useState({});
  const [savingForecasts, setSavingForecasts] = useState(false);
  
  // RM Parameters state
  const [rmParams, setRmParams] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [rmParamsPage, setRmParamsPage] = useState(1);
  const [rmParamsSearch, setRmParamsSearch] = useState('');
  const rmParamsPerPage = 50;
  
  // Calculation state
  const [calculating, setCalculating] = useState(false);
  const [generatingPOs, setGeneratingPOs] = useState(false);
  const [seeding, setSeeding] = useState(false);
  
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
  
  // Upload state
  const [uploading, setUploading] = useState(false);

  // Weekly Order Plan state
  const [weeklyPlanRuns, setWeeklyPlanRuns] = useState([]);
  const [selectedWeeklyRun, setSelectedWeeklyRun] = useState(null);
  const [weeklyPlan, setWeeklyPlan] = useState([]);
  const [weeklyPlanFilter, setWeeklyPlanFilter] = useState('all'); // all, common, brand_specific
  const [loadingWeeklyPlan, setLoadingWeeklyPlan] = useState(false);
  const [expandedWeeks, setExpandedWeeks] = useState({});
  const [calculatingWeekly, setCalculatingWeekly] = useState(false);
  
  // Quick Filter state for Weekly Plan
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [weeklyPlanCategories, setWeeklyPlanCategories] = useState([]);
  const [weeklyPlanVendors, setWeeklyPlanVendors] = useState([]);
  
  // Weekly PO Generation state
  const [selectedWeeksForPO, setSelectedWeeksForPO] = useState([]);
  const [showPOPreviewDialog, setShowPOPreviewDialog] = useState(false);
  const [poPreviewData, setPOPreviewData] = useState(null);
  const [loadingPOPreview, setLoadingPOPreview] = useState(false);
  const [weeklyDraftPOs, setWeeklyDraftPOs] = useState([]);
  const [showEditPODialog, setShowEditPODialog] = useState(false);
  const [editingPO, setEditingPO] = useState(null);

  const getHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }), [token]);

  // Filter weekly plan items based on category and vendor filters
  const getFilteredWeeklyPlan = useCallback(() => {
    if (!weeklyPlan.length) return [];
    if (categoryFilter === 'all' && vendorFilter === 'all') return weeklyPlan;
    
    return weeklyPlan.map(week => {
      const filteredItems = (week.items || []).filter(item => {
        const categoryMatch = categoryFilter === 'all' || item.category === categoryFilter;
        const vendorMatch = vendorFilter === 'all' || item.vendor_name === vendorFilter;
        return categoryMatch && vendorMatch;
      });
      
      return {
        ...week,
        items: filteredItems,
        week_summary: {
          total_items: filteredItems.length,
          total_cost: filteredItems.reduce((sum, item) => sum + (item.total_cost || 0), 0)
        }
      };
    }).filter(week => week.items.length > 0); // Hide weeks with no matching items
  }, [weeklyPlan, categoryFilter, vendorFilter]);

  // Clear filters
  const clearFilters = () => {
    setCategoryFilter('all');
    setVendorFilter('all');
  };

  // Toggle week selection for PO generation
  const toggleWeekForPO = (orderWeek) => {
    setSelectedWeeksForPO(prev => 
      prev.includes(orderWeek) 
        ? prev.filter(w => w !== orderWeek)
        : [...prev, orderWeek]
    );
  };

  // Select next N weeks for PO generation
  const selectNextNWeeks = (n) => {
    const sortedWeeks = getFilteredWeeklyPlan()
      .map(w => w.order_week)
      .sort()
      .slice(0, n);
    setSelectedWeeksForPO(sortedWeeks);
  };

  // Preview Weekly POs
  const previewWeeklyPOs = async () => {
    if (!selectedWeeklyRun || selectedWeeksForPO.length === 0) return;
    setLoadingPOPreview(true);
    try {
      const res = await fetch(
        `${API}/api/mrp/runs/${selectedWeeklyRun.id}/weekly-pos/preview`,
        {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(selectedWeeksForPO)
        }
      );
      if (res.ok) {
        const data = await res.json();
        setPOPreviewData(data);
        setShowPOPreviewDialog(true);
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Failed to preview POs');
      }
    } catch (err) {
      console.error('Failed to preview POs:', err);
      toast.error('Failed to preview POs');
    }
    setLoadingPOPreview(false);
  };

  // Download Weekly PO Template
  const downloadPOTemplate = async () => {
    if (!selectedWeeklyRun || selectedWeeksForPO.length === 0) return;
    try {
      const res = await fetch(
        `${API}/api/mrp/runs/${selectedWeeklyRun.id}/weekly-pos/download-template`,
        {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(selectedWeeksForPO)
        }
      );
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Weekly_PO_Template_${selectedWeeklyRun.run_code}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success('Template downloaded');
      } else {
        toast.error('Failed to download template');
      }
    } catch (err) {
      console.error('Download failed:', err);
      toast.error('Failed to download template');
    }
  };

  // Upload Weekly PO File
  const uploadPOFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedWeeklyRun) return;
    
    setGeneratingPOs(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await fetch(
        `${API}/api/mrp/runs/${selectedWeeklyRun.id}/weekly-pos/upload`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        }
      );
      const data = await res.json();
      if (res.ok) {
        toast.success(`Created ${data.created_pos?.length || 0} Draft POs`);
        fetchWeeklyDraftPOs();
        setSelectedWeeksForPO([]);
        setShowPOPreviewDialog(false);
        if (data.errors?.length > 0) {
          toast.warning(`${data.errors.length} rows had errors`);
        }
      } else {
        toast.error(data.detail?.message || data.detail || 'Failed to upload');
      }
    } catch (err) {
      console.error('Upload failed:', err);
      toast.error('Failed to upload file');
    }
    setGeneratingPOs(false);
    e.target.value = null;
  };

  // Fetch Weekly Draft POs
  const fetchWeeklyDraftPOs = useCallback(async () => {
    if (!token || !selectedWeeklyRun) return;
    try {
      const res = await fetch(
        `${API}/api/mrp/weekly-draft-pos?run_id=${selectedWeeklyRun.id}&limit=50`,
        { headers: getHeaders() }
      );
      if (res.ok) {
        const data = await res.json();
        setWeeklyDraftPOs(data);
      }
    } catch (err) {
      console.error('Failed to fetch weekly draft POs:', err);
    }
  }, [token, selectedWeeklyRun, getHeaders]);

  // Update Weekly Draft PO Line
  const updatePOLineQty = async (poId, rmId, newQty) => {
    try {
      const res = await fetch(
        `${API}/api/mrp/weekly-draft-pos/${poId}/line/${rmId}`,
        {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify({ quantity: parseFloat(newQty) })
        }
      );
      if (res.ok) {
        toast.success('Quantity updated');
        fetchWeeklyDraftPOs();
        if (editingPO) {
          // Refresh editing PO data
          const poRes = await fetch(`${API}/api/mrp/draft-pos/${poId}`, { headers: getHeaders() });
          if (poRes.ok) {
            setEditingPO(await poRes.json());
          }
        }
      } else {
        toast.error('Failed to update quantity');
      }
    } catch (err) {
      toast.error('Failed to update quantity');
    }
  };

  // Update Weekly Draft PO Vendor
  const updatePOVendor = async (poId, vendorId) => {
    try {
      const res = await fetch(
        `${API}/api/mrp/weekly-draft-pos/${poId}`,
        {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify({ vendor_id: vendorId })
        }
      );
      if (res.ok) {
        toast.success('Vendor updated');
        fetchWeeklyDraftPOs();
      } else {
        toast.error('Failed to update vendor');
      }
    } catch (err) {
      toast.error('Failed to update vendor');
    }
  };

  // Approve Weekly Draft PO
  const approveWeeklyDraftPO = async (poId) => {
    try {
      const res = await fetch(
        `${API}/api/mrp/draft-pos/${poId}/approve`,
        { method: 'PUT', headers: getHeaders() }
      );
      if (res.ok) {
        toast.success('Draft PO approved');
        fetchWeeklyDraftPOs();
        fetchDraftPOs();
      } else {
        toast.error('Failed to approve');
      }
    } catch (err) {
      toast.error('Failed to approve');
    }
  };

  // Convert to Actual PO
  const convertToPO = async (poId) => {
    try {
      const res = await fetch(
        `${API}/api/mrp/draft-pos/${poId}/convert`,
        { method: 'POST', headers: getHeaders() }
      );
      if (res.ok) {
        const data = await res.json();
        toast.success(`Created PO: ${data.po_number}`);
        fetchWeeklyDraftPOs();
        fetchDraftPOs();
        fetchDashboard();
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Failed to convert');
      }
    } catch (err) {
      toast.error('Failed to convert to PO');
    }
  };

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

  // Fetch Model Forecasts in Pivot format
  const fetchForecastPivot = useCallback(async () => {
    if (!token) return;
    try {
      let url = `${API}/api/mrp/model-forecasts/pivot`;
      if (selectedVertical && selectedVertical !== 'all') {
        url += `?vertical_id=${selectedVertical}`;
      }
      const res = await fetch(url, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setForecastPivot(data);
        setEditingForecasts({});
      }
    } catch (err) {
      console.error('Failed to fetch forecast pivot:', err);
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

  // Fetch Weekly MRP Runs
  const fetchWeeklyRuns = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/mrp/runs?limit=50`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        // Filter runs that have weekly plan data (version WEEKLY_V1 or have common_weeks_count)
        const weeklyRuns = data.filter(run => 
          run.version === 'WEEKLY_V1' || run.common_weeks_count > 0
        );
        setWeeklyPlanRuns(weeklyRuns);
        // Auto-select the latest weekly run
        if (weeklyRuns.length > 0 && !selectedWeeklyRun) {
          setSelectedWeeklyRun(weeklyRuns[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch weekly runs:', err);
    }
  }, [token, getHeaders, selectedWeeklyRun]);

  // Fetch Weekly Order Plan
  const fetchWeeklyPlan = useCallback(async (runId, planType = 'all') => {
    if (!token || !runId) return;
    setLoadingWeeklyPlan(true);
    try {
      const res = await fetch(
        `${API}/api/mrp/runs/${runId}/weekly-plan?plan_type=${planType}`,
        { headers: getHeaders() }
      );
      if (res.ok) {
        const data = await res.json();
        const plan = data.weekly_plan || [];
        setWeeklyPlan(plan);
        
        // Extract unique categories and vendors for Quick Filter
        const categories = new Set();
        const vendors = new Set();
        plan.forEach(week => {
          (week.items || []).forEach(item => {
            if (item.category) categories.add(item.category);
            if (item.vendor_name) vendors.add(item.vendor_name);
          });
        });
        setWeeklyPlanCategories(Array.from(categories).sort());
        setWeeklyPlanVendors(Array.from(vendors).sort());
      }
    } catch (err) {
      console.error('Failed to fetch weekly plan:', err);
    }
    setLoadingWeeklyPlan(false);
  }, [token, getHeaders]);

  // Calculate Weekly MRP
  const calculateWeeklyMRP = async () => {
    setCalculatingWeekly(true);
    try {
      const res = await fetch(`${API}/api/mrp/runs/calculate-weekly`, {
        method: 'POST',
        headers: getHeaders()
      });
      
      if (res.ok) {
        const data = await res.json();
        toast.success('Weekly MRP calculation completed', {
          description: `Run: ${data.run_code}`
        });
        fetchWeeklyRuns();
        fetchMRPRuns();
      } else {
        const error = await res.json();
        toast.error('Failed to calculate weekly MRP', {
          description: error.detail || 'Unknown error'
        });
      }
    } catch (err) {
      toast.error('Failed to calculate weekly MRP', {
        description: err.message
      });
    }
    setCalculatingWeekly(false);
  };

  // Export Weekly Plan
  const exportWeeklyPlan = async () => {
    if (!selectedWeeklyRun) return;
    
    try {
      const res = await fetch(
        `${API}/api/mrp/runs/${selectedWeeklyRun.id}/weekly-plan/export?plan_type=${weeklyPlanFilter}`,
        { headers: getHeaders() }
      );
      
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `weekly_order_plan_${selectedWeeklyRun.run_code}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        toast.success('Export downloaded');
      } else {
        toast.error('Failed to export');
      }
    } catch (err) {
      toast.error('Export failed', { description: err.message });
    }
  };

  // Toggle week expansion
  const toggleWeekExpansion = (orderWeek) => {
    setExpandedWeeks(prev => ({
      ...prev,
      [orderWeek]: !prev[orderWeek]
    }));
  };

  // Fetch master data
  const fetchMasterData = useCallback(async () => {
    if (!token) return;
    try {
      const reqHeaders = getHeaders();
      const [verticalsRes, vendorsRes, rmRes] = await Promise.all([
        fetch(`${API}/api/verticals`, { headers: reqHeaders }),
        fetch(`${API}/api/vendors`, { headers: reqHeaders }),
        fetch(`${API}/api/raw-materials?limit=5000`, { headers: reqHeaders })
      ]);
      
      if (verticalsRes.ok) setVerticals(await verticalsRes.json());
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
        fetchMasterData(),
        fetchWeeklyRuns()
      ]);
      setLoading(false);
    };
    if (token) loadData();
  }, [token, fetchDashboard, fetchMRPRuns, fetchDraftPOs, fetchMasterData, fetchWeeklyRuns]);

  // Fetch forecasts when vertical changes or tab switches
  useEffect(() => {
    if (token && activeTab === 'forecasts') {
      fetchForecastPivot();
    }
  }, [selectedVertical, token, activeTab, fetchForecastPivot]);

  // Fetch RM params when tab switches
  useEffect(() => {
    if (token && activeTab === 'rm-params') {
      fetchRMParams();
    }
  }, [token, activeTab, fetchRMParams]);

  // Fetch weekly plan when run or filter changes
  useEffect(() => {
    if (token && activeTab === 'weekly-plan' && selectedWeeklyRun) {
      fetchWeeklyPlan(selectedWeeklyRun.id, weeklyPlanFilter);
      fetchWeeklyDraftPOs();
    }
  }, [token, activeTab, selectedWeeklyRun, weeklyPlanFilter, fetchWeeklyPlan, fetchWeeklyDraftPOs]);

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

  // View run detail with weekly requirements
  const viewRunDetail = async (runId) => {
    try {
      const [runRes, weeklyRes] = await Promise.all([
        fetch(`${API}/api/mrp/runs/${runId}`, { headers: getHeaders() }),
        fetch(`${API}/api/mrp/runs/${runId}/weekly-requirements?weeks=${selectedWeeks}`, { headers: getHeaders() })
      ]);
      
      if (runRes.ok) {
        const runData = await runRes.json();
        setSelectedRun(runData);
      }
      
      if (weeklyRes.ok) {
        const weeklyData = await weeklyRes.json();
        setWeeklyRequirements(weeklyData);
      }
      
      setRunDetailOpen(true);
    } catch (err) {
      toast.error('Error loading run details');
    }
  };

  // Refresh weekly requirements with different weeks
  const refreshWeeklyRequirements = async (weeks) => {
    if (!selectedRun) return;
    setSelectedWeeks(weeks);
    try {
      const res = await fetch(`${API}/api/mrp/runs/${selectedRun.id}/weekly-requirements?weeks=${weeks}`, { 
        headers: getHeaders() 
      });
      if (res.ok) {
        const data = await res.json();
        setWeeklyRequirements(data);
      }
    } catch (err) {
      console.error('Failed to fetch weekly requirements:', err);
    }
  };

  // Download MRP run results
  const downloadRunResults = async (runId) => {
    try {
      const res = await fetch(`${API}/api/mrp/runs/${runId}/download`, { 
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mrp_run_${runId}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        toast.success('Download started');
      } else {
        toast.error('Download failed');
      }
    } catch (err) {
      toast.error('Error', { description: err.message });
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

  // Seed test data
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
        fetchForecastPivot();
        fetchRMParams();
      } else {
        toast.error('Seeding Failed', { description: data.detail || 'Unknown error' });
      }
    } catch (err) {
      toast.error('Error', { description: err.message });
    }
    setSeeding(false);
  };

  // Update forecast in pivot
  const handleForecastChange = (modelId, monthYear, value) => {
    setEditingForecasts(prev => ({
      ...prev,
      [`${modelId}_${monthYear}`]: value
    }));
  };

  // Save edited forecasts
  const saveForecasts = async () => {
    const changes = Object.entries(editingForecasts);
    if (changes.length === 0) {
      toast.info('No changes to save');
      return;
    }
    
    setSavingForecasts(true);
    try {
      const forecasts = changes.map(([key, value]) => {
        const [modelId, monthYear] = key.split('_').slice(0, 2);
        const actualMonthYear = key.substring(modelId.length + 1);
        return {
          model_id: modelId,
          month_year: actualMonthYear,
          forecast_qty: parseInt(value) || 0
        };
      });
      
      const res = await fetch(`${API}/api/mrp/model-forecasts/bulk`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(forecasts)
      });
      
      const data = await res.json();
      if (res.ok) {
        toast.success('Forecasts Saved', {
          description: `${data.created} created, ${data.updated} updated`
        });
        fetchForecastPivot();
        fetchDashboard();
      } else {
        toast.error('Save Failed', { description: data.detail || 'Unknown error' });
      }
    } catch (err) {
      toast.error('Error', { description: err.message });
    }
    setSavingForecasts(false);
  };

  // Download forecast template
  const downloadForecastTemplate = async () => {
    try {
      const res = await fetch(`${API}/api/mrp/model-forecasts/template`, { 
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'model_forecast_template.xlsx';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        toast.success('Template downloaded');
      } else {
        toast.error('Download failed');
      }
    } catch (err) {
      toast.error('Error', { description: err.message });
    }
  };

  // Upload forecasts
  const handleForecastUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch(`${API}/api/mrp/model-forecasts/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      const data = await res.json();
      if (res.ok) {
        toast.success('Forecasts Uploaded', {
          description: `${data.created} created, ${data.updated} updated`
        });
        fetchForecastPivot();
        fetchDashboard();
      } else {
        toast.error('Upload Failed', { description: data.detail || 'Unknown error' });
      }
    } catch (err) {
      toast.error('Error', { description: err.message });
    }
    setUploading(false);
    e.target.value = '';
  };

  // Download RM params template
  const downloadRMParamsTemplate = async () => {
    try {
      const res = await fetch(`${API}/api/mrp/rm-params/template`, { 
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'rm_parameters_template.xlsx';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        toast.success('Template downloaded');
      } else {
        toast.error('Download failed');
      }
    } catch (err) {
      toast.error('Error', { description: err.message });
    }
  };

  // Upload RM params
  const handleRMParamsUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch(`${API}/api/mrp/rm-params/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      const data = await res.json();
      if (res.ok) {
        toast.success('Parameters Uploaded', {
          description: `${data.created} created, ${data.updated} updated`
        });
        fetchRMParams();
        fetchDashboard();
      } else {
        toast.error('Upload Failed', { description: data.detail || 'Unknown error' });
      }
    } catch (err) {
      toast.error('Error', { description: err.message });
    }
    setUploading(false);
    e.target.value = '';
  };

  // Save RM Parameters
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
        <TabsList className="grid w-full grid-cols-5">
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
          <TabsTrigger value="weekly-plan" data-testid="tab-weekly-plan">
            <Calendar className="h-4 w-4 mr-2" />
            Weekly Order Plan
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
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => downloadRunResults(run.id)}
                            title="Download Excel"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          {run.status === 'CALCULATED' && (
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => approveMRPRun(run.id)}
                              className="text-green-600"
                              title="Approve"
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

        {/* Model Forecasts Tab - Pivot Format */}
        <TabsContent value="forecasts" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Model-Level Forecasts</CardTitle>
                  <CardDescription>
                    Monthly forecasts in pivot format (Model × Month)
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={selectedVertical} onValueChange={setSelectedVertical}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="All Verticals" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Verticals</SelectItem>
                      {verticals.map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={fetchForecastPivot}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" onClick={downloadForecastTemplate}>
                    <Download className="h-4 w-4 mr-2" />
                    Template
                  </Button>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleForecastUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      disabled={uploading}
                    />
                    <Button variant="outline" disabled={uploading}>
                      {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                      Upload
                    </Button>
                  </div>
                  {Object.keys(editingForecasts).length > 0 && (
                    <Button onClick={saveForecasts} disabled={savingForecasts}>
                      {savingForecasts ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                      Save Changes ({Object.keys(editingForecasts).length})
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {forecastPivot ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-white z-10 min-w-[120px]">Model</TableHead>
                        <TableHead className="min-w-[100px]">Vertical</TableHead>
                        {forecastPivot.months?.map(m => (
                          <TableHead key={m.month_year} className="text-center min-w-[80px]">
                            {m.display}
                          </TableHead>
                        ))}
                        <TableHead className="text-right font-bold">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {forecastPivot.models?.slice(0, 100).map(model => (
                        <TableRow key={model.model_id}>
                          <TableCell className="sticky left-0 bg-white z-10 font-medium">
                            {model.model_code}
                            <span className="text-gray-400 text-xs block">{model.model_name}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{model.vertical_code}</Badge>
                          </TableCell>
                          {forecastPivot.months?.map(m => {
                            const key = `${model.model_id}_${m.month_year}`;
                            const currentValue = editingForecasts[key] !== undefined 
                              ? editingForecasts[key] 
                              : model.forecasts[m.month_year];
                            return (
                              <TableCell key={m.month_year} className="p-1">
                                <Input
                                  type="number"
                                  className="w-20 h-8 text-center text-sm"
                                  value={currentValue || ''}
                                  placeholder="-"
                                  onChange={(e) => handleForecastChange(model.model_id, m.month_year, e.target.value)}
                                />
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-right font-bold">
                            {model.total?.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!forecastPivot.models || forecastPivot.models.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={forecastPivot.months?.length + 3 || 15} className="text-center py-8 text-gray-500">
                            No models found. Use "Seed Test Data" or upload a forecast file.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  {forecastPivot.models?.length > 100 && (
                    <p className="text-sm text-gray-500 text-center mt-4">
                      Showing 100 of {forecastPivot.models.length} models
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Loading forecast data...
                </div>
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
                  <Button variant="outline" onClick={downloadRMParamsTemplate}>
                    <Download className="h-4 w-4 mr-2" />
                    Template
                  </Button>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleRMParamsUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      disabled={uploading}
                    />
                    <Button variant="outline" disabled={uploading}>
                      {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                      Upload
                    </Button>
                  </div>
                  <Button onClick={() => {
                    setEditingRMParam(null);
                    setRMParamsForm({ rm_id: '', safety_stock: 0, moq: 1, batch_size: 1, lead_time_days: 7, preferred_vendor_id: '' });
                    setAddRMParamsOpen(true);
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Search and Pagination Controls */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by RM ID or Vendor..."
                    value={rmParamsSearch}
                    onChange={(e) => {
                      setRmParamsSearch(e.target.value);
                      setRmParamsPage(1);
                    }}
                    className="w-[300px]"
                  />
                </div>
                <div className="text-sm text-gray-500">
                  Total: {rmParams.filter(p => 
                    !rmParamsSearch || 
                    p.rm_id?.toLowerCase().includes(rmParamsSearch.toLowerCase()) ||
                    p.preferred_vendor_name?.toLowerCase().includes(rmParamsSearch.toLowerCase()) ||
                    p.category?.toLowerCase().includes(rmParamsSearch.toLowerCase())
                  ).length} parameters
                </div>
              </div>
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
                  {rmParams
                    .filter(p => 
                      !rmParamsSearch || 
                      p.rm_id?.toLowerCase().includes(rmParamsSearch.toLowerCase()) ||
                      p.preferred_vendor_name?.toLowerCase().includes(rmParamsSearch.toLowerCase()) ||
                      p.category?.toLowerCase().includes(rmParamsSearch.toLowerCase())
                    )
                    .slice((rmParamsPage - 1) * rmParamsPerPage, rmParamsPage * rmParamsPerPage)
                    .map(p => (
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
                        No RM parameters. Click "Add" or upload a template.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {/* Pagination */}
              {(() => {
                const filteredParams = rmParams.filter(p => 
                  !rmParamsSearch || 
                  p.rm_id?.toLowerCase().includes(rmParamsSearch.toLowerCase()) ||
                  p.preferred_vendor_name?.toLowerCase().includes(rmParamsSearch.toLowerCase()) ||
                  p.category?.toLowerCase().includes(rmParamsSearch.toLowerCase())
                );
                const totalPages = Math.ceil(filteredParams.length / rmParamsPerPage);
                
                if (totalPages <= 1) return null;
                
                return (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRmParamsPage(1)}
                      disabled={rmParamsPage === 1}
                    >
                      First
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRmParamsPage(p => Math.max(1, p - 1))}
                      disabled={rmParamsPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm px-4">
                      Page {rmParamsPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRmParamsPage(p => Math.min(totalPages, p + 1))}
                      disabled={rmParamsPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRmParamsPage(totalPages)}
                      disabled={rmParamsPage === totalPages}
                    >
                      Last
                    </Button>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Weekly Order Plan Tab */}
        <TabsContent value="weekly-plan" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Weekly Order Plan</CardTitle>
                  <CardDescription>
                    Time-phased procurement schedule with 7-day site buffer
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={calculateWeeklyMRP}
                    disabled={calculatingWeekly}
                    data-testid="calculate-weekly-btn"
                  >
                    {calculatingWeekly ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Calculating...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Run Weekly MRP
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">MRP Run:</label>
                  <Select
                    value={selectedWeeklyRun?.id || ''}
                    onValueChange={(val) => {
                      const run = weeklyPlanRuns.find(r => r.id === val);
                      setSelectedWeeklyRun(run);
                    }}
                  >
                    <SelectTrigger className="w-[250px]">
                      <SelectValue placeholder="Select a run" />
                    </SelectTrigger>
                    <SelectContent>
                      {weeklyPlanRuns.map(run => (
                        <SelectItem key={run.id} value={run.id}>
                          {run.run_code} ({formatDate(run.run_date)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Type:</label>
                  <Select
                    value={weeklyPlanFilter}
                    onValueChange={setWeeklyPlanFilter}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Parts</SelectItem>
                      <SelectItem value="common">Common Only</SelectItem>
                      <SelectItem value="brand_specific">Brand-Specific Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button variant="outline" onClick={exportWeeklyPlan} disabled={!selectedWeeklyRun}>
                  <Download className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>
              </div>
              
              {/* Quick Filters */}
              {weeklyPlan.length > 0 && (
                <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Quick Filter:</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Category:</label>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="w-[140px] h-8">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {weeklyPlanCategories.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Vendor:</label>
                    <Select value={vendorFilter} onValueChange={setVendorFilter}>
                      <SelectTrigger className="w-[200px] h-8">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Vendors</SelectItem>
                        {weeklyPlanVendors.map(vendor => (
                          <SelectItem key={vendor} value={vendor}>{vendor}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {(categoryFilter !== 'all' || vendorFilter !== 'all') && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8">
                      <X className="h-3 w-3 mr-1" />
                      Clear
                    </Button>
                  )}
                  
                  {(categoryFilter !== 'all' || vendorFilter !== 'all') && (
                    <Badge variant="secondary" className="ml-auto">
                      Showing {getFilteredWeeklyPlan().reduce((sum, w) => sum + w.items.length, 0)} items
                    </Badge>
                  )}
                </div>
              )}

              {/* Summary Cards */}
              {selectedWeeklyRun?.summary && (
                <div className="grid grid-cols-5 gap-4 mb-6">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-gray-500">Order Weeks</p>
                      <p className="text-2xl font-bold">{selectedWeeklyRun.summary.total_order_weeks || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-gray-500">Common RMs</p>
                      <p className="text-2xl font-bold">{selectedWeeklyRun.summary.common_rms_count || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-gray-500">Common Value</p>
                      <p className="text-lg font-bold text-blue-600">
                        {formatCurrency(selectedWeeklyRun.summary.common_order_value || 0)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-gray-500">Brand-Specific RMs</p>
                      <p className="text-2xl font-bold">{selectedWeeklyRun.summary.brand_specific_rms_count || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-gray-500">Total Value</p>
                      <p className="text-lg font-bold text-green-600">
                        {formatCurrency(selectedWeeklyRun.summary.total_order_value || 0)}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* PO Generation Toolbar */}
              {weeklyPlan.length > 0 && (
                <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">Generate POs:</span>
                  </div>
                  
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => selectNextNWeeks(4)}
                    className="h-8"
                  >
                    Select Next 4 Weeks
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedWeeksForPO(getFilteredWeeklyPlan().map(w => w.order_week))}
                    className="h-8"
                  >
                    Select All Weeks
                  </Button>
                  
                  {selectedWeeksForPO.length > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setSelectedWeeksForPO([])}
                      className="h-8"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Clear ({selectedWeeksForPO.length})
                    </Button>
                  )}
                  
                  <div className="ml-auto flex items-center gap-2">
                    {selectedWeeksForPO.length > 0 && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={downloadPOTemplate}
                          className="h-8"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download Template
                        </Button>
                        
                        <label className="cursor-pointer">
                          <input 
                            type="file" 
                            accept=".xlsx,.xls" 
                            className="hidden" 
                            onChange={uploadPOFile}
                            disabled={generatingPOs}
                          />
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8"
                            asChild
                          >
                            <span>
                              <Upload className="h-3 w-3 mr-1" />
                              Upload POs
                            </span>
                          </Button>
                        </label>
                        
                        <Button
                          size="sm"
                          onClick={previewWeeklyPOs}
                          disabled={loadingPOPreview}
                          className="h-8 bg-blue-600 hover:bg-blue-700"
                        >
                          {loadingPOPreview ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Eye className="h-3 w-3 mr-1" />
                          )}
                          Preview POs
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
              
              {/* Weekly Draft POs Section */}
              {weeklyDraftPOs.length > 0 && (
                <Card className="mb-6 border-green-200 bg-green-50">
                  <CardHeader className="py-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      Weekly Draft POs ({weeklyDraftPOs.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>PO Code</TableHead>
                          <TableHead>Vendor</TableHead>
                          <TableHead>Weeks</TableHead>
                          <TableHead className="text-right">Items</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {weeklyDraftPOs.map(po => (
                          <TableRow key={po.id}>
                            <TableCell className="font-mono text-sm">{po.draft_po_code}</TableCell>
                            <TableCell className="max-w-[180px] truncate">{po.vendor_name}</TableCell>
                            <TableCell className="text-xs">
                              {po.weeks_covered?.slice(0, 2).join(', ')}
                              {po.weeks_covered?.length > 2 && ` +${po.weeks_covered.length - 2}`}
                            </TableCell>
                            <TableCell className="text-right">{po.total_items}</TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(po.total_amount)}
                            </TableCell>
                            <TableCell>{getStatusBadge(po.status)}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => { setEditingPO(po); setShowEditPODialog(true); }}
                                  title="View/Edit"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                {po.status === 'DRAFT' && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => approveWeeklyDraftPO(po.id)}
                                    className="text-green-600"
                                    title="Approve"
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                )}
                                {po.status === 'APPROVED' && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => convertToPO(po.id)}
                                    className="text-blue-600"
                                    title="Issue PO"
                                  >
                                    <Send className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Weekly Plan Accordions */}
              {loadingWeeklyPlan ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : weeklyPlan.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  {selectedWeeklyRun 
                    ? "No weekly plan data available for this run."
                    : "Select an MRP run or run Weekly MRP calculation."}
                </div>
              ) : getFilteredWeeklyPlan().length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No items match the selected filters. <Button variant="link" onClick={clearFilters}>Clear filters</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {getFilteredWeeklyPlan().map((week) => (
                    <Card key={week.order_week} className={`overflow-hidden ${selectedWeeksForPO.includes(week.order_week) ? 'ring-2 ring-blue-500' : ''}`}>
                      <div 
                        className="p-4 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          {/* Week Selection Checkbox */}
                          <input
                            type="checkbox"
                            checked={selectedWeeksForPO.includes(week.order_week)}
                            onChange={() => toggleWeekForPO(week.order_week)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            onClick={(e) => e.stopPropagation()}
                          />
                          
                          <div 
                            className="flex items-center gap-4 cursor-pointer flex-1"
                            onClick={() => toggleWeekExpansion(week.order_week)}
                          >
                            {expandedWeeks[week.order_week] ? (
                              <ChevronDown className="h-5 w-5" />
                            ) : (
                              <ChevronRight className="h-5 w-5" />
                            )}
                            <div>
                              <p className="font-semibold">
                                <Calendar className="h-4 w-4 inline mr-2" />
                                {week.order_week_label || `Week of ${week.order_week}`}
                              </p>
                              <p className="text-sm text-gray-500">
                              Place Order By: {week.order_week}
                            </p>
                          </div>
                        </div>
                        </div>
                        <div className="flex items-center gap-8">
                          <div className="text-right">
                            <p className="text-sm text-gray-500">Items</p>
                            <p className="font-semibold">{week.week_summary?.total_items || week.items?.length || 0}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-500">Total Cost</p>
                            <p className="font-semibold text-blue-600">
                              {formatCurrency(week.week_summary?.total_cost || 0)}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {expandedWeeks[week.order_week] && week.items && (
                        <div className="border-t overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>RM ID</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Prod Week</TableHead>
                                <TableHead className="text-right">Gross</TableHead>
                                <TableHead className="text-right">Safety</TableHead>
                                <TableHead className="text-right">Stock</TableHead>
                                <TableHead className="text-right text-purple-600">Open PO</TableHead>
                                <TableHead className="text-right">Net</TableHead>
                                <TableHead className="text-right">Order Qty</TableHead>
                                <TableHead>Vendor</TableHead>
                                <TableHead className="text-right">Cost</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {week.items.slice(0, 50).map((item, idx) => (
                                <TableRow key={`${item.rm_id}-${idx}`}>
                                  <TableCell className="font-mono text-sm">{item.rm_id}</TableCell>
                                  <TableCell className="max-w-[150px] truncate" title={item.rm_name}>
                                    {item.rm_name || '-'}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline">{item.category || '-'}</Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={item.rm_type === 'COMMON' ? 'secondary' : 'default'}>
                                      {item.rm_type || 'COMMON'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-sm">{item.production_week}</TableCell>
                                  <TableCell className="text-right">{item.gross_qty?.toLocaleString()}</TableCell>
                                  <TableCell className="text-right text-gray-500">{item.safety_stock?.toLocaleString() || 0}</TableCell>
                                  <TableCell className="text-right text-gray-500">{item.current_stock?.toLocaleString() || 0}</TableCell>
                                  <TableCell className="text-right">
                                    {item.scheduled_receipts > 0 ? (
                                      <span className="text-purple-600 font-medium">{item.scheduled_receipts?.toLocaleString()}</span>
                                    ) : (
                                      <span className="text-gray-400">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">{item.net_qty?.toLocaleString()}</TableCell>
                                  <TableCell className="text-right font-semibold">
                                    {item.order_qty?.toLocaleString()}
                                  </TableCell>
                                  <TableCell className="max-w-[120px] truncate" title={item.vendor_name}>
                                    {item.vendor_name || <span className="text-gray-400">-</span>}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatCurrency(item.total_cost || 0)}
                                  </TableCell>
                                </TableRow>
                              ))}
                              {week.items.length > 50 && (
                                <TableRow>
                                  <TableCell colSpan={13} className="text-center text-gray-500 py-4">
                                    Showing 50 of {week.items.length} items. Export to Excel to see all.
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MRP Run Detail Dialog */}
      <Dialog open={runDetailOpen} onOpenChange={setRunDetailOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>MRP Run Details - {selectedRun?.run_code}</DialogTitle>
            <DialogDescription>
              {formatDate(selectedRun?.run_date)} | Status: {selectedRun?.status}
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

              {/* View Tabs */}
              <Tabs value={runViewTab} onValueChange={setRunViewTab}>
                <TabsList>
                  <TabsTrigger value="requirements">RM Requirements</TabsTrigger>
                  <TabsTrigger value="weekly">Weekly Breakdown</TabsTrigger>
                </TabsList>
                
                <TabsContent value="requirements">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">RM Requirements</CardTitle>
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
                          {selectedRun.rm_requirements?.slice(0, 30).map((rm, idx) => (
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
                </TabsContent>
                
                <TabsContent value="weekly">
                  <Card>
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-lg">Weekly Requirements</CardTitle>
                        <div className="flex gap-2">
                          <Button 
                            variant={selectedWeeks === 12 ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => refreshWeeklyRequirements(12)}
                          >
                            <Calendar className="h-4 w-4 mr-1" />
                            12 Weeks
                          </Button>
                          <Button 
                            variant={selectedWeeks === 24 ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => refreshWeeklyRequirements(24)}
                          >
                            <Calendar className="h-4 w-4 mr-1" />
                            24 Weeks
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {weeklyRequirements ? (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="sticky left-0 bg-white z-10 min-w-[120px]">RM ID</TableHead>
                                <TableHead className="min-w-[80px]">Total Qty</TableHead>
                                {weeklyRequirements.week_labels?.slice(0, selectedWeeks).map(w => (
                                  <TableHead key={w.week_num} className="text-center min-w-[70px] text-xs">
                                    {w.label}
                                  </TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {weeklyRequirements.requirements?.slice(0, 30).map((rm, idx) => (
                                <TableRow key={idx}>
                                  <TableCell className="sticky left-0 bg-white z-10 font-mono text-xs">
                                    {rm.rm_id}
                                  </TableCell>
                                  <TableCell className="font-bold">
                                    {rm.order_qty?.toLocaleString()}
                                  </TableCell>
                                  {weeklyRequirements.week_labels?.slice(0, selectedWeeks).map(w => (
                                    <TableCell key={w.week_num} className="text-center text-sm">
                                      {rm.weekly_qty?.[`week_${w.week_num}`] || '-'}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          {weeklyRequirements.requirements?.length > 30 && (
                            <p className="text-sm text-gray-500 text-center mt-4">
                              Showing 30 of {weeklyRequirements.requirements.length} RMs
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          Loading weekly data...
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => downloadRunResults(selectedRun?.id)}>
              <Download className="h-4 w-4 mr-2" />
              Download Excel
            </Button>
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

      {/* Weekly PO Preview Dialog */}
      <Dialog open={showPOPreviewDialog} onOpenChange={setShowPOPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Weekly PO Preview</DialogTitle>
            <DialogDescription>
              {poPreviewData?.selected_weeks?.length} weeks selected - {poPreviewData?.summary?.total_vendors} vendors
            </DialogDescription>
          </DialogHeader>
          
          {poPreviewData && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="text-center">
                  <p className="text-sm text-gray-500">Vendors</p>
                  <p className="text-xl font-bold">{poPreviewData.summary?.total_vendors}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Items</p>
                  <p className="text-xl font-bold">{poPreviewData.summary?.total_items}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Total Amount</p>
                  <p className="text-xl font-bold text-blue-600">{formatCurrency(poPreviewData.summary?.total_amount)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500">No Vendor</p>
                  <p className="text-xl font-bold text-orange-500">{poPreviewData.summary?.items_needing_vendor}</p>
                </div>
              </div>
              
              {/* Warning for items without vendor */}
              {poPreviewData.items_without_vendor?.length > 0 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800 font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    {poPreviewData.items_without_vendor.length} items need vendor assignment
                  </p>
                  <p className="text-xs text-yellow-700 mt-1">
                    Download the template, assign vendors, and upload to include these items.
                  </p>
                </div>
              )}
              
              {/* PO List */}
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {poPreviewData.preview_pos?.map((po, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{po.vendor_name}</p>
                      <p className="text-xs text-gray-500">
                        {po.total_items} items • Weeks: {po.weeks_covered?.join(', ')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-blue-600">{formatCurrency(po.total_amount)}</p>
                      <p className="text-xs text-gray-500">{po.total_qty?.toLocaleString()} qty</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowPOPreviewDialog(false)}>
              Close
            </Button>
            <Button variant="outline" onClick={downloadPOTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
            <label className="cursor-pointer">
              <input 
                type="file" 
                accept=".xlsx,.xls" 
                className="hidden" 
                onChange={(e) => { uploadPOFile(e); setShowPOPreviewDialog(false); }}
                disabled={generatingPOs}
              />
              <Button asChild disabled={generatingPOs}>
                <span>
                  {generatingPOs ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  Upload & Generate
                </span>
              </Button>
            </label>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Weekly Draft PO Dialog */}
      <Dialog open={showEditPODialog} onOpenChange={setShowEditPODialog}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPO?.draft_po_code} - {editingPO?.vendor_name}
            </DialogTitle>
            <DialogDescription>
              Weeks: {editingPO?.weeks_covered?.join(', ')} • Status: {editingPO?.status}
            </DialogDescription>
          </DialogHeader>
          
          {editingPO && (
            <div className="space-y-4">
              {/* Change Vendor */}
              <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                <Label className="min-w-[80px]">Vendor:</Label>
                <Select
                  value={editingPO.vendor_id || ''}
                  onValueChange={(val) => updatePOVendor(editingPO.id, val)}
                  disabled={editingPO.status !== 'DRAFT'}
                >
                  <SelectTrigger className="w-[300px]">
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.slice(0, 100).map(v => (
                      <SelectItem key={v.id || v.vendor_id} value={v.id || v.vendor_id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="ml-auto text-right">
                  <p className="text-sm text-gray-500">Total Amount</p>
                  <p className="text-xl font-bold text-blue-600">{formatCurrency(editingPO.total_amount)}</p>
                </div>
              </div>
              
              {/* Line Items */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>RM ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Week</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    {editingPO.status === 'DRAFT' && <TableHead>Edit</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {editingPO.lines?.slice(0, 50).map((line, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-sm">{line.rm_id}</TableCell>
                      <TableCell className="max-w-[180px] truncate">{line.rm_name}</TableCell>
                      <TableCell className="text-xs">{line.order_week}</TableCell>
                      <TableCell className="text-right">{line.quantity?.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{formatCurrency(line.unit_price)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(line.line_total)}</TableCell>
                      {editingPO.status === 'DRAFT' && (
                        <TableCell>
                          <Input
                            type="number"
                            defaultValue={line.quantity}
                            className="w-20 h-8"
                            onBlur={(e) => {
                              const newQty = parseFloat(e.target.value);
                              if (newQty !== line.quantity && newQty > 0) {
                                updatePOLineQty(editingPO.id, line.rm_id, newQty);
                              }
                            }}
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {editingPO.lines?.length > 50 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-gray-500">
                        + {editingPO.lines.length - 50} more items (download template to see all)
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditPODialog(false)}>
              Close
            </Button>
            {editingPO?.status === 'DRAFT' && (
              <Button 
                className="bg-green-600 hover:bg-green-700"
                onClick={() => { approveWeeklyDraftPO(editingPO.id); setShowEditPODialog(false); }}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
            )}
            {editingPO?.status === 'APPROVED' && (
              <Button 
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => { convertToPO(editingPO.id); setShowEditPODialog(false); }}
              >
                <Send className="h-4 w-4 mr-2" />
                Issue PO
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

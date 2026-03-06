import { useState, useEffect, useRef } from "react";
import axios from "axios";
import useBranchStore from "@/store/branchStore";
import { Upload, Download, AlertTriangle, CheckCircle, Calendar, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ProductionPlanning = () => {
  const { selectedBranch } = useBranchStore();
  const [availableMonths, setAvailableMonths] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [shortageAnalysis, setShortageAnalysis] = useState(null);
  const [plans, setPlans] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchAvailableMonths();
  }, [selectedBranch]);

  useEffect(() => {
    if (selectedMonth) {
      fetchShortageAnalysis();
      fetchPlans();
    }
  }, [selectedMonth]);

  const fetchAvailableMonths = async () => {
    try {
      const response = await axios.get(`${API}/production-plans/months?branch=${encodeURIComponent(selectedBranch)}`);
      setAvailableMonths(response.data.months);
      if (response.data.months.length > 0 && !selectedMonth) {
        setSelectedMonth(response.data.months[0]);
      }
    } catch (error) {
      console.error('Error fetching months:', error);
    }
  };

  const fetchPlans = async () => {
    try {
      const response = await axios.get(
        `${API}/production-plans?branch=${encodeURIComponent(selectedBranch)}&plan_month=${selectedMonth}`
      );
      setPlans(response.data);
    } catch (error) {
      console.error('Error fetching plans:', error);
    }
  };

  const fetchShortageAnalysis = async () => {
    try {
      const response = await axios.get(
        `${API}/production-plans/shortage-analysis?branch=${encodeURIComponent(selectedBranch)}&plan_month=${selectedMonth}`
      );
      setShortageAnalysis(response.data);
    } catch (error) {
      console.error('Error fetching shortage analysis:', error);
      setShortageAnalysis(null);
    }
  };

  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(
        `${API}/production-plans/bulk-upload?branch=${encodeURIComponent(selectedBranch)}`,
        formData
      );
      toast.success(`Uploaded: ${response.data.created} created, ${response.data.updated} updated`);
      if (response.data.errors.length > 0) {
        console.error('Upload errors:', response.data.errors);
        toast.warning(`${response.data.errors.length} rows had errors. Check console.`);
      }
      fetchAvailableMonths();
    } catch (error) {
      toast.error("Upload failed");
    }
    e.target.value = null;
  };

  const handleDeletePlan = async () => {
    if (!window.confirm(`Delete production plan for ${selectedMonth}?`)) return;
    
    try {
      await axios.delete(
        `${API}/production-plans/${selectedMonth}?branch=${encodeURIComponent(selectedBranch)}`
      );
      toast.success("Production plan deleted");
      setSelectedMonth("");
      setShortageAnalysis(null);
      setPlans([]);
      fetchAvailableMonths();
    } catch (error) {
      toast.error("Failed to delete plan");
    }
  };

  const downloadTemplate = () => {
    const template = [
      { Date: '2025-01-15', SKU_ID: 'SKU001', Planned_Quantity: 100 },
      { Date: '2025-01-16', SKU_ID: 'SKU001', Planned_Quantity: 150 }
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'production_plan_template.xlsx');
  };

  const exportShortageReport = () => {
    if (!shortageAnalysis) return;
    
    const ws = XLSX.utils.json_to_sheet(
      shortageAnalysis.shortage_report.map(item => ({
        'RM ID': item.rm_id,
        'Category': item.category,
        'Total Required': item.total_required,
        'Current Stock': item.current_stock,
        'Shortage': item.shortage
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Shortage Report');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(
      new Blob([wbout], { type: 'application/octet-stream' }),
      `shortage_report_${selectedMonth}.xlsx`
    );
    toast.success("Shortage report exported");
  };

  return (
    <div className="p-6 md:p-8" data-testid="production-planning-page">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight uppercase">Production Planning</h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">
            Forward-looking plan & RM shortage analysis for {selectedBranch}
          </p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="secondary" 
            onClick={downloadTemplate}
            data-testid="download-plan-template-btn"
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
            data-testid="upload-plan-btn"
            className="uppercase text-xs tracking-wide"
          >
            <Upload className="w-4 h-4 mr-2" strokeWidth={1.5} />
            Upload Plan
          </Button>
        </div>
      </div>

      {/* Month Selector */}
      <div className="mb-6 flex items-center gap-4">
        <Calendar className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="border border-border rounded-sm px-4 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
          data-testid="month-selector"
        >
          <option value="">Select Month</option>
          {availableMonths.map((month) => (
            <option key={month} value={month}>{month}</option>
          ))}
        </select>
        {selectedMonth && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleDeletePlan}
            data-testid="delete-plan-btn"
          >
            <Trash2 className="w-4 h-4 text-red-600" strokeWidth={1.5} />
          </Button>
        )}
      </div>

      {!selectedMonth && (
        <div className="border border-border bg-white rounded-sm p-12 text-center">
          <div className="text-muted-foreground font-mono text-sm">
            Upload a production plan or select an existing month to view shortage analysis
          </div>
        </div>
      )}

      {selectedMonth && shortageAnalysis && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-px bg-border border border-border mb-8">
            <div className="bg-white p-6">
              <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">
                Total SKUs
              </div>
              <div className="text-3xl font-black font-mono text-zinc-700">
                {shortageAnalysis.plan_summary.total_skus}
              </div>
            </div>
            <div className="bg-white p-6">
              <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">
                Units Planned
              </div>
              <div className="text-3xl font-black font-mono text-primary">
                {shortageAnalysis.plan_summary.total_units_planned}
              </div>
            </div>
            <div className="bg-white p-6">
              <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">
                RM Types
              </div>
              <div className="text-3xl font-black font-mono text-zinc-700">
                {shortageAnalysis.plan_summary.total_rm_types}
              </div>
            </div>
            <div className="bg-white p-6">
              <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">
                RM Shortage
              </div>
              <div className="text-3xl font-black font-mono text-red-600">
                {shortageAnalysis.plan_summary.rm_with_shortage}
              </div>
            </div>
            <div className="bg-white p-6">
              <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">
                Plan Entries
              </div>
              <div className="text-3xl font-black font-mono text-zinc-700">
                {shortageAnalysis.plan_summary.plan_entries}
              </div>
            </div>
          </div>

          <Tabs defaultValue="shortage">
            <TabsList className="mb-6">
              <TabsTrigger value="shortage">Shortage Report</TabsTrigger>
              <TabsTrigger value="sufficient">Sufficient Stock</TabsTrigger>
              <TabsTrigger value="plan">Plan Details</TabsTrigger>
            </TabsList>

            {/* Shortage Report */}
            <TabsContent value="shortage">
              <div className="border border-border bg-white rounded-sm">
                <div className="p-6 border-b border-border flex items-center justify-between">
                  <h2 className="text-lg font-bold uppercase tracking-tight">
                    Raw Material Shortages
                  </h2>
                  {shortageAnalysis.shortage_report.length > 0 && (
                    <Button 
                      variant="secondary" 
                      onClick={exportShortageReport}
                      data-testid="export-shortage-btn"
                      className="uppercase text-xs tracking-wide"
                    >
                      <Download className="w-4 h-4 mr-2" strokeWidth={1.5} />
                      Export
                    </Button>
                  )}
                </div>
                <div className="p-6">
                  {shortageAnalysis.shortage_report.length === 0 ? (
                    <div className="flex items-center gap-3 text-green-600 font-mono text-sm py-4">
                      <CheckCircle className="w-5 h-5" strokeWidth={1.5} />
                      All raw materials are sufficiently stocked for this production plan
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-red-50 border-b border-red-200">
                          <tr>
                            <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-red-700 uppercase tracking-wider">
                              RM ID
                            </th>
                            <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-red-700 uppercase tracking-wider">
                              Category
                            </th>
                            <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-red-700 uppercase tracking-wider">
                              Total Required
                            </th>
                            <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-red-700 uppercase tracking-wider">
                              Current Stock
                            </th>
                            <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-red-700 uppercase tracking-wider">
                              Shortage
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {shortageAnalysis.shortage_report.map((item, idx) => (
                            <tr key={idx} className="border-b border-zinc-100 hover:bg-red-50/30">
                              <td className="p-4 align-middle font-mono text-sm font-bold text-zinc-700">
                                {item.rm_id}
                              </td>
                              <td className="p-4 align-middle font-mono text-xs text-zinc-600">
                                {item.category}
                              </td>
                              <td className="p-4 align-middle font-mono text-zinc-700">
                                {item.total_required}
                              </td>
                              <td className="p-4 align-middle font-mono text-zinc-700">
                                {item.current_stock}
                              </td>
                              <td className="p-4 align-middle">
                                <div className="flex items-center gap-2">
                                  <AlertTriangle className="w-4 h-4 text-red-600" strokeWidth={1.5} />
                                  <span className="font-mono text-sm font-bold text-red-600">
                                    {item.shortage}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Sufficient Stock */}
            <TabsContent value="sufficient">
              <div className="border border-border bg-white rounded-sm">
                <div className="p-6 border-b border-border">
                  <h2 className="text-lg font-bold uppercase tracking-tight">
                    Sufficient Stock Items
                  </h2>
                </div>
                <div className="p-6">
                  {shortageAnalysis.sufficient_stock.length === 0 ? (
                    <div className="text-muted-foreground font-mono text-sm">
                      No items with sufficient stock
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-green-50 border-b border-green-200">
                          <tr>
                            <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-green-700 uppercase tracking-wider">
                              RM ID
                            </th>
                            <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-green-700 uppercase tracking-wider">
                              Category
                            </th>
                            <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-green-700 uppercase tracking-wider">
                              Total Required
                            </th>
                            <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-green-700 uppercase tracking-wider">
                              Current Stock
                            </th>
                            <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-green-700 uppercase tracking-wider">
                              Surplus
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {shortageAnalysis.sufficient_stock.map((item, idx) => (
                            <tr key={idx} className="border-b border-zinc-100 hover:bg-green-50/30">
                              <td className="p-4 align-middle font-mono text-sm font-bold text-zinc-700">
                                {item.rm_id}
                              </td>
                              <td className="p-4 align-middle font-mono text-xs text-zinc-600">
                                {item.category}
                              </td>
                              <td className="p-4 align-middle font-mono text-zinc-700">
                                {item.total_required}
                              </td>
                              <td className="p-4 align-middle font-mono text-zinc-700">
                                {item.current_stock}
                              </td>
                              <td className="p-4 align-middle">
                                <span className="font-mono text-sm font-bold text-green-600">
                                  {(item.current_stock - item.total_required).toFixed(2)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Plan Details */}
            <TabsContent value="plan">
              <div className="border border-border bg-white rounded-sm">
                <div className="p-6 border-b border-border">
                  <h2 className="text-lg font-bold uppercase tracking-tight">
                    Production Plan Details
                  </h2>
                </div>
                <div className="p-6">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-zinc-50 border-b border-zinc-200">
                        <tr>
                          <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">
                            SKU ID
                          </th>
                          <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">
                            Planned Qty
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {plans.map((plan, idx) => (
                          <tr key={idx} className="border-b border-zinc-100 hover:bg-zinc-50/50">
                            <td className="p-4 align-middle font-mono text-zinc-700">
                              {new Date(plan.date).toLocaleDateString()}
                            </td>
                            <td className="p-4 align-middle font-mono text-zinc-700">
                              {plan.sku_id}
                            </td>
                            <td className="p-4 align-middle font-mono text-primary font-bold">
                              {plan.planned_quantity}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
};

export default ProductionPlanning;

import { useState, useEffect } from "react";
import axios from "axios";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import useBranchStore from "@/store/branchStore";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Reports = () => {
  const { selectedBranch } = useBranchStore();
  const [inventoryReport, setInventoryReport] = useState(null);
  const [lowStockReport, setLowStockReport] = useState(null);
  const [productionSummary, setProductionSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchReports();
  }, [selectedBranch]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const [inventoryRes, lowStockRes, productionRes] = await Promise.all([
        axios.get(`${API}/reports/inventory?branch=${encodeURIComponent(selectedBranch)}`),
        axios.get(`${API}/reports/low-stock?branch=${encodeURIComponent(selectedBranch)}`),
        axios.get(`${API}/reports/production-summary?days=7&branch=${encodeURIComponent(selectedBranch)}`)
      ]);
      setInventoryReport(inventoryRes.data);
      setLowStockReport(lowStockRes.data);
      setProductionSummary(productionRes.data);
    } catch (error) {
      console.error("Failed to fetch reports", error);
      toast.error("Failed to fetch reports");
    } finally {
      setLoading(false);
    }
  };

  const exportInventoryToExcel = () => {
    if (!inventoryReport) return;
    
    const rmSheet = XLSX.utils.json_to_sheet(inventoryReport.raw_materials.map(rm => ({
      'RM ID': rm.rm_id,
      'Name': rm.name,
      'Unit': rm.unit,
      'Current Stock': rm.current_stock,
      'Low Stock Threshold': rm.low_stock_threshold,
      'Status': rm.current_stock < rm.low_stock_threshold ? 'Low Stock' : 'OK'
    })));

    const skuSheet = XLSX.utils.json_to_sheet(inventoryReport.skus.map(sku => ({
      'SKU ID': sku.sku_id,
      'Name': sku.name,
      'Current Stock': sku.current_stock,
      'Low Stock Threshold': sku.low_stock_threshold,
      'Status': sku.current_stock < sku.low_stock_threshold ? 'Low Stock' : 'OK'
    })));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, rmSheet, 'Raw Materials');
    XLSX.utils.book_append_sheet(wb, skuSheet, 'SKUs');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'inventory_report.xlsx');
    toast.success("Inventory report exported");
  };

  const exportLowStockToPDF = () => {
    if (!lowStockReport) return;

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Low Stock Alert Report', 14, 22);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);

    // Raw Materials
    if (lowStockReport.raw_materials.length > 0) {
      doc.setFontSize(14);
      doc.text('Raw Materials - Low Stock', 14, 45);
      doc.autoTable({
        startY: 50,
        head: [['RM ID', 'Name', 'Current Stock', 'Threshold']],
        body: lowStockReport.raw_materials.map(rm => [
          rm.rm_id,
          rm.name,
          rm.current_stock,
          rm.low_stock_threshold
        ]),
        theme: 'grid',
        headStyles: { fillColor: [249, 115, 22] }
      });
    }

    // SKUs
    if (lowStockReport.skus.length > 0) {
      const startY = lowStockReport.raw_materials.length > 0 ? doc.lastAutoTable.finalY + 15 : 50;
      doc.setFontSize(14);
      doc.text('SKUs - Low Stock', 14, startY);
      doc.autoTable({
        startY: startY + 5,
        head: [['SKU ID', 'Name', 'Current Stock', 'Threshold']],
        body: lowStockReport.skus.map(sku => [
          sku.sku_id,
          sku.name,
          sku.current_stock,
          sku.low_stock_threshold
        ]),
        theme: 'grid',
        headStyles: { fillColor: [249, 115, 22] }
      });
    }

    doc.save('low_stock_report.pdf');
    toast.success("Low stock report exported");
  };

  const exportProductionToExcel = () => {
    if (!productionSummary) return;

    const ws = XLSX.utils.json_to_sheet(productionSummary.entries.map(e => ({
      'Date': new Date(e.date).toLocaleDateString(),
      'SKU ID': e.sku_id,
      'Quantity': e.quantity,
      'Notes': e.notes || ''
    })));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Production');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'production_summary.xlsx');
    toast.success("Production summary exported");
  };

  return (
    <div className="p-6 md:p-8" data-testid="reports-page">
      <div className="mb-8">
        <h1 className="text-4xl font-black tracking-tight uppercase">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1 font-mono">Analytics & insights for {selectedBranch}</p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-muted-foreground font-mono text-sm">
          Loading reports...
        </div>
      ) : (
      <Tabs defaultValue="inventory" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="inventory" data-testid="inventory-tab">Inventory</TabsTrigger>
          <TabsTrigger value="lowstock" data-testid="lowstock-tab">Low Stock Alerts</TabsTrigger>
          <TabsTrigger value="production" data-testid="production-tab">Production Summary</TabsTrigger>
        </TabsList>

        {/* Inventory Report */}
        <TabsContent value="inventory">
          <div className="border border-border bg-white rounded-sm">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-bold uppercase tracking-tight">Current Inventory Levels</h2>
              <Button 
                variant="secondary" 
                onClick={exportInventoryToExcel}
                data-testid="export-inventory-btn"
                className="uppercase text-xs tracking-wide"
              >
                <Download className="w-4 h-4 mr-2" strokeWidth={1.5} />
                Export Excel
              </Button>
            </div>
            <div className="p-6">
              {inventoryReport && (
                <div className="space-y-8">
                  {/* Raw Materials - Only show items with stock > 0 */}
                  <div>
                    <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-4">
                      Raw Materials ({inventoryReport.raw_materials.filter(rm => rm.current_stock > 0).length} items with stock)
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-zinc-50 border-b border-zinc-200">
                          <tr>
                            <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">RM ID</th>
                            <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Current Stock</th>
                            <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Unit</th>
                            <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inventoryReport.raw_materials.filter(rm => rm.current_stock > 0).map((rm) => (
                            <tr key={rm.rm_id} className="border-b border-zinc-100">
                              <td className="p-4 align-middle font-mono text-zinc-700">{rm.rm_id}</td>
                              <td className="p-4 align-middle font-mono text-zinc-700">{rm.current_stock}</td>
                              <td className="p-4 align-middle font-mono text-zinc-700">{rm.unit}</td>
                              <td className="p-4 align-middle">
                                {rm.current_stock < rm.low_stock_threshold ? (
                                  <span className="text-xs font-mono text-red-600 border border-red-600 px-2 py-1 uppercase tracking-wider">
                                    Low Stock
                                  </span>
                                ) : (
                                  <span className="text-xs font-mono text-green-600 border border-green-600 px-2 py-1 uppercase tracking-wider">
                                    OK
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {inventoryReport.raw_materials.filter(rm => rm.current_stock > 0).length === 0 && (
                        <div className="p-8 text-center text-muted-foreground font-mono text-sm">
                          No raw materials with stock in this branch.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* SKUs - Only show items with stock > 0 */}
                  <div>
                    <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-4">
                      SKUs ({inventoryReport.skus.filter(sku => sku.current_stock > 0).length} items with stock)
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-zinc-50 border-b border-zinc-200">
                          <tr>
                            <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">SKU ID</th>
                            <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Current Stock</th>
                            <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inventoryReport.skus.filter(sku => sku.current_stock > 0).map((sku) => (
                            <tr key={sku.sku_id} className="border-b border-zinc-100">
                              <td className="p-4 align-middle font-mono text-zinc-700">{sku.sku_id}</td>
                              <td className="p-4 align-middle font-mono text-zinc-700">{sku.current_stock}</td>
                              <td className="p-4 align-middle">
                                {sku.current_stock < sku.low_stock_threshold ? (
                                  <span className="text-xs font-mono text-red-600 border border-red-600 px-2 py-1 uppercase tracking-wider">
                                    Low Stock
                                  </span>
                                ) : (
                                  <span className="text-xs font-mono text-green-600 border border-green-600 px-2 py-1 uppercase tracking-wider">
                                    OK
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {inventoryReport.skus.filter(sku => sku.current_stock > 0).length === 0 && (
                        <div className="p-8 text-center text-muted-foreground font-mono text-sm">
                          No SKUs with stock in this branch.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Low Stock Report */}
        <TabsContent value="lowstock">
          <div className="border border-border bg-white rounded-sm">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-bold uppercase tracking-tight">Low Stock Alerts</h2>
              <Button 
                variant="secondary" 
                onClick={exportLowStockToPDF}
                data-testid="export-lowstock-btn"
                className="uppercase text-xs tracking-wide"
              >
                <FileText className="w-4 h-4 mr-2" strokeWidth={1.5} />
                Export PDF
              </Button>
            </div>
            <div className="p-6">
              {lowStockReport && (
                <div className="space-y-8">
                  {/* Low Stock RM */}
                  <div>
                    <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-4">
                      Raw Materials ({lowStockReport.raw_materials.length} items)
                    </h3>
                    {lowStockReport.raw_materials.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {lowStockReport.raw_materials.map((rm) => (
                          <div key={rm.rm_id} className="border border-red-200 bg-red-50 rounded-sm p-4" data-testid={`low-stock-rm-${rm.rm_id}`}>
                            <div className="font-mono text-sm font-bold text-red-900">{rm.rm_id}</div>
                            <div className="text-sm text-red-700 mt-1">{rm.name}</div>
                            <div className="mt-3 flex justify-between items-center">
                              <span className="text-xs text-red-600 uppercase tracking-wider">Current: {rm.current_stock}</span>
                              <span className="text-xs text-red-600 uppercase tracking-wider">Min: {rm.low_stock_threshold}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground font-mono">All raw materials are adequately stocked</div>
                    )}
                  </div>

                  {/* Low Stock SKU */}
                  <div>
                    <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-4">
                      SKUs ({lowStockReport.skus.length} items)
                    </h3>
                    {lowStockReport.skus.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {lowStockReport.skus.map((sku) => (
                          <div key={sku.sku_id} className="border border-red-200 bg-red-50 rounded-sm p-4" data-testid={`low-stock-sku-${sku.sku_id}`}>
                            <div className="font-mono text-sm font-bold text-red-900">{sku.sku_id}</div>
                            <div className="text-sm text-red-700 mt-1">{sku.name}</div>
                            <div className="mt-3 flex justify-between items-center">
                              <span className="text-xs text-red-600 uppercase tracking-wider">Current: {sku.current_stock}</span>
                              <span className="text-xs text-red-600 uppercase tracking-wider">Min: {sku.low_stock_threshold}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground font-mono">All SKUs are adequately stocked</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Production Summary */}
        <TabsContent value="production">
          <div className="border border-border bg-white rounded-sm">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-bold uppercase tracking-tight">Production Summary (Last 7 Days)</h2>
              <Button 
                variant="secondary" 
                onClick={exportProductionToExcel}
                data-testid="export-production-summary-btn"
                className="uppercase text-xs tracking-wide"
              >
                <Download className="w-4 h-4 mr-2" strokeWidth={1.5} />
                Export Excel
              </Button>
            </div>
            <div className="p-6">
              {productionSummary && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-zinc-50 border-b border-zinc-200">
                      <tr>
                        <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Date</th>
                        <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">SKU ID</th>
                        <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Quantity</th>
                        <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productionSummary.entries.map((entry) => (
                        <tr key={entry.id} className="border-b border-zinc-100">
                          <td className="p-4 align-middle font-mono text-zinc-700">
                            {new Date(entry.date).toLocaleDateString()}
                          </td>
                          <td className="p-4 align-middle font-mono text-zinc-700">{entry.sku_id}</td>
                          <td className="p-4 align-middle font-mono text-zinc-700">{entry.quantity}</td>
                          <td className="p-4 align-middle text-sm text-zinc-600">{entry.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {productionSummary.entries.length === 0 && (
                    <div className="p-12 text-center text-muted-foreground font-mono text-sm">
                      No production entries in the last 7 days.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
      )}
    </div>
  );
};

export default Reports;

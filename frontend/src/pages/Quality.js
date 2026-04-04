import { useState, useEffect } from "react";
import axios from "axios";
import { Plus, CheckCircle, XCircle, ClipboardList, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import useBranchStore from "@/store/branchStore";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Quality = () => {
  const { selectedBranch } = useBranchStore();
  const [activeTab, setActiveTab] = useState("batches");
  
  // Data
  const [batches, setBatches] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [verticals, setVerticals] = useState([]);
  const [models, setModels] = useState([]);
  const [brands, setBrands] = useState([]);
  
  // Selected batch for QC
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [qcResults, setQcResults] = useState([]);
  
  // Dialogs
  const [showChecklistDialog, setShowChecklistDialog] = useState(false);
  const [showQCDialog, setShowQCDialog] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  
  // Forms
  const [checklistForm, setChecklistForm] = useState({
    name: "", description: "", check_type: "VISUAL",
    vertical_id: "", model_id: "", brand_id: "",
    expected_value: "", tolerance: "", is_mandatory: true, check_priority: 100
  });
  const [qcForm, setQcForm] = useState({
    checklist_id: "", sample_size: 10, passed_count: 0, failed_count: 0,
    actual_value: "", defect_type: "", inspector_notes: ""
  });
  const [approvalForm, setApprovalForm] = useState({
    overall_status: "APPROVED", approved_quantity: 0, rejection_reason: ""
  });

  useEffect(() => {
    fetchAllData();
  }, [selectedBranch]);

  const fetchAllData = async () => {
    try {
      const [batchesRes, checklistsRes, verticalsRes, modelsRes, brandsRes] = await Promise.all([
        axios.get(`${API}/production-batches`, { params: { branch: selectedBranch, status: "COMPLETED" } }),
        axios.get(`${API}/qc-checklists`),
        axios.get(`${API}/verticals`),
        axios.get(`${API}/models`),
        axios.get(`${API}/brands`)
      ]);
      
      // Also fetch QC_HOLD batches
      const holdBatchesRes = await axios.get(`${API}/production-batches`, { params: { branch: selectedBranch, status: "QC_HOLD" } });
      
      setBatches([...batchesRes.data, ...holdBatchesRes.data]);
      setChecklists(checklistsRes.data);
      setVerticals(verticalsRes.data);
      setModels(modelsRes.data);
      setBrands(brandsRes.data);
    } catch (error) {
      toast.error("Failed to fetch data");
    }
  };

  const handleCreateChecklist = async () => {
    try {
      await axios.post(`${API}/qc-checklists`, checklistForm);
      toast.success("Checklist created");
      setShowChecklistDialog(false);
      setChecklistForm({
        name: "", description: "", check_type: "VISUAL",
        vertical_id: "", model_id: "", brand_id: "",
        expected_value: "", tolerance: "", is_mandatory: true, check_priority: 100
      });
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create checklist");
    }
  };

  const handleSelectBatch = async (batch) => {
    setSelectedBatch(batch);
    setApprovalForm({ ...approvalForm, approved_quantity: batch.produced_quantity });
    try {
      const resultsRes = await axios.get(`${API}/qc-results`, { params: { production_batch_id: batch.id } });
      setQcResults(resultsRes.data);
    } catch (error) {
      setQcResults([]);
    }
    setShowQCDialog(true);
  };

  const handleRecordQCResult = async () => {
    if (!selectedBatch) return;
    try {
      await axios.post(`${API}/qc-results`, {
        ...qcForm,
        production_batch_id: selectedBatch.id
      });
      toast.success("QC result recorded");
      setQcForm({
        checklist_id: "", sample_size: 10, passed_count: 0, failed_count: 0,
        actual_value: "", defect_type: "", inspector_notes: ""
      });
      // Refresh results
      const resultsRes = await axios.get(`${API}/qc-results`, { params: { production_batch_id: selectedBatch.id } });
      setQcResults(resultsRes.data);
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to record QC result");
    }
  };

  const handleApproval = async () => {
    if (!selectedBatch) return;
    try {
      await axios.post(`${API}/qc-approvals`, null, {
        params: {
          production_batch_id: selectedBatch.id,
          overall_status: approvalForm.overall_status,
          approved_quantity: approvalForm.approved_quantity,
          rejection_reason: approvalForm.rejection_reason
        }
      });
      toast.success(`Batch ${approvalForm.overall_status.toLowerCase()}`);
      setShowApprovalDialog(false);
      setShowQCDialog(false);
      setSelectedBatch(null);
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to process approval");
    }
  };

  const getChecklistName = (id) => checklists.find(c => c.id === id)?.name || id;

  return (
    <div className="p-6 md:p-8" data-testid="quality-page">
      <div className="mb-8">
        <h1 className="text-4xl font-black tracking-tight uppercase">Quality Control</h1>
        <p className="text-sm text-muted-foreground mt-1 font-mono">QC Checklists & Inspections</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="batches" className="uppercase text-xs tracking-wide">
            <FileCheck className="w-4 h-4 mr-2" />
            Pending QC
          </TabsTrigger>
          <TabsTrigger value="checklists" className="uppercase text-xs tracking-wide">
            <ClipboardList className="w-4 h-4 mr-2" />
            Checklists
          </TabsTrigger>
        </TabsList>

        {/* Pending QC Batches */}
        <TabsContent value="batches">
          <div className="mb-4">
            <h2 className="text-lg font-bold">Batches Pending QC - {selectedBranch}</h2>
          </div>
          
          <div className="border rounded-sm overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Batch Code</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">SKU</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Produced</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Date</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Status</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {batches.filter(b => b.status === 'COMPLETED' || b.status === 'QC_HOLD').map((batch) => (
                  <tr key={batch.id} className="border-t">
                    <td className="p-4 font-mono font-bold text-sm">{batch.batch_code}</td>
                    <td className="p-4 font-mono text-sm">{batch.sku_id}</td>
                    <td className="p-4 font-mono font-bold">{batch.produced_quantity}</td>
                    <td className="p-4 font-mono text-sm">{batch.batch_date?.slice(0, 10)}</td>
                    <td className="p-4">
                      <span className={`text-xs font-mono px-2 py-1 rounded ${
                        batch.status === 'QC_HOLD' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                      }`}>{batch.status}</span>
                    </td>
                    <td className="p-4">
                      <Button size="sm" onClick={() => handleSelectBatch(batch)}>
                        <ClipboardList className="w-4 h-4 mr-2" />
                        Inspect
                      </Button>
                    </td>
                  </tr>
                ))}
                {batches.filter(b => b.status === 'COMPLETED' || b.status === 'QC_HOLD').length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No batches pending QC</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* QC Checklists */}
        <TabsContent value="checklists">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold">QC Checklists</h2>
            <Dialog open={showChecklistDialog} onOpenChange={setShowChecklistDialog}>
              <DialogTrigger asChild>
                <Button className="uppercase text-xs tracking-wide" data-testid="add-checklist-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Checklist
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create QC Checklist</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                  <div>
                    <Label>Name</Label>
                    <Input 
                      value={checklistForm.name}
                      onChange={(e) => setChecklistForm({...checklistForm, name: e.target.value})}
                      placeholder="e.g., Surface Quality Check"
                    />
                  </div>
                  <div>
                    <Label>Check Type</Label>
                    <Select value={checklistForm.check_type} onValueChange={(v) => setChecklistForm({...checklistForm, check_type: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="VISUAL">Visual</SelectItem>
                        <SelectItem value="MEASUREMENT">Measurement</SelectItem>
                        <SelectItem value="FUNCTIONAL">Functional</SelectItem>
                        <SelectItem value="SAFETY">Safety</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input 
                      value={checklistForm.description}
                      onChange={(e) => setChecklistForm({...checklistForm, description: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label>Vertical (Optional - applies to all if empty)</Label>
                    <Select value={checklistForm.vertical_id || undefined} onValueChange={(v) => setChecklistForm({...checklistForm, vertical_id: v})}>
                      <SelectTrigger><SelectValue placeholder="All verticals" /></SelectTrigger>
                      <SelectContent>
                        {verticals.filter(v => v.id).map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Expected Value</Label>
                    <Input 
                      value={checklistForm.expected_value}
                      onChange={(e) => setChecklistForm({...checklistForm, expected_value: e.target.value})}
                      placeholder="e.g., No scratches, 10mm ± 0.5"
                    />
                  </div>
                  <div>
                    <Label>Priority (lower = higher priority)</Label>
                    <Input 
                      type="number"
                      value={checklistForm.check_priority}
                      onChange={(e) => setChecklistForm({...checklistForm, check_priority: parseInt(e.target.value) || 100})}
                    />
                  </div>
                  <Button onClick={handleCreateChecklist} className="w-full">Create Checklist</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          
          <div className="border rounded-sm overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Code</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Name</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Type</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Expected Value</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Priority</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Mandatory</th>
                </tr>
              </thead>
              <tbody>
                {checklists.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="p-4 font-mono font-bold text-sm">{c.checklist_code}</td>
                    <td className="p-4">{c.name}</td>
                    <td className="p-4">
                      <span className="text-xs font-mono px-2 py-1 rounded bg-zinc-100">{c.check_type}</span>
                    </td>
                    <td className="p-4 text-sm">{c.expected_value || '-'}</td>
                    <td className="p-4 font-mono">{c.check_priority}</td>
                    <td className="p-4">
                      {c.is_mandatory ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-zinc-400" />
                      )}
                    </td>
                  </tr>
                ))}
                {checklists.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No checklists defined</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* QC Inspection Dialog */}
      <Dialog open={showQCDialog} onOpenChange={setShowQCDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>QC Inspection - {selectedBatch?.batch_code}</DialogTitle>
          </DialogHeader>
          {selectedBatch && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div><span className="text-muted-foreground">SKU:</span> <span className="font-mono font-bold">{selectedBatch.sku_id}</span></div>
                <div><span className="text-muted-foreground">Produced:</span> <span className="font-mono font-bold">{selectedBatch.produced_quantity}</span></div>
                <div><span className="text-muted-foreground">Date:</span> <span className="font-mono">{selectedBatch.batch_date?.slice(0, 10)}</span></div>
              </div>

              {/* Existing QC Results */}
              {qcResults.length > 0 && (
                <div>
                  <h4 className="font-bold mb-2">Recorded Results</h4>
                  <div className="border rounded-sm">
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-50">
                        <tr>
                          <th className="h-8 px-3 text-left font-mono text-xs uppercase">Checklist</th>
                          <th className="h-8 px-3 text-left font-mono text-xs uppercase">Sample</th>
                          <th className="h-8 px-3 text-left font-mono text-xs uppercase">Passed</th>
                          <th className="h-8 px-3 text-left font-mono text-xs uppercase">Failed</th>
                          <th className="h-8 px-3 text-left font-mono text-xs uppercase">Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {qcResults.map(r => (
                          <tr key={r.id} className="border-t">
                            <td className="p-3">{getChecklistName(r.checklist_id)}</td>
                            <td className="p-3 font-mono">{r.sample_size}</td>
                            <td className="p-3 font-mono text-green-600">{r.passed_count}</td>
                            <td className="p-3 font-mono text-red-600">{r.failed_count}</td>
                            <td className="p-3">
                              <span className={`text-xs font-mono px-2 py-1 rounded ${
                                r.result_status === 'PASSED' ? 'bg-green-100 text-green-700' :
                                r.result_status === 'FAILED' ? 'bg-red-100 text-red-700' :
                                'bg-yellow-100 text-yellow-700'
                              }`}>{r.result_status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Add New QC Result */}
              <div className="border-t pt-4">
                <h4 className="font-bold mb-3">Record New Inspection</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Checklist</Label>
                    <Select value={qcForm.checklist_id || undefined} onValueChange={(v) => setQcForm({...qcForm, checklist_id: v})}>
                      <SelectTrigger><SelectValue placeholder="Select checklist" /></SelectTrigger>
                      <SelectContent>
                        {checklists.filter(c => c.id).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Sample Size</Label>
                    <Input 
                      type="number"
                      value={qcForm.sample_size}
                      onChange={(e) => setQcForm({...qcForm, sample_size: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <Label>Passed Count</Label>
                    <Input 
                      type="number"
                      value={qcForm.passed_count}
                      onChange={(e) => setQcForm({...qcForm, passed_count: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <Label>Failed Count</Label>
                    <Input 
                      type="number"
                      value={qcForm.failed_count}
                      onChange={(e) => setQcForm({...qcForm, failed_count: parseInt(e.target.value) || 0})}
                    />
                  </div>
                </div>
                <Button onClick={handleRecordQCResult} className="mt-4" variant="outline">
                  Record Result
                </Button>
              </div>

              {/* Approval Section */}
              <div className="border-t pt-4">
                <h4 className="font-bold mb-3">Final Approval</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Decision</Label>
                    <Select value={approvalForm.overall_status} onValueChange={(v) => setApprovalForm({...approvalForm, overall_status: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="APPROVED">Approve</SelectItem>
                        <SelectItem value="REJECTED">Reject</SelectItem>
                        <SelectItem value="CONDITIONAL">Conditional</SelectItem>
                        <SelectItem value="REWORK">Rework Required</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Approved Quantity</Label>
                    <Input 
                      type="number"
                      value={approvalForm.approved_quantity}
                      onChange={(e) => setApprovalForm({...approvalForm, approved_quantity: parseInt(e.target.value) || 0})}
                    />
                  </div>
                </div>
                {approvalForm.overall_status !== 'APPROVED' && (
                  <div className="mt-4">
                    <Label>Rejection Reason / Notes</Label>
                    <Input 
                      value={approvalForm.rejection_reason}
                      onChange={(e) => setApprovalForm({...approvalForm, rejection_reason: e.target.value})}
                    />
                  </div>
                )}
                <div className="flex gap-3 mt-4">
                  <Button onClick={handleApproval} className={approvalForm.overall_status === 'APPROVED' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}>
                    {approvalForm.overall_status === 'APPROVED' ? (
                      <><CheckCircle className="w-4 h-4 mr-2" /> Approve Batch</>
                    ) : (
                      <><XCircle className="w-4 h-4 mr-2" /> Submit Decision</>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Quality;

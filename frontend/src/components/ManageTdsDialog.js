import { useEffect, useState } from "react";
import axios from "axios";
import { Plus, Pencil, Trash2, Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";
import useAuthStore from "@/store/authStore";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const blankRow = () => ({
  id: null,
  tax_name: "",
  rate: "",
  section: "",
  status: "ACTIVE",
  zoho_tax_id: "",
});

export default function ManageTdsDialog({ open, onOpenChange, onChanged }) {
  const { token } = useAuthStore();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null); // {id|null, ...}
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/tds-taxes`, { headers });
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      toast.error("Failed to load TDS taxes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      load();
      setEditing(null);
    }
  }, [open]);

  const startCreate = () => setEditing(blankRow());
  const startEdit = (row) => setEditing({ ...row });

  const validate = (v) => {
    if (!v.tax_name?.trim()) return "Tax name is required";
    const r = parseFloat(v.rate);
    if (isNaN(r) || r < 0 || r > 100) return "Rate must be between 0 and 100";
    if (!v.section?.trim()) return "Section is required";
    if (!v.zoho_tax_id?.trim()) return "Zoho tax_id is required (create the TDS in Zoho UI first)";
    return null;
  };

  const save = async () => {
    const err = validate(editing);
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        tax_name: editing.tax_name.trim(),
        rate: parseFloat(editing.rate),
        section: editing.section.trim(),
        status: editing.status || "ACTIVE",
        zoho_tax_id: editing.zoho_tax_id.trim(),
      };
      if (editing.id) {
        await axios.put(`${API}/tds-taxes/${editing.id}`, payload, { headers });
        toast.success("TDS tax updated");
      } else {
        await axios.post(`${API}/tds-taxes`, payload, { headers });
        toast.success("TDS tax created");
      }
      setEditing(null);
      await load();
      onChanged && onChanged();
    } catch (e) {
      const msg = e?.response?.data?.detail || e.message || "Save failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this TDS tax mapping? This will not delete it from Zoho Books.")) return;
    setDeleting(id);
    try {
      await axios.delete(`${API}/tds-taxes/${id}`, { headers });
      toast.success("Deleted");
      await load();
      onChanged && onChanged();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl" data-testid="manage-tds-dialog">
        <DialogHeader>
          <DialogTitle>Manage TDS Taxes</DialogTitle>
        </DialogHeader>

        <div className="text-xs text-muted-foreground -mt-2 mb-2">
          Zoho Books does not allow creating TDS taxes via API. Create the TDS in Zoho
          (<i>Settings → Taxes → TDS</i>), copy its <code>tax_id</code>, and map it here.
        </div>

        {!editing && (
          <div className="flex justify-end mb-2">
            <Button size="sm" onClick={startCreate} data-testid="add-tds-btn">
              <Plus className="w-4 h-4 mr-1" /> Add TDS
            </Button>
          </div>
        )}

        {editing && (
          <div className="border rounded-md p-3 mb-3 bg-zinc-50 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tax Name</Label>
                <Input
                  value={editing.tax_name}
                  onChange={(e) => setEditing({ ...editing, tax_name: e.target.value })}
                  placeholder="e.g. TDS - 194C"
                  data-testid="tds-form-tax-name"
                />
              </div>
              <div>
                <Label className="text-xs">Rate (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={editing.rate}
                  onChange={(e) => setEditing({ ...editing, rate: e.target.value })}
                  placeholder="e.g. 1"
                  data-testid="tds-form-rate"
                />
              </div>
              <div>
                <Label className="text-xs">Section</Label>
                <Input
                  value={editing.section}
                  onChange={(e) => setEditing({ ...editing, section: e.target.value })}
                  placeholder="e.g. Section 194C — Contractor"
                  data-testid="tds-form-section"
                />
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select
                  value={editing.status || "ACTIVE"}
                  onValueChange={(v) => setEditing({ ...editing, status: v })}
                >
                  <SelectTrigger data-testid="tds-form-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                    <SelectItem value="INACTIVE">INACTIVE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Zoho Tax ID</Label>
                <Input
                  value={editing.zoho_tax_id}
                  onChange={(e) => setEditing({ ...editing, zoho_tax_id: e.target.value })}
                  placeholder="Paste from Zoho Books → Settings → Taxes → TDS"
                  data-testid="tds-form-zoho-id"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(null)} disabled={saving}>
                <X className="w-4 h-4 mr-1" /> Cancel
              </Button>
              <Button size="sm" onClick={save} disabled={saving} data-testid="tds-form-save">
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                {editing.id ? "Save Changes" : "Create"}
              </Button>
            </div>
          </div>
        )}

        <div className="border rounded-md max-h-96 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tax Name</TableHead>
                <TableHead>Rate %</TableHead>
                <TableHead>Section</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Zoho Tax ID</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6">
                    <Loader2 className="w-4 h-4 animate-spin inline" /> Loading…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                    No TDS taxes mapped yet. Click <b>Add TDS</b> to create one.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id} data-testid={`tds-row-${r.id}`}>
                    <TableCell className="font-medium">{r.tax_name}</TableCell>
                    <TableCell>{r.rate}%</TableCell>
                    <TableCell className="text-xs">{r.section}</TableCell>
                    <TableCell>
                      <span className={r.status === "ACTIVE" ? "text-green-600" : "text-zinc-400"}>
                        {r.status}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.zoho_tax_id}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => startEdit(r)}
                          data-testid={`tds-edit-${r.id}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-600"
                          onClick={() => remove(r.id)}
                          disabled={deleting === r.id}
                          data-testid={`tds-delete-${r.id}`}
                        >
                          {deleting === r.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect } from "react";
import axios from "axios";
import useAuthStore from "@/store/authStore";
import { Plus, Edit, Trash2, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const BRANCHES = [
  "Unit 1 Vedica",
  "Unit 2 Trikes",
  "Unit 3 TM",
  "Unit 4 Goa",
  "Unit 5 Baabus",
  "Unit 6 Emox",
  "BHDG WH"
];

const UserManagement = () => {
  const { token } = useAuthStore();
  const [users, setUsers] = useState([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    role: "branch_user",
    assigned_branches: []
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data);
    } catch (error) {
      toast.error("Failed to fetch users");
    }
  };

  const handleSubmit = async () => {
    try {
      if (editMode) {
        await axios.put(`${API}/users/${selectedUser.id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success("User updated");
      } else {
        await axios.post(`${API}/users`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success("User created");
      }
      setShowDialog(false);
      resetForm();
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Operation failed");
    }
  };

  const handleEdit = (user) => {
    setSelectedUser(user);
    setFormData({
      email: user.email,
      password: "",
      name: user.name,
      role: user.role,
      assigned_branches: user.assigned_branches
    });
    setEditMode(true);
    setShowDialog(true);
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await axios.delete(`${API}/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("User deleted");
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete");
    }
  };

  const toggleActive = async (userId) => {
    try {
      await axios.patch(`${API}/users/${userId}/toggle-active`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("User status updated");
      fetchUsers();
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const resetForm = () => {
    setFormData({ email: "", password: "", name: "", role: "branch_user", assigned_branches: [] });
    setEditMode(false);
    setSelectedUser(null);
  };

  const toggleBranch = (branch) => {
    if (formData.assigned_branches.includes(branch)) {
      setFormData({
        ...formData,
        assigned_branches: formData.assigned_branches.filter(b => b !== branch)
      });
    } else {
      setFormData({
        ...formData,
        assigned_branches: [...formData.assigned_branches, branch]
      });
    }
  };

  return (
    <div className="p-6 md:p-8" data-testid="user-management-page">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight uppercase">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">Manage access & permissions</p>
        </div>
        <Dialog open={showDialog} onOpenChange={(open) => {
          setShowDialog(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button data-testid="add-user-btn" className="uppercase text-xs tracking-wide">
              <Plus className="w-4 h-4 mr-2" strokeWidth={1.5} />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="font-bold uppercase">
                {editMode ? "Edit User" : "Create New User"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  data-testid="user-email-input"
                  className="font-mono"
                  disabled={editMode}
                />
              </div>
              <div>
                <Label>Password {editMode && "(leave empty to keep current)"}</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  data-testid="user-password-input"
                  placeholder={editMode ? "Leave empty to keep current" : ""}
                />
              </div>
              <div>
                <Label>Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  data-testid="user-name-input"
                />
              </div>
              <div>
                <Label>Role *</Label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value, assigned_branches: e.target.value === 'master_admin' ? [] : formData.assigned_branches })}
                  className="flex h-10 w-full rounded-sm border border-input bg-transparent px-3 py-2 text-sm"
                  data-testid="user-role-select"
                >
                  <option value="branch_user">Branch User</option>
                  <option value="master_admin">Master Admin</option>
                </select>
              </div>

              {formData.role === "branch_user" && (
                <div>
                  <Label className="block mb-2">Assigned Branches *</Label>
                  <div className="border border-border rounded-sm p-4 space-y-2 max-h-48 overflow-y-auto">
                    {BRANCHES.map((branch) => (
                      <label key={branch} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.assigned_branches.includes(branch)}
                          onChange={() => toggleBranch(branch)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm font-mono">{branch}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={handleSubmit}
                data-testid="submit-user-btn"
                className="w-full uppercase text-xs tracking-wide"
              >
                {editMode ? "Update User" : "Create User"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Users Table */}
      <div className="border border-border bg-white rounded-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="users-table">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Name</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Email</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Role</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Branches</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-zinc-100 hover:bg-zinc-50/50" data-testid={`user-row-${user.email}`}>
                  <td className="p-4 align-middle font-mono text-sm font-bold text-zinc-700">{user.name}</td>
                  <td className="p-4 align-middle font-mono text-sm text-zinc-600">{user.email}</td>
                  <td className="p-4 align-middle">
                    <span className={`text-xs font-mono px-2 py-1 uppercase tracking-wider border ${user.role === 'master_admin' ? 'text-primary border-primary' : 'text-zinc-600 border-zinc-600'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="p-4 align-middle text-xs text-zinc-600 font-mono">
                    {user.role === 'master_admin' ? 'All Branches' : user.assigned_branches.join(', ')}
                  </td>
                  <td className="p-4 align-middle">
                    {user.is_active ? (
                      <span className="text-xs font-mono text-green-600 border border-green-600 px-2 py-1 uppercase tracking-wider">
                        Active
                      </span>
                    ) : (
                      <span className="text-xs font-mono text-red-600 border border-red-600 px-2 py-1 uppercase tracking-wider">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="p-4 align-middle">
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(user)}
                        data-testid={`edit-user-${user.email}`}
                      >
                        <Edit className="w-4 h-4 text-primary" strokeWidth={1.5} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActive(user.id)}
                        data-testid={`toggle-user-${user.email}`}
                      >
                        {user.is_active ? (
                          <UserX className="w-4 h-4 text-orange-600" strokeWidth={1.5} />
                        ) : (
                          <UserCheck className="w-4 h-4 text-green-600" strokeWidth={1.5} />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(user.id)}
                        data-testid={`delete-user-${user.email}`}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" strokeWidth={1.5} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;

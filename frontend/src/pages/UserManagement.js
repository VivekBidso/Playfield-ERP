import { useState, useEffect } from "react";
import axios from "axios";
import useAuthStore from "@/store/authStore";
import { Plus, Edit, Trash2, UserCheck, UserX, Shield, ShieldPlus, X } from "lucide-react";
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

// Role descriptions for UI
const ROLE_DESCRIPTIONS = {
  'MASTER_ADMIN': 'Full system access',
  'DEMAND_PLANNER': 'Forecasts & dispatch lots',
  'TECH_OPS_ENGINEER': 'Master data & BOMs',
  'CPC_PLANNER': 'Production scheduling',
  'PROCUREMENT_OFFICER': 'Vendors & POs',
  'BRANCH_OPS_USER': 'Branch operations',
  'QUALITY_INSPECTOR': 'QC management',
  'LOGISTICS_COORDINATOR': 'Dispatch & IBT',
  'FINANCE_VIEWER': 'Finance read-only',
  'AUDITOR_READONLY': 'Audit read-only'
};

const UserManagement = () => {
  const { token } = useAuthStore();
  const [users, setUsers] = useState([]);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [showDialog, setShowDialog] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserRoles, setSelectedUserRoles] = useState([]);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    role: "branch_user",
    rbac_role: "BRANCH_OPS_USER",  // New RBAC role field
    assigned_branches: []
  });

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/users-with-roles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data);
    } catch (error) {
      // Fallback to legacy endpoint
      try {
        const response = await axios.get(`${API}/users`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUsers(response.data.map(u => ({ ...u, roles: [] })));
      } catch (e) {
        toast.error("Failed to fetch users");
      }
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await axios.get(`${API}/roles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAvailableRoles(response.data);
    } catch (error) {
      console.error("Failed to fetch roles:", error);
    }
  };

  const fetchUserRoles = async (userId) => {
    try {
      const response = await axios.get(`${API}/users/${userId}/roles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedUserRoles(response.data.roles || []);
    } catch (error) {
      console.error("Failed to fetch user roles:", error);
      setSelectedUserRoles([]);
    }
  };

  const handleSubmit = async () => {
    try {
      let newUserId = null;
      
      if (editMode) {
        await axios.put(`${API}/users/${selectedUser.id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success("User updated");
      } else {
        // Create user with legacy role based on RBAC selection
        const legacyRole = formData.rbac_role === 'MASTER_ADMIN' ? 'master_admin' : 'branch_user';
        const createPayload = {
          email: formData.email,
          password: formData.password,
          name: formData.name,
          role: legacyRole,
          assigned_branches: formData.assigned_branches
        };
        
        const response = await axios.post(`${API}/users`, createPayload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        newUserId = response.data.id;
        
        // Auto-assign the selected RBAC role
        if (newUserId && formData.rbac_role) {
          try {
            await axios.post(`${API}/users/${newUserId}/roles`, {
              user_id: newUserId,
              role_code: formData.rbac_role,
              is_primary: true
            }, {
              headers: { Authorization: `Bearer ${token}` }
            });
          } catch (roleError) {
            console.error("Failed to assign role:", roleError);
            // User was created, just role assignment failed
          }
        }
        
        toast.success(`User created with ${formData.rbac_role} role`);
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
      role: user.legacy_role || user.role,
      assigned_branches: user.assigned_branches
    });
    setEditMode(true);
    setShowDialog(true);
  };

  const handleManageRoles = async (user) => {
    setSelectedUser(user);
    await fetchUserRoles(user.id);
    setShowRoleDialog(true);
  };

  const handleAssignRole = async (roleCode) => {
    try {
      await axios.post(`${API}/users/${selectedUser.id}/roles`, {
        user_id: selectedUser.id,
        role_code: roleCode,
        is_primary: false
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Role ${roleCode} assigned`);
      await fetchUserRoles(selectedUser.id);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to assign role");
    }
  };

  const handleRemoveRole = async (roleCode) => {
    try {
      await axios.delete(`${API}/users/${selectedUser.id}/roles/${roleCode}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Role ${roleCode} removed`);
      await fetchUserRoles(selectedUser.id);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to remove role");
    }
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
    setFormData({ 
      email: "", 
      password: "", 
      name: "", 
      role: "branch_user", 
      rbac_role: "BRANCH_OPS_USER",
      assigned_branches: [] 
    });
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
          <p className="text-sm text-muted-foreground mt-1 font-mono">Manage access & permissions (RBAC)</p>
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
                  value={formData.rbac_role}
                  onChange={(e) => {
                    const newRole = e.target.value;
                    const isMasterAdmin = newRole === 'MASTER_ADMIN';
                    setFormData({ 
                      ...formData, 
                      rbac_role: newRole,
                      role: isMasterAdmin ? 'master_admin' : 'branch_user',
                      assigned_branches: isMasterAdmin ? [] : formData.assigned_branches 
                    });
                  }}
                  className="flex h-10 w-full rounded-sm border border-input bg-transparent px-3 py-2 text-sm font-mono"
                  data-testid="user-role-select"
                >
                  {availableRoles.length > 0 ? (
                    availableRoles.map((role) => (
                      <option key={role.id} value={role.code}>
                        {role.code} - {ROLE_DESCRIPTIONS[role.code] || role.description}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="MASTER_ADMIN">MASTER_ADMIN - Full system access</option>
                      <option value="DEMAND_PLANNER">DEMAND_PLANNER - Forecasts & dispatch lots</option>
                      <option value="TECH_OPS_ENGINEER">TECH_OPS_ENGINEER - Master data & BOMs</option>
                      <option value="CPC_PLANNER">CPC_PLANNER - Production scheduling</option>
                      <option value="PROCUREMENT_OFFICER">PROCUREMENT_OFFICER - Vendors & POs</option>
                      <option value="BRANCH_OPS_USER">BRANCH_OPS_USER - Branch operations</option>
                      <option value="QUALITY_INSPECTOR">QUALITY_INSPECTOR - QC management</option>
                      <option value="LOGISTICS_COORDINATOR">LOGISTICS_COORDINATOR - Dispatch & IBT</option>
                      <option value="FINANCE_VIEWER">FINANCE_VIEWER - Finance read-only</option>
                      <option value="AUDITOR_READONLY">AUDITOR_READONLY - Audit read-only</option>
                    </>
                  )}
                </select>
                <p className="text-xs text-zinc-500 mt-1">
                  {formData.rbac_role === 'MASTER_ADMIN' 
                    ? 'Full access to all branches and features' 
                    : ROLE_DESCRIPTIONS[formData.rbac_role] || 'Select a role for this user'}
                </p>
              </div>

              {formData.rbac_role !== "MASTER_ADMIN" && (
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

      {/* Role Assignment Dialog */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-bold uppercase flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Manage Roles - {selectedUser?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Current Roles */}
            <div>
              <Label className="block mb-2">Current Roles</Label>
              <div className="flex flex-wrap gap-2">
                {selectedUserRoles.length > 0 ? (
                  selectedUserRoles.map((role) => (
                    <span
                      key={role.id}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 border border-primary text-primary text-xs font-mono uppercase"
                    >
                      {role.code}
                      <button
                        onClick={() => handleRemoveRole(role.code)}
                        className="ml-1 hover:text-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-zinc-500 font-mono">No RBAC roles assigned</span>
                )}
              </div>
            </div>

            {/* Available Roles */}
            <div>
              <Label className="block mb-2">Available Roles</Label>
              <div className="border border-border rounded-sm max-h-64 overflow-y-auto">
                {availableRoles.map((role) => {
                  const isAssigned = selectedUserRoles.some(r => r.code === role.code);
                  return (
                    <div
                      key={role.id}
                      className={`flex items-center justify-between p-3 border-b border-zinc-100 last:border-b-0 ${isAssigned ? 'bg-zinc-50' : ''}`}
                    >
                      <div>
                        <div className="font-mono text-sm font-bold">{role.code}</div>
                        <div className="text-xs text-zinc-500">{role.description || ROLE_DESCRIPTIONS[role.code]}</div>
                      </div>
                      {!isAssigned ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAssignRole(role.code)}
                          className="text-xs"
                        >
                          <ShieldPlus className="w-3 h-3 mr-1" />
                          Assign
                        </Button>
                      ) : (
                        <span className="text-xs text-green-600 font-mono uppercase">Assigned</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Users Table */}
      <div className="border border-border bg-white rounded-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="users-table">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Name</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Email</th>
                <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">RBAC Roles</th>
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
                    <div className="flex flex-wrap gap-1">
                      {(user.roles && user.roles.length > 0) ? (
                        user.roles.map((role, idx) => (
                          <span
                            key={idx}
                            className={`text-xs font-mono px-2 py-0.5 uppercase tracking-wider border ${
                              role === 'MASTER_ADMIN' ? 'text-primary border-primary bg-primary/5' : 'text-zinc-600 border-zinc-400'
                            }`}
                          >
                            {role}
                          </span>
                        ))
                      ) : (
                        <span className={`text-xs font-mono px-2 py-0.5 uppercase tracking-wider border ${
                          user.legacy_role === 'master_admin' || user.role === 'master_admin' 
                            ? 'text-primary border-primary' 
                            : 'text-zinc-600 border-zinc-600'
                        }`}>
                          {user.legacy_role || user.role}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 align-middle text-xs text-zinc-600 font-mono">
                    {(user.legacy_role === 'master_admin' || user.role === 'master_admin') 
                      ? 'All Branches' 
                      : (user.assigned_branches?.join(', ') || '-')}
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
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleManageRoles(user)}
                        data-testid={`roles-user-${user.email}`}
                        title="Manage Roles"
                      >
                        <Shield className="w-4 h-4 text-blue-600" strokeWidth={1.5} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(user)}
                        data-testid={`edit-user-${user.email}`}
                        title="Edit User"
                      >
                        <Edit className="w-4 h-4 text-primary" strokeWidth={1.5} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActive(user.id)}
                        data-testid={`toggle-user-${user.email}`}
                        title={user.is_active ? "Deactivate" : "Activate"}
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
                        title="Delete User"
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

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import useAuthStore from "@/store/authStore";
import { Factory, Lock, Mail, Shield, ChevronDown } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Test accounts for each role
const TEST_ACCOUNTS = [
  { role: "", label: "-- Select a test account --", email: "", password: "" },
  { role: "MASTER_ADMIN", label: "Master Admin", email: "masteradmin@bidso.com", password: "bidso123", description: "Full system access" },
  { role: "DEMAND_PLANNER", label: "Demand Planner", email: "demandplanner@bidso.com", password: "bidso123", description: "Forecasts & dispatch lots" },
  { role: "TECH_OPS_ENGINEER", label: "Tech Ops Engineer", email: "techops@bidso.com", password: "bidso123", description: "Master data & BOMs" },
  { role: "CPC_PLANNER", label: "CPC Planner", email: "cpcplanner@bidso.com", password: "bidso123", description: "Production scheduling" },
  { role: "PROCUREMENT_OFFICER", label: "Procurement Officer", email: "procurement@bidso.com", password: "bidso123", description: "Vendors & POs" },
  { role: "BRANCH_OPS_USER", label: "Branch Ops User", email: "branchops@bidso.com", password: "bidso123", description: "Branch operations" },
  { role: "QUALITY_INSPECTOR", label: "Quality Inspector", email: "qcinspector@bidso.com", password: "bidso123", description: "QC management" },
  { role: "LOGISTICS_COORDINATOR", label: "Logistics Coordinator", email: "logistics@bidso.com", password: "bidso123", description: "Dispatch & IBT" },
  { role: "FINANCE_VIEWER", label: "Finance Viewer", email: "financeviewer@bidso.com", password: "bidso123", description: "Finance read-only" },
  { role: "AUDITOR_READONLY", label: "Auditor (Read-Only)", email: "auditor@bidso.com", password: "bidso123", description: "Audit read-only" },
];

const Login = () => {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });
  const [selectedRole, setSelectedRole] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRoleSelect = (roleCode) => {
    setSelectedRole(roleCode);
    const account = TEST_ACCOUNTS.find(a => a.role === roleCode);
    if (account && account.email) {
      setFormData({
        email: account.email,
        password: account.password
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(`${API}/auth/login`, formData);
      const { access_token, user } = response.data;
      
      login(access_token, user);
      toast.success(`Welcome ${user.name}!`);
      navigate("/dashboard");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const selectedAccount = TEST_ACCOUNTS.find(a => a.role === selectedRole);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="w-full max-w-md">
        <div className="bg-white border border-zinc-200 rounded-sm p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-zinc-900 rounded-sm flex items-center justify-center mb-4">
              <Factory className="w-8 h-8 text-primary" strokeWidth={1.5} />
            </div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-zinc-900">
              Factory Ops
            </h1>
            <p className="text-xs text-zinc-500 font-mono mt-2">Manufacturing Control System</p>
          </div>

          {/* Role Selector */}
          <div className="mb-6 p-4 bg-zinc-900 border border-zinc-800 rounded-sm">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-primary" strokeWidth={1.5} />
              <Label className="text-xs uppercase tracking-wider font-bold text-white">Quick Login (Test Accounts)</Label>
            </div>
            <div className="relative">
              <select
                value={selectedRole}
                onChange={(e) => handleRoleSelect(e.target.value)}
                className="w-full h-10 px-3 pr-10 bg-zinc-800 border border-zinc-700 text-white text-sm font-mono rounded-sm appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                data-testid="role-selector"
              >
                {TEST_ACCOUNTS.map((account) => (
                  <option key={account.role || 'default'} value={account.role}>
                    {account.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            </div>
            {selectedAccount && selectedAccount.description && (
              <p className="text-xs text-zinc-400 mt-2 font-mono">
                {selectedAccount.description}
              </p>
            )}
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-zinc-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-zinc-500 font-mono">or enter credentials</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-xs uppercase tracking-wider font-bold">Email</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" strokeWidth={1.5} />
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="pl-10 font-mono"
                  placeholder="email@example.com"
                  data-testid="email-input"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs uppercase tracking-wider font-bold">Password</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" strokeWidth={1.5} />
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  className="pl-10 font-mono"
                  placeholder="••••••••"
                  data-testid="password-input"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full uppercase text-xs tracking-wide"
              data-testid="login-btn"
            >
              {loading ? "Logging in..." : "Login"}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-zinc-50 border border-zinc-200 rounded-sm">
            <p className="text-xs text-zinc-600 font-mono">
              <strong>System Admin:</strong><br />
              Email: admin@factory.com<br />
              Password: admin123
            </p>
          </div>
        </div>
        
        <p className="text-center text-xs text-zinc-400 mt-4 font-mono">
          RBAC v2.0 • 10 Roles Available
        </p>
      </div>
    </div>
  );
};

export default Login;

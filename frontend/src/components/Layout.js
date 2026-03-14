import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  Package, 
  Box, 
  GitMerge, 
  Factory, 
  Truck, 
  FileText,
  Gauge,
  ClipboardList,
  Users,
  LogOut,
  PackagePlus,
  Building2,
  PackageCheck,
  Settings,
  TrendingUp,
  CheckCircle,
  Workflow,
  ShoppingCart,
  ArrowLeftRight,
  Receipt,
  Activity,
  Shield
} from "lucide-react";
import BranchSelector from "@/components/BranchSelector";
import useAuthStore from "@/store/authStore";
import { Button } from "@/components/ui/button";

// Role display names mapping
const ROLE_DISPLAY_NAMES = {
  'master_admin': 'MASTER ADMIN',
  'branch_user': 'BRANCH USER',
  'MASTER_ADMIN': 'MASTER ADMIN',
  'DEMAND_PLANNER': 'DEMAND PLANNER',
  'TECH_OPS_ENGINEER': 'TECH OPS ENGINEER',
  'CPC_PLANNER': 'CPC PLANNER',
  'PROCUREMENT_OFFICER': 'PROCUREMENT',
  'BRANCH_OPS_USER': 'BRANCH OPS',
  'QUALITY_INSPECTOR': 'QUALITY',
  'LOGISTICS_COORDINATOR': 'LOGISTICS',
  'FINANCE_VIEWER': 'FINANCE',
  'AUDITOR_READONLY': 'AUDITOR'
};

const Layout = () => {
  const navigate = useNavigate();
  const { user, logout, userRoles, isMasterAdmin, hasRole, hasPermission } = useAuthStore();
  const isAdmin = isMasterAdmin();

  // Navigation items with role-based visibility
  const navItems = [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, show: true },
    { path: "/master-dashboard", label: "Master Dashboard", icon: Gauge, show: isAdmin },
    { path: "/user-management", label: "User Management", icon: Users, show: isAdmin },
    { path: "/techops", label: "Tech Ops", icon: Settings, show: isAdmin || hasRole('TECH_OPS_ENGINEER') },
    { path: "/demand", label: "Demand", icon: TrendingUp, show: isAdmin || hasRole('DEMAND_PLANNER') },
    { path: "/cpc", label: "CPC", icon: Workflow, show: isAdmin || hasRole('CPC_PLANNER') },
    { path: "/procurement", label: "Procurement", icon: ShoppingCart, show: isAdmin || hasRole('PROCUREMENT_OFFICER') },
    { path: "/raw-materials", label: "Raw Materials", icon: Package, show: true },
    { path: "/rm-inward", label: "RM Inward Entry", icon: PackagePlus, show: isAdmin || hasRole('BRANCH_OPS_USER') || hasRole('PROCUREMENT_OFFICER') },
    { path: "/vendors", label: "Vendor Management", icon: Building2, show: isAdmin || hasRole('PROCUREMENT_OFFICER') },
    { path: "/skus", label: "SKUs", icon: Box, show: true },
    { path: "/sku-subscription", label: "SKU Subscription", icon: PackageCheck, show: isAdmin || hasRole('BRANCH_OPS_USER') },
    { path: "/sku-mapping", label: "RM-SKU Mapping", icon: GitMerge, show: isAdmin || hasRole('TECH_OPS_ENGINEER') },
    { path: "/production-planning", label: "Production Planning", icon: ClipboardList, show: isAdmin || hasRole('CPC_PLANNER') || hasRole('BRANCH_OPS_USER') },
    { path: "/production", label: "Production", icon: Factory, show: isAdmin || hasRole('BRANCH_OPS_USER') },
    { path: "/quality", label: "Quality Control", icon: CheckCircle, show: isAdmin || hasRole('QUALITY_INSPECTOR') },
    { path: "/logistics", label: "Logistics", icon: Truck, show: isAdmin || hasRole('LOGISTICS_COORDINATOR') },
    { path: "/ibt", label: "IBT Transfers", icon: ArrowLeftRight, show: isAdmin || hasRole('LOGISTICS_COORDINATOR') || hasRole('BRANCH_OPS_USER') },
    { path: "/events", label: "Event System", icon: Activity, show: isAdmin },
    { path: "/dispatch", label: "Dispatch (Legacy)", icon: Receipt, show: isAdmin || hasRole('LOGISTICS_COORDINATOR') },
    { path: "/reports", label: "Reports", icon: FileText, show: true },
  ];

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Get primary role for display
  const getPrimaryRole = () => {
    if (userRoles.length > 0) {
      return userRoles[0];
    }
    return user?.role || 'branch_user';
  };

  return (
    <div className="flex h-screen bg-zinc-50">
      <aside className="w-64 bg-zinc-900 text-white flex flex-col">
        <div className="p-6 border-b border-zinc-800">
          <h1 className="text-2xl font-black uppercase tracking-tight">Factory Ops</h1>
          <p className="text-xs text-zinc-400 mt-1 font-mono">Manufacturing Control</p>
        </div>
        
        {/* User Info */}
        <div className="p-4 border-b border-zinc-800">
          <div className="text-xs text-zinc-400 uppercase tracking-wider font-bold mb-1">Logged in as</div>
          <div className="text-sm font-mono text-white">{user?.name}</div>
          <div className="flex flex-wrap gap-1 mt-2">
            {userRoles.length > 0 ? (
              userRoles.map((role, index) => (
                <span 
                  key={index}
                  className={`text-xs font-mono px-2 py-1 rounded ${
                    role === 'MASTER_ADMIN' 
                      ? 'bg-primary text-white' 
                      : 'bg-zinc-800 text-zinc-300'
                  }`}
                >
                  {ROLE_DISPLAY_NAMES[role] || role}
                </span>
              ))
            ) : (
              <span className={`text-xs font-mono px-2 py-1 rounded ${
                user?.role === 'master_admin' 
                  ? 'bg-primary text-white' 
                  : 'bg-zinc-800 text-zinc-400'
              }`}>
                {ROLE_DISPLAY_NAMES[user?.role] || 'BRANCH USER'}
              </span>
            )}
          </div>
        </div>

        <BranchSelector />
        
        <nav className="flex-1 p-4 overflow-y-auto">
          {navItems.filter(item => item.show).map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              data-testid={`nav-${item.path.slice(1)}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 mb-2 rounded-sm text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-zinc-800 text-white border-l-2 border-primary"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                }`
              }
            >
              <item.icon className="w-5 h-5" strokeWidth={1.5} />
              <span className="uppercase tracking-wide text-xs">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        
        <div className="p-4 border-t border-zinc-800">
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start text-zinc-400 hover:text-white hover:bg-zinc-800"
            data-testid="logout-btn"
          >
            <LogOut className="w-5 h-5 mr-3" strokeWidth={1.5} />
            <span className="uppercase tracking-wide text-xs">Logout</span>
          </Button>
        </div>
        
        <div className="p-4 border-t border-zinc-800 text-xs text-zinc-500 font-mono">
          <div className="flex items-center gap-2">
            <Shield className="w-3 h-3" />
            <span>RBAC v2.0</span>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
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
  Workflow
} from "lucide-react";
import BranchSelector from "@/components/BranchSelector";
import useAuthStore from "@/store/authStore";
import { Button } from "@/components/ui/button";

const Layout = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const isMasterAdmin = user?.role === 'master_admin';

  const navItems = [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, show: true },
    { path: "/master-dashboard", label: "Master Dashboard", icon: Gauge, show: isMasterAdmin },
    { path: "/user-management", label: "User Management", icon: Users, show: isMasterAdmin },
    { path: "/techops", label: "Tech Ops", icon: Settings, show: true },
    { path: "/demand", label: "Demand", icon: TrendingUp, show: true },
    { path: "/cpc", label: "CPC", icon: Workflow, show: true },
    { path: "/raw-materials", label: "Raw Materials", icon: Package, show: true },
    { path: "/rm-inward", label: "RM Inward Entry", icon: PackagePlus, show: true },
    { path: "/vendors", label: "Vendor Management", icon: Building2, show: true },
    { path: "/skus", label: "SKUs", icon: Box, show: true },
    { path: "/sku-subscription", label: "SKU Subscription", icon: PackageCheck, show: true },
    { path: "/sku-mapping", label: "RM-SKU Mapping", icon: GitMerge, show: true },
    { path: "/production-planning", label: "Production Planning", icon: ClipboardList, show: true },
    { path: "/production", label: "Production", icon: Factory, show: true },
    { path: "/quality", label: "Quality Control", icon: CheckCircle, show: true },
    { path: "/dispatch", label: "Dispatch", icon: Truck, show: true },
    { path: "/reports", label: "Reports", icon: FileText, show: true },
  ];

  const handleLogout = () => {
    logout();
    navigate("/login");
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
          <div className={`text-xs font-mono mt-1 px-2 py-1 inline-block rounded ${user?.role === 'master_admin' ? 'bg-primary text-white' : 'bg-zinc-800 text-zinc-400'}`}>
            {user?.role === 'master_admin' ? 'MASTER ADMIN' : 'BRANCH USER'}
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
          <div>v1.1.0</div>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
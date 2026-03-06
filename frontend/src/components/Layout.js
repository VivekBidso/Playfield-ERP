import { Outlet, NavLink } from "react-router-dom";
import { 
  LayoutDashboard, 
  Package, 
  Box, 
  GitMerge, 
  Factory, 
  Truck, 
  FileText,
  Gauge
} from "lucide-react";
import BranchSelector from "@/components/BranchSelector";

const Layout = () => {
  const navItems = [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/master-dashboard", label: "Master Dashboard", icon: Gauge },
    { path: "/raw-materials", label: "Raw Materials", icon: Package },
    { path: "/skus", label: "SKUs", icon: Box },
    { path: "/sku-mapping", label: "RM-SKU Mapping", icon: GitMerge },
    { path: "/production", label: "Production", icon: Factory },
    { path: "/dispatch", label: "Dispatch", icon: Truck },
    { path: "/reports", label: "Reports", icon: FileText },
  ];

  return (
    <div className="flex h-screen bg-zinc-50">
      <aside className="w-64 bg-zinc-900 text-white flex flex-col">
        <div className="p-6 border-b border-zinc-800">
          <h1 className="text-2xl font-black uppercase tracking-tight">Factory Ops</h1>
          <p className="text-xs text-zinc-400 mt-1 font-mono">Manufacturing Control</p>
        </div>
        <BranchSelector />
        <nav className="flex-1 p-4">
          {navItems.map((item) => (
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
        <div className="p-4 border-t border-zinc-800 text-xs text-zinc-500 font-mono">
          <div>v1.0.0</div>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
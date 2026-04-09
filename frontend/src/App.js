import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import MasterDashboard from "@/pages/MasterDashboard";
import RawMaterials from "@/pages/RawMaterials";
import RMInward from "@/pages/RMInward";
import RMRepository from "@/pages/RMRepository";
// SKUs Legacy page removed - use SKU Management instead
// Dispatch Legacy page removed - use Dispatch Lots instead
// SKUMapping removed - use SKU Management BOM instead
import SKUSubscription from "@/pages/SKUSubscription";
import SKUManagement from "@/pages/SKUManagement";
import VendorManagement from "@/pages/VendorManagement";
// ProductionPlanning page removed - CPC handles all production planning from forecasts
// Production page removed - Branch Ops handles schedule completion
import DispatchLots from "@/pages/DispatchLots";
import Reports from "@/pages/Reports";
import UserManagement from "@/pages/UserManagement";
import TechOps from "@/pages/TechOps";
import Demand from "@/pages/Demand";
import Quality from "@/pages/Quality";
import CPC from "@/pages/CPC";
import Procurement from "@/pages/Procurement";
import Logistics from "@/pages/Logistics";
import IBT from "@/pages/IBT";
import Events from "@/pages/Events";
import BranchOps from "@/pages/BranchOps";
import DemandHub from "@/pages/DemandHub";
import DemandSKUView from "@/pages/DemandSKUView";
import ColorDevelopment from "@/pages/ColorDevelopment";
import RMShortage from "@/pages/RMShortage";
import RMProduction from "@/pages/RMProduction";
import Inventory from "@/pages/Inventory";
import DBExplorer from "@/pages/DBExplorer";
import { Toaster } from "@/components/ui/sonner";
import useAuthStore from "@/store/authStore";
import axios from "axios";
import "@/index.css";

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

// Master Admin Only Route
const AdminRoute = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== 'master_admin') return <Navigate to="/dashboard" replace />;
  return children;
};

// Set up axios interceptor for auth
const setupAxiosInterceptor = () => {
  axios.interceptors.request.use((config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }
  );
};

function App() {
  useEffect(() => {
    setupAxiosInterceptor();
  }, []);

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="master-dashboard" element={<AdminRoute><MasterDashboard /></AdminRoute>} />
            <Route path="user-management" element={<AdminRoute><UserManagement /></AdminRoute>} />
            <Route path="raw-materials" element={<RawMaterials />} />
            <Route path="rm-inward" element={<RMInward />} />
            {/* SKUs Legacy removed - use SKU Management */}
            {/* sku-mapping route removed - use SKU Management BOM instead */}
            <Route path="sku-subscription" element={<SKUSubscription />} />
            <Route path="sku-management" element={<SKUManagement />} />
            <Route path="vendors" element={<VendorManagement />} />
            {/* Production page removed - Branch Ops handles schedule completion */}
            {/* Dispatch Legacy removed - use Dispatch Lots */}
            <Route path="dispatch-lots" element={<DispatchLots />} />
            <Route path="reports" element={<Reports />} />
            <Route path="techops" element={<TechOps />} />
            <Route path="demand" element={<Demand />} />
            <Route path="quality" element={<Quality />} />
            <Route path="cpc" element={<CPC />} />
            <Route path="procurement" element={<Procurement />} />
            <Route path="logistics" element={<Logistics />} />
            <Route path="ibt" element={<IBT />} />
            <Route path="events" element={<Events />} />
            <Route path="branch-ops" element={<BranchOps />} />
            <Route path="rm-shortage" element={<RMShortage />} />
            <Route path="rm-production" element={<RMProduction />} />
            <Route path="rm-repository" element={<RMRepository />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="demand-hub" element={<DemandHub />} />
            <Route path="demand-sku-view" element={<DemandSKUView />} />
            <Route path="color-development" element={<ColorDevelopment />} />
            <Route path="db-explorer" element={<AdminRoute><DBExplorer /></AdminRoute>} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster />
    </>
  );
}

export default App;
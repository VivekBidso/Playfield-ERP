import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import MasterDashboard from "@/pages/MasterDashboard";
import RawMaterials from "@/pages/RawMaterials";
import RMInward from "@/pages/RMInward";
import SKUs from "@/pages/SKUs";
import SKUMapping from "@/pages/SKUMapping";
import SKUSubscription from "@/pages/SKUSubscription";
import VendorManagement from "@/pages/VendorManagement";
import ProductionPlanning from "@/pages/ProductionPlanning";
import Production from "@/pages/Production";
import Dispatch from "@/pages/Dispatch";
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
            <Route path="skus" element={<SKUs />} />
            <Route path="sku-mapping" element={<SKUMapping />} />
            <Route path="sku-subscription" element={<SKUSubscription />} />
            <Route path="vendors" element={<VendorManagement />} />
            <Route path="production-planning" element={<ProductionPlanning />} />
            <Route path="production" element={<Production />} />
            <Route path="dispatch" element={<Dispatch />} />
            <Route path="reports" element={<Reports />} />
            <Route path="techops" element={<TechOps />} />
            <Route path="demand" element={<Demand />} />
            <Route path="quality" element={<Quality />} />
            <Route path="cpc" element={<CPC />} />
            <Route path="procurement" element={<Procurement />} />
            <Route path="logistics" element={<Logistics />} />
            <Route path="ibt" element={<IBT />} />
            <Route path="events" element={<Events />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster />
    </>
  );
}

export default App;
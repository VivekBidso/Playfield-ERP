import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import MasterDashboard from "@/pages/MasterDashboard";
import RawMaterials from "@/pages/RawMaterials";
import SKUs from "@/pages/SKUs";
import SKUMapping from "@/pages/SKUMapping";
import Production from "@/pages/Production";
import Dispatch from "@/pages/Dispatch";
import Reports from "@/pages/Reports";
import { Toaster } from "@/components/ui/sonner";
import "@/index.css";

function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="master-dashboard" element={<MasterDashboard />} />
            <Route path="raw-materials" element={<RawMaterials />} />
            <Route path="skus" element={<SKUs />} />
            <Route path="sku-mapping" element={<SKUMapping />} />
            <Route path="production" element={<Production />} />
            <Route path="dispatch" element={<Dispatch />} />
            <Route path="reports" element={<Reports />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster />
    </>
  );
}

export default App;
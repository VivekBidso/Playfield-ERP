import { useState, useEffect } from "react";
import useBranchStore from "@/store/branchStore";
import useAuthStore from "@/store/authStore";
import { Building2 } from "lucide-react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const BranchSelector = () => {
  const { selectedBranch, setSelectedBranch } = useBranchStore();
  const { hasRole } = useAuthStore();
  const [branches, setBranches] = useState([]);

  // Hide branch selector for Demand Planner - they see all branches
  const isDemandPlanner = hasRole('DEMAND_PLANNER') && !hasRole('MASTER_ADMIN');

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    try {
      const response = await axios.get(`${API}/branches/names`);
      setBranches(response.data.branches || []);
    } catch (error) {
      console.error('Failed to fetch branches:', error);
      setBranches([]);
    }
  };

  // Don't show branch selector for Demand Planner
  if (isDemandPlanner) {
    return null;
  }

  return (
    <div className="p-4 border-b border-zinc-800" data-testid="branch-selector">
      <div className="flex items-center gap-3">
        <Building2 className="w-5 h-5 text-primary" strokeWidth={1.5} />
        <select
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
          className="flex-1 bg-zinc-800 text-white border border-zinc-700 rounded-sm px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
          data-testid="branch-select"
        >
          {branches.map((branch) => (
            <option key={branch} value={branch}>
              {branch}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-2 text-xs text-zinc-500 font-mono">Current Branch</div>
    </div>
  );
};

export default BranchSelector;
import { useState, useEffect } from "react";
import axios from "axios";
import { Package, Box, AlertTriangle, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import useBranchStore from "@/store/branchStore";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Dashboard = () => {
  const { selectedBranch } = useBranchStore();
  const [stats, setStats] = useState(null);
  const [productionData, setProductionData] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, [selectedBranch]);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, prodRes, dispatchRes] = await Promise.all([
        axios.get(`${API}/dashboard/stats?branch=${encodeURIComponent(selectedBranch)}`),
        axios.get(`${API}/production-entries?branch=${encodeURIComponent(selectedBranch)}`),
        axios.get(`${API}/dispatch-entries?branch=${encodeURIComponent(selectedBranch)}`)
      ]);

      setStats(statsRes.data);
      
      // Process production data for chart (last 7 days)
      const last7Days = prodRes.data.slice(0, 7).reverse();
      const chartData = last7Days.reduce((acc, entry) => {
        const date = new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const existing = acc.find(item => item.date === date);
        if (existing) {
          existing.quantity += entry.quantity;
        } else {
          acc.push({ date, quantity: entry.quantity });
        }
        return acc;
      }, []);
      setProductionData(chartData);

      // Recent activity
      const activity = [
        ...prodRes.data.slice(0, 5).map(p => ({ ...p, type: 'production' })),
        ...dispatchRes.data.slice(0, 5).map(d => ({ ...d, type: 'dispatch' }))
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 10);
      setRecentActivity(activity);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  if (!stats) {
    return <div className="p-8">Loading...</div>;
  }

  const statCards = [
    { label: "Total Raw Materials", value: stats.total_rm_value, icon: Package, color: "text-zinc-700" },
    { label: "Total SKUs", value: stats.total_sku_value, icon: Box, color: "text-zinc-700" },
    { label: "Low Stock Items", value: stats.low_stock_items, icon: AlertTriangle, color: "text-red-600" },
    { label: "Today's Production", value: stats.today_production, icon: TrendingUp, color: "text-primary" },
  ];

  return (
    <div className="p-6 md:p-8" data-testid="dashboard-page">
      <div className="mb-8">
        <h1 className="text-4xl font-black tracking-tight uppercase">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1 font-mono">Manufacturing overview for {selectedBranch}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-border border border-border mb-8">
        {statCards.map((stat, idx) => (
          <div key={idx} className="bg-white p-6" data-testid={`stat-card-${idx}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">
                  {stat.label}
                </div>
                <div className={`text-4xl font-black font-mono ${stat.color}`}>
                  {stat.value}
                </div>
              </div>
              <stat.icon className={`w-8 h-8 ${stat.color}`} strokeWidth={1.5} />
            </div>
          </div>
        ))}
      </div>

      {/* Charts & Activity */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Production Chart */}
        <div className="md:col-span-2 border border-border bg-white rounded-sm">
          <div className="p-6 border-b border-border">
            <h2 className="text-lg font-bold uppercase tracking-tight">Production Last 7 Days</h2>
          </div>
          <div className="p-6">
            {productionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={productionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
                  <XAxis dataKey="date" style={{ fontSize: '12px', fontFamily: 'IBM Plex Mono' }} />
                  <YAxis style={{ fontSize: '12px', fontFamily: 'IBM Plex Mono' }} />
                  <Tooltip />
                  <Bar dataKey="quantity" fill="#F97316" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-300px flex items-center justify-center text-muted-foreground font-mono text-sm">
                No production data available
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="border border-border bg-white rounded-sm">
          <div className="p-6 border-b border-border">
            <h2 className="text-lg font-bold uppercase tracking-tight">Recent Activity</h2>
          </div>
          <div className="p-6 max-h-96 overflow-y-auto">
            {recentActivity.length > 0 ? (
              <div className="space-y-4">
                {recentActivity.map((activity, idx) => (
                  <div key={idx} className="pb-4 border-b border-zinc-100 last:border-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1">
                          {activity.type}
                        </div>
                        <div className="font-mono text-sm text-zinc-700">{activity.sku_id}</div>
                        <div className="font-mono text-xs text-muted-foreground mt-1">
                          Qty: {activity.quantity}
                        </div>
                      </div>
                      <div className="text-xs font-mono text-muted-foreground">
                        {new Date(activity.date).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground font-mono text-sm">No recent activity</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
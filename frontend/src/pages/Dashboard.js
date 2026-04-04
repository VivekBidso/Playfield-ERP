import { useState, useEffect } from "react";
import axios from "axios";
import { Package, Box, AlertTriangle, TrendingUp, Calendar, Target } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import useBranchStore from "@/store/branchStore";
import useAuthStore from "@/store/authStore";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Dashboard = () => {
  const { selectedBranch } = useBranchStore();
  const { hasRole, token } = useAuthStore();
  const isDemandPlanner = hasRole('DEMAND_PLANNER') && !hasRole('MASTER_ADMIN');
  
  const [stats, setStats] = useState(null);
  const [productionData, setProductionData] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [transferSummary, setTransferSummary] = useState(null);
  
  // Demand-specific data
  const [demandStats, setDemandStats] = useState(null);
  const [forecasts, setForecasts] = useState([]);
  const [dispatchLots, setDispatchLots] = useState([]);

  useEffect(() => {
    if (isDemandPlanner) {
      fetchDemandDashboardData();
    } else {
      fetchDashboardData();
    }
  }, [selectedBranch, isDemandPlanner]);

  const fetchDemandDashboardData = async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const [forecastsRes, lotsRes, skusRes] = await Promise.all([
        axios.get(`${API}/forecasts`, { headers }),
        axios.get(`${API}/dispatch-lots`, { headers }),
        axios.get(`${API}/skus`, { headers })
      ]);
      
      setForecasts(forecastsRes.data);
      setDispatchLots(lotsRes.data);
      
      // Calculate demand-specific stats
      const draftForecasts = forecastsRes.data.filter(f => f.status === 'DRAFT').length;
      const confirmedForecasts = forecastsRes.data.filter(f => f.status === 'CONFIRMED').length;
      const totalForecastQty = forecastsRes.data.reduce((sum, f) => sum + (f.quantity || 0), 0);
      const pendingLots = lotsRes.data.filter(l => l.status === 'CREATED').length;
      const inProductionLots = lotsRes.data.filter(l => 
        ['PRODUCTION_ASSIGNED', 'PARTIALLY_PRODUCED'].includes(l.status)
      ).length;
      
      setDemandStats({
        draft_forecasts: draftForecasts,
        confirmed_forecasts: confirmedForecasts,
        total_forecast_qty: totalForecastQty,
        pending_lots: pendingLots,
        in_production_lots: inProductionLots,
        total_skus: skusRes.data.length
      });
      
      setStats({ loaded: true }); // Mark as loaded for the loading check
    } catch (error) {
      console.error('Error fetching demand dashboard data:', error);
      setStats({ loaded: true, error: true });
    }
  };

  const fetchDashboardData = async () => {
    try {
      const branchParam = selectedBranch ? `?branch=${encodeURIComponent(selectedBranch)}` : '';
      
      const [statsRes, prodRes, dispatchRes, transferRes, summaryRes] = await Promise.all([
        axios.get(`${API}/dashboard/stats${branchParam}`),
        axios.get(`${API}/production-entries${branchParam}`),
        axios.get(`${API}/dispatch-entries${branchParam}`),
        axios.get(`${API}/sku-transfers${branchParam}`),
        axios.get(`${API}/sku-transfers/summary${branchParam}`)
      ]);

      setStats(statsRes.data);
      setTransfers(transferRes.data);
      setTransferSummary(summaryRes.data);
      
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

      // Recent activity including transfers
      const activity = [
        ...prodRes.data.slice(0, 5).map(p => ({ ...p, type: 'production' })),
        ...dispatchRes.data.slice(0, 5).map(d => ({ ...d, type: 'dispatch' })),
        ...transferRes.data.slice(0, 5).map(t => ({ 
          ...t, 
          type: 'transfer',
          date: t.transferred_at
        }))
      ].sort((a, b) => new Date(b.date || b.transferred_at) - new Date(a.date || a.transferred_at)).slice(0, 10);
      setRecentActivity(activity);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setStats({ loaded: true, error: true });
    }
  };

  const fetchSKUsForTransfer = async () => {
    try {
      const [skusRes, filterRes] = await Promise.all([
        axios.get(`${API}/skus?branch=${encodeURIComponent(selectedBranch)}`),
        axios.get(`${API}/skus/filter-options`)
      ]);
      setSkus(skusRes.data);
      setFilteredSkus(skusRes.data);
      setVerticals(filterRes.data.verticals);
    } catch (error) {
      console.error("Failed to fetch SKUs", error);
    }
  };

  if (!stats) {
    return <div className="p-8">Loading...</div>;
  }

  // Demand Planner specific dashboard - always show this view for demand planners
  if (isDemandPlanner) {
    // Show loading state while demandStats is being fetched
    if (!demandStats) {
      return (
        <div className="p-6 md:p-8" data-testid="dashboard-page">
          <div className="mb-8">
            <h1 className="text-4xl font-black tracking-tight uppercase">Demand Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1 font-mono">Loading forecast data...</p>
          </div>
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1,2,3,4].map(i => (
                <div key={i} className="h-24 bg-zinc-100 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      );
    }
    const demandStatCards = [
      { label: "Draft Forecasts", value: demandStats.draft_forecasts, icon: TrendingUp, color: "text-zinc-700" },
      { label: "Confirmed Forecasts", value: demandStats.confirmed_forecasts, icon: Target, color: "text-blue-600" },
      { label: "Pending Lots", value: demandStats.pending_lots, icon: Package, color: "text-orange-600" },
      { label: "In Production", value: demandStats.in_production_lots, icon: Box, color: "text-green-600" },
    ];

    return (
      <div className="p-6 md:p-8" data-testid="dashboard-page">
        <div className="mb-8">
          <h1 className="text-4xl font-black tracking-tight uppercase">Demand Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">Forecast & Dispatch Overview</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-border border border-border mb-8">
          {demandStatCards.map((stat, idx) => (
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

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="border border-border bg-white rounded-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-primary" />
              <h3 className="font-bold uppercase">Total Forecast Volume</h3>
            </div>
            <div className="text-4xl font-black font-mono text-primary">
              {demandStats.total_forecast_qty.toLocaleString()}
            </div>
            <p className="text-xs text-zinc-500 mt-2">units across all forecasts</p>
          </div>
          
          <div className="border border-border bg-white rounded-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Box className="w-5 h-5 text-primary" />
              <h3 className="font-bold uppercase">SKU Master Count</h3>
            </div>
            <div className="text-4xl font-black font-mono text-zinc-700">
              {demandStats.total_skus.toLocaleString()}
            </div>
            <p className="text-xs text-zinc-500 mt-2">active SKUs in system</p>
          </div>
        </div>

        {/* Recent Forecasts */}
        <div className="border border-border bg-white rounded-sm mb-8">
          <div className="p-6 border-b border-border">
            <h2 className="text-lg font-bold uppercase tracking-tight">Recent Forecasts</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-50 border-b">
                <tr>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Code</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Month</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">SKU</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Qty</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {forecasts.slice(0, 5).map((f) => (
                  <tr key={f.id} className="border-b hover:bg-zinc-50/50">
                    <td className="p-4 font-mono font-bold text-sm">{f.forecast_code}</td>
                    <td className="p-4 font-mono text-sm">{f.forecast_month?.slice(0, 7)}</td>
                    <td className="p-4 font-mono text-sm text-zinc-600">{f.sku_id || 'Vertical-level'}</td>
                    <td className="p-4 font-mono font-bold">{f.quantity?.toLocaleString()}</td>
                    <td className="p-4">
                      <span className={`text-xs font-mono px-2 py-1 rounded border ${
                        f.status === 'CONFIRMED' ? 'bg-blue-100 text-blue-700 border-blue-300' :
                        f.status === 'CONVERTED' ? 'bg-green-100 text-green-700 border-green-300' :
                        'bg-zinc-100 text-zinc-700 border-zinc-300'
                      }`}>{f.status}</span>
                    </td>
                  </tr>
                ))}
                {forecasts.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-zinc-500">No forecasts yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Dispatch Lots */}
        <div className="border border-border bg-white rounded-sm">
          <div className="p-6 border-b border-border">
            <h2 className="text-lg font-bold uppercase tracking-tight">Recent Dispatch Lots</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-50 border-b">
                <tr>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Lot Code</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">SKU</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Required</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Produced</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {dispatchLots.slice(0, 5).map((lot) => (
                  <tr key={lot.id} className="border-b hover:bg-zinc-50/50">
                    <td className="p-4 font-mono font-bold text-sm">{lot.lot_code}</td>
                    <td className="p-4 font-mono text-sm">{lot.sku_id}</td>
                    <td className="p-4 font-mono font-bold">{lot.required_quantity?.toLocaleString()}</td>
                    <td className="p-4 font-mono">{lot.produced_quantity?.toLocaleString() || 0}</td>
                    <td className="p-4">
                      <span className={`text-xs font-mono px-2 py-1 rounded border ${
                        lot.status === 'FULLY_PRODUCED' ? 'bg-green-100 text-green-700 border-green-300' :
                        lot.status === 'PRODUCTION_ASSIGNED' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
                        'bg-zinc-100 text-zinc-700 border-zinc-300'
                      }`}>{lot.status?.replace(/_/g, ' ')}</span>
                    </td>
                  </tr>
                ))}
                {dispatchLots.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-zinc-500">No dispatch lots yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Regular dashboard for other roles
  const statCards = [
    { label: "Total Raw Materials", value: stats.total_rm_value || 0, icon: Package, color: "text-zinc-700" },
    { label: "Total SKUs", value: stats.total_sku_value || 0, icon: Box, color: "text-zinc-700" },
    { label: "Low Stock Items", value: stats.low_stock_items || 0, icon: AlertTriangle, color: "text-red-600" },
    { label: "Today's Production", value: stats.today_production || 0, icon: TrendingUp, color: "text-primary" },
  ];

  return (
    <div className="p-6 md:p-8" data-testid="dashboard-page">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight uppercase">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">Manufacturing overview for {selectedBranch}</p>
        </div>
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

      {/* Transfer Summary (if any transfers exist) */}
      {transferSummary && (transferSummary.incoming_count > 0 || transferSummary.outgoing_count > 0) && (
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-px bg-border border border-border">
          <div className="bg-white p-6">
            <div className="flex items-center gap-2 mb-2">
              <ArrowRightLeft className="w-4 h-4 text-green-600" strokeWidth={1.5} />
              <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">
                Incoming Transfers
              </span>
            </div>
            <div className="text-3xl font-black font-mono text-green-600">
              {transferSummary.incoming_total} <span className="text-sm font-normal text-zinc-500">units ({transferSummary.incoming_count} transfers)</span>
            </div>
          </div>
          <div className="bg-white p-6">
            <div className="flex items-center gap-2 mb-2">
              <ArrowRightLeft className="w-4 h-4 text-orange-600" strokeWidth={1.5} />
              <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">
                Outgoing Transfers
              </span>
            </div>
            <div className="text-3xl font-black font-mono text-orange-600">
              {transferSummary.outgoing_total} <span className="text-sm font-normal text-zinc-500">units ({transferSummary.outgoing_count} transfers)</span>
            </div>
          </div>
        </div>
      )}

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
                        <div className={`text-xs uppercase tracking-wider font-bold mb-1 ${
                          activity.type === 'production' ? 'text-green-600' : 
                          activity.type === 'dispatch' ? 'text-red-600' : 'text-blue-600'
                        }`}>
                          {activity.type}
                          {activity.type === 'transfer' && (
                            <span className="text-zinc-400 font-normal ml-1">
                              → {activity.to_branch}
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-sm text-zinc-700">{activity.sku_id}</div>
                        <div className="font-mono text-xs text-muted-foreground mt-1">
                          Qty: {activity.quantity}
                        </div>
                      </div>
                      <div className="text-xs font-mono text-muted-foreground">
                        {new Date(activity.date || activity.transferred_at).toLocaleDateString()}
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

      {/* Recent Transfers Table */}
      {transfers.length > 0 && (
        <div className="mt-8 border border-border bg-white rounded-sm">
          <div className="p-6 border-b border-border flex items-center gap-3">
            <ArrowRightLeft className="w-5 h-5 text-primary" strokeWidth={1.5} />
            <h2 className="text-lg font-bold uppercase tracking-tight">Recent Transfers</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="transfers-table">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Date</th>
                  <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">SKU ID</th>
                  <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">From</th>
                  <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">To</th>
                  <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Quantity</th>
                  <th className="h-10 px-4 text-left align-middle font-mono text-xs font-medium text-zinc-500 uppercase tracking-wider">Notes</th>
                </tr>
              </thead>
              <tbody>
                {transfers.slice(0, 10).map((transfer) => (
                  <tr key={transfer.id} className="border-b border-zinc-100 hover:bg-zinc-50/50">
                    <td className="p-4 align-middle font-mono text-sm text-zinc-700">
                      {new Date(transfer.transferred_at).toLocaleDateString()}
                    </td>
                    <td className="p-4 align-middle font-mono text-sm font-bold text-zinc-700">{transfer.sku_id}</td>
                    <td className="p-4 align-middle">
                      <span className={`text-xs font-mono px-2 py-1 rounded ${
                        transfer.from_branch === selectedBranch 
                          ? 'bg-orange-50 text-orange-700 border border-orange-200' 
                          : 'bg-zinc-50 text-zinc-600'
                      }`}>
                        {transfer.from_branch}
                      </span>
                    </td>
                    <td className="p-4 align-middle">
                      <span className={`text-xs font-mono px-2 py-1 rounded ${
                        transfer.to_branch === selectedBranch 
                          ? 'bg-green-50 text-green-700 border border-green-200' 
                          : 'bg-zinc-50 text-zinc-600'
                      }`}>
                        {transfer.to_branch}
                      </span>
                    </td>
                    <td className="p-4 align-middle font-mono text-sm text-zinc-700">{transfer.quantity}</td>
                    <td className="p-4 align-middle text-sm text-zinc-600">{transfer.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

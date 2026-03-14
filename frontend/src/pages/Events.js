import { useState, useEffect } from "react";
import axios from "axios";
import { 
  Activity, 
  Bell, 
  CheckCircle, 
  AlertTriangle,
  RefreshCw,
  Clock,
  Zap,
  Filter,
  Eye,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Events = () => {
  const [activeTab, setActiveTab] = useState("events");
  
  // Data
  const [events, setEvents] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState(null);
  const [subscriptions, setSubscriptions] = useState({});
  const [eventTypes, setEventTypes] = useState([]);
  
  // Filters
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [alertFilter, setAlertFilter] = useState("unread");
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [eventsRes, alertsRes, statsRes, subsRes, typesRes] = await Promise.all([
        axios.get(`${API}/events/recent?limit=50`),
        axios.get(`${API}/events/alerts?limit=50`),
        axios.get(`${API}/events/stats`),
        axios.get(`${API}/events/subscriptions`),
        axios.get(`${API}/events/types`)
      ]);
      setEvents(eventsRes.data);
      setAlerts(alertsRes.data);
      setStats(statsRes.data);
      setSubscriptions(subsRes.data);
      setEventTypes(typesRes.data.event_types || []);
    } catch (error) {
      toast.error("Failed to fetch event data");
    }
    setLoading(false);
  };

  const handleMarkAlertRead = async (alertId) => {
    try {
      await axios.put(`${API}/events/alerts/${alertId}/read`);
      toast.success("Alert marked as read");
      fetchAllData();
    } catch (error) {
      toast.error("Failed to mark alert as read");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await axios.put(`${API}/events/alerts/read-all`);
      toast.success("All alerts marked as read");
      fetchAllData();
    } catch (error) {
      toast.error("Failed to mark alerts as read");
    }
  };

  const getSeverityBadge = (severity) => {
    const colors = {
      HIGH: "bg-red-100 text-red-800",
      MEDIUM: "bg-yellow-100 text-yellow-800",
      LOW: "bg-blue-100 text-blue-800"
    };
    return <Badge className={colors[severity] || "bg-zinc-200"}>{severity}</Badge>;
  };

  const getEventTypeBadge = (eventType) => {
    const typeMap = {
      // Production
      BATCH_COMPLETED: "bg-green-100 text-green-800",
      PRODUCTION_ENTRY_CREATED: "bg-green-100 text-green-800",
      // Quality
      QC_PASSED: "bg-emerald-100 text-emerald-800",
      QC_FAILED: "bg-red-100 text-red-800",
      // Inventory
      RM_STOCK_LOW: "bg-orange-100 text-orange-800",
      RM_STOCK_UPDATED: "bg-blue-100 text-blue-800",
      // SKU
      SKU_CREATED: "bg-purple-100 text-purple-800",
      BOM_FINALIZED: "bg-purple-100 text-purple-800",
      // Logistics
      DISPATCH_SHIPPED: "bg-cyan-100 text-cyan-800",
      IBT_COMPLETED: "bg-cyan-100 text-cyan-800",
      // Invoice
      INVOICE_PAID: "bg-green-100 text-green-800"
    };
    return <Badge className={typeMap[eventType] || "bg-zinc-100 text-zinc-800"}>{eventType}</Badge>;
  };

  const filteredEvents = events.filter(e => {
    if (eventTypeFilter === "all") return true;
    return e.event_type === eventTypeFilter;
  });

  const filteredAlerts = alerts.filter(a => {
    if (alertFilter === "all") return true;
    if (alertFilter === "unread") return !a.is_read;
    return a.is_read;
  });

  const unreadCount = alerts.filter(a => !a.is_read).length;

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center" data-testid="events-loading">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        Loading event data...
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8" data-testid="events-page">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-black tracking-tight uppercase">Event System</h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">Message Queue & Notifications</p>
        </div>
        <Button variant="outline" onClick={fetchAllData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase text-muted-foreground flex items-center gap-2">
              <Activity className="w-4 h-4" /> Total Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{stats?.total_events || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" /> Last 24h
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-blue-600">{stats?.events_last_24h || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase text-muted-foreground flex items-center gap-2">
              <Bell className="w-4 h-4" /> Unread Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-orange-600">{unreadCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase text-muted-foreground flex items-center gap-2">
              <Zap className="w-4 h-4" /> Handlers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{Object.keys(subscriptions).length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="events" className="uppercase text-xs tracking-wide">
            <Activity className="w-4 h-4 mr-2" />
            Event Log ({events.length})
          </TabsTrigger>
          <TabsTrigger value="alerts" className="uppercase text-xs tracking-wide">
            <Bell className="w-4 h-4 mr-2" />
            Alerts ({unreadCount} unread)
          </TabsTrigger>
          <TabsTrigger value="handlers" className="uppercase text-xs tracking-wide">
            <Zap className="w-4 h-4 mr-2" />
            Handlers
          </TabsTrigger>
        </TabsList>

        {/* Event Log Tab */}
        <TabsContent value="events">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {eventTypes.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border rounded-sm">
            <table className="w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Timestamp</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Event Type</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Module</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Payload</th>
                  <th className="h-10 px-4 text-left font-mono text-xs uppercase">Handlers</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((event) => (
                  <tr key={event.id} className="border-t">
                    <td className="p-4 text-sm font-mono">
                      {new Date(event.timestamp).toLocaleString()}
                    </td>
                    <td className="p-4">{getEventTypeBadge(event.event_type)}</td>
                    <td className="p-4 text-sm">{event.source_module}</td>
                    <td className="p-4 text-xs font-mono max-w-[300px] truncate">
                      {JSON.stringify(event.payload)}
                    </td>
                    <td className="p-4 text-xs">
                      {(event.handlers_triggered || []).map(h => (
                        <Badge key={h} variant="outline" className="mr-1 text-xs">{h}</Badge>
                      ))}
                    </td>
                  </tr>
                ))}
                {filteredEvents.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No events found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={alertFilter} onValueChange={setAlertFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Alerts</SelectItem>
                  <SelectItem value="unread">Unread Only</SelectItem>
                  <SelectItem value="read">Read Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {unreadCount > 0 && (
              <Button variant="outline" onClick={handleMarkAllRead}>
                <Check className="w-4 h-4 mr-2" /> Mark All Read
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {filteredAlerts.map((alert) => (
              <Card key={alert.id} className={alert.is_read ? "opacity-60" : ""}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {alert.alert_type === "LOW_STOCK" && <AlertTriangle className="w-4 h-4 text-orange-600" />}
                        {alert.alert_type === "QC_FAILURE" && <AlertTriangle className="w-4 h-4 text-red-600" />}
                        {getSeverityBadge(alert.severity)}
                        <Badge variant="outline">{alert.alert_type}</Badge>
                        {alert.is_read && <Badge className="bg-zinc-100">Read</Badge>}
                      </div>
                      <p className="text-sm">{alert.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {alert.entity_type}: {alert.entity_id} | {alert.branch || 'N/A'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(alert.created_at).toLocaleString()}
                      </p>
                    </div>
                    {!alert.is_read && (
                      <Button variant="ghost" size="sm" onClick={() => handleMarkAlertRead(alert.id)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredAlerts.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                No alerts to show
              </div>
            )}
          </div>
        </TabsContent>

        {/* Handlers Tab */}
        <TabsContent value="handlers">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(subscriptions).map(([eventType, handlers]) => (
              <Card key={eventType}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{getEventTypeBadge(eventType)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {handlers.map(h => (
                      <div key={h} className="flex items-center gap-2 text-sm">
                        <Zap className="w-3 h-3 text-yellow-500" />
                        <span className="font-mono text-xs">{h}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-sm font-mono">All Event Types ({eventTypes.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {eventTypes.map(t => (
                  <Badge key={t.value} variant="outline" className="text-xs">
                    {t.name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Events;

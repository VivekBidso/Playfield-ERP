import { useState, useEffect } from "react";
import axios from "axios";
import { 
  Database, 
  Table2, 
  Search, 
  ChevronRight,
  ChevronDown,
  FileJson,
  RefreshCw,
  Copy,
  Check,
  Filter,
  BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import useAuthStore from "@/store/authStore";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function DBExplorer() {
  const { user } = useAuthStore();
  
  // State
  const [databases, setDatabases] = useState([]);
  const [selectedDb, setSelectedDb] = useState("");
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState("");
  const [documents, setDocuments] = useState([]);
  const [totalDocs, setTotalDocs] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expandedDoc, setExpandedDoc] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  
  // Search state
  const [searchField, setSearchField] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [searchExact, setSearchExact] = useState(false);
  
  // Compare state
  const [compareField, setCompareField] = useState("rm_id");
  const [compareValue, setCompareValue] = useState("");
  const [compareResults, setCompareResults] = useState(null);
  
  // Aggregate state
  const [groupByField, setGroupByField] = useState("");
  const [aggregateResults, setAggregateResults] = useState(null);

  // Check access
  const isAdmin = user?.role?.toLowerCase()?.includes('admin') || user?.role === 'MASTER_ADMIN';

  useEffect(() => {
    if (isAdmin) {
      fetchDatabases();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (selectedDb) {
      fetchCollections(selectedDb);
      setSelectedCollection("");
      setDocuments([]);
    }
  }, [selectedDb]);

  useEffect(() => {
    if (selectedDb && selectedCollection) {
      fetchSampleDocuments();
    }
  }, [selectedDb, selectedCollection]);

  const fetchDatabases = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/db-explorer/databases`);
      setDatabases(res.data.databases);
      if (res.data.databases.length > 0 && !selectedDb) {
        setSelectedDb(res.data.databases[0].name);
      }
    } catch (error) {
      toast.error("Failed to fetch databases");
    }
    setLoading(false);
  };

  const fetchCollections = async (dbName) => {
    try {
      const res = await axios.get(`${API}/admin/db-explorer/databases/${dbName}/collections`);
      setCollections(res.data.collections);
    } catch (error) {
      toast.error("Failed to fetch collections");
    }
  };

  const fetchSampleDocuments = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${API}/admin/db-explorer/databases/${selectedDb}/collections/${selectedCollection}/sample?limit=20`
      );
      setDocuments(res.data.documents);
      setTotalDocs(res.data.total);
    } catch (error) {
      toast.error("Failed to fetch documents");
    }
    setLoading(false);
  };

  const handleSearch = async () => {
    if (!searchField || !searchValue) {
      toast.error("Enter field and value to search");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.get(
        `${API}/admin/db-explorer/databases/${selectedDb}/collections/${selectedCollection}/search`,
        { params: { field: searchField, value: searchValue, exact: searchExact, limit: 50 } }
      );
      setDocuments(res.data.documents);
      setTotalDocs(res.data.total);
      toast.success(`Found ${res.data.total} documents`);
    } catch (error) {
      toast.error("Search failed");
    }
    setLoading(false);
  };

  const handleCompare = async () => {
    if (!compareField || !compareValue) {
      toast.error("Enter field and value to compare");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.get(
        `${API}/admin/db-explorer/compare/${selectedCollection || 'raw_materials'}`,
        { params: { field: compareField, value: compareValue } }
      );
      setCompareResults(res.data);
      toast.success("Comparison complete");
    } catch (error) {
      toast.error("Compare failed");
    }
    setLoading(false);
  };

  const handleAggregate = async () => {
    if (!groupByField) {
      toast.error("Enter a field to group by");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.get(
        `${API}/admin/db-explorer/databases/${selectedDb}/collections/${selectedCollection}/aggregate`,
        { params: { group_by: groupByField, limit: 30 } }
      );
      setAggregateResults(res.data);
      toast.success("Aggregation complete");
    } catch (error) {
      toast.error("Aggregation failed");
    }
    setLoading(false);
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(JSON.stringify(text, null, 2));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Copied to clipboard");
  };

  const formatValue = (value) => {
    if (value === null || value === undefined) return <span className="text-gray-400">null</span>;
    if (typeof value === 'boolean') return <span className="text-purple-600">{value.toString()}</span>;
    if (typeof value === 'number') return <span className="text-blue-600">{value}</span>;
    if (typeof value === 'string' && value.length > 100) return value.substring(0, 100) + '...';
    if (Array.isArray(value)) return <span className="text-orange-600">[{value.length} items]</span>;
    if (typeof value === 'object') return <span className="text-green-600">{'{...}'}</span>;
    return String(value);
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center">
        <Database className="w-16 h-16 mx-auto text-gray-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-700">Access Denied</h2>
        <p className="text-gray-500">Database Explorer is only available to administrators.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="w-6 h-6" />
            Database Explorer
          </h1>
          <p className="text-muted-foreground">Browse and query MongoDB databases</p>
        </div>
        <Button variant="outline" onClick={fetchDatabases} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Database Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {databases.map((db) => (
          <Card 
            key={db.name}
            className={`cursor-pointer transition-all ${selectedDb === db.name ? 'ring-2 ring-orange-500 bg-orange-50' : 'hover:bg-gray-50'}`}
            onClick={() => setSelectedDb(db.name)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className={`w-5 h-5 ${selectedDb === db.name ? 'text-orange-500' : 'text-gray-500'}`} />
                  <span className="font-mono font-medium">{db.name}</span>
                </div>
                {selectedDb === db.name && <Check className="w-4 h-4 text-orange-500" />}
              </div>
              <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
                <span>{db.collections_count} collections</span>
                <span>{db.total_documents.toLocaleString()} docs</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content */}
      {selectedDb && (
        <div className="grid grid-cols-12 gap-6">
          {/* Collections Sidebar */}
          <div className="col-span-3">
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Table2 className="w-4 h-4" />
                  Collections ({collections.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 max-h-[500px] overflow-y-auto">
                {collections.map((coll) => (
                  <div
                    key={coll.name}
                    className={`px-3 py-2 cursor-pointer border-l-2 transition-all ${
                      selectedCollection === coll.name 
                        ? 'bg-orange-50 border-orange-500' 
                        : 'border-transparent hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedCollection(coll.name)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm truncate">{coll.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {coll.document_count.toLocaleString()}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Document Viewer */}
          <div className="col-span-9">
            {selectedCollection ? (
              <Tabs defaultValue="browse">
                <TabsList>
                  <TabsTrigger value="browse">Browse</TabsTrigger>
                  <TabsTrigger value="search">Search</TabsTrigger>
                  <TabsTrigger value="compare">Compare DBs</TabsTrigger>
                  <TabsTrigger value="aggregate">Aggregate</TabsTrigger>
                </TabsList>

                {/* Browse Tab */}
                <TabsContent value="browse" className="mt-4">
                  <Card>
                    <CardHeader className="py-3 flex-row items-center justify-between">
                      <CardTitle className="text-sm font-medium">
                        {selectedCollection} <span className="text-muted-foreground">({totalDocs.toLocaleString()} total)</span>
                      </CardTitle>
                      <Button size="sm" variant="outline" onClick={fetchSampleDocuments}>
                        <RefreshCw className="w-3 h-3 mr-1" /> Reload
                      </Button>
                    </CardHeader>
                    <CardContent className="p-0 max-h-[600px] overflow-y-auto">
                      {documents.map((doc, idx) => (
                        <div key={idx} className="border-b last:border-b-0">
                          <div 
                            className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                            onClick={() => setExpandedDoc(expandedDoc === idx ? null : idx)}
                          >
                            <div className="flex items-center gap-2">
                              {expandedDoc === idx ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              <span className="font-mono text-sm">
                                {doc.id?.substring(0, 8) || doc.rm_id || doc.name || `Document ${idx + 1}`}
                              </span>
                              {doc.rm_id && <Badge variant="outline" className="text-xs">{doc.rm_id}</Badge>}
                              {doc.category && <Badge className="text-xs">{doc.category}</Badge>}
                            </div>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={(e) => { e.stopPropagation(); copyToClipboard(doc, idx); }}
                            >
                              {copiedId === idx ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            </Button>
                          </div>
                          {expandedDoc === idx && (
                            <div className="px-4 py-2 bg-zinc-50 border-t">
                              <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                                {JSON.stringify(doc, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Search Tab */}
                <TabsContent value="search" className="mt-4 space-y-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex gap-4 items-end">
                        <div className="flex-1">
                          <Label>Field</Label>
                          <Input 
                            placeholder="e.g., rm_id, name, category"
                            value={searchField}
                            onChange={(e) => setSearchField(e.target.value)}
                          />
                        </div>
                        <div className="flex-1">
                          <Label>Value</Label>
                          <Input 
                            placeholder="Search value..."
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            id="exact" 
                            checked={searchExact}
                            onChange={(e) => setSearchExact(e.target.checked)}
                          />
                          <Label htmlFor="exact" className="text-sm">Exact</Label>
                        </div>
                        <Button onClick={handleSearch} disabled={loading}>
                          <Search className="w-4 h-4 mr-2" />
                          Search
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {documents.length > 0 && (
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm">Results ({totalDocs})</CardTitle>
                      </CardHeader>
                      <CardContent className="p-0 max-h-[400px] overflow-y-auto">
                        {documents.map((doc, idx) => (
                          <div key={idx} className="px-4 py-2 border-b last:border-b-0 hover:bg-gray-50">
                            <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                              {JSON.stringify(doc, null, 2)}
                            </pre>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* Compare Tab */}
                <TabsContent value="compare" className="mt-4 space-y-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground mb-4">
                        Compare a document across all databases to see differences
                      </p>
                      <div className="flex gap-4 items-end">
                        <div className="w-48">
                          <Label>Field</Label>
                          <Select value={compareField} onValueChange={setCompareField}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="rm_id">rm_id</SelectItem>
                              <SelectItem value="id">id</SelectItem>
                              <SelectItem value="name">name</SelectItem>
                              <SelectItem value="sku_id">sku_id</SelectItem>
                              <SelectItem value="code">code</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex-1">
                          <Label>Value</Label>
                          <Input 
                            placeholder="e.g., ACC_269"
                            value={compareValue}
                            onChange={(e) => setCompareValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCompare()}
                          />
                        </div>
                        <Button onClick={handleCompare} disabled={loading}>
                          <FileJson className="w-4 h-4 mr-2" />
                          Compare
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {compareResults && (
                    <div className="grid grid-cols-1 gap-4">
                      {compareResults.results.map((result, idx) => (
                        <Card key={idx} className={result.found ? 'border-green-200' : 'border-red-200'}>
                          <CardHeader className="py-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Database className="w-4 h-4" />
                              {result.database}
                              <Badge variant={result.found ? 'default' : 'destructive'}>
                                {result.found ? 'Found' : 'Not Found'}
                              </Badge>
                            </CardTitle>
                          </CardHeader>
                          {result.found && (
                            <CardContent className="py-2">
                              <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap bg-zinc-50 p-2 rounded">
                                {JSON.stringify(result.document, null, 2)}
                              </pre>
                            </CardContent>
                          )}
                          {!result.found && result.reason && (
                            <CardContent className="py-2 text-sm text-muted-foreground">
                              {result.reason}
                            </CardContent>
                          )}
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Aggregate Tab */}
                <TabsContent value="aggregate" className="mt-4 space-y-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex gap-4 items-end">
                        <div className="flex-1">
                          <Label>Group By Field</Label>
                          <Input 
                            placeholder="e.g., category, status, source_type"
                            value={groupByField}
                            onChange={(e) => setGroupByField(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAggregate()}
                          />
                        </div>
                        <Button onClick={handleAggregate} disabled={loading}>
                          <BarChart3 className="w-4 h-4 mr-2" />
                          Aggregate
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {aggregateResults && (
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm">
                          Grouped by: {aggregateResults.group_by}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <table className="w-full text-sm">
                          <thead className="bg-zinc-100">
                            <tr>
                              <th className="text-left px-4 py-2">Value</th>
                              <th className="text-right px-4 py-2">Count</th>
                              <th className="px-4 py-2 w-1/2">Distribution</th>
                            </tr>
                          </thead>
                          <tbody>
                            {aggregateResults.results.map((r, idx) => {
                              const maxCount = Math.max(...aggregateResults.results.map(x => x.count));
                              const pct = (r.count / maxCount) * 100;
                              return (
                                <tr key={idx} className="border-t">
                                  <td className="px-4 py-2 font-mono">{r.value || '(null)'}</td>
                                  <td className="px-4 py-2 text-right">{r.count.toLocaleString()}</td>
                                  <td className="px-4 py-2">
                                    <div className="bg-gray-200 rounded-full h-4 overflow-hidden">
                                      <div 
                                        className="bg-orange-500 h-full rounded-full"
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            ) : (
              <Card className="bg-zinc-50">
                <CardContent className="p-8 text-center text-muted-foreground">
                  <Table2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Select a collection to browse documents</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  LogOut, Search, Filter, Plus, MoreVertical, Activity, Users, Target,
  TrendingUp, X, MessageSquare, LayoutGrid, List, BarChart3, Settings2,
  GripVertical, Upload, Calendar, Archive
} from "lucide-react";
import { format } from "date-fns";
import { DataExplorerModal } from "../components/DataExplorerModal";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface Lead {
  id: number;
  name: string;
  email: string;
  source: string;
  status: "New" | "Contacted" | "Converted";
  notes: string;
  created_at: string;
}

interface Analytics {
  total: number;
  new: number;
  contacted: number;
  converted: number;
  conversionRate: string;
}

interface ChartData {
  sourceData: { name: string; value: number }[];
  timeData: { date: string; count: number }[];
  conversionData: { date: string; rate: number; converted: number; total: number }[];
}

interface ActivityLog {
  id: number;
  lead_id: number;
  action: string;
  details: string;
  created_at: string;
}

export default function Dashboard() {
  const { token, username, logout } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [chartData, setChartData] = useState<ChartData | null>(null);
  
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewLeadModalOpen, setIsNewLeadModalOpen] = useState(false);
  const [isDataExplorerOpen, setIsDataExplorerOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // View & Customization State
  const [viewMode, setViewMode] = useState<"list" | "kanban">("kanban");
  const [widgets, setWidgets] = useState({
    analytics: true,
    charts: true,
    pipeline: true
  });
  const [isWidgetMenuOpen, setIsWidgetMenuOpen] = useState(false);

  // LocalStorage Helpers
  const getLocalData = () => {
    const data = localStorage.getItem('crm_data');
    if (data) return JSON.parse(data);
    
    const defaultData = {
      leads: [
        { id: 1, name: 'Alice Smith', email: 'alice@example.com', source: 'Website Form', status: 'Penny Stocks', notes: 'Interested in premium plan.', created_at: new Date().toISOString() },
        { id: 2, name: 'Bob Johnson', email: 'bob@example.com', source: 'Referral', status: 'IPO', notes: 'Waiting for callback next week.', created_at: new Date(Date.now() - 86400000).toISOString() },
        { id: 3, name: 'Charlie Brown', email: 'charlie@example.com', source: 'Direct Outreach', status: 'Master of the Universe', notes: 'Signed contract on Monday.', created_at: new Date(Date.now() - 172800000).toISOString() }
      ],
      activities: [
        { id: 1, lead_id: 1, action: 'Created', details: 'Prospect created from Website Form', created_at: new Date().toISOString() },
        { id: 2, lead_id: 2, action: 'Created', details: 'Prospect created from Referral', created_at: new Date(Date.now() - 86400000).toISOString() },
        { id: 3, lead_id: 2, action: 'Status Changed', details: 'Status updated to IPO', created_at: new Date(Date.now() - 86400000).toISOString() },
        { id: 4, lead_id: 3, action: 'Created', details: 'Prospect created from Direct Outreach', created_at: new Date(Date.now() - 172800000).toISOString() },
        { id: 5, lead_id: 3, action: 'Status Changed', details: 'Status updated to Master of the Universe', created_at: new Date(Date.now() - 172800000).toISOString() }
      ]
    };
    localStorage.setItem('crm_data', JSON.stringify(defaultData));
    return defaultData;
  };

  const saveLocalData = (data: any) => {
    localStorage.setItem('crm_data', JSON.stringify(data));
  };

  const logActivity = (lead_id: number, action: string, details: string) => {
    const data = getLocalData();
    const newActivity = {
      id: Date.now(),
      lead_id,
      action,
      details,
      created_at: new Date().toISOString()
    };
    data.activities.push(newActivity);
    saveLocalData(data);
  };

  const fetchData = async () => {
    try {
      const data = getLocalData();
      
      // Sort leads by created_at desc
      const sortedLeads = [...data.leads].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setLeads(sortedLeads);

      // Calculate Analytics
      const total = sortedLeads.length;
      const newLeads = sortedLeads.filter(l => l.status === 'Penny Stocks').length;
      const contacted = sortedLeads.filter(l => l.status === 'IPO').length;
      const converted = sortedLeads.filter(l => l.status === 'Master of the Universe').length;
      
      setAnalytics({
        total,
        new: newLeads,
        contacted,
        converted,
        conversionRate: total > 0 ? ((converted / total) * 100).toFixed(1) : "0"
      });

      // Calculate Charts
      const sourceCount: Record<string, number> = {};
      sortedLeads.forEach(l => {
        sourceCount[l.source] = (sourceCount[l.source] || 0) + 1;
      });
      const sourceData = Object.entries(sourceCount).map(([name, value]) => ({ name, value }));

      const timeCount: Record<string, number> = {};
      sortedLeads.forEach(l => {
        const date = l.created_at.split('T')[0];
        timeCount[date] = (timeCount[date] || 0) + 1;
      });
      const timeData = Object.entries(timeCount).map(([date, count]) => ({ date, count })).slice(0, 7);

      const conversionData = timeData.map(t => {
        const leadsOnDate = sortedLeads.filter(l => l.created_at.startsWith(t.date));
        const convertedOnDate = leadsOnDate.filter(l => l.status === 'Master of the Universe').length;
        return {
          date: t.date,
          total: leadsOnDate.length,
          converted: convertedOnDate,
          rate: leadsOnDate.length > 0 ? Math.round((convertedOnDate / leadsOnDate.length) * 100) : 0
        };
      });

      setChartData({ sourceData, timeData, conversionData });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchActivities = async (leadId: number) => {
    try {
      const data = getLocalData();
      const leadActivities = data.activities
        .filter((a: any) => a.lead_id === leadId)
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setActivities(leadActivities);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLeadClick = (lead: Lead) => {
    setSelectedLead(lead);
    setIsModalOpen(true);
    fetchActivities(lead.id);
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      const data = getLocalData();
      const leadIndex = data.leads.findIndex((l: any) => l.id === id);
      if (leadIndex !== -1) {
        const oldStatus = data.leads[leadIndex].status;
        data.leads[leadIndex].status = newStatus;
        saveLocalData(data);
        
        if (oldStatus !== newStatus) {
          logActivity(id, 'Status Changed', `Status updated from ${oldStatus} to ${newStatus}`);
        }
        
        fetchData();
        if (selectedLead && selectedLead.id === id) {
          setSelectedLead({ ...selectedLead, status: newStatus as any });
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotesUpdate = async (id: number, notes: string) => {
    try {
      const data = getLocalData();
      const leadIndex = data.leads.findIndex((l: any) => l.id === id);
      if (leadIndex !== -1) {
        data.leads[leadIndex].notes = notes;
        saveLocalData(data);
        logActivity(id, 'Notes Updated', 'Prospect notes were updated');
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleScheduleFollowUp = (lead: Lead) => {
    const subject = encodeURIComponent(`Follow-up with ${lead.name}`);
    const details = encodeURIComponent(`Follow-up meeting regarding ${lead.source} inquiry.\n\nNotes:\n${lead.notes || 'No notes yet.'}`);
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${subject}&details=${details}`;
    window.open(googleCalendarUrl, '_blank');
  };

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      lead.name.toLowerCase().includes(search.toLowerCase()) ||
      lead.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      filterStatus === "All" || lead.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleExportCSV = async () => {
    try {
      const data = getLocalData();
      const csvRows = [];
      const headers = ['id', 'name', 'email', 'source', 'status', 'notes', 'created_at'];
      csvRows.push(headers.join(','));
      
      data.leads.forEach((lead: any) => {
        const values = headers.map(header => {
          const val = lead[header] || '';
          return `"${String(val).replace(/"/g, '""')}"`;
        });
        csvRows.push(values.join(','));
      });
      
      const csvString = csvRows.join('\n');
      const blob = new Blob([csvString], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'leads_report.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to export CSV', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Penny Stocks": return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
      case "IPO": return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
      case "The Commission": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "Master of the Universe": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      default: return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
    }
  };

  const getStatusIndicator = (status: string) => {
    switch (status) {
      case "Penny Stocks": return "bg-zinc-500";
      case "IPO": return "bg-cyan-500";
      case "The Commission": return "bg-amber-500";
      case "Master of the Universe": return "bg-emerald-500";
      default: return "bg-zinc-500";
    }
  };

  // Drag and Drop Handlers for Kanban (dnd-kit)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const leadId = parseInt(active.id as string);
      const newStatus = over.id as string;
      const lead = leads.find(l => l.id === leadId);
      if (lead && lead.status !== newStatus) {
        handleStatusChange(leadId, newStatus);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-emerald-500/30">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-40 bg-[#09090b]/80 backdrop-blur-xl border-b border-zinc-800/50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <TrendingUp className="w-4 h-4 text-black" />
            </div>
            <span className="text-xl font-bold font-heading tracking-tight uppercase">
              Sales Wolf CRM
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button 
                onClick={() => setIsWidgetMenuOpen(!isWidgetMenuOpen)}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800/50 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <Settings2 className="w-4 h-4" />
                <span className="hidden sm:inline">Widgets</span>
              </button>
              
              <AnimatePresence>
                {isWidgetMenuOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-2 w-48 bg-[#18181b] border border-zinc-800 rounded-xl shadow-2xl p-2 z-50"
                  >
                    <div className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Customize View</div>
                    {Object.entries(widgets).map(([key, value]) => (
                      <label key={key} className="flex items-center gap-3 px-3 py-2 hover:bg-zinc-800/50 rounded-lg cursor-pointer transition-colors">
                        <input 
                          type="checkbox" 
                          checked={value}
                          onChange={() => setWidgets(w => ({ ...w, [key]: !value }))}
                          className="rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-500/50"
                        />
                        <span className="text-sm capitalize">{key}</span>
                      </label>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="h-6 w-px bg-zinc-800" />

            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {username}
            </div>
            <button
              onClick={logout}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800/50 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        
        {/* Analytics Overview Widget */}
        {widgets.analytics && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-4 gap-4"
          >
            {[
              { label: "Total Prospects", value: analytics?.total || 0, icon: Users, color: "text-emerald-400", bg: "bg-emerald-500/10" },
              { label: "Penny Stocks", value: analytics?.new || 0, icon: Target, color: "text-blue-400", bg: "bg-blue-500/10" },
              { label: "IPO", value: analytics?.contacted || 0, icon: MessageSquare, color: "text-amber-400", bg: "bg-amber-500/10" },
              { label: "Conversion Rate", value: `${analytics?.conversionRate || 0}%`, icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10" },
            ].map((stat, i) => (
              <div key={stat.label} className="bg-[#18181b] border border-zinc-800/50 rounded-2xl p-6 relative overflow-hidden group">
                <div className={`absolute top-0 right-0 w-32 h-32 ${stat.bg} rounded-full blur-3xl -mr-16 -mt-16 transition-opacity opacity-50 group-hover:opacity-100`} />
                <div className="flex items-start justify-between relative z-10">
                  <div>
                    <p className="text-sm font-medium text-zinc-500 mb-1">{stat.label}</p>
                    <h3 className="text-3xl font-bold font-mono tracking-tight">{stat.value}</h3>
                  </div>
                  <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Charts Widget */}
        {widgets.charts && chartData && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            <div className="bg-[#18181b] border border-zinc-800/50 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                <h3 className="font-semibold text-zinc-100">Conversion Rates (Last 30 Days)</h3>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.conversionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="date" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => format(new Date(val), 'MMM d')} />
                    <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}%`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '0.75rem', color: '#f4f4f5' }}
                      cursor={{ fill: '#27272a', opacity: 0.4 }}
                      formatter={(value: number) => [`${value}%`, 'Conversion Rate']}
                    />
                    <Bar dataKey="rate" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-[#18181b] border border-zinc-800/50 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-6">
                <BarChart3 className="w-5 h-5 text-emerald-400" />
                <h3 className="font-semibold text-zinc-100">Prospects by Source</h3>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData.sourceData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {chartData.sourceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#10b981', '#34d399', '#059669', '#047857', '#064e3b'][index % 5]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '0.75rem', color: '#f4f4f5' }}
                      itemStyle={{ color: '#f4f4f5' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>
        )}

        {/* Pipeline / Data Grid Widget */}
        {widgets.pipeline && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6 bg-[#18181b] p-4 rounded-2xl border border-zinc-800/50">
              <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Search prospects..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-[#09090b] border border-zinc-800 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
                {viewMode === 'list' && (
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="pl-10 pr-8 py-2 bg-[#09090b] border border-zinc-800 rounded-xl text-sm appearance-none focus:ring-2 focus:ring-emerald-500 outline-none transition-all cursor-pointer"
                    >
                      <option value="All">All Statuses</option>
                      <option value="Penny Stocks">Penny Stocks</option>
                      <option value="IPO">IPO</option>
                      <option value="The Commission">The Commission</option>
                      <option value="Master of the Universe">Master of the Universe</option>
                    </select>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="flex items-center bg-[#09090b] border border-zinc-800 rounded-xl p-1">
                  <button 
                    onClick={() => setViewMode('kanban')}
                    className={`p-1.5 rounded-lg transition-colors ${viewMode === 'kanban' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
                <button
                  onClick={() => setIsDataExplorerOpen(true)}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-emerald-500/20"
                >
                  <Upload className="w-4 h-4" />
                  Analyze Data
                </button>
                <button
                  onClick={handleExportCSV}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  Download Report
                </button>
                <button
                  onClick={() => setIsNewLeadModalOpen(true)}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl text-sm font-bold uppercase tracking-wider transition-colors shadow-lg shadow-emerald-500/20"
                >
                  <Plus className="w-4 h-4" />
                  New Prospect
                </button>
              </div>
            </div>

            {loading ? (
              <div className="py-12 text-center text-zinc-500">
                <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-2" />
                Loading pipeline...
              </div>
            ) : viewMode === 'kanban' ? (
              /* Kanban Board View */
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {["Penny Stocks", "IPO", "The Commission", "Master of the Universe"].map((status) => (
                    <DroppableColumn 
                      key={status} 
                      status={status} 
                      leads={filteredLeads.filter(l => l.status === status)}
                      getStatusIndicator={getStatusIndicator}
                      onLeadClick={handleLeadClick}
                    />
                  ))}
                </div>
              </DndContext>
            ) : (
              /* Data Grid View */
              <div className="bg-[#18181b] border border-zinc-800/50 rounded-2xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-800/50 bg-zinc-900/50">
                        <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Prospect</th>
                        <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Source</th>
                        <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {filteredLeads.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                            No prospects found matching your criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredLeads.map((lead, i) => (
                          <motion.tr
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            key={lead.id}
                            className="hover:bg-zinc-800/30 transition-colors group cursor-pointer"
                            onClick={() => handleLeadClick(lead)}
                          >
                            <td className="px-6 py-4">
                              <div className="font-medium text-zinc-200">{lead.name}</div>
                              <div className="text-sm text-zinc-500">{lead.email}</div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                                {lead.source}
                              </span>
                            </td>
                            <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                              <select
                                value={lead.status}
                                onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                                className={`text-xs font-medium px-3 py-1.5 rounded-full border appearance-none cursor-pointer outline-none ${getStatusColor(lead.status)}`}
                              >
                                <option value="Penny Stocks" className="bg-[#18181b] text-zinc-100">Penny Stocks</option>
                                <option value="IPO" className="bg-[#18181b] text-zinc-100">IPO</option>
                                <option value="The Commission" className="bg-[#18181b] text-zinc-100">The Commission</option>
                                <option value="Master of the Universe" className="bg-[#18181b] text-zinc-100">Master of the Universe</option>
                              </select>
                            </td>
                            <td className="px-6 py-4 text-sm text-zinc-400 font-mono">
                              {format(new Date(lead.created_at), "MMM d, yyyy")}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleLeadClick(lead); }}
                                className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </td>
                          </motion.tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </main>

      {/* Lead Details Modal */}
      <AnimatePresence>
        {isModalOpen && selectedLead && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-[#18181b] border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                <div className="flex items-center gap-4">
                  <h2 className="text-lg font-semibold font-heading">Prospect Details</h2>
                  <button
                    onClick={() => handleScheduleFollowUp(selectedLead)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium transition-colors border border-emerald-500/20"
                  >
                    <Calendar className="w-4 h-4" />
                    Schedule Follow-up
                  </button>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-2 gap-6 mb-8">
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Name</p>
                    <p className="font-medium text-lg">{selectedLead.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Email</p>
                    <p className="font-medium text-lg">{selectedLead.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Source</p>
                    <p className="font-medium">{selectedLead.source}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Status</p>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(selectedLead.status)}`}>
                      {selectedLead.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Internal Notes</p>
                    <textarea
                      defaultValue={selectedLead.notes}
                      onBlur={(e) => handleNotesUpdate(selectedLead.id, e.target.value)}
                      className="w-full h-48 p-4 bg-[#09090b] border border-zinc-800 rounded-xl text-sm text-zinc-300 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none resize-none transition-all"
                      placeholder="Add follow-up notes here... (Saves automatically on blur)"
                    />
                  </div>
                  
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Activity Timeline</p>
                    <div className="bg-[#09090b] border border-zinc-800 rounded-xl p-4 h-48 overflow-y-auto custom-scrollbar">
                      {activities.length === 0 ? (
                        <p className="text-sm text-zinc-500 text-center py-4">No activities logged yet.</p>
                      ) : (
                        <div className="space-y-4">
                          {activities.map((activity, idx) => (
                            <div key={activity.id} className="relative pl-4 border-l border-zinc-800 last:border-transparent">
                              <div className="absolute -left-1.5 top-1.5 w-3 h-3 bg-zinc-800 border-2 border-[#18181b] rounded-full" />
                              <div className="mb-1">
                                <span className="text-sm font-medium text-zinc-200">{activity.action}</span>
                                <span className="text-xs text-zinc-500 ml-2 font-mono">
                                  {format(new Date(activity.created_at), "MMM d, h:mm a")}
                                </span>
                              </div>
                              {activity.details && (
                                <p className="text-xs text-zinc-400">{activity.details}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Prospect Modal */}
      <AnimatePresence>
        {isNewLeadModalOpen && (
          <NewProspectModal
            onClose={() => setIsNewLeadModalOpen(false)}
            onSuccess={() => {
              setIsNewLeadModalOpen(false);
              fetchData();
            }}
            token={token!}
          />
        )}
      </AnimatePresence>

      {/* Data Explorer Modal */}
      <DataExplorerModal 
        isOpen={isDataExplorerOpen} 
        onClose={() => setIsDataExplorerOpen(false)} 
      />
    </div>
  );
}

function DroppableColumn({ status, leads, getStatusIndicator, onLeadClick }: { status: string, leads: Lead[], getStatusIndicator: (s: string) => string, onLeadClick: (l: Lead) => void }) {
  const { isOver, setNodeRef } = useDroppable({
    id: status,
  });

  return (
    <div 
      ref={setNodeRef}
      className={`bg-[#18181b] border ${isOver ? 'border-emerald-500' : 'border-zinc-800/50'} rounded-2xl p-4 flex flex-col h-[600px] transition-colors`}
    >
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${getStatusIndicator(status)}`} />
          <h3 className="font-semibold text-zinc-100">{status}</h3>
        </div>
        <span className="bg-zinc-800 text-zinc-400 text-xs font-medium px-2 py-1 rounded-full">
          {leads.length}
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
        {leads.map((lead) => (
          <DraggableCard key={lead.id} lead={lead} onClick={() => onLeadClick(lead)} />
        ))}
      </div>
    </div>
  );
}

function DraggableCard({ lead, onClick }: { lead: Lead, onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id.toString(),
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 1,
  };

  return (
    <motion.div
      layoutId={`card-${lead.id}`}
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="bg-[#09090b] border border-zinc-800 hover:border-zinc-700 rounded-xl p-4 cursor-grab active:cursor-grabbing transition-colors group relative"
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className="font-medium text-zinc-200 group-hover:text-emerald-400 transition-colors">{lead.name}</h4>
          <p className="text-xs text-zinc-500 truncate w-40">{lead.email}</p>
        </div>
        <button 
          onPointerDown={(e) => e.stopPropagation()} 
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
      <div className="flex items-center justify-between mt-4">
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-zinc-800 text-zinc-400">
          {lead.source}
        </span>
        <span className="text-[10px] text-zinc-500 font-mono">
          {format(new Date(lead.created_at), "MMM d")}
        </span>
      </div>
    </motion.div>
  );
}

function NewProspectModal({
  onClose,
  onSuccess,
  token,
}: {
  onClose: () => void;
  onSuccess: () => void;
  token: string;
}) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    source: "Website Form",
    status: "Penny Stocks",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState("");

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError("");

    if (!validateEmail(formData.email)) {
      setEmailError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      // LocalStorage Create
      const dataStr = localStorage.getItem('crm_data');
      if (dataStr) {
        const data = JSON.parse(dataStr);
        const newLeadId = Date.now();
        const newLead = {
          id: newLeadId,
          ...formData,
          created_at: new Date().toISOString()
        };
        data.leads.push(newLead);
        
        const newActivity = {
          id: Date.now() + 1,
          lead_id: newLeadId,
          action: 'Created',
          details: `Prospect created from ${formData.source}`,
          created_at: new Date().toISOString()
        };
        data.activities.push(newActivity);
        
        localStorage.setItem('crm_data', JSON.stringify(data));
        onSuccess();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md bg-[#18181b] border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <h2 className="text-lg font-semibold font-heading">Add New Prospect</h2>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1">
              Name
            </label>
            <input
              required
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full px-4 py-2 bg-[#09090b] border border-zinc-800 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1">
              Email
            </label>
            <input
              required
              type="email"
              value={formData.email}
              onChange={(e) => {
                setFormData({ ...formData, email: e.target.value });
                if (emailError) setEmailError("");
              }}
              className={`w-full px-4 py-2 bg-[#09090b] border ${emailError ? 'border-red-500/50 focus:ring-red-500' : 'border-zinc-800 focus:ring-emerald-500'} rounded-xl text-sm focus:ring-2 outline-none`}
            />
            {emailError && (
              <p className="text-red-400 text-xs mt-1">{emailError}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1">
              Source
            </label>
            <select
              value={formData.source}
              onChange={(e) =>
                setFormData({ ...formData, source: e.target.value })
              }
              className="w-full px-4 py-2 bg-[#09090b] border border-zinc-800 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none appearance-none"
            >
              <option value="Website Form">Website Form</option>
              <option value="Referral">Referral</option>
              <option value="Direct Outreach">Direct Outreach</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Prospect"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

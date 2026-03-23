import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, FileSpreadsheet, BarChart3, PieChart as PieChartIcon, LineChart as LineChartIcon, Settings2, AlertCircle } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#06b6d4', '#ec4899', '#84cc16'];

export function DataExplorerModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [data, setData] = useState<any[] | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [numericColumns, setNumericColumns] = useState<string[]>([]);
  const [categoricalColumns, setCategoricalColumns] = useState<string[]>([]);

  const [xAxis, setXAxis] = useState<string>('');
  const [yAxis, setYAxis] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string>('');

  const analyzeGenericFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        const bytes = new Uint8Array(buffer);
        
        // Check if it looks like text
        let isText = true;
        for (let i = 0; i < Math.min(bytes.length, 1000); i++) {
           if (bytes[i] === 0) { isText = false; break; }
        }

        if (isText && bytes.length > 0) {
           const text = new TextDecoder().decode(bytes);
           const charFreq: Record<string, number> = {};
           for (const char of text) {
              if (char.trim() === '') continue;
              charFreq[char] = (charFreq[char] || 0) + 1;
           }
           const data = Object.entries(charFreq).map(([char, count]) => ({
              Character: char,
              Frequency: count
           }));
           if (data.length === 0) throw new Error("Empty text");
           processParsedData(data);
        } else {
           // Byte frequency analysis for binary files
           const freq: Record<string, number> = {};
           for (const byte of bytes) {
              const hex = '0x' + byte.toString(16).padStart(2, '0').toUpperCase();
              freq[hex] = (freq[hex] || 0) + 1;
           }
           const data = Object.entries(freq).map(([byte, count]) => ({
              Byte: byte,
              Frequency: count
           }));
           if (data.length === 0) throw new Error("Empty file");
           processParsedData(data);
        }
      } catch (err) {
        setError("Could not analyze this file type.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError('');

    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'json') {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          if (Array.isArray(json)) {
            processParsedData(json);
          } else if (typeof json === 'object' && json !== null) {
            processParsedData([json]);
          } else {
            setError("JSON must be an object or array of objects.");
          }
        } catch (err) {
          setError("Invalid JSON file.");
        }
      };
      reader.readAsText(file);
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json(worksheet);
          processParsedData(json as any[]);
        } catch (err) {
          setError("Error parsing Excel file.");
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (ext === 'csv' || ext === 'tsv' || ext === 'txt') {
      Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0 && results.data.length === 0) {
            analyzeGenericFile(file);
          } else {
            processParsedData(results.data);
          }
        },
        error: () => {
          analyzeGenericFile(file);
        }
      });
    } else {
      analyzeGenericFile(file);
    }
  };

  const processParsedData = (parsedData: any[]) => {
    if (!parsedData || parsedData.length === 0) {
      setError("File is empty or invalid.");
      return;
    }
    setData(parsedData);

    const cols = Object.keys(parsedData[0]);
    setColumns(cols);

    const numCols = cols.filter(c => typeof parsedData[0][c] === 'number');
    const catCols = cols.filter(c => typeof parsedData[0][c] === 'string' || typeof parsedData[0][c] === 'boolean');

    setNumericColumns(numCols);
    setCategoricalColumns(catCols);

    if (catCols.length > 0) setXAxis(catCols[0]);
    else setXAxis(cols[0]);

    if (numCols.length > 0) setYAxis(numCols[0]);
    else setYAxis(cols[1] || cols[0]);
  };

  const resetData = () => {
    setData(null);
    setFileName('');
    setXAxis('');
    setYAxis('');
    setError('');
  };

  // Aggregated data for Pie Chart
  const pieData = useMemo(() => {
    if (!data || !xAxis || !yAxis) return [];
    const grouped = data.reduce((acc, row) => {
      const key = String(row[xAxis] || 'Unknown');
      const val = Number(row[yAxis]) || 0;
      acc[key] = (acc[key] || 0) + val;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Top 10 for pie chart
  }, [data, xAxis, yAxis]);

  // Sliced data for Bar and Line charts to prevent performance issues
  const chartData = useMemo(() => {
    if (!data) return [];
    return data.slice(0, 100); // Limit to 100 rows for detailed charts
  }, [data]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-6xl h-[90vh] bg-[#111111] border border-emerald-500/20 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          >
          {/* Header */}
          <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <FileSpreadsheet className="w-5 h-5 text-black" />
              </div>
              <div>
                <h2 className="text-xl font-bold font-heading uppercase tracking-tight text-white">Data Explorer</h2>
                <p className="text-xs text-emerald-400 font-mono">Upload & Analyze Custom Datasets</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {!data ? (
              <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-2xl bg-zinc-900/20 hover:bg-zinc-900/40 transition-colors">
                <Upload className="w-16 h-16 text-zinc-600 mb-4" />
                <h3 className="text-xl font-semibold text-zinc-200 mb-2">Upload your data</h3>
                <p className="text-zinc-500 mb-6 text-center max-w-md">
                  Upload any file (CSV, Excel, JSON, Text, Images, PDFs). Data files will be visualized, and other files will undergo deep byte/character frequency analysis.
                </p>
                <label className="cursor-pointer px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl font-bold uppercase tracking-wider transition-colors shadow-lg shadow-emerald-500/20">
                  Select File
                  <input type="file" className="hidden" onChange={handleFileUpload} />
                </label>
                {error && (
                  <div className="mt-6 flex items-center gap-2 text-red-400 bg-red-500/10 px-4 py-2 rounded-lg border border-red-500/20">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm">{error}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-8">
                {/* Controls */}
                <div className="bg-[#18181b] border border-zinc-800/50 rounded-2xl p-6 flex flex-col md:flex-row gap-6 items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                      <Settings2 className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-1">Current File</h4>
                      <p className="text-lg font-semibold text-zinc-200">{fileName}</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">X-Axis (Category)</label>
                      <select
                        value={xAxis}
                        onChange={(e) => setXAxis(e.target.value)}
                        className="w-48 px-3 py-2 bg-[#09090b] border border-zinc-800 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none text-zinc-200"
                      >
                        {columns.map(col => <option key={col} value={col}>{col}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">Y-Axis (Value)</label>
                      <select
                        value={yAxis}
                        onChange={(e) => setYAxis(e.target.value)}
                        className="w-48 px-3 py-2 bg-[#09090b] border border-zinc-800 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none text-zinc-200"
                      >
                        {columns.map(col => <option key={col} value={col}>{col}</option>)}
                      </select>
                    </div>
                    <button
                      onClick={resetData}
                      className="mt-5 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-medium transition-colors"
                    >
                      Upload New
                    </button>
                  </div>
                </div>

                {/* Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Bar Chart */}
                  <div className="bg-[#18181b] border border-zinc-800/50 rounded-2xl p-6 shadow-2xl">
                    <div className="flex items-center gap-2 mb-6">
                      <BarChart3 className="w-5 h-5 text-emerald-400" />
                      <h3 className="text-lg font-semibold font-heading">Bar Graph Details</h3>
                    </div>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                          <XAxis dataKey={xAxis} stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '0.75rem', color: '#f4f4f5' }}
                            cursor={{ fill: '#27272a', opacity: 0.4 }}
                          />
                          <Legend />
                          <Bar dataKey={yAxis} fill="#10b981" radius={[4, 4, 0, 0]} name={yAxis} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Line Chart */}
                  <div className="bg-[#18181b] border border-zinc-800/50 rounded-2xl p-6 shadow-2xl">
                    <div className="flex items-center gap-2 mb-6">
                      <LineChartIcon className="w-5 h-5 text-blue-400" />
                      <h3 className="text-lg font-semibold font-heading">Line Graph Trends</h3>
                    </div>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                          <XAxis dataKey={xAxis} stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '0.75rem', color: '#f4f4f5' }}
                          />
                          <Legend />
                          <Line type="monotone" dataKey={yAxis} stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', strokeWidth: 2 }} activeDot={{ r: 8 }} name={yAxis} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Pie Chart */}
                  <div className="bg-[#18181b] border border-zinc-800/50 rounded-2xl p-6 shadow-2xl lg:col-span-2">
                    <div className="flex items-center gap-2 mb-6">
                      <PieChartIcon className="w-5 h-5 text-purple-400" />
                      <h3 className="text-lg font-semibold font-heading">Pie Chart Distribution (Top 10)</h3>
                    </div>
                    <div className="h-96 flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={80}
                            outerRadius={140}
                            paddingAngle={5}
                            dataKey="value"
                            nameKey="name"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '0.75rem', color: '#f4f4f5' }}
                            itemStyle={{ color: '#f4f4f5' }}
                          />
                          <Legend verticalAlign="bottom" height={36} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
      )}
    </AnimatePresence>
  );
}

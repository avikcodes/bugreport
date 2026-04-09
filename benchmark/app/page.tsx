"use client";

import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

export default function BenchMarkPage() {
  const [file, setFile] = useState<File | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [targetColumn, setTargetColumn] = useState<string>("");
  const [taskType, setTaskType] = useState<"classification" | "regression">("classification");
  
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStep, setProgressStep] = useState("");
  
  const [results, setResults] = useState<any>(null);
  const [bestModel, setBestModel] = useState<string | null>(null);
  const [featureImportance, setFeatureImportance] = useState<any[]>([]);
  const [aiReport, setAiReport] = useState<string | null>(null);
  
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    fetchHistory();
    
    try {
      const saved = localStorage.getItem("benchmark_last_result");
      if (saved) {
        const parsed = JSON.parse(saved);
        setResults(parsed.results || null);
        setBestModel(parsed.best_model || null);
        setFeatureImportance(parsed.feature_importance || []);
        setAiReport(parsed.ai_report || null);
      }
    } catch (e) {
      console.error("Local storage parse error", e);
    }
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch("http://localhost:8000/history");
      if (res.ok) {
        const data = await res.json();
        setHistory(data || []);
      }
    } catch (e) {
      console.error("Failed to fetch history", e);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && droppedFile.name.endsWith('.csv')) {
      processFile(droppedFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const processFile = (file: File) => {
    setFile(file);
    const reader = new FileReader();
    const chunk = file.slice(0, 1024 * 16);
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const firstLine = text.split("\n")[0];
        if (firstLine) {
          const cols = firstLine.split(",").map(c => c.trim().replace(/^['"](.*)['"]$/, '$1'));
          setColumns(cols);
          if (cols.length > 0) setTargetColumn(cols[cols.length - 1]);
        }
      }
    };
    reader.readAsText(chunk);
  };

  const runBenchmark = () => {
    if (!file || !targetColumn) return;
    
    setError(null);
    setLoading(true);
    setProgress(0);
    setProgressStep("Initializing...");
    
    setResults(null);
    setBestModel(null);
    setFeatureImportance([]);
    setAiReport(null);

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1];
      
      const ws = new WebSocket('ws://localhost:8000/ws/benchmark');
      
      ws.onopen = () => {
        ws.send(JSON.stringify({
          filename: file.name,
          data: base64Data,
          target_column: targetColumn,
          task_type: taskType
        }));
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.error) {
            setError(data.error);
            setLoading(false);
            ws.close();
            return;
          }
          
          if (data.step) {
            setProgressStep(data.step);
            if (data.progress !== undefined) setProgress(data.progress);
          }
          
          if (data.progress === 100 && data.results) {
            setResults(data.results);
            setBestModel(data.best_model);
            setFeatureImportance(data.feature_importance || []);
            setAiReport(data.ai_report || null);
            setLoading(false);
            
            const saveData = {
              results: data.results,
              best_model: data.best_model,
              feature_importance: data.feature_importance,
              ai_report: data.ai_report
            };
            localStorage.setItem("benchmark_last_result", JSON.stringify(saveData));
            
            fetchHistory();
            ws.close();
          }
        } catch (e) {
          console.error("Parse WS msg error", e);
        }
      };
      
      ws.onerror = () => {
        setError("Connection error with the server. Is the backend running?");
        setLoading(false);
      };
    };
    reader.readAsDataURL(file);
  };

  const scoresData = results ? Object.entries(results).map(([name, m]: any) => ({
    name, score: m.score
  })).sort((a, b) => b.score - a.score) : [];

  const timeData = results ? Object.entries(results).map(([name, m]: any) => ({
    name, time: m.training_time
  })).sort((a, b) => a.time - b.time) : [];

  const memoryData = results ? Object.entries(results).map(([name, m]: any) => ({
    name, memory: m.memory_used
  })).sort((a, b) => a.memory - b.memory) : [];

  return (
    <div className="flex h-screen overflow-hidden bg-[#030712] text-white font-sans selection:bg-purple-500/30">
      {/* 5. HISTORY SIDEBAR */}
      <div className="w-80 bg-[#0a0f1c] border-r border-gray-800/80 flex-col hidden lg:flex">
        <div className="p-6 border-b border-gray-800/80">
          <h2 className="text-xl font-bold tracking-tight text-white/90">History</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {history.length === 0 ? (
            <p className="text-gray-500 text-sm p-4 text-center mt-4 border border-dashed border-gray-800 rounded-xl bg-gray-900/30">No past benchmarks yet</p>
          ) : (
            history.map((h, i) => (
              <div key={i} className="bg-gray-900/60 p-4 rounded-xl border border-gray-800/60 hover:border-purple-500/30 transition-all shadow-sm group">
                <p className="font-semibold text-white/90 mb-1 truncate group-hover:text-purple-300" title={h.file_name}>{h.file_name}</p>
                <p className="text-purple-400 text-sm flex items-center gap-1.5"><span className="text-lg">🏆</span> {h.best_model}</p>
                <p className="text-gray-600 text-xs mt-3 flex items-center justify-between">
                  <span>{new Date(h.created_at).toLocaleDateString()}</span>
                  <span>{new Date(h.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative">
        <div className="max-w-6xl mx-auto w-full p-6 sm:p-10 pb-24">
          
          {/* 1. HEADER */}
          <div className="mb-12 text-center lg:text-left mt-4">
            <span className="inline-block px-3 py-1 rounded-full bg-[#8b5cf6]/10 border border-[#8b5cf6]/20 text-xs font-semibold tracking-wide text-[#8b5cf6] mb-5">
              Open Source • Free Forever
            </span>
            <h1 className="text-5xl md:text-6xl font-extrabold text-white mb-4 tracking-tighter">BenchMark</h1>
            <h2 className="text-xl md:text-2xl text-gray-300 font-medium mb-3">Upload any dataset. Find the best ML model instantly.</h2>
            <p className="text-base text-gray-500 max-w-2xl lg:mx-0 mx-auto">Trains 5 models simultaneously and compares accuracy, speed, and memory.</p>
          </div>

          {/* 2. UPLOAD + CONFIG SECTION */}
          <div className="bg-[#0a0f1c] border border-gray-800/80 p-8 md:p-10 rounded-[24px] shadow-2xl mb-12 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#8b5cf6] to-transparent opacity-20"></div>
            
            <div 
              className="border-[2px] border-dashed border-gray-700/80 hover:border-[#8b5cf6]/50 hover:bg-[#8b5cf6]/5 transition-all duration-300 rounded-2xl p-12 text-center cursor-pointer bg-gray-950/30 group"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => document.getElementById('fileUpload')?.click()}
            >
              <input 
                type="file" 
                id="fileUpload" 
                className="hidden" 
                accept=".csv"
                onChange={handleFileChange}
              />
              <div className="h-20 w-20 bg-gray-900 group-hover:bg-[#8b5cf6]/10 transition-colors text-gray-400 group-hover:text-[#8b5cf6] rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner border border-gray-800">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
              </div>
              {file ? (
                <div className="animate-in fade-in zoom-in-95 duration-300">
                  <p className="text-xl font-semibold text-white mb-2">{file.name}</p>
                  <p className="text-sm font-medium text-gray-500 bg-gray-900 border border-gray-800 inline-block px-3 py-1 rounded-full">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div>
                  <p className="text-xl font-medium text-white mb-2">Drag and drop your dataset here</p>
                  <p className="text-sm text-gray-500">or click to browse (.csv only)</p>
                </div>
              )}
            </div>

            {file && (
              <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-3 ml-1">Target Column</label>
                  <div className="relative">
                    <select 
                      className="w-full bg-gray-950/80 border border-gray-700/80 text-white text-base rounded-xl focus:ring-2 focus:ring-[#8b5cf6]/50 focus:border-[#8b5cf6] block p-4 pr-10 appearance-none shadow-sm transition-all outline-none"
                      value={targetColumn}
                      onChange={(e) => setTargetColumn(e.target.value)}
                    >
                      <option value="" disabled>Select target...</option>
                      {columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd"></path></svg>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-3 ml-1">Task Type</label>
                  <div className="flex bg-gray-950/80 border border-gray-700/80 rounded-xl p-1.5 shadow-sm">
                    <button 
                      className={`flex-1 py-3 text-sm font-semibold rounded-lg transition-all duration-200 ${taskType === 'classification' ? 'bg-[#8b5cf6] text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                      onClick={() => setTaskType('classification')}
                    >
                      Classification
                    </button>
                    <button 
                      className={`flex-1 py-3 text-sm font-semibold rounded-lg transition-all duration-200 ${taskType === 'regression' ? 'bg-[#8b5cf6] text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                      onClick={() => setTaskType('regression')}
                    >
                      Regression
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-10 flex justify-end">
              <button 
                className="bg-[#8b5cf6] hover:bg-[#7c3aed] disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed disabled:shadow-none text-white font-bold py-4 px-10 rounded-xl shadow-[0_4px_14px_0_rgba(139,92,246,0.39)] hover:shadow-[0_6px_20px_rgba(139,92,246,0.23)] hover:-translate-y-0.5 transition-all outline-none"
                disabled={!file || !targetColumn || loading}
                onClick={runBenchmark}
              >
                {loading ? "Running..." : "Run Benchmark"}
              </button>
            </div>
            
            {error && (
              <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm flex items-center gap-3">
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"></path></svg>
                {error}
              </div>
            )}
          </div>

          {/* 3. PROGRESS SECTION */}
          {loading && (
            <div className="bg-[#0a0f1c] border border-gray-800 p-8 rounded-2xl shadow-xl mb-12 overflow-hidden relative animate-in fade-in zoom-in-95">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#8b5cf6]/5 to-transparent animate-[pulse_2s_ease-in-out_infinite]"></div>
              <div className="relative z-10 w-full bg-gray-900 rounded-full h-4 mb-5 overflow-hidden border border-gray-800">
                <div 
                  className="bg-gradient-to-r from-purple-600 to-[#8b5cf6] h-full rounded-full transition-all duration-300 ease-out shadow-[0_0_15px_rgba(139,92,246,0.6)] relative overflow-hidden" 
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute top-0 bottom-0 left-0 right-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%,transparent_100%)] bg-[length:1rem_1rem] animate-[progress_1s_linear_infinite]"></div>
                </div>
              </div>
              <div className="flex justify-between text-sm font-medium">
                <p className="text-gray-300 relative z-10 animate-pulse">{progressStep}</p>
                <p className="text-[#8b5cf6] relative z-10">{progress}%</p>
              </div>
            </div>
          )}

          {/* 4. RESULTS DASHBOARD */}
          {results && !loading && (
            <div className="space-y-8 animate-in slide-in-from-bottom-8 fade-in duration-700">
              
              {/* SECTION A - Best Model */}
              <div className="bg-gradient-to-br from-purple-900/80 to-[#8b5cf6]/30 p-10 rounded-[28px] border border-purple-500/40 shadow-[0_0_50px_rgba(139,92,246,0.15)] flex flex-col items-center justify-center text-center relative overflow-hidden group">
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-colors"></div>
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl group-hover:bg-purple-500/30 transition-colors"></div>
                <div className="text-6xl mb-6 relative z-10 drop-shadow-md">🏆</div>
                <p className="text-purple-200 font-bold tracking-widest uppercase text-xs mb-3 relative z-10">Top Performing Algorithm</p>
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight relative z-10">{bestModel}</h2>
              </div>

              {/* SECTION F - AI Recommendation */}
              {aiReport && (
                <div className="bg-[#0a0f1c] border border-gray-800 border-l-4 border-l-[#8b5cf6] p-8 rounded-2xl shadow-xl relative overflow-hidden">
                   <div className="absolute -right-10 -top-10 w-60 h-60 bg-[#8b5cf6]/5 rounded-full blur-3xl"></div>
                   <div className="flex items-center gap-3 mb-4 relative z-10">
                     <span className="text-2xl">✨</span>
                     <h3 className="text-xl font-bold text-white tracking-tight">AI Recommendation</h3>
                   </div>
                   <p className="text-gray-300 leading-relaxed text-base md:text-lg max-w-5xl relative z-10">{aiReport}</p>
                </div>
              )}

              {/* SECTION B - Model Scores */}
              <div className="bg-[#0a0f1c] border border-gray-800/80 p-8 rounded-2xl shadow-xl">
                 <h3 className="text-xl font-bold mb-8 text-white tracking-tight flex items-center gap-2">
                   <div className="w-3 h-3 rounded-full bg-[#8b5cf6]"></div>
                   Model Accuracy Comparison
                 </h3>
                 <div className="h-[320px] w-full">
                   <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={scoresData} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                        <XAxis type="number" stroke="#6b7280" tick={{ fill: '#9ca3af' }} domain={[0, 'dataMax']} />
                        <YAxis type="category" dataKey="name" stroke="#6b7280" tick={{ fill: '#d1d5db', fontSize: 13 }} width={150} axisLine={false} tickLine={false} />
                        <Tooltip 
                          cursor={{ fill: '#1f2937', opacity: 0.3 }}
                          contentStyle={{ backgroundColor: '#030712', border: '1px solid #1f2937', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
                          itemStyle={{ color: '#fff', fontWeight: 600 }}
                        />
                        <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={32}>
                          {scoresData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.name === bestModel ? '#8b5cf6' : '#581c87'} />
                          ))}
                        </Bar>
                      </BarChart>
                   </ResponsiveContainer>
                 </div>
              </div>

              {/* SECTION C & D */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-[#0a0f1c] border border-gray-800/80 p-8 rounded-2xl shadow-xl">
                   <h3 className="text-xl font-bold mb-8 text-white tracking-tight flex items-center gap-2">
                     <div className="w-3 h-3 rounded-full bg-[#f97316]"></div>
                     Training Time (ms)
                   </h3>
                   <div className="h-[280px] w-full">
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={timeData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                          <XAxis dataKey="name" stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
                          <YAxis stroke="#6b7280" tick={{ fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                          <Tooltip 
                            cursor={{ fill: '#1f2937', opacity: 0.3 }}
                            contentStyle={{ backgroundColor: '#030712', border: '1px solid #1f2937', borderRadius: '12px', color: '#fff' }}
                            itemStyle={{ color: '#f97316', fontWeight: 600 }}
                          />
                          <Bar dataKey="time" fill="#f97316" radius={[6, 6, 0, 0]} maxBarSize={40} />
                        </BarChart>
                     </ResponsiveContainer>
                   </div>
                </div>
                
                <div className="bg-[#0a0f1c] border border-gray-800/80 p-8 rounded-2xl shadow-xl">
                   <h3 className="text-xl font-bold mb-8 text-white tracking-tight flex items-center gap-2">
                     <div className="w-3 h-3 rounded-full bg-[#3b82f6]"></div>
                     Memory Usage (MB)
                   </h3>
                   <div className="h-[280px] w-full">
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={memoryData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                          <XAxis dataKey="name" stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
                          <YAxis stroke="#6b7280" tick={{ fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                          <Tooltip 
                            cursor={{ fill: '#1f2937', opacity: 0.3 }}
                            contentStyle={{ backgroundColor: '#030712', border: '1px solid #1f2937', borderRadius: '12px', color: '#fff' }}
                            itemStyle={{ color: '#3b82f6', fontWeight: 600 }}
                          />
                          <Bar dataKey="memory" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={40} />
                        </BarChart>
                     </ResponsiveContainer>
                   </div>
                </div>
              </div>

              {/* SECTION E - Feature Importance */}
              {featureImportance && featureImportance.length > 0 && (
                <div className="bg-[#0a0f1c] border border-gray-800/80 p-8 rounded-2xl shadow-xl">
                   <h3 className="text-xl font-bold mb-8 text-white tracking-tight flex items-center gap-2">
                     <div className="w-3 h-3 rounded-full bg-[#10b981]"></div>
                     Feature Importance (Top 10)
                   </h3>
                   <div className="h-[450px] w-full">
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[...featureImportance].reverse()} layout="vertical" margin={{ top: 0, right: 20, left: 60, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                          <XAxis type="number" stroke="#6b7280" tick={{ fill: '#9ca3af' }} />
                          <YAxis type="category" dataKey="feature" stroke="#6b7280" tick={{ fill: '#d1d5db', fontSize: 13 }} width={140} axisLine={false} tickLine={false} />
                          <Tooltip 
                            cursor={{ fill: '#1f2937', opacity: 0.3 }}
                            contentStyle={{ backgroundColor: '#030712', border: '1px solid #1f2937', borderRadius: '12px', color: '#fff' }}
                            itemStyle={{ color: '#10b981', fontWeight: 600 }}
                          />
                          <Bar dataKey="importance" fill="#10b981" radius={[0, 6, 6, 0]} barSize={28} />
                        </BarChart>
                     </ResponsiveContainer>
                   </div>
                </div>
              )}

            </div>
          )}
          
          {/* 6. FOOTER */}
          <footer className="mt-24 pt-10 border-t border-gray-800/50 text-center text-gray-500 text-sm font-medium pb-8">
            <p>Built by @avikcodes • Project 6 of 30</p>
          </footer>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1f2937;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #374151;
        }
        @keyframes progress {
          from { background-position: 1rem 0; }
          to { background-position: 0 0; }
        }
      `}} />
    </div>
  );
}

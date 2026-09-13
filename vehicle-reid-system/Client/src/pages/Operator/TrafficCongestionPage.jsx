import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import { 
  AlertTriangle, 
  Car, 
  Clock, 
  Video, 
  CheckCircle2, 
  Activity, 
  Flame, 
  RotateCcw,
  Upload,
  Play,
  Loader2,
  CheckCircle
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid 
} from 'recharts';

const BACKEND_URL = 'http://localhost:5000';
const ML_SERVICE_URL = 'http://127.0.0.1:8001';

export default function TrafficCongestionPage() {
  const [alerts, setAlerts] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'RESOLVED'

  // Video ingestion state
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedCamera, setSelectedCamera] = useState('CAM_01');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState(null);

  // Fetch initial logs from MongoDB and initialize Socket.io
  useEffect(() => {
    fetchAlerts();

    const socket = io(BACKEND_URL);

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Real-time listener for alerts emitted by Node.js
    socket.on('congestion_alert', (newAlert) => {
      setAlerts((prev) => [newAlert, ...prev]);
      appendChartPoint(newAlert);
    });

    return () => socket.disconnect();
  }, []);

  const fetchAlerts = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/congestion/active`);
      if (res.data.status === 'success') {
        const data = res.data.data;
        setAlerts(data);
        buildChartData(data);
      }
    } catch (err) {
      console.error('Failed to fetch congestion history:', err);
    }
  };

  const buildChartData = (data) => {
    const formatted = [...data].reverse().slice(-12).map((item) => ({
      time: new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      vehicles: item.vehicleCount,
      stoppedRatio: Math.round(item.stationaryRatio * 100)
    }));
    setChartData(formatted);
  };

  const appendChartPoint = (item) => {
    setChartData((prev) => [
      ...prev.slice(-11),
      {
        time: new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        vehicles: item.vehicleCount,
        stoppedRatio: Math.round(item.stationaryRatio * 100)
      }
    ]);
  };

  // Video analysis trigger directly from UI
  const handleProcessVideo = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      alert('Please choose a traffic surveillance video file first.');
      return;
    }

    const formData = new FormData();
    formData.append('video', selectedFile);
    formData.append('camera_id', selectedCamera);

    setIsProcessing(true);
    setProcessingStatus('Analyzing video stream via YOLOv8 & ByteTrack...');

    try {
      const res = await axios.post(`${ML_SERVICE_URL}/detect-congestion`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.status === 'success') {
        const eventsCount = res.data.result.congestion_events_triggered.length;
        setProcessingStatus(
          `Analysis complete: ${res.data.result.processed_frames} frames processed (${eventsCount} alert${eventsCount === 1 ? '' : 's'} dispatched).`
        );
        fetchAlerts();
      }
    } catch (err) {
      console.error('Processing error:', err);
      setProcessingStatus('Analysis failed. Verify FastAPI ML service is running on port 8001.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Mark alert as resolved
  const handleResolveAlert = async (id) => {
    try {
      await axios.patch(`${BACKEND_URL}/api/congestion/resolve/${id}`);
      setAlerts((prev) =>
        prev.map((item) => (item._id === id ? { ...item, resolved: true } : item))
      );
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    }
  };

  const activeAlertsCount = alerts.filter((a) => !a.resolved).length;
  const maxDensity = alerts.length > 0 ? Math.max(...alerts.map((a) => a.vehicleCount)) : 0;
  const filteredAlerts = alerts.filter((item) => {
    if (filter === 'ACTIVE') return !item.resolved;
    if (filter === 'RESOLVED') return item.resolved;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900">Traffic & Congestion Management</h1>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold ${
                isConnected ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              {isConnected ? 'Socket.io Connected' : 'Disconnected'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time gridlock detection, bottleneck duration timers, and automated traffic incident feeds.
          </p>
        </div>

        <button
          onClick={fetchAlerts}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Refresh Data
        </button>
      </div>

      {/* Surveillance Feed Ingestion / Live Analysis Bar */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Surveillance Stream Ingestion</h2>
            <p className="text-xs text-slate-500">Run computer vision inference pipeline on CCTV footage</p>
          </div>
          <Upload className="w-4 h-4 text-slate-400" />
        </div>

        <form onSubmit={handleProcessVideo} className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <select
            value={selectedCamera}
            onChange={(e) => setSelectedCamera(e.target.value)}
            className="text-xs border border-slate-300 rounded-xl px-3 py-2.5 bg-slate-50 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="CAM_01">Junction 1 - Main Boulevard (CAM_01)</option>
            <option value="CAM_02">Junction 2 - Expressway Flyover (CAM_02)</option>
            <option value="CAM_03">Junction 3 - Downtown Underpass (CAM_03)</option>
          </select>

          <input
            type="file"
            accept="video/*"
            onChange={(e) => setSelectedFile(e.target.files[0])}
            className="text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer flex-1 border border-slate-200 rounded-xl p-1"
          />

          <button
            type="submit"
            disabled={isProcessing}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-50 shadow-sm shadow-indigo-200"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing Stream...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Execute Stream Analysis
              </>
            )}
          </button>
        </form>

        {processingStatus && (
          <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 text-xs text-slate-600">
            <Activity className="w-4 h-4 text-indigo-600" />
            <span>{processingStatus}</span>
          </div>
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active Gridlocks</p>
            <h3 className="text-2xl font-extrabold text-rose-600 mt-1">{activeAlertsCount}</h3>
          </div>
          <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center text-rose-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Peak ROI Density</p>
            <h3 className="text-2xl font-extrabold text-sky-600 mt-1">
              {maxDensity} <span className="text-xs font-normal text-slate-500">vehicles</span>
            </h3>
          </div>
          <div className="w-12 h-12 bg-sky-50 rounded-xl flex items-center justify-center text-sky-600">
            <Car className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Monitored Junctions</p>
            <h3 className="text-2xl font-extrabold text-indigo-600 mt-1">CAM_01</h3>
          </div>
          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
            <Video className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Traffic Density & Stationary Trend</h2>
            <p className="text-xs text-slate-500">Real-time fluctuations in vehicle volume and stationary percentage</p>
          </div>
          <Activity className="w-4 h-4 text-slate-400" />
        </div>

        <div className="h-64 w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVehicles" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorRatio" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px' }} />
                <Area type="monotone" dataKey="vehicles" stroke="#0ea5e9" strokeWidth={2} fillOpacity={1} fill="url(#colorVehicles)" name="Vehicles" />
                <Area type="monotone" dataKey="stoppedRatio" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorRatio)" name="Stationary %" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              No historical trend data available. Run video analysis to generate metrics.
            </div>
          )}
        </div>
      </div>

      {/* Incident Log Feed */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Incident Event Feed</h2>
            <p className="text-xs text-slate-500">Live feed of automatically recorded gridlock alerts</p>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            {['ALL', 'ACTIVE', 'RESOLVED'].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  filter === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-400">
              No incidents logged under current filter.
            </div>
          ) : (
            filteredAlerts.map((alert) => (
              <div
                key={alert._id}
                className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                  alert.resolved
                    ? 'bg-slate-50/70 border-slate-200 opacity-70'
                    : 'bg-rose-50/40 border-rose-200 shadow-sm'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className={`p-2.5 rounded-lg ${alert.resolved ? 'bg-slate-200 text-slate-600' : 'bg-rose-100 text-rose-600'}`}>
                    <Flame className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{alert.eventType}</span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-200 text-slate-700">
                        {alert.cameraId}
                      </span>
                      {alert.resolved && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Resolved
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-600">
                      <span className="flex items-center gap-1">
                        <Car className="w-3.5 h-3.5 text-slate-400" /> {alert.vehicleCount} Vehicles
                      </span>
                      <span>Stopped: {Math.round(alert.stationaryRatio * 100)}%</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" /> Duration: {alert.durationSec}s
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                  <span className="text-xs text-slate-400">
                    {new Date(alert.createdAt).toLocaleTimeString()}
                  </span>
                  {!alert.resolved && (
                    <button
                      onClick={() => handleResolveAlert(alert._id)}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg shadow-sm transition-colors"
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
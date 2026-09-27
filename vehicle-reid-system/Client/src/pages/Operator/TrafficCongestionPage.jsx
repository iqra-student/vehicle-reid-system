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
  ShieldCheck,
  Percent,
  Radio,
  SlidersHorizontal
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
const ML_SERVICE_URL = 'http://localhost:8000';

export default function TrafficCongestionPage() {
  const [alerts, setAlerts] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [filter, setFilter] = useState('ALL');

  // Mode Selection: 'LIVE' or 'BATCH'
  const [feedMode, setFeedMode] = useState('LIVE');

  // Video ingestion state
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedCamera, setSelectedCamera] = useState('CAM_01');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState(null);

  // Annotated Video & Reasoning States
  const [annotatedVideoUrl, setAnnotatedVideoUrl] = useState(null);
  const [latestCongestionEvent, setLatestCongestionEvent] = useState(null);

  useEffect(() => {
    fetchAlerts();

    const socket = io(BACKEND_URL);

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('congestion_alert', (newAlert) => {
      setAlerts((prev) => [newAlert, ...prev]);
      appendChartPoint(newAlert);
    });

    return () => socket.disconnect();
  }, []);

  const fetchAlerts = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/congestion/active`);
      if (res.data?.status === 'success') {
        const data = res.data.data || [];
        setAlerts(data);
        buildChartData(data);
      }
    } catch (err) {
      console.error('Failed to fetch congestion history:', err);
    }
  };

  const buildChartData = (data) => {
    const formatted = [...data]
      .reverse()
      .slice(-12)
      .map((item) => ({
        time: item.createdAt
          ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '--:--',
        vehicles: item.vehicleCount || 0,
        stoppedRatio: Math.round((item.stationaryRatio || 0) * 100)
      }));
    setChartData(formatted);
  };

  const appendChartPoint = (item) => {
    setChartData((prev) => [
      ...prev.slice(-11),
      {
        time: item.createdAt
          ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          : '--:--',
        vehicles: item.vehicleCount || 0,
        stoppedRatio: Math.round((item.stationaryRatio || 0) * 100)
      }
    ]);
  };

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
    setProcessingStatus('Running YOLOv8, ByteTrack & ROI Kinematics...');

    try {
      const res = await axios.post(`${ML_SERVICE_URL}/detect-congestion`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.status === 'success') {
        const result = res.data.result;
        const eventsCount = result?.congestion_events_triggered?.length || 0;

        setProcessingStatus(
          `Analysis complete: ${result?.processed_frames || 0} frames processed (${eventsCount} alert${eventsCount === 1 ? '' : 's'} dispatched).`
        );

        if (result?.annotated_video_url) {
          setAnnotatedVideoUrl(result.annotated_video_url);
        }

        if (result?.congestion_events_triggered?.length > 0) {
          setLatestCongestionEvent(result.congestion_events_triggered[0]);
        } else {
          setLatestCongestionEvent(null);
        }

        fetchAlerts();
      }
    } catch (err) {
      console.error('Processing error:', err);
      setProcessingStatus('Analysis failed. Verify FastAPI ML service is running on port 8000.');
    } finally {
      setIsProcessing(false);
    }
  };

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
  const maxDensity = alerts.length > 0 ? Math.max(...alerts.map((a) => a.vehicleCount || 0)) : 0;
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
                isConnected
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                }`}
              />
              {isConnected ? 'Socket.io Connected' : 'Disconnected'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time gridlock detection, bottleneck duration timers, and automated traffic incident feeds.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setFeedMode('LIVE')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                feedMode === 'LIVE'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              Live CCTV
            </button>
            <button
              onClick={() => setFeedMode('BATCH')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                feedMode === 'BATCH'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Batch Ingestion
            </button>
          </div>

          <button
            onClick={fetchAlerts}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Refresh Data
          </button>
        </div>
      </div>

      {/* Camera Selector Toolbar */}
      <div className="flex items-center justify-between bg-slate-900 px-5 py-3.5 rounded-2xl border border-slate-800 text-slate-200">
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Target Junction Stream:</span>
          <select
            value={selectedCamera}
            onChange={(e) => setSelectedCamera(e.target.value)}
            className="text-xs bg-slate-800 text-cyan-300 font-mono border border-slate-700 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            <option value="CAM_01">Junction 1 - Main Boulevard (CAM_01)</option>
            <option value="CAM_02">Junction 2 - Expressway Flyover (CAM_02)</option>
            <option value="CAM_03">Junction 3 - Downtown Underpass (CAM_03)</option>
          </select>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] font-mono bg-blue-950/80 text-blue-300 border border-blue-800/60 px-2.5 py-1 rounded-md">
            <ShieldCheck className="w-3 h-3 text-blue-400" /> cv2.pointPolygonTest Active
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-mono bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 px-2.5 py-1 rounded-md">
            <Percent className="w-3 h-3 text-indigo-400" /> Relative Speed: &lt; 20% H_box/s
          </span>
        </div>
      </div>

      {/* CONTINUOUS LIVE CCTV STREAM VIEWPORT */}
      {feedMode === 'LIVE' && (
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 shadow-2xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
              </span>
              <h3 className="text-white font-semibold text-sm tracking-wide">
                LIVE CCTV FEED: {selectedCamera} (Continuous Stream)
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono bg-emerald-950/80 text-emerald-400 border border-emerald-800 px-2.5 py-1 rounded-md">
                ● Live Inference Active
              </span>
              <span className="text-[11px] font-mono bg-blue-950/80 text-blue-400 border border-blue-800 px-2.5 py-1 rounded-md">
                Road ROI Mask Active
              </span>
            </div>
          </div>

          <div className="relative rounded-xl overflow-hidden bg-black border border-slate-800 aspect-video flex items-center justify-center">
            <img
              src={`${ML_SERVICE_URL}/live-traffic-feed/${selectedCamera}`}
              alt="Real-time Traffic Camera Stream"
              className="w-full h-full object-contain"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "https://placehold.co/1280x720/0f172a/94a3b8?text=CCTV+Feed+Connecting+or+Video+Missing";
              }}
            />
          </div>
        </div>
      )}

      {/* BATCH SURVEILLANCE INGESTION MODE */}
      {feedMode === 'BATCH' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Surveillance Stream Ingestion</h2>
              <p className="text-xs text-slate-500">Upload archived footage to perform full batch kinematic evaluation</p>
            </div>
            <Upload className="w-4 h-4 text-slate-400" />
          </div>

          <form onSubmit={handleProcessVideo} className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
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

          {/* Rendered Annotated Video Player Display */}
          {annotatedVideoUrl && (
            <div className="mt-6 bg-[#0f172a] border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-slate-800/80 mb-4 gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <h3 className="text-white font-semibold text-sm tracking-wide">
                    Annotated Batch Playback: {selectedCamera}
                  </h3>
                </div>
              </div>

              <div className="relative rounded-xl overflow-hidden bg-black border border-slate-800 aspect-video flex items-center justify-center">
                <video
                  key={annotatedVideoUrl}
                  controls
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="w-full h-full object-contain"
                >
                  <source src={annotatedVideoUrl} type="video/mp4" />
                  Your browser does not support HTML5 video streaming.
                </video>
              </div>

              {latestCongestionEvent && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
                    <p className="text-[11px] font-medium text-slate-400">Diagnostic Reason</p>
                    <p className="text-sm font-bold text-rose-400 mt-0.5">
                      {latestCongestionEvent.reasoning || 'Critical Gridlock Detected'}
                    </p>
                  </div>
                  <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
                    <p className="text-[11px] font-medium text-slate-400">Road Capacity Occupancy</p>
                    <p className="text-sm font-bold text-amber-400 mt-0.5">
                      {latestCongestionEvent.occupancyPercentage || 85}% of Road Volume
                    </p>
                  </div>
                  <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
                    <p className="text-[11px] font-medium text-slate-400">Stopped / Crawling Vehicles</p>
                    <p className="text-sm font-bold text-sky-400 mt-0.5">
                      {Math.round((latestCongestionEvent.stationaryRatio || 0.35) * 100)}% Stopped inside ROI
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Monitored Junction</p>
            <h3 className="text-2xl font-extrabold text-indigo-600 mt-1">{selectedCamera}</h3>
          </div>
          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
            <Video className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Recharts Traffic Trend */}
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
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorRatio" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '8px',
                    border: 'none',
                    color: '#fff',
                    fontSize: '12px'
                  }}
                />
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

      {/* Incident Event Feed */}
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
                  filter === tab
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
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
                  <div
                    className={`p-2.5 rounded-lg ${
                      alert.resolved ? 'bg-slate-200 text-slate-600' : 'bg-rose-100 text-rose-600'
                    }`}
                  >
                    <Flame className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{alert.eventType || 'Gridlock Event'}</span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-200 text-slate-700">
                        {alert.cameraId || 'N/A'}
                      </span>
                      {alert.resolved && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Resolved
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-600">
                      <span className="flex items-center gap-1">
                        <Car className="w-3.5 h-3.5 text-slate-400" /> {alert.vehicleCount ?? 0} Vehicles
                      </span>
                      <span>Stopped: {Math.round((alert.stationaryRatio || 0) * 100)}%</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" /> Duration: {alert.durationSec ?? 0}s
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                  <span className="text-xs text-slate-400">
                    {alert.createdAt ? new Date(alert.createdAt).toLocaleTimeString() : '--:--'}
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
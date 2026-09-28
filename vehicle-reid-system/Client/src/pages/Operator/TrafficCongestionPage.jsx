import React, { useState, useEffect, useRef } from 'react';
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
import { logActivity, authHeaders } from '../../api/audit';

const BACKEND_URL = 'http://localhost:5000';
const ML_SERVICE_URL = 'http://127.0.0.1:8000';

export default function TrafficCongestionPage() {
  const [alerts, setAlerts] = useState([]);
  const [activeCount, setActiveCount] = useState(0); // true count from the server (not limited to the list)
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
  const [analysisResult, setAnalysisResult] = useState(null);

  // Audit log: record which live feed an operator opens (once per camera per minute,
  // so re-renders and React StrictMode don't create duplicate entries)
  const lastFeedLog = useRef({ key: null, at: 0 });
  useEffect(() => {
    if (feedMode !== 'LIVE') return;
    const now = Date.now();
    if (lastFeedLog.current.key === selectedCamera && now - lastFeedLog.current.at < 60000) return;
    lastFeedLog.current = { key: selectedCamera, at: now };
    logActivity({
      action: 'LIVE_FEED_VIEW',
      cameraId: selectedCamera,
      summary: `Opened live CCTV feed for ${selectedCamera}`,
    });
  }, [feedMode, selectedCamera]);

  useEffect(() => {
    fetchAlerts();

    const socket = io(BACKEND_URL);

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('congestion_alert', (newAlert) => {
      setAlerts((prev) => [newAlert, ...prev]);
      setActiveCount((c) => c + 1);
      appendChartPoint(newAlert);
    });

    // Another user dismissed an alert: reload the true count
    socket.on('congestion_resolved', () => fetchAlerts());

    return () => socket.disconnect();
  }, []);

  const fetchAlerts = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/congestion/active`);
      if (res.data?.status === 'success') {
        const data = res.data.data || [];
        setAlerts(data);
        setActiveCount(
          typeof res.data.activeCount === 'number'
            ? res.data.activeCount
            : data.filter((a) => !a.resolved).length
        );
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
    setAnalysisResult(null);
    setProcessingStatus('Detecting vehicles and measuring traffic flow. This can take a minute...');

    try {
      const res = await axios.post(`${ML_SERVICE_URL}/detect-congestion`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.status === 'success') {
        const result = res.data.result;
        const eventsCount = result?.congestion_events_triggered?.length || 0;

        setAnalysisResult(result || null);
        setProcessingStatus(
          `Analysis complete: ${result?.processed_frames || 0} frames checked, ${eventsCount} alert${eventsCount === 1 ? '' : 's'} raised.`
        );

        if (result?.annotated_video_url) {
          setAnnotatedVideoUrl(result.annotated_video_url);
        }

        if (result?.congestion_events_triggered?.length > 0) {
          setLatestCongestionEvent(result.congestion_events_triggered[0]);
        } else {
          setLatestCongestionEvent(null);
        }

        // Audit log: which footage was analysed and what the engine concluded
        const worst = result?.worst_state || (eventsCount > 0 ? 'Congested' : 'Free Flow');
        const peakCI = result?.peak_congestion_index;
        const duration = result?.total_video_duration_sec;
        logActivity({
          action: 'CONGESTION_ANALYSIS',
          cameraId: selectedCamera,
          query: selectedFile.name,
          summary:
            `${worst}` +
            (typeof peakCI === 'number' ? ` (peak CI ${peakCI.toFixed(2)})` : '') +
            ` · ${eventsCount} alert${eventsCount === 1 ? '' : 's'}` +
            (typeof duration === 'number' ? ` · ${Math.round(duration)}s video` : ''),
          details: {
            worst_state: result?.worst_state ?? null,
            dominant_state: result?.dominant_state ?? null,
            peak_congestion_index: peakCI ?? null,
            state_durations_sec: result?.state_durations_sec ?? null,
            alerts: eventsCount,
            processed_frames: result?.processed_frames ?? null,
            roi_source: result?.roi_source ?? null,
          },
        });

        fetchAlerts();
      }
    } catch (err) {
      console.error('Processing error:', err);
      setProcessingStatus('Analysis failed. Make sure the ML service is running (port 8000).');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResolveAlert = async (id) => {
    try {
      await axios.patch(`${BACKEND_URL}/api/congestion/resolve/${id}`, {}, { headers: authHeaders() });

      // Audit log: who dismissed which alert
      const dismissed = alerts.find((a) => a._id === id);
      logActivity({
        action: 'ALERT_RESOLVE',
        cameraId: dismissed?.cameraId || '',
        query: String(id),
        summary: dismissed
          ? `Dismissed ${dismissed.congestionState || dismissed.eventType || 'congestion'} alert (${dismissed.vehicleCount ?? 0} vehicles)`
          : 'Dismissed congestion alert',
        details: {
          alertId: id,
          reasoning: dismissed?.reasoning || null,
          createdAt: dismissed?.createdAt || null,
        },
      });

      setAlerts((prev) =>
        prev.map((item) => (item._id === id ? { ...item, resolved: true } : item))
      );
      setActiveCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    }
  };

  const activeAlertsCount = activeCount;
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
            <h1 className="text-xl font-bold text-slate-900">Traffic Congestion Monitoring</h1>
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
              {isConnected ? 'Live updates on' : 'Live updates off'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Detects congested and blocked roads from camera footage and raises alerts automatically.
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
              Live Camera
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
              Upload Video
            </button>
          </div>

        </div>
      </div>

      {/* Camera Selector Toolbar */}
      <div className="flex items-center justify-between bg-slate-900 px-5 py-3.5 rounded-2xl border border-slate-800 text-slate-200">
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Camera:</span>
          <select
            value={selectedCamera}
            onChange={(e) => setSelectedCamera(e.target.value)}
            className="text-xs bg-slate-800 text-cyan-300 font-mono border border-slate-700 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            <option value="CAM_01">CAM_01</option>
            <option value="CAM_02">CAM_02</option>
            <option value="CAM_03">CAM_03</option>
          </select>
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
                Live feed: {selectedCamera}
              </h3>
            </div>
          </div>

          <div className="relative rounded-xl overflow-hidden bg-black border border-slate-800 aspect-video flex items-center justify-center">
            <img
              src={`${ML_SERVICE_URL}/live-traffic-feed/${selectedCamera}`}
              alt="Live traffic camera feed"
              className="w-full h-full object-contain"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "https://placehold.co/1280x720/0f172a/94a3b8?text=Camera+feed+not+available";
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
              <h2 className="text-sm font-bold text-slate-900">Analyze a Video</h2>
              <p className="text-xs text-slate-500">Upload recorded traffic footage to check it for congestion</p>
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
                  Analyzing video...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Analyze Video
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
                    Result video: {selectedCamera}
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
                  Your browser cannot play this video.
                </video>
              </div>

              {analysisResult && (() => {
                const STATE_TEXT = {
                  'Free Flow': 'text-emerald-400',
                  'Slow Moving': 'text-amber-400',
                  'Congested': 'text-orange-400',
                  'Blocked': 'text-rose-400',
                };
                const worst = analysisResult.worst_state;
                const peakCI = analysisResult.peak_congestion_index;
                const sd = analysisResult.state_durations_sec || {};
                const jamSec = (sd['Congested'] || 0) + (sd['Blocked'] || 0);
                const totalSec = analysisResult.total_video_duration_sec || 0;
                const jamPct = totalSec > 0 ? Math.round((jamSec / totalSec) * 100) : 0;
                return (
                  <div className="mt-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
                        <p className="text-[11px] font-medium text-slate-400">Result</p>
                        <p className={`text-sm font-bold mt-0.5 ${STATE_TEXT[worst] || 'text-slate-200'}`}>
                          {worst || '—'}
                        </p>
                      </div>
                      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
                        <p className="text-[11px] font-medium text-slate-400">Peak congestion index (0–1)</p>
                        <p className="text-sm font-bold text-amber-400 mt-0.5">
                          {typeof peakCI === 'number' ? peakCI.toFixed(2) : '—'}
                        </p>
                      </div>
                      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
                        <p className="text-[11px] font-medium text-slate-400">Time congested</p>
                        <p className="text-sm font-bold text-sky-400 mt-0.5">
                          {Math.round(jamSec)}s of {Math.round(totalSec)}s ({jamPct}%)
                        </p>
                      </div>
                    </div>
                    {latestCongestionEvent?.reasoning && (
                      <p className="text-xs text-slate-400">{latestCongestionEvent.reasoning}</p>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active Alerts</p>
            <h3 className="text-2xl font-extrabold text-rose-600 mt-1">{activeAlertsCount}</h3>
          </div>
          <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center text-rose-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Most Vehicles in One Alert</p>
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
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Selected Camera</p>
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
            <h2 className="text-sm font-bold text-slate-900">Recent Alerts</h2>
            <p className="text-xs text-slate-500">Vehicles on the road and % stopped at the time of each alert</p>
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
                <Area type="monotone" dataKey="stoppedRatio" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorRatio)" name="Stopped %" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              No alerts yet. Analyze a video to see results here.
            </div>
          )}
        </div>
      </div>

      {/* Incident Event Feed */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Alerts</h2>
            <p className="text-xs text-slate-500">Congestion alerts raised by the system, newest first</p>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            {[['ALL', 'All'], ['ACTIVE', 'Active'], ['RESOLVED', 'Dismissed']].map(([tab, label]) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  filter === tab
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-400">
              No alerts here.
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
                      <span className="font-bold text-sm text-slate-900">
                        {alert.congestionState ? `${alert.congestionState} traffic` : 'Congestion alert'}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-200 text-slate-700">
                        {alert.cameraId || 'N/A'}
                      </span>
                      {alert.resolved && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Dismissed
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
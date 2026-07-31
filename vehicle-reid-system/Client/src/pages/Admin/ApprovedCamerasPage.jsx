import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getApprovedCameras } from "../../api/cameraApi";
import {
  Video,
  Activity,
  RefreshCw,
  Maximize2,
  AlertCircle,
  MapPin,
  Camera,
} from "lucide-react";

export default function ApprovedCamerasPage() {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [gridMode, setGridMode] = useState("2x2");
  const [isAiActive, setIsAiActive] = useState(true);

  const fetchApprovedCameras = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await getApprovedCameras();
      setCameras(data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load active cameras.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovedCameras();
  }, []);

  const gridLayoutClass = {
    "1x1": "grid-cols-1",
    "2x2": "grid-cols-1 md:grid-cols-2",
    "3x3": "grid-cols-1 md:grid-cols-3",
  }[gridMode];

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#1C2029] p-4 rounded-xl border border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Video className="w-5 h-5 text-[#3AB0FF]" />
            Active Surveillance Feeds
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Approved cameras feeding real-time data into the vehicle tracking system.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Refresh Action */}
          <button
            onClick={fetchApprovedCameras}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-lg border border-slate-700 transition-colors"
            title="Refresh Cameras"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          {/* AI Overlay Toggle */}
          <button
            onClick={() => setIsAiActive(!isAiActive)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              isAiActive
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : "bg-slate-800 text-slate-400 border-slate-700"
            }`}
          >
            <Activity className="w-4 h-4 animate-pulse" />
            YOLOv8: {isAiActive ? "ACTIVE" : "PAUSED"}
          </button>

          {/* Grid Layout Controls */}
          <div className="flex items-center bg-[#0F1115] p-1 rounded-lg border border-slate-800">
            {["1x1", "2x2", "3x3"].map((mode) => (
              <button
                key={mode}
                onClick={() => setGridMode(mode)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  gridMode === mode
                    ? "bg-[#3AB0FF] text-slate-950 font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Camera Grid Display */}
      {loading ? (
        <div className="flex items-center justify-center h-64 bg-[#1C2029] rounded-xl border border-slate-800 text-slate-400 text-sm">
          <RefreshCw className="w-5 h-5 animate-spin text-[#3AB0FF] mr-3" />
          Loading approved camera feeds...
        </div>
      ) : cameras.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-[#1C2029] rounded-xl border border-dashed border-slate-800 text-center">
          <Camera className="w-12 h-12 text-slate-600 mb-3" />
          <p className="text-base font-medium text-slate-300">No active cameras found</p>
          <p className="text-xs text-slate-500 mt-1">
            There are currently no approved cameras feeding into the tracking system.
          </p>
        </div>
      ) : (
        <div className={`grid ${gridLayoutClass} gap-4`}>
          {cameras.map((cam) => (
            <div
              key={cam._id}
              className="group relative bg-[#1C2029] rounded-xl border border-slate-800 overflow-hidden flex flex-col justify-between min-h-[280px]"
            >
              {/* Header Bar */}
              <div className="p-3 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 flex items-center justify-between z-10">
                <div className="flex items-center gap-2 truncate pr-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <h3 className="text-xs font-bold text-slate-200 truncate">{cam.name}</h3>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700 shrink-0">
                  {cam.frameRate ? `${cam.frameRate} FPS` : "LIVE"}
                </span>
              </div>

              {/* Video Stream Area */}
              <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
                <img
                  src={
                    cam.streamUrl ||
                    `http://localhost:8000/api/stream/${cam._id}`
                  }
                  alt={cam.name}
                  className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    // Placeholder background image if actual camera stream fails to load
                    e.currentTarget.src =
                      "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=800&q=80";
                  }}
                />

                {/* Simulated AI Detection Overlay */}
                {isAiActive && (
                  <div className="absolute top-1/3 left-1/4 w-28 h-20 border-2 border-[#3AB0FF] bg-[#3AB0FF]/10 rounded flex flex-col justify-between p-1">
                    <span className="text-[9px] font-mono font-bold bg-[#3AB0FF] text-slate-950 px-1 rounded w-max">
                      Detecting
                    </span>
                    <span className="text-[8px] font-mono text-[#3AB0FF] self-end">
                      Re-ID Ready
                    </span>
                  </div>
                )}
              </div>

              {/* Meta Stats & Details */}
              <div className="p-3 bg-[#151821] border-t border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1 text-slate-300 truncate">
                    <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                    {cam.location}
                  </span>
                  {cam.resolution && (
                    <span className="text-[10px] font-mono bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">
                      {cam.resolution}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800/60 font-mono">
                  <span>
                    LAT/LNG: {cam.latitude}, {cam.longitude}
                  </span>
                  <span>ID: ...{cam._id?.slice(-6)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
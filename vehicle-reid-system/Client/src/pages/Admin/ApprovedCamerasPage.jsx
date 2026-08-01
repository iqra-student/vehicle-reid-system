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
    <div className="p-6 bg-[#F8FAFC] min-h-screen text-[#0C1A2B] font-sans space-y-6">
      
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-[#0C1A2B] flex items-center gap-2">
            <Video className="w-5 h-5 text-[#7BA4D0]" />
            Active Surveillance Feeds
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Approved cameras feeding real-time data into the vehicle tracking system.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Refresh Action */}
          <button
            onClick={fetchApprovedCameras}
            className="p-2 text-[#0C1A2B] hover:bg-[#E7F0FA]/60 bg-white rounded-xl border border-slate-200 shadow-sm transition-colors"
            title="Refresh Cameras"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#7BA4D0]" : ""}`} />
          </button>

          {/* AI Overlay Toggle */}
          <button
            onClick={() => setIsAiActive(!isAiActive)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
              isAiActive
                ? "bg-emerald-50 text-emerald-700 border-emerald-300 shadow-sm"
                : "bg-slate-100 text-slate-500 border-slate-200"
            }`}
          >
            <Activity className={`w-4 h-4 ${isAiActive ? "animate-pulse" : ""}`} />
            YOLOv8: {isAiActive ? "ACTIVE" : "PAUSED"}
          </button>

          {/* Grid Layout Controls */}
          <div className="flex items-center bg-[#E7F0FA]/60 p-1 rounded-xl border border-slate-200">
            {["1x1", "2x2", "3x3"].map((mode) => (
              <button
                key={mode}
                onClick={() => setGridMode(mode)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  gridMode === mode
                    ? "bg-[#0C1A2B] text-white shadow-sm"
                    : "text-[#0C1A2B]/70 hover:text-[#0C1A2B]"
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
        <div className="flex items-center gap-2 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm font-semibold">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Camera Grid Display */}
      {loading ? (
        <div className="flex items-center justify-center h-72 bg-white rounded-2xl border border-slate-200/80 shadow-sm text-slate-500 text-sm">
          <RefreshCw className="w-6 h-6 animate-spin text-[#7BA4D0] mr-3" />
          <span className="font-semibold text-[#0C1A2B]">Loading approved camera feeds...</span>
        </div>
      ) : cameras.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border-2 border-dashed border-[#7BA4D0]/40 text-center shadow-sm">
          <div className="w-14 h-14 bg-[#E7F0FA] rounded-2xl flex items-center justify-center mb-3">
            <Camera className="w-7 h-7 text-[#7BA4D0]" />
          </div>
          <p className="text-base font-bold text-[#0C1A2B]">No active cameras found</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            There are currently no approved cameras feeding into the tracking system.
          </p>
        </div>
      ) : (
        <div className={`grid ${gridLayoutClass} gap-6`}>
          {cameras.map((cam) => (
            <div
              key={cam._id}
              className="group relative bg-[#0C1A2B] rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between min-h-[300px]"
            >
              {/* Header Bar */}
              <div className="p-3.5 bg-[#0C1A2B]/85 backdrop-blur-md border-b border-white/10 flex items-center justify-between z-10">
                <div className="flex items-center gap-2 truncate pr-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <h3 className="text-xs font-bold text-white tracking-wide truncate">{cam.name}</h3>
                </div>
                <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 bg-[#E7F0FA]/10 text-[#7BA4D0] rounded-md border border-[#7BA4D0]/30 shrink-0">
                  {cam.frameRate ? `${cam.frameRate} FPS` : "LIVE"}
                </span>
              </div>

              {/* Video Stream Area */}
              <div className="relative flex-1 bg-slate-950 flex items-center justify-center overflow-hidden">
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
                  <div className="absolute top-1/3 left-1/4 w-32 h-24 border-2 border-[#7BA4D0] bg-[#7BA4D0]/20 backdrop-blur-[1px] rounded-xl flex flex-col justify-between p-2 shadow-lg animate-pulse">
                    <span className="text-[9px] font-mono font-bold bg-[#7BA4D0] text-[#0C1A2B] px-1.5 py-0.5 rounded-md w-max">
                      YOLOv8 DETECTING
                    </span>
                    <span className="text-[9px] font-mono font-bold text-[#E7F0FA] bg-[#0C1A2B]/80 px-1.5 py-0.5 rounded-md self-end">
                      RE-ID READY
                    </span>
                  </div>
                )}
              </div>

              {/* Meta Stats & Details */}
              <div className="p-3.5 bg-[#E7F0FA]/30 border-t border-slate-200/60 space-y-2">
                <div className="flex items-center justify-between text-xs text-[#0C1A2B]">
                  <span className="flex items-center gap-1.5 font-semibold text-[#0C1A2B] truncate">
                    <MapPin className="w-3.5 h-3.5 text-[#7BA4D0] shrink-0" />
                    {cam.location}
                  </span>
                  {cam.resolution && (
                    <span className="text-[10px] font-mono font-bold bg-[#E7F0FA] text-[#0C1A2B] px-2 py-0.5 rounded-md border border-[#7BA4D0]/30">
                      {cam.resolution}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-[10px] text-[#0C1A2B]/70 pt-1.5 border-t border-slate-200/60 font-mono">
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
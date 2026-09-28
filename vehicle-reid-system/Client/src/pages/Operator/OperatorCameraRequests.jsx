import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { getMyRequests } from "../../api/cameraApi";
import { RefreshCw, AlertCircle, Camera, MapPin } from "lucide-react";

const BACKEND_URL = "http://localhost:5000";

const STATUS_STYLES = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function OperatorCameraRequests() {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await getMyRequests();
      setCameras(data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load your requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();

    const socket = io(BACKEND_URL, { auth: { token: localStorage.getItem("token") } });

    socket.on("camera_update", (cam) =>
      setCameras((prev) =>
        prev.some((c) => c._id === cam._id)
          ? prev.map((c) => (c._id === cam._id ? cam : c))
          : [cam, ...prev]
      )
    );
    socket.on("camera_deleted", (id) =>
      setCameras((prev) => prev.filter((c) => c._id !== id))
    );

    return () => socket.disconnect();
  }, []);

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-[#0D2440]">My camera requests</h2>
          <p className="text-sm text-[#4B617D] mt-1">
            Cameras you submitted and their approval status.
          </p>
        </div>
        <button
          onClick={load}
          className="p-2 bg-white border border-[#D4E2F0] rounded-xl hover:bg-[#F8FAFD]"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 text-[#2E5E99] ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[#4B617D]">Loading...</p>
      ) : cameras.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <div className="w-12 h-12 bg-[#E7F0FA] rounded-2xl flex items-center justify-center mb-3">
            <Camera className="w-6 h-6 text-[#7BA4D0]" />
          </div>
          <p className="text-sm font-semibold text-[#0D2440]">No requests yet</p>
          <p className="text-xs text-[#4B617D] mt-1">Use "Register Camera" to submit one.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cameras.map((cam) => (
            <div
              key={cam._id}
              className="flex items-start justify-between gap-4 rounded-xl border border-[#D4E2F0] p-4"
            >
              <div className="min-w-0">
                <p className="font-semibold text-[#0D2440] truncate">{cam.name}</p>
                <p className="text-sm text-[#4B617D] flex items-center gap-1.5 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-[#7BA4D0] shrink-0" />
                  {cam.location}
                </p>
                <p className="text-xs text-[#93A2B8] mt-1">
                  Submitted {new Date(cam.createdAt).toLocaleString()}
                </p>
                {cam.status === "rejected" && cam.rejectionReason && (
                  <p className="text-xs text-rose-600 mt-2">Reason: {cam.rejectionReason}</p>
                )}
              </div>
              <span
                className={`text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-lg border shrink-0 ${STATUS_STYLES[cam.status]}`}
              >
                {cam.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
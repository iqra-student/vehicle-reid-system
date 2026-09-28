import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { getPendingCameras, approveCamera, rejectCamera } from "../../api/cameraApi";
import { RefreshCw, AlertCircle, Camera, MapPin } from "lucide-react";

const BACKEND_URL = "http://localhost:5000";

export default function AdminCameraApprovals() {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const fetchPending = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await getPendingCameras();
      setCameras(data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load pending cameras.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();

    const socket = io(BACKEND_URL, { auth: { token: localStorage.getItem("token") } });

    // new request from an operator
    socket.on("camera_submitted", (cam) =>
      setCameras((prev) => (prev.some((c) => c._id === cam._id) ? prev : [cam, ...prev]))
    );
    // another admin approved/rejected/deleted it
    socket.on("camera_reviewed", (id) =>
      setCameras((prev) => prev.filter((c) => c._id !== id))
    );

    return () => socket.disconnect();
  }, []);

  const handleApprove = async (id) => {
    setActionLoadingId(id);
    try {
      await approveCamera(id);
      setCameras((prev) => prev.filter((c) => c._id !== id));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to approve camera.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (id) => {
    const reason = window.prompt("Rejection reason (optional):");
    if (reason === null) return; // admin cancelled the prompt
    setActionLoadingId(id);
    try {
      await rejectCamera(id, reason);
      setCameras((prev) => prev.filter((c) => c._id !== id));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to reject camera.");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-[#0D2440]">Pending camera approvals</h2>
          <p className="text-sm text-[#4B617D] mt-1">
            Review cameras submitted by operators before they go live.
          </p>
        </div>
        <button
          onClick={fetchPending}
          className="p-2 bg-white border border-[#D4E2F0] rounded-xl hover:bg-[#F8FAFD]"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 text-[#2E5E99] ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm" role="alert">
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
          <p className="text-sm font-semibold text-[#0D2440]">No pending cameras</p>
          <p className="text-xs text-[#4B617D] mt-1">New operator requests will appear here instantly.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cameras.map((cam) => (
            <div
              key={cam._id}
              className="flex items-center justify-between gap-4 rounded-xl border border-[#D4E2F0] p-4"
            >
              <div className="min-w-0">
                <p className="font-semibold text-[#0D2440] truncate">{cam.name}</p>
                <p className="text-sm text-[#4B617D] flex items-center gap-1.5 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-[#7BA4D0] shrink-0" />
                  {cam.location}
                </p>
                <p className="text-xs text-[#93A2B8] mt-1">
                  Submitted by {cam.submittedBy?.name} ({cam.submittedBy?.email}) ·{" "}
                  {new Date(cam.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => handleApprove(cam._id)}
                  disabled={actionLoadingId === cam._id}
                  className="rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleReject(cam._id)}
                  disabled={actionLoadingId === cam._id}
                  className="rounded-xl bg-rose-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
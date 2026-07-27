import { useEffect, useState } from "react";
import { getPendingCameras, approveCamera, rejectCamera } from "../../api/cameraApi";

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
    const reason = window.prompt("Rejection reason (optional):") || "";
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
    <div className="p-8">
      <h1 className="text-xl font-semibold text-slate-900 mb-1">
        Pending camera approvals
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Review cameras submitted by operators before they go live.
      </p>

      {error && (
        <p className="text-sm text-red-600 mb-4" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : cameras.length === 0 ? (
        <p className="text-sm text-slate-500">No pending cameras right now.</p>
      ) : (
        <div className="space-y-3">
          {cameras.map((cam) => (
            <div
              key={cam._id}
              className="flex items-center justify-between rounded-md border border-slate-200 p-4"
            >
              <div>
                <p className="font-medium text-slate-900">{cam.name}</p>
                <p className="text-sm text-slate-500">{cam.location}</p>
                <p className="text-xs text-slate-400">
                  Submitted by {cam.submittedBy?.name} ({cam.submittedBy?.email})
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleApprove(cam._id)}
                  disabled={actionLoadingId === cam._id}
                  className="rounded-md bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleReject(cam._id)}
                  disabled={actionLoadingId === cam._id}
                  className="rounded-md bg-red-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
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
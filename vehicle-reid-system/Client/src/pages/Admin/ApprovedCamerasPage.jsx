import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getApprovedCameras } from "../../api/cameraApi";

export default function ApprovedCamerasPage() {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 mb-1">
            Active System Cameras
          </h1>
          <p className="text-sm text-slate-500">
            Approved cameras currently feeding into the vehicle tracking system.
          </p>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 mb-4" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading active cameras...</p>
      ) : cameras.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center">
          <p className="text-sm text-slate-500">No active cameras found in the system.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cameras.map((cam) => (
            <div
              key={cam._id}
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-slate-900">{cam.name}</h3>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Live
                  </span>
                </div>

                <p className="text-sm text-slate-600 mb-4">{cam.location}</p>

                <div className="space-y-1.5 text-xs text-slate-500 bg-slate-50 p-3 rounded-md border border-slate-100 mb-4">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Coordinates:</span>
                    <span className="font-mono text-slate-700">{cam.latitude}, {cam.longitude}</span>
                  </div>
                  {cam.angle !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Angle:</span>
                      <span className="text-slate-700">{cam.angle}°</span>
                    </div>
                  )}
                  {cam.resolution && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Resolution:</span>
                      <span className="text-slate-700">{cam.resolution}</span>
                    </div>
                  )}
                  {cam.frameRate && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Frame Rate:</span>
                      <span className="text-slate-700">{cam.frameRate} FPS</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="text-[11px] text-slate-400 border-t border-slate-100 pt-3">
                System ID: <span className="font-mono">{cam._id}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
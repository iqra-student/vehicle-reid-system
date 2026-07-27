import { useState, useEffect } from "react";
import RegisterCameraPage from "../RegisterCameraPage";
import { getApprovedCameras } from "../../api/cameraApi";

export default function OperatorDashboard() {
  const [activeTab, setActiveTab] = useState("live"); // 'live' | 'register'
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLiveFeeds = async () => {
    setLoading(true);
    try {
      const { data } = await getApprovedCameras();
      setCameras(data);
    } catch (err) {
      console.error("Failed to load live feeds", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "live") {
      fetchLiveFeeds();
    }
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Operator Portal</h1>
            <p className="text-sm text-slate-500 mt-1">
              Monitor active operator feeds and submit new camera nodes for admin review.
            </p>
          </div>

          {/* Action Tabs */}
          <div className="flex items-center gap-2 bg-slate-200/70 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab("live")}
              className={`px-4 py-2 text-xs font-semibold rounded-md transition-all ${
                activeTab === "live"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Live Operator Feeds
            </button>
            <button
              onClick={() => setActiveTab("register")}
              className={`px-4 py-2 text-xs font-semibold rounded-md transition-all ${
                activeTab === "register"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              + Register Camera
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          {activeTab === "register" ? (
            <div>
              <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-md mb-6 border border-amber-200">
                📌 <strong>Notice:</strong> Cameras registered by operators require admin approval before they appear live on the dashboard.
              </p>
              <RegisterCameraPage />
            </div>
          ) : (
            <div>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">
                Approved Live Feeds
              </h2>
              {loading ? (
                <p className="text-sm text-slate-500">Loading active camera feeds...</p>
              ) : cameras.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center">
                  <p className="text-sm text-slate-500">
                    No operator live feeds active right now. Submit a registration request above!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {cameras.map((cam) => (
                    <div
                      key={cam._id}
                      className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-slate-900">{cam.name}</h3>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Live Feed
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mb-3">{cam.location}</p>
                      <div className="text-xs text-slate-400 font-mono">
                        Coords: {cam.latitude}, {cam.longitude}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getApprovedCameras } from "../../api/cameraApi";
import RegisterCameraPage from "../RegisterCameraPage"; // Shared Modal Component
import { Camera, Plus, RefreshCw, AlertTriangle, Search } from "lucide-react";

export default function CameraManagementPage() {
  const navigate = useNavigate();
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");

  const fetchCameras = async () => {
    setLoading(true);
    try {
      const { data } = await getApprovedCameras();
      setCameras(data);
    } catch (err) {
      console.error("Failed to load cameras", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCameras();
  }, []);

  // Filter camera logic
  const filteredCameras = cameras.filter((cam) => {
    const matchesSearch =
      cam.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cam.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cam.camId?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "All Status" ||
      (statusFilter === "Online" && (cam.status === "approved" || cam.status === "ONLINE")) ||
      (statusFilter === "Offline" && cam.status === "OFFLINE");

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER BAR */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-[#16202E] p-5 rounded-2xl border border-slate-700/60 shadow-xl text-white">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#3AB0FF]" />
            Camera Management
          </h1>
          <p className="text-xs text-slate-300 mt-0.5">
            Operator • Camera network configuration
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchCameras}
            className="p-2.5 text-slate-400 hover:text-white bg-[#0D131D] rounded-xl border border-slate-700 transition-colors"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#3AB0FF]" : ""}`} />
          </button>

          <button
            onClick={() => setShowModal(true)}
            className="bg-[#3AB0FF] hover:bg-[#289BEB] text-slate-950 font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Camera
          </button>
        </div>
      </div>

      {/* 2. WARNING BANNER */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 flex items-center gap-3 text-xs text-amber-300">
        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
        <span>
          <strong>Notice:</strong> Camera configuration changes will affect the live surveillance network.
        </span>
      </div>

      {/* 3. CONTROLS & CAMERA TABLE PANEL */}
      <div className="bg-[#16202E] rounded-2xl p-6 border border-slate-700/60 shadow-xl space-y-4 text-white">
        {/* Search & Status Filter */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search cameras..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0D131D] border border-slate-700 text-xs text-white pl-9 pr-4 py-2.5 rounded-xl focus:border-[#3AB0FF] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#0D131D] border border-slate-700 text-xs text-white rounded-xl px-3 py-2.5 focus:border-[#3AB0FF] focus:outline-none font-semibold"
            >
              <option>All Status</option>
              <option>Online</option>
              <option>Offline</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="pb-3">Camera ID</th>
                <th className="pb-3">Name</th>
                <th className="pb-3">Location</th>
                <th className="pb-3">GPS Coordinates</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Resolution</th>
                <th className="pb-3">FPS</th>
                <th className="pb-3">Angle</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium text-slate-200">
              {filteredCameras.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-slate-500">
                    {loading ? "Fetching cameras..." : "No cameras found in system network."}
                  </td>
                </tr>
              ) : (
                filteredCameras.map((cam, idx) => {
                  const targetCamId = cam.camId || cam._id || `CAM-00${idx + 1}`;
                  return (
                    <tr key={cam._id || idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 font-mono font-bold text-[#3AB0FF]">{targetCamId}</td>
                      <td className="py-3.5 font-bold text-white">{cam.name}</td>
                      <td className="py-3.5 text-slate-300">{cam.location}</td>
                      <td className="py-3.5 font-mono text-slate-400">
                        {cam.latitude && cam.longitude
                          ? `${cam.latitude}, ${cam.longitude}`
                          : "24.8607, 67.0011"}
                      </td>
                      <td className="py-3.5">
                        <span className="inline-flex items-center gap-1 font-bold font-mono px-2 py-0.5 rounded text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 text-[10px]">
                          ● ONLINE
                        </span>
                      </td>
                      <td className="py-3.5 font-mono text-slate-300">{cam.resolution || "1080p"}</td>
                      <td className="py-3.5 font-mono text-slate-300">{cam.frameRate || "30"}</td>
                      <td className="py-3.5 font-mono text-slate-300">{cam.angle || "120"}°</td>
                      <td className="py-3.5 text-right space-x-1.5">
                        {/* View Action Switch to Live Monitoring */}
                        <button
                          onClick={() => navigate(`/operator/live-monitoring?camId=${targetCamId}`)}
                          className="px-2.5 py-1 text-[11px] font-bold bg-[#0D131D] text-[#3AB0FF] hover:bg-[#121B2A] border border-slate-700 rounded-lg transition-colors"
                        >
                          View
                        </button>
                        <button className="px-2.5 py-1 text-[11px] font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors">
                          Edit
                        </button>
                        <button className="px-2.5 py-1 text-[11px] font-semibold bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg transition-colors">
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. SHARED MODAL COMPONENT */}
      <RegisterCameraPage
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={fetchCameras}
      />
    </div>
  );
}
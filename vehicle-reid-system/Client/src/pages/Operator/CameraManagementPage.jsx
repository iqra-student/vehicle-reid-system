
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getApprovedCameras } from "../../api/cameraApi";
import RegisterCameraPage from "../RegisterCameraPage";
import {
  Camera,
  Plus,
  RefreshCw,
  Search,
  ChevronDown,
  Eye,
  Edit2,
  Trash2,
  MapPin,
} from "lucide-react";

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
    <div className="space-y-6 text-[#0C1A2B] font-sans">
      
      {/* 1. MAIN HEADER PANEL */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-[#0C1A2B] p-5 rounded-2xl border border-slate-800 shadow-xl text-white">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 bg-[#16202E] border border-slate-700/80 rounded-xl text-[#3AB0FF] shadow-inner">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Camera Management
            </h1>
            <p className="text-xs text-slate-400 mt-0.5 font-medium">
              Operator • Camera network configuration
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchCameras}
            className="p-2.5 text-slate-300 hover:text-white bg-[#16202E] hover:bg-slate-800 rounded-xl border border-slate-700/80 transition-all shadow-sm"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#3AB0FF]" : ""}`} />
          </button>

          <button
            onClick={() => setShowModal(true)}
            className="bg-[#3AB0FF] hover:bg-[#7BA4D0] text-[#0C1A2B] font-bold text-xs px-4 py-2.5 rounded-xl shadow-md hover:shadow-lg flex items-center gap-2 transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            Add Camera
          </button>
        </div>
      </div>

      {/* 2. CONTROLS & CAMERA TABLE PANEL */}
      <div className="bg-[#0C1A2B] rounded-2xl p-6 border border-slate-800 shadow-xl space-y-5 text-white">
        
        {/* Search & Status Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search cameras..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#16202E] border border-slate-700/80 text-xs text-white placeholder-slate-400 pl-10 pr-4 py-2.5 rounded-xl focus:border-[#3AB0FF] focus:outline-none transition-all font-medium"
            />
          </div>

          <div className="relative w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-36 appearance-none bg-[#16202E] border border-slate-700/80 text-xs text-slate-200 rounded-xl px-3.5 py-2.5 pr-8 focus:border-[#3AB0FF] focus:outline-none font-semibold cursor-pointer"
            >
              <option value="All Status">All Status</option>
              <option value="Online">Online</option>
              <option value="Offline">Offline</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-3 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800/60">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#16202E] text-slate-400 uppercase tracking-wider font-bold text-[11px] border-b border-slate-800">
                <th className="py-3.5 px-4">Camera ID</th>
                <th className="py-3.5 px-4">Name</th>
                <th className="py-3.5 px-4">Location</th>
                <th className="py-3.5 px-4">GPS Coordinates</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Resolution</th>
                <th className="py-3.5 px-4">FPS</th>
                <th className="py-3.5 px-4">Angle</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 font-medium text-slate-200">
              {filteredCameras.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-400 bg-[#0C1A2B]">
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-[#3AB0FF]" />
                        <span>Fetching cameras from network...</span>
                      </div>
                    ) : (
                      "No cameras found matching current filters."
                    )}
                  </td>
                </tr>
              ) : (
                filteredCameras.map((cam, idx) => {
                  const targetCamId = cam.camId || cam._id || `CAM-00${idx + 1}`;
                  return (
                    <tr 
                      key={cam._id || idx} 
                      className="hover:bg-[#16202E]/70 transition-colors group"
                    >
                      {/* Camera ID */}
                      <td className="py-3.5 px-4 font-mono font-semibold text-[#3AB0FF]">
                        {targetCamId}
                      </td>
                      
                      {/* Name */}
                      <td className="py-3.5 px-4 font-bold text-white tracking-wide">
                        {cam.name}
                      </td>
                      
                      {/* Location */}
                      <td className="py-3.5 px-4 text-slate-300">
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {cam.location}
                        </span>
                      </td>
                      
                      {/* GPS Coordinates */}
                      <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                        {cam.latitude && cam.longitude
                          ? `${cam.latitude}, ${cam.longitude}`
                          : "24.8607, 67.0011"}
                      </td>
                      
                      {/* Status Badge */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 font-bold font-mono px-2.5 py-0.5 rounded-md text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 text-[10px] tracking-wider">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          ONLINE
                        </span>
                      </td>
                      
                      {/* Specs */}
                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        {cam.resolution || "1920x1080"}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        {cam.frameRate || "30"}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        {cam.angle || "45"}°
                      </td>
                      
                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => navigate(`/operator/live-monitoring?camId=${targetCamId}`)}
                            className="px-2.5 py-1 text-[11px] font-bold bg-[#16202E] text-[#3AB0FF] hover:bg-[#3AB0FF] hover:text-[#0C1A2B] border border-slate-700/80 rounded-lg transition-all flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            View
                          </button>
                          <button className="px-2.5 py-1 text-[11px] font-semibold bg-[#16202E] text-slate-300 hover:text-white hover:bg-slate-700/80 border border-slate-700/80 rounded-lg transition-all flex items-center gap-1">
                            <Edit2 className="w-3 h-3" />
                            Edit
                          </button>
                          <button className="px-2.5 py-1 text-[11px] font-semibold bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white border border-rose-500/20 rounded-lg transition-all flex items-center gap-1">
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. SHARED MODAL COMPONENT */}
      <RegisterCameraPage
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={fetchCameras}
      />
    </div>
  );
}
import { useState } from "react";
import { Link } from "react-router-dom";
import AdminCameraApprovals from "./AdminCameraApprovals"; // Adjust path if needed
import RegisterCameraPage from "../RegisterCameraPage";   // Adjust path if needed
import ApprovedCamerasPage from "./ApprovedCamerasPage"; // Adjust path if needed

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("approvals"); // 'approvals' | 'register' | 'active'

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Admin Control Center</h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage system surveillance feeds, review requests, and add new nodes.
            </p>
          </div>

          {/* Tab Selection Buttons */}
          <div className="flex items-center gap-2 bg-slate-200/70 p-1 rounded-lg self-start sm:self-auto">
            <button
              onClick={() => setActiveTab("approvals")}
              className={`px-4 py-2 text-xs font-semibold rounded-md transition-all ${
                activeTab === "approvals"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Camera Approvals
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
            <button
              onClick={() => setActiveTab("active")}
              className={`px-4 py-2 text-xs font-semibold rounded-md transition-all ${
                activeTab === "active"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Live Cameras
            </button>
          </div>
        </div>

        {/* Tab Contents */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          {activeTab === "approvals" && <AdminCameraApprovals />}
          {activeTab === "register" && <RegisterCameraPage />}
          {activeTab === "active" && <ApprovedCamerasPage />}
        </div>

      </div>
    </div>
  );
}
import { useState } from "react";
import { Bell } from "lucide-react";

import AdminCameraApprovals from "./AdminCameraApprovals";
import RegisterCameraPage from "../RegisterCameraPage";
import ApprovedCamerasPage from "./ApprovedCamerasPage";
export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("approvals");

  return (
    <div className="min-h-screen bg-[#F4F7FB] p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* TOP HEADER */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-[#E4EAF2] pb-6">

<div>
  <div className="flex items-center gap-2 mb-2">
    <span className="w-2 h-2 rounded-full bg-[#2E5E99]" />

    <span className="text-[11px] font-bold uppercase tracking-wider text-[#4B617D]">
      Administration
    </span>
  </div>

  <div className="flex items-center gap-4">

    <h1 className="text-2xl md:text-3xl font-bold text-[#0D2440]">
      Admin Control Center
    </h1>

    {/* NOTIFICATION */}
    <button
      className="relative p-2.5 rounded-lg bg-white border border-[#E4EAF2] text-[#4B617D] hover:text-[#0D2440] hover:bg-[#F8FAFD] transition-colors"
      title="Notifications"
    >
      <Bell className="w-4 h-4" />

      <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#2E5E99]" />
    </button>

  </div>

  <p className="text-sm text-[#5F7590] mt-2 max-w-2xl">
    Manage system surveillance feeds, review requests, and add new
    camera nodes.
  </p>
</div>

          {/* TAB SELECTION */}
          <div className="flex items-center gap-1 bg-[#E8EEF6] p-1.5 rounded-xl self-start lg:self-auto border border-[#DCE5F0]">

            <button
              onClick={() => setActiveTab("approvals")}
              className={`px-4 py-2.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "approvals"
                  ? "bg-white text-[#0D2440] shadow-sm border border-[#E4EAF2]"
                  : "text-[#4B617D] hover:text-[#0D2440] hover:bg-white/60"
              }`}
            >
              Camera Approvals
            </button>

            <button
              onClick={() => setActiveTab("register")}
              className={`px-4 py-2.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "register"
                  ? "bg-white text-[#0D2440] shadow-sm border border-[#E4EAF2]"
                  : "text-[#4B617D] hover:text-[#0D2440] hover:bg-white/60"
              }`}
            >
              + Register Camera
            </button>

            <button
              onClick={() => setActiveTab("active")}
              className={`px-4 py-2.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "active"
                  ? "bg-white text-[#0D2440] shadow-sm border border-[#E4EAF2]"
                  : "text-[#4B617D] hover:text-[#0D2440] hover:bg-white/60"
              }`}
            >
              Live Cameras
            </button>

          </div>
        </div>

        {/* TAB CONTENT */}
        <div className="bg-white rounded-2xl border border-[#E4EAF2] shadow-[0_2px_10px_rgba(13,36,64,0.04)] p-6 md:p-8">

          {activeTab === "approvals" && <AdminCameraApprovals />}

          {activeTab === "register" && <RegisterCameraPage />}

          {activeTab === "active" && <ApprovedCamerasPage />}

        </div>

      </div>
    </div>
  );
}
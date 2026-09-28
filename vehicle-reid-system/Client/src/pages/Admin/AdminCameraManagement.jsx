import { useState } from "react";
import { Video, Camera, Radio, Plus, ChevronRight } from "lucide-react";

import AdminCameraApprovals from "./AdminCameraApprovals";
import RegisterCameraPage from "../RegisterCameraPage";
import ApprovedCamerasPage from "./ApprovedCamerasPage";

// Sapphire Veil palette
const MIST = "#E7F0FA";
const STEEL = "#7BA4D0";
const SAPPHIRE = "#2E5E99";
const INK = "#0D2440";

const TABS = [
  { key: "approvals", label: "Camera Approvals", icon: Camera },
  { key: "register", label: "Register Camera", icon: Plus },
  { key: "active", label: "Live Cameras", icon: Radio },
];

export default function AdminCameraManagement() {
  const [activeTab, setActiveTab] = useState("approvals");

  return (
    <div className="min-h-screen p-6 md:p-10" style={{ backgroundColor: MIST }}>
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* PAGE HEADER */}
        <div>




          <p className="text-sm md:text-base mt-3 max-w-2xl leading-relaxed" style={{ color: SAPPHIRE }}>
            Review incoming camera requests, register new nodes, and monitor every
            approved feed across the surveillance network.
          </p>
        </div>

        {/* TABBED PANEL */}
        <div
          className="bg-white rounded-3xl border overflow-hidden transition-all duration-300"
          style={{
            borderColor: "#D4E2F0",
            boxShadow: "0 10px 40px rgba(13,36,64,0.06)",
          }}
        >
          {/* TAB NAVIGATION */}
          <div
            className="flex items-center gap-2 md:gap-4 px-4 md:px-8 pt-4 border-b overflow-x-auto"
            style={{ borderColor: MIST }}
          >
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative flex items-center gap-2 px-4 py-3.5 text-sm font-semibold transition-all duration-200 rounded-t-xl whitespace-nowrap ${
                    isActive ? "bg-white" : "hover:bg-[#F8FAFD]"
                  }`}
                  style={{
                    color: isActive ? INK : STEEL,
                  }}
                >
                  <Icon
                    className="w-4 h-4 transition-colors"
                    style={{ color: isActive ? SAPPHIRE : STEEL }}
                  />
                  {tab.label}
                  <span
                    className="absolute left-4 right-4 -bottom-[1px] h-[3px] rounded-full transition-all duration-300"
                    style={{
                      backgroundColor: SAPPHIRE,
                      opacity: isActive ? 1 : 0,
                      transform: isActive ? "scaleX(1)" : "scaleX(0.5)",
                    }}
                  />
                </button>
              );
            })}
          </div>

          {/* TAB CONTENT */}
          <div className="p-6 md:p-8 animate-in fade-in duration-300">
            {activeTab === "approvals" && <AdminCameraApprovals />}
            {activeTab === "active" && <ApprovedCamerasPage />}
          </div>

          {/* RegisterCameraPage is a modal (it returns null unless isOpen),
              so the "Register Camera" tab opens it as an overlay rather
              than rendering it inline like the other two tabs. */}
          <RegisterCameraPage
            isOpen={activeTab === "register"}
            onClose={() => setActiveTab("approvals")}
            onSuccess={() => setActiveTab("active")}
          />
        </div>
      </div>
    </div>
  );
}
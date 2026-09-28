import { useState } from "react";
import { ClipboardList, Plus } from "lucide-react";

import OperatorCameraRequests from "./OperatorCameraRequests";
import RegisterCameraPage from "../RegisterCameraPage";

const MIST = "#E7F0FA";
const STEEL = "#7BA4D0";
const SAPPHIRE = "#2E5E99";
const INK = "#0D2440";

const TABS = [
  { key: "requests", label: "My Requests", icon: ClipboardList },
  { key: "register", label: "Register Camera", icon: Plus },
];

export default function OperatorCameraManagement() {
  const [activeTab, setActiveTab] = useState("requests");

  return (
    <div className="min-h-screen p-6 md:p-10" style={{ backgroundColor: MIST }}>
      <div className="max-w-7xl mx-auto space-y-8">
        <p className="text-sm md:text-base max-w-2xl leading-relaxed" style={{ color: SAPPHIRE }}>
          Submit new cameras for admin approval and track the status of your requests.
        </p>

        <div
          className="bg-white rounded-3xl border overflow-hidden"
          style={{ borderColor: "#D4E2F0", boxShadow: "0 10px 40px rgba(13,36,64,0.06)" }}
        >
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
                  className={`relative flex items-center gap-2 px-4 py-3.5 text-sm font-semibold transition-all rounded-t-xl whitespace-nowrap ${
                    isActive ? "bg-white" : "hover:bg-[#F8FAFD]"
                  }`}
                  style={{ color: isActive ? INK : STEEL }}
                >
                  <Icon className="w-4 h-4" style={{ color: isActive ? SAPPHIRE : STEEL }} />
                  {tab.label}
                  <span
                    className="absolute left-4 right-4 -bottom-[1px] h-[3px] rounded-full transition-all"
                    style={{ backgroundColor: SAPPHIRE, opacity: isActive ? 1 : 0 }}
                  />
                </button>
              );
            })}
          </div>

          <div className="p-6 md:p-8">
            <OperatorCameraRequests />
          </div>

          <RegisterCameraPage
            isOpen={activeTab === "register"}
            onClose={() => setActiveTab("requests")}
            onSuccess={() => setActiveTab("requests")}
          />
        </div>
      </div>
    </div>
  );
}
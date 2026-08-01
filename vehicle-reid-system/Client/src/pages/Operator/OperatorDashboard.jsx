import React from "react";
import { Link } from "react-router-dom";
import {
  Video,
  Car,
  Scan,
  Bell,
  Flame,
  FileSearch,
  MapPin,
  BarChart2,
  RefreshCcw,
} from "lucide-react";

export default function OperatorDashboard() {
  const stats = [
    { label: "Active Cameras", value: "12", sub: "2 offline", alert: false, border: "border-l-[#0D2440]", iconBg: "bg-[#0D2440]", icon: <Video className="w-4 h-4 stroke-white stroke-2 fill-none" /> },
    { label: "Vehicles Detected", value: "2,847", sub: "Today", alert: false, border: "border-l-[#2E5E99]", iconBg: "bg-[#2E5E99]", icon: <Car className="w-4 h-4 stroke-white stroke-2 fill-none" /> },
    { label: "Vehicles Re-ID", value: "341", sub: "99.3% accuracy", alert: false, border: "border-l-[#7BA4D0]", iconBg: "bg-[#7BA4D0]", icon: <Scan className="w-4 h-4 stroke-white stroke-2 fill-none" /> },
    { label: "Active Alerts", value: "7", sub: "5 critical", alert: "critical", border: "border-l-[#B25C50]", iconBg: "bg-[#0D2440]", icon: <Bell className="w-4 h-4 stroke-white stroke-2 fill-none" /> },
    { label: "Congestion Events", value: "4", sub: "2 ongoing", alert: "warning", border: "border-l-[#2E5E99]", iconBg: "bg-[#2E5E99]", icon: <Flame className="w-4 h-4 stroke-white stroke-2 fill-none" /> },
    { label: "Investigations", value: "18", sub: "5 active", alert: false, border: "border-l-[#0D2440]", iconBg: "bg-[#0D2440]", icon: <FileSearch className="w-4 h-4 stroke-white stroke-2 fill-none" /> },
  ];

  const sightings = [
    { id: "VH-8821", type: "Sedan", color: "White", swatch: "#F4F6F8", plate: "KHI-2847", camera: "CAM-001", timestamp: "14:32:18", confidence: "97.2%", confClass: "text-[#3E9A78] bg-[#EAF6F1]" },
    { id: "VH-8820", type: "SUV", color: "Black", swatch: "#0D2440", plate: "LHR-1193", camera: "CAM-003", timestamp: "14:31:44", confidence: "91.8%", confClass: "text-[#3E9A78] bg-[#EAF6F1]" },
    { id: "VH-8819", type: "Pickup", color: "Silver", swatch: "#B9C2CC", plate: "Not detected", camera: "CAM-005", timestamp: "14:30:57", confidence: "86.4%", confClass: "text-[#C58A3C] bg-[#FBF3E7]" },
    { id: "VH-8818", type: "Motorcycle", color: "Red", swatch: "#B25C50", plate: "KHI-9034", camera: "CAM-002", timestamp: "14:30:22", confidence: "94.1%", confClass: "text-[#3E9A78] bg-[#EAF6F1]" },
    { id: "VH-8817", type: "Bus", color: "Yellow", swatch: "#C58A3C", plate: "Not detected", camera: "CAM-006", timestamp: "14:29:45", confidence: "70.3%", confClass: "text-[#C58A3C] bg-[#FBF3E7]" },
  ];

  const nodes = [
    { top: "30%", left: "38%", label: "CAM-001", alert: false },
    { top: "62%", left: "28%", label: "CAM-002", alert: false },
    { top: "70%", left: "66%", label: "CAM-003", alert: false },
    { top: "24%", left: "70%", label: "CAM-004", alert: true },
  ];

  const bars = [22, 31, 28, 44, 52, 68, 88, 74, 58, 63, 41, 30];
  const peak = Math.max(...bars);

  return (
    <div className="flex flex-col gap-4">
      {/* STATS GRID */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`bg-white border border-[#E4EAF2] border-l-4 ${s.border} rounded-xl p-3.5 shadow-sm flex flex-col justify-between`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.iconBg}`}>
                {s.icon}
              </div>
              <span className="font-mono text-[8.5px] tracking-widest text-[#2E5E99] border border-[#7BA4D0] px-1.5 py-0.5 rounded bg-[#E7F0FA] font-bold">
                LIVE
              </span>
            </div>
            <div>
              <div className="text-[10.5px] text-[#4B617D] tracking-wider uppercase font-bold mb-1">
                {s.label}
              </div>
              <div className="font-display text-2xl font-bold text-[#0D2440] tracking-tight">
                {s.value}
              </div>
              <div
                className={`text-[10.5px] mt-1 font-mono font-medium ${
                  s.alert === "critical"
                    ? "text-[#B25C50] font-bold"
                    : s.alert === "warning"
                    ? "text-[#C58A3C] font-bold"
                    : "text-[#93A2B8]"
                }`}
              >
                {s.sub}
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* PANELS ROW */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-3.5 items-stretch">
        
        {/* RADAR MAP PANEL */}
        <div className="bg-white border border-[#E4EAF2] rounded-xl flex flex-col overflow-hidden shadow-sm">
          <div className="flex items-start justify-between p-4 border-b border-[#EEF2F8]">
            <div>
              <div className="font-display text-sm font-semibold text-[#0D2440] flex items-center gap-2">
                <MapPin className="w-4 h-4 stroke-[#2E5E99] stroke-[1.8] fill-none" />
                Live City Map — Camera Traffic Network
              </div>
              <div className="text-xs text-[#93A2B8] mt-0.5">
                Real-time camera node positions &amp; movement
              </div>
            </div>
            <div className="flex gap-3 items-center pt-0.5">
              <div className="flex items-center gap-1.5 text-[10px] text-[#93A2B8] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2E5E99]" />
                Online
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-[#93A2B8] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-[#93A2B8]" />
                Offline
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-[#93A2B8] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-[#B25C50]" />
                Alert
              </div>
            </div>
          </div>

          <div className="relative flex-1 min-h-[250px] bg-[radial-gradient(circle_at_50%_50%,rgba(46,94,153,0.05),transparent_70%)] [background-size:34px_34px] bg-[linear-gradient(to_right,#EEF2F8_1px,transparent_1px),linear-gradient(to_bottom,#EEF2F8_1px,transparent_1px)] flex items-center justify-center overflow-hidden">
            <div className="relative w-[220px] h-[220px]">
              <div className="absolute inset-0 border border-[#E4EAF2] rounded-full" />
              <div className="absolute inset-[30px] border border-[#E4EAF2] rounded-full" />
              <div className="absolute inset-[60px] border border-[#E4EAF2] rounded-full" />
              <div className="absolute inset-[90px] border border-[#7BA4D0] rounded-full" />
              
              {/* Radar Grid Lines */}
              <div className="absolute inset-0">
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[#E4EAF2]" />
                <div className="absolute top-1/2 left-0 right-0 h-px bg-[#E4EAF2]" />
              </div>

              {/* Sweep Animation */}
              <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,rgba(46,94,153,0.16),transparent_30%)] animate-spin [animation-duration:4s]" />

              {/* Camera Nodes */}
              {nodes.map((n) => (
                <div
                  key={n.label}
                  className={`absolute w-2.5 h-2.5 rounded-full border-2 border-white -translate-x-1/2 -translate-y-1/2 ${
                    n.alert
                      ? "bg-[#B25C50] shadow-[0_0_0_1px_#B25C50]"
                      : "bg-[#2E5E99] shadow-[0_0_0_1px_#2E5E99]"
                  }`}
                  style={{ top: n.top, left: n.left }}
                >
                  <span className="absolute top-3 left-1/2 -translate-x-1/2 font-mono text-[8.5px] text-[#93A2B8] whitespace-nowrap">
                    {n.label}
                  </span>
                </div>
              ))}
            </div>
            <div className="absolute bottom-3 left-3.5 font-mono text-[9px] text-[#93A2B8] tracking-wider">
              INTERACTIVE TOPOLOGY NETWORK ACTIVE
            </div>
          </div>
        </div>

        {/* BAR CHART PANEL */}
        <div className="bg-white border border-[#E4EAF2] rounded-xl flex flex-col overflow-hidden shadow-sm">
          <div className="flex items-start justify-between p-4 border-b border-[#EEF2F8]">
            <div>
              <div className="font-display text-sm font-semibold text-[#0D2440] flex items-center gap-2">
                <BarChart2 className="w-4 h-4 stroke-[#2E5E99] stroke-[1.8] fill-none" />
                Vehicle Detections — Today
              </div>
              <div className="text-xs text-[#93A2B8] mt-0.5">
                Hourly count across all online cameras
              </div>
            </div>
          </div>
          
          <div className="flex-1 flex items-end gap-1.5 p-4 pt-5 min-h-[250px]">
            {bars.map((h, idx) => (
              <div
                key={idx}
                className={`flex-1 rounded-t transition-all ${
                  h === peak
                    ? "bg-gradient-to-b from-[#7BA4D0] to-[#E7F0FA]"
                    : "bg-gradient-to-b from-[#2E5E99] to-[#E7F0FA]"
                }`}
                style={{ height: `${h}%` }}
              />
            ))}
          </div>

          <div className="flex justify-between px-4 pb-3.5 font-mono text-[8.5px] text-[#93A2B8]">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>NOW</span>
          </div>
        </div>
      </section>

      {/* TABLE PANEL */}
      <section className="bg-white border border-[#E4EAF2] rounded-xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between p-4 border-b border-[#EEF2F8]">
          <div>
            <div className="font-display text-sm font-semibold text-[#0D2440]">
              Recent Vehicle Sightings
            </div>
            <div className="text-xs text-[#93A2B8] mt-0.5">
              Live detection feed across surveillance cameras
            </div>
          </div>
          <Link
            to="/operator/reid-review"
            className="flex items-center gap-1.5 bg-[#0D2440] hover:bg-[#2E5E99] text-white rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors no-underline"
          >
            <RefreshCcw className="w-3.5 h-3.5 stroke-white stroke-2 fill-none" />
            Run Re-ID Search
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAFCFE] border-b border-[#E4EAF2]">
                <th className="font-mono text-[9.5px] tracking-wider text-[#93A2B8] uppercase font-medium px-4 py-3">Vehicle ID</th>
                <th className="font-mono text-[9.5px] tracking-wider text-[#93A2B8] uppercase font-medium px-4 py-3">Type</th>
                <th className="font-mono text-[9.5px] tracking-wider text-[#93A2B8] uppercase font-medium px-4 py-3">Color</th>
                <th className="font-mono text-[9.5px] tracking-wider text-[#93A2B8] uppercase font-medium px-4 py-3">License Plate</th>
                <th className="font-mono text-[9.5px] tracking-wider text-[#93A2B8] uppercase font-medium px-4 py-3">Camera</th>
                <th className="font-mono text-[9.5px] tracking-wider text-[#93A2B8] uppercase font-medium px-4 py-3">Timestamp</th>
                <th className="font-mono text-[9.5px] tracking-wider text-[#93A2B8] uppercase font-medium px-4 py-3">Re-ID Conf.</th>
                <th className="font-mono text-[9.5px] tracking-wider text-[#93A2B8] uppercase font-medium px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F8] text-xs text-[#4B617D]">
              {sightings.map((row) => (
                <tr key={row.id} className="hover:bg-[#FAFCFE] transition-colors">
                  <td className="font-mono text-[#0D2440] font-semibold px-4 py-3">{row.id}</td>
                  <td className="px-4 py-3">{row.type}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full border border-[#E4EAF2]" style={{ backgroundColor: row.swatch }} />
                      {row.color}
                    </span>
                  </td>
                  <td className={`font-mono px-4 py-3 ${row.plate === "Not detected" ? "text-[#93A2B8] italic" : ""}`}>
                    {row.plate}
                  </td>
                  <td className="font-mono text-[11.5px] text-[#2E5E99] font-medium px-4 py-3">{row.camera}</td>
                  <td className="font-mono text-[#93A2B8] px-4 py-3">{row.timestamp}</td>
                  <td className="px-4 py-3">
                    <span className={`font-mono font-semibold text-[11.5px] px-2 py-0.5 rounded ${row.confClass}`}>
                      {row.confidence}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[#2E5E99] text-xs font-semibold cursor-pointer hover:underline">
                      View
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
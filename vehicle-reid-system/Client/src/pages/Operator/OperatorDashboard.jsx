import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import {
  Video,
  Car,
  Scan,
  Bell,
  MapPin,
  BarChart2,
} from "lucide-react";

export default function OperatorDashboard() {
  const stats = [
    { label: "Active Cameras", value: "12", border: "border-l-[#0D2440]", iconBg: "bg-[#0D2440]", icon: <Video className="w-4 h-4 stroke-white stroke-2 fill-none" /> },
    { label: "Vehicles Detected", value: "45", border: "border-l-[#2E5E99]", iconBg: "bg-[#2E5E99]", icon: <Car className="w-4 h-4 stroke-white stroke-2 fill-none" /> },
    { label: "Vehicles Re-ID", value: "20", border: "border-l-[#7BA4D0]", iconBg: "bg-[#7BA4D0]", icon: <Scan className="w-4 h-4 stroke-white stroke-2 fill-none" /> },
    { label: "Active Alerts", value: "7", border: "border-l-[#B25C50]", iconBg: "bg-[#0D2440]", icon: <Bell className="w-4 h-4 stroke-white stroke-2 fill-none" /> },
  ];

  const sightings = [
    { id: "VH-8821", type: "Sedan", color: "White", swatch: "#F4F6F8", plate: "KHI-2847", camera: "CAM-001", timestamp: "14:32:18", confidence: "97.2%", confClass: "text-[#3E9A78] bg-[#EAF6F1]" },
    { id: "VH-8820", type: "SUV", color: "Black", swatch: "#0D2440", plate: "LHR-1193", camera: "CAM-003", timestamp: "14:31:44", confidence: "91.8%", confClass: "text-[#3E9A78] bg-[#EAF6F1]" },
    { id: "VH-8819", type: "Pickup", color: "Silver", swatch: "#B9C2CC", plate: "Not detected", camera: "CAM-005", timestamp: "14:30:57", confidence: "86.4%", confClass: "text-[#C58A3C] bg-[#FBF3E7]" },
    { id: "VH-8818", type: "Motorcycle", color: "Red", swatch: "#B25C50", plate: "KHI-9034", camera: "CAM-002", timestamp: "14:30:22", confidence: "94.1%", confClass: "text-[#3E9A78] bg-[#EAF6F1]" },
    { id: "VH-8817", type: "Bus", color: "Yellow", swatch: "#C58A3C", plate: "Not detected", camera: "CAM-006", timestamp: "14:29:45", confidence: "70.3%", confClass: "text-[#C58A3C] bg-[#FBF3E7]" },
  ];

  const bars = [45, 62, 58, 71, 84, 96, 67]; // Mon–Sun vehicle counts
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const peak = Math.max(...bars);

  const reidConfidence = [
    { name: "High Confidence", value: 62, count: 211, color: "#0c4d9e" },
    { name: "Possible Match", value: 27, count: 92, color: "#4d83be" },
    { name: "Unlikely", value: 11, count: 38, color: "#3a7698" },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* STATS GRID */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`bg-white border border-[#E4EAF2] border-l-4 ${s.border} rounded-xl p-3.5 shadow-sm flex flex-col justify-between`}
          >
            <div className="mb-4">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.iconBg}`}>
                {s.icon}
              </div>
            </div>
            <div>
              <div className="text-[10.5px] text-[#4B617D] tracking-wider uppercase font-bold mb-1">
                {s.label}
              </div>
              <div className="font-display text-2xl font-bold text-[#0D2440] tracking-tight">
                {s.value}
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* CHARTS ROW */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-3.5 items-stretch">
        {/* VEHICLE DETECTIONS BAR CHART */}
        <div className="bg-white border border-[#E4EAF2] rounded-xl flex flex-col overflow-hidden shadow-sm">
          <div className="flex items-start justify-between p-4 border-b border-[#EEF2F8]">
            <div>
              <div className="font-display text-sm font-semibold text-[#0D2440] flex items-center gap-2">
                <BarChart2 className="w-4 h-4 stroke-[#2E5E99] stroke-[1.8] fill-none" />
                Vehicle Detections — Daily
              </div>
              <div className="text-xs text-[#93A2B8] mt-0.5">
                Day wise count across all online cameras
              </div>
            </div>
          </div>

          <div className="flex items-end gap-1.5 p-4 pt-5 min-h-[220px]">
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

        {/* RE-ID CONFIDENCE DONUT CHART */}
        <div className="bg-white border border-[#E4EAF2] rounded-xl flex flex-col overflow-hidden shadow-sm">
          <div className="p-4 border-b border-[#EEF2F8]">
            <div className="font-display text-sm font-semibold text-[#0D2440] flex items-center gap-2">
              <Scan className="w-4 h-4 stroke-[#2E5E99] stroke-[1.8] fill-none" />
              Re-ID Confidence Distribution
            </div>
            <div className="text-xs text-[#93A2B8] mt-0.5">
              Match confidence across all Re-ID results
            </div>
          </div>

          <div className="flex items-center gap-6 p-5 flex-1">
            <div className="w-[150px] h-[150px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={reidConfidence}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={48}
                    outerRadius={74}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {reidConfidence.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-col gap-3">
              {reidConfidence.map((entry) => (
                <div key={entry.name} className="flex items-start gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full mt-1 shrink-0"
                    style={{ backgroundColor: entry.color }}
                  />
                  <div>
                    <div className="text-[12px] font-medium text-[#4B617D]">
                      {entry.name}
                    </div>
                    <div className="text-[13px] font-bold text-[#0D2440]">
                      {entry.value}% <span className="text-[#93A2B8] font-normal text-[11px]">({entry.count})</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* TABLE PANEL */}
      <section className="bg-white border border-[#E4EAF2] rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-[#EEF2F8]">
          <div className="font-display text-sm font-semibold text-[#0D2440]">
            Recent Vehicle Sightings
          </div>
          <div className="text-xs text-[#93A2B8] mt-0.5">
            Detected and re-identified vehicles across surveillance cameras
          </div>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
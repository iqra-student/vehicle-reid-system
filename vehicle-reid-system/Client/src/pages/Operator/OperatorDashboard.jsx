import React from "react";
import {
  Video,
  Eye,
  Activity,
  AlertTriangle,
  Flame,
  FileSearch,
  Search,
  MapPin,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router-dom";

export default function OperatorDashboard() {
  // Mock Recent Sightings matching the Figma table
  const sightings = [
    {
      id: "VH-8821",
      type: "Sedan",
      color: "White",
      plate: "KHI-2847",
      camera: "CAM-001",
      timestamp: "14:32:18",
      confidence: "97.2%",
      status: "Confirmed",
    },
    {
      id: "VH-8820",
      type: "SUV",
      color: "Black",
      plate: "LWR-1193",
      camera: "CAM-003",
      timestamp: "14:31:44",
      confidence: "91.8%",
      status: "Reviewing",
    },
    {
      id: "VH-8819",
      type: "Pickup",
      color: "Silver",
      plate: "Not detected",
      camera: "CAM-005",
      timestamp: "14:30:57",
      confidence: "86.4%",
      status: "Low Conf.",
    },
    {
      id: "VH-8818",
      type: "Motorcycle",
      color: "Red",
      plate: "KHI-9034",
      camera: "CAM-002",
      timestamp: "14:30:22",
      confidence: "94.1%",
      status: "Confirmed",
    },
    {
      id: "VH-8817",
      type: "Bus",
      color: "Yellow",
      plate: "Not detected",
      camera: "CAM-006",
      timestamp: "14:29:45",
      confidence: "79.3%",
      status: "Low Conf.",
    },
  ];

  return (
    <div className="space-y-6 text-slate-800">
      {/* 1. TOP STATS BAR (Dark Navy / Cyan Accents) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Active Cameras", val: "12", sub: "2 offline", icon: Video },
          { label: "Vehicles Detected", val: "2,847", sub: "Today", icon: Eye },
          { label: "Vehicles Re-ID", val: "341", sub: "89.3% accuracy", icon: Activity },
          { label: "Active Alerts", val: "7", sub: "3 critical", icon: AlertTriangle, alert: true },
          { label: "Congestion Events", val: "4", sub: "2 ongoing", icon: Flame },
          { label: "Investigations", val: "18", sub: "5 active", icon: FileSearch },
        ].map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={idx}
              className="bg-[#16202E] p-3.5 rounded-xl border border-slate-700/60 shadow-md text-white flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-medium">{stat.label}</span>
                <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                  LIVE
                </span>
              </div>
              <div className="my-1.5 flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono">{stat.val}</span>
                <Icon className={`w-4 h-4 ${stat.alert ? "text-rose-400" : "text-[#3AB0FF]"}`} />
              </div>
              <span className="text-[10px] text-slate-400">{stat.sub}</span>
            </div>
          );
        })}
      </div>

      {/* 2. MAP & DETECTIONS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Live City Map Canvas (Karachi Traffic Network Node Representation) */}
        <div className="lg:col-span-8 bg-[#16202E] p-5 rounded-2xl border border-slate-700/60 shadow-lg text-white space-y-3">
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
            <div>
              <h2 className="text-sm font-bold flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#3AB0FF]" />
                Live City Map — Camera Traffic Network
              </h2>
              <p className="text-[11px] text-slate-400">Real-time camera node positions & movement</p>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Online</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400" /> Offline</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Alert</span>
            </div>
          </div>

          {/* Node Connection Canvas */}
          <div className="h-56 bg-[#0D131D] rounded-xl border border-slate-800 flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />
            <div className="relative z-10 text-center">
              <span className="text-xs text-slate-400 font-mono">[ Interactive Topology Network Active ]</span>
              <div className="mt-3 flex items-center justify-center gap-8">
                {["CAM-001", "CAM-002", "CAM-003", "CAM-004"].map((node, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div className="w-4 h-4 rounded-full bg-[#3AB0FF] ring-4 ring-[#3AB0FF]/20 animate-pulse" />
                    <span className="text-[10px] font-mono text-slate-300">{node}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Hourly Detection Chart Placeholder */}
        <div className="lg:col-span-4 bg-[#16202E] p-5 rounded-2xl border border-slate-700/60 shadow-lg text-white flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#3AB0FF]" />
              Vehicle Detections — Today
            </h2>
          </div>
          <div className="h-48 flex items-end justify-between gap-2 px-2 pt-4">
            {[40, 65, 30, 85, 95, 70, 50].map((h, idx) => (
              <div key={idx} className="w-full bg-slate-800 rounded-t-md relative group">
                <div
                  className="bg-[#3AB0FF] rounded-t-md hover:bg-[#00E5FF] transition-all"
                  style={{ height: `${h}%` }}
                />
              </div>
            ))}
          </div>
          <p className="text-[10px] text-center text-slate-400 pt-2 border-t border-slate-800">
            Hourly count across all online cameras
          </p>
        </div>
      </div>

      {/* 3. RECENT VEHICLE SIGHTINGS TABLE (White Card) */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Recent Vehicle Sightings</h2>
            <p className="text-xs text-slate-500">Live detection feed across surveillance cameras</p>
          </div>
          <Link
            to="/operator/reid-review"
            className="bg-[#16202E] hover:bg-[#0D131D] text-[#3AB0FF] text-xs font-bold px-3 py-2 rounded-xl border border-slate-700 transition-all flex items-center gap-1.5"
          >
            <Search className="w-3.5 h-3.5" />
            Run Re-ID Search
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="pb-3">Vehicle ID</th>
                <th className="pb-3">Type</th>
                <th className="pb-3">Color</th>
                <th className="pb-3">License Plate</th>
                <th className="pb-3">Camera</th>
                <th className="pb-3">Timestamp</th>
                <th className="pb-3">Re-ID Conf.</th>
                <th className="pb-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {sightings.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 font-mono font-bold text-[#16202E]">{row.id}</td>
                  <td className="py-3">{row.type}</td>
                  <td className="py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full border border-slate-300 bg-slate-200" />
                      {row.color}
                    </span>
                  </td>
                  <td className="py-3 font-mono text-slate-900">{row.plate}</td>
                  <td className="py-3 font-mono text-slate-500">{row.camera}</td>
                  <td className="py-3 font-mono text-slate-500">{row.timestamp}</td>
                  <td className="py-3">
                    <span className="font-mono text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {row.confidence}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <button className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
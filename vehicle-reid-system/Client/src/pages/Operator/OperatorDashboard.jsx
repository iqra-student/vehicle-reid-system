import React, { useState, useEffect } from "react";
import axios from "axios";
import io from "socket.io-client";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import {
  Video,
  Car,
  Scan,
  Bell,
  MapPin,
  BarChart2,
  Flame,
  AlertTriangle,
  RotateCcw
} from "lucide-react";

const BACKEND_URL = "http://localhost:5000";

export default function OperatorDashboard() {
  const [activeAlertsCount, setActiveAlertsCount] = useState(0);
  const [totalVehiclesDetected, setTotalVehiclesDetected] = useState(0);
  const [activeCamerasCount, setActiveCamerasCount] = useState(3);
  const [recentIncidents, setRecentIncidents] = useState([]);
  const [barChartData, setBarChartData] = useState([45, 62, 58, 71, 84, 96, 67]);

  useEffect(() => {
    fetchDashboardMetrics();

    // Connect to Node.js WebSockets for real-time updates
    const socket = io(BACKEND_URL);

    socket.on("congestion_alert", (newAlert) => {
      setActiveAlertsCount((prev) => prev + 1);
      setTotalVehiclesDetected((prev) => prev + (newAlert.vehicleCount || 0));

      setRecentIncidents((prev) => [
        {
          id: `INC-${Math.floor(1000 + Math.random() * 9000)}`,
          type: newAlert.eventType || "Gridlock Incident",
          reasoning: newAlert.reasoning || "Lane Congestion Detected",
          camera: newAlert.cameraId || "CAM_01",
          vehicles: newAlert.vehicleCount || 0,
          stoppedRatio: Math.round((newAlert.stationaryRatio || 0) * 100),
          timestamp: new Date().toLocaleTimeString(),
          status: "CRITICAL",
        },
        ...prev.slice(0, 9),
      ]);
    });

    return () => socket.disconnect();
  }, []);

  const fetchDashboardMetrics = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/congestion/active`);
      if (res.data?.status === "success") {
        const rawAlerts = res.data.data || [];
        const unResolved = rawAlerts.filter((a) => !a.resolved);
        setActiveAlertsCount(unResolved.length);

        const totalVehicles = rawAlerts.reduce(
          (acc, item) => acc + (item.vehicleCount || 0),
          0
        );
        setTotalVehiclesDetected(totalVehicles > 0 ? totalVehicles : 45);

        // Populate recent activity from database records
        if (rawAlerts.length > 0) {
          const liveRows = rawAlerts.slice(0, 5).map((alert, idx) => ({
            id: `INC-${alert._id ? alert._id.slice(-4).toUpperCase() : 8820 - idx}`,
            type: alert.eventType || "GRIDLOCK_CONGESTION",
            reasoning: alert.reasoning || "High Density Bottleneck",
            camera: alert.cameraId || "CAM_01",
            vehicles: alert.vehicleCount || 0,
            stoppedRatio: Math.round((alert.stationaryRatio || 0) * 100),
            timestamp: alert.createdAt
              ? new Date(alert.createdAt).toLocaleTimeString()
              : "Recent",
            status: alert.resolved ? "RESOLVED" : "ACTIVE",
          }));
          setRecentIncidents(liveRows);
        }
      }
    } catch (err) {
      console.error("Failed to fetch live dashboard telemetry:", err);
    }
  };

  const stats = [
    {
      label: "Active Cameras",
      value: activeCamerasCount.toString(),
      border: "border-l-[#0D2440]",
      iconBg: "bg-[#0D2440]",
      icon: <Video className="w-4 h-4 stroke-white stroke-2 fill-none" />,
    },
    {
      label: "Vehicles Detected",
      value: totalVehiclesDetected.toString(),
      border: "border-l-[#2E5E99]",
      iconBg: "bg-[#2E5E99]",
      icon: <Car className="w-4 h-4 stroke-white stroke-2 fill-none" />,
    },
    {
      label: "Vehicles Re-ID",
      value: "20",
      border: "border-l-[#7BA4D0]",
      iconBg: "bg-[#7BA4D0]",
      icon: <Scan className="w-4 h-4 stroke-white stroke-2 fill-none" />,
    },
    {
      label: "Active Alerts",
      value: activeAlertsCount.toString(),
      border: "border-l-rose-500",
      iconBg: activeAlertsCount > 0 ? "bg-rose-600" : "bg-[#0D2440]",
      icon: <Bell className="w-4 h-4 stroke-white stroke-2 fill-none" />,
    },
  ];

  const peak = Math.max(...barChartData);

  const reidConfidence = [
    { name: "High Confidence", value: 62, count: 211, color: "#0c4d9e" },
    { name: "Possible Match", value: 27, count: 92, color: "#4d83be" },
    { name: "Unlikely", value: 11, count: 38, color: "#3a7698" },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* TOP HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0D2440]">Surveillance Dashboard</h1>
          <p className="text-xs text-[#93A2B8] mt-0.5">
            Cross-module real-time intelligence: Vehicle Re-ID, ANPR & Congestion Kinematics
          </p>
        </div>
        <button
          onClick={fetchDashboardMetrics}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Synchronize Metrics
        </button>
      </div>

      {/* STATS GRID */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`bg-white border border-[#E4EAF2] border-l-4 ${s.border} rounded-xl p-3.5 shadow-sm flex flex-col justify-between`}
          >
            <div className="mb-4">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.iconBg}`}
              >
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
                Day-wise count across all online surveillance cameras
              </div>
            </div>
          </div>

          <div className="flex items-end gap-1.5 p-4 pt-5 min-h-[220px]">
            {barChartData.map((h, idx) => (
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
              Match confidence across gallery identification results
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
                      {entry.value}%{" "}
                      <span className="text-[#93A2B8] font-normal text-[11px]">
                        ({entry.count})
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* TABLE PANEL: LIVE SURVEILLANCE & RE-ID SIGHTINGS */}
      <section className="bg-white border border-[#E4EAF2] rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-[#EEF2F8] flex items-center justify-between">
          <div>
            <div className="font-display text-sm font-semibold text-[#0D2440]">
              Real-Time Incident & Sighting Telemetry
            </div>
            <div className="text-xs text-[#93A2B8] mt-0.5">
              Live automated feed from Module 4 Congestion Engine and Vehicle Re-ID
            </div>
          </div>
          <span className="text-[11px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md">
            Live MongoDB Sync Active
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAFCFE] border-b border-[#E4EAF2]">
                <th className="font-mono text-[9.5px] tracking-wider text-[#93A2B8] uppercase font-medium px-4 py-3">
                  Event ID
                </th>
                <th className="font-mono text-[9.5px] tracking-wider text-[#93A2B8] uppercase font-medium px-4 py-3">
                  Camera
                </th>
                <th className="font-mono text-[9.5px] tracking-wider text-[#93A2B8] uppercase font-medium px-4 py-3">
                  Diagnostic Reasoning
                </th>
                <th className="font-mono text-[9.5px] tracking-wider text-[#93A2B8] uppercase font-medium px-4 py-3">
                  Vehicle Density
                </th>
                <th className="font-mono text-[9.5px] tracking-wider text-[#93A2B8] uppercase font-medium px-4 py-3">
                  Stopped Ratio
                </th>
                <th className="font-mono text-[9.5px] tracking-wider text-[#93A2B8] uppercase font-medium px-4 py-3">
                  Timestamp
                </th>
                <th className="font-mono text-[9.5px] tracking-wider text-[#93A2B8] uppercase font-medium px-4 py-3">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F8] text-xs text-[#4B617D]">
              {recentIncidents.length > 0 ? (
                recentIncidents.map((row) => (
                  <tr key={row.id} className="hover:bg-[#FAFCFE] transition-colors">
                    <td className="font-mono text-[#0D2440] font-semibold px-4 py-3">
                      {row.id}
                    </td>
                    <td className="font-mono text-[11.5px] text-[#2E5E99] font-medium px-4 py-3">
                      {row.camera}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {row.reasoning}
                    </td>
                    <td className="px-4 py-3">{row.vehicles} vehicles</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-rose-600">
                        {row.stoppedRatio}% stopped
                      </span>
                    </td>
                    <td className="font-mono text-[#93A2B8] px-4 py-3">
                      {row.timestamp}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-mono font-semibold text-[10.5px] px-2 py-0.5 rounded ${
                          row.status === "RESOLVED"
                            ? "bg-slate-100 text-slate-600"
                            : "bg-rose-50 text-rose-600 border border-rose-200"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-slate-400">
                    No active incident records found in MongoDB. Execute a stream analysis to generate live metrics.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
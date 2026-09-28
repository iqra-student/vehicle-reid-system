// import React, { useState, useEffect } from "react";
// import axios from "axios";
// import io from "socket.io-client";
// import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
// import {
//   Video,
//   Car,
//   Scan,
//   Bell,
//   MapPin,
//   BarChart2,
//   Flame,
//   AlertTriangle,
//   RotateCcw
// } from "lucide-react";

// const BACKEND_URL = "http://localhost:5000";

// export default function OperatorDashboard() {
//   const [activeAlertsCount, setActiveAlertsCount] = useState(0);
//   const [totalVehiclesDetected, setTotalVehiclesDetected] = useState(0);
//   const [activeCamerasCount, setActiveCamerasCount] = useState(0);
//   const [recentIncidents, setRecentIncidents] = useState([]);
//   const [barChartData, setBarChartData] = useState([45, 62, 58, 71, 84, 96, 67]);

//   useEffect(() => {
//     fetchDashboardMetrics();

//     const interval = setInterval(() => {
//       fetchDashboardMetrics();
//     }, 10000);

//     // Connect to Node.js WebSockets for real-time updates
//     const socket = io(BACKEND_URL);

//     socket.on("congestion_alert", (newAlert) => {
//       setActiveAlertsCount((prev) => prev + 1);
//       setTotalVehiclesDetected((prev) => prev + (newAlert.vehicleCount || 0));

//       setRecentIncidents((prev) => [
//         {
//           id: `INC-${Math.floor(1000 + Math.random() * 9000)}`,
//           type: newAlert.eventType || "Gridlock Incident",
//           reasoning: newAlert.reasoning || "Lane Congestion Detected",
//           camera: newAlert.cameraId || "CAM_01",
//           vehicles: newAlert.vehicleCount || 0,
//           stoppedRatio: Math.round((newAlert.stationaryRatio || 0) * 100),
//           timestamp: new Date().toLocaleTimeString(),
//           status: "CRITICAL",
//         },
//         ...prev.slice(0, 9),
//       ]);
//     });

//     return () => {
//       clearInterval(interval);
//       socket.disconnect();
//     };
//   }, []);

//   const fetchDashboardMetrics = async () => {
//     try {
//       const camerasRes = await axios.get(`${BACKEND_URL}/api/cameras`);

//       if (Array.isArray(camerasRes.data)) {
//         setActiveCamerasCount(camerasRes.data.length);
//       }

//       const res = await axios.get(`${BACKEND_URL}/api/congestion/active`);

//       if (res.data?.status === "success") {
//         const rawAlerts = res.data.data || [];
//         const unResolved = rawAlerts.filter((a) => !a.resolved);
//         setActiveAlertsCount(unResolved.length);

//         const totalVehicles = rawAlerts.reduce(
//           (acc, item) => acc + (item.vehicleCount || 0),
//           0
//         );
//         setTotalVehiclesDetected(totalVehicles > 0 ? totalVehicles : 45);

//         // Populate recent activity from database records
//         if (rawAlerts.length > 0) {
//           const liveRows = rawAlerts.slice(0, 5).map((alert, idx) => ({
//             id: `INC-${alert._id ? alert._id.slice(-4).toUpperCase() : 8820 - idx}`,
//             type: alert.eventType || "GRIDLOCK_CONGESTION",
//             reasoning: alert.reasoning || "High Density Bottleneck",
//             camera: alert.cameraId || "CAM_01",
//             vehicles: alert.vehicleCount || 0,
//             stoppedRatio: Math.round((alert.stationaryRatio || 0) * 100),
//             timestamp: alert.createdAt
//               ? new Date(alert.createdAt).toLocaleTimeString()
//               : "Recent",
//             status: alert.resolved ? "RESOLVED" : "ACTIVE",
//           }));
//           setRecentIncidents(liveRows);
//         }
//       }
//     } catch (err) {
//       console.error("Failed to fetch live dashboard telemetry:", err);
//     }
//   };

//   const stats = [
//     {
//       label: "Active Cameras",
//       value: activeCamerasCount.toString(),
//       border: "border-l-[#0D2440]",
//       iconBg: "bg-[#0D2440]",
//       icon: <Video className="w-4 h-4 stroke-white stroke-2 fill-none" />,
//     },
//     {
//       label: "Vehicles Detected",
//       value: totalVehiclesDetected.toString(),
//       border: "border-l-[#2E5E99]",
//       iconBg: "bg-[#2E5E99]",
//       icon: <Car className="w-4 h-4 stroke-white stroke-2 fill-none" />,
//     },
//     {
//       label: "Vehicles Re-ID",
//       value: "20",
//       border: "border-l-[#7BA4D0]",
//       iconBg: "bg-[#7BA4D0]",
//       icon: <Scan className="w-4 h-4 stroke-white stroke-2 fill-none" />,
//     },
//     {
//       label: "Active Alerts",
//       value: activeAlertsCount.toString(),
//       border: "border-l-rose-500",
//       iconBg: activeAlertsCount > 0 ? "bg-rose-600" : "bg-[#0D2440]",
//       icon: <Bell className="w-4 h-4 stroke-white stroke-2 fill-none" />,
//     },
//   ];

//   const peak = Math.max(...barChartData);

//   const reidConfidence = [
//     { name: "High Confidence", value: 62, count: 211, color: "#0c4d9e" },
//     { name: "Possible Match", value: 27, count: 92, color: "#4d83be" },
//     { name: "Unlikely", value: 11, count: 38, color: "#3a7698" },
//   ];

//   return (
//     <div className="flex flex-col gap-4">
//       {/* TOP HEADER */}
//       <div className="flex items-center justify-between">
//         <div>
//           <p className="text-xs text-[#93A2B8] mt-0.5">
//             Cross-module intelligence: Vehicle Re-ID, ANPR & Congestion 
//           </p>
//         </div>
//         <button
//           onClick={fetchDashboardMetrics}
//           className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-colors"
//         >
      
//         </button>
//       </div>

//       {/* STATS GRID */}
//       <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
//         {stats.map((s) => (
//           <div
//             key={s.label}
//             className={`bg-white border border-[#E4EAF2] border-l-4 ${s.border} rounded-xl p-3.5 shadow-sm flex flex-col justify-between`}
//           >
//             <div className="mb-4">
//               <div
//                 className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.iconBg}`}
//               >
//                 {s.icon}
//               </div>
//             </div>
//             <div>
//               <div className="text-[10.5px] text-[#4B617D] tracking-wider uppercase font-bold mb-1">
//                 {s.label}
//               </div>
//               <div className="font-display text-2xl font-bold text-[#0D2440] tracking-tight">
//                 {s.value}
//               </div>
//             </div>
//           </div>
//         ))}
//       </section>

//       {/* CHARTS ROW */}
//       <section className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-3.5 items-stretch">
//         {/* VEHICLE DETECTIONS BAR CHART */}
//         <div className="bg-white border border-[#E4EAF2] rounded-xl flex flex-col overflow-hidden shadow-sm">
//           <div className="flex items-start justify-between p-4 border-b border-[#EEF2F8]">
//             <div>
//               <div className="font-display text-sm font-semibold text-[#0D2440] flex items-center gap-2">
//                 <BarChart2 className="w-4 h-4 stroke-[#2E5E99] stroke-[1.8] fill-none" />
//                 Vehicle Detections — Per Camera
//               </div>
//               <div className="text-xs text-[#93A2B8] mt-0.5">
//                 Day-wise count across all online surveillance cameras
//               </div>
//             </div>
//           </div>

//           <div className="flex items-end gap-1.5 p-4 pt-5 min-h-[220px]">
//             {barChartData.map((h, idx) => (
//               <div
//                 key={idx}
//                 className={`flex-1 rounded-t transition-all ${
//                   h === peak
//                     ? "bg-gradient-to-b from-[#7BA4D0] to-[#E7F0FA]"
//                     : "bg-gradient-to-b from-[#2E5E99] to-[#E7F0FA]"
//                 }`}
//                 style={{ height: `${h}%` }}
//               />
//             ))}
//           </div>

//           <div className="flex justify-between px-4 pb-3.5 font-mono text-[8.5px] text-[#93A2B8]">
//             <span>00:00</span>
//             <span>06:00</span>
//             <span>12:00</span>
//             <span>18:00</span>
//             <span>NOW</span>
//           </div>
//         </div>

//         {/* RE-ID CONFIDENCE DONUT CHART */}
//         <div className="bg-white border border-[#E4EAF2] rounded-xl flex flex-col overflow-hidden shadow-sm">
//           <div className="p-4 border-b border-[#EEF2F8]">
//             <div className="font-display text-sm font-semibold text-[#0D2440] flex items-center gap-2">
//               <Scan className="w-4 h-4 stroke-[#2E5E99] stroke-[1.8] fill-none" />
//               Re-ID Confidence Distribution
//             </div>
//             <div className="text-xs text-[#93A2B8] mt-0.5">
//               Match confidence across gallery identification results
//             </div>
//           </div>

//           <div className="flex items-center gap-6 p-5 flex-1">
//             <div className="w-[150px] h-[150px] shrink-0">
//               <ResponsiveContainer width="100%" height="100%">
//                 <PieChart>
//                   <Pie
//                     data={reidConfidence}
//                     dataKey="value"
//                     nameKey="name"
//                     innerRadius={48}
//                     outerRadius={74}
//                     paddingAngle={2}
//                     strokeWidth={0}
//                   >
//                     {reidConfidence.map((entry, index) => (
//                       <Cell key={index} fill={entry.color} />
//                     ))}
//                   </Pie>
//                 </PieChart>
//               </ResponsiveContainer>
//             </div>

//             <div className="flex flex-col gap-3">
//               {reidConfidence.map((entry) => (
//                 <div key={entry.name} className="flex items-start gap-2">
//                   <span
//                     className="w-2.5 h-2.5 rounded-full mt-1 shrink-0"
//                     style={{ backgroundColor: entry.color }}
//                   />
//                   <div>
//                     <div className="text-[12px] font-medium text-[#4B617D]">
//                       {entry.name}
//                     </div>
//                     <div className="text-[13px] font-bold text-[#0D2440]">
//                       {entry.value}%{" "}
//                       <span className="text-[#93A2B8] font-normal text-[11px]">
//                         ({entry.count})
//                       </span>
//                     </div>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           </div>
//         </div>
//       </section>
//     </div>
//   );
// }




import React, { useState, useEffect } from "react";
import axiosInstance from "../../api/axiosInstance";
import io from "socket.io-client";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import {
  Video,
  Car,
  Scan,
  Bell,
  MapPin,
  BarChart2,
  X,
} from "lucide-react";

const BACKEND_URL = "http://localhost:5000";

export default function OperatorDashboard() {
  const [activeAlertsCount, setActiveAlertsCount] = useState(0);
  const [totalVehiclesDetected, setTotalVehiclesDetected] = useState(0);

  // Approved cameras visible to the logged-in operator
  const [activeCameras, setActiveCameras] = useState([]);
  const [activeCamerasCount, setActiveCamerasCount] = useState(0);

  const [showCameraDetails, setShowCameraDetails] = useState(false);

  const [recentIncidents, setRecentIncidents] = useState([]);
  const [barChartData, setBarChartData] = useState([
    45, 62, 58, 71, 84, 96, 67,
  ]);

  useEffect(() => {
    fetchDashboardMetrics();

    const interval = setInterval(() => {
      fetchDashboardMetrics();
    }, 10000);

    // Socket connection
    const token = localStorage.getItem("token");

    const socket = io(BACKEND_URL, {
      auth: {
        token,
      },
    });

    // Camera changes
    socket.on("camera_update", () => {
      fetchApprovedCameras();
    });

    socket.on("camera_reviewed", () => {
      fetchApprovedCameras();
    });

    socket.on("camera_deleted", () => {
      fetchApprovedCameras();
    });

    // Congestion alerts
    socket.on("congestion_alert", (newAlert) => {
      setActiveAlertsCount((prev) => prev + 1);

      // setTotalVehiclesDetected(
      //   (prev) => prev + (newAlert.vehicleCount || 0)
      // );

      setRecentIncidents((prev) => [
        {
          id: `INC-${Math.floor(1000 + Math.random() * 9000)}`,
          type: newAlert.eventType || "Gridlock Incident",
          reasoning:
            newAlert.reasoning || "Lane Congestion Detected",
          camera: newAlert.cameraId || "CAM_01",
          vehicles: newAlert.vehicleCount || 0,
          stoppedRatio: Math.round(
            (newAlert.stationaryRatio || 0) * 100
          ),
          timestamp: new Date().toLocaleTimeString(),
          status: "CRITICAL",
        },
        ...prev.slice(0, 9),
      ]);
    });

    return () => {
      clearInterval(interval);
      socket.disconnect();
    };
  }, []);

  // ==========================================
  // GET APPROVED CAMERAS
  // ==========================================
  const fetchApprovedCameras = async () => {
    try {
      const response = await axiosInstance.get("/cameras");

      if (Array.isArray(response.data)) {
        setActiveCameras(response.data);
        setActiveCamerasCount(response.data.length);
      } else {
        setActiveCameras([]);
        setActiveCamerasCount(0);
      }
    } catch (err) {
      console.error(
        "Failed to fetch approved cameras:",
        err.response?.data || err.message
      );

      setActiveCameras([]);
      setActiveCamerasCount(0);
    }
  };

  // ==========================================
  // DASHBOARD METRICS
  // ==========================================
const fetchDashboardMetrics = async () => {
  try {
    // Cameras come directly from MongoDB through /api/cameras
    await fetchApprovedCameras();

    // Get actual vehicle detection count from Detection collection
    const [dashboardRes, congestionRes] = await Promise.all([
      axiosInstance.get("/dashboard/stats"),
      axiosInstance.get("/congestion/active"),
    ]);

    // Vehicles Detected = actual Detection.vehicleCount total
    if (dashboardRes.data?.status === "success") {
      const vehiclesDetected =
        dashboardRes.data.stats?.vehiclesDetected ?? 0;

      setTotalVehiclesDetected(vehiclesDetected);
    }

    // Active alerts + recent activity
    if (congestionRes.data?.status === "success") {
      const rawAlerts = congestionRes.data.data || [];

      const unResolved = rawAlerts.filter(
        (a) => !a.resolved
      );

      setActiveAlertsCount(unResolved.length);

      // Populate recent activity
      if (rawAlerts.length > 0) {
        const liveRows = rawAlerts
          .slice(0, 5)
          .map((alert, idx) => ({
            id: `INC-${
              alert._id
                ? alert._id.slice(-4).toUpperCase()
                : 8820 - idx
            }`,
            type:
              alert.eventType || "GRIDLOCK_CONGESTION",
            reasoning:
              alert.reasoning ||
              "High Density Bottleneck",
            camera: alert.cameraId || "CAM_01",
            vehicles: alert.vehicleCount || 0,
            stoppedRatio: Math.round(
              (alert.stationaryRatio || 0) * 100
            ),
            timestamp: alert.createdAt
              ? new Date(
                  alert.createdAt
                ).toLocaleTimeString()
              : "Recent",
            status: alert.resolved
              ? "RESOLVED"
              : "ACTIVE",
          }));

        setRecentIncidents(liveRows);
      }
    }
  } catch (err) {
    console.error(
      "Failed to fetch live dashboard telemetry:",
      err.response?.data || err.message
    );
  }
};
  // ==========================================
  // FORMAT REGISTRATION DATE
  // ==========================================
  const formatRegistrationTime = (date) => {
    if (!date) return "N/A";

    return new Date(date).toLocaleString("en-PK", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  // ==========================================
  // STAT CARDS
  // ==========================================
  const stats = [
    {
      label: "Active Cameras",
      value: activeCamerasCount.toString(),
      border: "border-l-[#0D2440]",
      iconBg: "bg-[#0D2440]",
      icon: (
        <Video className="w-4 h-4 stroke-white stroke-2 fill-none" />
      ),
    },
    {
      label: "Vehicles Detected",
      value: totalVehiclesDetected.toString(),
      border: "border-l-[#2E5E99]",
      iconBg: "bg-[#2E5E99]",
      icon: (
        <Car className="w-4 h-4 stroke-white stroke-2 fill-none" />
      ),
    },
    {
      label: "Vehicles Re-ID",
      value: "20",
      border: "border-l-[#7BA4D0]",
      iconBg: "bg-[#7BA4D0]",
      icon: (
        <Scan className="w-4 h-4 stroke-white stroke-2 fill-none" />
      ),
    },
    {
      label: "Active Alerts",
      value: activeAlertsCount.toString(),
      border: "border-l-rose-500",
      iconBg:
        activeAlertsCount > 0
          ? "bg-rose-600"
          : "bg-[#0D2440]",
      icon: (
        <Bell className="w-4 h-4 stroke-white stroke-2 fill-none" />
      ),
    },
  ];

  const peak = Math.max(...barChartData);

  const reidConfidence = [
    {
      name: "High Confidence",
      value: 62,
      count: 211,
      color: "#0c4d9e",
    },
    {
      name: "Possible Match",
      value: 27,
      count: 92,
      color: "#4d83be",
    },
    {
      name: "Unlikely",
      value: 11,
      count: 38,
      color: "#3a7698",
    },
  ];

  return (
    <div className="flex flex-col gap-4">

      {/* TOP HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-[#93A2B8] mt-0.5">
            Cross-module intelligence: Vehicle Re-ID, ANPR &
            Congestion
          </p>
        </div>

        <button
          onClick={fetchDashboardMetrics}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* STATS GRID */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => {
          const isActiveCameraCard =
            s.label === "Active Cameras";

          return (
            <div
              key={s.label}
              onClick={
                isActiveCameraCard
                  ? () => {
                      fetchApprovedCameras();
                      setShowCameraDetails(true);
                    }
                  : undefined
              }
              className={`bg-white border border-[#E4EAF2] border-l-4 ${
                s.border
              } rounded-xl p-3.5 shadow-sm flex flex-col justify-between ${
                isActiveCameraCard
                  ? "cursor-pointer hover:shadow-md hover:border-[#C8D5E5] transition-all"
                  : ""
              }`}
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

                <div className="flex items-center justify-between">
                  <div className="font-display text-2xl font-bold text-[#0D2440] tracking-tight">
                    {s.value}
                  </div>

                  {isActiveCameraCard && (
                    <span className="text-[10px] text-[#2E5E99] font-semibold">
                      View
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* ==========================================
          ACTIVE CAMERA DETAILS MODAL
          ========================================== */}
      {showCameraDetails && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setShowCameraDetails(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* MODAL HEADER */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E4EAF2]">
              <div>
                <h2 className="text-base font-bold text-[#0D2440]">
                  Active Cameras
                </h2>

                <p className="text-xs text-[#93A2B8] mt-0.5">
                  {activeCameras.length} approved camera
                  {activeCameras.length !== 1 ? "s" : ""} visible
                  to you
                </p>
              </div>

              <button
                onClick={() => setShowCameraDetails(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4 text-slate-600" />
              </button>
            </div>

            {/* CAMERA LIST */}
            <div className="p-5 overflow-y-auto max-h-[70vh]">
              {activeCameras.length === 0 ? (
                <div className="py-12 text-center">
                  <Video className="w-8 h-8 mx-auto text-slate-300 mb-3" />

                  <p className="text-sm font-semibold text-slate-600">
                    No approved cameras
                  </p>

                  <p className="text-xs text-slate-400 mt-1">
                    There are currently no approved cameras
                    available to you.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeCameras.map((camera) => (
                    <div
                      key={camera._id}
                      className="border border-[#E4EAF2] rounded-xl p-4 bg-slate-50/50"
                    >
                      {/* CAMERA NAME */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div>
                          <div className="text-sm font-bold text-[#0D2440]">
                            {camera.name || "Unnamed Camera"}
                          </div>

                          <div className="text-xs text-[#93A2B8] mt-1">
                            {camera.location || "Location unavailable"}
                          </div>
                        </div>

                        <span className="shrink-0 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[9px] font-bold uppercase">
                          Approved
                        </span>
                      </div>

                      {/* DETAILS */}
                      <div className="space-y-2.5">

                        {/* OPERATOR */}
                        <div className="flex justify-between gap-4">
                          <span className="text-[11px] text-[#93A2B8]">
                            Operator
                          </span>

                          <span className="text-[11px] font-semibold text-[#0D2440] text-right">
                            {camera.submittedBy?.name ||
                              "Unknown"}
                          </span>
                        </div>

                        {/* REGISTERED */}
                        <div className="flex justify-between gap-4">
                          <span className="text-[11px] text-[#93A2B8]">
                            Registered
                          </span>

                          <span className="text-[11px] font-semibold text-[#0D2440] text-right">
                            {formatRegistrationTime(
                              camera.createdAt
                            )}
                          </span>
                        </div>

                        {/* LATITUDE */}
                        <div className="flex justify-between gap-4">
                          <span className="text-[11px] text-[#93A2B8] flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            Latitude
                          </span>

                          <span className="text-[11px] font-mono font-semibold text-[#0D2440]">
                            {camera.latitude ?? "N/A"}
                          </span>
                        </div>

                        {/* LONGITUDE */}
                        <div className="flex justify-between gap-4">
                          <span className="text-[11px] text-[#93A2B8] flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            Longitude
                          </span>

                          <span className="text-[11px] font-mono font-semibold text-[#0D2440]">
                            {camera.longitude ?? "N/A"}
                          </span>
                        </div>

                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CHARTS ROW */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-3.5 items-stretch">

        {/* VEHICLE DETECTIONS BAR CHART */}
        <div className="bg-white border border-[#E4EAF2] rounded-xl flex flex-col overflow-hidden shadow-sm">
          <div className="flex items-start justify-between p-4 border-b border-[#EEF2F8]">
            <div>
              <div className="font-display text-sm font-semibold text-[#0D2440] flex items-center gap-2">
                <BarChart2 className="w-4 h-4 stroke-[#2E5E99] stroke-[1.8] fill-none" />
                Vehicle Detections — Per Camera
              </div>

              <div className="text-xs text-[#93A2B8] mt-0.5">
                Day-wise count across all online surveillance
                cameras
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
              Match confidence across gallery identification
              results
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
                      <Cell
                        key={index}
                        fill={entry.color}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-col gap-3">
              {reidConfidence.map((entry) => (
                <div
                  key={entry.name}
                  className="flex items-start gap-2"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full mt-1 shrink-0"
                    style={{
                      backgroundColor: entry.color,
                    }}
                  />

                  <div>
                    <div className="text-[12px] font-medium text-[#4B617D]">
                      {entry.name}
                    </div>

                    <div className="text-[13px] font-bold text-[#0D2440]">
                      {entry.value}%
                      <span className="text-[#93A2B8] font-normal text-[11px]">
                        {" "}
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
    </div>
  );
}
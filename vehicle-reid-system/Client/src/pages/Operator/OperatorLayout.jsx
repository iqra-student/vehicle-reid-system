import React, { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
// Import your VSMS logo from assets
import vsmsLogo from "../../assets/vsms-logo.png"; 
import {
  LayoutDashboard,
  Video,
  Camera,
  Search,
  FileSearch,
  Users,
  MapPin,
  LogOut,
  Bell,
  Activity,
  Flame,
  BarChart2,
} from "lucide-react";

export default function OperatorLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [clock, setClock] = useState("—");

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setClock(d.toTimeString().slice(0, 8) + " UTC+5");
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/signin");
  };

  const navItems = [
    { name: "Dashboard", path: "/operator/dashboard", icon: LayoutDashboard },
    { name: "Live Cameras", path: "/operator/live-monitoring", icon: Video },
    { name: "Vehicle Re-ID", path: "/operator/reid-review", icon: Activity },
    { name: "Plate Search", path: "/operator/plate-search", icon: Search },
    { name: "Vehicle Forensics", path: "/operator/forensics", icon: FileSearch },
    { name: "Convoy Detection", path: "/operator/convoy-detection", icon: Users },
    { name: "Traffic & Congestion", path: "/operator/congestion", icon: Flame },
    { name: "Camera Management", path: "/operator/camera-management", icon: Camera },
    { name: "Path Visualization", path: "/operator/path-viz", icon: MapPin },
    { name: "Alerts", path: "/operator/alerts", icon: Bell },
    { name: "Reports & Analytics", path: "/operator/reports", icon: BarChart2 },
  ];

  return (
    <div className="min-h-screen bg-[#F5F8FC] text-[#0D2440] font-sans antialiased">
      <div className="grid grid-cols-[242px_1fr] min-h-screen">
        
        {/* SIDEBAR */}
        <aside className="bg-[#0C1A2B] flex flex-col py-5 px-0 shadow-md">
          {/* Brand Header */}
          <div className="flex items-center gap-2.5 px-4 pb-5 border-b border-[#7BA4D0]/15 mb-1.5 min-w-0">
            <div className="flex items-center justify-center shrink-0">
             <img 
  src={vsmsLogo} 
  alt="VSMS Logo" 
  className="h-5 w-auto object-contain invert mix-blend-screen" 
/>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-[12.5px] tracking-wider text-white leading-tight whitespace-nowrap">
                OPERATOR PORTAL
              </span>
            </div>
          </div>

          <div className="text-[9.5px] font-mono tracking-widest text-[#6C87A6] uppercase px-5 py-3">
            Operations
          </div>

          {/* Navigation */}
          <nav className="flex flex-col gap-0.5 px-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.2px] font-medium transition-colors relative text-decoration-none ${
                    isActive
                      ? "bg-[#E7F0FA] text-[#0D2440] font-bold shadow-sm"
                      : "text-[#B7CBE2] hover:bg-[#7BA4D0]/10 hover:text-white"
                  }`}
                >
                  {isActive && (
                    <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-4 bg-[#7BA4D0] rounded-r" />
                  )}
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? "stroke-[#0D2440] stroke-2" : "stroke-[#6C87A6]"}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className="mt-auto pt-3.5 px-4 border-t border-[#7BA4D0]/15">
            <div className="flex items-center gap-2.5 py-1.5 pb-3">
              <div className="w-8 h-8 rounded-full bg-[#2E5E99] border border-[#7BA4D0]/20 flex items-center justify-center text-xs font-bold text-white shrink-0">
                {(user?.name || "O").charAt(0).toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <div className="text-[12.5px] font-semibold text-white truncate">
                  {user?.name || "Operator"}
                </div>
                <div className="text-[10.5px] text-[#6C87A6] truncate max-w-[110px]">
                  {user?.email}
                </div>
              </div>
              <span className="ml-auto text-[9.5px] font-mono tracking-wider text-[#6C87A6] bg-[#7BA4D0]/15 px-1.5 py-0.5 rounded">
                OPERATOR
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-transparent border border-[#7BA4D0]/20 text-[#B7CBE2] text-xs font-medium hover:bg-[#B25C50]/15 hover:border-[#B25C50] hover:text-[#f0c3bd] transition-colors"
            >
              <LogOut className="w-3.5 h-3.5 stroke-current stroke-[1.8]" />
              Sign Out
            </button>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <div className="flex flex-col min-w-0 overflow-hidden">
          <div className="px-[26px] pt-5">
            <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-white border border-[#E4EAF2] shadow-sm">
              <div className="flex items-center gap-2.5 text-[12.5px] font-medium text-[#4B617D]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2E5E99] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2E5E99]"></span>
                </span>
                System Online &amp; Monitoring Active
              </div>
              <div className="flex items-center gap-3.5">
                <span className="font-mono text-[10.5px] text-[#93A2B8] tracking-wide">
                  {clock}
                </span>
                <button className="w-7 h-7 rounded-lg bg-[#E7F0FA] flex items-center justify-center text-[#2E5E99] relative">
                  <Bell className="w-3.5 h-3.5 stroke-[#2E5E99] stroke-[1.8]" />
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#B25C50]"></span>
                </button>
              </div>
            </div>
          </div>

          <main className="p-[20px_26px_34px] flex flex-col gap-4 overflow-y-auto">
            <Outlet />
          </main>
        </div>

      </div>
    </div>
  );
}
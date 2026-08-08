import React from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
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

const VsmsLogoMark = ({ className = "h-8 w-8" }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="8" fill="url(#vsmsGrad)" />
    <circle cx="14" cy="16" r="7" stroke="white" strokeWidth="2" />
    <circle cx="14" cy="16" r="2.3" fill="white" />
    <circle cx="25" cy="8" r="1.6" fill="#7BA4D0" />
    <circle cx="21" cy="11" r="1.2" fill="#7BA4D0" opacity="0.7" />
    <circle cx="18" cy="13.5" r="0.9" fill="#7BA4D0" opacity="0.4" />
    <defs>
      <linearGradient id="vsmsGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
        <stop stopColor="#2E5E99" />
        <stop offset="1" stopColor="#0D2440" />
      </linearGradient>
    </defs>
  </svg>
);

export default function OperatorLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

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

  const currentPage = navItems.find((item) => item.path === location.pathname);
  const pageTitle = currentPage ? currentPage.name : "Dashboard";

  return (
    <div className="min-h-screen bg-[#F5F8FC] text-[#0D2440] font-sans antialiased">
      <div className="grid grid-cols-[242px_1fr] min-h-screen">
        
        {/* SIDEBAR */}
        <aside className="bg-[#0C1A2B] flex flex-col py-5 px-0 shadow-md">
          <div className="flex items-center gap-2.5 px-4 pb-5 border-b border-[#7BA4D0]/15 mb-1.5 min-w-0">
            <VsmsLogoMark className="h-8 w-8 shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-[13.5px] tracking-wider text-white leading-tight whitespace-nowrap">
                CityTrace
              </span>
              <span className="text-[9px] font-mono tracking-widest text-[#6C87A6] uppercase leading-tight">
                Operator Portal
              </span>
            </div>
          </div>

          <div className="text-[9.5px] font-mono tracking-widest text-[#6C87A6] uppercase px-5 py-3">
            Operations
          </div>

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
         
{/* TOP BAR */}
<div className="flex items-center justify-between px-[26px] pt-6 pb-4">
  <h1 className="text-3xl font-bold text-[#0D2440]">{pageTitle}</h1>

  <div className="flex items-center gap-4">
    <button className="w-9 h-9 rounded-lg bg-white border border-[#E4EAF2] flex items-center justify-center text-[#4B617D] hover:bg-[#F5F8FC] transition-colors">
      <Bell className="w-4 h-4 stroke-[#4B617D] stroke-[1.8]" />
    </button>

    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-full bg-[#2E5E99] flex items-center justify-center text-sm font-bold text-white shrink-0">
        {(user?.name || "O").charAt(0).toUpperCase()}
      </div>
      <div className="hidden sm:block">
        <div className="text-[13px] font-semibold text-[#0D2440] leading-tight">
          {user?.name || "Operator"}
        </div>
        <div className="text-[11px] text-[#93A2B8] leading-tight">
          Operator
        </div>
      </div>
    </div>
  </div>
</div>

          <main className="p-[10px_26px_34px] flex flex-col gap-4 overflow-y-auto">
            <Outlet />
          </main>
        </div>

      </div>
    </div>
  );
}
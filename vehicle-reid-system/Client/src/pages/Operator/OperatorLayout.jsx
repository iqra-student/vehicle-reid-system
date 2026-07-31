import React from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  LayoutDashboard,
  Video,
  Camera,
  CheckSquare,
  Search,
  FileSearch,
  Users,
  MapPin,
  FileText,
  LogOut,
  Bell,
  ShieldAlert,
  Activity,    // <-- Added missing import
  Flame,       // <-- Added missing import
  BarChart2,
} from "lucide-react";

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

  return (
    <div className="flex h-screen bg-[#0F1115] text-slate-100 font-sans overflow-hidden">
      {/* OPERATOR SIDEBAR */}
      <aside className="w-64 bg-[#1C2029] border-r border-slate-800 flex flex-col justify-between">
        <div>
          {/* Logo & Header */}
          <div className="p-5 border-b border-slate-800 flex items-center gap-3">
            <div className="p-2 bg-[#3AB0FF]/10 text-[#3AB0FF] rounded-lg">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-wide text-white uppercase">
                VSMS Command
              </h1>
              <p className="text-[11px] text-slate-400">Operator Portal</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-[#3AB0FF]/15 text-[#3AB0FF] border-l-4 border-[#3AB0FF] font-semibold"
                      : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Info & Logout */}
        <div className="p-4 border-t border-slate-800 bg-[#151821]/50">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-semibold text-slate-200">
                {user?.name || "Operator"}
              </p>
              <p className="text-[10px] text-slate-500">{user?.email}</p>
            </div>
            <span className="px-2 py-0.5 text-[10px] font-bold bg-[#3AB0FF]/20 text-[#3AB0FF] rounded-full uppercase">
              Operator
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-[#1C2029] border-b border-slate-800 flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs font-medium text-slate-300">
              System Online & Monitoring Active
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-400 hover:text-white bg-slate-800/50 rounded-lg border border-slate-700/50 relative">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-[#3AB0FF] rounded-full" />
            </button>
          </div>
        </header>

        {/* Scrollable Page Content */}
        <main className="flex-1 overflow-y-auto p-6 bg-[#0F1115]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
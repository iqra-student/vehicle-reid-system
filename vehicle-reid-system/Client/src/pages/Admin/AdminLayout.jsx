import React from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  LayoutDashboard,
  Users,
  Camera,
  Video,
  ShieldAlert,
  CheckCircle,
  BarChart2,
  Sliders,
  LogOut,
  Bell,
  ShieldCheck,
} from "lucide-react";

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/admin/signin");
  };

  const navItems = [
    { name: "Dashboard", path: "/admin/dashboard", icon: LayoutDashboard },
    { name: "User Management", path: "/admin/users", icon: Users },
    { name: "Camera Management", path: "/admin/cameras", icon: Camera },
    { name: "Camera Approvals", path: "/admin/camera-approvals", icon: CheckCircle },
    { name: "Live Monitoring", path: "/admin/live-monitoring", icon: Video },
    { name: "Alerts & Congestion", path: "/admin/alerts", icon: ShieldAlert },
    { name: "Re-ID Audit", path: "/admin/reid-audit", icon: CheckCircle },
    { name: "Reports & Analytics", path: "/admin/reports", icon: BarChart2 },
    { name: "System Config", path: "/admin/config", icon: Sliders },
  ];

  return (
    <div className="flex h-screen bg-[#0F1115] text-slate-100 font-sans overflow-hidden">
      {/* ADMIN SIDEBAR */}
      <aside className="w-64 bg-[#1C2029] border-r border-slate-800 flex flex-col justify-between">
        <div>
          {/* Logo & Header */}
          <div className="p-5 border-b border-slate-800 flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-wide text-white uppercase">
                VSMS Admin
              </h1>
              <p className="text-[11px] text-purple-400 font-semibold">Command Oversight</p>
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
                      ? "bg-purple-500/15 text-purple-400 border-l-4 border-purple-500 font-semibold"
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
                {user?.name || "System Admin"}
              </p>
              <p className="text-[10px] text-slate-500">{user?.email}</p>
            </div>
            <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-500/20 text-purple-400 rounded-full uppercase">
              Admin
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
            <span className="w-2.5 h-2.5 bg-purple-500 rounded-full animate-pulse" />
            <span className="text-xs font-medium text-slate-300">
              System Administration Mode
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-400 hover:text-white bg-slate-800/50 rounded-lg border border-slate-700/50 relative">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-purple-500 rounded-full" />
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
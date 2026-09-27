import React from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  LayoutDashboard,
  Users,
  ShieldAlert,
  BarChart2,
  LogOut,
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
    {
      name: "Dashboard",
      path: "/admin/dashboard",
      icon: LayoutDashboard,
    },
    {
      name: "User Management",
      path: "/admin/users",
      icon: Users,
    },
    {
      name: "Alerts",
      path: "/admin/alerts",
      icon: ShieldAlert,
    },
    {
      name: "Reports & Analytics",
      path: "/admin/reports",
      icon: BarChart2,
    },
  ];

  return (
    <div className="flex h-screen bg-[#F4F7FB] text-[#0D2440] font-sans overflow-hidden">

      {/* ADMIN SIDEBAR */}
      <aside className="w-64 bg-white border-r border-[#E4EAF2] flex flex-col justify-between">

        <div>

          {/* LOGO */}
          <div className="p-5 border-b border-[#E4EAF2] flex items-center gap-3">
            <div className="p-2 bg-[#EAF1F8] text-[#2E5E99] rounded-lg">
              <ShieldCheck className="w-6 h-6" />
            </div>

            <div>
              <h1 className="font-bold text-sm tracking-wide text-[#0D2440] uppercase">
                VSMS Admin
              </h1>

              <p className="text-[11px] text-[#2E5E99] font-semibold">
                Command Oversight
              </p>
            </div>
          </div>

          {/* NAVIGATION */}
          <nav className="p-3 space-y-1">

            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                    isActive
                      ? "bg-[#EAF1F8] text-[#2E5E99] border-l-4 border-[#2E5E99] font-semibold"
                      : "text-[#4B617D] hover:bg-[#F4F7FB] hover:text-[#0D2440] font-medium"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.name}
                </Link>
              );
            })}

          </nav>
        </div>

        {/* USER / LOGOUT */}
        <div className="p-4 border-t border-[#E4EAF2] bg-[#FBFCFE]">

          <div className="flex items-center justify-between mb-3">

            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#0D2440] truncate">
                {user?.name || "System Admin"}
              </p>

              <p className="text-[10px] text-[#6B819B] truncate">
                {user?.email}
              </p>
            </div>

            <span className="px-2 py-0.5 text-[10px] font-bold bg-[#EAF1F8] text-[#2E5E99] rounded-full uppercase">
              Admin
            </span>

          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-[#B25C50] bg-[#FBEDEC] hover:bg-[#F6E1DF] rounded-lg transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>

        </div>

      </aside>

      {/* MAIN CONTENT ONLY */}
      <div className="flex-1 min-w-0 overflow-hidden">

        <main className="h-full overflow-y-auto bg-[#F4F7FB]">
          <Outlet />
        </main>

      </div>

    </div>
  );
}
import React from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { LayoutDashboard, Video, Users, LogOut, ShieldCheck } from "lucide-react";

const navItems = [
  { name: "Dashboard", path: "/admin/dashboard", icon: LayoutDashboard },
  { name: "Camera Management", path: "/admin/cameras", icon: Video },
  { name: "User Management", path: "/admin/users", icon: Users },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/admin/signin");
  };

  const initials = (user?.name || "System Admin")
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex h-screen bg-[#F4F7FB] font-sans overflow-hidden">
      {/* ───── SIDEBAR ───── */}
      <aside className="w-64 flex flex-col justify-between bg-[#0D2440] shrink-0">
        <div>
          {/* LOGO */}
          <div className="px-5 py-5 flex items-center gap-3 border-b border-white/10">
            <div className="p-2 rounded-lg bg-white/10 text-[#7BA4D0]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-sm tracking-wide text-white truncate">
                CityTrace
              </h1>
              
            </div>
          </div>

          {/* NAV */}
          <nav className="px-3 pt-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`relative flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-lg text-sm transition-colors ${
                    isActive
                      ? "bg-white/10 text-white font-semibold"
                      : "text-[#94A9C4] hover:bg-white/5 hover:text-white font-medium"
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-[#7BA4D0]" />
                  )}
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* IDENTITY / LOGOUT */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3 px-1">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-gradient-to-br from-[#2E5E99] to-[#7BA4D0] text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">
                {user?.name || "System Admin"}
              </p>
              <p className="text-[10px] text-[#7C93B5] truncate">{user?.email}</p>
            </div>
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-white/10 text-[#7BA4D0] shrink-0">
              Admin
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-[#B25C50]/15 text-[#E39A90] hover:bg-[#B25C50]/25 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ───── MAIN CONTENT ───── */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <main className="h-full overflow-y-auto bg-[#F4F7FB]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
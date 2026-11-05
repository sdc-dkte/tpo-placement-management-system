import React, { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Briefcase,
  Building2,
  Users,
  BarChart3,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "../../context/useAuth";

const NAV_ITEMS = [
  {
    label: "Overview",
    path: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Drives & Openings",
    path: "/drives",
    icon: Briefcase,
  },
  {
    label: "Company Directory",
    path: "/companies",
    icon: Building2,
  },
  {
    label: "Student Directory",
    path: "/students",
    icon: Users,
  },
  {
    label: "Analytics & Reports",
    path: "/analytics",
    icon: BarChart3,
  },
];

export default function TpoLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    if (logout) {
      await logout();
    }
    navigate("/login", { replace: true });
  };

  const getInitials = (name = "") => {
    if (!name) return "PK";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const navContent = (
    <div className="flex flex-col h-full justify-between">
      <div>
        {/* Brand Crest & Header */}
        <div className="px-5 py-4 border-b border-gray-800/80">
          <div className="flex items-center justify-between mb-2">
            <img
              src="/dkte-logo.png"
              alt="DKTE Logo"
              className="h-7 w-auto object-contain select-none"
            />
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#FECC00] text-[#111827]">
              TPO Portal
            </span>
          </div>
          <div className="text-white text-xs font-bold tracking-tight">
            Placement Management System
          </div>
          <div className="text-gray-400 text-[10px] tracking-wide mt-0.5">
            Central Training &amp; Placement Cell
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              location.pathname === item.path ||
              location.pathname === `/tpo${item.path}` ||
              location.pathname.startsWith(`${item.path}/`);

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between px-3 py-2 rounded text-xs transition-colors ${
                  isActive
                    ? "bg-white/10 text-white font-semibold border-l-2 border-[#FECC00]"
                    : "text-gray-400 hover:text-white hover:bg-gray-800/60 font-medium"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? "text-[#FECC00]" : "text-gray-400"
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Bottom TPO Officer Profile */}
      <div className="p-3 border-t border-gray-800/80">
        <div className="flex items-center justify-between p-2 rounded hover:bg-gray-800/50 transition">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded bg-gray-800 border border-gray-700 text-gray-200 flex items-center justify-center font-semibold text-xs flex-shrink-0">
              {getInitials(user?.name || "Dr. P. V. Kulkarni")}
            </div>
            <div className="min-w-0">
              <div className="text-white text-xs font-semibold leading-tight truncate">
                {user?.name || "Dr. P. V. Kulkarni"}
              </div>
              <div className="text-gray-400 text-[10px] leading-tight truncate">
                {user?.email || "Head, Training & Placement"}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title="Log Out"
            className="text-gray-500 hover:text-gray-300 p-1 rounded transition flex-shrink-0 ml-1"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex text-gray-900 font-sans antialiased">
      {/* Desktop Persistent Sidebar (w-64) */}
      <aside className="hidden md:flex w-64 bg-[#111827] border-r border-gray-800 flex-col flex-shrink-0 min-h-screen sticky top-0 h-screen z-20">
        {navContent}
      </aside>

      {/* Mobile Top Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-[#111827] border-b border-gray-800 flex items-center justify-between px-4 z-30">
        <div className="flex items-center gap-2.5">
          <img
            src="/dkte-logo.png"
            alt="DKTE Logo"
            className="h-6 w-auto object-contain flex-shrink-0"
          />
          <span className="text-white text-xs font-bold">Placement Management System</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="text-gray-300 hover:text-white p-1"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-64 bg-[#111827] h-full z-50 flex flex-col">
            {navContent}
          </aside>
        </div>
      )}

      {/* Main Workspace Canvas */}
      <div className="flex-1 flex flex-col min-w-0 md:pt-0 pt-14 bg-[#F8FAFC]">
        <Outlet />
      </div>
    </div>
  );
}

import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { LayoutGrid, Calendar, BookOpen, LogOut, Menu, X, ChevronDown } from 'lucide-react';
import dkteLogo from '../../assets/dkte-logo.png';

const NAV_LINKS = [
  { label: 'Dashboard', path: '/portal/dossier', icon: LayoutGrid },
  { label: 'Placement Drives', path: '/portal/drives', icon: Calendar },
  { label: 'Guide', path: '/portal/guide', icon: BookOpen },
];

export default function StudentLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setDropdownOpen(false);
    if (logout) await logout();
    navigate('/login', { replace: true });
  };

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'ST';

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-gray-900 antialiased">
      {/* Sticky Top Navigation Bar (56px) */}
      <header className="bg-[#111827] text-white border-b border-gray-800 sticky top-0 z-40 backdrop-blur-md bg-[#111827]/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative flex items-center justify-between h-14">
            
            {/* 1. Left: Branding */}
            <div className="flex items-center gap-3 select-none flex-shrink-0 z-10">
              <img src={dkteLogo} alt="DKTE Logo" className="h-7 w-auto object-contain" />
              <span className="h-4 w-px bg-gray-700/80 hidden sm:block" />
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-300 hidden sm:inline">
                Student Portal
              </span>
            </div>

            {/* 2. Center: Horizontally Centered Navigation */}
            <nav className="hidden md:flex items-center gap-1.5 absolute left-1/2 -translate-x-1/2 z-10">
              {NAV_LINKS.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.path || (link.path === '/portal/dossier' && location.pathname === '/portal');
                return (
                  <NavLink
                    key={link.path}
                    to={link.path}
                    className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors duration-150 ${
                      isActive
                        ? 'bg-[#FECC00] text-[#111827] shadow-xs'
                        : 'text-gray-300 hover:text-white hover:bg-white/[0.08]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{link.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            {/* 3. Right: Profile & Logout Dropdown */}
            <div className="flex items-center gap-2 z-10">
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setDropdownOpen((v) => !v)}
                  className="flex items-center gap-2.5 p-1 sm:px-2.5 sm:py-1 rounded-lg hover:bg-white/[0.08] transition-colors cursor-pointer select-none"
                  aria-expanded={dropdownOpen}
                  aria-haspopup="true"
                >
                  <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 text-[#FECC00] flex items-center justify-center text-xs font-bold font-mono">
                    {initials}
                  </div>
                  <div className="hidden sm:block text-left">
                    <div className="text-xs font-semibold text-gray-100 leading-tight max-w-[130px] truncate">
                      {user?.name || 'Student'}
                    </div>
                    <div className="text-[10px] text-gray-400 font-mono leading-tight">
                      {user?.studentProfile?.PRN || user?.email || ''}
                    </div>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180 text-white' : ''}`} />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors text-left cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-500" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile menu toggle */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen((v) => !v)}
                className="md:hidden p-1.5 text-gray-400 hover:text-white rounded-lg"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#0B1117] border-b border-gray-800 px-4 py-2 space-y-1">
            {NAV_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <NavLink
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold ${
                      isActive ? 'bg-[#FECC00] text-[#111827]' : 'text-gray-300 hover:bg-white/[0.08]'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </NavLink>
              );
            })}
          </div>
        )}
      </header>

      {/* Main Routed Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-3 text-center text-xs text-gray-400">
        DKTE Society's Textile &amp; Engineering Institute &bull; Central Training &amp; Placement Cell
      </footer>
    </div>
  );
}

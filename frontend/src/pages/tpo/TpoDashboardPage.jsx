import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import dkteLogo from '../../assets/dkte-logo.jpg';
import { LogOut, Shield, ArrowRight, User } from 'lucide-react';

export default function TpoDashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between">
      {/* Institutional Topbar */}
      <header className="bg-[#111827] text-white border-b border-gray-800 px-6 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img
              src={dkteLogo}
              alt="DKTE Logo"
              className="h-7 w-auto object-contain rounded-sm"
            />
            <span className="text-gray-400 text-xs">|</span>
            <span className="font-semibold text-sm tracking-tight text-gray-200">
              Placement Console
            </span>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-[#FECC00] text-[#111827]">
              TPO CONSOLE
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-gray-200">{user?.name || 'Administrator'}</div>
              <div className="text-[11px] text-gray-400">{user?.email}</div>
            </div>
            <button
              onClick={handleSignOut}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-medium border border-gray-700 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Minimal Post-Login Work Area */}
      <main className="max-w-3xl mx-auto w-full p-6 my-auto">
        <div className="bg-white border border-gray-200 rounded p-8 shadow-hairline">
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
            <Shield className="w-4 h-4 text-[#FECC00]" />
            <span>TPO Operations Console</span>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-2">
            Welcome back, {user?.name || 'TPO Administrator'}
          </h1>
          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            Authentication successfully verified. You are signed in with institutional administrator privileges.
          </p>

          {/* Quick Info Box */}
          <div className="bg-gray-50 border border-gray-200 rounded p-4 text-xs space-y-2 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 flex items-center space-x-1.5">
                <User className="w-3.5 h-3.5 text-gray-400" />
                <span>Account Email</span>
              </span>
              <span className="font-mono text-gray-900 font-medium">{user?.email}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
              <span className="text-gray-500">Route</span>
              <span className="font-mono text-gray-700 font-medium">/dashboard</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
              <span className="text-gray-500">Status</span>
              <span className="text-green-700 font-medium flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                <span>Active Session</span>
              </span>
            </div>
          </div>

          <div className="text-xs text-gray-500 flex items-center justify-between pt-4 border-t border-gray-100">
            <span>Next modules: Student CSV Ingest • Recruitment Drives Console</span>
            <span className="text-gray-400">AY 2025–26</span>
          </div>
        </div>
      </main>

      {/* Institutional Footer */}
      <footer className="text-center py-4 text-xs text-gray-400 border-t border-gray-200 bg-white">
        DKTE Society&apos;s Textile &amp; Engineering Institute • Training &amp; Placement Cell
      </footer>
    </div>
  );
}

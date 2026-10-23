import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { LogOut, CheckCircle2, User, Shield, GraduationCap } from 'lucide-react';

export default function HomeLandingPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between">
      {/* Top Institutional Bar */}
      <header className="bg-[#111827] text-white border-b border-gray-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="px-2.5 py-0.5 rounded bg-[#FECC00] text-[#111827] text-xs font-bold tracking-wider uppercase">
              DKTE
            </span>
            <span className="font-semibold text-sm tracking-tight text-gray-200">
              Placement Console
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-gray-200">{user?.name || 'User'}</div>
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

      {/* Main Verification Card */}
      <main className="max-w-xl mx-auto w-full p-6 my-auto">
        <div className="bg-white border border-gray-200 rounded p-8 shadow-hairline text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-50 text-green-600 mb-4 border border-green-200">
            <CheckCircle2 className="w-6 h-6" />
          </div>

          <h1 className="text-xl font-bold text-gray-900 tracking-tight mb-2">
            Authentication Verified
          </h1>
          <p className="text-sm text-gray-600 mb-6">
            The login module is successfully integrated with the backend API and institutional session storage.
          </p>

          {/* User Details Matrix */}
          <div className="bg-gray-50 border border-gray-200 rounded p-4 text-left space-y-3 mb-6">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-gray-200">
              <span className="text-gray-500 flex items-center space-x-1.5">
                <User className="w-3.5 h-3.5 text-gray-400" />
                <span>Account Name</span>
              </span>
              <span className="font-semibold text-gray-900">{user?.name || 'N/A'}</span>
            </div>

            <div className="flex items-center justify-between text-xs pb-2 border-b border-gray-200">
              <span className="text-gray-500">Email Address</span>
              <span className="font-mono text-gray-900">{user?.email || 'N/A'}</span>
            </div>

            <div className="flex items-center justify-between text-xs pb-2 border-b border-gray-200">
              <span className="text-gray-500 flex items-center space-x-1.5">
                <Shield className="w-3.5 h-3.5 text-gray-400" />
                <span>Assigned Role</span>
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-[#FECC00] text-[#111827]">
                {user?.role || 'N/A'}
              </span>
            </div>

            {user?.studentProfile && (
              <>
                <div className="flex items-center justify-between text-xs pb-2 border-b border-gray-200">
                  <span className="text-gray-500 flex items-center space-x-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-gray-400" />
                    <span>PRN</span>
                  </span>
                  <span className="font-mono font-medium text-gray-900">
                    {user.studentProfile.PRN}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Department</span>
                  <span className="font-medium text-gray-900">
                    {user.studentProfile.department?.name} ({user.studentProfile.department?.code})
                  </span>
                </div>
              </>
            )}
          </div>

          <button
            onClick={handleSignOut}
            className="w-full py-2 px-4 border border-gray-300 hover:border-gray-400 bg-white text-gray-700 font-medium text-xs rounded transition-colors"
          >
            Sign Out and Return to Login
          </button>
        </div>
      </main>

      {/* Institutional Footer */}
      <footer className="text-center py-4 text-xs text-gray-400 border-t border-gray-200 bg-white">
        DKTE Society&apos;s Textile &amp; Engineering Institute • Training &amp; Placement Cell
      </footer>
    </div>
  );
}

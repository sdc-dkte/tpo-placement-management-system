import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import dkteLogo from '../../assets/dkte-logo.jpg';
import { LogOut, GraduationCap, User } from 'lucide-react';

export default function StudentDossierPage() {
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
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img
              src={dkteLogo}
              alt="DKTE Logo"
              className="h-7 w-auto object-contain rounded-sm"
            />
            <span className="text-gray-400 text-xs">|</span>
            <span className="font-semibold text-sm tracking-tight text-gray-200">
              Student Placement Portal
            </span>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-[#FECC00] text-[#111827]">
              STUDENT DOSSIER
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-gray-200">{user?.name || 'Student'}</div>
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

      {/* Minimal Student Profile Area */}
      <main className="max-w-2xl mx-auto w-full p-6 my-auto">
        <div className="bg-white border border-gray-200 rounded p-8 shadow-hairline">
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
            <GraduationCap className="w-4 h-4 text-[#FECC00]" />
            <span>Verified Candidate Dossier</span>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-2">
            Welcome, {user?.name || 'Student'}
          </h1>
          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            Your institutional placement session is active. Placement records and drives will be visible here.
          </p>

          {/* Student Dossier Information */}
          <div className="bg-gray-50 border border-gray-200 rounded p-4 text-xs space-y-2 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 flex items-center space-x-1.5">
                <User className="w-3.5 h-3.5 text-gray-400" />
                <span>Student Name</span>
              </span>
              <span className="font-semibold text-gray-900">{user?.name || 'N/A'}</span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
              <span className="text-gray-500">Email</span>
              <span className="font-mono text-gray-900">{user?.email || 'N/A'}</span>
            </div>

            {user?.studentProfile && (
              <>
                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                  <span className="text-gray-500">PRN</span>
                  <span className="font-mono font-semibold text-gray-900">
                    {user.studentProfile.PRN}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                  <span className="text-gray-500">Department</span>
                  <span className="font-medium text-gray-900">
                    {user.studentProfile.department?.name} ({user.studentProfile.department?.code})
                  </span>
                </div>
              </>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
              <span className="text-gray-500">Route</span>
              <span className="font-mono text-gray-700 font-medium">/portal/dossier</span>
            </div>
          </div>

          <div className="text-xs text-gray-500 flex items-center justify-between pt-4 border-t border-gray-100">
            <span>Dossier module ready for campus drive noticeboard</span>
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

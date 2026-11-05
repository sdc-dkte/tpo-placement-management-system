import React from 'react';
import { useAuth } from '../../context/useAuth';
import { GraduationCap, User } from 'lucide-react';

export default function StudentDossierPage() {
  const { user } = useAuth();

  return (
    <div className="max-w-2xl mx-auto w-full">
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
    </div>
  );
}

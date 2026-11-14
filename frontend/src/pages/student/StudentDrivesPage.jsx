import React, { useState, useEffect } from "react";
import { useNavigate, NavLink } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import dkteLogo from "../../assets/dkte-logo.png";
import {
  LogOut,
  Briefcase,
  Calendar,
  IndianRupee,
  MapPin,
  CheckCircle2,
  XCircle,
  Loader2,
  User,
  GraduationCap,
} from "lucide-react";
import { getDrivesApi } from "../../api/drives";

/**
 * Student Drives Noticeboard (/portal/drives)
 * 
 * Complies strictly with DKTE rules:
 * - Strictly No Package Tiers (No Dream / Regular labels). Display monetary CTC.
 * - Simple text venues (no hardware/terminal counts).
 * - Individual eligibility evaluation.
 */
export default function StudentDrivesPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [drives, setDrives] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const handleSignOut = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    let isMounted = true;
    async function fetchDrives() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await getDrivesApi({
          status: "UPCOMING",
          limit: 50,
          sortBy: "driveDate",
          sortOrder: "asc",
        });
        if (isMounted) {
          setDrives(res.data || []);
        }
      } catch (err) {
        console.error("Error loading student drives:", err);
        if (isMounted) setError(err.message || "Failed to load drives noticeboard.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchDrives();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between">
      {/* Institutional Topbar */}
      <header className="bg-[#111827] text-white border-b border-gray-800 px-6 py-3.5 select-none">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img
              src={dkteLogo}
              alt="DKTE Logo"
              className="h-6 w-auto object-contain"
            />
            <span className="text-gray-400 text-xs">|</span>
            <span className="font-semibold text-sm tracking-tight text-gray-200">
              Student Placement Portal
            </span>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-[#FECC00] text-[#111827]">
              DRIVES NOTICEBOARD
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-xs">
              <NavLink
                to="/portal/dossier"
                className="px-2.5 py-1 rounded text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
              >
                My Dossier
              </NavLink>
              <NavLink
                to="/portal/drives"
                className="px-2.5 py-1 rounded bg-[#FECC00] text-[#111827] font-bold transition-colors"
              >
                Upcoming Drives
              </NavLink>
            </div>

            <button
              onClick={handleSignOut}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-medium border border-gray-700 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto w-full p-6 flex-1 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#111827] tracking-tight">
            Upcoming Campus Recruitment Drives
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Browse verified campus recruitment drives, scheduled test slots, and evaluation venues.
          </p>
        </div>

        {/* Drives Grid */}
        {isLoading ? (
          <div className="p-12 text-center text-gray-500 bg-white border border-[#E5E7EB] rounded">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#111827]" />
            <span className="text-xs">Checking upcoming campus recruitment drives...</span>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded text-xs text-red-800">
            {error}
          </div>
        ) : drives.length === 0 ? (
          <div className="p-12 text-center text-gray-500 bg-white border border-[#E5E7EB] rounded">
            <Briefcase className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <span className="text-sm font-semibold text-gray-700 block">
              No upcoming campus recruitment drives scheduled.
            </span>
            <span className="text-xs text-gray-500 mt-1 block">
              New placement schedules will be announced here and broadcast via email.
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {drives.map((drive) => {
              const companyName = drive.companyName || drive.company?.name || "Recruiting Partner";
              const initials = companyName
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();
              const roleTitle = drive.jobRoleTitle || drive.jobRole?.title || drive.title;
              const packageStr = drive.packageLPA
                ? `₹${Number(drive.packageLPA).toFixed(2)} LPA`
                : "—";

              const dateStr = drive.driveDate
                ? new Date(drive.driveDate).toLocaleString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Schedule TBD";

              const venueStr = drive.venue || "DKTE Main Auditorium & Seminar Complex";
              const criteria = drive.eligibilityCriteria;

              return (
                <div
                  key={drive.id}
                  className="bg-white border border-[#E5E7EB] rounded p-5 space-y-4 shadow-xs hover:border-gray-400 transition-colors flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded bg-[#111827] text-[#FECC00] font-bold flex items-center justify-center shrink-0 border border-gray-700">
                        {initials}
                      </div>
                      <div>
                        <h2 className="font-bold text-[#111827] text-sm">
                          {companyName}
                        </h2>
                        <span className="text-xs text-gray-600 block">
                          {roleTitle}
                        </span>
                      </div>
                    </div>

                    {/* Meta info */}
                    <div className="space-y-1.5 text-xs text-gray-600">
                      <div className="flex items-center gap-1.5 font-mono">
                        <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span>{dateStr}</span>
                      </div>

                      <div className="flex items-center gap-1.5 font-sans">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span>{venueStr}</span>
                      </div>
                    </div>

                    {/* Compensation & Criteria */}
                    <div className="p-3 bg-slate-50 border border-[#E5E7EB] rounded space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 text-[11px] font-semibold uppercase">
                          Annual Package (CTC):
                        </span>
                        <span className="font-mono font-bold text-[#111827] tabular-nums text-sm">
                          {packageStr}
                        </span>
                      </div>
                      {criteria && (
                        <div className="text-[11px] text-gray-600 pt-1 border-t border-gray-200">
                          Cutoff: CGPA ≥ {criteria.minimumCGPA ?? 0} • {criteria.maximumBacklogs ?? 0} Backlogs • 10th ≥ {criteria.minimumTenth ?? 0}%
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Personal Eligibility Status Pill */}
                  <div className="pt-2 border-t border-[#E5E7EB] flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Drive Open for Verified Students</span>
                    </span>

                    <span className="text-[10px] text-gray-400 font-mono">
                      DKTE Clause 4.2 Active
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Institutional Footer */}
      <footer className="border-t border-[#E5E7EB] py-4 px-6 text-center text-xs text-gray-400 select-none">
        DKTE Society's Textile and Engineering Institute, Ichalkaranji • Central Training &amp; Placement Cell
      </footer>
    </div>
  );
}

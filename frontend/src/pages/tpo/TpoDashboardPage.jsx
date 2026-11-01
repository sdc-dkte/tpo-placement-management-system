import React, { useState, useEffect, useCallback } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import {
  Users,
  Briefcase,
  CheckCircle2,
  TrendingUp,
  Building2,
  Calendar,
  FileSpreadsheet,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
  MapPin,
  ChevronRight,
  Loader2,
  AlertCircle,
  GraduationCap,
} from "lucide-react";
import {
  getDashboardOverviewApi,
  getRecentSelectionsApi,
  getUpcomingDrivesSummaryApi,
} from "../../api/dashboard";

export default function TpoDashboardPage() {
  const { user } = useAuth();

  const [overview, setOverview] = useState(null);
  const [upcomingDrives, setUpcomingDrives] = useState([]);
  const [recentSelections, setRecentSelections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [overviewRes, drivesRes, selectionsRes] = await Promise.allSettled([
        getDashboardOverviewApi(),
        getUpcomingDrivesSummaryApi(4),
        getRecentSelectionsApi(5),
      ]);

      if (overviewRes.status === "fulfilled" && overviewRes.value?.data) {
        setOverview(overviewRes.value.data);
      } else if (overviewRes.status === "rejected") {
        throw overviewRes.reason;
      }

      if (drivesRes.status === "fulfilled" && drivesRes.value?.data) {
        setUpcomingDrives(drivesRes.value.data || []);
      }

      if (selectionsRes.status === "fulfilled" && selectionsRes.value?.data) {
        setRecentSelections(selectionsRes.value.data || []);
      }
    } catch (err) {
      console.error("Dashboard overview fetch error:", err);
      setError(err.message || "Failed to load dashboard overview.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const totalStudents = overview?.totalStudents ?? 0;
  const placedStudents = overview?.placedStudents ?? 0;
  const unplacedStudents = overview?.unplacedStudents ?? 0;
  const placementRate = overview?.placementPercentage ?? 0;
  const avgPackage = overview?.averagePackage ? Number(overview.averagePackage).toFixed(2) : "0.00";
  const highPackage = overview?.highestPackage ? Number(overview.highestPackage).toFixed(2) : "0.00";
  const activeDrivesCount = (overview?.upcomingDrives ?? 0) + (overview?.ongoingDrives ?? 0);
  const departments = overview?.departmentSummaries ?? [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E5E7EB] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#FECC00] text-[#111827]">
              EXECUTIVE CONSOLE
            </span>
            <span className="text-gray-400 text-xs">|</span>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              AY 2025–26 PLACEMENT SEASON
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#111827] tracking-tight mt-1">
            Training &amp; Placement Operations Overview
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Real-time candidate metrics, departmental placement performance, and active recruitment drives.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchDashboardData}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium border border-[#E5E7EB] transition cursor-pointer"
            title="Refresh Dashboard"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Sync</span>
          </button>

          <NavLink
            to="/drives"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#FECC00] hover:bg-[#e5b800] text-[#111827] text-xs font-semibold border border-[#FECC00] transition cursor-pointer shadow-2xs"
          >
            <Briefcase className="w-4 h-4" />
            <span>Manage Drives</span>
          </NavLink>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded text-xs text-red-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Top KPI Cards (4-Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Candidates */}
        <div className="bg-white border border-[#E5E7EB] rounded p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Verified Candidates
            </span>
            <Users className="w-4 h-4 text-gray-400" />
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-[#111827] font-mono tabular-nums">
              {isLoading ? "—" : totalStudents}
            </div>
            <div className="text-[11px] text-gray-500 flex items-center justify-between">
              <span>Unplaced: <strong className="font-mono text-gray-800">{unplacedStudents}</strong></span>
              <NavLink to="/students" className="text-blue-600 hover:underline">
                Roster →
              </NavLink>
            </div>
          </div>
        </div>

        {/* Metric 2: Placement Rate */}
        <div className="bg-white border border-[#E5E7EB] rounded p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Placement Rate
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-700 font-mono tabular-nums">
                {isLoading ? "—" : `${placementRate}%`}
              </span>
              <span className="text-[11px] font-mono text-gray-500">
                ({placedStudents} placed)
              </span>
            </div>
            {/* Progress Bar */}
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(placementRate, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Metric 3: Active Campus Drives */}
        <div className="bg-white border border-[#E5E7EB] rounded p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Active Drives
            </span>
            <Briefcase className="w-4 h-4 text-blue-600" />
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-[#111827] font-mono tabular-nums">
              {isLoading ? "—" : activeDrivesCount}
            </div>
            <div className="text-[11px] text-gray-500 flex items-center justify-between">
              <span>Upcoming: <strong className="font-mono text-gray-800">{overview?.upcomingDrives ?? 0}</strong></span>
              <NavLink to="/drives" className="text-blue-600 hover:underline">
                Console →
              </NavLink>
            </div>
          </div>
        </div>

        {/* Metric 4: Compensation Benchmark */}
        <div className="bg-white border border-[#E5E7EB] rounded p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Package Benchmarks
            </span>
            <TrendingUp className="w-4 h-4 text-amber-600" />
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] text-gray-500">Avg CTC:</span>
              <span className="text-base font-bold text-[#111827] font-mono tabular-nums">
                ₹{avgPackage} LPA
              </span>
            </div>
            <div className="flex items-baseline justify-between pt-1 border-t border-gray-100">
              <span className="text-[11px] text-gray-500">Highest CTC:</span>
              <span className="text-xs font-bold text-emerald-700 font-mono tabular-nums">
                ₹{highPackage} LPA
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Navigation Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <NavLink
          to="/drives"
          className="bg-white border border-[#E5E7EB] hover:border-gray-400 rounded p-3 text-xs flex items-center gap-2.5 transition shadow-2xs group"
        >
          <div className="w-8 h-8 rounded bg-slate-100 group-hover:bg-[#FECC00] transition flex items-center justify-center text-[#111827] shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-[#111827]">Recruitment Drives</div>
            <div className="text-[10px] text-gray-500">Schedule &amp; Roster</div>
          </div>
        </NavLink>

        <NavLink
          to="/companies"
          className="bg-white border border-[#E5E7EB] hover:border-gray-400 rounded p-3 text-xs flex items-center gap-2.5 transition shadow-2xs group"
        >
          <div className="w-8 h-8 rounded bg-slate-100 group-hover:bg-[#FECC00] transition flex items-center justify-center text-[#111827] shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-[#111827]">Company CRM</div>
            <div className="text-[10px] text-gray-500">Recruiting Partners</div>
          </div>
        </NavLink>

        <NavLink
          to="/students"
          className="bg-white border border-[#E5E7EB] hover:border-gray-400 rounded p-3 text-xs flex items-center gap-2.5 transition shadow-2xs group"
        >
          <div className="w-8 h-8 rounded bg-slate-100 group-hover:bg-[#FECC00] transition flex items-center justify-center text-[#111827] shrink-0">
            <GraduationCap className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-[#111827]">Candidate Roster</div>
            <div className="text-[10px] text-gray-500">CSV Batch Ingestion</div>
          </div>
        </NavLink>

        <NavLink
          to="/analytics"
          className="bg-white border border-[#E5E7EB] hover:border-gray-400 rounded p-3 text-xs flex items-center gap-2.5 transition shadow-2xs group"
        >
          <div className="w-8 h-8 rounded bg-slate-100 group-hover:bg-[#FECC00] transition flex items-center justify-center text-[#111827] shrink-0">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-[#111827]">NIRF Reports</div>
            <div className="text-[10px] text-gray-500">Official PDF &amp; Excel</div>
          </div>
        </NavLink>
      </div>

      {/* Main Two-Column Operational Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Department Breakdown & Upcoming Drives (2 Columns) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Department Placement Matrix */}
          <div className="bg-white border border-[#E5E7EB] rounded overflow-hidden shadow-2xs">
            <div className="p-4 bg-[#F8FAFC] border-b border-[#E5E7EB] flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold text-[#111827] uppercase tracking-wider">
                  Department Placement Performance
                </h2>
                <p className="text-[11px] text-gray-500">
                  Branch-wise student placement percentage and average compensation.
                </p>
              </div>
              <span className="text-[10px] font-mono text-gray-400">
                DKTE Engineering Departments
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-white border-b border-[#E5E7EB] text-gray-400 text-[10px] uppercase font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">Department</th>
                    <th className="py-2.5 px-3 text-center">Batch Size</th>
                    <th className="py-2.5 px-3 text-center">Placed</th>
                    <th className="py-2.5 px-4 text-center">Placement %</th>
                    <th className="py-2.5 px-4 text-right">Avg CTC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1 text-[#111827]" />
                        <span>Aggregating departmental statistics...</span>
                      </td>
                    </tr>
                  ) : departments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-gray-500 text-xs">
                        No department student records loaded.
                      </td>
                    </tr>
                  ) : (
                    departments.map((dept) => {
                      const avg = dept.averagePackage
                        ? `₹${Number(dept.averagePackage).toFixed(2)} LPA`
                        : "—";

                      return (
                        <tr key={dept.departmentId} className="hover:bg-[#F8FAFC] transition">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-gray-900">
                              {dept.departmentName}
                            </div>
                            <span className="font-mono text-[10px] text-gray-400">
                              {dept.departmentCode}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-mono text-gray-700">
                            {dept.totalStudents}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-semibold text-emerald-700">
                            {dept.placedStudents}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2 max-w-[120px] mx-auto">
                              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-600 rounded-full"
                                  style={{ width: `${Math.min(dept.placementPercentage, 100)}%` }}
                                />
                              </div>
                              <span className="font-mono font-semibold text-gray-900 text-[11px] w-10 text-right">
                                {dept.placementPercentage}%
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-[#111827] tabular-nums">
                            {avg}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Upcoming Drives Board */}
          <div className="bg-white border border-[#E5E7EB] rounded overflow-hidden shadow-2xs">
            <div className="p-4 bg-[#F8FAFC] border-b border-[#E5E7EB] flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold text-[#111827] uppercase tracking-wider">
                  Upcoming Campus Recruitment Drives
                </h2>
                <p className="text-[11px] text-gray-500">
                  Scheduled recruitment rounds, venues, and compensation packages.
                </p>
              </div>
              <NavLink
                to="/drives"
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <span>All Drives</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </NavLink>
            </div>

            {isLoading ? (
              <div className="p-8 text-center text-xs text-gray-500">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1 text-[#111827]" />
                <span>Checking drive schedules...</span>
              </div>
            ) : upcomingDrives.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500">
                No upcoming drives scheduled currently.{" "}
                <NavLink to="/drives" className="text-blue-600 underline font-semibold">
                  Schedule a campus drive
                </NavLink>.
              </div>
            ) : (
              <div className="divide-y divide-[#E5E7EB]">
                {upcomingDrives.map((drive) => {
                  const companyName = drive.company?.name || drive.companyName || "Recruiting Partner";
                  const roleTitle = drive.jobRole?.title || drive.title;
                  const pkg = drive.packageLPA
                    ? `₹${Number(drive.packageLPA).toFixed(2)} LPA`
                    : "—";
                  const dateStr = drive.driveDate
                    ? new Date(drive.driveDate).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "TBD";

                  return (
                    <div
                      key={drive.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F8FAFC] transition"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-[#111827]">
                            {companyName}
                          </span>
                          <span className="text-gray-300">•</span>
                          <span className="text-xs text-gray-600">{roleTitle}</span>
                        </div>
                        <div className="flex items-center gap-4 text-[11px] text-gray-500">
                          <span className="flex items-center gap-1 font-mono">
                            <Calendar className="w-3 h-3 text-gray-400" />
                            {dateStr}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-gray-400" />
                            {drive.venue || "DKTE Main Auditorium"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        <span className="font-mono font-bold text-xs text-[#111827] tabular-nums">
                          {pkg}
                        </span>
                        <NavLink
                          to={`/drives/${drive.id}`}
                          className="px-2.5 py-1 text-[11px] font-medium rounded bg-[#111827] text-white hover:bg-black transition"
                        >
                          Roster
                        </NavLink>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Recent Selections & Institutional Rules (1 Column) */}
        <div className="space-y-6">
          {/* Recent Placed Candidates */}
          <div className="bg-white border border-[#E5E7EB] rounded overflow-hidden shadow-2xs">
            <div className="p-4 bg-[#F8FAFC] border-b border-[#E5E7EB]">
              <h2 className="text-xs font-bold text-[#111827] uppercase tracking-wider">
                Confirmed Student Selections
              </h2>
              <p className="text-[11px] text-gray-500">
                Official candidate placement records.
              </p>
            </div>

            {isLoading ? (
              <div className="p-6 text-center text-xs text-gray-500">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1 text-[#111827]" />
                <span>Loading latest selections...</span>
              </div>
            ) : recentSelections.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-400">
                No recent selections recorded.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {recentSelections.map((sel) => {
                  const studentName = sel.student?.user?.name || "Placed Student";
                  const prn = sel.student?.PRN || "PRN";
                  const companyName = sel.drive?.company?.name || "Company";
                  const pkg = sel.packageLPA ? `₹${Number(sel.packageLPA).toFixed(2)} LPA` : "—";

                  return (
                    <div key={sel.id} className="p-3.5 space-y-1 hover:bg-[#F8FAFC] transition">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-gray-900">
                          {studentName}
                        </span>
                        <span className="font-mono font-bold text-xs text-emerald-700 tabular-nums">
                          {pkg}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-gray-500">
                        <span>{companyName}</span>
                        <span className="font-mono text-[10px] text-gray-400">{prn}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="p-2.5 bg-slate-50 border-t border-[#E5E7EB] text-center">
              <NavLink to="/students" className="text-[11px] font-semibold text-blue-600 hover:underline">
                View Full Student Directory →
              </NavLink>
            </div>
          </div>

          {/* Institutional Clause 4.2 Placement Policy Card */}
          <div className="bg-[#111827] text-white rounded p-4 space-y-3 border border-gray-800 shadow-2xs">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#FECC00]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#FECC00]">
                Institutional Policy Notice
              </span>
            </div>
            <div>
              <div className="text-xs font-bold text-white">
                Clause 4.2 Placement Lockdown Active
              </div>
              <p className="text-[11px] text-gray-300 mt-1 leading-relaxed">
                When a candidate is marked <strong className="text-white">SELECTED</strong> or{" "}
                <strong className="text-white">OFFER_ACCEPTED</strong>, their PRN is automatically
                frozen from subsequent recruitment drives to ensure fair opportunity across all departments.
              </p>
            </div>
            <div className="pt-2 border-t border-gray-800 text-[10px] text-gray-400 font-mono">
              Enforced by Central DKTE TPO Council
            </div>
          </div>

          {/* Officer Session Summary */}
          <div className="bg-white border border-[#E5E7EB] rounded p-4 text-xs space-y-2 shadow-2xs">
            <div className="text-gray-500 text-[11px] uppercase font-bold tracking-wider mb-1">
              Active Administrator
            </div>
            <div className="font-bold text-gray-900">{user?.name || "TPO Administrator"}</div>
            <div className="text-[11px] font-mono text-gray-500 truncate">{user?.email}</div>
            <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400">
              <span>Status: Active Session</span>
              <span className="text-emerald-700 font-bold">LIVE</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

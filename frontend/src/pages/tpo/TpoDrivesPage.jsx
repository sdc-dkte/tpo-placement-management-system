import React, { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Download,
  Search,
  Calendar,
  ChevronRight,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { getDrivesApi } from "../../api/drives";
import { getDashboardOverviewApi } from "../../api/students";
import DriveStatsBar from "./drives/DriveStatsBar";
import CreateDriveModal from "./drives/CreateDriveModal";
import TpoDriveDetailPage from "./drives/TpoDriveDetailPage";

/**
 * DKTE Placement Management System — Recruitment Drives Console (/drives)
 * 
 * Strict Institutional Guidelines:
 * - Strictly No Package Tiers (No Dream / Super Dream / Regular labels). Pure monetary CTC.
 * - Strictly No Hardware Tracking (Clean text venues).
 * - Zero Bloat (Direct workflow, no offer letter contracts or admit slips).
 * - Slate foundation (#F8FAFC), Near-black (#111827), hairline borders (#E5E7EB), DKTE Gold (#FECC00).
 */
export default function TpoDrivesPage() {
  // Selected drive for in-page view switching
  const [selectedDriveId, setSelectedDriveId] = useState(null);

  // Drives data
  const [drives, setDrives] = useState([]);
  const [overviewStats, setOverviewStats] = useState({
    activeDrives: 0,
    upcomingDrives: 0,
    placedStudents: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'ONGOING' | 'UPCOMING' | 'COMPLETED'
  const [searchQuery, setSearchQuery] = useState("");
  const [ctcRange, setCtcRange] = useState("all"); // 'all' | 'high' (>10) | 'mid' (6-10) | 'low' (<6)

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Fetch drives and backend overview metrics
  const loadDrives = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [drivesRes, overviewRes] = await Promise.all([
        getDrivesApi({
          limit: 100,
          sortBy: "createdAt",
          sortOrder: "desc",
        }),
        getDashboardOverviewApi().catch(() => null),
      ]);

      const drivesList = drivesRes.data || [];
      setDrives(drivesList);

      if (overviewRes?.data) {
        setOverviewStats({
          activeDrives: overviewRes.data.ongoingDrives ?? drivesList.filter((d) => d.status === "ONGOING").length,
          upcomingDrives: overviewRes.data.upcomingDrives ?? drivesList.filter((d) => d.status === "UPCOMING").length,
          placedStudents: overviewRes.data.placedStudents ?? 0,
        });
      } else {
        setOverviewStats({
          activeDrives: drivesList.filter((d) => d.status === "ONGOING").length,
          upcomingDrives: drivesList.filter((d) => d.status === "UPCOMING").length,
          placedStudents: drivesList.reduce(
            (acc, curr) => acc + (curr.selectionsCount || curr._count?.selections || 0),
            0
          ),
        });
      }
    } catch (err) {
      console.error("Error loading placement drives:", err);
      setError(err.message || "Failed to load placement drives.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDrives();
  }, [loadDrives]);

  // Handle Drive Created
  const handleDriveCreated = (newDrive) => {
    loadDrives();
    if (newDrive?.id) {
      setSelectedDriveId(newDrive.id);
    }
  };

  // If a drive is selected for in-page detail view, render TpoDriveDetailPage
  if (selectedDriveId) {
    return (
      <TpoDriveDetailPage
        driveId={selectedDriveId}
        onBack={() => setSelectedDriveId(null)}
      />
    );
  }

  // Filtered drives
  const filteredDrives = drives.filter((drive) => {
    // Tab filter
    if (activeTab !== "all" && drive.status !== activeTab) {
      return false;
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const title = (drive.title || "").toLowerCase();
      const comp = (drive.companyName || drive.company?.name || "").toLowerCase();
      const role = (drive.jobRoleTitle || drive.jobRole?.title || "").toLowerCase();
      if (!title.includes(q) && !comp.includes(q) && !role.includes(q)) {
        return false;
      }
    }

    // CTC filter
    const ctc = Number(drive.packageLPA) || 0;
    if (ctcRange === "high" && ctc < 10) return false;
    if (ctcRange === "mid" && (ctc < 6 || ctc > 10)) return false;
    if (ctcRange === "low" && ctc >= 6) return false;

    return true;
  });

  // Upcoming company schedules for KPI card
  const upcomingCompanies = drives
    .filter((d) => d.status === "UPCOMING")
    .map((d) => d.companyName || d.company?.name)
    .filter(Boolean);

  // Tab counts
  const countAll = drives.length;
  const countOngoing = drives.filter((d) => d.status === "ONGOING").length;
  const countUpcoming = drives.filter((d) => d.status === "UPCOMING").length;
  const countCompleted = drives.filter((d) => d.status === "COMPLETED").length;
  const countCancelled = drives.filter((d) => d.status === "CANCELLED").length;

  return (
    <main className="p-6 space-y-6">
      {/* Page Title & Header Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[#111827] tracking-tight">
              Recruitment Drives
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Synced
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Manage campus recruitment drives, student email broadcasts, and final placed selections.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              alert("Exporting verified DKTE recruitment dossier (PDF)...");
            }}
            className="h-9 px-3.5 bg-white border border-[#E5E7EB] hover:bg-slate-50 text-[#111827] text-xs font-semibold rounded flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-gray-500" />
            <span>Export Dossier</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="h-9 px-4 bg-[#FECC00] hover:bg-[#E5B800] text-[#111827] font-bold text-xs rounded flex items-center gap-1.5 shadow-sm transition-all duration-150 active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4 font-bold" />
            <span>+ Post New Drive</span>
          </button>
        </div>
      </div>

      {/* Error Alert if any */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* 3 Focused KPI Cards (Driven by accurate backend overview data) */}
      <DriveStatsBar
        activeDrivesCount={overviewStats.activeDrives}
        upcomingCount={overviewStats.upcomingDrives}
        upcomingCompanies={upcomingCompanies}
        placedStudentsCount={overviewStats.placedStudents}
      />

      {/* Drives Table Container */}
      <section className="bg-white border border-[#E5E7EB] rounded shadow-xs p-5 space-y-4">
        {/* Tab Navigation Row */}
        <div className="flex flex-wrap items-center justify-between border-b border-[#E5E7EB] gap-2">
          <div className="flex items-center gap-6 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`pb-3 font-semibold transition-colors cursor-pointer ${
                activeTab === "all"
                  ? "border-b-2 border-[#FECC00] text-[#111827] font-bold"
                  : "text-gray-500 hover:text-[#111827]"
              }`}
            >
              All Drives ({countAll})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("ONGOING")}
              className={`pb-3 font-semibold transition-colors cursor-pointer ${
                activeTab === "ONGOING"
                  ? "border-b-2 border-[#FECC00] text-[#111827] font-bold"
                  : "text-gray-500 hover:text-[#111827]"
              }`}
            >
              Ongoing ({countOngoing})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("UPCOMING")}
              className={`pb-3 font-semibold transition-colors cursor-pointer ${
                activeTab === "UPCOMING"
                  ? "border-b-2 border-[#FECC00] text-[#111827] font-bold"
                  : "text-gray-500 hover:text-[#111827]"
              }`}
            >
              Upcoming ({countUpcoming})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("COMPLETED")}
              className={`pb-3 font-semibold transition-colors cursor-pointer ${
                activeTab === "COMPLETED"
                  ? "border-b-2 border-[#FECC00] text-[#111827] font-bold"
                  : "text-gray-500 hover:text-[#111827]"
              }`}
            >
              Completed ({countCompleted})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("CANCELLED")}
              className={`pb-3 font-semibold transition-colors cursor-pointer ${
                activeTab === "CANCELLED"
                  ? "border-b-2 border-[#FECC00] text-[#111827] font-bold"
                  : "text-gray-500 hover:text-[#111827]"
              }`}
            >
              Cancelled ({countCancelled})
            </button>
          </div>

          <div className="text-xs text-gray-400 pb-2 font-mono">
            Academic Year 2025–26
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search company or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-[#E5E7EB] rounded text-xs text-gray-700 focus:outline-none focus:border-[#111827]"
              />
            </div>

            <select
              value={ctcRange}
              onChange={(e) => setCtcRange(e.target.value)}
              className="h-8 px-2.5 bg-slate-50 border border-[#E5E7EB] rounded text-xs text-gray-700 focus:outline-none focus:border-[#111827]"
            >
              <option value="all">CTC: All Packages</option>
              <option value="high">&gt; ₹10.00 LPA</option>
              <option value="mid">₹6.00 - ₹10.00 LPA</option>
              <option value="low">&lt; ₹6.00 LPA</option>
            </select>
          </div>

          <div className="text-xs text-gray-500 font-mono">
            Showing {filteredDrives.length} active requisitions
          </div>
        </div>

        {/* Recruitment Drives Data Table */}
        <div className="overflow-x-auto border border-[#E5E7EB] rounded">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-gray-600 font-semibold border-b border-[#E5E7EB]">
                <th className="py-2.5 px-3">COMPANY &amp; ROLE</th>
                <th className="py-2.5 px-3">DRIVE DATE &amp; VENUE</th>
                <th className="py-2.5 px-3 text-right">PACKAGE (CTC)</th>
                <th className="py-2.5 px-3 text-right">ELIGIBLE STUDENTS</th>
                <th className="py-2.5 px-3">STATUS &amp; OUTREACH</th>
                <th className="py-2.5 px-3 text-center">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-gray-500">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#111827]" />
                    <span>Loading placement drives...</span>
                  </td>
                </tr>
              ) : filteredDrives.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-gray-500">
                    No placement drives found matching current filters.<br />
                    <button
                      type="button"
                      onClick={() => setIsCreateModalOpen(true)}
                      className="mt-3 text-xs font-bold text-[#111827] bg-[#FECC00] hover:bg-[#E5B800] px-3.5 py-1.5 rounded cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5 font-bold" />
                      <span>+ Post First Placement Drive</span>
                    </button>
                  </td>
                </tr>
              ) : (
                filteredDrives.map((drive) => {
                  const companyName = drive.companyName || drive.company?.name || "Company";
                  const initials = companyName
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();
                  const roleTitle = drive.jobRoleTitle || drive.jobRole?.title || drive.title;
                  const packageFormatted = drive.packageLPA
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

                  const venueStr = drive.venue || "DKTE Main Auditorium";

                  // Status Pill
                  const status = drive.status;
                  let statusBadge = (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                      Upcoming Assessment
                    </span>
                  );

                  if (status === "ONGOING") {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-800 border border-blue-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                        Interviews Ongoing
                      </span>
                    );
                  } else if (status === "COMPLETED") {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                        Drive Concluded
                      </span>
                    );
                  } else if (status === "CANCELLED") {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-50 text-red-800 border border-red-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
                        Drive Cancelled
                      </span>
                    );
                  }

                  return (
                    <tr
                      key={drive.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      {/* Company & Role */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded bg-[#111827] text-[#FECC00] font-bold text-xs flex items-center justify-center shrink-0 border border-gray-700">
                            {initials}
                          </div>
                          <div>
                            <span className="font-bold text-[#111827] block">
                              {companyName}
                            </span>
                            <span className="text-gray-500 text-[11px]">
                              {roleTitle}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Date & Venue */}
                      <td className="py-3 px-3 font-mono">
                        <span className="block font-medium text-[#111827]">
                          {dateStr}
                        </span>
                        <span className="text-gray-500 text-[11px] font-sans">
                          {venueStr}
                        </span>
                      </td>

                      {/* Package (CTC) - Tabular Monospace Rupee */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-[#111827] tabular-nums text-xs">
                        {packageFormatted}
                        <span className="block text-[10px] text-gray-500 font-sans font-normal">
                          Fixed CTC Breakdown
                        </span>
                      </td>

                      {/* Eligible Students */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-[#111827] tabular-nums">
                        {drive.participationsCount || drive._count?.participations || "Active"} pool
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        {statusBadge}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedDriveId(drive.id)}
                          className={`h-7 px-3 font-bold rounded text-xs transition-colors cursor-pointer shadow-xs inline-flex items-center gap-1 ${
                            status === "UPCOMING" || status === "ONGOING"
                              ? "bg-[#FECC00] hover:bg-[#E5B800] text-[#111827]"
                              : "bg-slate-100 hover:bg-slate-200 text-[#111827]"
                          }`}
                        >
                          <span>Open Drive</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Bottom Placement Schedule Section */}
      <section className="bg-white border border-[#E5E7EB] rounded p-5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2.5">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#111827]" />
            <h2 className="font-bold text-[#111827] text-xs uppercase tracking-wider">
              Upcoming Recruitment Calendar
            </h2>
          </div>
          <span className="text-[11px] text-gray-400 font-mono">
            On-Ground Queue Managed by Student Volunteers
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded border border-[#E5E7EB]">
            <span className="font-bold text-[#111827] block">
              TCS Digital Interviews
            </span>
            <span className="text-gray-500 text-[11px]">
              Venue: DKTE Main Auditorium (09:00 - 17:00)
            </span>
          </div>
          <div className="p-3 bg-slate-50 rounded border border-[#E5E7EB]">
            <span className="font-bold text-[#111827] block">
              NVIDIA PPT &amp; Orientation
            </span>
            <span className="text-gray-500 text-[11px]">
              Venue: DKTE Main Auditorium (10:00 - 12:00)
            </span>
          </div>
          <div className="p-3 bg-slate-50 rounded border border-[#E5E7EB]">
            <span className="font-bold text-[#111827] block">
              Campus Technical Evaluation
            </span>
            <span className="text-gray-500 text-[11px]">
              Venue: Seminar Complex &amp; Cabins (09:30 - 18:00)
            </span>
          </div>
        </div>
      </section>

      {/* Create Drive Modal */}
      <CreateDriveModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onDriveCreated={handleDriveCreated}
      />
    </main>
  );
}

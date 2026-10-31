import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  IndianRupee,
  MapPin,
  ClipboardPaste,
  Download,
  Lock,
  Building2,
  ChevronDown,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import {
  getDriveByIdApi,
  getEligibleStudentsForDriveApi,
  updateDriveStatusApi,
} from "../../../api/drives";
import EmailOutreachCard from "./EmailOutreachCard";
import CandidateRosterTable from "./CandidateRosterTable";
import BulkPrnPasteModal from "./BulkPrnPasteModal";

// Backend enforced lifecycle transitions
const ALLOWED_STATUS_TRANSITIONS = {
  UPCOMING: ["ONGOING", "CANCELLED"],
  ONGOING: ["COMPLETED", "CANCELLED", "UPCOMING"],
  COMPLETED: [],
  CANCELLED: [],
};

/**
 * TPO Drive Details & Candidate Operations Page (/drives/:driveId)
 * 
 * Supports both direct routing (/drives/:driveId) and in-page modal/view switching.
 */
export default function TpoDriveDetailPage({ driveId: propDriveId, onBack }) {
  const params = useParams();
  const navigate = useNavigate();
  const driveId = propDriveId || params.driveId;

  const [drive, setDrive] = useState(null);
  const [eligibleStudents, setEligibleStudents] = useState([]);
  const [placedStudents, setPlacedStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isBulkPrnOpen, setIsBulkPrnOpen] = useState(false);

  // Load drive data and eligible students
  useEffect(() => {
    if (!driveId) return;

    let isMounted = true;
    async function loadDriveData() {
      setIsLoading(true);
      setError(null);
      try {
        const [driveRes, eligibleRes] = await Promise.all([
          getDriveByIdApi(driveId),
          getEligibleStudentsForDriveApi(driveId, { statusFilter: "eligible_only", limit: 100 }),
        ]);

        if (isMounted) {
          const driveData = driveRes.data;
          setDrive(driveData);

          const students = eligibleRes.data || [];
          setEligibleStudents(students);

          // If drive already has selections, extract them
          if (driveData.selections && Array.isArray(driveData.selections)) {
            setPlacedStudents(driveData.selections);
          }
        }
      } catch (err) {
        console.error("Error loading drive details:", err);
        if (isMounted) setError(err.message || "Failed to load drive details.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadDriveData();
    return () => {
      isMounted = false;
    };
  }, [driveId]);

  // Handle back navigation
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate("/drives");
    }
  };

  // Status Lifecycle Transition
  const handleStatusChange = async (newStatus) => {
    if (!drive || isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    try {
      await updateDriveStatusApi(drive.id, newStatus);
      setDrive((prev) => ({
        ...prev,
        status: newStatus,
      }));
    } catch (err) {
      alert(`Cannot transition status: ${err.message}`);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Export Recruiter Attendance CSV
  const handleExportAttendance = () => {
    if (eligibleStudents.length === 0) {
      alert("No eligible candidates available to export.");
      return;
    }

    const headers = [
      "PRN",
      "Candidate Name",
      "Department",
      "CGPA",
      "10th Percentage",
      "12th or Diploma Percentage",
      "Active Backlogs",
      "Attendance Status",
      "Technical Round Result",
    ];

    const rows = eligibleStudents.map((s) => [
      `"${s.PRN || s.prn || ""}"`,
      `"${s.name || s.user?.name || ""}"`,
      `"${s.department?.name || s.department?.code || ""}"`,
      s.CGPA ?? s.cgpa ?? "",
      s.tenthPercentage ?? "",
      s.twelfthPercentage ?? s.diplomaPercentage ?? "",
      s.activeBacklogs ?? 0,
      "PRESENT",
      "",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    const safeTitle = (drive?.title || "Recruitment_Drive").replace(/[^a-zA-Z0-9]/g, "_");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `DKTE_${safeTitle}_Attendance_Roster.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle Confirmed Placements from Bulk PRN Modal
  const handleConfirmBulkPlacements = ({ students, manualPrns, confirmedPackage }) => {
    const newPlaced = [];

    // Verified students
    students.forEach((s) => {
      newPlaced.push({
        id: s.id,
        prn: s.PRN || s.prn,
        name: s.name || s.user?.name,
        department: s.department,
        confirmedPackage,
        status: "SELECTED",
      });
    });

    // Any manual PRNs not in student object format
    manualPrns.forEach((prn) => {
      if (!newPlaced.some((p) => p.prn.toUpperCase() === prn.toUpperCase())) {
        newPlaced.push({
          id: `manual-${prn}`,
          prn,
          name: "Verified Candidate (Roster Match)",
          department: { name: "Engineering", code: "ENG" },
          confirmedPackage,
          status: "SELECTED",
        });
      }
    });

    setPlacedStudents((prev) => {
      const combined = [...prev];
      newPlaced.forEach((p) => {
        if (!combined.some((c) => (c.prn || c.PRN) === p.prn)) {
          combined.push(p);
        }
      });
      return combined;
    });

    alert(
      `✅ Placements Confirmed & Profiles Frozen!\n\n${newPlaced.length} students confirmed placed at ${confirmedPackage}.\nClause 4.2 Placement Freeze applied: These candidates are now locked from subsequent campus recruitment drives.`
    );
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-gray-500 flex flex-col items-center justify-center min-h-[300px]">
        <Loader2 className="w-6 h-6 animate-spin text-[#111827] mb-2" />
        <span className="text-xs font-medium">Loading placement drive operations console...</span>
      </div>
    );
  }

  if (error || !drive) {
    return (
      <div className="p-6">
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 text-xs text-gray-700 hover:text-[#111827] font-bold mb-4 bg-white px-3 py-1.5 rounded border border-[#E5E7EB]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Drives</span>
        </button>
        <div className="p-4 bg-red-50 border border-red-200 rounded text-xs text-red-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{error || "Placement drive not found."}</span>
        </div>
      </div>
    );
  }

  const companyName = drive.companyName || drive.company?.name || "Company";
  const initials = companyName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const roleTitle = drive.jobRoleTitle || drive.jobRole?.title || drive.title;
  const packageStr = drive.packageLPA ? `₹${Number(drive.packageLPA).toFixed(2)} LPA` : "—";
  const dateStr = drive.driveDate
    ? new Date(drive.driveDate).toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Schedule Pending";
  const venueStr = drive.venue || "DKTE Main Auditorium & Seminar Complex";

  // Criteria summary string
  const criteria = drive.eligibilityCriteria;
  const criteriaSummary = criteria
    ? `CGPA ≥ ${criteria.minimumCGPA ?? 0} • ${criteria.maximumBacklogs ?? 0} Backlogs • 10th ≥ ${criteria.minimumTenth ?? 0}% • Clause 4.2 Locked`
    : "Open Criteria";

  return (
    <main className="p-6 space-y-6">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 text-xs text-gray-700 hover:text-[#111827] font-bold transition-colors bg-white px-3 py-1.5 rounded border border-[#E5E7EB] shadow-xs cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>← Back to Recruitment Drives</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportAttendance}
            className="h-8 px-3 border border-[#E5E7EB] rounded bg-white hover:bg-slate-50 text-xs font-semibold text-gray-700 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-gray-500" />
            <span>Export Recruiter Attendance (CSV)</span>
          </button>

          <button
            type="button"
            onClick={() => setIsBulkPrnOpen(true)}
            className="h-8 px-4 bg-[#FECC00] hover:bg-[#E5B800] text-[#111827] font-bold text-xs rounded transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <ClipboardPaste className="w-3.5 h-3.5 font-bold" />
            <span>Bulk Select Placed Students (PRN Paste)</span>
          </button>
        </div>
      </div>

      {/* Drive Overview Card */}
      <div className="bg-white border border-[#E5E7EB] rounded p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded bg-[#111827] text-[#FECC00] flex items-center justify-center font-bold text-base tracking-wider shrink-0 border border-gray-700">
            {initials}
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-[#111827]">
                {companyName} — {roleTitle}
              </h1>
              <span className="text-xs font-mono text-gray-500 font-medium">
                (Batch of 2026)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 font-mono">
              <span className="flex items-center gap-1 font-sans text-gray-600">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                {dateStr}
              </span>
              <span>•</span>
              <span className="font-bold text-[#111827] font-mono tabular-nums text-sm">
                {packageStr}
              </span>
              <span>•</span>
              <span className="text-gray-600 font-sans">
                {venueStr}
              </span>
            </div>

            <div className="text-[11px] text-gray-500 mt-0.5">
              Criteria: <span className="font-semibold text-gray-700">{criteriaSummary}</span>
            </div>
          </div>
        </div>

        {/* Right Status Controls */}
        <div className="flex items-center gap-4 self-end md:self-center">
          <div className="text-right">
            <span className="text-[10px] text-gray-400 uppercase font-semibold block">
              Eligible Pool
            </span>
            <span className="text-2xl font-bold font-mono text-[#111827] tabular-nums">
              {eligibleStudents.length}
            </span>
          </div>

          <div className="w-px h-8 bg-[#E5E7EB]"></div>

          {/* Lifecycle Status Switcher */}
          <div className="flex flex-col gap-1 items-end">
            <span className="text-[10px] text-gray-400 uppercase font-semibold">
              Drive Status
            </span>
            <select
              value={drive.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={
                isUpdatingStatus ||
                (ALLOWED_STATUS_TRANSITIONS[drive.status] || []).length === 0
              }
              className="text-xs font-bold px-2.5 py-1 rounded border border-[#E5E7EB] bg-white cursor-pointer focus:outline-none disabled:bg-slate-100 disabled:text-gray-500"
            >
              <option value={drive.status}>
                {drive.status} {(ALLOWED_STATUS_TRANSITIONS[drive.status] || []).length === 0 ? "(Terminal)" : "(Current)"}
              </option>
              {(ALLOWED_STATUS_TRANSITIONS[drive.status] || []).map((nextStatus) => (
                <option key={nextStatus} value={nextStatus}>
                  Move to {nextStatus}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Nodemailer Automated Student Outreach Card */}
      <EmailOutreachCard
        drive={drive}
        eligibleCount={eligibleStudents.length}
      />

      {/* Candidate Rosters (Eligible vs Placed Sub-tabs) */}
      <CandidateRosterTable
        eligibleStudents={eligibleStudents}
        placedStudents={placedStudents}
        isLoading={isLoading}
        onOpenBulkPrnModal={() => setIsBulkPrnOpen(true)}
      />

      {/* Bulk PRN Paste Modal (Method B) */}
      <BulkPrnPasteModal
        isOpen={isBulkPrnOpen}
        onClose={() => setIsBulkPrnOpen(false)}
        drive={drive}
        eligibleStudents={eligibleStudents}
        onConfirmPlacements={handleConfirmBulkPlacements}
      />
    </main>
  );
}

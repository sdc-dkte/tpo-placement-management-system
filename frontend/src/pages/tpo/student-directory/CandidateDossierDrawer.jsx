import React, { useEffect, useState } from "react";
import {
  X,
  Mail,
  GraduationCap,
  Briefcase,
  Calendar,
  Award,
  Copy,
  Loader2,
  Pencil,
  Trash2,
  FileText,
  Download,
  ExternalLink,
  Printer,
  CheckCircle,
} from "lucide-react";
import { getStudentByIdApi } from "../../../api/students";

export default function CandidateDossierDrawer({
  student,
  isOpen,
  onClose,
  onEditStudent,
  onDeleteStudent,
}) {
  const [dossierData, setDossierData] = useState(student);
  const [isLoadingApi, setIsLoadingApi] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  // Sync internal state with incoming student prop
  useEffect(() => {
    setDossierData(student);
  }, [student]);

  // Fetch live detailed student profile if backend ID is valid
  useEffect(() => {
    if (!isOpen || !student?.id) return;

    if (student.id) {
      let isCurrent = true;
      setIsLoadingApi(true);

      getStudentByIdApi(student.id)
        .then((res) => {
          if (!isCurrent) return;
          if (res?.data) {
            const apiStudent = res.data;
            const isPlaced =
              apiStudent.placementStatus === "SELECTED" ||
              apiStudent.placementStatus === "OFFER_ACCEPTED" ||
              apiStudent.selection?.status === "SELECTED";

            setDossierData((prev) => ({
              ...prev,
              id: apiStudent.id,
              prn: apiStudent.PRN || prev.prn,
              name: apiStudent.name || prev.name,
              email: apiStudent.email || prev.email,
              branch: apiStudent.department?.name || prev.branch,
              deptCode: apiStudent.department?.code || prev.deptCode,
              cgpa: apiStudent.CGPA ?? prev.cgpa,
              backlogs: apiStudent.activeBacklogs ?? prev.backlogs,
              academicPathway: apiStudent.academicPathway || prev.academicPathway,
              tenthPercentage: apiStudent.tenthPercentage ?? prev.tenthPercentage,
              twelfthPercentage: apiStudent.twelfthPercentage ?? prev.twelfthPercentage,
              diplomaPercentage: apiStudent.diplomaPercentage ?? prev.diplomaPercentage,
              graduationYear: apiStudent.graduationYear || prev.graduationYear,
              status: isPlaced ? "Placed" : prev.status || "Unplaced",
              organization: apiStudent.selection?.company?.name || prev.organization,
              packageLPA: apiStudent.selection?.packageLPA ?? prev.packageLPA,
            }));
          }
        })
        .catch((err) => {
          console.warn("Could not fetch detailed candidate from backend:", err.message);
        })
        .finally(() => {
          if (isCurrent) setIsLoadingApi(false);
        });

      return () => {
        isCurrent = false;
      };
    }
  }, [isOpen, student]);

  // Listen for ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !dossierData) return null;

  const handleCopyEmail = () => {
    if (dossierData.email) {
      navigator.clipboard.writeText(dossierData.email);
    }
  };

  const studentDisplay = dossierData;

  const handleDownloadResume = async () => {
    try {
      const token = localStorage.getItem("tpo_auth_token");
      const res = await fetch(`/api/v1/students/${studentDisplay.id}/resume?download=true`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${studentDisplay.prn}_Resume.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      }
    } catch {
      // Fallback to generated dossier
    }

    const content =
      `DKTE TEI PLACEMENT MANAGEMENT SYSTEM - CANDIDATE PLACEMENT DOSSIER\n` +
      `===================================================================\n` +
      `PRN:                ${studentDisplay.prn}\n` +
      `Candidate Name:     ${studentDisplay.name}\n` +
      `Official Email:     ${studentDisplay.email}\n` +
      `Department:         ${studentDisplay.branch} (${studentDisplay.deptCode || "ENGG"})\n` +
      `Graduation Batch:   ${studentDisplay.graduationYear || 2026}\n` +
      `Academic Pathway:   ${studentDisplay.academicPathway}\n` +
      `Current CGPA:       ${studentDisplay.cgpa !== null ? Number(studentDisplay.cgpa).toFixed(2) : "N/A"}\n` +
      `Active Backlogs:    ${studentDisplay.backlogs}\n` +
      `10th Percentage:    ${studentDisplay.tenthPercentage ? studentDisplay.tenthPercentage + "%" : "N/A"}\n` +
      `12th Percentage:    ${studentDisplay.twelfthPercentage ? studentDisplay.twelfthPercentage + "%" : "N/A"}\n` +
      `Diploma Percentage: ${studentDisplay.diplomaPercentage ? studentDisplay.diplomaPercentage + "%" : "N/A"}\n` +
      `Placement Status:   ${studentDisplay.status}\n` +
      `Recruiting Org:     ${studentDisplay.organization || "Unplaced"}\n` +
      `Package CTC:        ${studentDisplay.packageLPA ? "₹" + Number(studentDisplay.packageLPA).toFixed(2) + " LPA" : "N/A"}\n` +
      `Verification Date:  ${new Date().toLocaleDateString("en-IN")}\n` +
      `===================================================================\n` +
      `This dossier is officially verified by the DKTE Training & Placement Office.\n`;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${studentDisplay.prn}_Placement_Dossier.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <aside aria-label="Candidate Dossier" className="w-screen max-w-md bg-white border-l border-[#E5E7EB] shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-5 border-b border-[#E5E7EB] flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-[#111827] text-[#FECC00] flex items-center justify-center font-bold text-sm tracking-wider">
                {studentDisplay.prn.slice(-3)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-gray-900">{studentDisplay.name}</h2>
                  <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                    {studentDisplay.prn}
                  </span>
                  {isLoadingApi && (
                    <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{studentDisplay.branch}</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onEditStudent) onEditStudent(studentDisplay);
                }}
                title="Edit Candidate Details"
                className="text-gray-400 hover:text-gray-700 p-1.5 rounded hover:bg-gray-100 transition cursor-pointer"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-700 p-1.5 rounded hover:bg-gray-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Contact Strip */}
            <div className="flex items-center justify-between p-3 rounded bg-slate-50 border border-[#E5E7EB] text-xs">
              <div className="flex items-center gap-2 text-gray-600 truncate">
                <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="font-mono truncate">{studentDisplay.email}</span>
              </div>
              <button
                type="button"
                onClick={handleCopyEmail}
                title="Copy Email"
                className="text-gray-500 hover:text-gray-900 p-1 rounded hover:bg-white transition flex items-center gap-1 text-[11px] font-semibold"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </button>
            </div>

            {/* Academic Standing Card */}
            <div className="border border-[#E5E7EB] rounded p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-900 uppercase tracking-wider">
                  <GraduationCap className="w-4 h-4 text-gray-600" />
                  <span>Verified Academic Profile</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                  VERIFIED
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-2.5 rounded bg-slate-50 border border-slate-200/80">
                  <div className="text-[11px] text-gray-500">Cumulative CGPA</div>
                  <div className="text-xl font-bold text-gray-900 tabular-nums mt-0.5">
                    {studentDisplay.cgpa !== null ? Number(studentDisplay.cgpa).toFixed(2) : "—"}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Scale: 10.0</div>
                </div>

                <div className="p-2.5 rounded bg-slate-50 border border-slate-200/80">
                  <div className="text-[11px] text-gray-500">Active Backlogs</div>
                  <div className="text-xl font-bold text-gray-900 tabular-nums mt-0.5">
                    {studentDisplay.backlogs}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    {studentDisplay.backlogs === 0 ? "Clear history" : "Requires clearance"}
                  </div>
                </div>

                <div className="p-2.5 rounded bg-slate-50 border border-slate-200/80">
                  <div className="text-[11px] text-gray-500">10th Standard (SSC)</div>
                  <div className="text-sm font-bold text-gray-900 tabular-nums mt-0.5">
                    {studentDisplay.tenthPercentage ? `${studentDisplay.tenthPercentage}%` : "—"}
                  </div>
                </div>

                <div className="p-2.5 rounded bg-slate-50 border border-slate-200/80">
                  <div className="text-[11px] text-gray-500">
                    {studentDisplay.academicPathway === "DIPLOMA" ? "Diploma Score" : "12th Standard (HSC)"}
                  </div>
                  <div className="text-sm font-bold text-gray-900 tabular-nums mt-0.5">
                    {studentDisplay.academicPathway === "DIPLOMA"
                      ? `${studentDisplay.diplomaPercentage}%`
                      : studentDisplay.twelfthPercentage
                      ? `${studentDisplay.twelfthPercentage}%`
                      : "—"}
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-gray-500 flex items-center justify-between border-t border-gray-100 pt-2">
                <span>Pathway: <strong>{studentDisplay.academicPathway || "HSC"}</strong></span>
                <span>Graduation Year: <strong>{studentDisplay.graduationYear || 2026}</strong></span>
              </div>
            </div>

            {/* Current Placement Outcome */}
            <div className="border border-[#E5E7EB] rounded p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-900 uppercase tracking-wider">
                <Award className="w-4 h-4 text-gray-600" />
                <span>Placement Outcome</span>
              </div>

              {studentDisplay.status === "Placed" ? (
                <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-950">
                      Offer Confirmed
                    </span>
                    <span className="text-xs font-bold text-emerald-800 tabular-nums bg-emerald-100/80 px-2 py-0.5 rounded">
                      ₹{Number(studentDisplay.packageLPA || 0).toFixed(2)} LPA
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-gray-900">
                    {studentDisplay.organization || "Selected Candidate"}
                  </div>
                  <div className="text-[11px] text-emerald-800">
                    Official offer letter verified by TPO Office.
                  </div>
                </div>
              ) : studentDisplay.status === "In Review" ? (
                <div className="p-3 bg-amber-50/60 border border-amber-200 rounded space-y-1.5">
                  <div className="text-xs font-bold text-amber-950">Recruitment In Progress</div>
                  <div className="text-sm font-semibold text-gray-900">{studentDisplay.organization}</div>
                  <div className="text-[11px] text-amber-800">
                    Active interview / evaluation stage in current campus drive.
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded text-center">
                  <div className="text-xs font-semibold text-gray-700">Open to Recruitment Drives</div>
                  <div className="text-[11px] text-gray-500 mt-1">
                    Eligible for upcoming recruitment notifications matching criteria.
                  </div>
                </div>
              )}
            </div>

            {/* Candidate Documents (Resume & Marksheets) */}
            <div className="border border-[#E5E7EB] rounded p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-900 uppercase tracking-wider">
                  <FileText className="w-4 h-4 text-gray-600" />
                  <span>Candidate Documents</span>
                </div>
                <span className="text-[11px] font-medium text-gray-500">
                  Verified Records
                </span>
              </div>

              <div className="space-y-2">
                {/* Resume Card */}
                <div className="p-3 rounded bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 truncate">
                        {studentDisplay.prn}_Resume.pdf
                      </div>
                      <div className="text-[11px] text-gray-500">
                        Primary Placement Resume
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsPreviewModalOpen(true)}
                      title="View Verified Placement Dossier"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 text-xs font-semibold transition cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>View</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadResume}
                      title="Download Placement Dossier"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-dkte-gold hover:bg-dkte-gold-hover text-[#111827] text-xs font-bold transition shadow-2xs cursor-pointer active:scale-[0.98]"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-[#E5E7EB] bg-slate-50 flex items-center justify-between gap-2">
            <div>
              {onDeleteStudent && (
                <button
                  type="button"
                  onClick={() => {
                    onDeleteStudent(studentDisplay);
                  }}
                  className="inline-flex items-center gap-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 text-xs font-semibold px-3 py-2 rounded transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Candidate</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {onEditStudent && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEditStudent(studentDisplay);
                  }}
                  className="bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 text-xs font-semibold px-3.5 py-2 rounded transition inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit Candidate</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="bg-gray-900 hover:bg-black text-white text-xs font-semibold px-4 py-2 rounded transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Verified Candidate Placement Document Preview Modal */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsPreviewModalOpen(false)}
          />

          <div className="relative w-full max-w-xl bg-white border border-[#E5E7EB] rounded-lg shadow-2xl overflow-hidden z-10 animate-fadeIn flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded bg-[#FECC00] text-[#111827] flex items-center justify-center font-bold text-xs flex-shrink-0">
                  DKTE
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100">
                    Official Candidate Placement Dossier
                  </h3>
                  <div className="text-[11px] text-slate-400 font-mono">
                    {studentDisplay.prn} • {studentDisplay.name}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsPreviewModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Document Content */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs font-sans bg-[#F8FAFC]">
              {/* Institutional Header Banner */}
              <div className="p-4 bg-white border border-slate-200 rounded text-center space-y-1">
                <div className="font-bold text-sm text-gray-900 tracking-tight">
                  D.K.T.E. SOCIETY'S TEXTILE & ENGINEERING INSTITUTE, ICHALKARANJI
                </div>
                <div className="text-[11px] text-gray-500 font-medium">
                  Training & Placement Office • Central Placement Registry
                </div>
                <div className="pt-1 flex items-center justify-center gap-1.5 text-[11px] text-emerald-700 font-semibold">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Officially Verified Placement Record</span>
                </div>
              </div>

              {/* Personal & Academic Data Grid */}
              <div className="bg-white border border-slate-200 rounded p-4 space-y-3">
                <div className="font-bold text-gray-900 text-[11px] uppercase tracking-wider pb-1 border-b border-gray-100">
                  Candidate Credentials
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-gray-500 block text-[10px]">Candidate Full Name</span>
                    <span className="font-semibold text-gray-900">{studentDisplay.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px]">Permanent PRN</span>
                    <span className="font-mono font-bold text-gray-900">{studentDisplay.prn}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px]">Academic Department</span>
                    <span className="font-medium text-gray-900">{studentDisplay.branch}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px]">Graduation Batch</span>
                    <span className="font-mono font-medium text-gray-900">{studentDisplay.graduationYear || 2026}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px]">Official Email</span>
                    <span className="font-mono text-gray-800 break-all">{studentDisplay.email}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px]">Academic Pathway</span>
                    <span className="font-semibold text-gray-800">{studentDisplay.academicPathway}</span>
                  </div>
                </div>
              </div>

              {/* Academic Performance Matrix */}
              <div className="bg-white border border-slate-200 rounded p-4 space-y-3">
                <div className="font-bold text-gray-900 text-[11px] uppercase tracking-wider pb-1 border-b border-gray-100">
                  Academic Performance Records
                </div>

                <div className="grid grid-cols-3 gap-2.5 text-center">
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                    <span className="text-[10px] text-gray-500 block">10th Percentage</span>
                    <span className="font-bold text-gray-900 text-sm tabular-nums">
                      {studentDisplay.tenthPercentage ? `${studentDisplay.tenthPercentage}%` : "—"}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                    <span className="text-[10px] text-gray-500 block">
                      {studentDisplay.academicPathway === "DIPLOMA" ? "Diploma %" : "12th Percentage"}
                    </span>
                    <span className="font-bold text-gray-900 text-sm tabular-nums">
                      {studentDisplay.academicPathway === "DIPLOMA"
                        ? studentDisplay.diplomaPercentage
                          ? `${studentDisplay.diplomaPercentage}%`
                          : "—"
                        : studentDisplay.twelfthPercentage
                        ? `${studentDisplay.twelfthPercentage}%`
                        : "—"}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                    <span className="text-[10px] text-gray-500 block">Current CGPA</span>
                    <span className="font-bold text-blue-700 text-sm tabular-nums">
                      {studentDisplay.cgpa !== null ? Number(studentDisplay.cgpa).toFixed(2) : "—"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 px-1">
                  <span className="text-gray-500">Live Active Backlogs:</span>
                  <span className={`font-semibold tabular-nums ${studentDisplay.backlogs > 0 ? "text-rose-600" : "text-emerald-700"}`}>
                    {studentDisplay.backlogs === 0 ? "0 Active Backlogs (All Cleared)" : `${studentDisplay.backlogs} Active Backlog(s)`}
                  </span>
                </div>
              </div>

              {/* Placement Status Card */}
              <div className="bg-white border border-slate-200 rounded p-4 space-y-2">
                <div className="font-bold text-gray-900 text-[11px] uppercase tracking-wider pb-1 border-b border-gray-100 flex items-center justify-between">
                  <span>Recruitment & Offer Details</span>
                  <span className={`font-semibold text-[11px] px-2 py-0.5 rounded-full ${
                    studentDisplay.status === "Placed"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-slate-100 text-slate-700 border border-slate-200"
                  }`}>
                    {studentDisplay.status}
                  </span>
                </div>

                {studentDisplay.status === "Placed" ? (
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <span className="text-[10px] text-gray-500 block">Recruiting Company</span>
                      <span className="font-bold text-gray-900 text-sm">{studentDisplay.organization}</span>
                    </div>
                    {studentDisplay.packageLPA && (
                      <div className="text-right">
                        <span className="text-[10px] text-gray-500 block">Confirmed Compensation</span>
                        <span className="font-mono font-bold text-emerald-700 text-sm tabular-nums">
                          ₹{Number(studentDisplay.packageLPA).toFixed(2)} LPA
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 italic py-1">
                    Candidate is actively participating in ongoing placement drives.
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-white border-t border-[#E5E7EB] flex items-center justify-between gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => window.print()}
                className="bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded transition inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-gray-500" />
                <span>Print Dossier</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadResume}
                  className="bg-dkte-gold hover:bg-dkte-gold-hover text-[#111827] text-xs font-bold px-3.5 py-1.5 rounded transition shadow-2xs inline-flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Dossier (.txt)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="bg-gray-900 hover:bg-black text-white text-xs font-semibold px-4 py-1.5 rounded transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
} from "lucide-react";
import { getStudentByIdApi } from "../../../api/students";

export default function CandidateDossierDrawer({
  student,
  isOpen,
  onClose,
  onEditStudent,
}) {
  const [dossierData, setDossierData] = useState(student);
  const [isLoadingApi, setIsLoadingApi] = useState(false);

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

            {/* Drive Participation History */}
            <div className="border border-[#E5E7EB] rounded p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-900 uppercase tracking-wider">
                <Briefcase className="w-4 h-4 text-gray-600" />
                <span>Recruitment Drive Pipeline</span>
              </div>

              {studentDisplay.drivesParticipated && studentDisplay.drivesParticipated.length > 0 ? (
                <div className="space-y-2.5">
                  {studentDisplay.drivesParticipated.map((drive, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded bg-slate-50 border border-slate-200/80 flex items-start justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="font-semibold text-gray-900">{drive.company}</div>
                        <div className="text-[11px] text-gray-500">{drive.role}</div>
                        <div className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{drive.date}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-white border border-gray-200 text-gray-700">
                          {drive.status}
                        </span>
                        <div className="text-[11px] font-mono text-gray-600 font-semibold mt-1">
                          {drive.ctc}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-400 italic text-center py-3">
                  No previous drive participations recorded.
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-[#E5E7EB] bg-slate-50 flex items-center justify-end">
            <button
              type="button"
              onClick={onClose}
              className="bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 text-xs font-semibold px-4 py-2 rounded transition"
            >
              Close Dossier
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

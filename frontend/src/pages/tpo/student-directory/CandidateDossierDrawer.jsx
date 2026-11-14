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
} from "lucide-react";
import {
  getStudentByIdApi,
  getStudentDocumentsApi,
  downloadStudentDocumentApi,
  viewStudentDocumentApi,
} from "../../../api/students";

export default function CandidateDossierDrawer({
  student,
  isOpen,
  onClose,
  onEditStudent,
  onDeleteStudent,
}) {
  const [dossierData, setDossierData] = useState(student);
  const [isLoadingApi, setIsLoadingApi] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [downloadingDocId, setDownloadingDocId] = useState(null);

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
            const rawStatus =
              apiStudent.placementStatus ||
              apiStudent.selection?.status ||
              "NOT_SELECTED";

            const companyName =
              apiStudent.companyName ||
              apiStudent.selection?.drive?.company?.name ||
              apiStudent.selection?.company?.name ||
              null;

            const packageLPA =
              apiStudent.packageLPA ??
              apiStudent.selection?.packageLPA ??
              null;

            let status = "Unplaced";
            if (rawStatus === "OFFER_ACCEPTED") {
              status = "Placed / Confirmed";
            } else if (rawStatus === "SELECTED") {
              status = "Selected";
            } else if (rawStatus === "OFFER_DECLINED") {
              status = "Offer Declined";
            }

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
              status: status !== "Unplaced" ? status : prev.status || "Unplaced",
              rawPlacementStatus: rawStatus,
              organization: companyName || prev.organization,
              packageLPA: packageLPA ?? prev.packageLPA,
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

  // Fetch live student documents from GET /api/v1/students/:studentId/documents
  useEffect(() => {
    if (!isOpen || !student?.id) {
      setDocuments([]);
      return;
    }

    let isCurrent = true;
    setIsLoadingDocs(true);

    getStudentDocumentsApi(student.id)
      .then((res) => {
        if (!isCurrent) return;
        if (res?.documents && Array.isArray(res.documents)) {
          setDocuments(res.documents);
        } else {
          setDocuments([]);
        }
      })
      .catch((err) => {
        console.warn("Could not fetch candidate documents:", err.message);
        if (isCurrent) setDocuments([]);
      })
      .finally(() => {
        if (isCurrent) setIsLoadingDocs(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [isOpen, student?.id]);

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

  const handleDownloadDoc = async (doc) => {
    try {
      setDownloadingDocId(doc.id);
      await downloadStudentDocumentApi(doc.id, doc.fileName);
    } catch (err) {
      alert(`Could not download document: ${err.message}`);
    } finally {
      setDownloadingDocId(null);
    }
  };

  const handleViewDoc = async (doc) => {
    try {
      setDownloadingDocId(doc.id);
      await viewStudentDocumentApi(doc.id);
    } catch (err) {
      alert(`Could not open document: ${err.message}`);
    } finally {
      setDownloadingDocId(null);
    }
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
              <div className="flex items-center justify-between text-xs font-bold text-gray-900 uppercase tracking-wider pb-1 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-gray-600" />
                  <span>Placement Outcome</span>
                </div>
                <span
                  className={`font-semibold text-[11px] px-2.5 py-0.5 rounded-full ${
                    studentDisplay.status === "Placed / Confirmed" ||
                    studentDisplay.status === "Placed" ||
                    studentDisplay.rawPlacementStatus === "OFFER_ACCEPTED"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : studentDisplay.status === "Selected" ||
                        studentDisplay.rawPlacementStatus === "SELECTED"
                      ? "bg-blue-50 text-blue-800 border border-blue-200"
                      : studentDisplay.status === "Offer Declined" ||
                        studentDisplay.rawPlacementStatus === "OFFER_DECLINED"
                      ? "bg-amber-50 text-amber-800 border border-amber-200"
                      : "bg-slate-100 text-slate-700 border border-slate-200"
                  }`}
                >
                  {studentDisplay.status}
                </span>
              </div>

              {studentDisplay.status === "Placed / Confirmed" ||
              studentDisplay.status === "Placed" ||
              studentDisplay.rawPlacementStatus === "OFFER_ACCEPTED" ? (
                <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-950">
                      Offer Confirmed
                    </span>
                    {studentDisplay.packageLPA && (
                      <span className="text-xs font-bold font-mono text-emerald-800 tabular-nums bg-emerald-100/80 px-2 py-0.5 rounded">
                        ₹{Number(studentDisplay.packageLPA).toFixed(2)} LPA
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-gray-900">
                    {studentDisplay.organization || "Corporate Partner"}
                  </div>
                  <div className="text-[11px] text-emerald-900 leading-relaxed font-medium">
                    Institutional Clause 4.2 Placement Lockdown Active: Candidate has officially accepted this appointment.
                  </div>
                </div>
              ) : studentDisplay.status === "Selected" ||
                studentDisplay.rawPlacementStatus === "SELECTED" ? (
                <div className="p-3 bg-blue-50/60 border border-blue-200 rounded space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-950">
                      Selection Pending Confirmation
                    </span>
                    {studentDisplay.packageLPA && (
                      <span className="text-xs font-bold font-mono text-blue-800 tabular-nums bg-blue-100/80 px-2 py-0.5 rounded">
                        ₹{Number(studentDisplay.packageLPA).toFixed(2)} LPA
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-gray-900">
                    {studentDisplay.organization || "Corporate Partner"}
                  </div>
                  <div className="text-[11px] text-blue-900 leading-relaxed">
                    Selected by recruiter; placement pending student offer acceptance. Clause 4.2 profile lock is NOT active until confirmed.
                  </div>
                </div>
              ) : studentDisplay.status === "Offer Declined" ||
                studentDisplay.rawPlacementStatus === "OFFER_DECLINED" ? (
                <div className="p-3 bg-amber-50/60 border border-amber-200 rounded space-y-1.5">
                  <div className="text-xs font-bold text-amber-950">Offer Declined</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {studentDisplay.organization || "Corporate Partner"}
                  </div>
                  <div className="text-[11px] text-amber-900 leading-relaxed">
                    Candidate declined offer. Profile remains active and unreserved for upcoming campus drives.
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded text-center">
                  <div className="text-xs font-semibold text-gray-800">Not Placed</div>
                  <div className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                    Currently not placed with an official corporate partner. Eligible for upcoming recruitment drives matching academic cutoffs.
                  </div>
                </div>
              )}
            </div>

            {/* Candidate Documents (Resume, Marksheets, Transcripts) */}
            <div className="border border-[#E5E7EB] rounded p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-900 uppercase tracking-wider">
                  <FileText className="w-4 h-4 text-gray-600" />
                  <span>Candidate Documents</span>
                  {documents.length > 0 && (
                    <span className="font-mono text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-semibold">
                      {documents.length}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-medium text-gray-500">
                  Verified Records
                </span>
              </div>

              <div className="space-y-2">
                {isLoadingDocs ? (
                  <div className="p-4 text-center text-xs text-gray-500 flex items-center justify-center gap-2 bg-slate-50 rounded border border-slate-200">
                    <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                    <span>Loading verified documents...</span>
                  </div>
                ) : documents.length > 0 ? (
                  documents.map((doc) => {
                    const isDownloadingThis = downloadingDocId === doc.id;
                    const docTypeLabel =
                      doc.documentType === "RESUME"
                        ? "Resume"
                        : doc.documentType === "TRANSCRIPT"
                        ? "Transcript"
                        : doc.documentType === "CERTIFICATE"
                        ? "Certificate"
                        : "Document";

                    return (
                      <div
                        key={doc.id}
                        className="p-3 rounded bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 truncate" title={doc.fileName}>
                              {doc.fileName}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
                              <span className="px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-medium text-[10px]">
                                {docTypeLabel}
                              </span>
                              {doc.uploadedAt && (
                                <span className="tabular-nums">
                                  {new Date(doc.uploadedAt).toLocaleDateString("en-IN")}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleViewDoc(doc)}
                            disabled={isDownloadingThis}
                            title="View document in new tab"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadDoc(doc)}
                            disabled={isDownloadingThis}
                            title="Download document"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-dkte-gold hover:bg-dkte-gold-hover text-[#111827] text-xs font-bold transition shadow-2xs cursor-pointer active:scale-[0.98] disabled:opacity-50"
                          >
                            {isDownloadingThis ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                            <span>Download</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-2.5 bg-slate-50 border border-dashed border-slate-300 rounded text-center text-[11px] text-gray-500">
                    No student-uploaded files found in registry.
                  </div>
                )}
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
    </div>
  );
}

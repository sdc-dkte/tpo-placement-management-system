import React, { useState, useEffect, useRef } from "react";
import {
  X,
  ClipboardPaste,
  CheckCircle2,
  AlertTriangle,
  Lock,
  FileText,
  Upload,
} from "lucide-react";

/**
 * Method B: Pro TPO Bulk PRN Paste Modal
 * 
 * Allows TPO to paste candidate PRNs directly from the recruiter's selection email
 * or result sheet, validates them against the drive's eligible students pool in real-time,
 * and confirms placements with DKTE Clause 4.2 Placement Lockdown.
 */
export default function BulkPrnPasteModal({
  isOpen,
  onClose,
  drive,
  eligibleStudents = [],
  onConfirmPlacements,
}) {
  const dialogRef = useRef(null);

  const [rawPrnInput, setRawPrnInput] = useState("");
  const [confirmedPackage, setConfirmedPackage] = useState("");
  const [attachedFileName, setAttachedFileName] = useState("");
  const fileInputRef = useRef(null);

  // Sync native dialog
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
      if (drive?.packageLPA) {
        setConfirmedPackage(`₹${Number(drive.packageLPA).toFixed(2)} LPA`);
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen, drive]);

  // Real-time PRN extraction & verification
  const parsedPrns = rawPrnInput
    .split(/[\s,;\n\t]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  // Match against eligible students
  const verifiedStudents = [];
  const unrecognizedPrns = [];

  parsedPrns.forEach((prn) => {
    const matched = eligibleStudents.find(
      (s) => (s.PRN || s.prn || "").toUpperCase() === prn
    );
    if (matched) {
      if (!verifiedStudents.some((v) => (v.PRN || v.prn || "").toUpperCase() === prn)) {
        verifiedStudents.push(matched);
      }
    } else {
      if (!unrecognizedPrns.includes(prn)) {
        unrecognizedPrns.push(prn);
      }
    }
  });

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachedFileName(file.name);
    }
  };

  const handleConfirm = () => {
    if (verifiedStudents.length === 0 && parsedPrns.length === 0) {
      alert("Please enter or paste at least one candidate PRN.");
      return;
    }

    if (onConfirmPlacements) {
      onConfirmPlacements({
        students: verifiedStudents,
        manualPrns: parsedPrns,
        confirmedPackage,
        attachedFileName,
      });
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="bulk-prn-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="p-0 rounded border border-[#CBD5E1] shadow-2xl w-[750px] max-w-[95vw] bg-white text-[#111827] m-auto backdrop:bg-[#111827]/60 backdrop:backdrop-blur-xs"
    >
      {/* Modal Header */}
      <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between bg-white rounded-t select-none">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-[#111827] text-[#FECC00] font-bold flex items-center justify-center text-sm shadow-xs">
            <ClipboardPaste className="w-4 h-4 font-bold" />
          </div>
          <div>
            <h2 id="bulk-prn-title" className="font-bold text-sm text-[#111827]">
              Record Placed Candidates (Bulk PRN Paste)
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Method B: Paste PRNs sent by recruiter to update selections without row-by-row searching
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-[#111827] rounded hover:bg-slate-100 transition-colors"
          title="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Modal Body */}
      <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs bg-slate-50/40">
        {/* PRN Textarea */}
        <div>
          <label className="block text-gray-800 font-bold mb-1">
            Paste Selected Candidate PRNs (Comma, space, or newline separated) *
          </label>
          <textarea
            rows={3}
            value={rawPrnInput}
            onChange={(e) => setRawPrnInput(e.target.value)}
            placeholder="e.g. 21BCE042, 21BCE089, 21BAI014, 21BIT031"
            className="w-full text-xs font-mono p-3 bg-white border border-[#E5E7EB] rounded focus:border-[#111827] focus:ring-1 focus:ring-[#111827] focus:outline-none leading-relaxed"
          />
          <span className="text-[11px] text-gray-500 block mt-1">
            Copy and paste directly from the company recruiter's selection email or PDF list.
          </span>
        </div>

        {/* Package & Optional Attachment */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-700 font-semibold mb-1">
              Confirmed Package (₹ LPA) *
            </label>
            <input
              type="text"
              value={confirmedPackage}
              onChange={(e) => setConfirmedPackage(e.target.value)}
              required
              className="w-full text-xs font-mono font-bold px-3 py-2 bg-white border border-[#E5E7EB] rounded focus:border-[#111827] focus:outline-none tabular-nums"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1">
              Recruiter Result Sheet (Optional Proof)
            </label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.csv,.xlsx"
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 bg-white border border-[#E5E7EB] rounded text-[11px] text-gray-600 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-1.5 truncate">
                <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="truncate">
                  {attachedFileName || "Upload recruiter selection roster..."}
                </span>
              </div>
              <span className="text-blue-700 font-semibold shrink-0 ml-2">
                {attachedFileName ? "Attached" : "Browse"}
              </span>
            </div>
          </div>
        </div>

        {/* Real-time Verification Feedback */}
        {parsedPrns.length > 0 && (
          <div className="bg-emerald-50 border border-emerald-300 rounded p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
              <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>
                  {verifiedStudents.length} of {parsedPrns.length} Candidate PRNs Identified
                </span>
              </span>
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                LIVE VERIFICATION
              </span>
            </div>

            {/* Candidate Preview Cards */}
            {verifiedStudents.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                {verifiedStudents.map((student) => {
                  const prn = student.PRN || student.prn;
                  const name = student.name || student.user?.name || "Candidate";
                  const dept = student.department?.name || student.department?.code || "";
                  const cgpa = student.CGPA ?? student.cgpa;

                  return (
                    <div
                      key={prn}
                      className="p-2 bg-white rounded border border-emerald-200 flex flex-col justify-between shadow-2xs"
                    >
                      <span className="font-mono font-bold text-[#111827] block">
                        {prn}
                      </span>
                      <span className="text-gray-700 truncate">
                        {name} {dept ? `• ${dept}` : ""} {cgpa ? `(${cgpa})` : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Unrecognized PRNs Alert */}
            {unrecognizedPrns.length > 0 && (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Unrecognized PRNs ({unrecognizedPrns.length}): </span>
                  <span className="font-mono">{unrecognizedPrns.join(", ")}</span>
                  <span className="block text-[10px] text-amber-800 mt-0.5">
                    These students will be recorded with provided PRNs, but verify they are registered in the DKTE student database.
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* DKTE Clause 4.2 Policy Warning */}
        <div className="p-3 bg-amber-50 border border-amber-300 rounded text-amber-950 text-xs flex items-start gap-2">
          <Lock className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" />
          <div>
            <strong>DKTE Placement Clause 4.2 Lockdown:</strong> Confirming these placements will automatically lock these students' profiles from all subsequent campus placement drives.
          </div>
        </div>
      </div>

      {/* Modal Actions */}
      <div className="px-6 py-4 bg-white border-t border-[#E5E7EB] flex items-center justify-between rounded-b">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 border border-[#E5E7EB] rounded text-xs font-semibold text-gray-600 hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          className="px-5 py-2.5 bg-[#FECC00] hover:bg-[#E5B800] text-[#111827] font-bold text-xs rounded flex items-center gap-1.5 shadow-sm transition-all duration-150 cursor-pointer"
        >
          <Lock className="w-4 h-4 font-bold" />
          <span>
            Confirm Placements &amp; Freeze Profiles ({parsedPrns.length} Students)
          </span>
        </button>
      </div>
    </dialog>
  );
}

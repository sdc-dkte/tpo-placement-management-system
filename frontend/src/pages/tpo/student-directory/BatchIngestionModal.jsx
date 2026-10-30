import React, { useState } from "react";
import {
  X,
  Info,
  Download,
  FileDown,
  UploadCloud,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  ArrowRight,
  FileText,
} from "lucide-react";
import { uploadStudentBatchCsvApi } from "../../../api/students";
import { useAuth } from "../../../context/useAuth";

export default function BatchIngestionModal({ isOpen, onClose, onIngestionSuccess }) {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [ingestionResult, setIngestionResult] = useState(null);

  if (!isOpen) return null;

  // Generate and download a standard registrar CSV template
  const handleDownloadTemplate = () => {
    const csvContent =
      "PRN,name,email,departmentCode,graduationYear,academicPathway,CGPA,tenthPercentage,twelfthPercentage,diplomaPercentage,activeBacklogs\n" +
      "22CS001,Aarav Sharma,aarav.sharma@dkte.ac.in,CSE,2026,HSC,9.45,94.20,91.80,,0\n" +
      "22AL001,Siddharth Joshi,siddharth.joshi@dkte.ac.in,AIML,2026,HSC,8.75,88.00,85.40,,0\n" +
      "22AD001,Pooja Hegde,pooja.hegde@dkte.ac.in,AIDS,2026,HSC,9.15,91.00,89.20,,0\n" +
      "22ET001,Vikram Shinde,vikram.shinde@dkte.ac.in,ENTC,2026,DIPLOMA,8.10,82.00,,84.50,0\n" +
      "22EE001,Aditi Patil,aditi.patil@dkte.ac.in,ELEC,2026,HSC,8.25,85.00,83.00,,0\n" +
      "22ME001,Pratiksha Kulkarni,pratiksha.kulkarni@dkte.ac.in,MECH,2026,HSC,7.95,88.00,82.40,,0\n" +
      "22CV001,Digvijay Powar,digvijay.powar@dkte.ac.in,CIVIL,2026,HSC,7.80,82.50,78.00,,0\n";

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "dkte_registrar_student_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };


  // Download failed rows for correction
  const handleDownloadFailedRows = () => {
    const errors = ingestionResult?.errors || [];
    let csvContent = "RowNumber,PRN,ErrorMessage\n";
    errors.forEach((e) => {
      csvContent += `${e.rowNumber || ""},${e.PRN || ""},"${(e.message || e.errorMessage || "").replace(/"/g, '""')}"\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `failed_rows_batch_${ingestionResult?.batchId || "042"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Handle file drop or selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        setUploadError("Only .csv files are supported.");
        return;
      }
      setSelectedFile(file);
      setUploadError(null);
    }
  };

  // Quick load sample test file from public assets
  const handleLoadSampleFile = async (filePath, fileName) => {
    try {
      setUploadError(null);
      const res = await fetch(filePath);
      if (!res.ok) throw new Error("Could not load sample test file.");
      const blob = await res.blob();
      const file = new File([blob], fileName, { type: "text/csv" });
      setSelectedFile(file);
    } catch (err) {
      setUploadError(err.message || "Failed to load sample test CSV.");
    }
  };

  // Execute ingestion upload to existing backend
  const handleExecuteUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadError(null);

    // Helper to extract student names and departments from the uploaded CSV text
    const enrichErrorsWithFile = async (rawErrors = []) => {
      try {
        const fileText = await selectedFile.text();
        const lines = fileText.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length <= 1) return rawErrors;

        const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
        const nameIdx = header.findIndex((h) => h.includes("name"));
        const prnIdx = header.findIndex((h) => h.includes("prn"));
        const deptIdx = header.findIndex(
          (h) => h.includes("department") || h.includes("dept")
        );

        return rawErrors.map((err) => {
          let name = err.name;
          let dept = err.dept;

          // Match by rowNumber (row 2 in CSV is lines[1])
          const lineIndex = err.rowNumber ? err.rowNumber - 1 : -1;
          if (lineIndex > 0 && lineIndex < lines.length) {
            const parts = lines[lineIndex].split(",").map((p) => p.trim());
            if (!name && nameIdx !== -1) name = parts[nameIdx];
            if (!dept && deptIdx !== -1) dept = parts[deptIdx];
          }

          // Fallback match by PRN
          if (!name && err.PRN && prnIdx !== -1) {
            const matchLine = lines.slice(1).find((l) => {
              const parts = l.split(",").map((p) => p.trim());
              return parts[prnIdx] === err.PRN;
            });
            if (matchLine) {
              const parts = matchLine.split(",").map((p) => p.trim());
              if (nameIdx !== -1) name = parts[nameIdx];
              if (!dept && deptIdx !== -1) dept = parts[deptIdx];
            }
          }

          return {
            ...err,
            name: name || err.name || null,
            dept: dept || err.dept || (err.PRN && err.PRN.length >= 4 ? err.PRN.substring(2, 4) : null),
          };
        });
      } catch {
        return rawErrors;
      }
    };

    try {
      const data = await uploadStudentBatchCsvApi(selectedFile);

      if (data && data.success) {
        const enrichedErrors = await enrichErrorsWithFile(data.errors || []);

        setIngestionResult({
          batchId: data.batchId || 0,
          totalRows: data.totalRows || 0,
          successfulRows: data.successfulRows || 0,
          failedRows: data.failedRows || 0,
          errors: enrichedErrors,
          credentials: data.credentials || [],
          fileName: selectedFile.name,
          fileSize: `${(selectedFile.size / 1024).toFixed(1)} KB`,
        });
        if (typeof onIngestionSuccess === "function") {
          onIngestionSuccess(data);
        }
      } else {
        throw new Error(data?.message || "Import failed on server.");
      }
    } catch (err) {
      console.error("Backend student batch upload failed:", err);
      const serverData = err.data;
      if (serverData && (serverData.errors || serverData.failedRows !== undefined)) {
        const enrichedErrors = await enrichErrorsWithFile(serverData.errors || []);

        setIngestionResult({
          batchId: serverData.batchId || "ERROR",
          totalRows: serverData.totalRows || 0,
          successfulRows: serverData.successfulRows || 0,
          failedRows: serverData.failedRows || (serverData.errors ? serverData.errors.length : 0),
          errors: enrichedErrors,
          credentials: serverData.credentials || [],
          fileName: selectedFile.name,
          fileSize: `${(selectedFile.size / 1024).toFixed(1)} KB`,
        });
      }
      setUploadError(err.message || "CSV batch upload rejected by backend API.");
    } finally {
      setIsUploading(false);
    }
  };

  const resetIngestion = () => {
    setSelectedFile(null);
    setIngestionResult(null);
    setUploadError(null);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-[760px] bg-white border border-[#E5E7EB] rounded-lg shadow-2xl overflow-hidden flex flex-col z-50 max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 border-b border-[#E5E7EB] flex items-start justify-between bg-white flex-shrink-0">
          <div>
            <div className="flex items-center gap-2.5">
              <img
                src="/dkte-logo.png"
                alt="DKTE Logo"
                className="h-5 w-auto object-contain flex-shrink-0"
              />
              <h2 className="text-[18px] font-bold text-gray-900 tracking-tight">
                Batch Student Ingestion — AY 2025–26
              </h2>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Upload official registrar student records, validate academic thresholds across departments, and auto-provision placement credentials.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Section 1: Template & Upload Guidelines Banner */}
          <div className="bg-slate-50 border border-[#E5E7EB] p-3.5 rounded flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
            <div className="flex items-start gap-2.5 text-xs text-gray-600">
              <Info className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                Supports single-department or multi-department CSV batches. Official DKTE department codes:{" "}
                <span className="font-mono font-semibold text-gray-800">
                  CSE, AIML, AIDS, ENTC, ELEC, MECH, CIVIL
                </span>
                .
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="bg-white hover:bg-gray-50 border border-gray-300 text-gray-800 text-xs font-semibold px-3 py-1.5 rounded flex items-center gap-1.5 whitespace-nowrap shadow-2xs transition flex-shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-gray-600" />
              <span>Download CSV Template (.csv)</span>
            </button>
          </div>

          {/* Section 2: File Selector / Dropzone (if not yet processed) */}
          {!ingestionResult && (
            <div className="space-y-4">
              <label
                htmlFor="student-csv-file-input"
                className="border-2 border-dashed border-gray-300 hover:border-gray-400 rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer transition bg-slate-50/50"
              >
                <UploadCloud className="w-9 h-9 text-gray-400 mb-2" />
                <span className="text-xs font-semibold text-gray-900">
                  {selectedFile ? selectedFile.name : "Select or drag & drop student CSV roster"}
                </span>
                <span className="text-[11px] text-gray-500 mt-1">
                  Supports UTF-8 encoded .csv files up to 2 MB
                </span>
                <input
                  id="student-csv-file-input"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              {/* Sample Data Loaders */}
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <span className="text-[11px] font-semibold text-gray-500">Sample Templates:</span>
                <button
                  type="button"
                  onClick={() =>
                    handleLoadSampleFile(
                      "/dkte_batch_2026_clean_testing.csv",
                      "dkte_batch_2026_clean_testing.csv"
                    )
                  }
                  className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-md transition shadow-2xs cursor-pointer flex items-center gap-1.5"
                >
                  <FileText className="w-3 h-3 text-emerald-600" />
                  <span>Standard Batch (18 Students)</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleLoadSampleFile(
                      "/dkte_batch_2026_with_errors.csv",
                      "dkte_batch_2026_with_errors.csv"
                    )
                  }
                  className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-md transition shadow-2xs cursor-pointer flex items-center gap-1.5"
                >
                  <FileText className="w-3 h-3 text-amber-600" />
                  <span>Discrepancy Audit (8 Errors)</span>
                </button>
              </div>


              {uploadError && (
                <div className="text-xs text-rose-600 font-medium flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" />
                  <span>{uploadError}</span>
                </div>
              )}

              {selectedFile && (
                <div className="flex items-center justify-between p-3 bg-slate-100 rounded border border-slate-200">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-700" />
                    <span className="text-xs font-semibold text-gray-900">{selectedFile.name}</span>
                    <span className="text-[11px] text-gray-500">
                      ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={handleExecuteUpload}
                    className="bg-dkte-gold hover:bg-dkte-gold-hover text-[#111827] text-xs font-bold px-4 py-1.5 rounded transition flex items-center gap-1.5 shadow-xs"
                  >
                    {isUploading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Validating Batch...</span>
                      </>
                    ) : (
                      <>
                        <span>Validate & Ingest Records</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Section 3: Ingestion Audit Results (Rendered once processed) */}
          {ingestionResult && (
            <div className="space-y-4">
              {ingestionResult.failedRows === 0 ? (
                /* All Rows Succeeded */
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-8 text-center space-y-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-emerald-950">
                      {ingestionResult.successfulRows} Candidates Successfully Ingested
                    </h3>
                    <p className="text-xs text-emerald-700 mt-1 max-w-md mx-auto leading-relaxed">
                      All records from <span className="font-semibold">{ingestionResult.fileName}</span> have been validated, user accounts created, and added directly to the Master Candidate Roster.
                    </p>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-6 py-2.5 text-xs font-bold text-gray-950 bg-[#FECC00] hover:bg-[#E5B800] rounded shadow-xs transition inline-flex items-center gap-1.5"
                    >
                      <span>Close & View Master Roster</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                /* Discrepancies exist: show breakdown and error table */
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Box 1: Ingestion Success Count */}
                    <div className="bg-emerald-50/80 border border-emerald-200/90 rounded p-3.5 flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold leading-none">
                        ✓
                      </span>
                      <div>
                        <div className="text-[13px] font-bold text-emerald-950">
                          {ingestionResult.successfulRows} Candidates Ingested
                        </div>
                        <div className="text-[10px] text-emerald-800">
                          Added directly to candidate roster
                        </div>
                      </div>
                    </div>

                    {/* Box 2: Validation Failures */}
                    <div className="bg-amber-50/80 border border-amber-200/90 rounded p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs font-bold leading-none">
                          !
                        </span>
                        <div>
                          <div className="text-[13px] font-bold text-amber-950">
                            {ingestionResult.failedRows} Records Failed Validation
                          </div>
                          <div className="text-[10px] text-amber-800">
                            Syntax & integrity exceptions identified
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleDownloadFailedRows}
                        className="bg-white hover:bg-amber-50 border border-amber-300 text-amber-950 text-[11px] font-semibold px-2.5 py-1 rounded shadow-xs transition whitespace-nowrap flex items-center gap-1"
                      >
                        <FileDown className="w-3 h-3 text-amber-800" />
                        <span>Export Failed Rows</span>
                      </button>
                    </div>
                  </div>

              {/* In-Line Error Remediation Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Validation Discrepancies Requiring TPO Review
                  </h3>
                  <span className="text-[11px] text-gray-500 font-mono">
                    {ingestionResult.failedRows} / {ingestionResult.totalRows} Rows Flagged
                  </span>
                </div>

                <div className="border border-[#E5E7EB] rounded overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-[#E5E7EB] text-[11px] font-semibold text-gray-500 uppercase h-8">
                        <th className="w-16 pl-3 py-1.5">Row #</th>
                        <th className="w-24 px-2 py-1.5">PRN</th>
                        <th className="w-32 px-2 py-1.5">Student Name</th>
                        <th className="w-16 px-2 py-1.5">Dept</th>
                        <th className="px-3 py-1.5">Identified Error Reason</th>
                        <th className="w-36 pr-3 py-1.5 text-right">Suggested Fix</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs">
                      {ingestionResult.errors && ingestionResult.errors.length > 0 ? (
                        ingestionResult.errors.map((err, i) => (
                          <tr key={i} className="h-11 hover:bg-rose-50/30 bg-white">
                            <td className="pl-3 py-2 font-mono text-gray-500 text-[11px]">
                              Row {err.rowNumber || i + 1}
                            </td>
                            <td className="px-2 py-2 font-mono font-medium text-gray-900">
                              {err.PRN || "—"}
                            </td>
                            <td className="px-2 py-2 font-medium text-gray-900">
                              {err.name || "—"}
                            </td>
                            <td className="px-2 py-2">
                              <span
                                className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold ${
                                  err.deptBadge || "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {err.dept || (err.PRN && err.PRN.length >= 4 ? err.PRN.substring(2, 4) : "—")}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-rose-600 font-medium">
                              {err.message || err.errorMessage}
                            </td>
                            <td className="pr-3 py-2 text-right">
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                                {err.suggestedFix || "Update in CSV"}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-4 text-center text-gray-400 text-xs">
                            No row discrepancies found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Quick Checklist Notes */}
              <div className="border-t border-gray-100 pt-3 flex items-center justify-between text-[11px] text-gray-500 flex-wrap gap-2">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-emerald-600" />
                    <span>Primary Key: PRN</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-blue-600" />
                    <span>Encrypted Student Auth</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 text-gray-500" />
                    <span>Autonomous Exam Cell Sync</span>
                  </span>
                </div>
                <span className="text-gray-400">
                  File: {ingestionResult.fileName} ({ingestionResult.fileSize})
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-[#E5E7EB] flex items-center justify-between flex-shrink-0 flex-wrap gap-3">
          <div className="text-[11px] font-mono text-gray-500">
            {ingestionResult?.batchId ? (
              <>
                Batch Ref:{" "}
                <span className="font-semibold text-gray-800">
                  #{ingestionResult.batchId}
                </span>{" "}
                • Officer:{" "}
                <span className="text-gray-800 font-medium">
                  {user?.name || "TPO Administrator"}
                </span>
              </>
            ) : (
              <span>Institutional Placement Intake • AY 2025–26</span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 text-xs font-semibold px-4 py-2 rounded transition"
            >
              Close & View Roster
            </button>

            {ingestionResult && (
              <button
                type="button"
                onClick={resetIngestion}
                className="bg-dkte-gold hover:bg-dkte-gold-hover text-[#111827] text-xs font-bold px-4 py-2 rounded transition flex items-center gap-1.5 shadow-xs"
              >
                <span>Re-upload Corrected CSV</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

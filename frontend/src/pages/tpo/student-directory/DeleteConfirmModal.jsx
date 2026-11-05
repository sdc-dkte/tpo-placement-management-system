import React, { useState } from "react";
import { AlertTriangle, Trash2, X, Loader2 } from "lucide-react";

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  student = null,
  selectedCount = 0,
  isBulk = false,
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      console.error("Delete confirmation error:", err);
      setDeleteError(err.message || "Failed to remove candidate record.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md bg-white border border-[#E5E7EB] rounded-lg shadow-2xl overflow-hidden z-10 animate-fadeIn">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 flex-shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-gray-900 tracking-tight">
                {isBulk
                  ? `Remove ${selectedCount} Selected Candidates?`
                  : `Remove Candidate: ${student?.name || "Student"}?`}
              </h2>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                This will deactivate the candidate account and remove them from the active institutional placement roster.
              </p>

              {/* Candidate Info Box */}
              {!isBulk && student && (
                <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">PRN:</span>
                    <span className="font-mono font-bold text-gray-900">{student.prn}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Branch:</span>
                    <span className="font-medium text-gray-800">{student.branch}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Email:</span>
                    <span className="font-mono text-gray-700">{student.email}</span>
                  </div>
                </div>
              )}

              {isBulk && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 font-medium">
                  You are about to deactivate <span className="font-bold">{selectedCount} candidates</span> in batch. Their records will be excluded from the active roster.
                </div>
              )}

              {deleteError && (
                <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Footer Actions */}
          <div className="mt-6 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isDeleting}
              className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-md shadow-xs flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer active:scale-[0.98]"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Removing...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Confirm Deactivation</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

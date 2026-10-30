import React from "react";
import { Download, X } from "lucide-react";

export default function BulkActionBar({
  selectedCount = 0,
  onClearSelection,
  onExportSelected,
}) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#111827] text-white px-5 py-2.5 rounded-full shadow-xl border border-gray-700 flex items-center gap-4 text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200">
      <div className="flex items-center gap-2">
        <span className="w-5 h-5 rounded-full bg-[#FECC00] text-[#111827] flex items-center justify-center font-bold text-[11px] tabular-nums">
          {selectedCount}
        </span>
        <span>candidates selected</span>
      </div>

      <div className="h-4 w-px bg-gray-700" />

      <button
        type="button"
        onClick={onExportSelected}
        className="flex items-center gap-1.5 hover:text-[#FECC00] transition cursor-pointer"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Export Selected CSV</span>
      </button>

      <div className="h-4 w-px bg-gray-700" />

      <button
        type="button"
        onClick={onClearSelection}
        className="text-gray-400 hover:text-white transition flex items-center gap-1 cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
        <span>Clear</span>
      </button>
    </div>
  );
}

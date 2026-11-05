import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  pageSize = 25,
  onPageChange,
}) {
  const safeCurrentPage = Math.min(currentPage, Math.max(1, totalPages));
  const startItem = totalItems === 0 ? 0 : Math.min((safeCurrentPage - 1) * pageSize + 1, totalItems);
  const endItem = Math.min(safeCurrentPage * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between flex-wrap gap-3 text-xs text-gray-500 font-medium py-3 select-none">
      <div>
        Showing <span className="font-semibold text-gray-900 tabular-nums">{startItem}</span> to{" "}
        <span className="font-semibold text-gray-900 tabular-nums">{endItem}</span> of{" "}
        <span className="font-semibold text-gray-900 tabular-nums">{totalItems.toLocaleString()}</span>{" "}
        candidate records
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="px-2.5 py-1.5 rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 font-medium cursor-pointer"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Previous</span>
        </button>

        <button
          type="button"
          onClick={() => onPageChange(1)}
          className={`w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs transition cursor-pointer ${
            currentPage === 1
              ? "bg-[#111827] text-white shadow-xs"
              : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
          }`}
        >
          1
        </button>

        {totalPages >= 2 && (
          <button
            type="button"
            onClick={() => onPageChange(2)}
            className={`w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs transition cursor-pointer ${
              currentPage === 2
                ? "bg-[#111827] text-white shadow-xs"
                : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            2
          </button>
        )}

        {totalPages >= 3 && (
          <button
            type="button"
            onClick={() => onPageChange(3)}
            className={`w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs transition cursor-pointer ${
              currentPage === 3
                ? "bg-[#111827] text-white shadow-xs"
                : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            3
          </button>
        )}

        {totalPages > 4 && <span className="px-1 text-gray-400">...</span>}

        {totalPages > 3 && (
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            className={`w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs transition cursor-pointer ${
              currentPage === totalPages
                ? "bg-[#111827] text-white shadow-xs"
                : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {totalPages}
          </button>
        )}

        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="px-2.5 py-1.5 rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 font-medium cursor-pointer"
        >
          <span>Next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

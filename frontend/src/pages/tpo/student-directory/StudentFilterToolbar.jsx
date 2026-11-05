import React, { useRef, useEffect } from "react";
import { Search, RotateCcw, ChevronDown, UserPlus } from "lucide-react";

export default function StudentFilterToolbar({
  searchQuery,
  onSearchChange,
  cgpaFilter,
  onCgpaFilterChange,
  backlogFilter,
  onBacklogFilterChange,
  statusFilter,
  onStatusFilterChange,
  onClearFilters,
  totalCount,
  visibleCount,
  onAddStudent,
}) {
  const searchInputRef = useRef(null);

  // Global ⌘K / Ctrl+K shortcut listener to focus search input
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    cgpaFilter !== "ALL" ||
    backlogFilter !== "ALL" ||
    statusFilter !== "ALL";

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-lg p-3 flex items-center justify-between flex-wrap gap-3 shadow-xs">
      <div className="flex items-center gap-2.5 flex-wrap flex-1 min-w-[280px]">
        {/* Search Input with ⌘K Badge */}
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search candidate name, PRN..."
            className="w-full bg-slate-50/70 border border-gray-300 rounded-md pl-9 pr-12 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-900 focus:bg-white transition"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] bg-white border border-gray-200 text-gray-400 px-1 py-0.5 rounded font-mono shadow-2xs pointer-events-none">
            ⌘K
          </kbd>
        </div>

        {/* CGPA Aggregates Dropdown */}
        <div className="relative">
          <select
            value={cgpaFilter}
            onChange={(e) => onCgpaFilterChange(e.target.value)}
            aria-label="Filter by CGPA"
            className="appearance-none bg-white border border-gray-300 rounded-md pl-3 pr-8 py-1.5 text-xs text-gray-700 font-medium focus:outline-none focus:border-gray-900 cursor-pointer hover:border-gray-400 transition"
          >
            <option value="ALL">CGPA: All Aggregates</option>
            <option value="9.0">CGPA: ≥ 9.0</option>
            <option value="8.0">CGPA: ≥ 8.0</option>
            <option value="7.0">CGPA: ≥ 7.0</option>
            <option value="6.0">CGPA: ≥ 6.0</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Backlogs Filter Dropdown */}
        <div className="relative">
          <select
            value={backlogFilter}
            onChange={(e) => onBacklogFilterChange(e.target.value)}
            aria-label="Filter by Backlogs"
            className="appearance-none bg-white border border-gray-300 rounded-md pl-3 pr-8 py-1.5 text-xs text-gray-700 font-medium focus:outline-none focus:border-gray-900 cursor-pointer hover:border-gray-400 transition"
          >
            <option value="ALL">Backlogs: All</option>
            <option value="ZERO">Backlogs: 0 Live</option>
            <option value="HAS_BACKLOGS">Backlogs: 1+ Live</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Status Dropdown */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            aria-label="Filter by Placement Status"
            className="appearance-none bg-white border border-gray-300 rounded-md pl-3 pr-8 py-1.5 text-xs text-gray-700 font-medium focus:outline-none focus:border-gray-900 cursor-pointer hover:border-gray-400 transition"
          >
            <option value="ALL">Status: All ({totalCount})</option>
            <option value="Placed">Status: Placed</option>
            <option value="In Review">Status: In Review</option>
            <option value="Unplaced">Status: Unplaced</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 font-medium px-2 py-1 rounded-md hover:bg-gray-100 transition cursor-pointer"
          >
            <RotateCcw className="w-3 h-3 text-gray-400" />
            <span>Clear Filters</span>
          </button>
        )}
      </div>

      {/* Right Controls: Showing Count & + Add Student CTA */}
      <div className="flex items-center gap-3 ml-auto flex-wrap">
        <div className="text-xs text-gray-500 font-medium whitespace-nowrap">
          Showing <span className="font-semibold text-gray-900 tabular-nums">{visibleCount}</span> of{" "}
          <span className="font-semibold text-gray-900 tabular-nums">{totalCount}</span>
        </div>

        {onAddStudent && (
          <button
            type="button"
            onClick={onAddStudent}
            className="px-3.5 py-1.5 rounded-md bg-dkte-gold hover:bg-dkte-gold-hover text-[#111827] text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer active:scale-[0.98]"
          >
            <UserPlus className="w-3.5 h-3.5 text-[#111827]" />
            <span>+ Add Student</span>
          </button>
        )}
      </div>
    </div>
  );
}

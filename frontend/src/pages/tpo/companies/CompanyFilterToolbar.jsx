import React from "react";
import { Search, Plus, Building2, X } from "lucide-react";

/**
 * Filter toolbar for Company Directory:
 * - Search by company name
 * - Quick status filter tabs (All, Active, Inactive)
 * - Primary Action CTA: Onboard Recruiter
 */
export default function CompanyFilterToolbar({
  search,
  onSearchChange,
  activeFilter,
  onFilterChange,
  onAddCompany,
  totalCount = 0,
}) {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded p-4 space-y-3 shadow-2xs">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search recruiting partners by company name..."
            className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-[#E5E7EB] rounded text-[#111827] placeholder-gray-400 focus:outline-none focus:border-[#111827] transition"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 transition"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Primary CTA */}
        <button
          type="button"
          onClick={onAddCompany}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded bg-[#FECC00] hover:bg-[#e5b800] text-[#111827] text-xs font-semibold border border-[#FECC00] transition cursor-pointer shadow-2xs shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Onboard Recruiter</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 pt-2 border-t border-gray-100 text-xs">
        <span className="text-gray-400 text-[11px] font-medium mr-1 uppercase tracking-wider">
          Filter:
        </span>

        <button
          type="button"
          onClick={() => onFilterChange("ALL")}
          className={`px-2.5 py-1 rounded text-xs transition ${
            activeFilter === "ALL"
              ? "bg-[#111827] text-white font-medium"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          All Recruiters {totalCount > 0 && `(${totalCount})`}
        </button>

        <button
          type="button"
          onClick={() => onFilterChange("true")}
          className={`px-2.5 py-1 rounded text-xs transition ${
            activeFilter === "true"
              ? "bg-[#111827] text-white font-medium"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          Active Partners
        </button>

        <button
          type="button"
          onClick={() => onFilterChange("false")}
          className={`px-2.5 py-1 rounded text-xs transition ${
            activeFilter === "false"
              ? "bg-[#111827] text-white font-medium"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          Archived / Inactive
        </button>
      </div>
    </div>
  );
}

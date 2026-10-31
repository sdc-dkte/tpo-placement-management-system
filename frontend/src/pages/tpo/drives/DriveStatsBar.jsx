import React from "react";
import { Zap, Calendar, Award } from "lucide-react";

/**
 * 3 Focused KPI Cards (Low Cognitive Load)
 * Adheres strictly to DKTE standards:
 * - Monospace tabular numbers (tabular-nums font-mono)
 * - Near-black (#111827), clean slate (#F8FAFC), hairline borders (#E5E7EB)
 * - DKTE Gold (#FECC00) restrained accent
 */
export default function DriveStatsBar({
  activeDrivesCount = 0,
  upcomingCount = 0,
  placedStudentsCount = 0,
  upcomingCompanies = [],
}) {
  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* KPI 1: Active Drives */}
      <div className="bg-white border border-[#E5E7EB] rounded p-4.5 flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between text-xs text-gray-500 font-semibold uppercase tracking-wider">
          <span>Active Drives Now</span>
          <div className="w-8 h-8 rounded bg-[#FECC00]/20 flex items-center justify-center text-[#111827]">
            <Zap className="w-4 h-4 text-[#B45309]" />
          </div>
        </div>
        <div className="my-2">
          <span className="text-2xl font-bold font-mono text-[#111827] tabular-nums">
            {activeDrivesCount}
          </span>
        </div>
        <div className="text-[11px] text-gray-500">
          Actively receiving applications or conducting assessments
        </div>
      </div>

      {/* KPI 2: Upcoming Visits */}
      <div className="bg-white border border-[#E5E7EB] rounded p-4.5 flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between text-xs text-gray-500 font-semibold uppercase tracking-wider">
          <span>Upcoming Campus Visits</span>
          <div className="w-8 h-8 rounded bg-blue-50 flex items-center justify-center text-blue-600">
            <Calendar className="w-4 h-4" />
          </div>
        </div>
        <div className="my-2">
          <span className="text-2xl font-bold font-mono text-[#111827] tabular-nums">
            {upcomingCount} {upcomingCount === 1 ? "Company" : "Companies"}
          </span>
        </div>
        <div className="text-[11px] text-gray-500 truncate font-mono">
          {upcomingCompanies && upcomingCompanies.length > 0
            ? upcomingCompanies.slice(0, 3).join(", ")
            : "Scheduled on campus recruitment calendar"}
        </div>
      </div>

      {/* KPI 3: Placements Confirmed */}
      <div className="bg-white border border-[#E5E7EB] rounded p-4.5 flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between text-xs text-gray-500 font-semibold uppercase tracking-wider">
          <span>Placements Confirmed YTD</span>
          <div className="w-8 h-8 rounded bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Award className="w-4 h-4" />
          </div>
        </div>
        <div className="my-2">
          <span className="text-2xl font-bold font-mono text-emerald-700 tabular-nums">
            {placedStudentsCount} Placed
          </span>
        </div>
        <div className="text-[11px] text-gray-500">
          Verified selections with Clause 4.2 placement lock applied
        </div>
      </div>
    </section>
  );
}

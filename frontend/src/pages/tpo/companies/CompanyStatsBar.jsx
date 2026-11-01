import React from "react";
import { Building2, CheckCircle2, Briefcase, Calendar } from "lucide-react";

/**
 * KPI stats bar for Company Directory
 */
export default function CompanyStatsBar({
  totalCompanies = 0,
  activeCompanies = 0,
  totalJobRoles = 0,
  totalDrives = 0,
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Total Companies */}
      <div className="bg-white border border-[#E5E7EB] rounded p-4 flex items-center gap-3 shadow-2xs">
        <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center text-[#111827] shrink-0">
          <Building2 className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider truncate">
            Corporate Partners
          </div>
          <div className="text-xl font-bold text-[#111827] font-mono tabular-nums leading-tight">
            {totalCompanies}
          </div>
        </div>
      </div>

      {/* Active Recruiters */}
      <div className="bg-white border border-[#E5E7EB] rounded p-4 flex items-center gap-3 shadow-2xs">
        <div className="w-10 h-10 rounded bg-emerald-50 flex items-center justify-center text-emerald-700 shrink-0">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider truncate">
            Active Status
          </div>
          <div className="text-xl font-bold text-emerald-700 font-mono tabular-nums leading-tight">
            {activeCompanies}
          </div>
        </div>
      </div>

      {/* Total Job Roles */}
      <div className="bg-white border border-[#E5E7EB] rounded p-4 flex items-center gap-3 shadow-2xs">
        <div className="w-10 h-10 rounded bg-blue-50 flex items-center justify-center text-blue-700 shrink-0">
          <Briefcase className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider truncate">
            Registered Roles
          </div>
          <div className="text-xl font-bold text-[#111827] font-mono tabular-nums leading-tight">
            {totalJobRoles}
          </div>
        </div>
      </div>

      {/* Placement Drives Conducted */}
      <div className="bg-white border border-[#E5E7EB] rounded p-4 flex items-center gap-3 shadow-2xs">
        <div className="w-10 h-10 rounded bg-amber-50 flex items-center justify-center text-amber-700 shrink-0">
          <Calendar className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider truncate">
            Total Drives Linked
          </div>
          <div className="text-xl font-bold text-[#111827] font-mono tabular-nums leading-tight">
            {totalDrives}
          </div>
        </div>
      </div>
    </div>
  );
}

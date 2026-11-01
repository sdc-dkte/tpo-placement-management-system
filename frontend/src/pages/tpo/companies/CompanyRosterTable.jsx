import React from "react";
import {
  Building2,
  ExternalLink,
  Briefcase,
  Calendar,
  ChevronRight,
  Edit2,
  Loader2,
} from "lucide-react";

export default function CompanyRosterTable({
  companies = [],
  isLoading = false,
  onViewCompany,
  onEditCompany,
}) {
  if (isLoading) {
    return (
      <div className="bg-white border border-[#E5E7EB] rounded p-12 text-center text-gray-500 shadow-2xs">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#111827]" />
        <span className="text-xs">Loading corporate partner directory...</span>
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className="bg-white border border-[#E5E7EB] rounded p-12 text-center text-gray-500 shadow-2xs space-y-2">
        <Building2 className="w-8 h-8 mx-auto text-gray-400" />
        <div className="text-sm font-semibold text-[#111827]">
          No recruiting partners found
        </div>
        <p className="text-xs text-gray-500 max-w-sm mx-auto">
          No companies match your current search or status filter. Try clearing filters or onboard a new recruiter.
        </p>
      </div>
    );
  }

  return (
    <div
      tabIndex={0}
      role="region"
      aria-label="Recruiting Partners Table"
      className="bg-white border border-[#E5E7EB] rounded overflow-x-auto shadow-2xs focus:outline-none focus:ring-1 focus:ring-[#111827]"
    >
      <table className="w-full text-left text-xs border-collapse">
        <thead className="bg-[#F8FAFC] border-b border-[#E5E7EB] text-gray-500 text-[11px] uppercase tracking-wider sticky top-0 z-10">
          <tr>
            <th className="py-3 px-4 font-semibold">Recruiting Partner</th>
            <th className="py-3 px-4 font-semibold">Website</th>
            <th className="py-3 px-4 font-semibold text-center">Job Roles</th>
            <th className="py-3 px-4 font-semibold text-center">Drives Linked</th>
            <th className="py-3 px-4 font-semibold text-center">Status</th>
            <th className="py-3 px-4 font-semibold text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F1F5F9]">
          {companies.map((company) => {
            const initials = company.name
              ? company.name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()
              : "CO";

            return (
              <tr
                key={company.id}
                className="hover:bg-[#F8FAFC] transition group"
              >
                {/* Company Name & Description */}
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded bg-[#111827] text-[#FECC00] font-bold text-xs flex items-center justify-center shrink-0 border border-gray-700">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onViewCompany(company)}
                        className="text-xs font-bold text-[#111827] hover:underline text-left truncate block cursor-pointer"
                      >
                        {company.name}
                      </button>
                      {company.description ? (
                        <p className="text-[11px] text-gray-500 truncate max-w-xs md:max-w-md">
                          {company.description}
                        </p>
                      ) : (
                        <span className="text-[11px] text-gray-400 italic">
                          No description provided
                        </span>
                      )}
                    </div>
                  </div>
                </td>

                {/* Website */}
                <td className="py-3.5 px-4 font-mono text-[11px]">
                  {company.website ? (
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-gray-600 hover:text-[#111827] underline transition"
                    >
                      <span className="truncate max-w-[150px]">
                        {company.website.replace(/^https?:\/\//, "")}
                      </span>
                      <ExternalLink className="w-3 h-3 text-gray-400 shrink-0" />
                    </a>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>

                {/* Job Roles Count */}
                <td className="py-3.5 px-4 text-center">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-mono font-medium bg-blue-50 text-blue-800 border border-blue-200">
                    <Briefcase className="w-3 h-3 text-blue-600" />
                    <span>{company.jobRoleCount ?? 0}</span>
                  </span>
                </td>

                {/* Drives Count */}
                <td className="py-3.5 px-4 text-center">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-mono font-medium bg-amber-50 text-amber-800 border border-amber-200">
                    <Calendar className="w-3 h-3 text-amber-600" />
                    <span>{company.driveCount ?? 0}</span>
                  </span>
                </td>

                {/* Status */}
                <td className="py-3.5 px-4 text-center">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      company.isActive
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : "bg-gray-100 text-gray-600 border border-gray-200"
                    }`}
                  >
                    {company.isActive ? "Active" : "Archived"}
                  </span>
                </td>

                {/* Actions */}
                <td className="py-3.5 px-4 text-right">
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onEditCompany(company)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100 transition cursor-pointer"
                      title="Edit Recruiter"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onViewCompany(company)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#111827] hover:bg-black text-white text-[11px] font-medium transition cursor-pointer"
                    >
                      <span>Manage</span>
                      <ChevronRight className="w-3 h-3 text-[#FECC00]" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

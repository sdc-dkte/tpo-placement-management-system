import React from "react";
import {
  Check,
  AlertTriangle,
  ArrowRight,
  User,
  Pencil,
  Trash2,
  FileText,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";

function SortableTh({
  field,
  label,
  currentSortBy,
  currentSortOrder,
  onSort,
  className = "",
  align = "left",
}) {
  const isActive = currentSortBy === field;
  return (
    <th className={`py-2.5 px-3 select-none ${className}`}>
      {onSort ? (
        <button
          type="button"
          onClick={() => onSort(field)}
          className={`inline-flex items-center gap-1 group font-semibold uppercase tracking-wider text-[11px] hover:text-gray-900 transition-colors cursor-pointer ${
            isActive ? "text-gray-900" : "text-gray-500"
          } ${align === "center" ? "justify-center w-full" : ""}`}
        >
          <span>{label}</span>
          {isActive ? (
            currentSortOrder === "asc" ? (
              <ArrowUp className="w-3 h-3 text-blue-600 flex-shrink-0" />
            ) : (
              <ArrowDown className="w-3 h-3 text-blue-600 flex-shrink-0" />
            )
          ) : (
            <ArrowUpDown className="w-3 h-3 text-gray-300 opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          )}
        </button>
      ) : (
        <span className="font-semibold uppercase tracking-wider text-[11px] text-gray-500">
          {label}
        </span>
      )}
    </th>
  );
}

export default function StudentRosterTable({
  students = [],
  selectedIds = [],
  activeStudentId = null,
  sortBy = "name",
  sortOrder = "asc",
  onSort,
  onToggleSelect,
  onToggleSelectAll,
  onViewDossier,
  onEditStudent,
  onDeleteStudent,
}) {
  const isAllSelected =
    students.length > 0 && students.every((s) => selectedIds.includes(s.id));
  const isSomeSelected =
    students.some((s) => selectedIds.includes(s.id)) && !isAllSelected;

  const getInitials = (name = "") => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase() || "ST";
  };

  const getAvatarColor = (name = "") => {
    const colors = [
      "bg-slate-800 text-slate-100",
      "bg-blue-900 text-blue-100",
      "bg-emerald-900 text-emerald-100",
      "bg-amber-900 text-amber-100",
      "bg-indigo-900 text-indigo-100",
      "bg-teal-900 text-teal-100",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
    return colors[hash % colors.length];
  };

  return (
    <div className="bg-white border border-[#E5E7EB] rounded overflow-hidden shadow-xs">
      <div className="overflow-x-auto max-h-[70vh]">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-slate-50/95 backdrop-blur z-10 border-b border-[#E5E7EB]">
            <tr className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider h-10 select-none">
              <th className="pl-4 py-2 w-10">
                <input
                  type="checkbox"
                  aria-label="Select all students on current page"
                  checked={isAllSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = isSomeSelected;
                  }}
                  onChange={onToggleSelectAll}
                  className="rounded border-gray-300 text-gray-900 focus:ring-0 cursor-pointer"
                />
              </th>
              <SortableTh
                field="PRN"
                label="PRN"
                currentSortBy={sortBy}
                currentSortOrder={sortOrder}
                onSort={onSort}
                className="w-28"
              />
              <SortableTh
                field="name"
                label="Candidate Name & Email"
                currentSortBy={sortBy}
                currentSortOrder={sortOrder}
                onSort={onSort}
              />
              <th className="py-2.5 px-3">
                <span className="font-semibold uppercase tracking-wider text-[11px] text-gray-500">
                  Branch
                </span>
              </th>
              <SortableTh
                field="CGPA"
                label="CGPA"
                currentSortBy={sortBy}
                currentSortOrder={sortOrder}
                onSort={onSort}
                className="text-center w-24"
                align="center"
              />
              <th className="py-2.5 px-3 text-center w-28">
                <span className="font-semibold uppercase tracking-wider text-[11px] text-gray-500">
                  Backlogs
                </span>
              </th>
              <SortableTh
                field="placementStatus"
                label="Placement Status"
                currentSortBy={sortBy}
                currentSortOrder={sortOrder}
                onSort={onSort}
                className="w-36"
              />
              <th className="py-2.5 px-4 min-w-[200px]">
                <span className="font-semibold uppercase tracking-wider text-[11px] text-gray-500">
                  Placement Details
                </span>
              </th>
              <th className="py-2.5 px-4 text-right w-40">
                <span className="font-semibold uppercase tracking-wider text-[11px] text-gray-500">
                  Actions
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-xs">
            {students.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <User className="w-8 h-8 text-gray-300" />
                    <p className="font-semibold text-gray-700">No candidates match your filters</p>
                    <p className="text-[11px] text-gray-400">
                      Try clearing or adjusting your branch, CGPA, or status filters.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              students.map((student) => {
                const isSelected = selectedIds.includes(student.id);
                const isActive = activeStudentId === student.id;

                const isPlacedConfirmed =
                  student.status === "Placed / Confirmed" ||
                  student.status === "Placed" ||
                  student.rawPlacementStatus === "OFFER_ACCEPTED";

                const isSelectedPending =
                  student.status === "Selected" ||
                  student.rawPlacementStatus === "SELECTED";

                const isOfferDeclined =
                  student.status === "Offer Declined" ||
                  student.rawPlacementStatus === "OFFER_DECLINED";

                const isOfferAccepted =
                  student.status === "Offer Accepted";

                return (
                  <tr
                    key={student.id}
                    onClick={() => onViewDossier && onViewDossier(student)}
                    title={`Click to view ${student.name}'s complete dossier`}
                    className={`h-13 transition-colors cursor-pointer select-none group ${
                      isActive
                        ? "bg-blue-50/80 border-l-4 border-l-blue-600 shadow-xs"
                        : isSelected
                        ? "bg-amber-50/50 hover:bg-amber-50/80"
                        : "hover:bg-slate-50/90 active:bg-slate-100"
                    }`}
                  >
                    {/* Checkbox */}
                    <td
                      className="pl-4 py-2.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        aria-label={`Select student ${student.name}`}
                        checked={isSelected}
                        onChange={() => onToggleSelect(student.id)}
                        className="rounded border-gray-300 text-gray-900 focus:ring-0 cursor-pointer"
                      />
                    </td>

                    {/* PRN */}
                    <td className="px-3 py-2.5 font-mono text-gray-700 font-medium group-hover:text-gray-900">
                      {student.prn}
                    </td>

                    {/* Candidate Name & Email */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] flex-shrink-0 select-none shadow-2xs ${getAvatarColor(
                            student.name
                          )}`}
                        >
                          {getInitials(student.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 truncate group-hover:text-blue-700 transition-colors">
                            {student.name}
                          </div>
                          <div className="text-slate-600 text-[11px] font-mono truncate">
                            {student.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Branch */}
                    <td className="px-3 py-2.5 text-gray-600">
                      {student.branch}
                    </td>

                    {/* CGPA */}
                    <td className="px-3 py-2.5 text-center font-bold text-gray-900 tabular-nums">
                      {student.cgpa !== null ? Number(student.cgpa).toFixed(2) : "—"}
                    </td>

                    {/* Backlogs */}
                    <td className="px-3 py-2.5 text-center">
                      {student.backlogs === 0 ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-xs tabular-nums bg-emerald-50/70 border border-emerald-200/60 px-2 py-0.5 rounded-full">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>0 Active</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-semibold text-[11px] tabular-nums">
                          <AlertTriangle className="w-3 h-3 text-rose-500" />
                          <span>{student.backlogs} Active</span>
                        </span>
                      )}
                    </td>

                    {/* Placement Status */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {isPlacedConfirmed ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>Placed / Confirmed</span>
                        </span>
                      ) : isOfferAccepted ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>Offer Accepted</span>
                        </span>
                      ) : isSelectedPending ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          <span>Selected</span>
                        </span>
                      ) : isOfferDeclined ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          <span>Offer Declined</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          <span>Unplaced</span>
                        </span>
                      )}
                    </td>

                    {/* Placement Details */}
                    <td className="px-4 py-2.5 text-xs">
                      {student.placementDetails ? (
                        <span
                          className={`font-medium ${
                            isPlacedConfirmed
                              ? "text-emerald-900"
                              : isSelectedPending
                              ? "text-blue-900"
                              : isOfferDeclined
                              ? "text-amber-900"
                              : "text-gray-500"
                          }`}
                        >
                          {student.placementDetails}
                        </span>
                      ) : isPlacedConfirmed ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-gray-900">
                            {student.organization || "Corporate Partner"}
                          </span>
                          {student.packageLPA && (
                            <span className="text-gray-800 font-mono font-medium tabular-nums text-[11px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              ₹{Number(student.packageLPA).toFixed(2)} LPA
                            </span>
                          )}
                        </div>
                      ) : isSelectedPending ? (
                        <span className="text-blue-800 font-medium">
                          {student.organization ? `${student.organization} • ` : ""}
                          Selection Pending Confirmation
                        </span>
                      ) : isOfferDeclined ? (
                        <span className="text-amber-800 font-medium">
                          {student.organization ? `${student.organization} • ` : ""}
                          Offer Declined
                        </span>
                      ) : (
                        <span className="text-gray-500 font-normal">
                          Not Placed
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td
                      className="px-4 py-2.5 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onViewDossier(student)}
                          title="View Candidate Dossier"
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 bg-blue-50/60 hover:bg-blue-50 border border-blue-200/60 font-semibold text-xs px-2.5 py-1 rounded-md transition cursor-pointer"
                        >
                          <span>Dossier</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditStudent && onEditStudent(student)}
                          title="Edit Candidate Details"
                          className="p-1.5 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100 transition cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onViewDossier && onViewDossier(student)}
                          title="View Verified Candidate Documents"
                          className="p-1.5 text-gray-400 hover:text-blue-700 rounded-md hover:bg-blue-50 transition cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteStudent && onDeleteStudent(student)}
                          title="Deactivate Candidate Account"
                          className="p-1.5 text-gray-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

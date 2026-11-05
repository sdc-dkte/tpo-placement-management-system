import React, { useMemo } from "react";

export default function BranchFilterChips({
  selectedBranch = "ALL",
  onSelectBranch,
  countsByBranch = {},
  departments = [],
  totalCount = 0,
}) {
  const chips = useMemo(() => {
    const allCount =
      totalCount ?? departments.reduce((acc, d) => acc + (d.studentCount || 0), 0);

    const allChip = {
      code: "ALL",
      name: "All Branches",
      short: "All Branches",
      count: allCount,
    };

    if (departments && departments.length > 0) {
      return [
        allChip,
        ...departments.map((d) => ({
          id: d.id,
          code: d.code,
          name: d.name,
          short: d.code,
          count: d.studentCount ?? 0,
        })),
      ];
    }

    return [allChip];
  }, [departments, totalCount]);

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 no-scrollbar flex-wrap">
      <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mr-1">
        Department:
      </span>
      {chips.map((dept) => {
        const isSelected = selectedBranch === dept.code;
        const count = countsByBranch[dept.code] ?? dept.count;

        return (
          <button
            key={dept.code}
            type="button"
            onClick={() => onSelectBranch(dept.code)}
            className={`px-3 py-1 text-xs rounded-md transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer active:scale-[0.98] ${
              isSelected
                ? "bg-[#111827] text-white font-semibold shadow-xs"
                : "bg-white border border-[#E5E7EB] text-gray-600 hover:text-gray-900 hover:border-gray-300 font-medium hover:bg-slate-50"
            }`}
          >
            <span>{dept.short || dept.name}</span>
            <span
              className={`text-[11px] tabular-nums ${
                isSelected ? "text-gray-300" : "text-gray-400"
              }`}
            >
              ({count})
            </span>
          </button>
        );
      })}
    </div>
  );
}

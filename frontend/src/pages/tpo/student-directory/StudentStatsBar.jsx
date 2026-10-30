import React from "react";

export default function StudentStatsBar({
  total = 0,
  placed = 0,
  unplaced = 0,
  syncStatus = "Active & Synchronized",
}) {
  const placedPercent = total > 0 ? ((placed / total) * 100).toFixed(1) : "0.0";

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-lg px-4 py-2.5 flex items-center justify-between flex-wrap gap-4 text-xs font-medium shadow-xs">
      <div className="flex items-center gap-6 flex-wrap">
        {/* Total Registered */}
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
          <span className="text-gray-500">Total Registered:</span>
          <span className="font-bold text-gray-900 tabular-nums">{total.toLocaleString()}</span>
        </div>

        {/* Divider dot */}
        <span className="text-gray-300 hidden sm:inline">•</span>

        {/* Placed Candidates */}
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
          <span className="text-gray-500">Placed Candidates:</span>
          <span className="font-bold text-emerald-700 tabular-nums">
            {placed.toLocaleString()} ({placedPercent}%)
          </span>
        </div>

        {/* Divider dot */}
        <span className="text-gray-300 hidden sm:inline">•</span>

        {/* Unplaced & Seeking */}
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
          <span className="text-gray-500">Unplaced & Seeking:</span>
          <span className="font-bold text-gray-900 tabular-nums">{unplaced.toLocaleString()}</span>
        </div>
      </div>

      {/* Registry Status */}
      <div className="flex items-center gap-2 text-xs">
        <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
        <span className="text-gray-500">Registry Status:</span>
        <span className="font-semibold text-emerald-700">{syncStatus}</span>
      </div>
    </div>
  );
}

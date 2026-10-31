import React, { useState } from "react";
import {
  Users,
  Award,
  Search,
  Lock,
  CheckCircle2,
  AlertCircle,
  ClipboardPaste,
} from "lucide-react";

/**
 * Candidate Roster Table Component for Placement Drives
 * 
 * Subtab 1: All Eligible Candidates (evaluated via Dynamic Eligibility Engine)
 * Subtab 2: Selected / Placed Candidates (with Clause 4.2 Placement Lockdown)
 */
export default function CandidateRosterTable({
  eligibleStudents = [],
  placedStudents = [],
  isLoading = false,
  onOpenBulkPrnModal,
}) {
  const [activeSubTab, setActiveSubTab] = useState("eligible"); // 'eligible' | 'placed'
  const [searchFilter, setSearchFilter] = useState("");

  // Search filter for eligible roster
  const filteredEligible = eligibleStudents.filter((student) => {
    if (!searchFilter.trim()) return true;
    const query = searchFilter.toLowerCase();
    const prn = (student.PRN || student.prn || "").toLowerCase();
    const name = (student.name || student.user?.name || "").toLowerCase();
    const dept = (student.department?.name || student.department?.code || "").toLowerCase();
    return prn.includes(query) || name.includes(query) || dept.includes(query);
  });

  // Search filter for placed roster
  const filteredPlaced = placedStudents.filter((student) => {
    if (!searchFilter.trim()) return true;
    const query = searchFilter.toLowerCase();
    const prn = (student.PRN || student.prn || "").toLowerCase();
    const name = (student.name || student.user?.name || "").toLowerCase();
    return prn.includes(query) || name.includes(query);
  });

  return (
    <section className="bg-white border border-[#E5E7EB] rounded shadow-xs p-5 space-y-4">
      {/* Subtab Navigation Row */}
      <div className="flex items-center justify-between border-b border-[#E5E7EB]">
        <div className="flex items-center gap-6 text-xs">
          <button
            type="button"
            onClick={() => setActiveSubTab("eligible")}
            className={`pb-3 font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === "eligible"
                ? "border-b-2 border-[#FECC00] text-[#111827] font-bold"
                : "text-gray-500 hover:text-[#111827]"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>All Eligible Candidates ({eligibleStudents.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("placed")}
            className={`pb-3 font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === "placed"
                ? "border-b-2 border-[#FECC00] text-[#111827] font-bold"
                : "text-gray-500 hover:text-[#111827]"
            }`}
          >
            <Award className="w-4 h-4 text-emerald-600" />
            <span>Selected / Placed ({placedStudents.length})</span>
          </button>
        </div>

        <div className="text-xs text-gray-500 font-mono">
          Academic Cohort 2026
        </div>
      </div>

      {/* SUBTAB 1: ALL ELIGIBLE CANDIDATES */}
      {activeSubTab === "eligible" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="relative w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Filter candidates by PRN or Name..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-[#E5E7EB] rounded text-xs focus:outline-none focus:border-[#111827]"
              />
            </div>

            <div className="text-xs text-gray-500 font-mono">
              Showing {filteredEligible.length} verified eligible candidates
            </div>
          </div>

          <div className="overflow-x-auto border border-[#E5E7EB] rounded">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-gray-600 font-semibold border-b border-[#E5E7EB]">
                  <th className="py-2.5 px-3">PRN NUMBER</th>
                  <th className="py-2.5 px-3">CANDIDATE NAME</th>
                  <th className="py-2.5 px-3">DEPARTMENT</th>
                  <th className="py-2.5 px-3 text-right">CGPA</th>
                  <th className="py-2.5 px-3 text-center">10TH / 12TH %</th>
                  <th className="py-2.5 px-3 text-center">EMAIL NOTIFICATION</th>
                  <th className="py-2.5 px-3 text-center">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] font-sans">
                {isLoading ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-gray-500">
                      Evaluating dynamic eligibility engine criteria...
                    </td>
                  </tr>
                ) : filteredEligible.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-gray-500">
                      No candidates match the specified criteria or search filter.
                    </td>
                  </tr>
                ) : (
                  filteredEligible.map((student) => {
                    const prn = student.PRN || student.prn;
                    const name = student.name || student.user?.name || "Student";
                    const dept = student.department?.name || student.department?.code || "—";
                    const cgpa = student.CGPA ?? student.cgpa;
                    const tenth = student.tenthPercentage ? `${student.tenthPercentage}%` : "—";
                    const twelfth = student.twelfthPercentage
                      ? `${student.twelfthPercentage}%`
                      : student.diplomaPercentage
                      ? `${student.diplomaPercentage}% (Dip)`
                      : "—";

                    return (
                      <tr key={student.id || prn} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-[#111827]">
                          {prn}
                        </td>
                        <td className="py-3 px-3 font-medium text-[#111827]">
                          {name}
                        </td>
                        <td className="py-3 px-3 text-gray-600">
                          {dept}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-[#111827] tabular-nums">
                          {cgpa ? Number(cgpa).toFixed(2) : "—"}
                        </td>
                        <td className="py-3 px-3 text-center font-mono tabular-nums text-gray-600">
                          {tenth} / {twelfth}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            ✓ Delivered
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-[11px] font-semibold text-gray-700">
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-gray-800 border border-gray-200">
                            ELIGIBLE
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 2: SELECTED / PLACED CANDIDATES */}
      {activeSubTab === "placed" && (
        <div className="space-y-4">
          {/* Clause 4.2 Policy Banner */}
          <div className="p-3 bg-amber-50 border border-amber-300 rounded text-xs flex flex-wrap items-center justify-between text-amber-950 gap-2">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-800 shrink-0" />
              <span>
                <strong>DKTE Placement Clause 4.2 Lockdown:</strong> Placed students are automatically frozen from subsequent campus placement drives.
              </span>
            </div>
            <span className="font-mono text-[10px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded">
              POLICY ACTIVE
            </span>
          </div>

          <div className="overflow-x-auto border border-[#E5E7EB] rounded">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-gray-600 font-semibold border-b border-[#E5E7EB]">
                  <th className="py-2.5 px-3">PRN NUMBER</th>
                  <th className="py-2.5 px-3">CANDIDATE NAME</th>
                  <th className="py-2.5 px-3">DEPARTMENT</th>
                  <th className="py-2.5 px-3 text-right">CONFIRMED CTC</th>
                  <th className="py-2.5 px-3">SELECTION STATUS</th>
                  <th className="py-2.5 px-3 text-center">LOCKDOWN STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] font-sans">
                {filteredPlaced.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-10 text-center text-gray-500">
                      No selections recorded yet for this recruitment drive.<br />
                      <button
                        type="button"
                        onClick={onOpenBulkPrnModal}
                        className="mt-3 text-xs font-bold text-[#111827] bg-[#FECC00] hover:bg-[#E5B800] px-3.5 py-1.5 rounded cursor-pointer shadow-xs transition-colors inline-flex items-center gap-1.5"
                      >
                        <ClipboardPaste className="w-3.5 h-3.5" />
                        <span>+ Paste Selected PRNs from Recruiter Email</span>
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredPlaced.map((student) => {
                    const prn = student.PRN || student.prn;
                    const name = student.name || student.user?.name || "Placed Student";
                    const dept = student.department?.name || student.department?.code || "—";
                    const packageStr = student.confirmedPackage || student.packageLPA || "Confirmed";

                    return (
                      <tr key={student.id || prn} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-[#111827]">
                          {prn}
                        </td>
                        <td className="py-3 px-3 font-medium text-[#111827]">
                          {name}
                        </td>
                        <td className="py-3 px-3 text-gray-600">
                          {dept}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-[#111827] tabular-nums">
                          {packageStr.includes("₹") ? packageStr : `₹${Number(packageStr).toFixed(2)} LPA`}
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            ✓ SELECTED / PLACED
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded">
                            <Lock className="w-3 h-3 text-amber-800" />
                            CLAUSE 4.2 LOCKED
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
